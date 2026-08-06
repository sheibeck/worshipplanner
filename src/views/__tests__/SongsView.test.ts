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
    mockClearTagFilter.mockClear()
  })

  it('finds the "Import Songs" trigger (default mock has settings.pcEnabled true)', () => {
    const wrapper = mountSongsView()
    expect(findImportSongsButton(wrapper)).toBeTruthy()
  })
})
