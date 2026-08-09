/**
 * Pure, testable text<->sections conversion for the `---`-delimited
 * congregational-reading editor (supersedes Phase 47's click-between-verses
 * divider model per owner feedback: the divider UX was unintuitive).
 *
 * The editor is a plain textarea. Slides are separated by a line containing
 * only `---`; within each slide the speaker (Leader / Congregation / All) may
 * sit on its own first line above that slide's text. This module is the single
 * source of truth for that grammar in both directions.
 */
import type { CongregationalSection } from '@/types/slide'

type Speaker = 'LEADER' | 'CONGREGATION' | 'ALL'

/** Canonical human-readable label per speaker — used when serializing. */
export const SPEAKER_LABELS: Record<Speaker, string> = {
  LEADER: 'Leader',
  CONGREGATION: 'Congregation',
  ALL: 'All',
}

/** Recognized speaker-label lines (case-insensitive), mapped to their enum. */
const LABEL_TO_SPEAKER: Record<string, Speaker> = {
  leader: 'LEADER',
  congregation: 'CONGREGATION',
  all: 'ALL',
}

/** A line that is exactly `---` (optionally padded by whitespace). */
const SLIDE_DELIMITER = /^\s*---\s*$/m

/**
 * Parse `---`-delimited textarea content into congregational sections.
 *
 * - Chunks are split on lines that are exactly `---`.
 * - An empty (whitespace-only) chunk is skipped.
 * - The first non-empty line of a chunk, if it (case-insensitively) reads
 *   `leader`, `congregation`, or `all`, is consumed as the speaker and the
 *   remaining lines become the section text. Otherwise the whole chunk is the
 *   text and the speaker defaults to LEADER.
 * - A lone speaker label with no following text is skipped (not a slide).
 * - `translationSource` is stamped only when the arg is provided (R092).
 */
export function parseCongregationalText(
  text: string,
  translationSource?: 'ESV' | 'NLT',
): CongregationalSection[] {
  const sections: CongregationalSection[] = []

  for (const rawChunk of text.split(SLIDE_DELIMITER)) {
    const chunk = rawChunk.trim()
    if (!chunk) continue

    const lines = chunk.split('\n')
    const firstLine = lines[0]!.trim().toLowerCase()
    const matchedSpeaker = LABEL_TO_SPEAKER[firstLine]

    let speaker: Speaker
    let bodyText: string
    if (matchedSpeaker) {
      speaker = matchedSpeaker
      bodyText = lines.slice(1).join('\n').trim()
      // A lone label with no text is not a slide.
      if (bodyText === '') continue
    } else {
      speaker = 'LEADER'
      bodyText = chunk
    }

    const section: CongregationalSection = { speaker, text: bodyText }
    if (translationSource) section.translationSource = translationSource
    sections.push(section)
  }

  return sections
}

/**
 * Serialize sections back into `---`-delimited textarea content. Inverse of
 * `parseCongregationalText` for well-formed input (preserves speakers + text).
 */
export function serializeCongregationalSections(sections: CongregationalSection[]): string {
  return sections.map((s) => `${SPEAKER_LABELS[s.speaker]}\n${s.text}`).join('\n---\n')
}
