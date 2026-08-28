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
import { mount, enableAutoUnmount } from '@vue/test-utils'
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
const mockLogout = vi.fn(() => Promise.resolve())

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
    superAdminOutsideOwnChurch: null,
    viewingAsSuperAdmin: null,
    user: { uid: 'test-uid', email: 'viewer@example.com', displayName: 'Viewer User' },
    logout: mockLogout,
  }),
}))

beforeEach(() => {
  mockOrgId = 'org-1'
  mockOrgName = 'Test Church'
  mockIsEditor = false
  mockIsSuperAdmin = false
  mockRouterPush.mockClear()
  mockLogout.mockClear()
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
