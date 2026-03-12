import { Timestamp } from 'firebase/firestore'
import { fetchSongArrangements } from '@/utils/planningCenterApi'
import type { UpsertSongInput } from '@/types/song'

/**
 * Base URL for Planning Center API — same as PC_BASE_URL in planningCenterApi.ts.
 * Duplicated here to avoid importing from planningCenterApi just for the constant,
 * which would require the full module in mocks.
 */
const PC_SONGS_BASE_URL = '/api/planningcenter/services/v2'

/**
 * Raw PC song data shape returned from the Planning Center Songs API.
 */
interface PcSongData {
  id: string
  attributes: {
    title: string
    ccli_number: string | null
    author: string
    last_scheduled_at: string | null
    themes: string
  }
  relationships: {
    tags: {
      data: Array<{ type: 'Tag'; id: string }>
    }
  }
}

/**
 * Pattern to detect category tags. Matches "category 1", "category 2", "category 3"
 * case-insensitively with optional whitespace between "category" and the number.
 */
const CATEGORY_1_RE = /^category\s*1$/i
const CATEGORY_2_RE = /^category\s*2$/i
const CATEGORY_3_RE = /^category\s*3$/i

function isCategoryTag(name: string): boolean {
  return CATEGORY_1_RE.test(name) || CATEGORY_2_RE.test(name) || CATEGORY_3_RE.test(name)
}

/**
 * Map a Planning Center song + resolved tags + arrangements to a UpsertSongInput.
 * This is a pure function with no side effects.
 *
 * @param pcSong - The PC song data object
 * @param tags - Resolved tag objects for this song (id + name)
 * @param arrangements - Resolved arrangement objects (id + name)
 * @returns UpsertSongInput ready for store.upsertSongs
 */
export function mapPcSongToUpsert(
  pcSong: PcSongData,
  tags: Array<{ id: string; name: string }>,
  arrangements: Array<{ id: string; name: string; key: string }>,
): UpsertSongInput {
  const { attributes } = pcSong

  // Determine vwType from category tags
  let vwType: 1 | 2 | 3 | null = null
  for (const tag of tags) {
    if (CATEGORY_1_RE.test(tag.name)) {
      vwType = 1
      break
    } else if (CATEGORY_2_RE.test(tag.name)) {
      vwType = 2
      break
    } else if (CATEGORY_3_RE.test(tag.name)) {
      vwType = 3
      break
    }
  }

  // teamTags = non-category tag names + "Orchestra" if any arrangement matches
  const teamTags: string[] = tags
    .filter((tag) => !isCategoryTag(tag.name))
    .map((tag) => tag.name)

  const hasOrchestra = arrangements.some((arr) => /orchestra/i.test(arr.name))
  if (hasOrchestra) {
    teamTags.push('Orchestra')
  }

  // Map last_scheduled_at to Firestore Timestamp
  const lastUsedAt =
    attributes.last_scheduled_at != null
      ? Timestamp.fromDate(new Date(attributes.last_scheduled_at))
      : null

  // Parse themes: comma-separated string → trimmed array (filter empty)
  const themes = attributes.themes
    ? attributes.themes
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  // Map arrangements to the Arrangement shape with defaults
  const mappedArrangements = arrangements.map((arr) => ({
    id: arr.id,
    name: arr.name,
    key: arr.key,
    bpm: null,
    lengthSeconds: null,
    chordChartUrl: '',
    notes: '',
    teamTags: [],
  }))

  return {
    title: attributes.title,
    ccliNumber: attributes.ccli_number ?? '',
    author: attributes.author ?? '',
    themes,
    notes: '',
    vwType,
    teamTags,
    arrangements: mappedArrangements,
    lastUsedAt,
    pcSongId: pcSong.id,
    hidden: false,
  }
}

/**
 * Fetch all songs from Planning Center, following pagination via links.next.
 * Songs are fetched with ?include=tags to sideload tag data in a single request.
 *
 * @param appId - PC API Application ID
 * @param secret - PC API Secret
 * @returns Array of { song: PcSongData, tags: { id, name }[] } — one entry per song
 */
export async function fetchAllPcSongs(
  appId: string,
  secret: string,
): Promise<Array<{ song: PcSongData; tags: Array<{ id: string; name: string }> }>> {
  const authHeader = 'Basic ' + btoa(appId + ':' + secret)

  let url: string | undefined = `${PC_SONGS_BASE_URL}/songs?include=tags&per_page=100`
  const allSongs: PcSongData[] = []
  // Accumulate tag map across all pages (tags may only appear once even if referenced by many songs)
  const tagMap = new Map<string, string>() // id → name

  while (url) {
    let response: Response
    // Retry on 429 respecting Retry-After
    for (let attempt = 0; ; attempt++) {
      response = await fetch(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      })
      if (response.status !== 429 || attempt >= 3) break
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 60_000
      await new Promise((r) => setTimeout(r, waitMs))
    }

    if (!response!.ok) {
      throw new Error(`Failed to fetch PC songs: ${response!.status}`)
    }

    const json = (await response.json()) as {
      data: PcSongData[]
      included: Array<{ type: string; id: string; attributes: { name: string } }>
      links: { next?: string; self: string }
      meta: { total_count: number }
    }

    // Collect songs
    allSongs.push(...json.data)

    // Collect tags from this page's included sideloads
    for (const included of json.included ?? []) {
      if (included.type === 'Tag') {
        tagMap.set(included.id, included.attributes.name)
      }
    }

    // Follow pagination — rewrite absolute PC URL to local proxy path
    if (json.links.next) {
      url = json.links.next.replace(
        'https://api.planningcenteronline.com/services/v2',
        PC_SONGS_BASE_URL,
      )
    } else {
      url = undefined
    }
  }

  // Resolve tags per song using the accumulated tagMap
  return allSongs.map((song) => {
    const tags = song.relationships?.tags?.data ?? []
      .map((ref) => {
        const name = tagMap.get(ref.id)
        return name ? { id: ref.id, name } : null
      })
      .filter((t): t is { id: string; name: string } => t !== null)

    return { song, tags }
  })
}

/**
 * Fetch all PC songs and map them to UpsertSongInput[] without writing to Firestore.
 * This is the function called by PcImportModal to get preview data before user confirms.
 *
 * Fetches arrangements per song (in batches of 10) to detect Orchestra tag.
 *
 * @param appId - PC API Application ID
 * @param secret - PC API Secret
 * @returns UpsertSongInput[] ready for display or import
 */
export async function fetchAndMapPcSongs(
  appId: string,
  secret: string,
): Promise<UpsertSongInput[]> {
  const allSongData = await fetchAllPcSongs(appId, secret)

  // Fetch arrangements in batches of 3 to stay under PC rate limits
  const BATCH_SIZE = 3
  const results: UpsertSongInput[] = []

  for (let i = 0; i < allSongData.length; i += BATCH_SIZE) {
    const batch = allSongData.slice(i, i + BATCH_SIZE)
    const mappedBatch = await Promise.all(
      batch.map(async ({ song, tags }) => {
        const arrangements = await fetchSongArrangements(appId, secret, song.id)
        return mapPcSongToUpsert(song, tags, arrangements)
      }),
    )
    results.push(...mappedBatch)
  }

  return results
}

/**
 * Import all songs from Planning Center into the WorshipPlanner store.
 * Orchestrates: fetch → map → upsert, reporting progress along the way.
 *
 * @param appId - PC API Application ID
 * @param secret - PC API Secret
 * @param store - Song store with songs array and upsertSongs method
 * @param onProgress - Optional progress callback (current, total)
 * @returns Summary of { added, updated, errors }
 */
export async function importFromPc(
  appId: string,
  secret: string,
  store: {
    songs: Array<{ id: string; pcSongId: string | null; ccliNumber: string; title: string }>
    upsertSongs: (songs: UpsertSongInput[]) => Promise<void>
  },
  onProgress?: (current: number, total: number) => void,
): Promise<{ added: number; updated: number; errors: string[] }> {
  // Step 1: Fetch and map all songs
  onProgress?.(0, 2)
  const allMapped = await fetchAndMapPcSongs(appId, secret)
  onProgress?.(1, 2)

  // Count which songs will be added vs updated by comparing against existing store songs
  const existingPcSongIds = new Set(store.songs.map((s) => s.pcSongId).filter(Boolean))
  const existingCcliNumbers = new Set(store.songs.map((s) => s.ccliNumber).filter(Boolean))
  const existingTitles = new Set(store.songs.map((s) => s.title.toLowerCase()))

  let added = 0
  let updated = 0
  for (const song of allMapped) {
    const isExisting =
      (song.pcSongId != null && existingPcSongIds.has(song.pcSongId)) ||
      (song.ccliNumber !== '' && existingCcliNumbers.has(song.ccliNumber)) ||
      existingTitles.has(song.title.toLowerCase())

    if (isExisting) {
      updated++
    } else {
      added++
    }
  }

  // Step 2: Upsert all songs into the store
  await store.upsertSongs(allMapped)
  onProgress?.(2, 2)

  return { added, updated, errors: [] }
}
