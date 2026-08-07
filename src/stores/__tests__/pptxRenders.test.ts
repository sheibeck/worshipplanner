import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

type SnapshotCallback = (snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void

// Keyed by the doc's last path segment (the import id) so each id's `onSnapshot`
// callback and `Unsubscribe` spy can be triggered/asserted independently — this store
// opens N per-id listeners, not one collection listener, so a single shared callback
// (the shape scriptureSlides.test.ts's mock uses) can't model it.
const unsubscribeSpies = new Map<string, ReturnType<typeof vi.fn>>()
const snapshotCallbacks = new Map<string, SnapshotCallback>()

vi.mock('firebase/firestore', () => {
  return {
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      id: segments[segments.length - 1] ?? 'mock-id',
      path: segments.join('/'),
    })),
    onSnapshot: vi.fn((ref: { id: string }, callback: SnapshotCallback) => {
      snapshotCallbacks.set(ref.id, callback)
      const unsub = vi.fn()
      unsubscribeSpies.set(ref.id, unsub)
      return unsub
    }),
  }
})

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

function triggerSnapshot(importId: string, data: Record<string, unknown> | null) {
  const cb = snapshotCallbacks.get(importId)
  if (!cb) throw new Error(`no snapshot callback registered for "${importId}"`)
  cb({
    exists: () => data !== null,
    data: () => data ?? {},
  })
}

describe('usePptxRenders', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    unsubscribeSpies.clear()
    snapshotCallbacks.clear()
  })

  describe('syncSubscriptions — opening listeners', () => {
    it('opens exactly one onSnapshot listener for a single id', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])

      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('adding a second id opens exactly one MORE listener and does not re-open the first', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      store.syncSubscriptions('orgA', ['a', 'b'])

      expect(onSnapshot).toHaveBeenCalledTimes(2)
    })

    it('a repeat call with an unchanged id set does not increase the onSnapshot call count', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a', 'b'])
      expect(onSnapshot).toHaveBeenCalledTimes(2)

      store.syncSubscriptions('orgA', ['a', 'b'])
      expect(onSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  describe('syncSubscriptions — closing listeners (T-42-06 listener-leak guard)', () => {
    it('removing an id calls its Unsubscribe exactly once and leaves the retained id open', async () => {
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a', 'b'])
      const unsubA = unsubscribeSpies.get('a')!
      const unsubB = unsubscribeSpies.get('b')!

      store.syncSubscriptions('orgA', ['b'])

      expect(unsubA).toHaveBeenCalledOnce()
      expect(unsubB).not.toHaveBeenCalled()
    })

    it('removing an id deletes its cached render state from rendersByImportId', async () => {
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      triggerSnapshot('a', { status: 'ready', renderedCount: 1 })
      expect(store.rendersByImportId.has('a')).toBe(true)

      store.syncSubscriptions('orgA', [])
      expect(store.rendersByImportId.has('a')).toBe(false)
    })

    it('WR-05: an id removed then re-added in a later call opens a FRESH listener rather than being suppressed by a stale entry', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      expect(onSnapshot).toHaveBeenCalledTimes(1)
      const firstUnsubA = unsubscribeSpies.get('a')!

      store.syncSubscriptions('orgA', [])
      expect(firstUnsubA).toHaveBeenCalledOnce()
      expect(store.rendersByImportId.has('a')).toBe(false)

      store.syncSubscriptions('orgA', ['a'])

      // Two `onSnapshot` calls total (once per open) — a stale `listeners` entry
      // suppressing re-subscription, or a double-`onSnapshot` call, would show up
      // as a count other than 2 here.
      expect(onSnapshot).toHaveBeenCalledTimes(2)

      // The second open's data flows through `rendersByImportId` correctly —
      // proves the fresh listener's callback is wired up, not just that
      // `onSnapshot` was invoked again.
      triggerSnapshot('a', { status: 'ready', renderedCount: 2 })
      expect(store.rendersByImportId.get('a')).toEqual({ status: 'ready', renderedCount: 2 })
    })
  })

  describe('snapshot callback — presence vs absence', () => {
    it('stores document data by import id when the snapshot exists', async () => {
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      triggerSnapshot('a', { status: 'ready', renderedCount: 3 })

      expect(store.rendersByImportId.get('a')).toEqual({ status: 'ready', renderedCount: 3 })
    })

    it('a non-existent snapshot removes the id from the map instead of storing a placeholder', async () => {
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      triggerSnapshot('a', { status: 'pending' })
      expect(store.rendersByImportId.has('a')).toBe(true)

      triggerSnapshot('a', null)
      expect(store.rendersByImportId.has('a')).toBe(false)
    })
  })

  describe('org handling', () => {
    it('syncSubscriptions(null, [...]) tears every listener down and stores nothing', async () => {
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      triggerSnapshot('a', { status: 'ready', renderedCount: 1 })
      const unsubA = unsubscribeSpies.get('a')!

      store.syncSubscriptions(null, ['a'])

      expect(unsubA).toHaveBeenCalledOnce()
      expect(store.rendersByImportId.size).toBe(0)
    })

    it('switching org tears down the previous org listeners and opens fresh ones', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a'])
      const unsubA = unsubscribeSpies.get('a')!

      store.syncSubscriptions('orgB', ['a'])

      expect(unsubA).toHaveBeenCalledOnce()
      expect(onSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  describe('unsubscribeAll', () => {
    it('calls every outstanding unsubscribe and empties the map; calling it twice is a no-op', async () => {
      const { usePptxRenders } = await import('../pptxRenders')
      const store = usePptxRenders()

      store.syncSubscriptions('orgA', ['a', 'b'])
      triggerSnapshot('a', { status: 'ready', renderedCount: 1 })
      const unsubA = unsubscribeSpies.get('a')!
      const unsubB = unsubscribeSpies.get('b')!

      store.unsubscribeAll()

      expect(unsubA).toHaveBeenCalledOnce()
      expect(unsubB).toHaveBeenCalledOnce()
      expect(store.rendersByImportId.size).toBe(0)

      expect(() => store.unsubscribeAll()).not.toThrow()
      expect(unsubA).toHaveBeenCalledOnce()
      expect(unsubB).toHaveBeenCalledOnce()
    })
  })
})
