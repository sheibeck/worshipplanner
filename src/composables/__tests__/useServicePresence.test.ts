/**
 * Phase 134 Plan 02 (R422) — the forced-disconnect/staleness + cost-behavior
 * evidence gate for useServicePresence. Mirrors useSlideAutoFit.test.ts's
 * mount-a-throwaway-host harness (so onUnmounted/watch actually run) and
 * useVolunteerServiceDoc.test.ts's captured-callback firebase/firestore mock
 * convention (so a test can push snapshot rows and errors on demand).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'

// Resolved by default (real setDoc/deleteDoc return Promises) so the
// composable's `.catch(() => {})` chains (WR-02) have a real Promise to hang
// off; individual tests override with mockRejectedValueOnce to prove the
// rejection is swallowed rather than surfacing as unhandled.
const mockSetDoc = vi.fn().mockResolvedValue(undefined)
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined)
const mockDocRef = vi.fn((...args: unknown[]) => ({ args }))
const mockCollectionRef = vi.fn((...args: unknown[]) => ({ args }))
const mockServerTimestamp = vi.fn(() => ({ __serverTimestamp: true }))

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
  collection: (...args: unknown[]) => mockCollectionRef(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [unknown, unknown, unknown])),
  serverTimestamp: () => mockServerTimestamp(),
}))

vi.mock('@/firebase', () => ({ db: {} }))

// Imported after the mocks above so the composable picks up the mocked
// 'firebase/firestore' module graph.
import { useServicePresence, type PresenceUser } from '@/composables/useServicePresence'
import { PRESENCE_HEARTBEAT_MS, PRESENCE_STALE_TTL_MS } from '@/utils/presence'

function makeTimestamp(ms: number) {
  return { toMillis: () => ms }
}

interface RowInput {
  uid: string
  displayName: string
  lastSeenMs: number | null
}

function emitSnapshot(rows: RowInput[]): void {
  latestOnNext!({
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

let capturedResult: ReturnType<typeof useServicePresence> | null = null
const PresenceHost = defineComponent({
  name: 'UseServicePresenceHost',
  props: {
    // Nullable so WR-01 can mount with orgId still unresolved (mirrors a
    // hard refresh landing on a service route before authStore.orgId
    // populates), then set it later.
    orgId: { type: String as PropType<string | null>, default: 'org-1' },
    serviceId: { type: String, default: 'svc-1' },
  },
  setup(props) {
    const user: PresenceUser = { uid: 'me', displayName: 'Me' }
    capturedResult = useServicePresence(
      () => props.orgId,
      () => props.serviceId,
      () => user,
    )
    return () => h('div')
  },
})

enableAutoUnmount(afterEach)

describe('useServicePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSetDoc.mockClear()
    mockDeleteDoc.mockClear()
    mockDocRef.mockClear()
    mockCollectionRef.mockClear()
    mockOnSnapshot.mockClear()
    mockUnsubs.length = 0
    latestOnNext = null
    latestOnError = null
    capturedResult = null
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes the own presence doc immediately on start, before any timer advance', () => {
    mount(PresenceHost)

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [ref, payload] = mockSetDoc.mock.calls[0] as [{ args: unknown[] }, Record<string, unknown>]
    expect(ref.args).toEqual([{}, 'organizations', 'org-1', 'services', 'svc-1', 'presence', 'me'])
    expect(payload).toEqual({ uid: 'me', displayName: 'Me', lastSeen: { __serverTimestamp: true } })
  })

  it('a fresh viewer appears in presentViewers', () => {
    mount(PresenceHost)

    emitSnapshot([{ uid: 'other', displayName: 'Other Person', lastSeenMs: Date.now() }])

    expect(capturedResult!.presentViewers.value.map((v) => v.uid)).toContain('other')
  })

  it('FORCED DISCONNECT — a stale viewer drops out purely from the clock advancing, with NO new snapshot', () => {
    mount(PresenceHost)

    const frozenLastSeen = Date.now()
    emitSnapshot([{ uid: 'other', displayName: 'Other Person', lastSeenMs: frozenLastSeen }])
    expect(capturedResult!.presentViewers.value.map((v) => v.uid)).toContain('other')

    // No new snapshot is pushed — only the clock advances past the TTL, plus
    // one more now-tick so the staleness recompute actually fires.
    vi.advanceTimersByTime(PRESENCE_STALE_TTL_MS + 15000)

    expect(capturedResult!.presentViewers.value.map((v) => v.uid)).not.toContain('other')
  })

  it('PAUSED-WHEN-HIDDEN — no setDoc fires during a heartbeat interval while hidden; resumes on visibilitychange', () => {
    mount(PresenceHost)
    mockSetDoc.mockClear() // drop the immediate initial write

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    vi.advanceTimersByTime(PRESENCE_HEARTBEAT_MS)
    expect(mockSetDoc).not.toHaveBeenCalled()

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mockSetDoc).toHaveBeenCalledTimes(1)
  })

  it('TEARDOWN — a serviceId change deletes the OLD doc; unmount deletes again + unsubscribes', async () => {
    const wrapper = mount(PresenceHost, { props: { serviceId: 'svc-1' } })
    mockDeleteDoc.mockClear()

    await wrapper.setProps({ serviceId: 'svc-2' })

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
    const [oldRef] = mockDeleteDoc.mock.calls[0] as [{ args: unknown[] }]
    expect(oldRef.args).toEqual([{}, 'organizations', 'org-1', 'services', 'svc-1', 'presence', 'me'])
    // The prior (svc-1) listener is torn down before the new (svc-2) one opens.
    expect(mockUnsubs[0]).toHaveBeenCalledTimes(1)

    wrapper.unmount()

    expect(mockDeleteDoc).toHaveBeenCalledTimes(2)
    const [newRef] = mockDeleteDoc.mock.calls[1] as [{ args: unknown[] }]
    expect(newRef.args).toEqual([{}, 'organizations', 'org-1', 'services', 'svc-2', 'presence', 'me'])
    expect(mockUnsubs[1]).toHaveBeenCalledTimes(1)
  })

  it('WR-01 — activates once orgId resolves after mount, even though serviceId never changes', async () => {
    // Mirrors a hard refresh landing on /services/:id before authStore.orgId
    // has resolved: the immediate watch fires with orgId still null, start()
    // guards out (no write, no listener), and serviceId itself never changes
    // afterward — so re-activation must come from orgId joining the watch.
    const wrapper = mount(PresenceHost, { props: { orgId: null, serviceId: 'svc-1' } })

    expect(mockSetDoc).not.toHaveBeenCalled()
    expect(mockOnSnapshot).not.toHaveBeenCalled()

    await wrapper.setProps({ orgId: 'org-1' })

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [ref] = mockSetDoc.mock.calls[0] as [{ args: unknown[] }]
    expect(ref.args).toEqual([{}, 'organizations', 'org-1', 'services', 'svc-1', 'presence', 'me'])
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
    // The guard-rejected first attempt never went live, so no stale-doc
    // delete fires for it once orgId resolves.
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('WR-02 — a rejected setDoc/deleteDoc is swallowed, not left as an unhandled rejection', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('permission-denied'))
    const wrapper = mount(PresenceHost, { props: { serviceId: 'svc-1' } })
    // Let the rejected setDoc promise's microtask (and its .catch) settle.
    await Promise.resolve()
    await Promise.resolve()

    mockDeleteDoc.mockRejectedValueOnce(new Error('permission-denied'))
    await wrapper.setProps({ serviceId: 'svc-2' })
    await Promise.resolve()
    await Promise.resolve()

    // Reaching here without vitest reporting an unhandled rejection IS the
    // assertion; the composable's own state stays consistent regardless.
    expect(capturedResult).not.toBeNull()
  })
})
