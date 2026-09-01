/**
 * Phase 92 Plan 02 (R267/R275). Proves the "Monitor Setup" nav entry is
 * gated on `authStore.orgId` ONLY, not `authStore.isEditor` — the deliberate
 * divergence from its Group C neighbors (Admins/Settings) documented in
 * AppSidebar.vue's inline comment above the item.
 *
 * Mirrors AppShell.test.ts's `vi.mock('vue-router', ...)` shape (AppSidebar
 * calls both `useRoute()` and `useRouter()` directly) and SettingsView.test.ts's
 * module-scope getter-based `@/stores/auth` mock so individual tests can flip
 * `orgId`/`isEditor` between assertions. `router-link` is left unresolved
 * (vue-router itself is mocked, so its global-component install never runs) —
 * Vue falls back to rendering it as a literal custom element carrying the
 * bound `to` prop as a plain DOM attribute, which is what the `[to="..."]`
 * selectors below query.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import AppSidebar from '../AppSidebar.vue'

enableAutoUnmount(afterEach)

const mockRouterPush = vi.fn(() => Promise.resolve())

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ path: '/services' })),
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
}))

let mockOrgId: string | null = 'org-1'
let mockOrgName: string | null = 'Test Church'
let mockIsEditor = false
let mockIsSuperAdmin = false
// Phase 104 (R311) — church switcher state. Empty/single-entry by default so
// every pre-existing test (written before the switcher existed) keeps seeing
// zero switcher UI unless a test opts in via mockMemberships.
let mockMemberships: { id: string; name: string; active: boolean; role: 'editor' | 'viewer' }[] = []
let mockViewingAsSuperAdmin: string | null = null
const mockLogout = vi.fn(() => Promise.resolve())
const mockSelectOrg = vi.fn(() => Promise.resolve())

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get orgId() {
      return mockOrgId
    },
    get orgName() {
      return mockOrgName
    },
    get isEditor() {
      return mockIsEditor
    },
    get isSuperAdmin() {
      return mockIsSuperAdmin
    },
    get memberships() {
      return mockMemberships
    },
    get viewingAsSuperAdmin() {
      return mockViewingAsSuperAdmin
    },
    superAdminOutsideOwnChurch: null,
    user: { uid: 'test-uid', email: 'viewer@example.com', displayName: 'Viewer User' },
    logout: mockLogout,
    selectOrg: mockSelectOrg,
  }),
}))

const mockToastPush = vi.fn()
vi.mock('@/stores/toasts', () => ({
  useToasts: () => ({
    push: mockToastPush,
  }),
}))

beforeEach(() => {
  mockOrgId = 'org-1'
  mockOrgName = 'Test Church'
  mockIsEditor = false
  mockIsSuperAdmin = false
  mockMemberships = []
  mockViewingAsSuperAdmin = null
  mockRouterPush.mockClear()
  mockLogout.mockClear()
  mockSelectOrg.mockClear()
  mockSelectOrg.mockImplementation(() => Promise.resolve())
  mockToastPush.mockClear()
})

function mountSidebar() {
  return mount(AppSidebar, { props: { sidebarOpen: true } })
}

describe('AppSidebar — Monitor Setup nav entry orgId gate (R267/R275, Phase 92)', () => {
  it('shows the Monitor Setup link to a non-editor org member (isEditor false, orgId set), while editor-only items stay absent', () => {
    mockIsEditor = false
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()

    const link = wrapper.find('[to="/monitor-setup"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('Monitor Setup')

    // Divergence proof: the same isEditor=false state hides the Group C
    // editor-only neighbors that Monitor Setup deliberately does NOT gate on.
    expect(wrapper.find('[to="/settings"]').exists()).toBe(false)
    expect(wrapper.find('[to="/admins"]').exists()).toBe(false)
  })

  it('hides the Monitor Setup link when orgId is null', () => {
    mockOrgId = null
    const wrapper = mountSidebar()
    expect(wrapper.find('[to="/monitor-setup"]').exists()).toBe(false)
  })
})

/**
 * Phase 104 Plan 02 (R311/R312). Proves the sidebar-footer church switcher:
 * gated to genuine multi-org members not currently in super-admin
 * viewing-as mode, switches via authStore.selectOrg() ONLY (never
 * enterOrgAsSuperAdmin), shows role badges, marks the active church
 * non-interactive, disables deactivated churches, and dogfoods the Phase
 * 104 notification store on a failed switch.
 */
describe('AppSidebar — church switcher (R311/R312, Phase 104)', () => {
  const twoOrgs: typeof mockMemberships = [
    { id: 'org-1', name: 'Org One', active: true, role: 'editor' },
    { id: 'org-2', name: 'Org Two', active: true, role: 'viewer' },
  ]

  it('renders no switcher for a single-org member (memberships.length <= 1)', () => {
    mockMemberships = [{ id: 'org-1', name: 'Org One', active: true, role: 'editor' }]
    const wrapper = mountSidebar()
    expect(wrapper.find('[data-testid="church-switcher-trigger"]').exists()).toBe(false)
  })

  it('renders no switcher for a multi-org member currently viewing another church as super-admin', () => {
    mockMemberships = twoOrgs
    mockViewingAsSuperAdmin = 'org-9'
    const wrapper = mountSidebar()
    expect(wrapper.find('[data-testid="church-switcher-trigger"]').exists()).toBe(false)
  })

  it('renders the switcher trigger for a genuine multi-org member', () => {
    mockMemberships = twoOrgs
    const wrapper = mountSidebar()
    expect(wrapper.find('[data-testid="church-switcher-trigger"]').exists()).toBe(true)
  })

  it('opens the panel and renders one row per membership with the correct role badge', async () => {
    mockMemberships = twoOrgs
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')

    const panel = wrapper.find('[data-testid="church-switcher-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Org One')
    expect(panel.text()).toContain('Org Two')
    expect(panel.text()).toContain('Editor')
    expect(panel.text()).toContain('Viewer')
  })

  it('renders the active church as a non-interactive row, not a click target', async () => {
    mockMemberships = twoOrgs
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')

    const current = wrapper.find('[data-testid="church-switcher-current"]')
    expect(current.exists()).toBe(true)
    expect(current.text()).toContain('Org One')
    expect(current.attributes('aria-current')).toBe('true')
    // Not a button — no click handler to fire.
    expect(current.element.tagName).not.toBe('BUTTON')
  })

  it('clicking another church calls selectOrg with that church id', async () => {
    mockMemberships = twoOrgs
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')

    const options = wrapper.findAll('[data-testid="church-switcher-option"]')
    expect(options).toHaveLength(1)
    await options[0]!.trigger('click')
    await flushPromises()

    expect(mockSelectOrg).toHaveBeenCalledWith('org-2')
  })

  it('closes the panel after a successful switch', async () => {
    mockMemberships = twoOrgs
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="church-switcher-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="church-switcher-option"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="church-switcher-panel"]').exists()).toBe(false)
  })

  it('disables a deactivated church row and suffixes its name with (deactivated)', async () => {
    mockMemberships = [
      { id: 'org-1', name: 'Org One', active: true, role: 'editor' },
      { id: 'org-2', name: 'Org Two', active: false, role: 'viewer' },
    ]
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')

    const option = wrapper.find('[data-testid="church-switcher-option"]')
    expect(option.text()).toContain('(deactivated)')
    expect(option.attributes('disabled')).toBeDefined()
  })

  it('surfaces a failed switch through the notification store with variant error and keeps the panel open', async () => {
    mockMemberships = twoOrgs
    mockOrgId = 'org-1'
    mockSelectOrg.mockImplementation(() => Promise.reject(new Error('boom')))
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')

    await wrapper.find('[data-testid="church-switcher-option"]').trigger('click')
    await flushPromises()

    expect(mockToastPush).toHaveBeenCalledWith(
      'Could not switch churches. Please try again.',
      { variant: 'error' },
    )
    // Panel stays open on failure.
    expect(wrapper.find('[data-testid="church-switcher-panel"]').exists()).toBe(true)
  })

  it('Escape closes the panel', async () => {
    mockMemberships = twoOrgs
    const wrapper = mountSidebar()
    await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="church-switcher-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="church-switcher-panel"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="church-switcher-panel"]').exists()).toBe(false)
  })
})
