import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// R442 (ADR-0245): createService writes rehearsals [] and still copies
// reportTimeDefault once at creation (copy-not-live-bind).

let uuidCounter = 0
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
  randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
})

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
  doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
  onSnapshot: vi.fn(() => vi.fn()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-service-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteField: vi.fn(),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  limit: vi.fn((n: number) => ({ limit: n })),
  runTransaction: vi.fn(async (_db: unknown, updateFunction: (tx: unknown) => unknown) =>
    updateFunction({ get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() }),
  ),
  serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  Timestamp: { fromMillis: vi.fn() },
}))

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))

vi.mock('@/stores/songs', () => ({ useSongStore: vi.fn(() => ({ songs: [] })) }))
vi.mock('@/stores/roster', () => ({ useRosterStore: vi.fn(() => ({ people: [], roles: [] })) }))
vi.mock('@/stores/quarters', () => ({ useQuartersStore: vi.fn(() => ({ quarters: [] })) }))

const mockAuthState = reactive<{
  orgName: string | null
  settings: {
    aiEnabled: boolean
    pcEnabled: boolean
    vwModeEnabled: boolean
    defaultServiceTemplate: unknown[]
    rehearsalTimeDefaults: string[]
    reportTimeDefault: string
  }
}>({
  orgName: 'Grace Church',
  settings: {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    defaultServiceTemplate: [],
    rehearsalTimeDefaults: [],
    reportTimeDefault: '',
  },
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

describe('createService — no seeded rehearsals, report-time copy (R442)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuthState.settings.rehearsalTimeDefaults = []
    mockAuthState.settings.reportTimeDefault = ''
  })

  it('R442: with org default times, createService writes rehearsals [] and copies reportTime', async () => {
    const { addDoc } = await import('firebase/firestore')
    mockAuthState.settings.rehearsalTimeDefaults = ['18:30', '19:00']
    mockAuthState.settings.reportTimeDefault = '08:00'

    const { useServiceStore } = await import('../services')
    const store = useServiceStore()
    store.subscribe('org-1')

    await store.createService({ date: '2026-09-13', name: '', teams: [] })

    const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
    const rehearsals = data.rehearsals as Array<{ id: string; date: string; time: string }>
    expect(rehearsals).toEqual([])
    expect(data.reportTime).toBe('08:00')
  })

  it('R442: copy-not-live-bind: mutating org defaults AFTER createService leaves the already-created service byte-identical', async () => {
    const { addDoc } = await import('firebase/firestore')
    mockAuthState.settings.rehearsalTimeDefaults = ['18:30']
    mockAuthState.settings.reportTimeDefault = '08:00'

    const { useServiceStore } = await import('../services')
    const store = useServiceStore()
    store.subscribe('org-1')

    await store.createService({ date: '2026-09-13', name: '', teams: [] })
    const firstCallData = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
    const capturedRehearsals = JSON.parse(JSON.stringify(firstCallData.rehearsals))
    const capturedReportTime = firstCallData.reportTime

    // Mutate the org defaults after creation.
    mockAuthState.settings.rehearsalTimeDefaults = ['20:00', '20:30']
    mockAuthState.settings.reportTimeDefault = '09:15'

    // The already-created service's captured payload must be untouched —
    // proves the copy was independent, not a live reference into settings.
    expect(capturedRehearsals).toEqual([])
    expect(firstCallData.rehearsals).toEqual(capturedRehearsals)
    expect(firstCallData.reportTime).toBe(capturedReportTime)
  })

  it('R442: fresh-copy inverse: a service created AFTER the report default changes picks up the NEW report time, rehearsals still []', async () => {
    const { addDoc } = await import('firebase/firestore')
    const { useServiceStore } = await import('../services')
    const store = useServiceStore()
    store.subscribe('org-1')

    mockAuthState.settings.rehearsalTimeDefaults = ['18:30']
    mockAuthState.settings.reportTimeDefault = '08:00'
    await store.createService({ date: '2026-09-13', name: '', teams: [] })

    mockAuthState.settings.rehearsalTimeDefaults = ['20:00']
    mockAuthState.settings.reportTimeDefault = '09:15'
    await store.createService({ date: '2026-09-20', name: '', teams: [] })

    const secondCallData = vi.mocked(addDoc).mock.calls[1]![1] as Record<string, unknown>
    expect(secondCallData.rehearsals).toEqual([])
    expect(secondCallData.reportTime).toBe('09:15')
  })

  it('R442: an empty rehearsalTimeDefaults produces an empty rehearsals array, not undefined', async () => {
    const { addDoc } = await import('firebase/firestore')
    const { useServiceStore } = await import('../services')
    const store = useServiceStore()
    store.subscribe('org-1')

    await store.createService({ date: '2026-09-13', name: '', teams: [] })

    const data = vi.mocked(addDoc).mock.calls[0]![1] as Record<string, unknown>
    expect(data.rehearsals).toEqual([])
    expect(data.reportTime).toBe('')
  })
})
