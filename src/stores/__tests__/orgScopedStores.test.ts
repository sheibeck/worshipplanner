import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock every sibling store module resetOrgScopedStores() imports, each
// exposing only the exact teardown method that file calls, so this test
// proves the *registration* (church-switch teardown) rather than each
// store's own internal behavior (already covered by that store's own tests).
const unsubscribeAllServiceStore = vi.fn()
vi.mock('../services', () => ({ useServiceStore: () => ({ unsubscribeAll: unsubscribeAllServiceStore }) }))

const unsubscribeAllSongStore = vi.fn()
vi.mock('../songs', () => ({ useSongStore: () => ({ unsubscribeAll: unsubscribeAllSongStore }) }))

const unsubscribeAllRosterStore = vi.fn()
vi.mock('../roster', () => ({ useRosterStore: () => ({ unsubscribeAll: unsubscribeAllRosterStore }) }))

const unsubscribeAllTeamsStore = vi.fn()
vi.mock('../teams', () => ({ useTeamsStore: () => ({ unsubscribeAll: unsubscribeAllTeamsStore }) }))

const unsubscribeAllQuartersStore = vi.fn()
vi.mock('../quarters', () => ({ useQuartersStore: () => ({ unsubscribeAll: unsubscribeAllQuartersStore }) }))

const unsubscribeGroups = vi.fn()
vi.mock('../slideGroups', () => ({ useSlideGroups: () => ({ unsubscribeGroups }) }))

const unsubscribeReadings = vi.fn()
vi.mock('../scriptureSlides', () => ({ useScriptureSlides: () => ({ unsubscribeReadings }) }))

const unsubscribeDecks = vi.fn()
vi.mock('../importedSlides', () => ({ useImportedSlides: () => ({ unsubscribeDecks }) }))

const unsubscribeAllPptxRenders = vi.fn()
vi.mock('../pptxRenders', () => ({ usePptxRenders: () => ({ unsubscribeAll: unsubscribeAllPptxRenders }) }))

const unsubscribeServiceMessages = vi.fn()
vi.mock('../serviceMessages', () => ({ useServiceMessagesStore: () => ({ unsubscribeServiceMessages }) }))

const unsubscribeLyrics = vi.fn()
vi.mock('../songLyrics', () => ({ useSongLyricsStore: () => ({ unsubscribeLyrics }) }))

const unsubscribeAllMembersStore = vi.fn()
vi.mock('../members', () => ({ useMembersStore: () => ({ unsubscribeAll: unsubscribeAllMembersStore }) }))

const unsubscribeAllVampStore = vi.fn()
vi.mock('../vamps', () => ({ useVampStore: () => ({ unsubscribeAll: unsubscribeAllVampStore }) }))

describe('resetOrgScopedStores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tears down every org-scoped store, including the vamps listener (church-switch teardown)', async () => {
    const { resetOrgScopedStores } = await import('../orgScopedStores')
    resetOrgScopedStores()

    expect(unsubscribeAllServiceStore).toHaveBeenCalledOnce()
    expect(unsubscribeAllSongStore).toHaveBeenCalledOnce()
    expect(unsubscribeAllRosterStore).toHaveBeenCalledOnce()
    expect(unsubscribeAllTeamsStore).toHaveBeenCalledOnce()
    expect(unsubscribeAllQuartersStore).toHaveBeenCalledOnce()
    expect(unsubscribeGroups).toHaveBeenCalledOnce()
    expect(unsubscribeReadings).toHaveBeenCalledOnce()
    expect(unsubscribeDecks).toHaveBeenCalledOnce()
    expect(unsubscribeAllPptxRenders).toHaveBeenCalledOnce()
    expect(unsubscribeServiceMessages).toHaveBeenCalledOnce()
    expect(unsubscribeLyrics).toHaveBeenCalledOnce()
    expect(unsubscribeAllMembersStore).toHaveBeenCalledOnce()
    // The guard this plan adds — a missing registration here leaks Church-A
    // vamps into Church B after a sidebar-triggered church switch.
    expect(unsubscribeAllVampStore).toHaveBeenCalledOnce()
  })
})
