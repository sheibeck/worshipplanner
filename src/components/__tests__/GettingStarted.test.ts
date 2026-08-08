import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GettingStarted from '../GettingStarted.vue'

// R103 — dismissible Getting Started panel, persisted per-device via
// localStorage. Stores and Firestore's onSnapshot are mocked so each test can
// independently control whether `allDone` is true or false; the dismiss key
// itself is exercised against the REAL localStorage (matching
// CollapsibleSection.test.ts's precedent), cleared before and after every
// test to prevent cross-test pollution.

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

vi.mock('@/firebase', () => ({ db: {} }))

const mockMemberSnapshotSize = vi.fn<() => number>()
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: (_ref: unknown, cb: (snap: { size: number }) => void) => {
    cb({ size: mockMemberSnapshotSize() })
    return () => {}
  },
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
    // Default: at least one step incomplete (songs/services empty), no org
    // so the member-count Firestore subscription never fires — panel visible.
    mockUseAuthStore.mockReturnValue({ orgId: null })
    mockUseSongStore.mockReturnValue({ songs: [] })
    mockUseServiceStore.mockReturnValue({ services: [] })
    mockMemberSnapshotSize.mockReturnValue(0)
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
    mockMemberSnapshotSize.mockReturnValue(2)

    const wrapper = mountPanel()
    // memberCount is set inside onMounted's onSnapshot callback — wait one tick
    // for the reactive update (allDone) to flush into the rendered template.
    await nextTick()

    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)
  })

  it('dismissed-but-not-allDone hides the panel — the two conditions are independent', () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    // Steps remain incomplete (default beforeEach state: allDone === false).

    const wrapper = mountPanel()

    expect(wrapper.find('[data-testid="getting-started-dismiss"]').exists()).toBe(false)
  })
})
