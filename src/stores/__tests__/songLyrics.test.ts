import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Track onSnapshot callbacks and unsubscribe fns
let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((_query: unknown, callback: (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) => {
      snapshotCallback = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-lyrics-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Old line'] }],
          copyright: { title: 'Old', authors: [], ccliSongNumber: '', copyrightLines: [], ccliLicenseNumber: '' },
          performanceOrder: ['verse-1'],
          createdAt: { seconds: 2000000, nanoseconds: 0 },
          updatedAt: { seconds: 2000000, nanoseconds: 0 },
        }),
      }),
    ),
    query: vi.fn((ref: unknown) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

function makeLyricsDoc(overrides: Partial<{
  id: string
  sections: Array<{ id: string; label: string; lines: string[] }>
  copyright: { title: string; authors: string[]; ccliSongNumber: string; copyrightLines: string[]; ccliLicenseNumber: string }
  performanceOrder: string[]
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}> = {}) {
  return {
    id: 'lyrics-1',
    sections: [
      { id: 'verse-1', label: 'Verse 1', lines: ['Amazing grace, how sweet the sound'] },
      { id: 'chorus', label: 'Chorus', lines: ['My chains are gone'] },
    ],
    copyright: {
      title: 'Amazing Grace',
      authors: ['John Newton'],
      ccliSongNumber: '12345',
      copyrightLines: ['Public Domain'],
      ccliLicenseNumber: '999999',
    },
    performanceOrder: ['verse-1', 'chorus'],
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerSnapshot(docs: ReturnType<typeof makeLyricsDoc>[]) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: docs.map((d) => ({
        id: d.id,
        data: () => {
          const { id: _id, ...rest } = d
          return rest
        },
      })),
    })
  }
}

describe('useSongLyricsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
  })

  describe('initial state', () => {
    it('starts with empty lyrics array', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      expect(store.lyrics).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      expect(store.isLoading).toBe(true)
    })

    it('currentLyrics is null initially', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      expect(store.currentLyrics).toBeNull()
    })

    it('lyricVersions is empty initially', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      expect(store.lyricVersions).toEqual([])
    })
  })

  describe('subscribeLyrics', () => {
    it('calls onSnapshot on the lyrics subcollection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('populates lyrics from snapshot with { id, songId, ...data } mapping', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      const lyricsDoc = makeLyricsDoc()
      triggerSnapshot([lyricsDoc])
      expect(store.lyrics).toHaveLength(1)
      expect(store.lyrics[0]!.id).toBe('lyrics-1')
      expect(store.lyrics[0]!.songId).toBe('song-1')
      expect(store.lyrics[0]!.sections).toHaveLength(2)
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('calling subscribeLyrics again unsubscribes previous listener first', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      store.subscribeLyrics('org-1', 'song-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })

    it('defaults performanceOrder to [] for docs missing the field', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'lyrics-legacy',
              data: () => ({
                sections: [],
                copyright: { title: '', authors: [], ccliSongNumber: '', copyrightLines: [], ccliLicenseNumber: '' },
                createdAt: { seconds: 1000000, nanoseconds: 0 },
                updatedAt: { seconds: 1000000, nanoseconds: 0 },
                // performanceOrder intentionally omitted
              }),
            },
          ],
        })
      }
      expect(store.lyrics[0]!.performanceOrder).toEqual([])
    })
  })

  describe('currentLyrics', () => {
    it('returns the first (most recent) lyrics doc', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      triggerSnapshot([
        makeLyricsDoc({ id: 'lyrics-newest', createdAt: { seconds: 3000000, nanoseconds: 0 } }),
        makeLyricsDoc({ id: 'lyrics-oldest', createdAt: { seconds: 1000000, nanoseconds: 0 } }),
      ])
      expect(store.currentLyrics!.id).toBe('lyrics-newest')
    })

    it('returns null when no lyrics docs exist', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      triggerSnapshot([])
      expect(store.currentLyrics).toBeNull()
    })
  })

  describe('lyricVersions', () => {
    it('returns all lyrics docs', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      triggerSnapshot([
        makeLyricsDoc({ id: 'lyrics-v2' }),
        makeLyricsDoc({ id: 'lyrics-v1' }),
      ])
      expect(store.lyricVersions).toHaveLength(2)
      expect(store.lyricVersions[0]!.id).toBe('lyrics-v2')
      expect(store.lyricVersions[1]!.id).toBe('lyrics-v1')
    })
  })

  describe('saveLyrics', () => {
    it('calls addDoc with correct data and serverTimestamp', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()

      await store.saveLyrics('org-1', 'song-1', {
        sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Test line'] }],
        copyright: { title: 'Test', authors: ['Author'], ccliSongNumber: '123', copyrightLines: [], ccliLicenseNumber: '999' },
        performanceOrder: ['verse-1'],
      })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.sections).toHaveLength(1)
      expect(data.performanceOrder).toEqual(['verse-1'])
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('updateCurrentLyrics', () => {
    it('calls updateDoc with partial data and serverTimestamp for updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()

      await store.updateCurrentLyrics('org-1', 'song-1', 'lyrics-1', {
        sections: [{ id: 'verse-1', label: 'Verse 1', lines: ['Updated line'] }],
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect((data.sections as Array<{ lines: string[] }>)[0]!.lines[0]).toBe('Updated line')
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    it('does not overwrite createdAt', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()

      await store.updateCurrentLyrics('org-1', 'song-1', 'lyrics-1', {
        sections: [],
      })

      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.createdAt).toBeUndefined()
    })
  })

  describe('revertToVersion', () => {
    it('reads the version doc and creates a new doc with its data + fresh timestamps', async () => {
      const { getDoc, addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()

      await store.revertToVersion('org-1', 'song-1', 'lyrics-old')

      expect(getDoc).toHaveBeenCalledOnce()
      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      // Should have the old version's sections
      expect(data.sections).toBeDefined()
      // Should have fresh timestamps, not the old version's
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    it('does nothing when version doc does not exist', async () => {
      const { getDoc, addDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never)

      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()

      await store.revertToVersion('org-1', 'song-1', 'nonexistent')

      expect(getDoc).toHaveBeenCalledOnce()
      expect(addDoc).not.toHaveBeenCalled()
    })
  })

  describe('updatePerformanceOrder', () => {
    it('calls updateDoc on the Song doc with the new order and serverTimestamp', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()

      await store.updatePerformanceOrder('org-1', 'song-1', ['chorus', 'verse-1', 'verse-2'])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.performanceOrder).toEqual(['chorus', 'verse-1', 'verse-2'])
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('unsubscribeLyrics', () => {
    it('calls the unsubscribe fn and resets state', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      store.subscribeLyrics('org-1', 'song-1')
      triggerSnapshot([makeLyricsDoc()])
      expect(store.lyrics).toHaveLength(1)

      store.unsubscribeLyrics()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.lyrics).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('is safe to call when no subscription is active', async () => {
      const { useSongLyricsStore } = await import('../songLyrics')
      const store = useSongLyricsStore()
      expect(() => store.unsubscribeLyrics()).not.toThrow()
    })
  })
})
