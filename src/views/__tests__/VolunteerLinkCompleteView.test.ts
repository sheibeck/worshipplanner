// Phase 128-02 (R399) — VolunteerLinkCompleteView.vue's "Request a new link"
// recovery affordance. Mocks useRouter/useRoute and the volunteerAuth store
// into its error state; asserts the button's navigation target.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'

enableAutoUnmount(afterEach)

const mockPush = vi.fn(() => Promise.resolve())
const mockRouteQuery: Record<string, string | undefined> = {}
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: mockRouteQuery }),
}))

const mockCompleteSignIn = vi.fn()
const mockVolunteerAuth = {
  errorMessage: '',
  needsEmailReentry: false,
  completeSignIn: mockCompleteSignIn,
}
vi.mock('@/stores/volunteerAuth', () => ({
  useVolunteerAuthStore: () => mockVolunteerAuth,
}))

import VolunteerLinkCompleteView from '../VolunteerLinkCompleteView.vue'

describe('VolunteerLinkCompleteView — "Request a new link" (R399)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVolunteerAuth.errorMessage = ''
    mockVolunteerAuth.needsEmailReentry = false
    delete mockRouteQuery.slug
    mockCompleteSignIn.mockResolvedValue(false)
  })

  it('renders the button in the error state and targets volunteer-request with the query slug', async () => {
    mockRouteQuery.slug = 'grace-church'
    mockVolunteerAuth.errorMessage = 'This link is invalid or has expired.'
    const wrapper = mount(VolunteerLinkCompleteView)
    await flushPromises()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Request a new link')
    expect(button).toBeTruthy()

    await button!.trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'volunteer-request',
      params: { slug: 'grace-church' },
    })
  })

  it('falls back to volunteer-home when route.query.slug is absent', async () => {
    mockVolunteerAuth.errorMessage = 'This link is invalid or has expired.'
    const wrapper = mount(VolunteerLinkCompleteView)
    await flushPromises()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Request a new link')
    expect(button).toBeTruthy()

    await button!.trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'volunteer-home' })
  })

  it('does not render the affordance while verifying', async () => {
    mockCompleteSignIn.mockImplementation(() => new Promise(() => {})) // never resolves
    const wrapper = mount(VolunteerLinkCompleteView)
    // Still in the isVerifying=true tick — flushPromises not awaited so the
    // onMounted async work has not settled.
    const button = wrapper.findAll('button').find((b) => b.text() === 'Request a new link')
    expect(button).toBeFalsy()
  })

  it('does not render the affordance in the needsEmailReentry state', async () => {
    mockVolunteerAuth.needsEmailReentry = true
    const wrapper = mount(VolunteerLinkCompleteView)
    await flushPromises()

    const button = wrapper.findAll('button').find((b) => b.text() === 'Request a new link')
    expect(button).toBeFalsy()
  })
})
