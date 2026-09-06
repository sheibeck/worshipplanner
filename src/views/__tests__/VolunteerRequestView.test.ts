// Phase 128-02 (R394/R395/R399) — VolunteerRequestView.vue, the public
// /:slug/volunteer self-service request page. Mirrors ShareView.test.ts's
// getDoc/doc mocking idiom; adds an httpsCallable mock for the
// requestVolunteerLink invocation contract from 128-01.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const mockRouteParams: Record<string, string | undefined> = { slug: 'grace-church' }
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: mockRouteParams })),
}))

vi.mock('@/firebase', () => ({
  db: {},
  functions: {},
}))

const mockGetDoc = vi.fn()
const mockDoc = vi.fn((...args: unknown[]) => {
  const segments = args.slice(1) as string[]
  return { id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') }
})
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

const mockCallable = vi.fn()
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}))

import VolunteerRequestView from '../VolunteerRequestView.vue'

describe('VolunteerRequestView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteParams.slug = 'grace-church'
  })

  it('shows the request form with the resolved church name after a found slug', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A', name: 'Grace Church' }),
    })
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    expect(wrapper.text()).toContain('Grace Church')
    expect(wrapper.text()).toContain('Send my sign-in link')
    expect(wrapper.find('input#volunteer-request-email').exists()).toBe(true)
  })

  it('shows the request form gracefully when the slug doc has no name field (legacy claim)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A' }),
    })
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    expect(wrapper.text()).toContain('Enter your email to get a sign-in link.')
    expect(wrapper.find('input#volunteer-request-email').exists()).toBe(true)
  })

  it('shows the church-not-found state for an unknown slug', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false })
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    expect(wrapper.text()).toContain("We couldn't find that church")
    expect(wrapper.find('input#volunteer-request-email').exists()).toBe(false)
  })

  it('shows the church-not-found state when getDoc rejects', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    expect(wrapper.text()).toContain("We couldn't find that church")
  })

  it('blocks the callable on an invalid email and shows the inline validation message', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A', name: 'Grace Church' }),
    })
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    await wrapper.find('input#volunteer-request-email').setValue('not-an-email')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Enter a valid email address.')
    expect(mockCallable).not.toHaveBeenCalled()
  })

  it('calls requestVolunteerLink with { orgId, email, slug } and renders the confirmation on resolve', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A', name: 'Grace Church' }),
    })
    mockCallable.mockResolvedValueOnce({ data: { message: 'anything at all' } })
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    await wrapper.find('input#volunteer-request-email').setValue('volunteer@example.com')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockCallable).toHaveBeenCalledWith({
      orgId: 'org-A',
      email: 'volunteer@example.com',
      slug: 'grace-church',
    })
    expect(wrapper.text()).toContain('Check your email')
    expect(wrapper.text()).toContain("Grace Church's team")
  })

  it('renders the identical confirmation regardless of the resolved message value (no branching on response, R395)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A', name: 'Grace Church' }),
    })
    mockCallable.mockResolvedValueOnce({ data: { message: 'roster-miss internal detail' } })
    const wrapperA = mount(VolunteerRequestView)
    await flushPromises()
    await wrapperA.find('input#volunteer-request-email').setValue('a@example.com')
    await wrapperA.find('form').trigger('submit.prevent')
    await flushPromises()
    const confirmationA = wrapperA.text()

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A', name: 'Grace Church' }),
    })
    mockCallable.mockResolvedValueOnce({ data: { message: 'roster-hit internal detail' } })
    const wrapperB = mount(VolunteerRequestView)
    await flushPromises()
    await wrapperB.find('input#volunteer-request-email').setValue('b@example.com')
    await wrapperB.find('form').trigger('submit.prevent')
    await flushPromises()
    const confirmationB = wrapperB.text()

    expect(confirmationA).toBe(confirmationB)
  })

  it('shows the generic failure message on a rejected submit (never a roster-revealing message)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ orgId: 'org-A', name: 'Grace Church' }),
    })
    mockCallable.mockRejectedValueOnce(new Error('internal'))
    const wrapper = mount(VolunteerRequestView)
    await flushPromises()

    await wrapper.find('input#volunteer-request-email').setValue('volunteer@example.com')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Something went wrong. Please try again in a moment.')
    expect(wrapper.text()).not.toContain('Check your email')
  })
})
