// VolunteerSignInView brand heading (R446).
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
}))

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: false }),
}))

import VolunteerSignInView from '../VolunteerSignInView.vue'

describe('VolunteerSignInView — brand (R446)', () => {
  it('R446: the brand heading reads WorshipBuilder', async () => {
    const wrapper = mount(VolunteerSignInView)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('WorshipBuilder')
  })
})
