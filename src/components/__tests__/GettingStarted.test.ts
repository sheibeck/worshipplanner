import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import GettingStarted from '../GettingStarted.vue'

// R103 — dismissible Getting Started panel, persisted per-device via
// localStorage. Stores are mocked so each test can independently control
// whether `allDone` is true or false; the dismiss key itself is exercised
// against the REAL localStorage (matching CollapsibleSection.test.ts's
// precedent), cleared before and after every test to prevent cross-test
// pollution.

const mockUseAuthStore = vi.fn()
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}))

const mockUseSongStore = vi.fn()
vi.mock('@/stores/songs', () => ({
  useSongStore: () => mockUseSongStore(),
}))

const mockUseServiceStore = vi.fn()
vi.mock('@/stores/services', () => ({
  useServiceStore: () => mockUseServiceStore(),
}))

// R356/ARCH-008 — the member-count listener now lives in useMembersStore;
// this component only drives subscribe()/unsubscribeAll() and reads
// memberCount, so the mock is a reactive stand-in with spy actions.
const mockMembersStore = reactive({
  memberCount: 0,
  subscribe: vi.fn(),
  unsubscribeAll: vi.fn(),
})
vi.mock('@/stores/members', () => ({
  useMembersStore: () => mockMembersStore,
}))

const globalStubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}

const DISMISS_KEY = 'wp:gettingStartedDismissed'

function mountPanel() {
  return mount(GettingStarted, { global: { stubs: globalStubs } })
}

describe('GettingStarted', () => {
  beforeEach(() => {
    localStorage.clear()
    // Default: at least one step incomplete (songs/services empty), no org —
    // panel visible.
    mockUseAuthStore.mockReturnValue({ orgId: null })
    mockUseSongStore.mockReturnValue({ songs: [] })
    mockUseServiceStore.mockReturnValue({ services: [] })
    mockMembersStore.memberCount = 0
    mockMembersStore.subscribe.mockClear()
    mockMembersStore.unsubscribeAll.mockClear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders visibly when not dismissed and not all steps are done', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Getting Started')
  })

  it('clicking the dismiss button writes wp:gettingStartedDismissed to localStorage and hides the panel', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(true)

    await wrapper.find('[data-testid="getting-started-dismiss"]').trigger('click')

    expect(localStorage.getItem(DISMISS_KEY)).toBe('true')
    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)
  })

  it('an already-dismissed panel hides on first render with no flash (synchronous localStorage read at setup)', () => {
    localStorage.setItem(DISMISS_KEY, 'true')

    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Getting Started')
  })

  it('hides the panel once allDone is true, regardless of the dismiss key', async () => {
    mockUseAuthStore.mockReturnValue({ orgId: 'org-1' })
    mockUseSongStore.mockReturnValue({ songs: [{ id: 'song-1' }] })
    mockUseServiceStore.mockReturnValue({ services: [{ id: 'service-1' }] })
    mockMembersStore.memberCount = 2

    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)
  })

  // R356/ARCH-008 — the panel drives the shared members store's subscribe on
  // org change. v2.10 hotfix: it must NOT tear the shared org-scoped store down
  // on its own unmount. onUnmounted runs as a deferred post-render effect, so a
  // teardown here fires AFTER the next route view's synchronous
  // watch(orgId,{immediate:true}) re-subscribe and wipes the just-attached
  // listener (this is the shared-store navigation teardown race). Teardown is
  // owned solely by resetOrgScopedStores() on church switch / logout.
  it('drives membersStore.subscribe on org change and does NOT unsubscribe the shared store on unmount', async () => {
    mockUseAuthStore.mockReturnValue({ orgId: 'org-1' })
    const wrapper = mountPanel()

    expect(mockMembersStore.subscribe).toHaveBeenCalledWith('org-1')

    wrapper.unmount()
    expect(mockMembersStore.unsubscribeAll).not.toHaveBeenCalled()
  })

  it('dismissed-but-not-allDone hides the panel — the two conditions are independent', () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    // Steps remain incomplete (default beforeEach state: allDone === false).

    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)
  })

  // IN-01 (48-REVIEW): a throwing localStorage (private-browsing modes that
  // fully disable Web Storage, enterprise policies, some extensions) must not
  // crash the component during setup() — it should degrade to "not dismissed"
  // (getItem) / "in-memory only for this session" (setItem) instead.
  describe('IN-01: localStorage throws (private mode / quota)', () => {
    it('mounts without throwing and renders visibly when getItem throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: storage is disabled')
      })

      expect(() => mountPanel()).not.toThrow()
      const wrapper = mountPanel()
      expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(true)

      getItemSpy.mockRestore()
    })

    it('clicking dismiss does not throw when setItem throws, and still hides the panel for this session', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      const wrapper = mountPanel()
      await expect(
        wrapper.find('[data-testid="getting-started-dismiss"]').trigger('click'),
      ).resolves.not.toThrow()

      expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)

      setItemSpy.mockRestore()
    })
  })
})
