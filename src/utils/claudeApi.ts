import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import type { Song } from '@/types/song'
import type { ScriptureRef } from '@/types/service'
import type { CongregationalSection } from '@/types/slide'
import { BIBLE_BOOKS } from '@/utils/scripture'
import { getAppAuthHeaders } from '@/utils/appAuth'
import {
  computeBoundaries,
  hasSplittableBoundaries,
  embedBoundaryMarkers,
  sliceAtBoundaries,
  stripVerseMarkers,
  verseRangeForSlice,
} from '@/utils/scriptureBoundaries'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiSongSuggestion {
  songId: string
  reason: string
}

export interface AiScriptureSuggestion {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  reason: string
  recentlyUsed: boolean
  weeksAgoUsed: number | null
}

// ─── System Prompts ──────────────────────────────────────────────────────────

const SONG_SYSTEM_PROMPT = `You are a worship music curator for a church that follows the Vertical Worship (VW) methodology.
VW song types:
- Type 1: Call to Worship — broad, corporate, celebratory; draws the congregation in
- Type 2: Intimate — personal, devotional, inward focus; draws hearts closer to God
- Type 3: Ascription — declaratory, bold, attributes of God; closes in exaltation

Your task: suggest songs from the provided library that best fit the sermon context. Suggest broadly across the whole catalog — the slot's VW type is provided as context only and should NOT restrict your suggestions. The worship planner applies the 1-2-3 paradigm themselves; your job is to surface thematically relevant songs.

When a song has vwType "unset", use the song title and CCLI number to identify the song from your knowledge. Based on the song's lyrics and character, infer which VW type it best fits.

Rules:
- Respond ONLY with a valid JSON array. No markdown, no code fences, no prose.
- Return EXACTLY 3 items in this format: [{"songId":"<id>","reason":"<5-10 word reason>"}]
- songId MUST be an exact ID from the provided song library — do not invent IDs
- Prefer songs thematically connected to the sermon topic/passage
- The slot's VW type is advisory context — do not use it as a hard filter (D-11)
- Deprioritize songs used in the last 2 weeks (listed as recent)
- Consider already-selected songs to build a cohesive service flow
- If fewer than 3 suitable songs exist, return however many are available`

const SCRIPTURE_SYSTEM_PROMPT = `You are a biblical scholar helping plan worship scripture readings.

Your task: suggest scripture passages thematically relevant to the given sermon context or search query.

Rules:
- Respond ONLY with a valid JSON array. No markdown, no code fences, no prose.
- Return 3-5 items in this format: [{"book":"<name>","chapter":<n>,"verseStart":<n>,"verseEnd":<n>,"reason":"<5-10 words>","recentlyUsed":<bool>,"weeksAgoUsed":<n|null>}]
- Book names MUST match the Protestant canon exactly (e.g., "Psalms" not "Psalm", "1 Corinthians" not "First Corinthians")
- Aim for passages around 10 verses long — not too short (under 5) or too long (over 15)
- Prefer passages with specific verse ranges, not entire chapters
- Note if a passage appears in the recently used list by setting recentlyUsed:true and weeksAgoUsed to the number of weeks
- Suggest thematically strong passages even if recently used — let the planner decide`

// ─── Lazy Singleton Client ────────────────────────────────────────────────────

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      // The real key lives server-side in the /api/anthropic proxy (Cloud Function).
      // This placeholder is overwritten by the proxy and never reaches Anthropic.
      apiKey: 'proxied-server-side',
      baseURL: `${window.location.origin}/api/anthropic`,
      dangerouslyAllowBrowser: true,
    })
  }
  return _client
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safely parse a JSON array from AI response text.
 * Handles: clean JSON, prose-wrapped JSON, markdown-fenced JSON.
 * Returns null on any failure.
 */
export function safeParseJsonArray(text: string): unknown[] | null {
  if (!text || !text.trim()) return null

  // Try direct parse first
  try {
    const parsed = JSON.parse(text.trim())
    if (Array.isArray(parsed)) return parsed
    return null
  } catch {
    // Fall through to regex extraction
  }

  // Try to extract array from prose or code fences using regex
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[0])
    if (Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Filter AI song suggestions to only include songIds that exist in the provided song library.
 * Removes hallucinated IDs.
 */
export function validateSongSuggestions(
  aiResult: AiSongSuggestion[],
  songs: { id: string }[],
): AiSongSuggestion[] {
  const songIdSet = new Set(songs.map((s) => s.id))
  return aiResult.filter((suggestion) => songIdSet.has(suggestion.songId))
}

/**
 * Filter AI scripture suggestions to only include books that exist in the Protestant canon.
 * Removes hallucinated or apocryphal book names.
 */
export function validateScriptureSuggestions(
  aiResult: AiScriptureSuggestion[],
): AiScriptureSuggestion[] {
  const bookSet = new Set<string>(BIBLE_BOOKS)
  return aiResult.filter((suggestion) => bookSet.has(suggestion.book))
}

// ─── Song Suggestion Parameters ──────────────────────────────────────────────

export interface GetSongSuggestionsParams {
  sermonTopic: string | null
  sermonPassage: ScriptureRef | null
  slotVwType: number | null
  alreadySelectedSongIds: string[]
  songLibrary: Pick<Song, 'id' | 'title' | 'ccliNumber' | 'vwTypes' | 'themes' | 'lastUsedAt'>[]
  recentServiceSongIds: string[]
}

/**
 * Get AI song suggestions for a specific slot.
 * Returns null on any error (API error, parse error, empty validated results).
 */
export async function getSongSuggestions(
  params: GetSongSuggestionsParams,
): Promise<AiSongSuggestion[] | null> {
  try {
    const {
      sermonTopic,
      sermonPassage,
      slotVwType,
      alreadySelectedSongIds,
      songLibrary,
      recentServiceSongIds,
    } = params

    // Build context string
    const contextParts: string[] = []

    if (sermonTopic) {
      contextParts.push(`Sermon Topic/Theme: ${sermonTopic}`)
    }

    if (sermonPassage) {
      const passageStr = sermonPassage.verseStart
        ? `${sermonPassage.book} ${sermonPassage.chapter}:${sermonPassage.verseStart}${sermonPassage.verseEnd ? `-${sermonPassage.verseEnd}` : ''}`
        : `${sermonPassage.book} ${sermonPassage.chapter}`
      contextParts.push(`Sermon Passage: ${passageStr}`)
    }

    if (slotVwType) {
      const typeLabels: Record<number, string> = {
        1: 'Type 1 (Call to Worship)',
        2: 'Type 2 (Intimate)',
        3: 'Type 3 (Ascription)',
      }
      // Advisory only (D-11): mention as context but do NOT restrict suggestions to this type
      contextParts.push(`Slot VW Type (advisory context only): ${typeLabels[slotVwType] ?? `Type ${slotVwType}`}`)
    }

    if (alreadySelectedSongIds.length > 0) {
      const selectedTitles = alreadySelectedSongIds
        .map((id) => {
          const song = songLibrary.find((s) => s.id === id)
          return song ? `"${song.title}"` : id
        })
        .join(', ')
      contextParts.push(`Already selected songs in this service: ${selectedTitles}`)
    }

    if (recentServiceSongIds.length > 0) {
      const recentTitles = recentServiceSongIds
        .map((id) => {
          const song = songLibrary.find((s) => s.id === id)
          return song ? `"${song.title}"` : id
        })
        .join(', ')
      contextParts.push(`Recently used songs (last 2 weeks — deprioritize): ${recentTitles}`)
    }

    // Build song library context (id/title/vwType/themes/lastUsedAt only)
    const libraryEntries = songLibrary.map((song) => {
      const parts = [`id: ${song.id}`, `title: "${song.title}"`, `vwTypes: ${song.vwTypes.length > 0 ? song.vwTypes.join(',') : 'unset'}`]
      if (song.ccliNumber) {
        parts.push(`ccli: ${song.ccliNumber}`)
      }
      if (song.themes.length > 0) {
        parts.push(`themes: ${song.themes.join(', ')}`)
      }
      if (song.lastUsedAt) {
        const ms = song.lastUsedAt.toMillis()
        const weeksAgo = Math.floor((Date.now() - ms) / (7 * 24 * 60 * 60 * 1000))
        parts.push(`lastUsed: ${weeksAgo} weeks ago`)
      }
      return `{ ${parts.join(', ')} }`
    })

    const userMessage = [
      ...contextParts,
      '',
      `Song Library (${songLibrary.length} songs):`,
      ...libraryEntries,
    ].join('\n')

    const response = await getClient().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SONG_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { headers: await getAppAuthHeaders() },
    )

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') return null

    const parsed = safeParseJsonArray(textContent.text)
    if (!parsed) return null

    const validated = validateSongSuggestions(parsed as AiSongSuggestion[], songLibrary)
    if (validated.length === 0) return null

    return validated
  } catch (err) {
    console.error('[claudeApi] getSongSuggestions failed:', err)
    return null
  }
}

// ─── Scripture Suggestion Parameters ─────────────────────────────────────────

export interface GetScriptureSuggestionsParams {
  sermonTopic: string | null
  sermonPassage: ScriptureRef | null
  query: string
  recentScriptures: ScriptureRef[]
}

/**
 * Get AI scripture suggestions based on sermon context or natural language query.
 * Returns null on any error (API error, parse error, empty validated results).
 */
export async function getScriptureSuggestions(
  params: GetScriptureSuggestionsParams,
): Promise<AiScriptureSuggestion[] | null> {
  try {
    const { sermonTopic, sermonPassage, query, recentScriptures } = params

    const contextParts: string[] = []

    if (query) {
      contextParts.push(`Search Query: ${query}`)
    }

    if (sermonTopic) {
      contextParts.push(`Sermon Topic/Theme: ${sermonTopic}`)
    }

    if (sermonPassage) {
      const passageStr = sermonPassage.verseStart
        ? `${sermonPassage.book} ${sermonPassage.chapter}:${sermonPassage.verseStart}${sermonPassage.verseEnd ? `-${sermonPassage.verseEnd}` : ''}`
        : `${sermonPassage.book} ${sermonPassage.chapter}`
      contextParts.push(`Sermon Passage: ${passageStr}`)
    }

    if (recentScriptures.length > 0) {
      const recentList = recentScriptures
        .map((s) => {
          if (s.verseStart) {
            return `${s.book} ${s.chapter}:${s.verseStart}${s.verseEnd ? `-${s.verseEnd}` : ''}`
          }
          return `${s.book} ${s.chapter}`
        })
        .join(', ')
      contextParts.push(`Recently used scriptures (note if suggesting these): ${recentList}`)
    }

    const userMessage = contextParts.join('\n')

    const response = await getClient().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SCRIPTURE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { headers: await getAppAuthHeaders() },
    )

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') return null

    const parsed = safeParseJsonArray(textContent.text)
    if (!parsed) return null

    const validated = validateScriptureSuggestions(parsed as AiScriptureSuggestion[])
    if (validated.length === 0) return null

    return validated
  } catch (err) {
    console.error('[claudeApi] getScriptureSuggestions failed:', err)
    return null
  }
}

// ─── Congregational Split ─────────────────────────────────────────────────────

/**
 * The structural data the model is allowed to hand back for a congregational
 * split: a speaker label and two integer indices into a pre-computed
 * legal-boundary array (see `src/utils/scriptureBoundaries.ts`). Never text.
 */
export interface SplitSection {
  speaker: 'LEADER' | 'CONGREGATION'
  startBoundary: number
  endBoundary: number
}

/**
 * The structural contract the model is allowed to speak — nothing else.
 *
 * This schema's field set is itself part of R064's guarantee: there is no
 * field here the model could populate with scripture words, not even an
 * optional one the code never reads. Adding any string-typed property beyond
 * `speaker`'s closed enum would mean the model *could* emit text, defeating
 * the structural guarantee no matter how good the prompt (see P-02).
 *
 * Structured outputs' JSON Schema subset has no `minimum`, `maximum`, or
 * `multipleOf` — this schema proves SHAPE only (an integer where an integer
 * is expected, one of two enum strings). Every bounds, ordering, adjacency
 * and coverage check lives in `validateSplitResult` below, in plain
 * TypeScript, because the schema is structurally incapable of expressing
 * them. Do not reach for `strict: true` here — that field belongs to tool
 * definitions, not to `OutputConfig`, and would not add range enforcement
 * even if it applied.
 */
export const SPLIT_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['LEADER', 'CONGREGATION'] },
          startBoundary: { type: 'integer' },
          endBoundary: { type: 'integer' },
        },
        required: ['speaker', 'startBoundary', 'endBoundary'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
} as const

/**
 * The sole gate between untrusted model output and scripture a congregation
 * will read aloud. Every check below exists in code, not in `SPLIT_SCHEMA`,
 * because the structured-outputs JSON Schema subset supports no numerical
 * constraint and no cross-field relationship: shape conformance says nothing
 * about range, ordering, adjacency, or coverage.
 *
 * A single violation discards the ENTIRE result — never a partial array,
 * never a repair, never a re-sort. `boundaries` MUST be the exact same array
 * used to build the prompt (scriptureBoundaries.ts's Pitfall 5 discipline —
 * never recompute it here).
 */
export function validateSplitResult(
  parsed: unknown,
  boundaries: number[],
): SplitSection[] | null {
  if (parsed === null || typeof parsed !== 'object') return null
  if (!('sections' in parsed)) return null

  const sections = (parsed as { sections: unknown }).sections
  if (!Array.isArray(sections) || sections.length === 0) return null

  const maxIndex = boundaries.length - 1
  let prevEnd: number | null = null

  for (const section of sections) {
    if (section === null || typeof section !== 'object') return null

    const keys = Object.keys(section)
    if (
      keys.length !== 3 ||
      !keys.includes('speaker') ||
      !keys.includes('startBoundary') ||
      !keys.includes('endBoundary')
    ) {
      return null
    }

    const { speaker, startBoundary, endBoundary } = section as {
      speaker: unknown
      startBoundary: unknown
      endBoundary: unknown
    }

    if (speaker !== 'LEADER' && speaker !== 'CONGREGATION') return null
    if (!Number.isInteger(startBoundary) || !Number.isInteger(endBoundary)) return null

    const start = startBoundary as number
    const end = endBoundary as number

    if (start < 0 || start > maxIndex) return null
    if (end < 0 || end > maxIndex) return null
    if (start >= end) return null
    // A single equality rejects a gap and an overlap identically, and makes
    // an out-of-order result unrepresentable without also being
    // non-contiguous.
    if (prevEnd !== null && start !== prevEnd) return null

    prevEnd = end
  }

  const first = sections[0] as { startBoundary: number }
  if (first.startBoundary !== 0) return null
  if (prevEnd !== maxIndex) return null

  return sections as SplitSection[]
}

/**
 * The system prompt for the split call. Structural, not creative: it tells
 * the model the passage is annotated with numbered legal-split markers and
 * that it must choose only among those marker indices — never reproduce,
 * retype, or quote any word of the passage itself (P-02).
 */
const SPLIT_SYSTEM_PROMPT = `You are structuring a scripture passage into a responsive reading for a church service.

The passage below is annotated with numbered markers like ⟦0⟧, ⟦1⟧, ⟦2⟧ at every position where a section may legally start or end. You must NOT reproduce, retype, or quote any word of the passage — you only choose marker indices.

Rules:
- Return a list of sections, each identified only by the marker index it starts at (startBoundary) and the marker index it ends at (endBoundary), plus a speaker.
- Speakers alternate, starting with LEADER.
- Sections must cover the whole passage with no gap and no overlap: each section's endBoundary must equal the next section's startBoundary.
- The first section must start at index 0, and the last section must end at the highest marker index in the passage.
- If a congregational refrain repeats within the passage, give each occurrence of it to CONGREGATION.
- Respond only with the structured data requested — no prose, no passage text.`

/**
 * The AI-assisted congregational-reading split. Computes the legal boundary
 * positions once, shows the model a marked-up copy of the passage, and
 * constrains its reply to indices + a speaker label via `SPLIT_SCHEMA`. The
 * model's response never contributes a single character to the returned
 * sections' `text` — every character comes from `sliceAtBoundaries` against
 * the untouched `rawText` passed in.
 *
 * Two invariants a future editor is most likely to break:
 * 1. `boundaries` is computed exactly once here and threaded unchanged
 *    through prompt-building, validation, and slicing. Recomputing it
 *    anywhere in this function (even by calling `computeBoundaries` again on
 *    the same `rawText`) risks desyncing the indices the model saw from the
 *    indices used to validate/slice its answer (RESEARCH Pitfall 5). This is
 *    not an optional discipline — do not "simplify" it away.
 * 2. A `validateSplitResult` failure discards the ENTIRE result. There is no
 *    partial-application path here, and none should ever be added — a
 *    result that fails validation must never leak a single section to the
 *    caller.
 *
 * Returns `null` on any failure — no internal boundary to split on, a source
 * already containing a marker delimiter, a network/API error, an unparseable
 * reply, or a reply that fails validation. A caller can never be handed a
 * rejected promise or a partial split.
 */
export async function splitCongregationalReading(
  rawText: string,
): Promise<CongregationalSection[] | null> {
  try {
    const boundaries = computeBoundaries(rawText)
    if (!hasSplittableBoundaries(boundaries)) return null

    const markedUp = embedBoundaryMarkers(rawText, boundaries)
    if (markedUp === null) return null

    const response = await getClient().messages.parse(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SPLIT_SYSTEM_PROMPT,
        output_config: { format: jsonSchemaOutputFormat(SPLIT_SCHEMA) },
        messages: [{ role: 'user', content: markedUp }],
      },
      { headers: await getAppAuthHeaders() },
    )

    const validated = validateSplitResult(response.parsed_output, boundaries)
    if (!validated) return null

    return validated.map(({ speaker, startBoundary, endBoundary }) => {
      const slice = sliceAtBoundaries(rawText, boundaries, startBoundary, endBoundary)
      return {
        speaker,
        text: stripVerseMarkers(slice),
        verseRange: verseRangeForSlice(slice),
      }
    })
  } catch (err) {
    console.error('[claudeApi] splitCongregationalReading failed:', err)
    return null
  }
}
