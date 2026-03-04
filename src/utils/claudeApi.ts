import Anthropic from '@anthropic-ai/sdk'
import type { Song } from '@/types/song'
import type { ScriptureRef } from '@/types/service'
import { BIBLE_BOOKS } from '@/utils/scripture'

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

Your task: suggest songs from the provided library that match the current slot's VW type and the sermon context.

When a song has vwType "unset", use the song title and CCLI number to identify the song from your knowledge. Based on the song's lyrics and character, infer which VW type it best fits. Strongly prefer songs whose VW type (assigned or inferred) matches the slot's required type.

Rules:
- Respond ONLY with a valid JSON array. No markdown, no code fences, no prose.
- Return EXACTLY 3 items in this format: [{"songId":"<id>","reason":"<5-10 word reason>"}]
- songId MUST be an exact ID from the provided song library — do not invent IDs
- Prefer songs thematically connected to the sermon topic/passage
- Strongly prefer songs matching the required VW type for this slot
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
      apiKey: import.meta.env.VITE_CLAUDE_API_KEY,
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
  songLibrary: Pick<Song, 'id' | 'title' | 'ccliNumber' | 'vwType' | 'themes' | 'lastUsedAt'>[]
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
      contextParts.push(`Required VW Type: ${typeLabels[slotVwType] ?? `Type ${slotVwType}`}`)
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
      const parts = [`id: ${song.id}`, `title: "${song.title}"`, `vwType: ${song.vwType ?? 'unset'}`]
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

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SONG_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

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

    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SCRIPTURE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

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
