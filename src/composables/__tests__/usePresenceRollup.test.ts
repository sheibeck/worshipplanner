/**
 * Phase 135 REVIEW-FIX (WR-01) — lifecycle coverage for the bounded ≤6-service
 * READ-ONLY presence fan-out this review flagged as untested. Mirrors
 * useServicePresence.test.ts's mount-a-throwaway-host harness (so
 * onUnmounted/watch/the staleness interval actually run) and its
 * captured-callback firebase/firestore mock convention, generalized to track
 * MULTIPLE concurrent listeners (one per service) instead of one.
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

const mockCollectionRef = vi.fn((...args: unknown[]) => ({ args }))
let snapshotCalls: SnapshotCall[] = []
const mockOnSnapshot = vi.fn((ref: { args: unknown[] }, onNext: unknown, onError: unknown) => {
  const unsub = vi.fn()
  snapshotCalls.push({ args: ref.args, onNext: onNext as (snap: unknown) => void, onError: onError as (err: unknown) => void, unsub })
  return unsub
})

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollectionRef(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [{ args: unknown[] }, unknown, unknown])),
}))

vi.mock('@/firebase', () => ({ db: {} }))

// Imported after the mocks above so the composable picks up the mocked
// 'firebase/firestore' module graph.
import { usePresenceRollup } from '@/composables/usePresenceRollup'
import { PRESENCE_STALE_TTL_MS } from '@/utils/presence'

// Path shape: collection(db, 'organizations', org, 'services', serviceId, 'presence').
function findPresenceCall(serviceId: string): SnapshotCall | undefined {
  return snapshotCalls.find((c) => c.args[3] === 'services' && c.args[4] === serviceId && c.args[5] === 'presence')
}

function makeTimestamp(ms: number) {
  return { toMillis: () => ms }
}

interface RowInput {
  uid: string
  displayName: string
  lastSeenMs: number | null
}

function emitPresence(serviceId: string, rows: RowInput[]): void {
  const call = findPresenceCall(serviceId)
  call!.onNext({
    docs: rows.map((r) => ({
      id: r.uid,
      data: () => ({
        uid: r.uid,
        displayName: r.displayName,
        lastSeen: r.lastSeenMs === null ? null : makeTimestamp(r.lastSeenMs),
      }),
    })),
  })
}

let capturedResult: ReturnType<typeof usePresenceRollup> | null = null
const Host = defineComponent({
  name: 'UsePresenceRollupHost',
  props: {
    orgId: { type: String as PropType<string | null>, default: 'org-1' },
    services: { type: Array as PropType<Service[]>, default: () => [] },
  },
  setup(props) {
    capturedResult = usePresenceRollup(
      () => props.orgId,
      () => props.services,
    )
    return () => h('div')
  },
})

enableAutoUnmount(afterEach)

describe('usePresenceRollup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCollectionRef.mockClear()
    mockOnSnapshot.mockClear()
    snapshotCalls = []
    capturedResult = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens exactly 1 listener per service for a 6-service window', () => {
    const services = Array.from({ length: 6 }, (_, i) => makeService({ id: `svc-${i}`, name: `Service ${i}` }))
    mount(Host, { props: { services } })

    for (const s of services) expect(findPresenceCall(s.id)).toBeDefined()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(6)
  })

  it('window shrink tears down ONLY the dropped services and leaves the kept one untouched (no re-subscribe)', async () => {
    const services = [makeService({ id: 'svc-1' }), makeService({ id: 'svc-2' }), makeService({ id: 'svc-3' })]
    const wrapper = mount(Host, { props: { services } })

    const kept = findPresenceCall('svc-1')!
    const dropped2 = findPresenceCall('svc-2')!
    const dropped3 = findPresenceCall('svc-3')!
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)

    await wrapper.setProps({ services: [services[0]!] })

    expect(dropped2.unsub).toHaveBeenCalledTimes(1)
    expect(dropped3.unsub).toHaveBeenCalledTimes(1)
    expect(kept.unsub).not.toHaveBeenCalled()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)
  })

  it('org change tears down every listener before subscribing under the new org', async () => {
    const services = [makeService({ id: 'svc-1' }), makeService({ id: 'svc-2' })]
    const wrapper = mount(Host, { props: { orgId: 'org-1', services } })

    const old1 = findPresenceCall('svc-1')!
    const old2 = findPresenceCall('svc-2')!
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

    await wrapper.setProps({ orgId: 'org-2' })

    expect(old1.unsub).toHaveBeenCalledTimes(1)
    expect(old2.unsub).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(4)
  })

  it('unmount tears down every open listener', () => {
    const services = [makeService({ id: 'svc-1' }), makeService({ id: 'svc-2' })]
    const wrapper = mount(Host, { props: { services } })

    const unsubs = snapshotCalls.map((c) => c.unsub)
    expect(unsubs.length).toBe(2)

    wrapper.unmount()

    for (const unsub of unsubs) expect(unsub).toHaveBeenCalledTimes(1)
  })

  it('a fresh viewer appears in activeEditors', () => {
    const services = [makeService({ id: 'svc-1' })]
    mount(Host, { props: { services } })

    emitPresence('svc-1', [{ uid: 'other', displayName: 'Other Person', lastSeenMs: Date.now() }])

    expect(capturedResult!.activeEditors.value.map((r) => r.uid)).toContain('other')
  })

  it('FORCED DISCONNECT — a stale viewer drops out purely from the clock advancing, with NO new snapshot', () => {
    const services = [makeService({ id: 'svc-1' })]
    mount(Host, { props: { services } })

    const frozenLastSeen = Date.now()
    emitPresence('svc-1', [{ uid: 'other', displayName: 'Other Person', lastSeenMs: frozenLastSeen }])
    expect(capturedResult!.activeEditors.value.map((r) => r.uid)).toContain('other')

    vi.advanceTimersByTime(PRESENCE_STALE_TTL_MS + 15000)

    expect(capturedResult!.activeEditors.value.map((r) => r.uid)).not.toContain('other')
  })

  it('a listener error clears that service rows, and a later successful snapshot on the SAME listener repopulates it', () => {
    const services = [makeService({ id: 'svc-1' })]
    mount(Host, { props: { services } })

    emitPresence('svc-1', [{ uid: 'other', displayName: 'Other Person', lastSeenMs: Date.now() }])
    expect(capturedResult!.activeEditors.value.map((r) => r.uid)).toContain('other')

    const call = findPresenceCall('svc-1')!
    call.onError(new Error('permission-denied'))
    expect(capturedResult!.activeEditors.value).toEqual([])

    call.onNext({
      docs: [
        {
          id: 'other',
          data: () => ({ uid: 'other', displayName: 'Other Person', lastSeen: makeTimestamp(Date.now()) }),
        },
      ],
    })
    expect(capturedResult!.activeEditors.value.map((r) => r.uid)).toContain('other')
  })
})
