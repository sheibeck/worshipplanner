import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Track onSnapshot callbacks per collection path so the teams subscription
// can be triggered independently, mirroring roster.test.ts's harness.
type SnapshotDoc = { id: string; data: () => Record<string, unknown>; ref: { id: string; path: string } }
type SnapshotCallback = (snap: { docs: SnapshotDoc[] }) => void

const snapshotCallbacks: Record<string, SnapshotCallback> = {}
const mockUnsubscribe = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((queryRef, callback) => {
      const path = (queryRef as { path?: string }).path ?? 'unknown'
      snapshotCallbacks[path] = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
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

function makeTeam(overrides: Partial<{
  id: string
  name: string
  order: number
}> = {}) {
  return {
    id: 'team-1',
    name: 'Choir',
    order: 0,
    ...overrides,
  }
}

function triggerTeamsSnapshot(teams: ReturnType<typeof makeTeam>[]) {
  const cb = snapshotCallbacks['organizations/org-1/teams']
  if (cb) {
    cb({
      docs: teams.map((t) => ({
        id: t.id,
        data: () => {
          const { id: _id, ...rest } = t
          return rest
        },
        ref: { id: t.id, path: `organizations/org-1/teams/${t.id}` },
      })),
    })
  }
}

describe('useTeamsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    for (const key of Object.keys(snapshotCallbacks)) delete snapshotCallbacks[key]
  })

  describe('initial state', () => {
    it('starts with empty teams array', async () => {
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      expect(store.teams).toEqual([])
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot on the org teams collection ordered by "order"', async () => {
      const { onSnapshot, orderBy } = await import('firebase/firestore')
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalled()
      expect(snapshotCallbacks['organizations/org-1/teams']).toBeDefined()
      expect(orderBy).toHaveBeenCalledWith('order')
    })

    it('populates teams from snapshot with { id, ...data } mapping, ordered by "order"', async () => {
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')
      triggerTeamsSnapshot([
        makeTeam({ id: 'team-1', name: 'Choir', order: 0 }),
        makeTeam({ id: 'team-2', name: 'Orchestra', order: 1 }),
      ])
      expect(store.teams).toHaveLength(2)
      expect(store.teams[0]!.id).toBe('team-1')
      expect(store.teams[0]!.name).toBe('Choir')
      expect(store.teams[1]!.name).toBe('Orchestra')
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')
      triggerTeamsSnapshot([makeTeam()])
      expect(store.teams).toHaveLength(1)
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.teams).toEqual([])
    })

    it('calling subscribe again unsubscribes the previous listener first', async () => {
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')
      store.subscribe('org-2')
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('seedDefaultTeamsIfEmpty (R228, RESEARCH Pitfall 4 — byte-match today\'s list)', () => {
    it('writes exactly 4 default teams (Choir/Orchestra/Communion/Special, order 0-3) when the org has zero teams', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')
      triggerTeamsSnapshot([])

      await store.seedDefaultTeamsIfEmpty()

      expect(addDoc).toHaveBeenCalledTimes(4)
      const written = vi.mocked(addDoc).mock.calls.map((call) => call[1] as Record<string, unknown>)
      expect(written.map((w) => w.name)).toEqual(['Choir', 'Orchestra', 'Communion', 'Special'])
      expect(written.map((w) => w.order)).toEqual([0, 1, 2, 3])
      for (const w of written) {
        expect(w.createdAt).toBeDefined()
        expect(w.updatedAt).toBeDefined()
      }
    })

    it('writes nothing when teams already exist (idempotent, never clobbers)', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')
      triggerTeamsSnapshot([makeTeam({ id: 'existing-team', name: 'Custom Team' })])

      await store.seedDefaultTeamsIfEmpty()

      expect(addDoc).not.toHaveBeenCalled()
    })
  })

  describe('addTeam / updateTeam / deleteTeam CRUD', () => {
    it('addTeam calls addDoc with the given shape + timestamps', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')

      await store.addTeam({ name: 'Youth', order: 4 })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.name).toBe('Youth')
      expect(data.order).toBe(4)
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    it('updateTeam calls updateDoc with serverTimestamp for updatedAt', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')

      await store.updateTeam('team-1', { name: 'Renamed Team' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.name).toBe('Renamed Team')
      expect(data.updatedAt).toBeDefined()
    })

    it('deleteTeam calls deleteDoc (hard delete of team config doc)', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { useTeamsStore } = await import('../teams')
      const store = useTeamsStore()
      store.subscribe('org-1')

      await store.deleteTeam('team-1')

      expect(deleteDoc).toHaveBeenCalledOnce()
    })
  })
})
