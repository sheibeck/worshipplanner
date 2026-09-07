/**
 * Phase 135 REVIEW-FIX (WR-01) — lifecycle coverage for the bounded ≤6-service
 * fan-out this review flagged as untested. Mirrors useServicePresence.test.ts's
 * mount-a-throwaway-host harness (so onUnmounted/watch actually run) and its
 * captured-callback firebase/firestore mock convention, generalized to track
 * MULTIPLE concurrent listeners (2 per service: rehearseAccess doc +
 * confirmations collection) instead of one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'
import type { Timestamp } from 'firebase/firestore'
import type { Service } from '@/types/service'

const ts = {} as Timestamp

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    date: '2026-08-02',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'planned',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

interface SnapshotCall {
  args: unknown[]
  onNext: (snap: unknown) => void
  onError: (err: unknown) => void
  unsub: ReturnType<typeof vi.fn>
}

const mockDocRef = vi.fn((...args: unknown[]) => ({ args }))
const mockCollectionRef = vi.fn((...args: unknown[]) => ({ args }))
let snapshotCalls: SnapshotCall[] = []
const mockOnSnapshot = vi.fn((ref: { args: unknown[] }, onNext: unknown, onError: unknown) => {
  const unsub = vi.fn()
  snapshotCalls.push({ args: ref.args, onNext: onNext as (snap: unknown) => void, onError: onError as (err: unknown) => void, unsub })
  return unsub
})

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDocRef(...args),
  collection: (...args: unknown[]) => mockCollectionRef(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [{ args: unknown[] }, unknown, unknown])),
}))

vi.mock('@/firebase', () => ({ db: {} }))

// Imported after the mocks above so the composable picks up the mocked
// 'firebase/firestore' module graph.
import { useUnconfirmedVolunteers } from '@/composables/useUnconfirmedVolunteers'

// Path shape: doc(db, 'organizations', org, 'rehearseAccess', serviceId).
function findRehearseCall(serviceId: string): SnapshotCall | undefined {
  return snapshotCalls.find((c) => c.args[3] === 'rehearseAccess' && c.args[4] === serviceId)
}

// Path shape: collection(db, 'organizations', org, 'services', serviceId, 'confirmations').
function findConfirmationsCall(serviceId: string): SnapshotCall | undefined {
  return snapshotCalls.find((c) => c.args[3] === 'services' && c.args[4] === serviceId && c.args[5] === 'confirmations')
}

function emitRehearse(
  serviceId: string,
  roleAssignmentsByEmailLower: Record<string, { roleId: string; roleName: string }[]> | undefined,
): void {
  const call = findRehearseCall(serviceId)
  call!.onNext({ data: () => (roleAssignmentsByEmailLower === undefined ? undefined : { roleAssignmentsByEmailLower }) })
}

function emitConfirmations(
  serviceId: string,
  docs: { roleId: string; emailLower: string; status: 'confirmed' | 'needsReconfirmation' }[],
): void {
  const call = findConfirmationsCall(serviceId)
  call!.onNext({ docs: docs.map((d) => ({ data: () => d })) })
}

let capturedResult: ReturnType<typeof useUnconfirmedVolunteers> | null = null
const Host = defineComponent({
  name: 'UseUnconfirmedVolunteersHost',
  props: {
    orgId: { type: String as PropType<string | null>, default: 'org-1' },
    services: { type: Array as PropType<Service[]>, default: () => [] },
  },
  setup(props) {
    capturedResult = useUnconfirmedVolunteers(
      () => props.orgId,
      () => props.services,
    )
    return () => h('div')
  },
})

enableAutoUnmount(afterEach)

describe('useUnconfirmedVolunteers', () => {
  beforeEach(() => {
    mockDocRef.mockClear()
    mockCollectionRef.mockClear()
    mockOnSnapshot.mockClear()
    snapshotCalls = []
    capturedResult = null
  })

  it('opens exactly 2 listeners per service for a 6-service window (rehearseAccess + confirmations)', () => {
    const services = Array.from({ length: 6 }, (_, i) => makeService({ id: `svc-${i}`, name: `Service ${i}` }))
    mount(Host, { props: { services } })

    for (const s of services) {
      expect(findRehearseCall(s.id)).toBeDefined()
      expect(findConfirmationsCall(s.id)).toBeDefined()
    }
    expect(mockOnSnapshot).toHaveBeenCalledTimes(12)
  })

  it('window shrink tears down ONLY the dropped services and leaves the kept ones untouched (no re-subscribe)', async () => {
    const services = [
      makeService({ id: 'svc-1', name: 'One' }),
      makeService({ id: 'svc-2', name: 'Two' }),
      makeService({ id: 'svc-3', name: 'Three' }),
    ]
    const wrapper = mount(Host, { props: { services } })

    const keptRehearse = findRehearseCall('svc-1')!
    const keptConfirmations = findConfirmationsCall('svc-1')!
    const droppedRehearse2 = findRehearseCall('svc-2')!
    const droppedRehearse3 = findRehearseCall('svc-3')!
    expect(mockOnSnapshot).toHaveBeenCalledTimes(6)

    await wrapper.setProps({ services: [services[0]!] })

    // The 2 dropped services (4 listeners) are torn down.
    expect(droppedRehearse2.unsub).toHaveBeenCalledTimes(1)
    expect(droppedRehearse3.unsub).toHaveBeenCalledTimes(1)
    expect(findConfirmationsCall('svc-2')!.unsub).toHaveBeenCalledTimes(1)
    expect(findConfirmationsCall('svc-3')!.unsub).toHaveBeenCalledTimes(1)
    // The kept service's listeners are the SAME ones — never unsubscribed,
    // never re-subscribed (no churn).
    expect(keptRehearse.unsub).not.toHaveBeenCalled()
    expect(keptConfirmations.unsub).not.toHaveBeenCalled()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(6)
  })

  it('org change tears down every listener before subscribing under the new org', async () => {
    const services = [makeService({ id: 'svc-1' }), makeService({ id: 'svc-2' })]
    const wrapper = mount(Host, { props: { orgId: 'org-1', services } })

    const oldRehearse1 = findRehearseCall('svc-1')!
    const oldConfirmations1 = findConfirmationsCall('svc-1')!
    const oldRehearse2 = findRehearseCall('svc-2')!
    const oldConfirmations2 = findConfirmationsCall('svc-2')!
    expect(mockOnSnapshot).toHaveBeenCalledTimes(4)

    await wrapper.setProps({ orgId: 'org-2' })

    expect(oldRehearse1.unsub).toHaveBeenCalledTimes(1)
    expect(oldConfirmations1.unsub).toHaveBeenCalledTimes(1)
    expect(oldRehearse2.unsub).toHaveBeenCalledTimes(1)
    expect(oldConfirmations2.unsub).toHaveBeenCalledTimes(1)
    // Fresh listeners opened for org-2 against the SAME service window.
    expect(mockOnSnapshot).toHaveBeenCalledTimes(8)
  })

  it('unmount tears down every open listener', () => {
    const services = [makeService({ id: 'svc-1' }), makeService({ id: 'svc-2' })]
    const wrapper = mount(Host, { props: { services } })

    const unsubs = snapshotCalls.map((c) => c.unsub)
    expect(unsubs.length).toBe(4)

    wrapper.unmount()

    for (const unsub of unsubs) expect(unsub).toHaveBeenCalledTimes(1)
  })

  it('CR-01 — a listener error followed by a successful snapshot on the SAME listener clears the error state', () => {
    const services = [makeService({ id: 'svc-1' })]
    mount(Host, { props: { services } })

    const rehearseCall = findRehearseCall('svc-1')!
    rehearseCall.onError(new Error('permission-denied'))
    expect(capturedResult!.error.value).toBe(true)

    // A later successful snapshot on the SAME listener clears it.
    rehearseCall.onNext({ data: () => ({ roleAssignmentsByEmailLower: {} }) })
    expect(capturedResult!.error.value).toBe(false)
  })

  it('CR-01 — an error on one service does not get stuck after that service falls out of the window', async () => {
    const services = [makeService({ id: 'svc-1' }), makeService({ id: 'svc-2' })]
    const wrapper = mount(Host, { props: { services } })

    const confirmationsCall1 = findConfirmationsCall('svc-1')!
    confirmationsCall1.onError(new Error('permission-denied'))
    expect(capturedResult!.error.value).toBe(true)

    // svc-1 falls out of the window (window shrinks to just svc-2) — its
    // errored state is torn down along with its listeners, not left sticky.
    await wrapper.setProps({ services: [services[1]!] })

    expect(capturedResult!.error.value).toBe(false)
  })

  it('WR-02 — an undefined roleAssignmentsByEmailLower projection is flagged as stale, not folded into "everyone confirmed"', () => {
    const services = [makeService({ id: 'svc-1' })]
    mount(Host, { props: { services } })

    emitRehearse('svc-1', undefined)
    emitConfirmations('svc-1', [])

    expect(capturedResult!.rows.value).toEqual([])
    expect(capturedResult!.hasStaleAssignmentData.value).toBe(true)
  })

  it('WR-02 — a real all-confirmed service (projection present, no unconfirmed rows) is NOT flagged as stale', () => {
    const services = [makeService({ id: 'svc-1' })]
    mount(Host, { props: { services } })

    emitRehearse('svc-1', { 'alice@example.com': [{ roleId: 'role-1', roleName: 'Vocals' }] })
    emitConfirmations('svc-1', [{ roleId: 'role-1', emailLower: 'alice@example.com', status: 'confirmed' }])

    expect(capturedResult!.rows.value).toEqual([])
    expect(capturedResult!.hasStaleAssignmentData.value).toBe(false)
  })
})
