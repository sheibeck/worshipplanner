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

// Mutable org doc fixture read by finalizeAndShare's slug resolution (Plan 16-09) — tests
// override the shape per-case; reset to a slug-less default in beforeEach below.
let mockOrgDoc: Record<string, unknown> = { name: 'Test Org' }

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
    getDoc: vi.fn((docRef: { path?: string }) => {
      if (docRef?.path && /^organizations\/[^/]+$/.test(docRef.path)) {
        return Promise.resolve({
          exists: () => Object.keys(mockOrgDoc).length > 0,
          data: () => mockOrgDoc,
        })
      }
      return Promise.resolve({ exists: () => false, data: () => ({}) })
    }),
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
    mockOrgDoc = { name: 'Test Org' }
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

  describe('createQuarter (D-01, D-06)', () => {
    it('creates a quarter doc with generated Sundays and empty quarter-scoped maps when no people exist', async () => {
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

    it('seeds each (person, role) frequency to once/month default (N=4) when there is no prior quarter', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      mockRosterState.people = [makePerson({ id: 'person-a', roles: ['role-guitar'] })]

      await store.createQuarter(2026, 3, 'Q3 2026')

      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      const pqd = data.personQuarterData as Record<
        string,
        { roleFrequency: Record<string, unknown>; pairedWith: string[]; blackoutDates: string[] }
      >
      expect(pqd['person-a']!.roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 4 } })
      expect(pqd['person-a']!.pairedWith).toEqual([])
      expect(pqd['person-a']!.blackoutDates).toEqual([])
    })

    it('seeds per-role frequency and pairing from the chronologically prior quarter, always resetting blackout', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          id: 'quarter-q2',
          year: 2026,
          quarter: 2,
          personQuarterData: {
            'person-a': {
              personId: 'person-a',
              blackoutDates: ['2026-04-05'],
              pairedWith: ['person-b'],
              roleFrequency: { 'role-guitar': { tier: 'regular', n: 2 } },
            },
          },
        }),
      ])
      mockRosterState.people = [makePerson({ id: 'person-a', roles: ['role-guitar'] })]

      await store.createQuarter(2026, 3, 'Q3 2026')

      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      const pqd = data.personQuarterData as Record<
        string,
        { roleFrequency: Record<string, unknown>; pairedWith: string[]; blackoutDates: string[] }
      >
      expect(pqd['person-a']!.roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 2 } })
      expect(pqd['person-a']!.pairedWith).toEqual(['person-b'])
      expect(pqd['person-a']!.blackoutDates).toEqual([])
    })

    it('picks the chronologically nearest prior quarter, not just any earlier quarter', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          id: 'quarter-q1',
          year: 2026,
          quarter: 1,
          personQuarterData: {
            'person-a': {
              personId: 'person-a',
              blackoutDates: [],
              pairedWith: [],
              roleFrequency: { 'role-guitar': { tier: 'regular', n: 1 } },
            },
          },
        }),
        makeQuarterDoc({
          id: 'quarter-q2',
          year: 2026,
          quarter: 2,
          personQuarterData: {
            'person-a': {
              personId: 'person-a',
              blackoutDates: [],
              pairedWith: [],
              roleFrequency: { 'role-guitar': { tier: 'regular', n: 3 } },
            },
          },
        }),
      ])
      mockRosterState.people = [makePerson({ id: 'person-a', roles: ['role-guitar'] })]

      await store.createQuarter(2026, 3, 'Q3 2026')

      const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
      const pqd = data.personQuarterData as Record<string, { roleFrequency: Record<string, unknown> }>
      expect(pqd['person-a']!.roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 3 } })
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

    it('writes the per-role roleFrequency resolved from the CSV Frequency column onto the quarter entry (no standing frequency write, D-04/D-05)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc({ personQuarterData: {} })])

      await store.applyCsvToQuarter('quarter-1', [
        {
          personId: 'person-a',
          standing: { name: 'Person A', roles: ['role-guitar'] },
          blackoutDates: [],
          pairedWith: [],
          roleFrequency: { 'role-guitar': { tier: 'regular', n: 2 } },
        },
      ])

      expect(mockUpdatePerson).toHaveBeenCalledWith('person-a', { name: 'Person A', roles: ['role-guitar'] })
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      const pqd = data.personQuarterData as Record<string, { roleFrequency?: Record<string, unknown> }>
      expect(pqd['person-a']!.roleFrequency).toEqual({ 'role-guitar': { tier: 'regular', n: 2 } })
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

  describe('setPersonAvailability (D-03, D-04, D-05, D-06)', () => {
    function seedJuliaPairedWithLisa() {
      triggerQuartersSnapshot([
        makeQuarterDoc({
          personQuarterData: {
            julia: {
              personId: 'julia',
              blackoutDates: ['2026-07-05'],
              pairedWith: ['lisa'],
              roleFrequency: {},
              note: 'old note',
            },
            lisa: {
              personId: 'lisa',
              blackoutDates: [],
              pairedWith: ['julia'],
              roleFrequency: {},
              note: '',
            },
          },
        }),
      ])
    }

    it('writes the own entry under personQuarterData.{personId} with all four fields', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaPairedWithLisa()

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: {},
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['personQuarterData.julia']).toEqual({
        personId: 'julia',
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: {},
      })
      expect(data.updatedAt).toBeDefined()
    })

    it('reciprocally adds this person to a newly paired partner who did not previously list them', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaPairedWithLisa()

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: {},
      })

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      // dean had no prior entry — should be seeded whole with defaults and julia in pairedWith
      const deanEntry = data['personQuarterData.dean'] as
        | { pairedWith: string[] }
        | undefined
      const deanPairedPath = data['personQuarterData.dean.pairedWith'] as string[] | undefined
      const deanPairedWith = deanEntry?.pairedWith ?? deanPairedPath
      expect(deanPairedWith).toContain('julia')
    })

    it('reciprocally removes this person from a dropped partners pairedWith without touching other fields', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaPairedWithLisa()

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: {},
      })

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['personQuarterData.lisa.pairedWith']).toEqual([])
      // scoping: partner remove must only touch pairedWith, never rewrite lisa's whole entry
      expect(data['personQuarterData.lisa']).toBeUndefined()
    })

    it('never writes the bare personQuarterData map key', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaPairedWithLisa()

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: {},
      })

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data.personQuarterData).toBeUndefined()
    })

    it('persists roleFrequency inside the scoped personQuarterData.{personId} write, never as a bare root key (D-04/D-05)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaPairedWithLisa()

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: { vocals: { tier: 'out', n: 4 }, guitar: { tier: 'regular', n: 4 } },
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['personQuarterData.julia']).toEqual({
        personId: 'julia',
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: { vocals: { tier: 'out', n: 4 }, guitar: { tier: 'regular', n: 4 } },
      })
      expect(data.personQuarterData).toBeUndefined()
      // scoping: only julia's own write is affected — lisa's entry is untouched by this call
      // (pairing-diff writes are covered by the tests above; assert they still apply unchanged)
      expect(Object.keys(data)).not.toContain('personQuarterData')
    })

    // D-05 gap closure (15-07): the reciprocal 'added' write must not silently erase an
    // already-tuned partner's roleFrequency by reconstructing their whole PersonQuarterData.
    function seedJuliaAndDeanWithRoleFrequency() {
      triggerQuartersSnapshot([
        makeQuarterDoc({
          personQuarterData: {
            julia: {
              personId: 'julia',
              blackoutDates: [],
              pairedWith: [],
              roleFrequency: {},
              note: '',
            },
            dean: {
              personId: 'dean',
              blackoutDates: ['2026-07-12'],
              pairedWith: [],
              roleFrequency: { 'role-guitar': { tier: 'out', n: 4 } },
              note: 'dean note',
            },
          },
        }),
      ])
    }

    it('existing-entry reciprocal write uses a scoped pairedWith-only sub-path, preserving the partners tuned roleFrequency (D-05 gap closure)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaAndDeanWithRoleFrequency()

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: [],
        pairedWith: ['dean'],
        note: '',
        roleFrequency: {},
      })

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      // Scoped sub-path only — a whole-object replace here would silently drop dean's roleFrequency.
      expect(data['personQuarterData.dean.pairedWith']).toEqual(['julia'])
      expect(data['personQuarterData.dean']).toBeUndefined()
    })

    it('brand-new-partner reciprocal write seeds a complete PersonQuarterData entry with blackoutDates initialized, not a pairedWith-only partial (D-05 gap closure)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      seedJuliaPairedWithLisa() // dean is absent from personQuarterData entirely

      await store.setPersonAvailability('quarter-1', 'julia', {
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        note: 'x',
        roleFrequency: {},
      })

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(data['personQuarterData.dean']).toEqual({
        personId: 'dean',
        blackoutDates: [],
        pairedWith: ['julia'],
        roleFrequency: {},
        note: '',
      })
      // Must not be a partial pairedWith-only sub-path write — that would leave
      // blackoutDates undefined and crash downstream unguarded .blackoutDates.includes() reads.
      expect(data['personQuarterData.dean.pairedWith']).toBeUndefined()
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

    it('passes a roleGroupOf built from rosterStore.roles as the final arg (D-12 wiring)', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc()])
      mockRosterState.activePeople = [makePerson({ id: 'person-a' })]
      mockRosterState.roles = [
        makeRole({ id: 'role-sound', name: 'sound', group: 'tech' }),
        makeRole({ id: 'role-guitar', name: 'guitar', group: 'band' }),
      ]
      mockProposeQuarterSchedule.mockReturnValue({
        calendar: {},
        servedCounts: {},
        unfilled: [],
        pairingConflicts: [],
      })

      await store.generateProposal('quarter-1', 'regenerate')

      const args = mockProposeQuarterSchedule.mock.calls[0]!
      const roleGroupOf = args[5] as (roleId: string) => string
      expect(typeof roleGroupOf).toBe('function')
      expect(roleGroupOf('role-sound')).toBe('tech')
      expect(roleGroupOf('role-guitar')).toBe('band')
      expect(roleGroupOf('role-unknown')).toBe('other')
    })

    it('end-to-end: the real scheduler never double-assigns a TECH+BAND combo to the same person on one date (group rules engaged in production)', async () => {
      const { useQuartersStore } = await import('../quarters')
      const actualScheduler =
        await vi.importActual<typeof import('@/utils/scheduler')>('@/utils/scheduler')
      mockProposeQuarterSchedule.mockImplementation(actualScheduler.proposeQuarterSchedule)

      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({ serviceDates: ['2026-07-05'], calendar: {}, personQuarterData: {} }),
      ])
      // A single person eligible for both a TECH role and a BAND role — without roleGroupOf
      // wired in, the pre-15-04 scheduler would happily double-book them on the same date.
      mockRosterState.activePeople = [
        makePerson({ id: 'person-a', roles: ['role-sound', 'role-guitar'] }),
      ]
      mockRosterState.roles = [
        makeRole({ id: 'role-sound', name: 'sound', group: 'tech', order: 0 }),
        makeRole({ id: 'role-guitar', name: 'guitar', group: 'band', order: 1 }),
      ]

      const result = await store.generateProposal('quarter-1', 'regenerate')

      const dayAssignments = result.calendar['2026-07-05'] ?? {}
      const soundAssignees = dayAssignments['role-sound'] ?? []
      const guitarAssignees = dayAssignments['role-guitar'] ?? []
      // person-a can be in at most ONE of the two groups this date, never both.
      const inBoth = soundAssignees.includes('person-a') && guitarAssignees.includes('person-a')
      expect(inBoth).toBe(false)
      // Confirm the TECH slot won the greedy pass (deterministic — processed first by role.order)
      // and the BAND slot was left unfilled rather than illegally double-booking person-a.
      expect(soundAssignees).toEqual(['person-a'])
      expect(guitarAssignees).toEqual([])
      expect(result.unfilled).toContainEqual({ date: '2026-07-05', roleId: 'role-guitar' })
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

  describe('finalizeAndShare — public share token (D-21, D-24)', () => {
    it('generates a 36-char hex token via crypto.getRandomValues (Uint8Array(18))', async () => {
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc()])
      mockRosterState.people = []
      mockRosterState.roles = []

      const token = await store.finalizeAndShare('quarter-1')

      expect(token).toHaveLength(36)
      expect(token).toMatch(/^[0-9a-f]{36}$/)
      expect(crypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array))
      const calledArg = vi.mocked(crypto.getRandomValues).mock.calls[0]![0] as Uint8Array
      expect(calledArg.length).toBe(18)
    })

    it('writes shareTokens/{token} with a denormalized quarterSnapshot resolving person NAMES', async () => {
      const { setDoc, doc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          label: 'Q3 2026',
          serviceDates: ['2026-07-05'],
          calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } },
        }),
      ])
      mockRosterState.people = [makePerson({ id: 'person-a', name: 'Sarah Smith' })]
      mockRosterState.roles = [makeRole({ id: 'role-guitar', name: 'guitar' })]

      const token = await store.finalizeAndShare('quarter-1')

      const shareTokenCall = vi
        .mocked(setDoc)
        .mock.calls.find((call) => (call[0] as unknown as { path?: string }).path === `shareTokens/${token}`)
      expect(shareTokenCall).toBeDefined()
      const [docRef, data] = shareTokenCall!
      expect((docRef as unknown as { id: string }).id).toBe(token)
      const writeData = data as Record<string, unknown>
      expect(writeData.orgId).toBe('org-1')
      expect(writeData.quarterId).toBe('quarter-1')
      const snapshot = writeData.quarterSnapshot as Record<string, unknown>
      expect(snapshot.label).toBe('Q3 2026')
      const calendar = snapshot.calendar as Record<string, Record<string, string[]>>
      expect(calendar['2026-07-05']!['role-guitar']).toEqual(['Sarah Smith'])
      expect(doc).toHaveBeenCalled()
    })

    it('writes quarterShares/{slug}__qN-year overwritten-in-place, reusing the names-only snapshot (R-02, Pitfall 2)', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([
        makeQuarterDoc({
          quarter: 3,
          year: 2026,
          label: 'Q3 2026',
          serviceDates: ['2026-07-05'],
          calendar: { '2026-07-05': { 'role-guitar': ['person-a'] } },
        }),
      ])
      mockRosterState.people = [makePerson({ id: 'person-a', name: 'Sarah Smith' })]
      mockRosterState.roles = [makeRole({ id: 'role-guitar', name: 'guitar' })]
      mockOrgDoc = { name: 'Grace Church', slug: 'grace-church' }

      await store.finalizeAndShare('quarter-1')

      const shareCall = vi
        .mocked(setDoc)
        .mock.calls.find(
          (call) => (call[0] as unknown as { path?: string }).path === 'quarterShares/grace-church__q3-2026',
        )
      expect(shareCall).toBeDefined()
      const data = shareCall![1] as Record<string, unknown>
      expect(data.orgSlug).toBe('grace-church')
      const snapshot = data.quarterSnapshot as Record<string, unknown>
      expect(snapshot.label).toBe('Q3 2026')
      const calendar = snapshot.calendar as Record<string, Record<string, string[]>>
      expect(calendar['2026-07-05']!['role-guitar']).toEqual(['Sarah Smith'])
      // D-24: names-only — no email/phone anywhere in the written payload
      expect(JSON.stringify(data)).not.toMatch(/email|phone/i)
    })

    it('derives and claims a slug from the org name when unset, then persists it on the org doc', async () => {
      const { setDoc, updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc({ quarter: 1, year: 2027 })])
      mockRosterState.people = []
      mockRosterState.roles = []
      mockOrgDoc = { name: 'First Church' } // no slug yet

      await store.finalizeAndShare('quarter-1')

      const claimCall = vi
        .mocked(setDoc)
        .mock.calls.find((call) => (call[0] as unknown as { path?: string }).path === 'orgSlugs/first-church')
      expect(claimCall).toBeDefined()

      const persistCall = vi.mocked(updateDoc).mock.calls.find((call) => {
        const d = call[1] as unknown as Record<string, unknown>
        return d.slug === 'first-church'
      })
      expect(persistCall).toBeDefined()

      const shareCall = vi
        .mocked(setDoc)
        .mock.calls.find(
          (call) => (call[0] as unknown as { path?: string }).path === 'quarterShares/first-church__q1-2027',
        )
      expect(shareCall).toBeDefined()
    })

    it('sets the quarter status finalized + shareToken via updateDoc', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc()])
      mockRosterState.people = []
      mockRosterState.roles = []

      const token = await store.finalizeAndShare('quarter-1')

      const updateCall = vi.mocked(updateDoc).mock.calls.find((call) => {
        const d = call[1] as unknown as Record<string, unknown>
        return d.status === 'finalized'
      })
      expect(updateCall).toBeDefined()
      const data = updateCall![1] as unknown as Record<string, unknown>
      expect(data.status).toBe('finalized')
      expect(data.shareToken).toBe(token)
    })

    // WR-06 regression: an org name that derives to an empty slug (blank name, or a name
    // with no [a-z0-9] characters after lowercasing, e.g. non-Latin-script) must not throw
    // inside claimSlug — it must fall back to a generic base so the memorable-URL step
    // still succeeds instead of masking the already-succeeded opaque-token finalize.
    it('falls back to a generic slug base when the org name derives to an empty slug', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc({ quarter: 4, year: 2026 })])
      mockRosterState.people = []
      mockRosterState.roles = []
      // '日本語' has no [a-z0-9] characters after lowercasing — deriveSlug('日本語') === ''.
      mockOrgDoc = { name: '日本語' }

      const token = await store.finalizeAndShare('quarter-1')

      expect(token).toHaveLength(36)
      const claimCall = vi
        .mocked(setDoc)
        .mock.calls.find((call) => (call[0] as unknown as { path?: string }).path === 'orgSlugs/org')
      expect(claimCall).toBeDefined()
      const shareCall = vi
        .mocked(setDoc)
        .mock.calls.find(
          (call) => (call[0] as unknown as { path?: string }).path === 'quarterShares/org__q4-2026',
        )
      expect(shareCall).toBeDefined()
    })

    // WR-06 regression: by the time the memorable-URL slug/quarterShares write runs, the
    // opaque shareTokens doc and finalized status are already committed — a failure in this
    // step must be soft-failed (logged, swallowed), not surfaced as a thrown error that
    // would make callers believe the whole finalize failed.
    it('does not throw when the memorable-URL slug/quarterShares write fails — the opaque share token is still returned', async () => {
      const { setDoc, updateDoc } = await import('firebase/firestore')
      const { useQuartersStore } = await import('../quarters')
      const store = useQuartersStore()
      store.subscribe('org-1')
      triggerQuartersSnapshot([makeQuarterDoc({ quarter: 2, year: 2026 })])
      mockRosterState.people = []
      mockRosterState.roles = []
      mockOrgDoc = { name: 'Grace Church', slug: 'grace-church' }

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(setDoc).mockImplementation((ref: unknown) => {
        const path = (ref as { path?: string }).path ?? ''
        if (path.startsWith('quarterShares/')) {
          return Promise.reject(new Error('simulated write failure'))
        }
        return Promise.resolve()
      })

      let token: string | undefined
      let thrown: unknown
      try {
        token = await store.finalizeAndShare('quarter-1')
      } catch (err) {
        thrown = err
      }

      expect(thrown).toBeUndefined()
      expect(token).toHaveLength(36)
      // The opaque shareTokens write and finalized-status update already happened before the
      // memorable-URL step, and both must be unaffected by its later failure.
      const shareTokenCall = vi
        .mocked(setDoc)
        .mock.calls.find((call) => (call[0] as unknown as { path?: string }).path === `shareTokens/${token}`)
      expect(shareTokenCall).toBeDefined()
      const finalizedCall = vi.mocked(updateDoc).mock.calls.find((call) => {
        const d = call[1] as unknown as Record<string, unknown>
        return d.status === 'finalized'
      })
      expect(finalizedCall).toBeDefined()
      expect(consoleErrorSpy).toHaveBeenCalled()

      // Restore the default always-resolves implementation so later tests aren't affected —
      // vi.clearAllMocks() (in this file's beforeEach) clears call history but not overridden
      // implementations.
      vi.mocked(setDoc).mockImplementation(() => Promise.resolve())
      consoleErrorSpy.mockRestore()
    })

    it('never calls Planning Center write functions (D-21)', async () => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const filePath = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../quarters.ts')
      const source = fs.readFileSync(filePath, 'utf-8')
      expect(/planningCenterApi|addTeamToPlan|createPlan|createItem/.test(source)).toBe(false)
    })
  })
})
