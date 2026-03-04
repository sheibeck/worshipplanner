import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Track onSnapshot callbacks and unsubscribe fns
let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  const mockBatch = {
    set: vi.fn(),
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

function makeSong(overrides: Partial<{
  id: string
  title: string
  ccliNumber: string
  author: string
  vwType: 1 | 2 | 3 | null
  teamTags: string[]
  arrangements: Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>
  themes: string[]
  notes: string
  lastUsedAt: null
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}> = {}) {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '12345',
    author: 'John Newton',
    vwType: 1 as 1 | 2 | 3 | null,
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
      expect(store.songs[0].id).toBe('song-1')
      expect(store.songs[0].title).toBe('Amazing Grace')
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
      expect(store.filteredSongs[0].title).toBe('Amazing Grace')
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
      expect(store.filteredSongs[0].ccliNumber).toBe('11111')
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
    it('filters by vwType 1', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Type1 Song', vwType: 1 }),
        makeSong({ id: 'song-2', title: 'Type2 Song', vwType: 2 }),
        makeSong({ id: 'song-3', title: 'Type3 Song', vwType: 3 }),
      ])
      store.filterVwType = 1
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0].vwType).toBe(1)
    })

    it('filters uncategorized songs when filterVwType is "uncategorized"', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Categorized', vwType: 1 }),
        makeSong({ id: 'song-2', title: 'Uncategorized', vwType: null }),
      ])
      store.filterVwType = 'uncategorized'
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0].title).toBe('Uncategorized')
    })

    it('returns all songs when filterVwType is null', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', vwType: 1 }),
        makeSong({ id: 'song-2', vwType: null }),
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
      expect(store.filteredSongs[0].title).toBe('Song in G')
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
      expect(store.filteredSongs[0].title).toBe('Choir Song')
    })
  })

  describe('filteredSongs — combined filters (AND logic)', () => {
    it('combines search + vwType filter', async () => {
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeSong({ id: 'song-1', title: 'Amazing Grace', vwType: 1 }),
        makeSong({ id: 'song-2', title: 'Amazing Love', vwType: 2 }),
        makeSong({ id: 'song-3', title: 'How Great', vwType: 1 }),
      ])
      store.searchQuery = 'amazing'
      store.filterVwType = 1
      expect(store.filteredSongs).toHaveLength(1)
      expect(store.filteredSongs[0].title).toBe('Amazing Grace')
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
      expect(store.filteredSongs[0].title).toBe('Match')
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
        vwType: null,
        teamTags: [],
        arrangements: [],
        lastUsedAt: null,
      })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]
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
      const callArgs = vi.mocked(updateDoc).mock.calls[0]
      const data = callArgs[1] as Record<string, unknown>
      expect(data.title).toBe('Updated Title')
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('deleteSong', () => {
    it('calls deleteDoc with the correct doc reference', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { useSongStore } = await import('../songs')
      const store = useSongStore()
      store.subscribe('org-1')

      await store.deleteSong('song-1')

      expect(deleteDoc).toHaveBeenCalledOnce()
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
        vwType: null as 1 | 2 | 3 | null,
        teamTags: [] as string[],
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
        lastUsedAt: null,
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
        vwType: null as 1 | 2 | 3 | null,
        teamTags: [] as string[],
        arrangements: [] as Array<{ id: string; name: string; key: string; bpm: number | null; lengthSeconds: number | null; chordChartUrl: string; notes: string; teamTags: string[] }>,
        lastUsedAt: null,
      }))

      await store.importSongs(songs)

      expect(writeBatch).toHaveBeenCalledTimes(1)
    })
  })
})
