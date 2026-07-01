import type { Arrangement, Song } from '@/types/song'
import { VW_TYPE_LABELS } from '@/types/song'

/**
 * Case-insensitive substring match across a song's searchable text fields.
 * Matches: title, CCLI number, author, themes, team tags, VW category
 * (both the number, e.g. "1", and its label, e.g. "call to worship"),
 * arrangement key (exact), notes, and user tags.
 */
export function songMatchesQuery(song: Song, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true

  if (song.title.toLowerCase().includes(q)) return true
  if (String(song.ccliNumber).includes(q)) return true
  if (song.author?.toLowerCase().includes(q)) return true
  if (song.themes.some((t) => t.toLowerCase().includes(q))) return true
  if (song.teamTags.some((t) => t.toLowerCase().includes(q))) return true
  if (
    song.vwTypes.some(
      (vw) => String(vw) === q || VW_TYPE_LABELS[vw].toLowerCase().includes(q),
    )
  ) {
    return true
  }
  if (song.tags?.some((t) => t.toLowerCase().includes(q))) return true
  if (song.notes?.toLowerCase().includes(q)) return true
  if (song.arrangements.some((a) => a.key.toLowerCase() === q)) return true

  return false
}

/**
 * The arrangement designated as the song's "play key" for transitions.
 * Falls back to the first arrangement when no primary is set (legacy songs).
 */
export function getPrimaryArrangement(song: Song): Arrangement | undefined {
  if (song.primaryArrangementId) {
    const found = song.arrangements.find((a) => a.id === song.primaryArrangementId)
    if (found) return found
  }
  return song.arrangements[0]
}

/** The song's primary key string (empty string when none). */
export function getPrimaryKey(song: Song): string {
  return getPrimaryArrangement(song)?.key ?? ''
}
