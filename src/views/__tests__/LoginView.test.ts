/**
 * Phase 100-01 (R292) — fresh test file for LoginView.vue (no prior test
 * existed). Mounts against real source with `vue-router`'s useRouter and
 * `@/stores/auth` mocked, mirroring OrganizationsTab.test.ts's
 * mount/flushPromises/enableAutoUnmount harness. Covers only what this
 * plan changed: the new `auth/operation-not-allowed` mapping and the
 * discoverability hint. Does NOT assert on loginWithEmail's auto-create
 * internals — out of scope, unchanged by R294.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import LoginView from '../LoginView.vue'

enableAutoUnmount(afterEach)

const mockPush = vi.fn(() => Promise.resolve())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockLoginWithEmail = vi.fn()
const mockLoginWithGoogle = vi.fn()
const mockResetPassword = vi.fn()

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    loginWithEmail: mockLoginWithEmail,
    loginWithGoogle: mockLoginWithGoogle,
    resetPassword: mockResetPassword,
  }),
}))

describe('LoginView', () => {
  it('maps auth/operation-not-allowed to the actionable admin-enable message', async () => {
    mockLoginWithEmail.mockRejectedValueOnce({ code: 'auth/operation-not-allowed' })
    const wrapper = mount(LoginView)

    await wrapper.find('input#email').setValue('invitee@example.com')
    await wrapper.find('input#password').setValue('whatever')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain(
      "Email/password sign-in isn't enabled for this app yet — ask your administrator to enable it.",
    )
  })

  it('leaves existing error mappings unchanged (regression guard)', async () => {
    mockLoginWithEmail.mockRejectedValueOnce({ code: 'auth/wrong-password' })
    const wrapper = mount(LoginView)

    await wrapper.find('input#email').setValue('user@example.com')
    await wrapper.find('input#password').setValue('wrong')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Incorrect password. Try again or reset your password.')
  })

  it('shows a discoverability hint on the sign-in form (showForgotPassword false)', () => {
    const wrapper = mount(LoginView)
    expect(wrapper.text()).toContain('Open the link we sent')
    expect(wrapper.text()).toContain('reset it below')
  })

  it('hides the discoverability hint once the reset form is shown', async () => {
    const wrapper = mount(LoginView)
    await wrapper.find('button[type="button"]').trigger('click')
    expect(wrapper.text()).not.toContain('Open the link we sent')
  })
})
