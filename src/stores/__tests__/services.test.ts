import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'

// Mock crypto.getRandomValues for deterministic token generation, and
// crypto.randomUUID (Phase 24, D-01) so createSlot()/buildSlots()'s slot-id
// minting doesn't throw "crypto.randomUUID is not a function" now that
// createService's buildSlots() call requires it.
let uuidCounter = 0
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
  randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
})

// Track onSnapshot callbacks and unsubscribe fns
type SnapshotDoc = { id: string; data: () => Record<string, unknown>; metadata?: { hasPendingWrites: boolean } }
let snapshotCallback: ((snap: { docs: SnapshotDoc[] }) => void) | null = null
let snapshotOptions: { includeMetadataChanges?: boolean } | undefined
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    // R039 (32-01): widened to accept BOTH the pre-existing two-argument
    // form (query, callback) and the new three-argument form
    // (query, options, callback) — whichever of argument 2/3 is a function
    // is the real callback, so every existing call site in this file keeps
    // working unmodified.
    onSnapshot: vi.fn(
      (
        _query: unknown,
        optionsOrCallback: unknown,
        maybeCallback?: (snap: { docs: SnapshotDoc[] }) => void,
      ) => {
        if (typeof optionsOrCallback === 'function') {
          snapshotOptions = undefined
          snapshotCallback = optionsOrCallback as (snap: { docs: SnapshotDoc[] }) => void
        } else {
          snapshotOptions = optionsOrCallback as { includeMetadataChanges?: boolean } | undefined
          snapshotCallback = maybeCallback ?? null
        }
        return mockUnsubscribe
      },
    ),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-service-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({ name: 'Grace Church', slug: 'grace-church' }),
      }),
    ),
    setDoc: vi.fn(() => Promise.resolve()),
    deleteField: vi.fn(() => '__DELETE_FIELD_SENTINEL__'),
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

// Mock useRosterStore — people (for name resolution) + roles (for resolveServiceRoleAssignments)
vi.mock('@/stores/roster', () => ({
  useRosterStore: vi.fn(() => ({
    people: [
      { id: 'person-1', name: 'Alice Smith', email: 'alice@example.com', phone: '555-1234' },
      { id: 'person-2', name: 'Bob Jones', email: 'bob@example.com', phone: '555-5678' },
    ],
    roles: [
      { id: 'role-guitar', name: 'Guitar', group: 'band', defaultCount: 1, order: 1 },
      { id: 'role-sound', name: 'Sound', group: 'tech', defaultCount: 1, order: 2 },
    ],
  })),
}))

// Mock useQuartersStore — quarters array consumed by resolveServiceRoleAssignments
vi.mock('@/stores/quarters', () => ({
  useQuartersStore: vi.fn(() => ({
    quarters: [
      {
        id: 'quarter-1',
        serviceDates: ['2026-03-08'],
        calendar: {
          '2026-03-08': {
            'role-guitar': ['person-1'],
            'role-sound': ['person-2'],
          },
        },
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
  status: 'draft' | 'planned' | 'exported'
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
    status: 'draft' as 'draft' | 'planned' | 'exported',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

// R039 (32-01): `pendingIds` names which of `services`' ids this emission
// reports as `metadata.hasPendingWrites === true` — omitted/empty means
// every doc in this snapshot reports no pending write (the everyday case
// every pre-32-01 test below already exercises).
function triggerSnapshot(services: ReturnType<typeof makeService>[], pendingIds: string[] = []) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: services.map((s) => ({
        id: s.id,
        data: () => {
          const { id: _id, ...rest } = s
          return rest
        },
        metadata: { hasPendingWrites: pendingIds.includes(s.id) },
      })),
    })
  }
}

describe('useServiceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
    snapshotOptions = undefined
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

    // ── R039 (32-01): own-write echo classification ─────────────────────────

    it('subscribes with includeMetadataChanges: true — without it, the settle edge never reaches this callback', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      expect(snapshotOptions).toEqual({ includeMetadataChanges: true })
    })

    it('a snapshot reporting a pending write puts that doc id in ownWriteEchoIds and isOwnWriteEcho', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1'])
      expect(store.ownWriteEchoIds).toEqual(['service-1'])
      expect(store.isOwnWriteEcho('service-1')).toBe(true)
    })

    it('the following snapshot with no pending write for that doc STILL classifies it as an echo (the settle edge)', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1'])
      expect(store.isOwnWriteEcho('service-1')).toBe(true)

      // Server-ack snapshot: no longer pending. This is the emission whose
      // resolved serverTimestamp() value is what defeats a naive updatedAt
      // diff — it must classify as an echo too, or only half the window closes.
      triggerSnapshot([makeService()], [])
      expect(store.ownWriteEchoIds).toEqual(['service-1'])
      expect(store.isOwnWriteEcho('service-1')).toBe(true)
    })

    it('a third snapshot with no pending writes anywhere leaves ownWriteEchoIds empty — a genuinely external change is not misclassified', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1']) // optimistic edge
      triggerSnapshot([makeService()], []) // settle edge — still an echo
      expect(store.isOwnWriteEcho('service-1')).toBe(true)

      // A later, unrelated snapshot — nothing pending anywhere.
      triggerSnapshot([makeService()], [])
      expect(store.ownWriteEchoIds).toEqual([])
      expect(store.isOwnWriteEcho('service-1')).toBe(false)
    })

    it('unsubscribeAll empties ownWriteEchoIds', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1'])
      expect(store.ownWriteEchoIds).toEqual(['service-1'])
      store.unsubscribeAll()
      expect(store.ownWriteEchoIds).toEqual([])
    })

    // ── WR-02 (32-REVIEW): the multi-document case ───────────────────────────
    //
    // Every test above exercises exactly one document. These prove the
    // pending/settle-edge computation is derived independently per document,
    // never cross-contaminated, for the two shapes the review specifically
    // flagged as needing coverage.

    it('two documents whose own-writes overlap and settle on different snapshots are each classified independently', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const svcA = makeService({ id: 'service-a' })
      const svcB = makeService({ id: 'service-b' })

      // Both writes go pending in the same snapshot.
      triggerSnapshot([svcA, svcB], ['service-a', 'service-b'])
      expect(store.ownWriteEchoIds.sort()).toEqual(['service-a', 'service-b'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true)
      expect(store.isOwnWriteEcho('service-b')).toBe(true)

      // A settles first — B is still pending. A's settle edge must not leak
      // onto B, and B's continued pending state must not be lost.
      triggerSnapshot([svcA, svcB], ['service-b'])
      expect(store.ownWriteEchoIds.sort()).toEqual(['service-a', 'service-b'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true) // settle edge
      expect(store.isOwnWriteEcho('service-b')).toBe(true) // still pending

      // B settles on the NEXT snapshot, one full emission after A. A is no
      // longer anywhere near pending/settling — it must drop out cleanly,
      // proving the settle edge doesn't linger past its own single emission.
      triggerSnapshot([svcA, svcB], [])
      expect(store.ownWriteEchoIds).toEqual(['service-b']) // B's settle edge only
      expect(store.isOwnWriteEcho('service-a')).toBe(false)
      expect(store.isOwnWriteEcho('service-b')).toBe(true)
    })

    it('a snapshot mixing one document\'s settle edge with a second, genuinely external document\'s change classifies only the settling one as an echo', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const svcA = makeService({ id: 'service-a', name: 'A original' })
      const svcB = makeService({ id: 'service-b', name: 'B original' })

      // Only A has an own write in flight.
      triggerSnapshot([svcA, svcB], ['service-a'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true)
      expect(store.isOwnWriteEcho('service-b')).toBe(false)

      // A's write settles in the SAME emission that a different writer's
      // genuinely external change to B arrives — B is never pending here at
      // all, so it must never be misclassified as an echo despite the
      // simultaneous settle edge on A.
      const svcBExternallyChanged = makeService({ id: 'service-b', name: 'B changed by another editor' })
      triggerSnapshot([svcA, svcBExternallyChanged], [])
      expect(store.ownWriteEchoIds).toEqual(['service-a'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true)
      expect(store.isOwnWriteEcho('service-b')).toBe(false)
      expect(store.services.find((s) => s.id === 'service-b')?.name).toBe('B changed by another editor')
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

  describe('setRoleOverride', () => {
    it('writes only the scoped roleAssignmentOverrides.{roleId} dot-path key, plus updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.setRoleOverride('service-1', 'role-guitar', ['person-1', 'person-2'])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data['roleAssignmentOverrides.role-guitar']).toEqual(['person-1', 'person-2'])
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
      // Exactly the one scoped key + updatedAt — never the bare whole-map key.
      expect(Object.keys(data).sort()).toEqual(['roleAssignmentOverrides.role-guitar', 'updatedAt'])
      expect(data.roleAssignmentOverrides).toBeUndefined()
    })

    it('no-ops when orgId is unset', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      // No subscribe() call — orgId stays null.

      await store.setRoleOverride('service-1', 'role-guitar', ['person-1'])

      expect(updateDoc).not.toHaveBeenCalled()
    })
  })

  describe('clearRoleOverride', () => {
    it('sets the single scoped roleId key to the deleteField sentinel, leaving sibling keys untouched', async () => {
      const { updateDoc, deleteField, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.clearRoleOverride('service-1', 'role-guitar')

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(deleteField).toHaveBeenCalled()
      expect(data['roleAssignmentOverrides.role-guitar']).toBe('__DELETE_FIELD_SENTINEL__')
      expect(serverTimestamp).toHaveBeenCalled()
      expect(Object.keys(data).sort()).toEqual(['roleAssignmentOverrides.role-guitar', 'updatedAt'])
    })

    it('no-ops when orgId is unset', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()

      await store.clearRoleOverride('service-1', 'role-guitar')

      expect(updateDoc).not.toHaveBeenCalled()
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

      // createShareToken now also writes the serviceShares memorable-URL doc
      // (Phase 17 Plan 03) — the opaque shareTokens/{token} write is still first.
      expect(setDoc).toHaveBeenCalledTimes(2)
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

      // createShareToken now also writes the serviceShares memorable-URL doc
      // (Phase 17 Plan 03) — the opaque shareTokens/{token} write is still first.
      expect(setDoc).toHaveBeenCalledTimes(2)
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const writeData = data as Record<string, unknown>
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      const snapshotSlots = snapshot.slots as Array<{ kind: string; position: number; bpm?: number | null }>
      const songSlot = snapshotSlots.find((s) => s.position === 0)
      expect(songSlot?.bpm).toBe(120)
    })

    it('embeds roleAssignments with names-only personNames, resolved from resolveServiceRoleAssignments', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      await store.createShareToken(service, 'org-1')

      // First setDoc call is the opaque shareTokens/{token} write.
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const writeData = data as Record<string, unknown>
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      const roleAssignments = snapshot.roleAssignments as Array<{
        roleId: string
        roleName: string
        group: string
        personNames: string[]
      }>
      expect(roleAssignments).toBeDefined()
      const guitar = roleAssignments.find((r) => r.roleId === 'role-guitar')
      const sound = roleAssignments.find((r) => r.roleId === 'role-sound')
      expect(guitar?.personNames).toEqual(['Alice Smith'])
      expect(sound?.personNames).toEqual(['Bob Jones'])
    })

    it('written payload contains no email/phone/pcPersonId keys anywhere (PII guard)', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      await store.createShareToken(service, 'org-1')

      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const serialized = JSON.stringify(data)
      expect(serialized).not.toMatch(/email/i)
      expect(serialized).not.toMatch(/phone/i)
      expect(serialized).not.toMatch(/pcPersonId/i)
    })

    it('writes a memorable-URL serviceShares/{slug}__service-{date} doc after the opaque token write', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      await store.createShareToken(service, 'org-1')

      expect(setDoc).toHaveBeenCalledTimes(2)
      const [docRef, data] = vi.mocked(setDoc).mock.calls[1]!
      expect((docRef as { path: string }).path).toContain('serviceShares')
      const writeData = data as Record<string, unknown>
      expect(writeData.orgId).toBe('org-1')
      expect(writeData.orgSlug).toBe('grace-church')
      expect(writeData.token).toBeDefined()
      expect(writeData.serviceSnapshot).toBeDefined()
    })

    it('soft-fails: still returns the token when the serviceShares write rejects', async () => {
      const { setDoc } = await import('firebase/firestore')
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.resolve()) // shareTokens write succeeds
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.reject(new Error('serviceShares write failed')))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      const token = await store.createShareToken(service, 'org-1')

      expect(token).toHaveLength(36)
      expect(token).toMatch(/^[0-9a-f]{36}$/)
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  // ── R036 / R037 — the store's draft-only write guard + status transitions ────
  //
  // Layer 2 of 3. These assertions deliberately mirror the `/services`
  // `allow update` clause in firestore.rules shape-for-shape: the guard exists
  // to make a client-side bug legible locally, so if it ever drifts from the
  // rule it becomes either a phantom lock or an opaque round-trip failure.
  //
  // Every "refused" case asserts `updateDoc` was NOT called, not merely that
  // the promise rejected — a guard that throws AFTER writing is no guard.
  describe('draft-only write guard (R036)', () => {
    async function storeAtStatus(status: 'draft' | 'planned' | 'exported', extra = {}) {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ status, ...extra })])
      return store
    }

    it('allows an ordinary update while the stored status is draft', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('draft')

      await store.updateService('service-1', { notes: 'edited' })

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    for (const status of ['planned', 'exported'] as const) {
      it(`refuses an ordinary update locally when the stored status is ${status}`, async () => {
        const { updateDoc } = await import('firebase/firestore')
        const store = await storeAtStatus(status)

        await expect(store.updateService('service-1', { notes: 'edited' })).rejects.toThrow(
          /R036/,
        )
        expect(updateDoc).not.toHaveBeenCalled()
      })
    }

    // The status is read from the STORED snapshot, never from the payload —
    // otherwise any write that also sets `status: 'draft'` would edit a locked
    // service, which is precisely the payload an attacker would send. The
    // reopen carve-out is why `{ status: 'draft' }` ALONE is allowed; adding a
    // second key must not inherit that permission.
    it('refuses a locked update that smuggles other fields alongside status: draft', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await expect(
        store.updateService('service-1', { status: 'draft', slots: [] }),
      ).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('allows the reopen-shaped update (status alone) at planned and exported', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await store.updateService('service-1', { status: 'draft' })

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    // ★ D-09 — if this ever fails, `exported` has become unreachable and the
    // primary Planning Center workflow is broken.
    it('allows the Planning Center export write from planned (D-09)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('planned')

      await store.updateService('service-1', {
        pcExportedAt: { seconds: 1, nanoseconds: 0 },
        pcPlanId: 'plan-1',
        status: 'exported',
      })

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    it('refuses an export-shaped write from an already-exported service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await expect(
        store.updateService('service-1', {
          pcExportedAt: { seconds: 1, nanoseconds: 0 },
          pcPlanId: 'plan-2',
          status: 'exported',
        }),
      ).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    // D-15 — delete stays available at every status; the UI warns instead.
    // Keep in step with firestore.rules' unconditional `allow delete`.
    for (const status of ['draft', 'planned', 'exported'] as const) {
      it(`allows delete while the stored status is ${status} (D-15)`, async () => {
        const { deleteDoc } = await import('firebase/firestore')
        const store = await storeAtStatus(status)

        await store.deleteService('service-1')

        expect(deleteDoc).toHaveBeenCalledOnce()
      })
    }

    // ★ The Roles tab does not go through updateService. Without these two the
    // store layer does not cover it at all.
    it('refuses setRoleOverride on a locked service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('planned')

      await expect(store.setRoleOverride('service-1', 'role-1', ['p1'])).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('refuses clearRoleOverride on a locked service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await expect(store.clearRoleOverride('service-1', 'role-1')).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('still allows setRoleOverride and clearRoleOverride on a draft service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('draft')

      await store.setRoleOverride('service-1', 'role-1', ['p1'])
      await store.clearRoleOverride('service-1', 'role-1')

      expect(updateDoc).toHaveBeenCalledTimes(2)
    })
  })

  describe('status transitions (R037)', () => {
    async function storeAtStatus(status: 'draft' | 'planned' | 'exported', extra = {}) {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ status, ...extra })])
      return store
    }

    it('markAsPlanned writes status and updatedAt, and nothing else', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('draft')

      await store.markAsPlanned('service-1')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(Object.keys(data).sort()).toEqual(['status', 'updatedAt'])
      expect(data.status).toBe('planned')
    })

    for (const status of ['planned', 'exported'] as const) {
      it(`markAsPlanned refuses when the stored status is already ${status}`, async () => {
        const { updateDoc } = await import('firebase/firestore')
        const store = await storeAtStatus(status)

        await expect(store.markAsPlanned('service-1')).rejects.toThrow(/R036/)
        expect(updateDoc).not.toHaveBeenCalled()
      })
    }

    // ★ D-11 — the rule's hasOnly(['status','updatedAt']) reads affectedKeys().
    // Re-writing pcExportedAt/pcPlanId here, even to their existing values, can
    // surface in that diff and get the whole reopen denied. The fields survive
    // by being left alone, which is also what keeps the Planning Center plan
    // linked for a re-export and what D-04's evidence gate reads on a SECOND
    // reopen. This test is the guard against a future "let's also clear the
    // export fields" edit.
    it('reopenService writes ONLY status and updatedAt — never pcExportedAt/pcPlanId', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported', {
        pcExportedAt: { seconds: 5, nanoseconds: 0 },
        pcPlanId: 'plan-9',
      })

      await store.reopenService('service-1')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(Object.keys(data).sort()).toEqual(['status', 'updatedAt'])
      expect(data.status).toBe('draft')
      expect(data).not.toHaveProperty('pcExportedAt')
      expect(data).not.toHaveProperty('pcPlanId')
    })

    it('reopenService works from planned as well as exported', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('planned')

      await store.reopenService('service-1')

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    it('there is no generic status setter on the store (D-03)', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      // `exported` must be reachable ONLY through a real Planning Center
      // export. A setStatus/toggleStatus escape hatch would re-admit the
      // hand-set "Exported" defect D-01 deletes.
      expect(store).not.toHaveProperty('setStatus')
      expect(store).not.toHaveProperty('toggleStatus')
    })
  })
})
