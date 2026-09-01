/**
 * Phase 78-02 (R227) — fresh test file for AppShell.vue (no prior file
 * existed). Mirrors OwnerConsoleView.test.ts's mount/flushPromises/
 * enableAutoUnmount/setActivePinia harness and its
 * `vi.mock('vue-router', ...)` shape (a spy-able `push`). AppSidebar.vue is
 * mounted for real as AppShell's child (not stubbed) and itself calls
 * `useRoute()`, so the vue-router mock also provides a minimal `useRoute`
 * even though AppShell's own script only needs `useRouter`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '../AppShell.vue'

enableAutoUnmount(afterEach)

const mockRouterPush = vi.fn(() => Promise.resolve())

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ path: '/services' })),
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
}))

// ── @/stores/auth mock — plain object exposing viewingAsSuperAdmin/orgName
//    (mutable test-local values) and a spy-able exitSuperAdminView. Also
//    exposes the handful of fields AppSidebar.vue (mounted for real as
//    AppShell's child) reads, matching its real store shape loosely enough
//    that it renders without crashing. ──
const mockExitSuperAdminView = vi.fn()
let mockViewingAsSuperAdmin: string | null = null
let mockOrgName: string | null = null

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get viewingAsSuperAdmin() {
      return mockViewingAsSuperAdmin
    },
    get orgName() {
      return mockOrgName
    },
    exitSuperAdminView: mockExitSuperAdminView,
    isEditor: false,
    isSuperAdmin: false,
    // Phase 104 (R311) — AppSidebar.vue's church-switcher gate reads
    // memberships/orgId; a single-membership array here keeps the switcher
    // inactive (matching this file's pre-104 no-switcher rendering) while
    // still exercising the real, non-crashing shape.
    memberships: [],
    orgId: null,
    superAdminOutsideOwnChurch: false,
    user: { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User' },
    logout: vi.fn(),
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockRouterPush.mockClear()
  mockExitSuperAdminView.mockClear()
  mockViewingAsSuperAdmin = null
  mockOrgName = null
})

async function mountShell() {
  const wrapper = mount(AppShell, {
    slots: { default: '<div data-testid="page-content">Page</div>' },
  })
  await flushPromises()
  return wrapper
}

describe('AppShell -- viewing-as-super-admin banner (R227, Phase 78)', () => {
  it('renders no banner when viewingAsSuperAdmin is null', async () => {
    const wrapper = await mountShell()
    expect(wrapper.text()).not.toContain('as super-admin')
    expect(wrapper.text()).not.toContain('Exit to owner console')
  })

  it('renders "Viewing <name> as super-admin" when viewingAsSuperAdmin is set and orgName is populated', async () => {
    mockViewingAsSuperAdmin = 'church-x'
    mockOrgName = 'Grace Church'
    const wrapper = await mountShell()

    expect(wrapper.text()).toContain('Viewing')
    expect(wrapper.text()).toContain('Grace Church')
    expect(wrapper.text()).toContain('as super-admin')
  })

  it('falls back to the raw orgId when orgName is not yet populated', async () => {
    mockViewingAsSuperAdmin = 'church-x'
    mockOrgName = null
    const wrapper = await mountShell()

    expect(wrapper.text()).toContain('church-x')
    expect(wrapper.text()).toContain('as super-admin')
  })

  it('clicking "Exit to owner console" calls exitSuperAdminView() and router.push(\'/owner-console\')', async () => {
    mockViewingAsSuperAdmin = 'church-x'
    mockOrgName = 'Grace Church'
    const wrapper = await mountShell()

    const exitButton = wrapper.findAll('button').find((b) => b.text() === 'Exit to owner console')!
    await exitButton.trigger('click')

    expect(mockExitSuperAdminView).toHaveBeenCalledOnce()
    expect(mockRouterPush).toHaveBeenCalledWith('/owner-console')
  })

  it('still renders the default slot content alongside the banner', async () => {
    mockViewingAsSuperAdmin = 'church-x'
    const wrapper = await mountShell()
    expect(wrapper.find('[data-testid="page-content"]').exists()).toBe(true)
  })
})
