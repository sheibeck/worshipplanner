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
import DeleteOrgConfirmDialog from '../DeleteOrgConfirmDialog.vue'

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
  pendingCount: number
  active: boolean
}

const {
  mockListOrganizations,
  mockOnboardOrganization,
  mockAssignOrgAdmin,
  mockSetOrgActive,
  mockDeleteOrganization,
  mockEnterOrgAsSuperAdmin,
} = vi.hoisted(() => ({
    mockListOrganizations: vi.fn<() => Promise<{ data: { organizations: OrgSummaryFixture[] } }>>(
      () => Promise.resolve({ data: { organizations: [] } }),
    ),
    // R224 (Phase 78) — spy-able so tests can assert on the Enter-church row action.
    mockEnterOrgAsSuperAdmin: vi.fn().mockResolvedValue(undefined),
    mockOnboardOrganization: vi.fn<
      () => Promise<{ data: { status: 'added' | 'invited'; orgId: string; name: string } }>
    >(() => Promise.resolve({ data: { status: 'added', orgId: 'org-1', name: 'Test Church' } })),
    mockAssignOrgAdmin: vi.fn<() => Promise<{ data: { status: 'added' | 'invited'; uid?: string } }>>(
      () => Promise.resolve({ data: { status: 'added', uid: 'uid-1' } }),
    ),
    // R212/R214 (Phase 76) — mirrors setOrgActiveHandler's response shape.
    mockSetOrgActive: vi.fn<
      () => Promise<{
        data: { orgId: string; active: boolean; memberCount: number; claimFailures: number }
      }>
    >(() =>
      Promise.resolve({ data: { orgId: 'org-1', active: false, memberCount: 3, claimFailures: 0 } }),
    ),
    // R220/R221 (Phase 77) — mirrors deleteOrganizationHandler's response shape.
    mockDeleteOrganization: vi.fn<
      () => Promise<{
        data: {
          orgId: string
          name: string
          membersUnlinked: number
          invitesDeleted: number
          orgNameDeleted: boolean
          shareDocsDeleted: number
          storageObjectsDeleted: number
        }
      }>
    >(() =>
      Promise.resolve({
        data: {
          orgId: 'org-1',
          name: 'Grace Church',
          membersUnlinked: 3,
          invitesDeleted: 1,
          orgNameDeleted: true,
          shareDocsDeleted: 2,
          storageObjectsDeleted: 4,
        },
      }),
    ),
  }))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'listOrganizations') return mockListOrganizations
    if (name === 'onboardOrganization') return mockOnboardOrganization
    if (name === 'assignOrgAdmin') return mockAssignOrgAdmin
    if (name === 'setOrgActive') return mockSetOrgActive
    if (name === 'deleteOrganization') return mockDeleteOrganization
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
    enterOrgAsSuperAdmin: mockEnterOrgAsSuperAdmin,
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockListOrganizations.mockClear()
  mockOnboardOrganization.mockClear()
  mockAssignOrgAdmin.mockClear()
  mockSetOrgActive.mockClear()
  mockDeleteOrganization.mockClear()
  mockEnterOrgAsSuperAdmin.mockClear()
  mockListOrganizations.mockImplementation(() => Promise.resolve({ data: { organizations: [] } }))
  mockOnboardOrganization.mockImplementation(() =>
    Promise.resolve({ data: { status: 'added', orgId: 'org-1', name: 'Test Church' } }),
  )
  mockAssignOrgAdmin.mockImplementation(() => Promise.resolve({ data: { status: 'added', uid: 'uid-1' } }))
  mockSetOrgActive.mockImplementation(() =>
    Promise.resolve({ data: { orgId: 'org-1', active: false, memberCount: 3, claimFailures: 0 } }),
  )
  mockDeleteOrganization.mockImplementation(() =>
    Promise.resolve({
      data: {
        orgId: 'org-1',
        name: 'Grace Church',
        membersUnlinked: 3,
        invitesDeleted: 1,
        orgNameDeleted: true,
        shareDocsDeleted: 2,
        storageObjectsDeleted: 4,
      },
    }),
  )
})

async function mountTab() {
  const wrapper = mount(OrganizationsTab, {
    global: {
      // R220 (Phase 77) — DeleteOrgConfirmDialog Teleports to body; same stub
      // used by CleanupConfigCard.test.ts for its own confirm dialog, renders
      // the teleported content inline so VTU's find/findAll/findComponent can
      // see it.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
  await flushPromises()
  return wrapper
}

function deleteDialogOf(wrapper: Awaited<ReturnType<typeof mountTab>>) {
  return wrapper.findComponent(DeleteOrgConfirmDialog)
}

function makeOrg(
  overrides: Partial<{
    orgId: string
    name: string
    createdAt: unknown
    memberCount: number
    pendingCount: number
    active: boolean
  }> = {},
) {
  return {
    orgId: 'org-1',
    name: 'Test Church',
    createdAt: { toDate: () => new Date('2026-08-01T00:00:00Z') },
    memberCount: 3,
    pendingCount: 0,
    active: true,
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

  it('renders an accessible "N pending" badge when pendingCount > 0 (R222)', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [makeOrg({ pendingCount: 2 })],
        },
      }),
    )
    const wrapper = await mountTab()

    expect(wrapper.text()).toContain('pending')
    expect(wrapper.text()).toContain('2')
  })

  it('shows "0" active plus "1 pending" for an onboarded-but-unclaimed admin (R222)', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [makeOrg({ memberCount: 0, pendingCount: 1 })],
        },
      }),
    )
    const wrapper = await mountTab()

    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).toContain('1 pending')
  })

  it('renders no "pending" text for a genuinely empty org (0 active, 0 pending) (R222)', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [makeOrg({ memberCount: 0, pendingCount: 0 })],
        },
      }),
    )
    const wrapper = await mountTab()

    expect(wrapper.text()).not.toContain('pending')
  })

  // Regression: listOrganizations is a callable, so an Admin Timestamp arrives
  // JSON-serialized as { _seconds } with no toDate() — formatDate used to fall
  // through to '—' for every real org. It must now render a date.
  it('formats a callable-serialized createdAt ({ _seconds }) as a date, not a dash', async () => {
    const seconds = Math.floor(Date.parse('2026-08-01T00:00:00Z') / 1000)
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', createdAt: { _seconds: seconds } }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()
    expect(wrapper.text()).toContain('2026')
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

describe('OrganizationsTab -- deactivate/reactivate (R212, R214)', () => {
  async function mountWithOneOrg(overrides: Partial<{ active: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('clicking Deactivate on an active org calls setOrgActive with {orgId, active:false}', async () => {
    const wrapper = await mountWithOneOrg({ active: true })

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')!
    await deactivateButton.trigger('click')
    await flushPromises()

    expect(mockSetOrgActive).toHaveBeenCalledWith({ orgId: 'org-1', active: false })
  })

  it('clicking Reactivate on a deactivated org calls setOrgActive with {orgId, active:true}', async () => {
    mockSetOrgActive.mockImplementation(() =>
      Promise.resolve({ data: { orgId: 'org-1', active: true, memberCount: 3, claimFailures: 0 } }),
    )
    const wrapper = await mountWithOneOrg({ active: false })

    const reactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Reactivate')!
    await reactivateButton.trigger('click')
    await flushPromises()

    expect(mockSetOrgActive).toHaveBeenCalledWith({ orgId: 'org-1', active: true })
  })

  it('WR-03: a second click while a toggle is in flight fires the callable exactly once', async () => {
    let resolveFn: (v: {
      data: { orgId: string; active: boolean; memberCount: number; claimFailures: number }
    }) => void = () => {}
    mockSetOrgActive.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        }),
    )
    const wrapper = await mountWithOneOrg({ active: true })

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')!
    await deactivateButton.trigger('click')
    expect(mockSetOrgActive).toHaveBeenCalledTimes(1)

    // A fast second click while togglingOrgId is set must be a no-op.
    await deactivateButton.trigger('click')
    expect(mockSetOrgActive).toHaveBeenCalledTimes(1)

    resolveFn({ data: { orgId: 'org-1', active: false, memberCount: 3, claimFailures: 0 } })
    await flushPromises()
  })

  it('shows a Deactivated badge and Reactivate label for a deactivated org row; neither for an active org row', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', active: true }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', active: false }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)
    expect(rows[0]!.text()).not.toContain('Deactivated')
    expect(rows[0]!.findAll('button').some((b) => b.text() === 'Deactivate')).toBe(true)
    expect(rows[1]!.text()).toContain('Deactivated')
    expect(rows[1]!.findAll('button').some((b) => b.text() === 'Reactivate')).toBe(true)
  })

  it('WR-01: a deactivate with claimFailures > 0 surfaces a non-blocking retry warning instead of an unqualified success message', async () => {
    mockSetOrgActive.mockImplementation(() =>
      Promise.resolve({ data: { orgId: 'org-1', active: false, memberCount: 3, claimFailures: 2, revokeFailures: 0 } }),
    )
    const wrapper = await mountWithOneOrg({ active: true })

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')!
    await deactivateButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Deactivated, but 2 member claim updates failed')
    expect(wrapper.text()).toContain('click again to retry')
  })

  it('WR-01: a deactivate with claimFailures: 0 still shows the plain success message, unchanged', async () => {
    const wrapper = await mountWithOneOrg({ active: true })

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')!
    await deactivateButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Deactivated.')
    expect(wrapper.text()).not.toContain('failed')
  })

  it('a failed toggle shows the friendly error message and does NOT call refreshOrgs()', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    mockListOrganizations.mockClear()
    mockSetOrgActive.mockImplementation(() => Promise.reject(new Error('server exploded')))

    const deactivateButton = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')!
    await deactivateButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('server exploded')
    expect(mockListOrganizations).not.toHaveBeenCalled()
  })
})

describe('OrganizationsTab -- delete (R220/R221)', () => {
  async function mountWithOneOrg(overrides: Partial<{ active: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', memberCount: 5, pendingCount: 2, ...overrides }),
          ],
        },
      }),
    )
    return mountTab()
  }

  it('disables the Delete button for an active org row and enables it for a deactivated row', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', active: true }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', active: false }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)
    const activeDelete = rows[0]!.findAll('button').find((b) => b.text() === 'Delete')!
    const deactivatedDelete = rows[1]!.findAll('button').find((b) => b.text() === 'Delete')!
    expect(activeDelete.attributes('disabled')).toBeDefined()
    expect(deactivatedDelete.attributes('disabled')).toBeUndefined()
  })

  it('clicking Delete opens the dialog with the org name and member/pending counts as props', async () => {
    const wrapper = await mountWithOneOrg({ active: false })

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
    await deleteButton.trigger('click')

    const dialog = deleteDialogOf(wrapper)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('orgName')).toBe('Grace Church')
    expect(dialog.props('memberCount')).toBe(5)
    expect(dialog.props('pendingCount')).toBe(2)
  })

  it('confirming with the correct typed name calls deleteOrganization, closes the dialog, shows a success banner, and refetches the list', async () => {
    const wrapper = await mountWithOneOrg({ active: false })
    mockListOrganizations.mockClear()

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
    await deleteButton.trigger('click')

    const dialog = deleteDialogOf(wrapper)
    await dialog.find('input[type="text"]').setValue('Grace Church')
    const confirmButtons = dialog.findAll('button')
    const confirmButton = confirmButtons[confirmButtons.length - 1]!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockDeleteOrganization).toHaveBeenCalledWith({ orgId: 'org-1', confirmName: 'Grace Church' })
    expect(deleteDialogOf(wrapper).props('open')).toBe(false)
    expect(wrapper.text()).toContain('Deleted Grace Church')
    expect(wrapper.text()).toContain('3 member(s) unlinked')
    expect(wrapper.text()).toContain('1 invite(s) removed')
    expect(wrapper.text()).toContain('4 file(s) removed')
    expect(mockListOrganizations).toHaveBeenCalledTimes(1)
  })

  it('on a rejected call (failed-precondition), the dialog stays open and shows the mapped error message', async () => {
    const err = Object.assign(new Error('not deactivated'), { code: 'failed-precondition' })
    mockDeleteOrganization.mockImplementation(() => Promise.reject(err))
    const wrapper = await mountWithOneOrg({ active: false })
    mockListOrganizations.mockClear()

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
    await deleteButton.trigger('click')

    const dialog = deleteDialogOf(wrapper)
    await dialog.find('input[type="text"]').setValue('Grace Church')
    let confirmButtons = dialog.findAll('button')
    let confirmButton = confirmButtons[confirmButtons.length - 1]!
    await confirmButton.trigger('click')
    await flushPromises()

    const dialogAfter = deleteDialogOf(wrapper)
    expect(dialogAfter.props('open')).toBe(true)
    expect(dialogAfter.props('confirmError')).toBe('Deactivate the church first.')
    expect(wrapper.text()).toContain('Deactivate the church first.')
    expect(mockListOrganizations).not.toHaveBeenCalled()
  })

  it('a rejected call with a name-mismatch code shows the mismatch error, not a generic one', async () => {
    const err = Object.assign(new Error('mismatch'), { code: 'invalid-argument' })
    mockDeleteOrganization.mockImplementation(() => Promise.reject(err))
    const wrapper = await mountWithOneOrg({ active: false })

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
    await deleteButton.trigger('click')

    const dialog = deleteDialogOf(wrapper)
    await dialog.find('input[type="text"]').setValue('Grace Church')
    const confirmButtons = dialog.findAll('button')
    const confirmButton = confirmButtons[confirmButtons.length - 1]!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(deleteDialogOf(wrapper).props('confirmError')).toBe("The name doesn't match.")
  })

  it('Cancel closes the dialog and calls deleteOrganization zero times', async () => {
    const wrapper = await mountWithOneOrg({ active: false })

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
    await deleteButton.trigger('click')
    expect(deleteDialogOf(wrapper).props('open')).toBe(true)

    const dialog = deleteDialogOf(wrapper)
    const cancelButton = dialog.findAll('button')[0]!
    await cancelButton.trigger('click')

    expect(deleteDialogOf(wrapper).props('open')).toBe(false)
    expect(mockDeleteOrganization).not.toHaveBeenCalled()
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

describe('OrganizationsTab -- enter church (R224, Phase 78)', () => {
  async function mountWithOneOrg(overrides: Partial<{ active: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('clicking "Enter church" calls authStore.enterOrgAsSuperAdmin with that row\'s orgId', async () => {
    const wrapper = await mountWithOneOrg({ active: true })

    const enterButton = wrapper.findAll('button').find((b) => b.text() === 'Enter church')!
    await enterButton.trigger('click')
    await flushPromises()

    expect(mockEnterOrgAsSuperAdmin).toHaveBeenCalledWith('org-1')
  })

  it('the "Enter church" button is present and NOT disabled for a deactivated row', async () => {
    const wrapper = await mountWithOneOrg({ active: false })

    const enterButton = wrapper.findAll('button').find((b) => b.text() === 'Enter church')!
    expect(enterButton.exists()).toBe(true)
    expect(enterButton.attributes('disabled')).toBeUndefined()
  })

  // WR-02 (78-REVIEW.md) — mirrors the double-submit guard convention this
  // file uses for Onboard/Assign/Deactivate/Delete: the button disables and
  // a second click while entering is a no-op.
  it('disables the button while entering and re-enables it once resolved', async () => {
    let resolveEnter!: () => void
    mockEnterOrgAsSuperAdmin.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveEnter = resolve)),
    )
    const wrapper = await mountWithOneOrg({ active: true })

    const enterButton = wrapper.findAll('button').find((b) => b.text() === 'Enter church')!
    void enterButton.trigger('click')
    await flushPromises()

    const pendingButton = wrapper.findAll('button').find((b) => b.text() === 'Entering...')!
    expect(pendingButton.attributes('disabled')).toBeDefined()

    // A second click while in-flight must not fire a second call.
    await pendingButton.trigger('click')
    await flushPromises()
    expect(mockEnterOrgAsSuperAdmin).toHaveBeenCalledTimes(1)

    resolveEnter()
    await flushPromises()

    const settledButton = wrapper.findAll('button').find((b) => b.text() === 'Enter church')!
    expect(settledButton.attributes('disabled')).toBeUndefined()
  })
})
