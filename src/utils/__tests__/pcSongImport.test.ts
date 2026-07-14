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

// Mock fetchSongArrangements + fetchLastScheduledItem from planningCenterApi
vi.mock('@/utils/planningCenterApi', () => ({
  fetchSongArrangements: vi.fn(),
  fetchLastScheduledItem: vi.fn(),
}))

import {
  mapPcSongToUpsert,
  fetchAllPcSongs,
  fetchAndMapPcSongs,
  partitionPcSongs,
} from '@/utils/pcSongImport'
import { fetchSongArrangements, fetchLastScheduledItem } from '@/utils/planningCenterApi'
import type { UpsertSongInput } from '@/types/song'

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

  describe('Orchestra arrangement → tags (D-01: team-style tags write into tags, not teamTags)', () => {
    it('adds "Orchestra" to tags when an arrangement named "Orchestra" exists', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [makeArrangement('arr-1', 'Orchestra')])
      expect(result.tags).toContain('Orchestra')
    })

    it('adds "Orchestra" to tags when arrangement named "orchestra" (lowercase) exists', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [makeArrangement('arr-1', 'orchestra')])
      expect(result.tags).toContain('Orchestra')
    })

    it('does NOT add "Orchestra" when no arrangement has that name', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [makeArrangement('arr-1', 'Standard')])
      expect(result.tags).not.toContain('Orchestra')
    })

    it('does NOT add "Orchestra" when arrangements array is empty', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.tags).not.toContain('Orchestra')
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

    it('sets removedThemes to [] (D-14) — Song.teamTags no longer exists (D-01)', () => {
      const pcSong = makePcSong({ tagIds: ['tag-ballad'] })
      const tags = [makeTag('tag-ballad', 'Ballad')]
      const result = mapPcSongToUpsert(pcSong, tags, [makeArrangement('arr-1', 'Orchestra')])
      expect(result.removedThemes).toEqual([])
    })
  })

  describe('non-category tags go into tags (D-01)', () => {
    it('puts non-category PC tags into tags', () => {
      const pcSong = makePcSong({ tagIds: ['tag-ballad'] })
      const tags = [makeTag('tag-ballad', 'Ballad')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.tags).toContain('Ballad')
    })

    it('does NOT put category tags into tags', () => {
      const pcSong = makePcSong({ tagIds: ['tag-cat1'] })
      const tags = [makeTag('tag-cat1', 'Category 1')]
      const result = mapPcSongToUpsert(pcSong, tags, [])
      expect(result.tags).not.toContain('Category 1')
      // Category tags still map to vwTypes, not tags
      expect(result.vwTypes).toEqual([1])
    })

    it('combines non-category tags with Orchestra when both present', () => {
      const pcSong = makePcSong({ tagIds: ['tag-ballad'] })
      const tags = [makeTag('tag-ballad', 'Ballad')]
      const arrangements = [makeArrangement('arr-1', 'Orchestra')]
      const result = mapPcSongToUpsert(pcSong, tags, arrangements)
      expect(result.tags).toContain('Ballad')
      expect(result.tags).toContain('Orchestra')
    })
  })

  describe('primaryArrangementId', () => {
    it('defaults to the first arrangement when no last-scheduled id is given', () => {
      const pcSong = makePcSong()
      const arrangements = [makeArrangement('arr-1', 'Standard'), makeArrangement('arr-2', 'Orchestra')]
      const result = mapPcSongToUpsert(pcSong, [], arrangements)
      expect(result.primaryArrangementId).toBe('arr-1')
    })

    it('uses the last-scheduled arrangement id when it exists among arrangements', () => {
      const pcSong = makePcSong()
      const arrangements = [makeArrangement('arr-1', 'Standard'), makeArrangement('arr-2', 'Orchestra')]
      const result = mapPcSongToUpsert(pcSong, [], arrangements, 'arr-2')
      expect(result.primaryArrangementId).toBe('arr-2')
    })

    it('falls back to first arrangement when last-scheduled id is not among arrangements', () => {
      const pcSong = makePcSong()
      const arrangements = [makeArrangement('arr-1', 'Standard')]
      const result = mapPcSongToUpsert(pcSong, [], arrangements, 'arr-unknown')
      expect(result.primaryArrangementId).toBe('arr-1')
    })

    it('is null when there are no arrangements', () => {
      const pcSong = makePcSong()
      const result = mapPcSongToUpsert(pcSong, [], [])
      expect(result.primaryArrangementId).toBeNull()
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
      { id: 'arr-orchestra', name: 'Orchestra', key: '' },
    ])

    const result = await fetchAndMapPcSongs('app-id', 'secret')

    expect(result).toHaveLength(1)
    const song = result[0]!
    expect(song.pcSongId).toBe('pc-song-abc')
    expect(song.title).toBe('How Great Thou Art')
    expect(song.ccliNumber).toBe('78890')
    expect(song.vwTypes).toEqual([2])
    expect(song.tags).toContain('Orchestra')
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
      .mockResolvedValueOnce([{ id: 'arr-1', name: 'Standard', key: '' }])
      .mockResolvedValueOnce([{ id: 'arr-2', name: 'Orchestra', key: '' }])

    const result = await fetchAndMapPcSongs('app-id', 'secret')

    // fetchSongArrangements should be called once per song
    expect(fetchSongArrangements).toHaveBeenCalledTimes(2)
    expect(fetchSongArrangements).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-1')
    expect(fetchSongArrangements).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-2')

    // Song 2 has Orchestra arrangement
    expect(result[1]?.tags).toContain('Orchestra')
    // Song 1 does not
    expect(result[0]?.tags).not.toContain('Orchestra')
  })

  it('resolves the last-scheduled arrangement as the primary key when multiple arrangements exist', async () => {
    const singlePageResponse = {
      data: [
        {
          id: 'pc-song-multi',
          attributes: { title: 'Multi Key Song', ccli_number: '33333', author: '', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [] } },
        },
      ],
      included: [],
      links: { self: '/api/planningcenter/services/v2/songs' },
      meta: { total_count: 1 },
    }

    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(singlePageResponse) })

    vi.mocked(fetchSongArrangements).mockResolvedValueOnce([
      { id: 'arr-g', name: 'Key of G', key: 'G' },
      { id: 'arr-a', name: 'Key of A', key: 'A' },
    ])
    vi.mocked(fetchLastScheduledItem).mockResolvedValueOnce({ notes: [], arrangementId: 'arr-a' })

    const result = await fetchAndMapPcSongs('app-id', 'secret')

    expect(fetchLastScheduledItem).toHaveBeenCalledWith('app-id', 'secret', 'pc-song-multi')
    expect(result[0]?.primaryArrangementId).toBe('arr-a')
  })

  it('does NOT call fetchLastScheduledItem for single-arrangement songs', async () => {
    const singlePageResponse = {
      data: [
        {
          id: 'pc-song-single',
          attributes: { title: 'Single', ccli_number: '44444', author: '', last_scheduled_at: null, themes: '' },
          relationships: { tags: { data: [] } },
        },
      ],
      included: [],
      links: { self: '/api/planningcenter/services/v2/songs' },
      meta: { total_count: 1 },
    }

    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(singlePageResponse) })

    vi.mocked(fetchSongArrangements).mockResolvedValueOnce([{ id: 'arr-only', name: 'Standard', key: 'C' }])

    const result = await fetchAndMapPcSongs('app-id', 'secret')

    expect(fetchLastScheduledItem).not.toHaveBeenCalled()
    expect(result[0]?.primaryArrangementId).toBe('arr-only')
  })
})

// Helper to build a minimal UpsertSongInput fixture for partitionPcSongs tests
function makeMappedSong(overrides: {
  pcSongId?: string | null
  ccliNumber?: string
  title?: string
} = {}): UpsertSongInput {
  return {
    title: overrides.title ?? 'Some Song',
    ccliNumber: overrides.ccliNumber ?? '',
    author: '',
    themes: [],
    notes: '',
    vwTypes: [],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    pcSongId: overrides.pcSongId ?? null,
    hidden: false,
    tags: [],
    removedThemes: [],
  }
}

// Helper to build a minimal existing-song fixture (the shape partitionPcSongs expects)
function makeExisting(overrides: {
  pcSongId?: string | null
  ccliNumber?: string
  title?: string
} = {}): { pcSongId: string | null; ccliNumber: string; title: string } {
  return {
    pcSongId: overrides.pcSongId ?? null,
    ccliNumber: overrides.ccliNumber ?? '',
    title: overrides.title ?? 'Some Song',
  }
}

describe('partitionPcSongs', () => {
  it('classifies a song as existing when pcSongId matches exactly', () => {
    const mapped = [makeMappedSong({ pcSongId: 'pc-1', title: 'A' })]
    const existing = [makeExisting({ pcSongId: 'pc-1', title: 'Different Title' })]
    const result = partitionPcSongs(mapped, existing)
    expect(result.newSongs).toHaveLength(0)
    expect(result.existingSongs).toHaveLength(1)
    expect(result.existingSongs[0]?.pcSongId).toBe('pc-1')
  })

  it('classifies a song as existing when ccliNumber matches exactly', () => {
    const mapped = [makeMappedSong({ ccliNumber: '12345', title: 'A' })]
    const existing = [makeExisting({ ccliNumber: '12345', title: 'Different Title' })]
    const result = partitionPcSongs(mapped, existing)
    expect(result.newSongs).toHaveLength(0)
    expect(result.existingSongs).toHaveLength(1)
  })

  it('classifies a song as existing when title matches case-insensitively', () => {
    const mapped = [makeMappedSong({ title: 'Amazing Grace' })]
    const existing = [makeExisting({ title: 'amazing grace' })]
    const result = partitionPcSongs(mapped, existing)
    expect(result.newSongs).toHaveLength(0)
    expect(result.existingSongs).toHaveLength(1)
  })

  it('classifies a song as new when no key matches', () => {
    const mapped = [makeMappedSong({ pcSongId: 'pc-2', ccliNumber: '99999', title: 'Brand New Song' })]
    const existing = [makeExisting({ pcSongId: 'pc-1', ccliNumber: '11111', title: 'Old Song' })]
    const result = partitionPcSongs(mapped, existing)
    expect(result.newSongs).toHaveLength(1)
    expect(result.existingSongs).toHaveLength(0)
  })

  it('does NOT match on empty-string ccliNumber alone', () => {
    const mapped = [makeMappedSong({ ccliNumber: '', title: 'Unique Title Here' })]
    const existing = [makeExisting({ ccliNumber: '', title: 'Other Title' })]
    const result = partitionPcSongs(mapped, existing)
    expect(result.newSongs).toHaveLength(1)
    expect(result.existingSongs).toHaveLength(0)
  })

  it('treats all mapped songs as new when existing list is empty', () => {
    const mapped = [makeMappedSong({ title: 'Song A' }), makeMappedSong({ title: 'Song B' })]
    const result = partitionPcSongs(mapped, [])
    expect(result.newSongs).toHaveLength(2)
    expect(result.existingSongs).toHaveLength(0)
  })

  it('returns empty arrays when mapped list is empty', () => {
    const existing = [makeExisting({ title: 'Song A' })]
    const result = partitionPcSongs([], existing)
    expect(result.newSongs).toHaveLength(0)
    expect(result.existingSongs).toHaveLength(0)
  })

  it('preserves original input order across both output arrays', () => {
    const mapped = [
      makeMappedSong({ pcSongId: 'pc-new-1', title: 'New One' }),
      makeMappedSong({ pcSongId: 'pc-existing', title: 'Existing One' }),
      makeMappedSong({ pcSongId: 'pc-new-2', title: 'New Two' }),
    ]
    const existing = [makeExisting({ pcSongId: 'pc-existing', title: 'Existing One' })]
    const result = partitionPcSongs(mapped, existing)
    expect(result.newSongs.map((s) => s.title)).toEqual(['New One', 'New Two'])
    expect(result.existingSongs.map((s) => s.title)).toEqual(['Existing One'])
  })
})
