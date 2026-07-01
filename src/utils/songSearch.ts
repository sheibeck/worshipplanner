import type { Arrangement, Song } from '@/types/song'
import { VW_TYPE_LABELS } from '@/types/song'

/**
 * Case-insensitive substring match against a song's full searchable text field
 * set: title, CCLI number, author, themes, team tags, VW category (both the
 * number, e.g. "1", and its label, e.g. "call to worship"), user tags, notes,
 * and arrangement key (exact).
 */
function matchesBareTerm(song: Song, term: string): boolean {
  const q = term.toLowerCase()
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

const FIELD_PREFIX_RE = /^(type|key|tag|theme|team):(.*)$/i

/** Dispatches a single field-scoped or bare token against the song. */
function matchesToken(song: Song, token: string): boolean {
  const prefixMatch = FIELD_PREFIX_RE.exec(token)
  if (prefixMatch) {
    const field = prefixMatch[1]!.toLowerCase()
    const value = prefixMatch[2]!.trim()
    if (!value) return true

    const lowerValue = value.toLowerCase()
    switch (field) {
      case 'type':
        return song.vwTypes.some(
          (vw) => String(vw) === value || VW_TYPE_LABELS[vw].toLowerCase().includes(lowerValue),
        )
      case 'key':
        return song.arrangements.some((a) => a.key.toLowerCase() === lowerValue)
      case 'tag':
        return (song.tags ?? []).some((t) => t.toLowerCase().includes(lowerValue))
      case 'theme':
        return song.themes.some((t) => t.toLowerCase().includes(lowerValue))
      case 'team':
        return song.teamTags.some((t) => t.toLowerCase().includes(lowerValue))
      default:
        return matchesBareTerm(song, token)
    }
  }

  return matchesBareTerm(song, token)
}

/**
 * Multi-term AND search over a song's metadata. Supports field-scoped
 * prefixes (`type:`, `key:`, `tag:`, `theme:`, `team:`, with optional space
 * after the colon) and natural two-word phrases (`Type 1`, `Key A`), in
 * addition to the original bare full-field substring match. Every
 * whitespace-separated token in the query must match (AND).
 */
export function songMatchesQuery(song: Song, query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true

  // Phrase pre-parse (D-05): normalize "Type N" / "Key X" into prefix form.
  // Bounded, anchored regexes on short user-typed query text only — no
  // nested quantifiers, no ReDoS risk.
  const phraseNormalized = trimmed
    .replace(/\btype\s+([1-3])\b/gi, 'type:$1')
    .replace(/\bkey\s+([a-g](?:#|b)?m?)\b/gi, 'key:$1')

  // Collapse "prefix: value" (space after colon) into "prefix:value" so it
  // tokenizes as a single token.
  const spaceCollapsed = phraseNormalized.replace(/\b(type|key|tag|theme|team):\s+/gi, '$1:')

  const tokens = spaceCollapsed
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  if (tokens.length === 0) return true

  return tokens.every((tok) => matchesToken(song, tok))
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
