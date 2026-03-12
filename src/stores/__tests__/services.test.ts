import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'

// Mock crypto.getRandomValues for deterministic token generation
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
})

// Track onSnapshot callbacks and unsubscribe fns
let snapshotCallback: ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void) | null = null
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((_query, callback) => {
      snapshotCallback = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-service-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    setDoc: vi.fn(() => Promise.resolve()),
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

// Mock the useSongStore for cross-store writes
const mockUpdateSong = vi.fn(() => Promise.resolve())
vi.mock('@/stores/songs', () => ({
  useSongStore: vi.fn(() => ({
    updateSong: mockUpdateSong,
    songs: [
      {
        id: 'song-abc',
        title: 'Amazing Grace',
        ccliNumber: '12345',
        arrangements: [
          { key: 'G', bpm: 120 },
          { key: 'C', bpm: 110 },
        ],
      },
    ],
  })),
}))

function makeService(overrides: Partial<{
  id: string
  date: string
  name: string
  progression: '1-2-2-3' | '1-2-3-3'
  teams: string[]
  status: 'draft' | 'planned'
  slots: unknown[]
  sermonPassage: null
  notes: string
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}> = {}) {
  return {
    id: 'service-1',
    date: '2026-03-08',
    name: 'Sunday Service',
    progression: '1-2-2-3' as '1-2-2-3' | '1-2-3-3',
    teams: [],
    status: 'draft' as 'draft' | 'planned',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerSnapshot(services: ReturnType<typeof makeService>[]) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: services.map((s) => ({
        id: s.id,
        data: () => {
          const { id: _id, ...rest } = s
          return rest
        },
      })),
    })
  }
}

describe('useServiceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
  })

  describe('initial state', () => {
    it('starts with empty services array', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      expect(store.services).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      expect(store.isLoading).toBe(true)
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot on the org services collection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('populates services from snapshot with { id, ...data } mapping', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService()
      triggerSnapshot([service])
      expect(store.services).toHaveLength(1)
      expect(store.services[0]!.id).toBe('service-1')
      expect(store.services[0]!.date).toBe('2026-03-08')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService()
      triggerSnapshot([service])
      expect(store.services).toHaveLength(1)
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.services).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('calling subscribe again unsubscribes previous listener first', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      store.subscribe('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })
  })

  describe('createService', () => {
    it('calls addDoc with correct shape including serverTimestamp', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.date).toBe('2026-03-08')
      expect(data.progression).toBe('1-2-2-3')
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    it('createService builds a 9-slot template from progression', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as Array<{ kind: string; position: number }>
      expect(slots).toHaveLength(9)
    })

    it('createService 1-2-2-3: song slots get correct VW types', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as Array<{ kind: string; position: number; requiredVwType?: number }>

      const songSlots = slots.filter((s) => s.kind === 'SONG')
      expect(songSlots).toHaveLength(5)
      expect(songSlots[0]!.requiredVwType).toBe(1) // position 0
      expect(songSlots[1]!.requiredVwType).toBe(2) // position 2
      expect(songSlots[2]!.requiredVwType).toBe(2) // position 5
      expect(songSlots[3]!.requiredVwType).toBe(3) // position 6
      expect(songSlots[4]!.requiredVwType).toBe(3) // position 8
    })

    it('createService 1-2-3-3: song slots get correct VW types', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.createService({
        date: '2026-03-15',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as Array<{ kind: string; position: number; requiredVwType?: number }>

      const songSlots = slots.filter((s) => s.kind === 'SONG')
      expect(songSlots[0]!.requiredVwType).toBe(1)
      expect(songSlots[1]!.requiredVwType).toBe(2)
      expect(songSlots[2]!.requiredVwType).toBe(2)
      expect(songSlots[3]!.requiredVwType).toBe(3)
      expect(songSlots[4]!.requiredVwType).toBe(3)
    })

    it('createService sets status to draft', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.status).toBe('draft')
    })

    it('createService returns the new document id', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const id = await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      expect(id).toBe('new-service-id')
    })
  })

  describe('updateService', () => {
    it('calls updateDoc with serverTimestamp for updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.updateService('service-1', { notes: 'Updated notes' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.notes).toBe('Updated notes')
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })
  })

  describe('deleteService', () => {
    it('calls deleteDoc with the correct doc reference', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.deleteService('service-1')

      expect(deleteDoc).toHaveBeenCalledOnce()
    })
  })

  describe('assignSongToSlot', () => {
    it('calls updateService with updated slots when assigning a song', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      // Set up a service in the store with slots
      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
        { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null },
        { kind: 'SONG', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'PRAYER', position: 3 },
        { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
        { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
        { kind: 'MESSAGE', position: 7 },
        { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
      ]
      triggerSnapshot([makeService({ id: 'service-1', slots })])

      await store.assignSongToSlot('service-1', 0, {
        id: 'song-abc',
        title: 'Amazing Grace',
        key: 'G',
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      const updatedSlots = data.slots as Array<{ kind: string; position: number; songId?: string; songTitle?: string; songKey?: string }>
      const slot0 = updatedSlots.find((s) => s.position === 0)
      expect(slot0?.songId).toBe('song-abc')
      expect(slot0?.songTitle).toBe('Amazing Grace')
      expect(slot0?.songKey).toBe('G')
    })

    it('calls useSongStore().updateSong with lastUsedAt serverTimestamp (cross-store link)', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
      ]
      triggerSnapshot([makeService({ id: 'service-1', slots })])

      await store.assignSongToSlot('service-1', 0, {
        id: 'song-abc',
        title: 'Amazing Grace',
        key: 'G',
      })

      expect(mockUpdateSong).toHaveBeenCalledOnce()
      const [songId, data] = mockUpdateSong.mock.calls[0] as unknown as [string, Record<string, unknown>]
      expect(songId).toBe('song-abc')
      expect((data as Record<string, unknown>).lastUsedAt).toBeDefined()
    })
  })

  describe('clearSongFromSlot', () => {
    it('calls updateService with null fields on the target slot', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-abc', songTitle: 'Amazing Grace', songKey: 'G' },
      ]
      triggerSnapshot([makeService({ id: 'service-1', slots })])

      await store.clearSongFromSlot('service-1', 0)

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      const updatedSlots = data.slots as Array<{ kind: string; position: number; songId?: null; songTitle?: null; songKey?: null }>
      const slot0 = updatedSlots.find((s) => s.position === 0)
      expect(slot0?.songId).toBeNull()
      expect(slot0?.songTitle).toBeNull()
      expect(slot0?.songKey).toBeNull()
    })
  })

  describe('createShareToken', () => {
    it('createShareToken returns a 36-character hex string', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      const token = await store.createShareToken(service, 'org-1')

      expect(token).toHaveLength(36)
      expect(token).toMatch(/^[0-9a-f]{36}$/)
    })

    it('createShareToken calls setDoc with token as document ID', async () => {
      const { setDoc, doc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      const token = await store.createShareToken(service, 'org-1')

      expect(setDoc).toHaveBeenCalledOnce()
      const [docRef, data] = vi.mocked(setDoc).mock.calls[0]!
      expect((docRef as { id: string }).id).toBe(token)
      const writeData = data as Record<string, unknown>
      expect(writeData.serviceId).toBe(service.id)
      expect(writeData.orgId).toBe('org-1')
      expect(writeData.serviceSnapshot).toBeDefined()
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      expect(snapshot.date).toBe(service.date)
      expect(snapshot.notes).toBe(service.notes)
    })

    it('createShareToken embeds BPM from song store into song slots', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-abc', songTitle: 'Amazing Grace', songKey: 'G' },
      ]
      const service = makeService({ slots }) as unknown as Service
      await store.createShareToken(service, 'org-1')

      expect(setDoc).toHaveBeenCalledOnce()
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const writeData = data as Record<string, unknown>
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      const snapshotSlots = snapshot.slots as Array<{ kind: string; position: number; bpm?: number | null }>
      const songSlot = snapshotSlots.find((s) => s.position === 0)
      expect(songSlot?.bpm).toBe(120)
    })
  })
})
