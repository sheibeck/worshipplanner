import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Person, Role } from '@/types/roster'

// Mock crypto.getRandomValues for deterministic token generation (Task 3)
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
})

// Track onSnapshot callbacks per collection path
type SnapshotDoc = { id: string; data: () => Record<string, unknown> }
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
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-quarter-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
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

// Mock the pure scheduler so propose-bridge tests can assert call arguments directly
// (the scheduler's internal algorithm is already exhaustively covered by scheduler.test.ts).
const mockProposeQuarterSchedule = vi.fn()
vi.mock('@/utils/scheduler', () => ({
  proposeQuarterSchedule: (...args: unknown[]) => mockProposeQuarterSchedule(...args),
}))

// Mock the roster store — quarters.ts reads activePeople/roles/people and upserts standing fields.
const mockUpdatePerson = vi.fn(() => Promise.resolve())
const mockRosterState: { people: Person[]; activePeople: Person[]; roles: Role[] } = {
  people: [],
  activePeople: [],
  roles: [],
}
vi.mock('@/stores/roster', () => ({
  useRosterStore: vi.fn(() => ({
    get people() {
      return mockRosterState.people
    },
    get activePeople() {
      return mockRosterState.activePeople
    },
    get roles() {
      return mockRosterState.roles
    },
    updatePerson: mockUpdatePerson,
  })),
}))

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    name: 'Sarah Smith',
    email: 'sarah@example.com',
    phone: '',
    active: true,
    roles: [],
    frequencyTargetN: 4,
    pcPersonId: null,
    createdAt: { seconds: 1000000, nanoseconds: 0 } as never,
    updatedAt: { seconds: 1000000, nanoseconds: 0 } as never,
    ...overrides,
  }
}

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-guitar',
    name: 'guitar',
    group: 'band',
    defaultCount: 1,
    order: 0,
    ...overrides,
  }
}

function makeQuarterDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quarter-1',
    label: 'Q3 2026',
    year: 2026,
    quarter: 3,
    serviceDates: ['2026-07-05', '2026-07-12'],
    roleOverridesByDate: {},
    personQuarterData: {},
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

function triggerQuartersSnapshot(quarters: ReturnType<typeof makeQuarterDoc>[]) {
  const cb = snapshotCallbacks['organizations/org-1/quarters']
  if (cb) {
    cb({
      docs: quarters.map((q) => ({
        id: q.id,
        data: () => {
          const { id: _id, ...rest } = q
          return rest
        },
      })),
    })
  }
}

describe('useQuartersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    for (const key of Object.keys(snapshotCallbacks)) delete snapshotCallbacks[key]
    mockRosterState.people = []
    mockRosterState.activePeople = []
    mockRosterState.roles = []
  })

  describe('initial state', () => {
    it('starts with empty quarters array', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      expect(store.quarters).toEqual([])
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot ordered by createdAt desc on the org quarters collection', async () => {
      const { onSnapshot, orderBy } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalled()
      expect(snapshotCallbacks['organizations/org-1/quarters']).toBeDefined()
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc')
    })

    it('populates quarters from snapshot with { id, ...data } mapping', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc()])
      expect(store.quarters).toHaveLength(1)
      expect(store.quarters[0]!.id).toBe('quarter-1')
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc()])
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.quarters).toEqual([])
    })
  })

  describe('createQuarter (D-01)', () => {
    it('creates a quarter doc with generated Sundays and empty quarter-scoped maps', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const { generateSundaysInQuarter } = await import('@/utils/quarterDates')
      const store = useQuartersStore()
      store.subscribe('org-1')

      await store.createQuarter(2026, 3, 'Q3 2026')

      expect(addDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      expect(data.serviceDates).toEqual(generateSundaysInQuarter(2026, 3))
      expect(data.roleOverridesByDate).toEqual({})
      expect(data.personQuarterData).toEqual({})
      expect(data.calendar).toEqual({})
      expect(data.status).toBe('draft')
      expect(data.shareToken).toBeNull()
    })
  })

  describe('addServiceDate / removeServiceDate', () => {
    it('addServiceDate adds a sorted, de-duplicated date via updateDoc', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({ serviceDates: ['2026-07-05', '2026-07-12'] }),
      ])

      await store.addServiceDate('quarter-1', '2026-07-01')

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data.serviceDates).toEqual(['2026-07-01', '2026-07-05', '2026-07-12'])
    })

    it('removeServiceDate removes a date via updateDoc', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({ serviceDates: ['2026-07-05', '2026-07-12'] }),
      ])

      await store.removeServiceDate('quarter-1', '2026-07-05')

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data.serviceDates).toEqual(['2026-07-12'])
    })

    it('addServiceDate de-duplicates when the date already exists', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({ serviceDates: ['2026-07-05', '2026-07-12'] }),
      ])

      await store.addServiceDate('quarter-1', '2026-07-05')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data.serviceDates).toEqual(['2026-07-05', '2026-07-12'])
    })
  })

  describe('setRoleOverrideForDate (D-02)', () => {
    it('stores config under roleOverridesByDate[date] without disturbing other dates', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          roleOverridesByDate: {
            '2026-07-05': [{ roleId: 'role-guitar', count: 2 }],
          },
        }),
      ])

      await store.setRoleOverrideForDate('quarter-1', '2026-07-12', [{ roleId: 'role-drums', count: 1 }])

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const overrides = data.roleOverridesByDate as Record<string, unknown>
      expect(overrides['2026-07-05']).toEqual([{ roleId: 'role-guitar', count: 2 }])
      expect(overrides['2026-07-12']).toEqual([{ roleId: 'role-drums', count: 1 }])
    })
  })
})
