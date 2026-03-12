import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/firestore Timestamp
vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (d: Date) => ({
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    }),
  },
}))

// Mock fetchSongArrangements from planningCenterApi
vi.mock('@/utils/planningCenterApi', () => ({
  fetchSongArrangements: vi.fn(),
}))

import { mapPcSongToUpsert, fetchAllPcSongs, fetchAndMapPcSongs } from '@/utils/pcSongImport'
import { fetchSongArrangements } from '@/utils/planningCenterApi'

// Helper to build a minimal PC song object
function makePcSong(overrides: {
  id?: string
  title?: string
  ccli_number?: string | null
  author?: string
  last_scheduled_at?: string | null
  themes?: string
  tagIds?: string[]
} = {}) {
  return {
    id: overrides.id ?? 'pc-song-1',
    attributes: {
      title: overrides.title ?? 'Amazing Grace',
      // Use explicit 'ccli_number' in overrides, fallback only when undefined (not when null)
      ccli_number: 'ccli_number' in overrides ? overrides.ccli_number ?? null : '12345',
      author: overrides.author ?? 'John Newton',
      last_scheduled_at: overrides.last_scheduled_at ?? null,
      themes: overrides.themes ?? '',
    },
    relationships: {
      tags: {
        data: (overrides.tagIds ?? []).map((id) => ({ type: 'Tag' as const, id })),
      },
    },
  }
}

// Helper to build tag objects
function makeTag(id: string, name: string) {
  return { id, name }
}

// Helper to build arrangement objects
function makeArrangement(id: string, name: string, key: string = '') {
  return { id, name, key }
}

describe('mapPcSongToUpsert', () => {
  describe('vwTypes mapping from category tags', () => {
    it('maps "Category 1" tag to vwTypes: [1]', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat1'] })
      const tags = [makeTag('tag-cat1', 'Category 1')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([1])
    })

    it('maps "Category 2" tag to vwTypes: [2]', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat2'] })
      const tags = [makeTag('tag-cat2', 'Category 2')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([2])
    })

    it('maps "Category 3" tag to vwTypes: [3]', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat3'] })
      const tags = [makeTag('tag-cat3', 'Category 3')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([3])
    })

    it('sets vwTypes to [] when no category tag exists', () => {
      const pcSong = makePcSong({ tagIds: ['tag-ballad'] })
      const tags = [makeTag('tag-ballad', 'Ballad')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([])
    })

    it('maps "category 1" (lowercase) to vwTypes: [1] (case-insensitive)', () => {
      const pcSong = makePcSong({ tagIds: ['tag-lower-cat1'] })
      const tags = [makeTag('tag-lower-cat1', 'category 1')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([1])
    })

    it('maps Category 1 AND Category 2 tags to vwTypes: [1, 2]', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat1', 'tag-cat2'] })
      const tags = [makeTag('tag-cat1', 'Category 1'), makeTag('tag-cat2', 'Category 2')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([1, 2])
    })

    it('maps Category 1 AND Category 3 tags to vwTypes: [1, 3]', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat1', 'tag-cat3'] })
      const tags = [makeTag('tag-cat1', 'Category 1'), makeTag('tag-cat3', 'Category 3')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([1, 3])
    })

    it('maps all three category tags to vwTypes: [1, 2, 3]', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat1', 'tag-cat2', 'tag-cat3'] })
      const tags = [
        makeTag('tag-cat1', 'Category 1'),
        makeTag('tag-cat2', 'Category 2'),
        makeTag('tag-cat3', 'Category 3'),
      ]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.vwTypes).toEqual([1, 2, 3])
    })
  })

  describe('Orchestra arrangement → teamTags', () => {
    it('adds "Orchestra" to teamTags when an arrangement named "Orchestra" exists', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [makeArrangement('arr-1', 'Orchestra')])
      expect(result.teamTags).toContain('Orchestra')
    })

    it('adds "Orchestra" to teamTags when arrangement named "orchestra" (lowercase) exists', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [makeArrangement('arr-1', 'orchestra')])
      expect(result.teamTags).toContain('Orchestra')
    })

    it('does NOT add "Orchestra" when no arrangement has that name', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [makeArrangement('arr-1', 'Standard')])
      expect(result.teamTags).not.toContain('Orchestra')
    })

    it('does NOT add "Orchestra" when arrangements array is empty', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.teamTags).not.toContain('Orchestra')
    })
  })

  describe('lastUsedAt mapping', () => {
    it('maps last_scheduled_at ISO string to Firestore Timestamp', () => {
      const pcSong = makePcSong({ last_scheduled_at: '2026-01-15T00:00:00Z' })
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.lastUsedAt).not.toBeNull()
      // Check it has the Timestamp shape (seconds, nanoseconds)
      const ts = result.lastUsedAt as { seconds: number; nanoseconds: number }
      expect(typeof ts.seconds).toBe('number')
      expect(ts.nanoseconds).toBe(0)
      // Verify the timestamp corresponds to 2026-01-15
      expect(ts.seconds).toBe(Math.floor(new Date('2026-01-15T00:00:00Z').getTime() / 1000))
    })

    it('sets lastUsedAt to null when last_scheduled_at is null', () => {
      const pcSong = makePcSong({ last_scheduled_at: null })
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.lastUsedAt).toBeNull()
    })
  })

  describe('core field mapping', () => {
    it('sets pcSongId from PC song id attribute', () => {
      const pcSong = makePcSong({ id: 'pc-99' })
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.pcSongId).toBe('pc-99')
    })

    it('sets hidden to false', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.hidden).toBe(false)
    })

    it('sets notes to empty string', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.notes).toBe('')
    })

    it('maps ccliNumber from ccli_number attribute', () => {
      const pcSong = makePcSong({ ccli_number: '67890' })
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.ccliNumber).toBe('67890')
    })

    it('sets ccliNumber to empty string when ccli_number is null', () => {
      const pcSong = makePcSong({ ccli_number: null })
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.ccliNumber).toBe('')
    })
  })

  describe('non-category tags go into teamTags', () => {
    it('puts non-category PC tags into teamTags', () => {
      const pcSong = makePcSong({ tagIds: ['tag-ballad'] })
      const tags = [makeTag('tag-ballad', 'Ballad')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.teamTags).toContain('Ballad')
    })

    it('does NOT put category tags into teamTags', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat1'] })
      const tags = [makeTag('tag-cat1', 'Category 1')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.teamTags).not.toContain('Category 1')
    })

    it('combines non-category tags with Orchestra when both present', () => {
      const pcSong = makePcSong({ tagIds: ['tag-ballad'] })
      const tags = [makeTag('tag-ballad', 'Ballad')]
      const arrangements = [makeArrangement('arr-1', 'Orchestra')]
      const result = mapPcSongToUpsert(pcSong, tags, arrangements)
      expect(result.teamTags).toContain('Ballad')
      expect(result.teamTags).toContain('Orchestra')
    })
  })

  describe('arrangements mapping', () => {
    it('maps input arrangements to Arrangement shape with defaults', () => {
      const pcSong = makePcSong()
      const arrangements = [makeArrangement('arr-1', 'Standard')]
      const result = mapPcSongToUpsert(pcSong, [], arrangements)
      expect(result.arrangements).toHaveLength(1)
      const arr = result.arrangements[0]
      expect(arr?.id).toBe('arr-1')
      expect(arr?.name).toBe('Standard')
      expect(arr?.key).toBe('')
      expect(arr?.bpm).toBeNull()
      expect(arr?.lengthSeconds).toBeNull()
      expect(arr?.chordChartUrl).toBe('')
      expect(arr?.notes).toBe('')
      expect(arr?.teamTags).toEqual([])
    })
  })
})

describe('fetchAllPcSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows links.next to fetch all pages', async () => {
    const page1Response = {
      data: [
        {
          id: 'song-1',
          attributes: { title: 'Song 1', ccli_number: '11111', author: 'Author 1', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [{ type: 'Tag', id: 'tag-1' }] } },
        },
      ],
      included: [
        { type: 'Tag', id: 'tag-1', attributes: { name: 'Ballad' } },
      ],
      links: {
        self: '/api/planningcenter/services/v2/songs?per_page=100&offset=0',
        next: '/api/planningcenter/services/v2/songs?per_page=100&offset=100',
      },
      meta: { total_count: 2 },
    }

    const page2Response = {
      data: [
        {
          id: 'song-2',
          attributes: { title: 'Song 2', ccli_number: '22222', author: 'Author 2', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [] } },
        },
      ],
      included: [],
      links: {
        self: '/api/planningcenter/services/v2/songs?per_page=100&offset=100',
      },
      meta: { total_count: 2 },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1Response) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2Response) })

    global.fetch = mockFetch

    const result = await fetchAllPcSongs('app-id', 'secret')

    // fetch called twice (2 pages)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // returns both songs
    expect(result).toHaveLength(2)
  })

  it('returns all songs from all pages combined', async () => {
    const page1Response = {
      data: [
        {
          id: 'song-1',
          attributes: { title: 'Song 1', ccli_number: '11111', author: 'Author 1', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [{ type: 'Tag', id: 'tag-ballad' }] } },
        },
      ],
      included: [
        { type: 'Tag', id: 'tag-ballad', attributes: { name: 'Ballad' } },
      ],
      links: {
        self: '/api/planningcenter/services/v2/songs',
        next: '/api/planningcenter/services/v2/songs?page=2',
      },
      meta: { total_count: 2 },
    }

    const page2Response = {
      data: [
        {
          id: 'song-2',
          attributes: { title: 'Song 2', ccli_number: '22222', author: 'Author 2', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [] } },
        },
      ],
      included: [],
      links: {
        self: '/api/planningcenter/services/v2/songs?page=2',
      },
      meta: { total_count: 2 },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1Response) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2Response) })

    global.fetch = mockFetch

    const result = await fetchAllPcSongs('app-id', 'secret')

    expect(result).toHaveLength(2)
    expect(result[0]?.song.id).toBe('song-1')
    expect(result[1]?.song.id).toBe('song-2')
    // First song should have its tag resolved
    expect(result[0]?.tags).toEqual([{ id: 'tag-ballad', name: 'Ballad' }])
    // Second song has no tags
    expect(result[1]?.tags).toEqual([])
  })
})

describe('fetchAndMapPcSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a flat UpsertSongInput[] with correct field values', async () => {
    const singlePageResponse = {
      data: [
        {
          id: 'pc-song-abc',
          attributes: {
            title: 'How Great Thou Art',
            ccli_number: '78890',
            author: 'Stuart K. Hine',
            last_scheduled_at: '2026-02-01T00:00:00Z',
            themes: '',
          },
          relationships: {
            tags: { data: [{ type: 'Tag', id: 'tag-cat2' }] },
          },
        },
      ],
      included: [
        { type: 'Tag', id: 'tag-cat2', attributes: { name: 'Category 2' } },
      ],
      links: {
        self: '/api/planningcenter/services/v2/songs',
      },
      meta: { total_count: 1 },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(singlePageResponse) })

    global.fetch = mockFetch

    vi.mocked(fetchSongArrangements).mockResolvedValueOnce([
      { id: 'arr-orchestra', name: 'Orchestra' },
    ])

    const result = await fetchAndMapPcSongs('app-id', 'secret')

    expect(result).toHaveLength(1)
    const song = result[0]!
    expect(song.pcSongId).toBe('pc-song-abc')
    expect(song.title).toBe('How Great Thou Art')
    expect(song.ccliNumber).toBe('78890')
    expect(song.vwTypes).toEqual([2])
    expect(song.teamTags).toContain('Orchestra')
    expect(song.lastUsedAt).not.toBeNull()
    expect(song.hidden).toBe(false)
  })

  it('calls fetchSongArrangements for each song to resolve Orchestra tag', async () => {
    const singlePageResponse = {
      data: [
        {
          id: 'pc-song-1',
          attributes: { title: 'Song 1', ccli_number: '11111', author: '', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [] } },
        },
        {
          id: 'pc-song-2',
          attributes: { title: 'Song 2', ccli_number: '22222', author: '', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [] } },
        },
      ],
      included: [],
      links: {
        self: '/api/planningcenter/services/v2/songs',
      },
      meta: { total_count: 2 },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(singlePageResponse) })

    global.fetch = mockFetch

    vi.mocked(fetchSongArrangements)
      .mockResolvedValueOnce([{ id: 'arr-1', name: 'Standard' }])
      .mockResolvedValueOnce([{ id: 'arr-2', name: 'Orchestra' }])

    const result = await fetchAndMapPcSongs('app-id', 'secret')

    // fetchSongArrangements should be called once per song
    expect(fetchSongArrangements).toHaveBeenCalledTimes(2)
    expect(fetchSongArrangements).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-1')
    expect(fetchSongArrangements).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-2')

    // Song 2 has Orchestra arrangement
    expect(result[1]?.teamTags).toContain('Orchestra')
    // Song 1 does not
    expect(result[0]?.teamTags).not.toContain('Orchestra')
  })
})
