/**
 * Phase 127 Plan 05 (R384/T-127-02/T-127-05/T-127-03) — the security-sensitive
 * orgId-resolution composable for the standalone `/volunteer/service/:serviceId`
 * route, which carries no orgId (127-RESEARCH.md Pitfall 1). Mirrors
 * MyScheduleView.test.ts's reactive-mock-store convention for mySchedule so no
 * real Pinia store / firebase/firestore module graph is exercised for the
 * store side, and useSongFileUpload.test.ts's firebase/firestore function-mock
 * convention for the getDoc side.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import type { MyScheduleDoc } from '@/stores/mySchedule'

const mockDocRef = vi.fn((...args: unknown[]) => ({ args }))
// Phase 130 rework (Change A) — the composable now uses a live onSnapshot
// listener. The mock records the callbacks (latest wins across re-subscribes)
// so a test can push a snapshot / error, and a second snapshot to prove live
// updates. Each subscription returns its own unsubscribe spy.
let latestOnNext: ((snap: unknown) => void) | null = null
let latestOnError: ((err: unknown) => void) | null = null
const mockUnsubs: ReturnType<typeof vi.fn>[] = []
const mockOnSnapshot = vi.fn((_ref: unknown, onNext: unknown, onError: unknown) => {
  latestOnNext = onNext as (snap: unknown) => void
  latestOnError = onError as (err: unknown) => void
  const unsub = vi.fn()
  mockUnsubs.push(unsub)
  return unsub
})

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDocRef(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [unknown, unknown, unknown])),
}))

function emitDoc(snap: unknown): void {
  latestOnNext!(snap)
}
function emitError(err: unknown): void {
  latestOnError!(err)
}

vi.mock('@/firebase', () => ({
  db: {},
  auth: {},
}))

const mockLoadMySchedule = vi.fn()
const mockScheduleState = reactive<{ docs: MyScheduleDoc[] }>({ docs: [] })
vi.mock('@/stores/mySchedule', () => ({
  useMyScheduleStore: () => ({
    get docs() {
      return mockScheduleState.docs
    },
    loadMySchedule: mockLoadMySchedule,
  }),
}))

// Imported after the mocks above so the composable picks up the mocked
// '@/stores/mySchedule' and 'firebase/firestore' module graph.
import { useVolunteerServiceDoc } from '@/composables/useVolunteerServiceDoc'

function makeMatch(overrides: Partial<MyScheduleDoc> = {}): MyScheduleDoc {
  return {
    serviceId: 'svc-1',
    orgId: 'org-from-store',
    serviceDate: '2026-09-06',
    title: 'Sunday Worship',
    status: 'planned',
    assignedEmailsLower: ['dana@example.com'],
    rolesByEmailLower: {},
    songs: [],
    orderOfService: [],
    roleAssignments: [],
    ...overrides,
  }
}

describe('useVolunteerServiceDoc', () => {
  beforeEach(() => {
    mockScheduleState.docs = []
    mockLoadMySchedule.mockReset()
    mockLoadMySchedule.mockResolvedValue(undefined)
    mockOnSnapshot.mockClear()
    mockDocRef.mockClear()
    mockUnsubs.length = 0
    latestOnNext = null
    latestOnError = null
  })

  it('warm-store match resolves orgId from the matched doc and loads the first snapshot', async () => {
    mockScheduleState.docs = [makeMatch()]

    const { state, doc } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-1', title: 'Sunday Worship' }) })

    expect(mockLoadMySchedule).not.toHaveBeenCalled()
    expect(mockDocRef).toHaveBeenCalledWith({}, 'organizations', 'org-from-store', 'rehearseAccess', 'svc-1')
    expect(state.value).toBe('loaded')
    expect(doc.value?.title).toBe('Sunday Worship')
  })

  it('reflects an editor edit live via a SECOND snapshot, without a reload (Change A)', async () => {
    mockScheduleState.docs = [makeMatch()]

    const { doc } = useVolunteerServiceDoc('svc-1')
    await flushPromises()

    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-1', title: 'Original' }) })
    expect(doc.value?.title).toBe('Original')

    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-1', title: 'Edited' }) })
    expect(doc.value?.title).toBe('Edited')
    // Only one subscription — the live update came through the same listener.
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
  })

  it('cold-store calls loadMySchedule exactly once, then resolves from the newly loaded match', async () => {
    mockScheduleState.docs = []
    mockLoadMySchedule.mockImplementation(async () => {
      mockScheduleState.docs = [makeMatch()]
    })

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-1' }) })

    expect(mockLoadMySchedule).toHaveBeenCalledTimes(1)
    expect(state.value).toBe('loaded')
  })

  it('no match even after the fallback load returns access-denied WITHOUT opening a listener', async () => {
    mockScheduleState.docs = []

    const { state, doc } = useVolunteerServiceDoc('svc-missing')
    await flushPromises()

    expect(mockLoadMySchedule).toHaveBeenCalledTimes(1)
    expect(state.value).toBe('access-denied')
    expect(doc.value).toBeNull()
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it('a non-existent rehearseAccess doc returns access-denied', async () => {
    mockScheduleState.docs = [makeMatch()]

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    emitDoc({ exists: () => false })

    expect(state.value).toBe('access-denied')
  })

  it('a permission-denied listener error maps to access-denied', async () => {
    mockScheduleState.docs = [makeMatch()]

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    emitError({ code: 'permission-denied' })

    expect(state.value).toBe('access-denied')
  })

  it('a network/unknown listener error maps to load-failure (retryable, distinct from access-denied)', async () => {
    mockScheduleState.docs = [makeMatch()]

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    emitError(new Error('network blip'))

    expect(state.value).toBe('load-failure')
  })

  it('retry() re-runs the full resolution flow and can recover from load-failure', async () => {
    mockScheduleState.docs = [makeMatch()]

    const { state, retry } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    emitError(new Error('network blip'))
    expect(state.value).toBe('load-failure')

    await retry()
    await flushPromises()
    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-1' }) })

    expect(state.value).toBe('loaded')
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    // retry() tears down the prior listener before opening the new one.
    expect(mockUnsubs[0]).toHaveBeenCalledTimes(1)
  })

  it('sources orgId exclusively from the matched store doc — never from any other value', async () => {
    mockScheduleState.docs = [makeMatch({ orgId: 'org-xyz-only-in-store' })]

    useVolunteerServiceDoc('svc-1')
    await flushPromises()

    const call = mockDocRef.mock.calls[0] as unknown[]
    // args: (db, 'organizations', orgId, 'rehearseAccess', serviceId)
    expect(call[2]).toBe('org-xyz-only-in-store')
  })

  // WR-02 (127-REVIEW): serviceId must be a reactive source (ref/getter), not
  // a plain string captured once — Vue Router reuses this component instance
  // across two /volunteer/service/:id URLs, so the composable must reload
  // (and re-subscribe) when the id it's given changes underneath it.
  it('accepts a reactive serviceId ref and re-subscribes with the NEW id when it changes', async () => {
    mockScheduleState.docs = [makeMatch({ serviceId: 'svc-1', orgId: 'org-1' }), makeMatch({ serviceId: 'svc-2', orgId: 'org-2' })]

    const serviceIdRef = ref('svc-1')
    const { state, doc } = useVolunteerServiceDoc(serviceIdRef)
    await flushPromises()
    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-1', title: 'Title for svc-1' }) })

    expect(state.value).toBe('loaded')
    expect(doc.value?.serviceId).toBe('svc-1')
    expect(mockDocRef).toHaveBeenCalledWith({}, 'organizations', 'org-1', 'rehearseAccess', 'svc-1')

    serviceIdRef.value = 'svc-2'
    await flushPromises()
    // The prior listener is torn down before the new one opens.
    expect(mockUnsubs[0]).toHaveBeenCalledTimes(1)
    emitDoc({ exists: () => true, data: () => ({ serviceId: 'svc-2', title: 'Title for svc-2' }) })

    expect(state.value).toBe('loaded')
    expect(doc.value?.serviceId).toBe('svc-2')
    expect(mockDocRef).toHaveBeenCalledWith({}, 'organizations', 'org-2', 'rehearseAccess', 'svc-2')
  })
})
