/**
 * Pure, testable text<->sections conversion for the `---`-delimited
 * congregational-reading editor.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/congregationalText.ts)
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
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/congregationalText.ts)
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
