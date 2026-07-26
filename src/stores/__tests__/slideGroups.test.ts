import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

let snapshotCallback:
  | ((snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void)
  | null = null
const mockUnsubscribe = vi.fn()

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      id: segments[segments.length - 1] ?? 'mock-id',
      path: segments.join('/'),
    })),
    onSnapshot: vi.fn(
      (
        _query: unknown,
        callback: (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void,
      ) => {
        snapshotCallback = callback
        return mockUnsubscribe
      },
    ),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => false,
        id: 'mock-id',
        data: () => undefined,
      }),
    ),
    query: vi.fn((ref: unknown) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
    deleteField: vi.fn(() => '__deleteField__'),
  }
})

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

function makeGroupDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slot-1',
    serviceId: 'service-1',
    slotId: 'slot-1',
    slides: [],
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerSnapshot(docs: ReturnType<typeof makeGroupDoc>[]) {
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

describe('useSlideGroups', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
  })

  describe('initial state', () => {
    it('starts with empty groups array', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      expect(store.groups).toEqual([])
    })

    it('starts with isLoading true', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      expect(store.isLoading).toBe(true)
    })
  })

  describe('subscribeGroups', () => {
    it('queries the organizations/{orgId}/slideGroups collection', async () => {
      const { collection } = await import('firebase/firestore')
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'organizations', 'org-1', 'slideGroups')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('calling subscribeGroups again unsubscribes the previous listener first', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      store.subscribeGroups('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })
  })

  describe('unsubscribeGroups', () => {
    it('calls the unsubscribe fn, empties groups, and resets isLoading to true', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      triggerSnapshot([makeGroupDoc()])
      expect(store.groups).toHaveLength(1)

      store.unsubscribeGroups()

      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.groups).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('is safe to call when no subscription is active', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      expect(() => store.unsubscribeGroups()).not.toThrow()
    })
  })

  describe('groupsBySlotId', () => {
    it('maps each group slotId to the group', async () => {
      const { useSlideGroups } = await import('../slideGroups')
      const store = useSlideGroups()
      store.subscribeGroups('org-1')
      triggerSnapshot([
        makeGroupDoc({ id: 'slot-a', slotId: 'slot-a' }),
        makeGroupDoc({ id: 'slot-b', slotId: 'slot-b' }),
      ])
      expect(store.groupsBySlotId.size).toBe(2)
      expect(store.groupsBySlotId.get('slot-a')?.id).toBe('slot-a')
      expect(store.groupsBySlotId.get('slot-b')?.id).toBe('slot-b')
    })
  })
})
