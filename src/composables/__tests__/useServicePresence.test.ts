/**
 * Phase 134 Plan 02 (R422) — the forced-disconnect/staleness + cost-behavior
 * evidence gate for useServicePresence. Mirrors useSlideAutoFit.test.ts's
 * mount-a-throwaway-host harness (so onUnmounted/watch actually run) and
 * useVolunteerServiceDoc.test.ts's captured-callback firebase/firestore mock
 * convention (so a test can push snapshot rows and errors on demand).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const mockSetDoc = vi.fn()
const mockDeleteDoc = vi.fn()
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
    orgId: { type: String, default: 'org-1' },
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
})
