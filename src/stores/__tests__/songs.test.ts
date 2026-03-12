import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Track onSnapshot callbacks and unsubscribe fns
let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

// Track batch operations for upsertSongs tests
let mockBatchOps: { type: 'set' | 'update'; ref: unknown; data: Record<string, unknown> }[] = []

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  const mockBatch = {
    set: vi.fn((ref, data) => { mockBatchOps.push({ type: 'set', ref, data }) }),
    update: vi.fn((ref, data) => { mockBatchOps.push({ type: 'update', ref, data }) }),
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

import type { VWType } from '@/types/song'

function makeSong(overrides: Partial<{
  id: string
  title: string
  ccliNumber: string
  author: string
  vwTypes: VWType[]
  teamTags: string[]
  arrangements: Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>
  themes: string[]
  notes: string
  lastUsedAt: null
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
  pcSongId: string | null
  hidden: boolean
}> = {}) {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '12345',
    author: 'John Newton',
    vwTypes: [1] as VWType[],
    teamTags: ['Choir'],
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
      store.filterTag = 'Choir'
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0]!.title).toBe('Choir Song')
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
      store.filterTag = 'Choir'
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
        teamTags: [],
        arrangements: [],
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
    it('creates new doc via addDoc when no match found', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([])

      await store.upsertSongs([
        {
          title: 'Brand New Song',
          ccliNumber: '99999',
          author: 'New Author',
          themes: [],
          notes: '',
          vwTypes: [],
          teamTags: [],
          arrangements: [],
          lastUsedAt: null,
          pcSongId: 'pc-new-1',
          hidden: false,
        },
      ])

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.title).toBe('Brand New Song')
      expect(data.hidden).toBe(false)
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
    })

    it('updates existing doc via updateDoc when pcSongId matches', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'existing-song', title: 'Old Title', pcSongId: 'pc-123', ccliNumber: '11111', hidden: false }),
      ])

      await store.upsertSongs([
        {
          title: 'Updated Title',
          ccliNumber: '11111',
          author: 'Author',
          themes: [],
          notes: '',
          vwTypes: [1],
          teamTags: [],
          arrangements: [],
          lastUsedAt: null,
          pcSongId: 'pc-123',
          hidden: false,
        },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.title).toBe('Updated Title')
    })

    it('updates existing doc when ccliNumber matches (no pcSongId)', async () => {
      const { updateDoc } = await import('firebase/firestore')
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
          teamTags: [],
          arrangements: [],
          lastUsedAt: null,
          pcSongId: null,
          hidden: false,
        },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.title).toBe('Updated Via CCLI')
    })

    it('preserves hidden:true when updating existing song', async () => {
      const { updateDoc } = await import('firebase/firestore')
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
          teamTags: [],
          arrangements: [],
          lastUsedAt: null,
          pcSongId: 'pc-hidden',
          hidden: false, // incoming says not hidden, but existing is hidden — preserve hidden
        },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.hidden).toBe(true) // preserved from existing song
    })

    it('only sets vwTypes when incoming vwTypes is non-empty', async () => {
      const { updateDoc } = await import('firebase/firestore')
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
          teamTags: [],
          arrangements: [],
          lastUsedAt: null,
          pcSongId: 'pc-typed',
          hidden: false,
        },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      // vwTypes should NOT be in the update data (preserving the existing value)
      expect(data.vwTypes).toBeUndefined()
    })

    it('includes vwTypes in update when incoming is non-empty', async () => {
      const { updateDoc } = await import('firebase/firestore')
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
          teamTags: [],
          arrangements: [],
          lastUsedAt: null,
          pcSongId: 'pc-update',
          hidden: false,
        },
      ])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.vwTypes).toEqual([1, 3])
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
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
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
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
        lastUsedAt: null,
        hidden: false,
        pcSongId: null as string | null,
      }))

      await store.importSongs(songs)

      expect(writeBatch).toHaveBeenCalledTimes(1)
    })
  })
})
