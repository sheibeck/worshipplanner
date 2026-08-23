/**
 * v2.0 — SelectChurchView is the login church-picker shown to a signed-in user
 * who belongs to more than one org (choose which to enter) or to none (empty
 * state). Mocks the auth store + vue-router (mount-only harness, mirrors the
 * OwnerConsoleView.test.ts vue-router mock pattern).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import SelectChurchView from '../SelectChurchView.vue'

enableAutoUnmount(afterEach)

const mockPush = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

const selectOrg = vi.fn(() => Promise.resolve())
const logout = vi.fn(() => Promise.resolve())
let mockStore: Record<string, unknown>
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockStore),
}))

beforeEach(() => {
  mockPush.mockClear()
  selectOrg.mockClear()
  logout.mockClear()
})

describe('SelectChurchView', () => {
  it('renders one option per church and selecting one activates it, then navigates home', async () => {
    mockStore = {
      memberships: [
        { id: 'org-1', name: 'Org One' },
        { id: 'org-2', name: 'Org Two' },
      ],
      selectOrg,
      logout,
    }
    const wrapper = mount(SelectChurchView)

    const options = wrapper.findAll('[data-testid="church-option"]')
    expect(options).toHaveLength(2)
    expect(wrapper.text()).toContain('Org One')
    expect(wrapper.text()).toContain('Org Two')

    await options[1]!.trigger('click')
    await flushPromises()

    expect(selectOrg).toHaveBeenCalledWith('org-2')
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('shows the empty state (no options) when the user belongs to no church', () => {
    mockStore = { memberships: [], selectOrg, logout }
    const wrapper = mount(SelectChurchView)

    expect(wrapper.find('[data-testid="church-option"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="no-church"]').exists()).toBe(true)
  })

  it('logs out and returns to the login screen', async () => {
    mockStore = { memberships: [], selectOrg, logout }
    const wrapper = mount(SelectChurchView)

    await wrapper.get('[data-testid="logout"]').trigger('click')
    await flushPromises()

    expect(logout).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  // ── 76-02 (R213) ───────────────────────────────────────────────────────
  describe('deactivated org greying (R213, Phase 76)', () => {
    it('greys out and labels a deactivated membership; clicking it never calls selectOrg', async () => {
      mockStore = {
        memberships: [
          { id: 'org-1', name: 'Org One', active: true },
          { id: 'org-2', name: 'Org Two', active: false },
        ],
        selectOrg,
        logout,
      }
      const wrapper = mount(SelectChurchView)
      const options = wrapper.findAll('[data-testid="church-option"]')
      expect(options).toHaveLength(2)

      expect(options[0]!.attributes('disabled')).toBeUndefined()
      expect(options[0]!.text()).not.toContain('(deactivated)')

      expect(options[1]!.attributes('disabled')).toBeDefined()
      expect(options[1]!.text()).toContain('(deactivated)')

      await options[1]!.trigger('click')
      await flushPromises()
      expect(selectOrg).not.toHaveBeenCalled()
    })

    it('treats a membership fixture with no active key at all as enabled — proves the === false guard, not truthiness', async () => {
      mockStore = {
        memberships: [{ id: 'org-1', name: 'Org One' }],
        selectOrg,
        logout,
      }
      const wrapper = mount(SelectChurchView)
      const option = wrapper.get('[data-testid="church-option"]')
      expect(option.attributes('disabled')).toBeUndefined()
      expect(option.text()).not.toContain('(deactivated)')

      await option.trigger('click')
      await flushPromises()
      expect(selectOrg).toHaveBeenCalledWith('org-1')
    })

    it('renders the store deactivated message when set', () => {
      mockStore = {
        memberships: [],
        selectOrg,
        logout,
        deactivatedOrgMessage: 'This church is deactivated — contact your administrator.',
      }
      const wrapper = mount(SelectChurchView)
      expect(wrapper.find('[data-testid="deactivated-message"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('This church is deactivated — contact your administrator.')
    })

    it('does not render the deactivated message block when the store omits the field', () => {
      mockStore = { memberships: [], selectOrg, logout }
      const wrapper = mount(SelectChurchView)
      expect(wrapper.find('[data-testid="deactivated-message"]').exists()).toBe(false)
    })

    it('does not render the deactivated message block when the field is null', () => {
      mockStore = { memberships: [], selectOrg, logout, deactivatedOrgMessage: null }
      const wrapper = mount(SelectChurchView)
      expect(wrapper.find('[data-testid="deactivated-message"]').exists()).toBe(false)
    })
  })
})
