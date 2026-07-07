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

  describe('applyCsvToQuarter — per-person replace (D-19)', () => {
    it('replaces present persons personQuarterData wholesale and upserts standing fields', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          personQuarterData: {
            'person-a': { personId: 'person-a', blackoutDates: ['2026-07-05'], pairedWith: [] },
          },
        }),
      ])

      await store.applyCsvToQuarter('quarter-1', [
        {
          personId: 'person-a',
          standing: { name: 'Person A', roles: ['role-guitar'] },
          blackoutDates: ['2026-07-12'],
          pairedWith: [],
        },
      ])

      expect(mockUpdatePerson).toHaveBeenCalledWith('person-a', { name: 'Person A', roles: ['role-guitar'] })
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const pqd = data.personQuarterData as Record<string, { blackoutDates: string[] }>
      expect(pqd['person-a']!.blackoutDates).toEqual(['2026-07-12'])
    })

    it('leaves an absent persons personQuarterData entry unchanged', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          personQuarterData: {
            'person-c': { personId: 'person-c', blackoutDates: ['2026-07-19'], pairedWith: [] },
          },
        }),
      ])

      await store.applyCsvToQuarter('quarter-1', [
        {
          personId: 'person-a',
          standing: { name: 'Person A' },
          blackoutDates: [],
          pairedWith: [],
        },
      ])

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const pqd = data.personQuarterData as Record<string, { blackoutDates: string[] }>
      expect(pqd['person-c']).toEqual({ personId: 'person-c', blackoutDates: ['2026-07-19'], pairedWith: [] })
    })

    it('applies pairings bidirectionally', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc({ personQuarterData: {} })])

      await store.applyCsvToQuarter('quarter-1', [
        {
          personId: 'person-a',
          standing: { name: 'Person A' },
          blackoutDates: [],
          pairedWith: ['person-b'],
        },
      ])

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const pqd = data.personQuarterData as Record<string, { pairedWith: string[] }>
      expect(pqd['person-a']!.pairedWith).toEqual(['person-b'])
      expect(pqd['person-b']!.pairedWith).toEqual(['person-a'])
    })
  })

  describe('buildResolveRolesForDate', () => {
    it('returns per-date override when present, else default template in role.order order', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      const quarter = makeQuarterDoc({
        roleOverridesByDate: { '2026-07-05': [{ roleId: 'role-drums', count: 2 }] },
      }) as unknown as import('@/types/roster').Quarter
      const roles = [
        makeRole({ id: 'role-drums', order: 1, defaultCount: 1 }),
        makeRole({ id: 'role-guitar', order: 0, defaultCount: 1 }),
      ]

      const resolve = store.buildResolveRolesForDate(quarter, roles)

      expect(resolve('2026-07-05')).toEqual([{ roleId: 'role-drums', count: 2 }])
      expect(resolve('2026-07-12')).toEqual([
        { roleId: 'role-guitar', count: 1 },
        { roleId: 'role-drums', count: 1 },
      ])
    })
  })

  describe('generateProposal — propose→persist bridge', () => {
    it('regenerate calls proposeQuarterSchedule with existingCalendar undefined and persists result', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc({ calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } } })])
      mockRosterState.activePeople = [makePerson({ id: 'person-a' })]
      mockRosterState.roles = [makeRole()]
      mockProposeQuarterSchedule.mockReturnValue({
        calendar: { '2026-07-05': { 'role-guitar': ['person-b'] } },
        servedCounts: {},
        unfilled: [],
        pairingConflicts: [],
      })

      const result = await store.generateProposal('quarter-1', 'regenerate')

      expect(mockProposeQuarterSchedule).toHaveBeenCalledOnce()
      const args = mockProposeQuarterSchedule.mock.calls[0]!
      expect(args[4]).toBeUndefined()
      expect(result.calendar).toEqual({ '2026-07-05': { 'role-guitar': ['person-b'] } })
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data.calendar).toEqual({ '2026-07-05': { 'role-guitar': ['person-b'] } })
    })

    it('fillGaps passes the existing calendar as existingCalendar', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      const existingCalendar = { '2026-07-05': { 'role-guitar': ['person-a'] } }
      triggerQuartersSnapshot([makeQuarterDoc({ calendar: existingCalendar })])
      mockRosterState.activePeople = [makePerson({ id: 'person-a' })]
      mockRosterState.roles = [makeRole()]
      mockProposeQuarterSchedule.mockReturnValue({
        calendar: existingCalendar,
        servedCounts: {},
        unfilled: [],
        pairingConflicts: [],
      })

      await store.generateProposal('quarter-1', 'fillGaps')

      const args = mockProposeQuarterSchedule.mock.calls[0]!
      expect(args[4]).toEqual(existingCalendar)
    })
  })

  describe('cell edits — assign/clear/swap (D-22)', () => {
    it('assignPerson adds a personId to the target cell without duplication', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({ calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } } }),
      ])

      await store.assignPerson('quarter-1', '2026-07-05', 'role-guitar', 'person-b')

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['calendar.2026-07-05.role-guitar']).toEqual(['person-a', 'person-b'])
    })

    it('clearAssignment removes one personId from the target cell', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({ calendar: { '2026-07-05': { 'role-guitar': ['person-a', 'person-b'] } } }),
      ])

      await store.clearAssignment('quarter-1', '2026-07-05', 'role-guitar', 'person-a')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['calendar.2026-07-05.role-guitar']).toEqual(['person-b'])
    })

    it('swapAssignment replaces fromPersonId with toPersonId in that cell only', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          calendar: {
            '2026-07-05': { 'role-guitar': ['person-a'], 'role-drums': ['person-c'] },
          },
        }),
      ])

      await store.swapAssignment('quarter-1', '2026-07-05', 'role-guitar', 'person-a', 'person-d')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['calendar.2026-07-05.role-guitar']).toEqual(['person-d'])
      expect(data['calendar.2026-07-05.role-drums']).toBeUndefined()
    })
  })
})
