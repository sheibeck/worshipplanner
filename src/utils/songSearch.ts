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

// Recognized field-scoped prefix keywords, used both to detect a prefix
// token and as a boundary when greedily capturing a multi-word field value.
const FIELD_KEYWORDS = 'type|key|tag|theme|team'

// Captures "prefix:value", where value greedily consumes all words up to the
// next recognized "prefix:" keyword or end of string — so multi-word values
// (e.g. `tag:christmas eve`) are captured as a single field-scoped span
// instead of being split into a field token plus a stray bare term.
// Bounded, anchored regex on short user-typed query text only — no nested
// quantifiers, no ReDoS risk.
const FIELD_SPAN_RE = new RegExp(
  `\\b(${FIELD_KEYWORDS}):\\s*([\\s\\S]*?)(?=\\s+\\b(?:${FIELD_KEYWORDS}):|$)`,
  'gi',
)

/**
 * Multi-term AND search over a song's metadata. Supports field-scoped
 * prefixes (`type:`, `key:`, `tag:`, `theme:`, `team:`, with optional space
 * after the colon) whose value may contain multiple words (e.g.
 * `tag:christmas eve`), natural two-word phrases (`Type 1`, `Key A`), and the
 * original bare full-field substring match for any remaining text. Every
 * extracted term (field-scoped span or bare word) must match (AND).
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

  // Extract all field-scoped spans first (each may contain multiple words),
  // then treat whatever text remains (with those spans removed) as bare
  // whitespace-separated terms.
  const fieldTerms: string[] = []
  let remainder = phraseNormalized
  FIELD_SPAN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FIELD_SPAN_RE.exec(phraseNormalized)) !== null) {
    const field = match[1]!.toLowerCase()
    const value = (match[2] ?? '').trim()
    fieldTerms.push(`${field}:${value}`)
    remainder = remainder.replace(match[0], ' ')
  }

  const bareTerms = remainder
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)

  const terms = [...fieldTerms, ...bareTerms]

  if (terms.length === 0) return true

  return terms.every((tok) => matchesToken(song, tok))
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
