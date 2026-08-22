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
})
