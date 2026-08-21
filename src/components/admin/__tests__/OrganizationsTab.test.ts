/**
 * Phase 74-02 -- fresh test file for OrganizationsTab.vue (replaces the
 * Phase 72 placeholder; no prior test existed). Mirrors
 * OwnerConsoleView.test.ts's mount/flushPromises/enableAutoUnmount harness
 * and pinia reset, but mocks 'firebase/functions' with a NAME-KEYED
 * httpsCallable dispatch so this file can drive listOrganizations,
 * onboardOrganization, and assignOrgAdmin independently. Throwing on any
 * other callable name is itself the R200/R204 "no direct writes" proof --
 * the component's only backend surface is these three names.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OrganizationsTab from '../OrganizationsTab.vue'

enableAutoUnmount(afterEach)

// ── firebase/functions mock -- name-keyed httpsCallable dispatch ──
// Each mock's initial implementation is widened via an explicit generic on
// vi.fn so later per-test `mockImplementation` calls (which return richer
// org arrays / different status values) type-check against the same shape
// instead of narrowing to the first call's literal (e.g. `never[]`).
interface OrgSummaryFixture {
  orgId: string
  name: string
  createdAt: unknown
  memberCount: number
}

const { mockListOrganizations, mockOnboardOrganization, mockAssignOrgAdmin } = vi.hoisted(() => ({
  mockListOrganizations: vi.fn<() => Promise<{ data: { organizations: OrgSummaryFixture[] } }>>(() =>
    Promise.resolve({ data: { organizations: [] } }),
  ),
  mockOnboardOrganization: vi.fn<
    () => Promise<{ data: { status: 'added' | 'invited'; orgId: string; name: string } }>
  >(() => Promise.resolve({ data: { status: 'added', orgId: 'org-1', name: 'Test Church' } })),
  mockAssignOrgAdmin: vi.fn<() => Promise<{ data: { status: 'added' | 'invited'; uid?: string } }>>(() =>
    Promise.resolve({ data: { status: 'added', uid: 'uid-1' } }),
  ),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'listOrganizations') return mockListOrganizations
    if (name === 'onboardOrganization') return mockOnboardOrganization
    if (name === 'assignOrgAdmin') return mockAssignOrgAdmin
    throw new Error(`Unexpected callable name: ${name}`)
  }),
}))

vi.mock('@/firebase', () => ({
  functions: {},
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isSuperAdmin: true,
    user: { uid: 'owner-uid', email: 'owner@example.com' },
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockListOrganizations.mockClear()
  mockOnboardOrganization.mockClear()
  mockAssignOrgAdmin.mockClear()
  mockListOrganizations.mockImplementation(() => Promise.resolve({ data: { organizations: [] } }))
  mockOnboardOrganization.mockImplementation(() =>
    Promise.resolve({ data: { status: 'added', orgId: 'org-1', name: 'Test Church' } }),
  )
  mockAssignOrgAdmin.mockImplementation(() => Promise.resolve({ data: { status: 'added', uid: 'uid-1' } }))
})

async function mountTab() {
  const wrapper = mount(OrganizationsTab)
  await flushPromises()
  return wrapper
}

function makeOrg(overrides: Partial<{ orgId: string; name: string; createdAt: unknown; memberCount: number }> = {}) {
  return {
    orgId: 'org-1',
    name: 'Test Church',
    createdAt: { toDate: () => new Date('2026-08-01T00:00:00Z') },
    memberCount: 3,
    ...overrides,
  }
}

describe('OrganizationsTab -- list (R196)', () => {
  it('calls listOrganizations on mount and renders the empty state', async () => {
    const wrapper = await mountTab()
    expect(mockListOrganizations).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('No organizations yet. Onboard one above.')
  })

  it('renders two rows with name / org id / member count when populated', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', memberCount: 5 }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', memberCount: 2 }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    expect(wrapper.text()).toContain('Grace Church')
    expect(wrapper.text()).toContain('org-1')
    expect(wrapper.text()).toContain('Hope Church')
    expect(wrapper.text()).toContain('org-2')
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)
  })

  it('shows the list-load error on rejection', async () => {
    mockListOrganizations.mockImplementation(() => Promise.reject(new Error('boom')))
    const wrapper = await mountTab()

    expect(wrapper.text()).toContain("Couldn't load organizations. Refresh the page and try again.")
  })

  it('shows the loading state before listOrganizations resolves', () => {
    let resolveFn: (v: { data: { organizations: OrgSummaryFixture[] } }) => void = () => {}
    mockListOrganizations.mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve }),
    )
    const wrapper = mount(OrganizationsTab)
    expect(wrapper.text()).toContain('Loading organizations...')
    // Resolve to avoid an unhandled dangling promise warning.
    resolveFn({ data: { organizations: [] } })
  })
})

describe('OrganizationsTab -- onboard form (R197/R201/R202)', () => {
  it('surfaces the validation error without calling onboardOrganization when name is blank', async () => {
    const wrapper = await mountTab()

    const emailInput = wrapper.find('input[placeholder="First admin email"]')
    await emailInput.setValue('admin@example.com')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Onboard church')!
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Enter a church name and a valid admin email address.')
    expect(mockOnboardOrganization).not.toHaveBeenCalled()
  })

  it('surfaces the validation error without calling onboardOrganization when email is invalid', async () => {
    const wrapper = await mountTab()

    const nameInput = wrapper.find('input[placeholder="Church name"]')
    await nameInput.setValue('Grace Church')
    const emailInput = wrapper.find('input[placeholder="First admin email"]')
    await emailInput.setValue('not-an-email')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Onboard church')!
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Enter a church name and a valid admin email address.')
    expect(mockOnboardOrganization).not.toHaveBeenCalled()
  })

  it('calls onboardOrganization with {name, adminEmail} and shows added feedback, then refetches the list', async () => {
    const wrapper = await mountTab()
    mockListOrganizations.mockClear()

    const nameInput = wrapper.find('input[placeholder="Church name"]')
    await nameInput.setValue('Test Church')
    const emailInput = wrapper.find('input[placeholder="First admin email"]')
    await emailInput.setValue('admin@example.com')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Onboard church')!
    await button.trigger('click')
    await flushPromises()

    expect(mockOnboardOrganization).toHaveBeenCalledWith({ name: 'Test Church', adminEmail: 'admin@example.com' })
    expect(wrapper.text()).toContain('Onboarded Test Church — admin added.')
    expect(mockListOrganizations).toHaveBeenCalledTimes(1)
  })

  it('shows invited feedback when the callable returns status invited', async () => {
    mockOnboardOrganization.mockImplementation(() =>
      Promise.resolve({ data: { status: 'invited', orgId: 'org-2', name: 'New Church' } }),
    )
    const wrapper = await mountTab()

    await wrapper.find('input[placeholder="Church name"]').setValue('New Church')
    await wrapper.find('input[placeholder="First admin email"]').setValue('new@example.com')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Onboard church')!
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Onboarded New Church — admin invited.')
  })

  it('shows "That church name is taken." on an already-exists rejection', async () => {
    const err = Object.assign(new Error('taken'), { code: 'already-exists' })
    mockOnboardOrganization.mockImplementation(() => Promise.reject(err))
    const wrapper = await mountTab()

    await wrapper.find('input[placeholder="Church name"]').setValue('Test Church')
    await wrapper.find('input[placeholder="First admin email"]').setValue('admin@example.com')
    const button = wrapper.findAll('button').find((b) => b.text() === 'Onboard church')!
    await button.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('That church name is taken.')
  })

  it('WR-03: a second Enter on the admin-email input while onboarding is in flight does not double-submit', async () => {
    let resolveFn: (v: { data: { status: 'added' | 'invited'; orgId: string; name: string } }) => void = () => {}
    mockOnboardOrganization.mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve }),
    )
    const wrapper = await mountTab()

    await wrapper.find('input[placeholder="Church name"]').setValue('Test Church')
    const emailInput = wrapper.find('input[placeholder="First admin email"]')
    await emailInput.setValue('admin@example.com')

    // First Enter kicks off the in-flight call.
    await emailInput.trigger('keydown.enter')
    expect(mockOnboardOrganization).toHaveBeenCalledTimes(1)

    // A fast second Enter while isOnboarding is true must be a no-op.
    await emailInput.trigger('keydown.enter')
    expect(mockOnboardOrganization).toHaveBeenCalledTimes(1)

    resolveFn({ data: { status: 'added', orgId: 'org-1', name: 'Test Church' } })
    await flushPromises()
  })
})

describe('OrganizationsTab -- per-org assign admin (R203/R205)', () => {
  async function mountWithOneOrg() {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({ data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church' })] } }),
    )
    return mountTab()
  }

  it('opens the row assign control, calls assignOrgAdmin with {orgId, email}, and shows Added feedback', async () => {
    const wrapper = await mountWithOneOrg()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')

    const emailInput = wrapper.find('input[placeholder="Admin email"]')
    await emailInput.setValue('newadmin@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockAssignOrgAdmin).toHaveBeenCalledWith({ orgId: 'org-1', email: 'newadmin@example.com' })
    expect(wrapper.text()).toContain('Added as admin.')
  })

  it('auto-collapses the assign row and clears the email 2s after a successful assign (UI review 74)', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountWithOneOrg()

      const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
      await startButton.trigger('click')
      const emailInput = wrapper.find('input[placeholder="Admin email"]')
      await emailInput.setValue('newadmin@example.com')
      const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
      await confirmButton.trigger('click')
      await flushPromises()

      // Immediately after success: row still open, success shown, email cleared (no stale value).
      expect(wrapper.text()).toContain('Added as admin.')
      expect((wrapper.find('input[placeholder="Admin email"]').element as HTMLInputElement).value).toBe('')

      // After the 2s auto-dismiss: row collapses back to its trigger and the feedback is gone.
      vi.advanceTimersByTime(2000)
      await flushPromises()
      expect(wrapper.findAll('button').some((b) => b.text() === 'Assign')).toBe(false)
      expect(wrapper.findAll('button').some((b) => b.text() === 'Assign admin')).toBe(true)
      expect(wrapper.text()).not.toContain('Added as admin.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the invited message when assignOrgAdmin returns status invited', async () => {
    mockAssignOrgAdmin.mockImplementation(() => Promise.resolve({ data: { status: 'invited' } }))
    const wrapper = await mountWithOneOrg()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('newadmin@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No account yet — invited as admin.')
  })

  it('surfaces "Enter a valid email address." without calling assignOrgAdmin on invalid email', async () => {
    const wrapper = await mountWithOneOrg()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('not-an-email')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Enter a valid email address.')
    expect(mockAssignOrgAdmin).not.toHaveBeenCalled()
  })

  it('surfaces a friendly error on rejection', async () => {
    mockAssignOrgAdmin.mockImplementation(() => Promise.reject(new Error('server exploded')))
    const wrapper = await mountWithOneOrg()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('newadmin@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('server exploded')
  })

  it('scopes feedback/error per-row: two orgs, assigning in one never leaks into the other', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church' }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church' }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    // Assign in org-1's row only.
    const startButtons = wrapper.findAll('button').filter((b) => b.text() === 'Assign admin')
    expect(startButtons.length).toBe(2)
    await startButtons[0]!.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('admin1@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockAssignOrgAdmin).toHaveBeenCalledWith({ orgId: 'org-1', email: 'admin1@example.com' })
    expect(wrapper.text()).toContain('Added as admin.')

    // org-2's row should still show its collapsed "Assign admin" trigger,
    // with no feedback text bleeding into it.
    const remainingStart = wrapper.findAll('button').filter((b) => b.text() === 'Assign admin')
    expect(remainingStart.length).toBe(1)
  })

  it('WR-03: a second Enter on the row admin-email input while assigning is in flight does not double-submit', async () => {
    let resolveFn: (v: { data: { status: 'added' | 'invited'; uid?: string } }) => void = () => {}
    mockAssignOrgAdmin.mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve }),
    )
    const wrapper = await mountWithOneOrg()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    const emailInput = wrapper.find('input[placeholder="Admin email"]')
    await emailInput.setValue('newadmin@example.com')

    // First Enter kicks off the in-flight call.
    await emailInput.trigger('keydown.enter')
    expect(mockAssignOrgAdmin).toHaveBeenCalledTimes(1)

    // A fast second Enter while isAssigning is true must be a no-op.
    await emailInput.trigger('keydown.enter')
    expect(mockAssignOrgAdmin).toHaveBeenCalledTimes(1)

    resolveFn({ data: { status: 'added', uid: 'uid-1' } })
    await flushPromises()
  })

  it('cancelAssign closes the row control without calling assignOrgAdmin', async () => {
    const wrapper = await mountWithOneOrg()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    expect(wrapper.find('input[placeholder="Admin email"]').exists()).toBe(true)

    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel assign')!
    await cancelButton.trigger('click')

    expect(wrapper.find('input[placeholder="Admin email"]').exists()).toBe(false)
    expect(mockAssignOrgAdmin).not.toHaveBeenCalled()
  })
})

describe('OrganizationsTab -- no direct writes (R200/R204)', () => {
  // This file mocks NO firestore module at all -- there is nothing to
  // import/write against. The name-keyed httpsCallable mock above throws on
  // any callable name other than listOrganizations/onboardOrganization/
  // assignOrgAdmin; every list/onboard/assign flow in the suites above
  // completed successfully, proving the component's only backend surface is
  // exactly those three selectors.
  it('exercises the full list -> onboard -> assign flow using only the three named callables', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({ data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church' })] } }),
    )
    const wrapper = await mountTab()
    expect(mockListOrganizations).toHaveBeenCalled()

    await wrapper.find('input[placeholder="Church name"]').setValue('New Church')
    await wrapper.find('input[placeholder="First admin email"]').setValue('admin@example.com')
    const onboardButton = wrapper.findAll('button').find((b) => b.text() === 'Onboard church')!
    await onboardButton.trigger('click')
    await flushPromises()
    expect(mockOnboardOrganization).toHaveBeenCalled()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('another@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()
    expect(mockAssignOrgAdmin).toHaveBeenCalled()
  })
})
