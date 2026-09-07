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
import { setActivePinia, createPinia } from 'pinia'
import AppSidebar from '../AppSidebar.vue'
import { useToasts } from '@/stores/toasts'

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
// 130-REVIEW WR-01 — churchless super-admin state (Owner Console, no active
// church). A getter (not a static field) so tests can flip it independently
// of mockOrgName, matching the template's own `v-if` condition.
let mockSuperAdminOutsideOwnChurch = false
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
    get superAdminOutsideOwnChurch() {
      return mockSuperAdminOutsideOwnChurch
    },
    user: { uid: 'test-uid', email: 'viewer@example.com', displayName: 'Viewer User' },
    logout: mockLogout,
    selectOrg: mockSelectOrg,
  }),
}))

// 104-REVIEW IN-02: @/stores/toasts is deliberately NOT mocked (unlike
// @/stores/auth above). Mocking it out entirely — as this file used to —
// meant no test exercised the real store's sticky-vs-transient `push()`
// branching, which is exactly why WR-02 (a `{ variant: 'error' }` opts
// object that accidentally suppressed the auto-dismiss timer) shipped
// without a failing test. Using the real Pinia-backed store below lets the
// "surfaces a failed switch..." test assert the toast's actual lifetime, not
// just the call arguments.

// Phase 130 (R404) — the volunteer church-name label reads from mySchedule.
// Mock mirrors mySchedule.ts's own churches derivation (distinct orgId, first
// occurrence, orgName carried as-is) so tests only ever set docs/selectedChurch.
const mockLoadMySchedule = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
const mockSetSelectedChurch = vi.fn((orgId: string) => {
  mockSelectedChurch = orgId
})
let mockMyScheduleDocs: { orgId: string; orgName?: string }[] = []
let mockMyScheduleLoading = false
let mockSelectedChurch: string | null = null
vi.mock('@/stores/mySchedule', () => ({
  useMyScheduleStore: () => ({
    get docs() {
      return mockMyScheduleDocs
    },
    get isLoading() {
      return mockMyScheduleLoading
    },
    get selectedChurch() {
      return mockSelectedChurch
    },
    get churches() {
      const byOrgId = new Map<string, string | undefined>()
      for (const d of mockMyScheduleDocs) {
        if (!byOrgId.has(d.orgId)) byOrgId.set(d.orgId, d.orgName)
      }
      return [...byOrgId.entries()].map(([orgId, orgName]) => ({ orgId, orgName }))
    },
    loadMySchedule: mockLoadMySchedule,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    setSelectedChurch: mockSetSelectedChurch,
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockOrgId = 'org-1'
  mockOrgName = 'Test Church'
  mockIsEditor = false
  mockIsSuperAdmin = false
  mockMemberships = []
  mockViewingAsSuperAdmin = null
  mockSuperAdminOutsideOwnChurch = false
  mockRouterPush.mockClear()
  mockLogout.mockClear()
  mockSelectOrg.mockClear()
  mockSelectOrg.mockImplementation(() => Promise.resolve())
  mockMyScheduleDocs = []
  mockMyScheduleLoading = false
  mockSelectedChurch = null
  mockLoadMySchedule.mockClear()
  mockSubscribe.mockClear()
  mockUnsubscribe.mockClear()
  mockSetSelectedChurch.mockClear()
})

function mountSidebar() {
  return mount(AppSidebar, { props: { sidebarOpen: true } })
}

describe('AppSidebar — My Schedule nav entry (always visible, no gating)', () => {
  it('shows the My Schedule link pointing at /my-schedule for a non-editor viewer', () => {
    mockIsEditor = false
    mockOrgId = 'org-1'
    const wrapper = mountSidebar()

    const link = wrapper.find('[to="/my-schedule"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('My Schedule')
  })

  it('still shows the My Schedule link for an editor and when orgId is null', () => {
    mockIsEditor = true
    mockOrgId = null
    const wrapper = mountSidebar()

    expect(wrapper.find('[to="/my-schedule"]').exists()).toBe(true)
  })
})

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

  it('surfaces a failed switch through the notification store with variant error, keeps the panel open, and auto-dismisses the toast (104-REVIEW WR-02/IN-02)', async () => {
    vi.useFakeTimers()
    try {
      mockMemberships = twoOrgs
      mockOrgId = 'org-1'
      mockSelectOrg.mockImplementation(() => Promise.reject(new Error('boom')))
      const wrapper = mountSidebar()
      await wrapper.find('[data-testid="church-switcher-trigger"]').trigger('click')

      await wrapper.find('[data-testid="church-switcher-option"]').trigger('click')
      await flushPromises()

      // Real store (not mocked) — asserts the actual resulting toast, not just
      // the call arguments a mock would have recorded.
      const toasts = useToasts()
      expect(toasts.toasts).toHaveLength(1)
      expect(toasts.toasts[0]).toMatchObject({
        message: 'Could not switch churches. Please try again.',
        variant: 'error',
      })
      // Panel stays open on failure.
      expect(wrapper.find('[data-testid="church-switcher-panel"]').exists()).toBe(true)

      // WR-02: push() called with no opts must arm the historical 6000ms
      // auto-dismiss timer — it must NOT stay stuck on screen forever.
      vi.advanceTimersByTime(5999)
      expect(toasts.toasts).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(toasts.toasts).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
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

/**
 * Phase 130 Plan 02 (R404). The volunteer church-name label — a NEW
 * v-else-if sibling of the admin org-name block, sourced from mySchedule.
 * The admin path must render byte-identically; the volunteer branch only
 * ever shows when authStore.orgName is falsy.
 */
describe('AppSidebar — volunteer church-name label (R404, Phase 130)', () => {
  it('renders the admin org-name path unchanged, never the volunteer branch, when authStore.orgName is set', () => {
    mockOrgName = 'Test Church'
    mockMyScheduleDocs = [{ orgId: 'org-9', orgName: 'Should Not Show' }]
    const wrapper = mountSidebar()

    expect(wrapper.text()).toContain('Test Church')
    expect(wrapper.find('[data-testid="volunteer-church-label"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Should Not Show')
  })

  it('shows the single church name for a zero-membership volunteer', () => {
    mockOrgName = null
    mockMyScheduleDocs = [{ orgId: 'org-1', orgName: 'Grace Fellowship' }]
    const wrapper = mountSidebar()

    expect(wrapper.get('[data-testid="volunteer-church-label"]').text()).toBe('Grace Fellowship')
  })

  it('falls back to "Your church" when the single church has no orgName', () => {
    mockOrgName = null
    mockMyScheduleDocs = [{ orgId: 'org-1', orgName: undefined }]
    const wrapper = mountSidebar()

    expect(wrapper.get('[data-testid="volunteer-church-label"]').text()).toBe('Your church')
  })

  it('falls back to the first church name for a multi-church volunteer before a selection resolves (never "Multiple churches")', () => {
    mockOrgName = null
    mockMyScheduleDocs = [
      { orgId: 'org-1', orgName: 'Grace Fellowship' },
      { orgId: 'org-2', orgName: 'Hillside Chapel' },
    ]
    mockSelectedChurch = null
    const wrapper = mountSidebar()

    const label = wrapper.get('[data-testid="volunteer-church-label"]').text()
    expect(label).toBe('Grace Fellowship')
    expect(label).not.toBe('Multiple churches')
  })

  it('shows the selected church name for a multi-church volunteer with a specific church selected', () => {
    mockOrgName = null
    mockMyScheduleDocs = [
      { orgId: 'org-1', orgName: 'Grace Fellowship' },
      { orgId: 'org-2', orgName: 'Hillside Chapel' },
    ]
    mockSelectedChurch = 'org-2'
    const wrapper = mountSidebar()

    expect(wrapper.get('[data-testid="volunteer-church-label"]').text()).toBe('Hillside Chapel')
  })

  it('renders nothing in the org-name slot for a volunteer with zero rehearseAccess docs', () => {
    mockOrgName = null
    mockMyScheduleDocs = []
    const wrapper = mountSidebar()

    expect(wrapper.find('[data-testid="volunteer-church-label"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Multiple churches')
    expect(wrapper.text()).not.toContain('Your church')
  })
})

/**
 * Phase 130 rework (Change B). The volunteer church switcher — an admin-style
 * lower-left switcher for a ZERO-membership volunteer serving >1 church. It
 * mirrors the admin switcher's trigger/panel/aria pattern but selects via
 * mySchedule.setSelectedChurch() ONLY, and must NEVER call authStore.selectOrg.
 * The admin path (memberships > 1) must be completely undisturbed.
 */
describe('AppSidebar — volunteer church switcher (Change B, Phase 130 rework)', () => {
  const twoChurches = [
    { orgId: 'org-1', orgName: 'Grace Fellowship' },
    { orgId: 'org-2', orgName: 'Hillside Chapel' },
  ]

  it('renders the switcher trigger for a zero-membership volunteer serving more than one church', () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = twoChurches
    mockSelectedChurch = 'org-1'
    const wrapper = mountSidebar()

    const trigger = wrapper.find('[data-testid="volunteer-church-switcher-trigger"]')
    expect(trigger.exists()).toBe(true)
    // Trigger shows the SELECTED church's name.
    expect(trigger.text()).toContain('Grace Fellowship')
    // The admin switcher must NOT render for a zero-membership session.
    expect(wrapper.find('[data-testid="church-switcher-trigger"]').exists()).toBe(false)
  })

  it('renders NO switcher for a single-church volunteer — static label only', () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = [{ orgId: 'org-1', orgName: 'Grace Fellowship' }]
    mockSelectedChurch = 'org-1'
    const wrapper = mountSidebar()

    expect(wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="volunteer-church-label"]').text()).toBe('Grace Fellowship')
  })

  it('renders NO switcher for a volunteer with zero churches', () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = []
    const wrapper = mountSidebar()

    expect(wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').exists()).toBe(false)
  })

  it('renders NO volunteer switcher for a multi-org admin (memberships > 1) — the admin path is undisturbed', () => {
    mockOrgName = 'Test Church'
    mockMemberships = [
      { id: 'org-1', name: 'Org One', active: true, role: 'editor' },
      { id: 'org-2', name: 'Org Two', active: true, role: 'viewer' },
    ]
    // Even if the volunteer store somehow has multi-church docs, the admin
    // switcher wins and the volunteer switcher never renders.
    mockMyScheduleDocs = twoChurches
    const wrapper = mountSidebar()

    expect(wrapper.find('[data-testid="church-switcher-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').exists()).toBe(false)
  })

  it('opens the panel, lists each church, and marks the selected one as the non-interactive current row', async () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = twoChurches
    mockSelectedChurch = 'org-1'
    const wrapper = mountSidebar()

    await wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').trigger('click')

    const panel = wrapper.find('[data-testid="volunteer-church-switcher-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('Grace Fellowship')
    expect(panel.text()).toContain('Hillside Chapel')

    const current = wrapper.find('[data-testid="volunteer-church-switcher-current"]')
    expect(current.text()).toContain('Grace Fellowship')
    expect(current.attributes('aria-current')).toBe('true')
    expect(current.element.tagName).not.toBe('BUTTON')

    // Only the non-selected church is an interactive option.
    const options = wrapper.findAll('[data-testid="volunteer-church-switcher-option"]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('Hillside Chapel')
  })

  it('clicking another church calls setSelectedChurch with that orgId and NEVER authStore.selectOrg', async () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = twoChurches
    mockSelectedChurch = 'org-1'
    const wrapper = mountSidebar()

    await wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').trigger('click')
    await wrapper.find('[data-testid="volunteer-church-switcher-option"]').trigger('click')

    expect(mockSetSelectedChurch).toHaveBeenCalledWith('org-2')
    expect(mockSelectOrg).not.toHaveBeenCalled()
    // Panel closes after a selection.
    expect(wrapper.find('[data-testid="volunteer-church-switcher-panel"]').exists()).toBe(false)
    // Switching church returns to My Schedule (a service open from the previous
    // church is no longer in scope) and closes the mobile sidebar.
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'my-schedule' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('labels a church with no orgName as "Unnamed church" in the panel', async () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = [
      { orgId: 'org-1', orgName: 'Grace Fellowship' },
      { orgId: 'org-2', orgName: undefined },
    ]
    mockSelectedChurch = 'org-1'
    const wrapper = mountSidebar()

    await wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="volunteer-church-switcher-option"]').text()).toContain('Unnamed church')
  })

  it('Escape closes the panel', async () => {
    mockOrgName = null
    mockMemberships = []
    mockMyScheduleDocs = twoChurches
    mockSelectedChurch = 'org-1'
    const wrapper = mountSidebar()

    await wrapper.find('[data-testid="volunteer-church-switcher-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="volunteer-church-switcher-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="volunteer-church-switcher-panel"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="volunteer-church-switcher-panel"]').exists()).toBe(false)
  })
})

/**
 * 130-REVIEW WR-01 (adapted for Change A). The cold-render `onMounted` guard
 * now establishes the live subscription (`mySchedule.subscribe()`) for a
 * signed-in volunteer that hasn't yet visited My Schedule, but must skip firing
 * for a churchless super-admin (Owner Console) — matching the org-name block's
 * own `v-if` condition (`authStore.orgName || authStore.superAdminOutsideOwnChurch`).
 */
describe('AppSidebar — cold-render subscribe guard (WR-01, Phase 130 review)', () => {
  it('fires subscribe for a signed-in volunteer with no orgName and no cached docs', () => {
    mockOrgName = null
    mockSuperAdminOutsideOwnChurch = false
    mockMyScheduleDocs = []
    mockMyScheduleLoading = false
    mountSidebar()

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire subscribe for a super-admin outside their own church, even with no orgName', () => {
    mockOrgName = null
    mockSuperAdminOutsideOwnChurch = true
    mockMyScheduleDocs = []
    mockMyScheduleLoading = false
    mountSidebar()

    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('does NOT fire subscribe when authStore.orgName is already set (admin session)', () => {
    mockOrgName = 'Test Church'
    mockSuperAdminOutsideOwnChurch = false
    mockMyScheduleDocs = []
    mockMyScheduleLoading = false
    mountSidebar()

    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('does NOT fire subscribe when docs are already cached', () => {
    mockOrgName = null
    mockSuperAdminOutsideOwnChurch = false
    mockMyScheduleDocs = [{ orgId: 'org-1', orgName: 'Grace Fellowship' }]
    mockMyScheduleLoading = false
    mountSidebar()

    expect(mockSubscribe).not.toHaveBeenCalled()
  })
})
