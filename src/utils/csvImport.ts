import type { Arrangement, Song } from '@/types/song'

export interface ParsedSongPreview {
  title: string
  ccliNumber: string
  author: string
  themes: string[]
  notes: string
  vwType: null
  teamTags: string[]
  arrangements: Arrangement[]
  isDuplicate: boolean
  _warnings: string[]
}

/**
 * Parse a comma-separated tag string into a trimmed array.
 * e.g. "Band, Strings, Acoustic" -> ["Band", "Strings", "Acoustic"]
 */
export function parseArrangementTags(tagString: string): string[] {
  if (!tagString || !tagString.trim()) return []
  return tagString
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/**
 * Parse an arrangement from a CSV row at the given 1-based index.
 * Returns null if the arrangement has no name (not present in this row).
 */
export function parseArrangementFromRow(
  row: Record<string, string>,
  index: number,
): Arrangement | null {
  const name =
    row[`Arrangement ${index} Name`]?.trim() ??
    row[`Arrangement ${index}`]?.trim() ??
    ''

  if (!name) return null

  const bpmRaw =
    row[`Arrangement ${index} BPM`]?.trim() ??
    row[`Arrangement ${index} Tempo`]?.trim() ??
    ''
  const bpmNum = parseFloat(bpmRaw)
  const bpm = bpmRaw && !isNaN(bpmNum) ? bpmNum : null

  const key =
    row[`Arrangement ${index} Keys`]?.trim() ??
    row[`Arrangement ${index} Key`]?.trim() ??
    ''

  const lengthRaw =
    row[`Arrangement ${index} Length`]?.trim() ??
    row[`Arrangement ${index} Length (Seconds)`]?.trim() ??
    ''
  const lengthNum = parseFloat(lengthRaw)
  const lengthSeconds = lengthRaw && !isNaN(lengthNum) ? lengthNum : null

  const tagsRaw =
    row[`Arrangement ${index} Tags`]?.trim() ??
    row[`Arrangement ${index} Tag`]?.trim() ??
    ''
  const teamTags = parseArrangementTags(tagsRaw)

  const chordChartUrl =
    row[`Arrangement ${index} Chord Chart`]?.trim() ??
    row[`Arrangement ${index} Chord Chart URL`]?.trim() ??
    ''

  const notes = row[`Arrangement ${index} Notes`]?.trim() ?? ''

  return {
    id: crypto.randomUUID(),
    name,
    key,
    bpm,
    lengthSeconds,
    chordChartUrl,
    notes,
    teamTags,
  }
}

/**
 * Map a single CSV row to a ParsedSongPreview.
 * Handles multiple Planning Center CSV column header variants defensively.
 */
export function mapRowToSong(row: Record<string, string>): ParsedSongPreview {
  const warnings: string[] = []

  // Title: try multiple header variants
  const title =
    row['Title']?.trim() ??
    row['Song Title']?.trim() ??
    ''

  if (!title) {
    warnings.push('Missing title')
  }

  // CCLI Number: try multiple header variants
  const ccliNumber =
    row['CCLI Number']?.trim() ??
    row['CCLI']?.trim() ??
    row['CCLI #']?.trim() ??
    ''

  // Author: try Author then Copyright
  const author =
    row['Author']?.trim() ??
    row['Copyright']?.trim() ??
    ''

  // Themes/Tags: split on comma
  const themesRaw =
    row['Themes']?.trim() ??
    row['Tags']?.trim() ??
    ''
  const themes = themesRaw
    ? themesRaw.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    : []

  // Notes
  const notes = row['Notes']?.trim() ?? ''

  // Parse up to 5 arrangements
  const arrangements: Arrangement[] = []
  for (let i = 1; i <= 5; i++) {
    const arr = parseArrangementFromRow(row, i)
    if (arr) arrangements.push(arr)
  }

  // Song-level teamTags = union of all arrangement teamTags
  const teamTags = [...new Set(arrangements.flatMap((a) => a.teamTags))]

  return {
    title,
    ccliNumber,
    author,
    themes,
    notes,
    vwType: null,
    teamTags,
    arrangements,
    isDuplicate: false,
    _warnings: warnings,
  }
}

/**
 * Check parsed songs against existing songs to flag duplicates.
 * Match order:
 * 1. CCLI number match (when both parsed and existing have a non-empty CCLI)
 * 2. Case-insensitive title match (when parsed song has no CCLI)
 */
export function detectDuplicates(
  parsed: ParsedSongPreview[],
  existing: Song[],
): ParsedSongPreview[] {
  return parsed.map((song) => {
    let isDuplicate = false

    if (song.ccliNumber) {
      // Match by CCLI number
      isDuplicate = existing.some(
        (e) => e.ccliNumber && e.ccliNumber === song.ccliNumber,
      )
    } else {
      // Fall back to case-insensitive title match
      const lowerTitle = song.title.toLowerCase()
      isDuplicate = existing.some(
        (e) => e.title.toLowerCase() === lowerTitle,
      )
    }

    return { ...song, isDuplicate }
  })
}
