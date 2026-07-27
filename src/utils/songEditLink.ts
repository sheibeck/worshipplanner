/**
 * songEditLink.ts
 *
 * WHY a query convention instead of a per-song route:
 * This application has no per-song address today — `/songs` is a flat list route
 * with no id segment, and the song editor (`SongSlideOver.vue`) is opened purely
 * from local click state inside `SongsView.vue`. Adding a real per-song route
 * would be a larger change than this phase's scope allows. This module instead
 * extends the query-param convention `SongsView.vue` already uses for its
 * existing `?import=true` auto-open-import parameter (read on mount, act, then
 * clear via a non-navigating `router.replace`) — see 26-RESEARCH.md Pitfall 4.
 *
 * This module is pure: it imports nothing from Vue, the router, or any store, so
 * the sender (a future drawer) and the receiver (`SongsView.vue`) can never drift
 * apart on the shape of the link they share.
 */

/** The only tabs `SongSlideOver.vue` actually has. */
export type SongEditTab = 'details' | 'lyrics'

const VALID_TABS: readonly SongEditTab[] = ['details', 'lyrics']

const SONG_QUERY_KEY = 'edit'
const TAB_QUERY_KEY = 'tab'

/** A plain router-location shape — deliberately not `RouteLocationRaw` so this file imports nothing from vue-router. */
export interface SongEditRouteLocation {
  name: string
  query: Record<string, string>
}

/** A single query value as a router query object actually delivers it: a string, a repeated array, or absent. */
type RawQueryValue = string | (string | null)[] | null | undefined

/** The subset of a route's `query` this module reads. Matches vue-router's `LocationQuery` shape structurally without importing it. */
export type SongEditQuery = Record<string, RawQueryValue>

export interface SongEditRequest {
  songId: string
  tab?: SongEditTab
}

/**
 * Builds a router location targeting the song list route, carrying the requested
 * song id and tab as query values. Use this location with `router.push`.
 */
export function buildSongEditLink(songId: string, tab: SongEditTab): SongEditRouteLocation {
  return {
    name: 'songs',
    query: {
      [SONG_QUERY_KEY]: songId,
      [TAB_QUERY_KEY]: tab,
    },
  }
}

function firstValue(value: RawQueryValue): string | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? (value[0] ?? null) : null
  }
  return value ?? null
}

function isValidTab(value: string | null): value is SongEditTab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value)
}

/**
 * Parses an arriving route query for a song-edit request. Returns null when the
 * query carries no song request. A repeated query parameter (routers can deliver
 * one as an array) is normalised by taking its first value. An unrecognised tab
 * value is dropped rather than forwarded, so the editor falls back to its own
 * default.
 */
export function parseSongEditRequest(query: SongEditQuery): SongEditRequest | null {
  const songId = firstValue(query[SONG_QUERY_KEY])
  if (!songId) return null

  const rawTab = firstValue(query[TAB_QUERY_KEY])
  const tab = isValidTab(rawTab) ? rawTab : undefined

  return tab ? { songId, tab } : { songId }
}

/**
 * Returns the same query with the song-edit request's own keys removed and every
 * unrelated parameter preserved — mirrors how `SongsView.vue`'s existing
 * `?import=true` clearing preserves the rest of the query.
 */
export function clearSongEditRequest(query: SongEditQuery): Record<string, RawQueryValue> {
  const next: Record<string, RawQueryValue> = { ...query }
  delete next[SONG_QUERY_KEY]
  delete next[TAB_QUERY_KEY]
  return next
}
