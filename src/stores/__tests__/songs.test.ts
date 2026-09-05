import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Track onSnapshot callbacks and unsubscribe fns
let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

// Track batch operations for upsertSongs / hardDeleteSong tests
let mockBatchOps: { type: 'set' | 'update' | 'delete'; ref: unknown; data?: Record<string, unknown> }[] = []

// Configurable per-test fake lyrics docs returned by getDocs() for hardDeleteSong.
// Default: two fake lyrics docs, each with its own ref.
let mockLyricsDocs: { ref: { path: string } }[] = [
  { ref: { path: 'lyrics/lyric-1' } },
  { ref: { path: 'lyrics/lyric-2' } },
]

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  const mockBatch = {
    set: vi.fn((ref, data) => { mockBatchOps.push({ type: 'set', ref, data }) }),
    update: vi.fn((ref, data) => { mockBatchOps.push({ type: 'update', ref, data }) }),
    delete: vi.fn((ref) => { mockBatchOps.push({ type: 'delete', ref }) }),
    commit: vi.fn(() => Promise.resolve()),
  }

  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((_query, callback) => {
      snapshotCallback = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-song-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() => Promise.resolve({ docs: mockLyricsDocs })),
    writeBatch: vi.fn(() => ({ ...mockBatch })),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

// Mock @/stores/auth — songs store reads useAuthStore().user/orgId for tag-filter persistence keying
// and useAuthStore().vwModeEnabled to gate the search `type:` prefix + filterVwType dropdown (CR-01).
let mockAuthUser: { uid: string } | null = null
let mockAuthOrgId: string | null = null
let mockAuthVwModeEnabled = true
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    get user() { return mockAuthUser },
    get orgId() { return mockAuthOrgId },
    get vwModeEnabled() { return mockAuthVwModeEnabled },
  })),
}))

import type { VWType } from '@/types/song'

function makeSong(overrides: Partial<{
  id: string
  title: string
  ccliNumber: string
  author: string
  vwTypes: VWType[]
  teamTags: string[]
  tags: string[]
  arrangements: Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>
  primaryArrangementId: string | null
  themes: string[]
  notes: string
  lastUsedAt: null
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
  pcSongId: string | null
  hidden: boolean
  removedThemes: string[]
}> = {}) {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '12345',
    author: 'John Newton',
    vwTypes: [1] as VWType[],
    teamTags: ['Choir'],
    tags: [] as string[],
    removedThemes: [] as string[],
    arrangements: [
      {
        id: 'arr-1',
        name: 'Original',
        key: 'G',
        bpm: 120,
        lengthSeconds: 240,
        chordChartUrl: '',
        notes: '',
        teamTags: ['Choir'],
      },
    ],
    themes: ['grace'],
    notes: '',
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    pcSongId: null,
    hidden: false,
    ...overrides,
  }
}

function triggerSnapshot(songs: ReturnType<typeof makeSong>[]) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: songs.map((s) => ({
        id: s.id,
        data: () => {
          const { id: _id, ...rest } = s
          return rest
        },
      })),
    })
  }
}

describe('useSongStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
    mockBatchOps = []
    mockLyricsDocs = [
      { ref: { path: 'lyrics/lyric-1' } },
      { ref: { path: 'lyrics/lyric-2' } },
    ]
    mockAuthUser = null
    mockAuthOrgId = null
    mockAuthVwModeEnabled = true
    localStorage.clear()
  })

  describe('initial state', () => {
    it('starts with empty songs array', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect(store.songs).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect(store.isLoading).toBe(true)
    })

    it('filteredSongs is empty initially', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect(store.filteredSongs).toEqual([])
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot on the org songs collection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('populates songs from snapshot with { id, ...data } mapping', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      const song = makeSong()
      triggerSnapshot([song])
      expect(store.songs).toHaveLength(1)
      expect(store.songs[0]!.id).toBe('song-1')
      expect(store.songs[0]!.title).toBe('Amazing Grace')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      const song = makeSong()
      triggerSnapshot([song])
      expect(store.songs).toHaveLength(1)
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.songs).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('calling subscribe again unsubscribes previous listener first', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      store.subscribe('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })
  })

  describe('Firestore normalization — legacy vwType scalar', () => {
    it('normalizes legacy vwType scalar to vwTypes array', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      // Simulate a legacy song doc with vwType scalar instead of vwTypes array
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'legacy-song',
              data: () => ({
                title: 'Legacy Song',
                ccliNumber: '99999',
                author: 'Old Author',
                vwType: 2, // legacy scalar field
                teamTags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                hidden: false,
              }),
            },
          ],
        })
      }
      expect(store.songs[0]!.vwTypes).toEqual([2])
    })

    it('normalizes legacy vwType null to empty vwTypes array', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'legacy-null-song',
              data: () => ({
                title: 'Null Type Song',
                ccliNumber: '11111',
                author: 'Author',
                vwType: null, // legacy null
                teamTags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                hidden: false,
              }),
            },
          ],
        })
      }
      expect(store.songs[0]!.vwTypes).toEqual([])
    })

    it('preserves vwTypes array from doc if already present', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'new-song',
              data: () => ({
                title: 'New Song',
                ccliNumber: '22222',
                author: 'Author',
                vwTypes: [1, 3], // already array
                teamTags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                hidden: false,
              }),
            },
          ],
        })
      }
      expect(store.songs[0]!.vwTypes).toEqual([1, 3])
    })
  })

  describe('subscribe — teamTags fold into tags (D-01)', () => {
    it('folds teamTags into tags, de-duplicated (order-insensitive)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', teamTags: ['Orchestra'], tags: ['Christmas'] }),
      ])
      expect(new Set(store.songs[0]!.tags)).toEqual(new Set(['Christmas', 'Orchestra']))
    })

    it('does not duplicate a teamTags value that already exists in tags', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', teamTags: ['Orchestra'], tags: ['Orchestra'] }),
      ])
      expect(store.songs[0]!.tags).toEqual(['Orchestra'])
    })

    it('does not fold when teamTags is empty', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', teamTags: [], tags: ['Christmas'] }),
      ])
      expect(store.songs[0]!.tags).toEqual(['Christmas'])
    })
  })

  describe('subscribe — removedThemes default (D-14)', () => {
    it('defaults removedThemes to [] for a legacy doc missing the field', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'legacy-no-removed-themes',
              data: () => ({
                title: 'Legacy Song',
                ccliNumber: '66666',
                author: 'Old Author',
                vwTypes: [],
                teamTags: [],
                tags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                hidden: false,
                // removedThemes field intentionally omitted — legacy doc
              }),
            },
          ],
        })
      }
      expect(store.songs[0]!.removedThemes).toEqual([])
    })
  })

  describe('filteredSongs — hidden songs', () => {
    it('excludes songs where hidden is true', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
        makeSong({ id: 'song-2', title: 'Hidden Song', hidden: true }),
      ])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Visible Song')
    })

    it('includes songs where hidden is false', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
      ])
      expect(store.filteredSongs).toHaveLength(1)
    })

    it('allUserTags excludes tags carried only by hidden songs (deduped + sorted)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Visible', hidden: false, teamTags: [], tags: ['Zeal', 'Grace'] }),
        makeSong({ id: 'song-2', title: 'Also Visible', hidden: false, teamTags: [], tags: ['Grace'] }),
        makeSong({ id: 'song-3', title: 'Hidden', hidden: true, teamTags: [], tags: ['Repentance'] }),
      ])
      // 'Repentance' lives only on the hidden song, so it must not appear;
      // 'Grace' is deduped; result is sorted.
      expect(store.allUserTags).toEqual(['Grace', 'Zeal'])
    })

    it('includes songs where hidden is undefined (legacy docs)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      // Simulate a legacy song doc without hidden field
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'legacy-song',
              data: () => ({
                title: 'Legacy Song',
                ccliNumber: '99999',
                author: 'Old Author',
                vwTypes: [],
                teamTags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                // hidden field intentionally omitted to simulate legacy doc
              }),
            },
          ],
        })
      }
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Legacy Song')
    })
  })

  describe('aiCandidateSongs — soft-deleted exclusion', () => {
    it('excludes a soft-deleted (hidden: true) song from the AI candidate pool', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
        makeSong({ id: 'song-2', title: 'Soft-Deleted Song', hidden: true }),
      ])
      expect(store.aiCandidateSongs).toHaveLength(1)
      expect(store.aiCandidateSongs[0]!.id).toBe('song-1')
      expect(store.aiCandidateSongs[0]!.title).toBe('Visible Song')
    })

    it('includes songs where hidden is false', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Visible Song', hidden: false }),
      ])
      expect(store.aiCandidateSongs).toHaveLength(1)
      expect(store.aiCandidateSongs[0]!.id).toBe('song-1')
    })

    it('includes songs where hidden is undefined (legacy docs)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      // Simulate a legacy song doc without hidden field
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'legacy-song',
              data: () => ({
                title: 'Legacy Song',
                ccliNumber: '99999',
                author: 'Old Author',
                vwTypes: [],
                teamTags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                // hidden field intentionally omitted to simulate legacy doc
              }),
            },
          ],
        })
      }
      expect(store.aiCandidateSongs).toHaveLength(1)
      expect(store.aiCandidateSongs[0]!.title).toBe('Legacy Song')
    })
  })

  describe('filteredSongs — search', () => {
    it('returns all songs when searchQuery is empty', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([makeSong({ id: 'song-1', title: 'Amazing Grace' }), makeSong({ id: 'song-2', title: 'How Great Thou Art' })])
      expect(store.filteredSongs).toHaveLength(2)
    })

    it('filters by title (case insensitive)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([makeSong({ id: 'song-1', title: 'Amazing Grace' }), makeSong({ id: 'song-2', title: 'How Great Thou Art' })])
      store.searchQuery = 'amazing'
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Amazing Grace')
    })

    it('filters by CCLI number', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Amazing Grace', ccliNumber: '11111' }),
        makeSong({ id: 'song-2', title: 'How Great Thou Art', ccliNumber: '99999' }),
      ])
      store.searchQuery = '11111'
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.ccliNumber).toBe('11111')
    })

    it('returns empty when no title or CCLI matches', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([makeSong({ title: 'Amazing Grace', ccliNumber: '11111' })])
      store.searchQuery = 'zzz'
      expect(store.filteredSongs).toHaveLength(0)
    })
  })

  describe('filteredSongs — vwType filter', () => {
    it('filters by vwType 1 (song with vwTypes including 1)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Type1 Song', vwTypes: [1] }),
        makeSong({ id: 'song-2', title: 'Type2 Song', vwTypes: [2] }),
        makeSong({ id: 'song-3', title: 'Type3 Song', vwTypes: [3] }),
      ])
      store.filterVwType = 1
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.vwTypes).toContain(1)
    })

    it('shows multi-type songs when filter matches one of their types', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Type1 and 2 Song', vwTypes: [1, 2] }),
        makeSong({ id: 'song-2', title: 'Type3 only Song', vwTypes: [3] }),
      ])
      store.filterVwType = 1
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Type1 and 2 Song')
    })

    it('filters uncategorized songs when filterVwType is "uncategorized"', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Categorized', vwTypes: [1] }),
        makeSong({ id: 'song-2', title: 'Uncategorized', vwTypes: [] }),
      ])
      store.filterVwType = 'uncategorized'
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Uncategorized')
    })

    it('returns all songs when filterVwType is null', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', vwTypes: [1] }),
        makeSong({ id: 'song-2', vwTypes: [] }),
      ])
      store.filterVwType = null
      expect(store.filteredSongs).toHaveLength(2)
    })

    // CR-01: a stale filterVwType selection must not silently keep filtering
    // once VW mode is turned off — mirrors the search `type:` prefix gate.
    it('D-16/CR-01: does not filter by numeric vwType when VW mode is disabled', async () => {
      mockAuthVwModeEnabled = false
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Type1 Song', vwTypes: [1] }),
        makeSong({ id: 'song-2', title: 'Type2 Song', vwTypes: [2] }),
      ])
      store.filterVwType = 2
      expect(store.filteredSongs).toHaveLength(2)
    })

    it('D-16/CR-01: does not filter by "uncategorized" vwType when VW mode is disabled', async () => {
      mockAuthVwModeEnabled = false
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Categorized', vwTypes: [1] }),
        makeSong({ id: 'song-2', title: 'Uncategorized', vwTypes: [] }),
      ])
      store.filterVwType = 'uncategorized'
      expect(store.filteredSongs).toHaveLength(2)
    })
  })

  describe('filteredSongs — key filter', () => {
    it('filters by key scanning arrangements array', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Song in G', arrangements: [{ id: 'arr-1', name: 'Original', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] }),
        makeSong({ id: 'song-2', title: 'Song in D', arrangements: [{ id: 'arr-2', name: 'Original', key: 'D', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] }),
      ])
      store.filterKey = 'G'
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Song in G')
    })

    it('returns no results when key does not match any arrangement', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', arrangements: [{ id: 'arr-1', name: 'Original', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: [] }] }),
      ])
      store.filterKey = 'C#'
      expect(store.filteredSongs).toHaveLength(0)
    })
  })

  describe('filteredSongs — team tag filter', () => {
    it('filters by teamTag', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Choir Song', teamTags: ['Choir'] }),
        makeSong({ id: 'song-2', title: 'Band Song', teamTags: ['Band'] }),
      ])
      store.tagFilterInclude = new Set(['Choir'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Choir Song')
    })

    it('include/exclude matching is unaffected by the teamTags→tags read-fold (D-01)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        // 'Orchestra' now also lives in the folded tags set, but filter matching
        // against the raw teamTags union must still behave identically.
        makeSong({ id: 'song-1', title: 'Orchestra Song', teamTags: ['Orchestra'], tags: [] }),
        makeSong({ id: 'song-2', title: 'Other Song', teamTags: [], tags: [] }),
      ])
      expect(new Set(store.songs[0]!.tags)).toEqual(new Set(['Orchestra']))
      store.tagFilterInclude = new Set(['Orchestra'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Orchestra Song')

      store.tagFilterInclude = new Set()
      store.tagFilterExclude = new Set(['Orchestra'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Other Song')
    })
  })

  describe('filteredSongs — combined filters (AND logic)', () => {
    it('combines search + vwType filter', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Amazing Grace', vwTypes: [1] }),
        makeSong({ id: 'song-2', title: 'Amazing Love', vwTypes: [2] }),
        makeSong({ id: 'song-3', title: 'How Great', vwTypes: [1] }),
      ])
      store.searchQuery = 'amazing'
      store.filterVwType = 1
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Amazing Grace')
    })

    it('combines key + tag filter', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Match', teamTags: ['Choir'], arrangements: [{ id: 'a1', name: 'O', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: ['Choir'] }] }),
        makeSong({ id: 'song-2', title: 'Wrong Tag', teamTags: ['Band'], arrangements: [{ id: 'a2', name: 'O', key: 'G', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: ['Band'] }] }),
        makeSong({ id: 'song-3', title: 'Wrong Key', teamTags: ['Choir'], arrangements: [{ id: 'a3', name: 'O', key: 'D', bpm: null, lengthSeconds: null, chordChartUrl: '', notes: '', teamTags: ['Choir'] }] }),
      ])
      store.filterKey = 'G'
      store.tagFilterInclude = new Set(['Choir'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Match')
    })
  })

  describe('addSong', () => {
    it('calls addDoc with correct shape including serverTimestamp', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      await store.addSong({
        title: 'New Song',
        ccliNumber: '',
        author: '',
        themes: [],
        notes: '',
        vwTypes: [],
        tags: [],
        removedThemes: [],
        arrangements: [],
        primaryArrangementId: null,
        lastUsedAt: null,
        pcSongId: null,
        hidden: false,
      })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.title).toBe('New Song')
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('updateSong', () => {
    it('calls updateDoc with serverTimestamp for updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      await store.updateSong('song-1', { title: 'Updated Title' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.title).toBe('Updated Title')
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('deleteSong', () => {
    it('calls updateDoc with hidden:true, not deleteDoc', async () => {
      const { updateDoc, deleteDoc } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      await store.deleteSong('song-1')

      expect(deleteDoc).not.toHaveBeenCalled()
      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.hidden).toBe(true)
      expect(data.updatedAt).toBeDefined()
    })
  })

  describe('hardDeleteSong', () => {
    it('permanently deletes a hidden song: commits a batch deleting the song doc and every lyrics doc', async () => {
      const { getDocs, writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Hidden Song', hidden: true }),
      ])

      await store.hardDeleteSong('song-1')

      expect(getDocs).toHaveBeenCalledOnce()
      expect(writeBatch).toHaveBeenCalledOnce()
      // 2 lyrics docs + 1 song doc = 3 deletes
      expect(mockBatchOps.filter((op) => op.type === 'delete')).toHaveLength(3)
      const deletedPaths = mockBatchOps
        .filter((op) => op.type === 'delete')
        .map((op) => (op.ref as { path: string }).path)
      expect(deletedPaths).toContain('lyrics/lyric-1')
      expect(deletedPaths).toContain('lyrics/lyric-2')
      expect(deletedPaths).toContain('organizations/org-1/songs/song-1')
    })

    it('is a no-op for a song that is not hidden (defense-in-depth guard)', async () => {
      const { getDocs, writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-2', title: 'Visible Song', hidden: false }),
      ])

      await store.hardDeleteSong('song-2')

      expect(getDocs).not.toHaveBeenCalled()
      expect(writeBatch).not.toHaveBeenCalled()
      expect(mockBatchOps).toHaveLength(0)
    })

    it('is a no-op when orgId is unset', async () => {
      const { getDocs, writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      // Deliberately do not call store.subscribe() — orgId stays null.

      await store.hardDeleteSong('song-3')

      expect(getDocs).not.toHaveBeenCalled()
      expect(writeBatch).not.toHaveBeenCalled()
      expect(mockBatchOps).toHaveLength(0)
    })

    it('is a no-op for a song id that does not exist in songs.value', async () => {
      const { getDocs, writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Hidden Song', hidden: true }),
      ])

      await store.hardDeleteSong('does-not-exist')

      expect(getDocs).not.toHaveBeenCalled()
      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('hardDeleteSong is exported from the store', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect('hardDeleteSong' in store).toBe(true)
    })
  })

  describe('restoreSong', () => {
    it('calls updateDoc with hidden:false', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      await store.restoreSong('song-1')

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.hidden).toBe(false)
      expect(data.updatedAt).toBeDefined()
    })
  })

  describe('upsertSongs', () => {
    // R350/ARCH-014: upsertSongs now stages writes via writeBatch (batch.set/
    // batch.update) instead of a per-song addDoc/updateDoc — these helpers
    // read from mockBatchOps, mirroring hardDeleteSong's existing precedent
    // above.
    function lastBatchOp(type: 'set' | 'update') {
      const ops = mockBatchOps.filter((op) => op.type === type)
      return ops[ops.length - 1]
    }

    it('stages a batch.set when no match found', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])

      const summary = await store.upsertSongs([
        {
          title: 'Brand New Song',
          ccliNumber: '99999',
          author: 'New Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-new-1',
          hidden: false,
        },
      ])

      expect(writeBatch).toHaveBeenCalledOnce()
      const op = lastBatchOp('set')!
      const data = op.data as Record<string, unknown>
      expect(data.title).toBe('Brand New Song')
      expect(data.hidden).toBe(false)
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(summary).toEqual({ added: 1, updated: 0, failed: [] })
    })

    it('stages a batch.update when pcSongId matches', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'existing-song', title: 'Old Title', pcSongId: 'pc-123', ccliNumber: '11111', hidden: false }),
      ])

      const summary = await store.upsertSongs([
        {
          title: 'Updated Title',
          ccliNumber: '11111',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [1],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-123',
          hidden: false,
        },
      ])

      const op = lastBatchOp('update')!
      const data = op.data as Record<string, unknown>
      expect(data.title).toBe('Updated Title')
      expect(summary).toEqual({ added: 0, updated: 1, failed: [] })
    })

    it('stages a batch.update when ccliNumber matches (no pcSongId)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'existing-song', title: 'Old Title', pcSongId: null, ccliNumber: '55555', hidden: false }),
      ])

      await store.upsertSongs([
        {
          title: 'Updated Via CCLI',
          ccliNumber: '55555',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: null,
          hidden: false,
        },
      ])

      const op = lastBatchOp('update')!
      const data = op.data as Record<string, unknown>
      expect(data.title).toBe('Updated Via CCLI')
    })

    it('preserves hidden:true when updating existing song', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'hidden-song', title: 'Hidden Song', pcSongId: 'pc-hidden', ccliNumber: '77777', hidden: true }),
      ])

      await store.upsertSongs([
        {
          title: 'Hidden Song Updated',
          ccliNumber: '77777',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-hidden',
          hidden: false, // incoming says not hidden, but existing is hidden — preserve hidden
        },
      ])

      const op = lastBatchOp('update')!
      const data = op.data as Record<string, unknown>
      expect(data.hidden).toBe(true) // preserved from existing song
    })

    it('only sets vwTypes when incoming vwTypes is non-empty', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-with-type', title: 'Typed Song', pcSongId: 'pc-typed', ccliNumber: '88888', vwTypes: [2], hidden: false }),
      ])

      await store.upsertSongs([
        {
          title: 'Typed Song',
          ccliNumber: '88888',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [], // incoming vwTypes is empty — should preserve existing
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-typed',
          hidden: false,
        },
      ])

      const op = lastBatchOp('update')!
      const data = op.data as Record<string, unknown>
      // vwTypes should NOT be in the update data (preserving the existing value)
      expect(data.vwTypes).toBeUndefined()
    })

    it('includes vwTypes in update when incoming is non-empty', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-update', title: 'Song', pcSongId: 'pc-update', ccliNumber: '99911', vwTypes: [], hidden: false }),
      ])

      await store.upsertSongs([
        {
          title: 'Song',
          ccliNumber: '99911',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [1, 3],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-update',
          hidden: false,
        },
      ])

      const op = lastBatchOp('update')!
      const data = op.data as Record<string, unknown>
      expect(data.vwTypes).toEqual([1, 3])
    })
  })

  describe('upsertSongs — batch chunking + per-chunk failure isolation (R350)', () => {
    function makeUpsertInput(overrides: Partial<{
      title: string
      ccliNumber: string
      pcSongId: string | null
    }> = {}) {
      return {
        title: overrides.title ?? 'Song',
        ccliNumber: overrides.ccliNumber ?? '',
        author: 'Author',
        themes: [] as string[],
        notes: '',
        vwTypes: [] as VWType[],
        tags: [] as string[],
        removedThemes: [] as string[],
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
        primaryArrangementId: null as string | null,
        lastUsedAt: null,
        pcSongId: overrides.pcSongId ?? null,
        hidden: false,
      }
    }

    it('chunks 600 new songs into 2 writeBatch batches of 499 max', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])

      const songsData = Array.from({ length: 600 }, (_, i) =>
        makeUpsertInput({ title: `Song ${i}`, pcSongId: `pc-${i}` }),
      )

      const summary = await store.upsertSongs(songsData)

      expect(writeBatch).toHaveBeenCalledTimes(2)
      expect(summary.added).toBe(600)
      expect(summary.failed).toEqual([])
    })

    it('creates a single batch for 499 or fewer songs', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])

      const songsData = Array.from({ length: 499 }, (_, i) =>
        makeUpsertInput({ title: `Song ${i}`, pcSongId: `pc-${i}` }),
      )

      await store.upsertSongs(songsData)

      expect(writeBatch).toHaveBeenCalledTimes(1)
    })

    it('a rejected chunk commit does not stop a later chunk from committing, and reports the failed songs', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])

      // First writeBatch() call (chunk 1) commits with a rejection; every
      // subsequent call (chunk 2+) commits normally — proving chunk 2 still
      // lands even though chunk 1 failed.
      let callCount = 0
      vi.mocked(writeBatch).mockImplementation(() => {
        callCount += 1
        const shouldFail = callCount === 1
        return {
          set: vi.fn((ref: unknown, data: Record<string, unknown>) => {
            mockBatchOps.push({ type: 'set', ref, data })
          }),
          update: vi.fn((ref: unknown, data: Record<string, unknown>) => {
            mockBatchOps.push({ type: 'update', ref, data })
          }),
          delete: vi.fn((ref: unknown) => {
            mockBatchOps.push({ type: 'delete', ref })
          }),
          commit: vi.fn(() => (shouldFail ? Promise.reject(new Error('commit failed')) : Promise.resolve())),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      })

      const songsData = Array.from({ length: 600 }, (_, i) =>
        makeUpsertInput({ title: `Song ${i}`, pcSongId: `pc-${i}` }),
      )
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const summary = await store.upsertSongs(songsData)

      expect(writeBatch).toHaveBeenCalledTimes(2)
      // Chunk 1 (499 songs) failed — none counted as added; chunk 2 (101 songs)
      // still committed successfully.
      expect(summary.added).toBe(101)
      expect(summary.updated).toBe(0)
      expect(summary.failed).toHaveLength(499)
      expect(summary.failed[0]).toEqual({ title: 'Song 0', error: 'commit failed' })
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      // Restore the module's default writeBatch implementation — this test's
      // override must not leak into later tests in this file.
      vi.mocked(writeBatch).mockImplementation(() => ({
        set: vi.fn((ref: unknown, data: Record<string, unknown>) => {
          mockBatchOps.push({ type: 'set', ref, data })
        }),
        update: vi.fn((ref: unknown, data: Record<string, unknown>) => {
          mockBatchOps.push({ type: 'update', ref, data })
        }),
        delete: vi.fn((ref: unknown) => {
          mockBatchOps.push({ type: 'delete', ref })
        }),
        commit: vi.fn(() => Promise.resolve()),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)
    })

    // LW-03 (119-REVIEW): locks in the batching tradeoff — a single failing
    // chunk is all-or-nothing (every song staged in it is reported failed,
    // even a perfectly valid one), while a separate chunk with BOTH an add
    // and an update still persists in full. Mixes add+update categories on
    // both sides of the boundary so the summary's added/updated/failed
    // counts, and the successful chunk's staged data, are all asserted.
    it('mixed add/update across a chunk boundary: a failed chunk reports every staged song failed while a separate succeeding chunk still persists its add and update', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'existing-chunk1', title: 'Existing Chunk1', pcSongId: 'pc-existing-1', ccliNumber: '60001', hidden: false }),
        makeSong({ id: 'existing-chunk2', title: 'Existing Chunk2', pcSongId: 'pc-existing-2', ccliNumber: '60002', hidden: false }),
      ])

      let callCount = 0
      vi.mocked(writeBatch).mockImplementation(() => {
        callCount += 1
        const shouldFail = callCount === 1
        return {
          set: vi.fn((ref: unknown, data: Record<string, unknown>) => {
            mockBatchOps.push({ type: 'set', ref, data })
          }),
          update: vi.fn((ref: unknown, data: Record<string, unknown>) => {
            mockBatchOps.push({ type: 'update', ref, data })
          }),
          delete: vi.fn((ref: unknown) => {
            mockBatchOps.push({ type: 'delete', ref })
          }),
          commit: vi.fn(() => (shouldFail ? Promise.reject(new Error('commit failed')) : Promise.resolve())),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      })

      // Chunk 1 (indices 0-498, 499 songs): mostly new + one update matching
      // 'existing-chunk1'. This whole chunk's commit rejects below.
      const chunk1 = Array.from({ length: 498 }, (_, i) =>
        makeUpsertInput({ title: `Chunk1 New ${i}`, pcSongId: `pc-c1-${i}` }),
      )
      chunk1.push(makeUpsertInput({ title: 'Chunk1 Update', ccliNumber: '60001' }))

      // Chunk 2 (indices 499-500, 2 songs): one new + one update matching
      // 'existing-chunk2'. This chunk's commit succeeds.
      const chunk2 = [
        makeUpsertInput({ title: 'Chunk2 New', pcSongId: 'pc-c2-new' }),
        makeUpsertInput({ title: 'Chunk2 Update', ccliNumber: '60002' }),
      ]

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const summary = await store.upsertSongs([...chunk1, ...chunk2])

      expect(writeBatch).toHaveBeenCalledTimes(2)
      // Chunk 1 (498 new + 1 update = 499) failed wholesale — reported as failed,
      // not partially added/updated.
      expect(summary.failed).toHaveLength(499)
      expect(summary.failed.some((f) => f.title === 'Chunk1 Update')).toBe(true)
      // Chunk 2 (1 new + 1 update) persisted despite chunk 1's failure.
      expect(summary.added).toBe(1)
      expect(summary.updated).toBe(1)

      // The successful chunk's ops are staged correctly and not corrupted by
      // the preceding chunk's failure — chunk 2 is staged after chunk 1, so
      // its ops are the LAST set/update ops pushed.
      const setOps = mockBatchOps.filter((op) => op.type === 'set')
      const updateOps = mockBatchOps.filter((op) => op.type === 'update')
      const lastSet = setOps[setOps.length - 1]!
      const lastUpdate = updateOps[updateOps.length - 1]!
      expect((lastSet.data as Record<string, unknown>).title).toBe('Chunk2 New')
      expect((lastUpdate.data as Record<string, unknown>).title).toBe('Chunk2 Update')

      consoleErrorSpy.mockRestore()
      // Restore the module's default writeBatch implementation — this test's
      // override must not leak into later tests in this file.
      vi.mocked(writeBatch).mockImplementation(() => ({
        set: vi.fn((ref: unknown, data: Record<string, unknown>) => {
          mockBatchOps.push({ type: 'set', ref, data })
        }),
        update: vi.fn((ref: unknown, data: Record<string, unknown>) => {
          mockBatchOps.push({ type: 'update', ref, data })
        }),
        delete: vi.fn((ref: unknown) => {
          mockBatchOps.push({ type: 'delete', ref })
        }),
        commit: vi.fn(() => Promise.resolve()),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)
    })
  })

  describe('upsertSongs — tag preservation and theme merge (D-02, D-08)', () => {
    it('preserves existing user tags when re-importing (tags from import are ignored)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-tagged', title: 'Tagged Song', pcSongId: 'pc-tagged', ccliNumber: '11111', teamTags: [], tags: ['Christmas'] }),
      ])

      await store.upsertSongs([
        {
          title: 'Tagged Song',
          ccliNumber: '11111',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: [], // import sends empty tags — must NOT overwrite existing user tags
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-tagged',
          hidden: false,
        },
      ])

      const updateOps = mockBatchOps.filter((op) => op.type === 'update')
      expect(updateOps).toHaveLength(1)
      const data = updateOps[0]!.data as Record<string, unknown>
      expect(data.tags).toEqual(['Christmas']) // preserved from existing song
    })

    it('unions themes on re-import (existing themes not lost)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-themes', title: 'Theme Song', pcSongId: 'pc-themes', ccliNumber: '22222', themes: ['grace', 'salvation'] }),
      ])

      await store.upsertSongs([
        {
          title: 'Theme Song',
          ccliNumber: '22222',
          author: 'Author',
          themes: ['salvation', 'worship'], // incoming has one overlap + one new
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-themes',
          hidden: false,
        },
      ])

      const updateOps = mockBatchOps.filter((op) => op.type === 'update')
      expect(updateOps).toHaveLength(1)
      const data = updateOps[0]!.data as Record<string, unknown>
      const themes = data.themes as string[]
      expect(themes).toContain('grace')     // existing theme preserved
      expect(themes).toContain('salvation') // overlap deduplicated
      expect(themes).toContain('worship')   // new theme added
      expect(themes.filter((t) => t === 'salvation')).toHaveLength(1) // no duplicates
    })

    it('new song gets tags: [] when import has tags: []', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])

      await store.upsertSongs([
        {
          title: 'New Song With No Tags',
          ccliNumber: '33333',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-new',
          hidden: false,
        },
      ])

      const setOps = mockBatchOps.filter((op) => op.type === 'set')
      expect(setOps).toHaveLength(1)
      const data = setOps[0]!.data as Record<string, unknown>
      expect(data.tags).toEqual([])
    })
  })

  describe('upsertSongs — tag union + theme-removal-aware merge (D-05, D-14)', () => {
    it('unions incoming team tags into existing tags without dropping the user tag', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-union', title: 'Union Song', pcSongId: 'pc-union', ccliNumber: '44001', teamTags: [], tags: ['Christmas'] }),
      ])

      await store.upsertSongs([
        {
          title: 'Union Song',
          ccliNumber: '44001',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: ['Orchestra'], // imported team-style tag
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-union',
          hidden: false,
        },
      ])

      const updateOps = mockBatchOps.filter((op) => op.type === 'update')
      expect(updateOps).toHaveLength(1)
      const data = updateOps[0]!.data as Record<string, unknown>
      expect(new Set(data.tags as string[])).toEqual(new Set(['Christmas', 'Orchestra']))
    })

    it('a theme listed in existing.removedThemes is NOT present in the written themes after re-import', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({
          id: 'song-removed-theme',
          title: 'Removed Theme Song',
          pcSongId: 'pc-removed-theme',
          ccliNumber: '44002',
          teamTags: [],
          themes: ['grace'],
          removedThemes: ['salvation'],
        }),
      ])

      await store.upsertSongs([
        {
          title: 'Removed Theme Song',
          ccliNumber: '44002',
          author: 'Author',
          themes: ['salvation', 'worship'], // PC still sends the removed theme back
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [],
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-removed-theme',
          hidden: false,
        },
      ])

      const updateOps = mockBatchOps.filter((op) => op.type === 'update')
      expect(updateOps).toHaveLength(1)
      const data = updateOps[0]!.data as Record<string, unknown>
      const themes = data.themes as string[]
      expect(themes).toContain('grace')
      expect(themes).toContain('worship')
      expect(themes).not.toContain('salvation') // user-removed theme stays removed
    })

    it('removedThemes survives an upsert unchanged', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({
          id: 'song-preserve-removed',
          title: 'Preserve Removed',
          pcSongId: 'pc-preserve-removed',
          ccliNumber: '44003',
          teamTags: [],
          removedThemes: ['salvation'],
        }),
      ])

      await store.upsertSongs([
        {
          title: 'Preserve Removed',
          ccliNumber: '44003',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [],
          tags: [],
          removedThemes: [], // import never sets removedThemes itself
          arrangements: [],
          primaryArrangementId: null,
          lastUsedAt: null,
          pcSongId: 'pc-preserve-removed',
          hidden: false,
        },
      ])

      const updateOps = mockBatchOps.filter((op) => op.type === 'update')
      expect(updateOps).toHaveLength(1)
      const data = updateOps[0]!.data as Record<string, unknown>
      expect(data.removedThemes).toEqual(['salvation'])
    })
  })

  describe('subscribe — legacy tags backfill (D-01)', () => {
    it('normalizes missing tags field to [] for legacy docs', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'legacy-no-tags',
              data: () => ({
                title: 'Legacy Song',
                ccliNumber: '44444',
                author: 'Old Author',
                vwTypes: [],
                teamTags: [],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                hidden: false,
                // tags field intentionally omitted — legacy doc
              }),
            },
          ],
        })
      }
      expect(store.songs[0]!.tags).toEqual([])
    })

    it('preserves existing tags array for docs that already have it', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'song-with-tags',
              data: () => ({
                title: 'Tagged Song',
                ccliNumber: '55555',
                author: 'Author',
                vwTypes: [],
                teamTags: [],
                tags: ['Christmas', 'Advent'],
                arrangements: [],
                themes: [],
                notes: '',
                lastUsedAt: null,
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                hidden: false,
              }),
            },
          ],
        })
      }
      expect(store.songs[0]!.tags).toEqual(['Christmas', 'Advent'])
    })
  })

  describe('filteredSongs — tag-filter checklist (D-08/D-09/D-10)', () => {
    it('default state, empty include+exclude sets returns all non-hidden songs (unchanged behavior)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
        makeSong({ id: 'song-2', title: 'Regular Song', tags: [] }),
      ])
      expect(store.tagFilterInclude.size).toBe(0)
      expect(store.tagFilterExclude.size).toBe(0)
      expect(store.filteredSongs).toHaveLength(2)
    })

    it('include Set(["Christmas"]) shows only songs carrying that tag', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
        makeSong({ id: 'song-2', title: 'Easter Song', tags: ['Easter'] }),
      ])
      store.tagFilterInclude = new Set(['Christmas'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Christmas Song')
    })

    it('include OR: Set(["Christmas","Easter"]) broadens to include either tag', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
        makeSong({ id: 'song-2', title: 'Easter Song', tags: ['Easter'] }),
        makeSong({ id: 'song-3', title: 'Regular Song', tags: [] }),
      ])
      store.tagFilterInclude = new Set(['Christmas', 'Easter'])
      expect(store.filteredSongs).toHaveLength(2)
      const titles = store.filteredSongs.map((s) => s.title)
      expect(titles).toContain('Christmas Song')
      expect(titles).toContain('Easter Song')
    })

    it('exclude set: excluded tags are EXCLUDED, others appear', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Christmas Song', tags: ['Christmas'] }),
        makeSong({ id: 'song-2', title: 'Regular Song', tags: [] }),
      ])
      store.tagFilterExclude = new Set(['Christmas'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Regular Song')
    })

    it('clearTagFilter() empties both include and exclude sets, leaves other filters untouched', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      store.searchQuery = 'amazing'
      store.filterVwType = 1
      store.filterKey = 'G'
      store.tagFilterInclude = new Set(['Orchestra'])
      store.tagFilterExclude = new Set(['Christmas'])

      store.clearTagFilter()

      expect(store.tagFilterInclude.size).toBe(0)
      expect(store.tagFilterExclude.size).toBe(0)
      expect(store.searchQuery).toBe('amazing')
      expect(store.filterVwType).toBe(1)
      expect(store.filterKey).toBe('G')
    })

    it('tagFilterInclude, tagFilterExclude, and clearTagFilter are exported from store', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect('tagFilterInclude' in store).toBe(true)
      expect('tagFilterExclude' in store).toBe(true)
      expect('clearTagFilter' in store).toBe(true)
    })

    it('include value matching a song\'s themes shows that song (union)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Grace Song', themes: ['grace'] }),
        makeSong({ id: 'song-2', title: 'Other Song', themes: ['salvation'] }),
      ])
      store.tagFilterInclude = new Set(['grace'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Grace Song')
    })

    it('include value matching a song\'s teamTags shows that song (union)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Orchestra Song', teamTags: ['Orchestra'] }),
        makeSong({ id: 'song-2', title: 'Other Song', teamTags: ['Band'] }),
      ])
      store.tagFilterInclude = new Set(['Orchestra'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Orchestra Song')
    })

    it('exclude themes value excludes the song carrying it (union)', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Grace Song', themes: ['grace'] }),
        makeSong({ id: 'song-2', title: 'Other Song', themes: ['salvation'] }),
      ])
      store.tagFilterExclude = new Set(['grace'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Other Song')
    })

    it('simultaneous include+exclude: excluding a tag wins even when the song also carries an included tag', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        // Carries BOTH the included ("Orchestra") and excluded ("Christmas") tags — must be dropped.
        makeSong({ id: 'song-1', title: 'Orchestra Christmas Song', teamTags: ['Orchestra'], tags: ['Christmas'] }),
        // Carries only the included tag — must appear.
        makeSong({ id: 'song-2', title: 'Orchestra Song', teamTags: ['Orchestra'], tags: [] }),
        // Carries only the excluded tag — must be dropped.
        makeSong({ id: 'song-3', title: 'Christmas Song', teamTags: [], tags: ['Christmas'] }),
        // Carries neither — must be dropped (include set is non-empty, so it must match to pass).
        makeSong({ id: 'song-4', title: 'Unrelated Song', teamTags: [], tags: [] }),
      ])
      store.tagFilterInclude = new Set(['Orchestra'])
      store.tagFilterExclude = new Set(['Christmas'])
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Orchestra Song')
    })

    it('include-only across the union (teamTags ∪ themes ∪ tags) still works with exclude empty', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Team Match', teamTags: ['Orchestra'], themes: [], tags: [] }),
        makeSong({ id: 'song-2', title: 'Theme Match', teamTags: [], themes: ['grace'], tags: [] }),
        makeSong({ id: 'song-3', title: 'User Tag Match', teamTags: [], themes: [], tags: ['Christmas'] }),
        makeSong({ id: 'song-4', title: 'No Match', teamTags: [], themes: [], tags: [] }),
      ])
      store.tagFilterInclude = new Set(['Orchestra', 'grace', 'Christmas'])
      expect(store.filteredSongs).toHaveLength(3)
      const titles = store.filteredSongs.map((s) => s.title)
      expect(titles).toContain('Team Match')
      expect(titles).toContain('Theme Match')
      expect(titles).toContain('User Tag Match')
      expect(titles).not.toContain('No Match')
    })
  })

  describe('importSongs — batch chunking', () => {
    it('chunks 600 songs into 2 batches of 499 max', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      const songs = Array.from({ length: 600 }, (_, i) => ({
        title: `Song ${i}`,
        ccliNumber: '',
        author: '',
        themes: [] as string[],
        notes: '',
        vwTypes: [] as VWType[],
        teamTags: [] as string[],
        tags: [] as string[],
        removedThemes: [] as string[],
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
        primaryArrangementId: null as string | null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null as string | null,
      }))

      await store.importSongs(songs)

      // 600 songs / 499 = 2 batches (499 + 101)
      expect(writeBatch).toHaveBeenCalledTimes(2)
    })

    it('creates a single batch for 499 or fewer songs', async () => {
      const { writeBatch } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      const songs = Array.from({ length: 499 }, (_, i) => ({
        title: `Song ${i}`,
        ccliNumber: '',
        author: '',
        themes: [] as string[],
        notes: '',
        vwTypes: [] as VWType[],
        teamTags: [] as string[],
        tags: [] as string[],
        removedThemes: [] as string[],
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
        primaryArrangementId: null as string | null,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null as string | null,
      }))

      await store.importSongs(songs)

      expect(writeBatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('tag-filter persistence (D-12/D-13)', () => {
    it('persists include + exclude sets to localStorage under a per-user/org v2 key on change', async () => {
      mockAuthUser = { uid: 'uid-1' }
      mockAuthOrgId = 'org-1'
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      store.tagFilterInclude = new Set(['Orchestra'])
      store.tagFilterExclude = new Set(['Christmas'])
      await vi.waitFor(() => {
        const raw = localStorage.getItem('wp:tagFilter:v2:org-1:uid-1')
        expect(raw).not.toBeNull()
      })
      const raw = localStorage.getItem('wp:tagFilter:v2:org-1:uid-1')!
      const parsed = JSON.parse(raw)
      expect(parsed.include).toEqual(['Orchestra'])
      expect(parsed.exclude).toEqual(['Christmas'])
    })

    it('does not read or write localStorage when uid is missing', async () => {
      mockAuthUser = null
      mockAuthOrgId = 'org-1'
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      store.tagFilterInclude = new Set(['Christmas'])
      expect(localStorage.length).toBe(0)
    })

    it('does not read or write localStorage when org is missing', async () => {
      mockAuthUser = { uid: 'uid-1' }
      mockAuthOrgId = null
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      // subscribe() sets orgId.value, but tagFilterStorageKey falls back to auth.orgId
      // when orgId.value is set via subscribe — so simulate missing auth entirely by
      // not calling subscribe (orgId.value stays null) and auth.orgId also null.
      store.tagFilterInclude = new Set(['Christmas'])
      expect(localStorage.length).toBe(0)
    })

    it('hydrates tagFilterInclude/tagFilterExclude from localStorage on subscribe', async () => {
      mockAuthUser = { uid: 'uid-2' }
      mockAuthOrgId = 'org-2'
      localStorage.setItem(
        'wp:tagFilter:v2:org-2:uid-2',
        JSON.stringify({ include: ['Easter', 'Advent'], exclude: ['Christmas'] }),
      )
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-2')

      expect(Array.from(store.tagFilterInclude)).toEqual(['Easter', 'Advent'])
      expect(Array.from(store.tagFilterExclude)).toEqual(['Christmas'])
    })

    it('silently ignores corrupt localStorage JSON and keeps in-memory defaults', async () => {
      mockAuthUser = { uid: 'uid-3' }
      mockAuthOrgId = 'org-3'
      localStorage.setItem('wp:tagFilter:v2:org-3:uid-3', '{not valid json')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect(() => store.subscribe('org-3')).not.toThrow()
      expect(store.tagFilterInclude.size).toBe(0)
      expect(store.tagFilterExclude.size).toBe(0)
    })

    it('silently ignores localStorage.setItem failures (quota/private mode)', async () => {
      mockAuthUser = { uid: 'uid-4' }
      mockAuthOrgId = 'org-4'
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-4')
      expect(() => {
        store.tagFilterInclude = new Set(['Christmas'])
      }).not.toThrow()
      setItemSpy.mockRestore()
    })

    it('resets in-memory tag filter when switching to a user/org with no stored entry (WR-01, T-12-03)', async () => {
      // User A has a non-default tag filter saved and active in memory.
      mockAuthUser = { uid: 'uid-a' }
      mockAuthOrgId = 'org-a'
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-a')
      store.tagFilterInclude = new Set(['Orchestra'])
      store.tagFilterExclude = new Set(['Christmas'])
      await vi.waitFor(() => {
        expect(localStorage.getItem('wp:tagFilter:v2:org-a:uid-a')).not.toBeNull()
      })
      expect(store.tagFilterInclude.size).toBe(1)
      expect(store.tagFilterExclude.size).toBe(1)

      // User B logs in within the same tab/session (singleton store) — no
      // stored filter exists yet for User B's user/org key.
      mockAuthUser = { uid: 'uid-b' }
      mockAuthOrgId = 'org-b'
      store.subscribe('org-b')

      // User A's in-memory selection must NOT leak into User B's session.
      expect(store.tagFilterInclude.size).toBe(0)
      expect(store.tagFilterExclude.size).toBe(0)
    })
  })

  describe('column visibility (D-08/D-09/D-10)', () => {
    it('defaults all six toggleable columns to visible, with no title key', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect(store.columnVisibility).toEqual({
        category: true,
        key: true,
        ccli: true,
        lastUsed: true,
        tags: true,
        themes: true,
      })
      expect('title' in store.columnVisibility).toBe(false)
    })

    it('toggleColumn flips only the targeted key', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.toggleColumn('tags')
      expect(store.columnVisibility.tags).toBe(false)
      expect(store.columnVisibility.category).toBe(true)
      expect(store.columnVisibility.key).toBe(true)
      expect(store.columnVisibility.ccli).toBe(true)
      expect(store.columnVisibility.lastUsed).toBe(true)
      expect(store.columnVisibility.themes).toBe(true)
    })

    it('resetColumns restores every key to true', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.toggleColumn('tags')
      store.toggleColumn('key')
      store.resetColumns()
      expect(store.columnVisibility).toEqual({
        category: true,
        key: true,
        ccli: true,
        lastUsed: true,
        tags: true,
        themes: true,
      })
    })
  })

  describe('column-visibility persistence (D-08/D-09/D-10)', () => {
    it('persists columnVisibility to localStorage under a per-user/org namespaced key on change', async () => {
      mockAuthUser = { uid: 'uid-1' }
      mockAuthOrgId = 'org-1'
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      store.toggleColumn('tags')
      await vi.waitFor(() => {
        const raw = localStorage.getItem('wp:songTableColumns:v1:org-1:uid-1')
        expect(raw).not.toBeNull()
      })
      const raw = localStorage.getItem('wp:songTableColumns:v1:org-1:uid-1')!
      const parsed = JSON.parse(raw)
      expect(parsed.tags).toBe(false)
      expect(parsed.category).toBe(true)
    })

    it('does not read or write localStorage when uid is missing', async () => {
      mockAuthUser = null
      mockAuthOrgId = 'org-1'
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      store.toggleColumn('tags')
      expect(localStorage.length).toBe(0)
    })

    it('does not read or write localStorage when org is missing', async () => {
      mockAuthUser = { uid: 'uid-1' }
      mockAuthOrgId = null
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.toggleColumn('tags')
      expect(localStorage.length).toBe(0)
    })

    it('hydrates columnVisibility from localStorage on subscribe', async () => {
      mockAuthUser = { uid: 'uid-2' }
      mockAuthOrgId = 'org-2'
      localStorage.setItem(
        'wp:songTableColumns:v1:org-2:uid-2',
        JSON.stringify({ category: false, key: true, ccli: true, lastUsed: true, tags: true, themes: true }),
      )
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-2')

      expect(store.columnVisibility.category).toBe(false)
      expect(store.columnVisibility.tags).toBe(true)
    })

    it('resets to all-true when the saved payload is corrupt', async () => {
      mockAuthUser = { uid: 'uid-3' }
      mockAuthOrgId = 'org-3'
      localStorage.setItem('wp:songTableColumns:v1:org-3:uid-3', '{not valid json')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      expect(() => store.subscribe('org-3')).not.toThrow()
      expect(store.columnVisibility).toEqual({
        category: true,
        key: true,
        ccli: true,
        lastUsed: true,
        tags: true,
        themes: true,
      })
    })

    it('resets to all-true when no saved key exists', async () => {
      mockAuthUser = { uid: 'uid-4' }
      mockAuthOrgId = 'org-4'
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-4')
      expect(store.columnVisibility).toEqual({
        category: true,
        key: true,
        ccli: true,
        lastUsed: true,
        tags: true,
        themes: true,
      })
    })

    it('merges hydrated keys over the default map so a newly-added column key defaults visible', async () => {
      mockAuthUser = { uid: 'uid-5' }
      mockAuthOrgId = 'org-5'
      // Simulate an older saved payload missing the 'themes' key entirely.
      localStorage.setItem(
        'wp:songTableColumns:v1:org-5:uid-5',
        JSON.stringify({ category: false, key: true, ccli: true, lastUsed: true, tags: true }),
      )
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-5')

      expect(store.columnVisibility.category).toBe(false)
      expect(store.columnVisibility.themes).toBe(true)
    })
  })
})
