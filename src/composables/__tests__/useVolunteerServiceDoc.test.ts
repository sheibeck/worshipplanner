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
import { reactive } from 'vue'
import type { MyScheduleDoc } from '@/stores/mySchedule'

const mockGetDoc = vi.fn()
const mockDocRef = vi.fn((...args: unknown[]) => ({ args }))

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDocRef(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

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
    mockGetDoc.mockReset()
    mockDocRef.mockClear()
  })

  it('warm-store match resolves orgId from the matched doc and loads the fresh getDoc result', async () => {
    mockScheduleState.docs = [makeMatch()]
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ serviceId: 'svc-1', title: 'Sunday Worship' }) })

    const { state, doc } = useVolunteerServiceDoc('svc-1')
    await flushPromises()

    expect(mockLoadMySchedule).not.toHaveBeenCalled()
    expect(mockDocRef).toHaveBeenCalledWith({}, 'organizations', 'org-from-store', 'rehearseAccess', 'svc-1')
    expect(state.value).toBe('loaded')
    expect(doc.value?.title).toBe('Sunday Worship')
  })

  it('cold-store calls loadMySchedule exactly once, then resolves from the newly loaded match', async () => {
    mockScheduleState.docs = []
    mockLoadMySchedule.mockImplementation(async () => {
      mockScheduleState.docs = [makeMatch()]
    })
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ serviceId: 'svc-1' }) })

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()

    expect(mockLoadMySchedule).toHaveBeenCalledTimes(1)
    expect(state.value).toBe('loaded')
  })

  it('no match even after the fallback load returns access-denied WITHOUT calling getDoc', async () => {
    mockScheduleState.docs = []

    const { state, doc } = useVolunteerServiceDoc('svc-missing')
    await flushPromises()

    expect(mockLoadMySchedule).toHaveBeenCalledTimes(1)
    expect(state.value).toBe('access-denied')
    expect(doc.value).toBeNull()
    expect(mockGetDoc).not.toHaveBeenCalled()
  })

  it('a non-existent rehearseAccess doc returns access-denied', async () => {
    mockScheduleState.docs = [makeMatch()]
    mockGetDoc.mockResolvedValue({ exists: () => false })

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()

    expect(state.value).toBe('access-denied')
  })

  it('a permission-denied getDoc error maps to access-denied', async () => {
    mockScheduleState.docs = [makeMatch()]
    mockGetDoc.mockRejectedValue({ code: 'permission-denied' })

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()

    expect(state.value).toBe('access-denied')
  })

  it('a network/unknown getDoc error maps to load-failure (retryable, distinct from access-denied)', async () => {
    mockScheduleState.docs = [makeMatch()]
    mockGetDoc.mockRejectedValue(new Error('network blip'))

    const { state } = useVolunteerServiceDoc('svc-1')
    await flushPromises()

    expect(state.value).toBe('load-failure')
  })

  it('retry() re-runs the full resolution flow and can recover from load-failure', async () => {
    mockScheduleState.docs = [makeMatch()]
    mockGetDoc.mockRejectedValueOnce(new Error('network blip'))
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ serviceId: 'svc-1' }) })

    const { state, retry } = useVolunteerServiceDoc('svc-1')
    await flushPromises()
    expect(state.value).toBe('load-failure')

    await retry()

    expect(state.value).toBe('loaded')
    expect(mockGetDoc).toHaveBeenCalledTimes(2)
  })

  it('sources orgId exclusively from the matched store doc — never from any other value', async () => {
    mockScheduleState.docs = [makeMatch({ orgId: 'org-xyz-only-in-store' })]
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ serviceId: 'svc-1' }) })

    useVolunteerServiceDoc('svc-1')
    await flushPromises()

    const call = mockDocRef.mock.calls[0] as unknown[]
    // args: (db, 'organizations', orgId, 'rehearseAccess', serviceId)
    expect(call[2]).toBe('org-xyz-only-in-store')
  })
})
