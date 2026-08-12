/**
 * Wave 0 harness (Phase 39, Plan 01). Mounts SongsView.vue against **unmodified**
 * source and asserts only behavior that is true today — the Planning Center
 * "Import Songs" trigger always renders; nothing in this phase's PC-off hiding
 * (39-05) exists yet.
 *
 * `findImportSongsButton()` is the selector helper Wave 2 reuses verbatim for its
 * absent-when-`pcEnabled`-false case, so the two waves never drift onto different
 * selectors. The button's visible label is "Import Songs", NOT "Import from
 * Planning Center" — confirmed against SongsView.vue's template.
 *
 * The auth-store mock below carries the same forward-compatible `settings` object
 * (`aiEnabled` / `pcEnabled` / `vwModeEnabled`) as SettingsView.test.ts — it does
 * not exist on the real store yet (lands in 39-02).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SongsView from '../SongsView.vue'

// ── @/stores/auth mock — same getter-mock shape as SettingsView.test.ts. ──
let mockOrgId: string | null = 'org-1'
let mockAiEnabled = true
let mockPcEnabled = true
let mockSettingsVwModeEnabled = true

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get orgId() {
      return mockOrgId
    },
    // Forward-compatible shape — `settings` does not exist on the real store
    // until 39-02. Seeded here so Waves 2/3 add assertions, not plumbing.
    settings: {
      get aiEnabled() {
        return mockAiEnabled
      },
      get pcEnabled() {
        return mockPcEnabled
      },
      get vwModeEnabled() {
        return mockSettingsVwModeEnabled
      },
    },
  }),
}))

// ── @/stores/songs mock — minimum surface SongsView.vue reads during mount:
//    songs (array, dereferenced directly by the component's own hiddenSongs/
//    uncategorizedSongs/availableKeys/availableUserTags computeds), the fields
//    bound into the (stubbed) SongFilters/SongTable children, and the
//    subscribe/unsubscribeAll lifecycle actions. ──
let mockSongs: unknown[] = []
const mockSubscribe = vi.fn()
const mockUnsubscribeAll = vi.fn()
const mockUpdateSong = vi.fn(() => Promise.resolve())
const mockRestoreSong = vi.fn(() => Promise.resolve())
const mockHardDeleteSong = vi.fn(() => Promise.resolve())
const mockClearTagFilter = vi.fn()

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    get songs() {
      return mockSongs
    },
    isLoading: false,
    visibleSongs: [] as unknown[],
    filteredSongs: [] as unknown[],
    allUserTags: [] as string[],
    searchQuery: '',
    filterVwType: null,
    filterKey: '',
    tagFilterInclude: new Set<string>(),
    tagFilterExclude: new Set<string>(),
    clearTagFilter: mockClearTagFilter,
    subscribe: mockSubscribe,
    unsubscribeAll: mockUnsubscribeAll,
    updateSong: mockUpdateSong,
    restoreSong: mockRestoreSong,
    hardDeleteSong: mockHardDeleteSong,
  }),
}))

// ── vue-router mock ──
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({
    replace: vi.fn(() => Promise.resolve()),
    push: vi.fn(() => Promise.resolve()),
  }),
}))

function mountSongsView() {
  return mount(SongsView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        SongFilters: { template: '<div />' },
        SongTable: { template: '<div />' },
        SongSlideOver: { template: '<div />' },
        BatchQuickAssign: { template: '<div />' },
        PcImportModal: { template: '<div />' },
      },
    },
  })
}

/**
 * Locates the Planning Center import trigger by visible text. Shared verbatim
 * by Wave 2's absent-when-`pcEnabled`-false assertion (39-05) — do not fork
 * this into a second selector.
 */
export function findImportSongsButton(wrapper: ReturnType<typeof mountSongsView>) {
  return wrapper.findAll('button').find((b) => b.text().includes('Import Songs'))
}

describe('SongsView (Wave 0 harness — Phase 39)', () => {
  beforeEach(() => {
    mockOrgId = 'org-1'
    mockAiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockSongs = []
    mockSubscribe.mockClear()
    mockUnsubscribeAll.mockClear()
    mockUpdateSong.mockClear()
    mockRestoreSong.mockClear()
    mockHardDeleteSong.mockClear()
    mockClearTagFilter.mockClear()
  })

  it('finds the "Import Songs" trigger (default mock has settings.pcEnabled true)', () => {
    const wrapper = mountSongsView()
    expect(findImportSongsButton(wrapper)).toBeTruthy()
  })

  // 39-05 (R089): the trigger must leave the DOM entirely when the org has
  // turned Planning Center off — reuses findImportSongsButton() verbatim
  // (this file's own Wave 0 header comment) rather than forking a selector.
  it('pcEnabled false: the "Import Songs" trigger is absent, other toolbar buttons still render', () => {
    mockPcEnabled = false
    const wrapper = mountSongsView()
    expect(findImportSongsButton(wrapper)).toBeFalsy()
    expect(wrapper.findAll('button').some((b) => b.text().includes('Add Song'))).toBe(true)
  })

  // KHB-03: permanent delete from the Hidden Songs list requires an in-app
  // confirmation (no window.confirm) before songStore.hardDeleteSong is called.
  describe('Hidden Songs — permanent delete (KHB-03)', () => {
    async function mountWithHiddenPanelOpen() {
      mockSongs = [
        { id: 'song-1', title: 'Old Hymn', author: 'Unknown Author', hidden: true, vwTypes: [] },
      ]
      const wrapper = mountSongsView()
      const toggle = wrapper.findAll('button').find((b) => b.text().includes('Hidden ('))
      expect(toggle).toBeTruthy()
      await toggle!.trigger('click')
      return wrapper
    }

    it('clicking Delete shows an in-app confirmation and does not call hardDeleteSong yet', async () => {
      const wrapper = await mountWithHiddenPanelOpen()
      const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')
      expect(deleteButton).toBeTruthy()
      await deleteButton!.trigger('click')

      expect(wrapper.text()).toContain('Permanently delete')
      expect(wrapper.text()).toContain('Old Hymn')
      expect(mockHardDeleteSong).not.toHaveBeenCalled()
    })

    it('clicking Cancel in the confirm hides it and still does not call hardDeleteSong', async () => {
      const wrapper = await mountWithHiddenPanelOpen()
      const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')
      await deleteButton!.trigger('click')

      const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
      expect(cancelButton).toBeTruthy()
      await cancelButton!.trigger('click')

      expect(wrapper.text()).not.toContain('Permanently delete')
      expect(mockHardDeleteSong).not.toHaveBeenCalled()
    })

    it('confirming Delete calls songStore.hardDeleteSong with the song id', async () => {
      const wrapper = await mountWithHiddenPanelOpen()
      const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')
      await deleteButton!.trigger('click')

      // The row's plain Delete button is replaced (v-if) by the confirm panel,
      // which re-uses the same "Delete" label for its own confirm button.
      const confirmDeleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')
      expect(confirmDeleteButton).toBeTruthy()
      await confirmDeleteButton!.trigger('click')

      expect(mockHardDeleteSong).toHaveBeenCalledWith('song-1')
    })
  })
})
