import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// R356/ARCH-008 — useSuperAdminsStore owns the GLOBAL superAdmins-collection
// listener, moved out of ConfigurationTab.vue's own onSnapshot. Mirrors
// appConfig.test.ts's mocking idiom.

type SuperAdminDoc = { id: string; data: () => Record<string, unknown> }
type SnapshotCallback = (snap: { docs: SuperAdminDoc[] }) => void
type ErrorCallback = (err: unknown) => void

let snapshotCallback: SnapshotCallback | null = null
let errorCallback: ErrorCallback | null = null
const unsubscribeSpies: Array<ReturnType<typeof vi.fn>> = []

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  onSnapshot: vi.fn((_ref: unknown, cb: SnapshotCallback, errCb: ErrorCallback) => {
    snapshotCallback = cb
    errorCallback = errCb
    const unsub = vi.fn()
    unsubscribeSpies.push(unsub)
    return unsub
  }),
}))

vi.mock('@/firebase', () => ({ db: {} }))

function docOf(uid: string, data: Record<string, unknown>): SuperAdminDoc {
  return { id: uid, data: () => data }
}

function triggerSnapshot(docs: SuperAdminDoc[]): void {
  if (!snapshotCallback) throw new Error('no snapshot callback registered')
  snapshotCallback({ docs })
}

describe('useSuperAdminsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
    errorCallback = null
    unsubscribeSpies.length = 0
  })

  describe('subscribe', () => {
    it('opens an onSnapshot listener on the superAdmins collection and maps docs to {uid, ...data}', async () => {
      const { collection, onSnapshot } = await import('firebase/firestore')
      const { useSuperAdminsStore } = await import('../superAdmins')
      const store = useSuperAdminsStore()

      store.subscribe()
      expect(onSnapshot).toHaveBeenCalledOnce()
      expect(collection).toHaveBeenCalledWith({}, 'superAdmins')

      triggerSnapshot([docOf('uid-1', { email: 'a@example.com' })])
      expect(store.superAdmins).toEqual([{ uid: 'uid-1', email: 'a@example.com' }])
      expect(store.loaded).toBe(true)
    })

    it('suppresses a benign permission-denied error (a super-admin\'s own logout) via isPermissionDenied', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useSuperAdminsStore } = await import('../superAdmins')
      const store = useSuperAdminsStore()

      store.subscribe()
      errorCallback?.({ code: 'permission-denied' })

      expect(consoleSpy).not.toHaveBeenCalled()
      expect(store.loaded).toBe(true)
      consoleSpy.mockRestore()
    })

    it('logs a genuine (non-permission-denied) error but still flips loaded true', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useSuperAdminsStore } = await import('../superAdmins')
      const store = useSuperAdminsStore()

      store.subscribe()
      errorCallback?.({ code: 'unavailable' })

      expect(consoleSpy).toHaveBeenCalled()
      expect(store.loaded).toBe(true)
      consoleSpy.mockRestore()
    })
  })

  describe('unsubscribe', () => {
    it('tears down the listener', async () => {
      const { useSuperAdminsStore } = await import('../superAdmins')
      const store = useSuperAdminsStore()

      store.subscribe()
      store.unsubscribe()

      expect(unsubscribeSpies[0]).toHaveBeenCalledOnce()
    })

    it('is safe to call when no listener is active', async () => {
      const { useSuperAdminsStore } = await import('../superAdmins')
      const store = useSuperAdminsStore()
      expect(() => store.unsubscribe()).not.toThrow()
    })
  })

  // R356/ARCH-008 — GLOBAL listener, unlike members.ts: must NOT be torn down
  // by an org-switch teardown pass.
  describe('org-scope (R356/ARCH-008)', () => {
    it('is NOT registered in resetOrgScopedStores — subscribing then resetting org-scoped stores leaves it intact', async () => {
      vi.doMock('../services', () => ({ useServiceStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('../songs', () => ({ useSongStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('../roster', () => ({ useRosterStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('../teams', () => ({ useTeamsStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('../quarters', () => ({ useQuartersStore: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('../slideGroups', () => ({ useSlideGroups: () => ({ unsubscribeGroups: vi.fn() }) }))
      vi.doMock('../scriptureSlides', () => ({ useScriptureSlides: () => ({ unsubscribeReadings: vi.fn() }) }))
      vi.doMock('../importedSlides', () => ({ useImportedSlides: () => ({ unsubscribeDecks: vi.fn() }) }))
      vi.doMock('../pptxRenders', () => ({ usePptxRenders: () => ({ unsubscribeAll: vi.fn() }) }))
      vi.doMock('../serviceMessages', () => ({
        useServiceMessagesStore: () => ({ unsubscribeServiceMessages: vi.fn() }),
      }))
      vi.doMock('../songLyrics', () => ({ useSongLyricsStore: () => ({ unsubscribeLyrics: vi.fn() }) }))
      vi.doMock('../members', () => ({ useMembersStore: () => ({ unsubscribeAll: vi.fn() }) }))

      const { useSuperAdminsStore } = await import('../superAdmins')
      const store = useSuperAdminsStore()
      store.subscribe()
      triggerSnapshot([docOf('uid-1', { email: 'a@example.com' })])
      expect(store.superAdmins).toHaveLength(1)

      const { resetOrgScopedStores } = await import('../orgScopedStores')
      resetOrgScopedStores()

      // Untouched — resetOrgScopedStores never calls this store's unsubscribe.
      expect(unsubscribeSpies[0]).not.toHaveBeenCalled()
      expect(store.superAdmins).toHaveLength(1)
    })
  })
})
