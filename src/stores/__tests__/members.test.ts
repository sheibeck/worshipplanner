import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// R356/ARCH-008 — useMembersStore owns the org's members-collection count
// listener, moved out of GettingStarted.vue's own onSnapshot. Mocks mirror
// the songLyrics.ts::subscribeLyrics / serviceMessages.ts test idioms: a
// trackable onSnapshot spy per call, plus an isPermissionDenied-suppressing
// error callback assertion (Bug 2b's precedent).

type SnapshotCallback = (snap: { size: number }) => void
type ErrorCallback = (err: unknown) => void

let snapshotCallback: SnapshotCallback | null = null
let errorCallback: ErrorCallback | null = null
const unsubscribeSpies: Array<ReturnType<typeof vi.fn>> = []

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  onSnapshot: vi.fn((_ref: unknown, cb: SnapshotCallback, errCb: ErrorCallback) => {
    snapshotCallback = cb
    errorCallback = errCb
    const unsub = vi.fn()
    unsubscribeSpies.push(unsub)
    return unsub
  }),
}))

vi.mock('@/firebase', () => ({ db: {} }))

function triggerSnapshot(size: number): void {
  if (!snapshotCallback) throw new Error('no snapshot callback registered')
  snapshotCallback({ size })
}

describe('useMembersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
    errorCallback = null
    unsubscribeSpies.length = 0
  })

  describe('subscribe', () => {
    it('opens an onSnapshot listener on organizations/{orgId}/members and sets memberCount from snap.size', async () => {
      const { collection, onSnapshot } = await import('firebase/firestore')
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()

      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
      expect(collection).toHaveBeenCalledWith({}, 'organizations', 'org-1', 'members')

      triggerSnapshot(3)
      expect(store.memberCount).toBe(3)
    })

    it('is a no-op tear-down-safe call when orgId is null — resets memberCount to 0 and opens no listener', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()

      store.subscribe('org-1')
      triggerSnapshot(5)
      expect(store.memberCount).toBe(5)

      store.subscribe(null)
      expect(store.memberCount).toBe(0)
      // Only the first subscribe('org-1') call ever opened a listener.
      expect(onSnapshot).toHaveBeenCalledTimes(1)
    })

    it('re-subscribing (org switch) unsubscribes the previous listener first', async () => {
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()

      store.subscribe('org-1')
      const firstUnsub = unsubscribeSpies[0]!

      store.subscribe('org-2')
      expect(firstUnsub).toHaveBeenCalledOnce()
    })

    it('suppresses a benign permission-denied error via ignorePermissionDenied', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()

      store.subscribe('org-1')
      errorCallback?.({ code: 'permission-denied' })

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('logs a genuine (non-permission-denied) error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()

      store.subscribe('org-1')
      errorCallback?.({ code: 'unavailable' })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('unsubscribeAll', () => {
    it('tears down the listener and resets memberCount to 0', async () => {
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()

      store.subscribe('org-1')
      triggerSnapshot(4)
      expect(store.memberCount).toBe(4)

      store.unsubscribeAll()
      expect(store.memberCount).toBe(0)
      expect(unsubscribeSpies[0]).toHaveBeenCalledOnce()
    })

    it('is safe to call when no listener is active', async () => {
      const { useMembersStore } = await import('../members')
      const store = useMembersStore()
      expect(() => store.unsubscribeAll()).not.toThrow()
      expect(store.memberCount).toBe(0)
    })
  })

  describe('resetOrgScopedStores registration (R356/ARCH-008)', () => {
    it('resetOrgScopedStores tears down the members store', async () => {
      vi.doMock('./services', () => ({ useServiceStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('./songs', () => ({ useSongStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('./roster', () => ({ useRosterStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('./teams', () => ({ useTeamsStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('./quarters', () => ({ useQuartersStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('./slideGroups', () => ({ useSlideGroups: () => ({ unsubscribeGroups: vi.fn() }) }))
      vi.doMock('./scriptureSlides', () => ({ useScriptureSlides: () => ({ unsubscribeReadings: vi.fn() }) }))
      vi.doMock('./importedSlides', () => ({ useImportedSlides: () => ({ unsubscribeDecks: vi.fn() }) }))
      vi.doMock('./pptxRenders', () => ({ usePptxRenders: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('./serviceMessages', () => ({
        useServiceMessagesStore: () => ({ unsubscribeServiceMessages: vi.fn() }),
      }))
      vi.doMock('./songLyrics', () => ({ useSongLyricsStore: () => ({ unsubscribeLyrics: vi.fn() }) }))

      const { useMembersStore } = await import('../members')
      const store = useMembersStore()
      store.subscribe('org-1')
      triggerSnapshot(7)
      expect(store.memberCount).toBe(7)

      const { resetOrgScopedStores } = await import('../orgScopedStores')
      resetOrgScopedStores()

      expect(store.memberCount).toBe(0)
    })
  })
})
