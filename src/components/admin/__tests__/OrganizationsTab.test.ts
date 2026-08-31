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
import OrgConfigDrawer from '../OrgConfigDrawer.vue'
import DeactivateOrgConfirmDialog from '../DeactivateOrgConfirmDialog.vue'

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
  // Phase 82 (R242) — mirrors the server OrgSummary's new field.
  aiMasterEnabled?: boolean
  // Phase 101 (R295) — mirrors the server OrgSummary's new field.
  bibleApiEnabled?: boolean
}

const {
  mockListOrganizations,
  mockOnboardOrganization,
  mockAssignOrgAdmin,
  mockSetOrgActive,
  mockDeleteOrganization,
  mockEnterOrgAsSuperAdmin,
  mockSetOrgAiEnabled,
  mockSetOrgBibleEnabled,
} = vi.hoisted(() => ({
    mockListOrganizations: vi.fn<() => Promise<{ data: { organizations: OrgSummaryFixture[] } }>>(
      () => Promise.resolve({ data: { organizations: [] } }),
    ),
    // R224 (Phase 78) — spy-able so tests can assert on the Enter-church row
    // action. Resolves `true` by default (WR-03, 78-REVIEW.md) -- matching
    // the real enterOrgAsSuperAdmin's success return -- so per-test
    // mockResolvedValueOnce(false) can drive the failure branch instead.
    mockEnterOrgAsSuperAdmin: vi.fn().mockResolvedValue(true),
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
    // Phase 82 (R242) — mirrors setOrgAiEnabledHandler's response shape
    // (Plan 01). The callable ships UNDEPLOYED with Plan 01; this test only
    // mocks httpsCallable, so an undeployed real target does not matter here.
    mockSetOrgAiEnabled: vi.fn<() => Promise<{ data: { orgId: string; aiEnabled: boolean } }>>(
      () => Promise.resolve({ data: { orgId: 'org-1', aiEnabled: true } }),
    ),
    // Phase 101 (R295) — mirrors setOrgBibleEnabledHandler's response shape
    // (Plan 01). The callable field is `enabled`, matching the cross-plan
    // contract.
    mockSetOrgBibleEnabled: vi.fn<() => Promise<{ data: { orgId: string; enabled: boolean } }>>(
      () => Promise.resolve({ data: { orgId: 'org-1', enabled: true } }),
    ),
  }))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'listOrganizations') return mockListOrganizations
    if (name === 'onboardOrganization') return mockOnboardOrganization
    if (name === 'assignOrgAdmin') return mockAssignOrgAdmin
    if (name === 'setOrgActive') return mockSetOrgActive
    if (name === 'deleteOrganization') return mockDeleteOrganization
    if (name === 'setOrgAiEnabled') return mockSetOrgAiEnabled
    if (name === 'setOrgBibleEnabled') return mockSetOrgBibleEnabled
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
  mockSetOrgAiEnabled.mockClear()
  mockSetOrgBibleEnabled.mockClear()
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
  mockSetOrgAiEnabled.mockImplementation(() =>
    Promise.resolve({ data: { orgId: 'org-1', aiEnabled: true } }),
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

// Quick task 260824 (owner testing follow-up) — the `>` chevron entry point +
// slideout replace the old per-row Deactivate/Reactivate and Enable/Disable
// AI buttons. The chevron carries no visible text (mirrors SongTable.vue's
// row-open affordance), so it is queried by its `aria-label="Configure ..."`
// rather than by button text. This helper opens the drawer for a given row
// index (default: the first/only row) and asserts it actually opened before
// returning, matching this file's existing mountWithOneOrg helper
// conventions.
async function openConfigDrawer(wrapper: Awaited<ReturnType<typeof mountTab>>, rowIndex = 0) {
  const configButtons = wrapper
    .findAll('button')
    .filter((b) => (b.attributes('aria-label') ?? '').startsWith('Configure '))
  await configButtons[rowIndex]!.trigger('click')
  const drawer = wrapper.find('[data-testid="org-config-drawer"]')
  expect(drawer.exists()).toBe(true)
  return drawer
}

function configDrawerOf(wrapper: Awaited<ReturnType<typeof mountTab>>) {
  return wrapper.findComponent(OrgConfigDrawer)
}

function deactivateDialogOf(wrapper: Awaited<ReturnType<typeof mountTab>>) {
  return wrapper.findComponent(DeactivateOrgConfirmDialog)
}

function makeOrg(
  overrides: Partial<{
    orgId: string
    name: string
    createdAt: unknown
    memberCount: number
    pendingCount: number
    active: boolean
    aiMasterEnabled: boolean
    bibleApiEnabled: boolean
  }> = {},
) {
  return {
    orgId: 'org-1',
    name: 'Test Church',
    createdAt: { toDate: () => new Date('2026-08-01T00:00:00Z') },
    memberCount: 3,
    pendingCount: 0,
    active: true,
    // Phase 82 (R242) — DEFAULT OFF, matching aiMasterEnabled's absent=false
    // org-doc default (src/types/organization.ts).
    aiMasterEnabled: false,
    // Phase 101 (R295) — DEFAULT OFF, matching bibleApiEnabled's absent=false
    // org-doc default (src/types/organization.ts).
    bibleApiEnabled: false,
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

describe('OrganizationsTab -- accessible names (R239, 81-02)', () => {
  it('associates the "Church name" and "First admin email" onboard inputs with real labels', async () => {
    const wrapper = await mountTab()

    const nameLabel = wrapper.find('label[for="onboard-church-name"]')
    const nameInput = wrapper.find('input[placeholder="Church name"]')
    expect(nameLabel.exists()).toBe(true)
    expect(nameLabel.text().trim().length).toBeGreaterThan(0)
    expect(nameInput.attributes('id')).toBe('onboard-church-name')
    expect(nameLabel.attributes('for')).toBe(nameInput.attributes('id'))

    const emailLabel = wrapper.find('label[for="onboard-admin-email"]')
    const emailInput = wrapper.find('input[placeholder="First admin email"]')
    expect(emailLabel.exists()).toBe(true)
    expect(emailLabel.text().trim().length).toBeGreaterThan(0)
    expect(emailInput.attributes('id')).toBe('onboard-admin-email')
    expect(emailLabel.attributes('for')).toBe(emailInput.attributes('id'))
  })

  it('exposes the per-org assign input via aria-label, with no static id, across a two-org list (assign now lives in the drawer)', async () => {
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

    // Open the first org's drawer and its assign form: aria-label is
    // present, no static id.
    await openConfigDrawer(wrapper, 0)
    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    let assignInput = wrapper.find('input[aria-label="Admin email"]')
    expect(assignInput.exists()).toBe(true)
    expect(assignInput.attributes('id')).toBeUndefined()

    // Close, then open the second org's drawer and its assign form: same
    // aria-label, still no id -- proves neither org's assign input was
    // retrofitted with a static id/for pair that would collide (RESEARCH
    // Pitfall 5).
    await wrapper.find('button[aria-label="Close"]').trigger('click')
    await openConfigDrawer(wrapper, 1)
    const secondStartButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await secondStartButton.trigger('click')
    assignInput = wrapper.find('input[aria-label="Admin email"]')
    expect(assignInput.exists()).toBe(true)
    expect(assignInput.attributes('id')).toBeUndefined()

    // Only one drawer (and thus one assign form) is ever open at a time, so
    // there is exactly one aria-labeled input in the DOM -- never a
    // duplicate id, by construction.
    expect(wrapper.findAll('input[aria-label="Admin email"]').length).toBe(1)
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

describe('OrganizationsTab -- per-org assign admin via drawer (R203/R205, owner UX follow-up)', () => {
  async function mountWithOneOrg() {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({ data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church' })] } }),
    )
    return mountTab()
  }

  it('opens the drawer assign control, calls assignOrgAdmin with {orgId, email}, and shows Added feedback', async () => {
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

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

  it('auto-collapses the drawer assign control and clears the email 2s after a successful assign (UI review 74)', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mountWithOneOrg()
      await openConfigDrawer(wrapper)

      const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
      await startButton.trigger('click')
      const emailInput = wrapper.find('input[placeholder="Admin email"]')
      await emailInput.setValue('newadmin@example.com')
      const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
      await confirmButton.trigger('click')
      await flushPromises()

      // Immediately after success: form still open, success shown, email cleared (no stale value).
      expect(wrapper.text()).toContain('Added as admin.')
      expect((wrapper.find('input[placeholder="Admin email"]').element as HTMLInputElement).value).toBe('')

      // After the 2s auto-dismiss: form collapses back to its trigger and the feedback is gone.
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
    await openConfigDrawer(wrapper)

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
    await openConfigDrawer(wrapper)

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
    await openConfigDrawer(wrapper)

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('newadmin@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('server exploded')
  })

  it("scopes feedback/error per-org: assigning in one org never leaks into another org's drawer", async () => {
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

    // Assign in org-1's drawer only.
    await openConfigDrawer(wrapper, 0)
    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('admin1@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockAssignOrgAdmin).toHaveBeenCalledWith({ orgId: 'org-1', email: 'admin1@example.com' })
    expect(wrapper.text()).toContain('Added as admin.')

    // Close org-1's drawer and open org-2's -- its assign control should be
    // collapsed with no feedback text bleeding in.
    await wrapper.find('button[aria-label="Close"]').trigger('click')
    await openConfigDrawer(wrapper, 1)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Assign admin')).toBe(true)
    expect(wrapper.text()).not.toContain('Added as admin.')
  })

  it('WR-03: a second Enter on the drawer admin-email input while assigning is in flight does not double-submit', async () => {
    let resolveFn: (v: { data: { status: 'added' | 'invited'; uid?: string } }) => void = () => {}
    mockAssignOrgAdmin.mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve }),
    )
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

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

  it('cancelAssign closes the drawer assign control without calling assignOrgAdmin', async () => {
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    expect(wrapper.find('input[placeholder="Admin email"]').exists()).toBe(true)

    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel assign')!
    await cancelButton.trigger('click')

    expect(wrapper.find('input[placeholder="Admin email"]').exists()).toBe(false)
    expect(mockAssignOrgAdmin).not.toHaveBeenCalled()
  })

  it('closing the drawer collapses an in-progress assign form so reopening (even for a different org) starts fresh', async () => {
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

    await openConfigDrawer(wrapper, 0)
    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('partial@example.com')

    // Close without confirming/cancelling explicitly.
    await wrapper.find('button[aria-label="Close"]').trigger('click')

    await openConfigDrawer(wrapper, 1)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Assign admin')).toBe(true)
    expect(wrapper.find('input[placeholder="Admin email"]').exists()).toBe(false)
  })
})

describe('OrganizationsTab -- deactivate/reactivate via drawer (R212, R214, quick 260824)', () => {
  async function mountWithOneOrg(overrides: Partial<{ active: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('clicking Deactivate on an ACTIVE org opens DeactivateOrgConfirmDialog and does NOT call setOrgActive yet', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    const activeButton = wrapper.find('[data-testid="org-config-active-button"]')
    expect(activeButton.text()).toBe('Deactivate')
    await activeButton.trigger('click')

    const dialog = deactivateDialogOf(wrapper)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('orgName')).toBe('Grace Church')
    expect(dialog.props('memberCount')).toBe(3)
    expect(mockSetOrgActive).not.toHaveBeenCalled()
  })

  it('confirming the deactivate dialog calls setOrgActive with {orgId, active:false} and closes the dialog', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-active-button"]').trigger('click')
    const dialog = deactivateDialogOf(wrapper)
    const confirmButtons = dialog.findAll('button')
    const confirmButton = confirmButtons[confirmButtons.length - 1]!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockSetOrgActive).toHaveBeenCalledWith({ orgId: 'org-1', active: false })
    expect(deactivateDialogOf(wrapper).props('open')).toBe(false)
  })

  it('cancelling the deactivate dialog calls setOrgActive zero times and leaves the org active with the button unchanged (no lingering state)', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-active-button"]').trigger('click')
    const dialog = deactivateDialogOf(wrapper)
    const cancelButton = dialog.findAll('button')[0]!
    await cancelButton.trigger('click')

    expect(deactivateDialogOf(wrapper).props('open')).toBe(false)
    expect(mockSetOrgActive).not.toHaveBeenCalled()
    // No checkbox exists to get stuck out of sync; the button itself still
    // reads the org's untouched active state.
    const activeButton = wrapper.find('[data-testid="org-config-active-button"]')
    expect(activeButton.text()).toBe('Deactivate')
    expect(configDrawerOf(wrapper).props('org')).toMatchObject({ orgId: 'org-1', active: true })
  })

  it('clicking Reactivate on a DEACTIVATED org calls setOrgActive with {orgId, active:true} directly, no confirm dialog', async () => {
    mockSetOrgActive.mockImplementation(() =>
      Promise.resolve({ data: { orgId: 'org-1', active: true, memberCount: 3, claimFailures: 0 } }),
    )
    const wrapper = await mountWithOneOrg({ active: false })
    await openConfigDrawer(wrapper)

    const activeButton = wrapper.find('[data-testid="org-config-active-button"]')
    expect(activeButton.text()).toBe('Reactivate')
    await activeButton.trigger('click')
    await flushPromises()

    expect(mockSetOrgActive).toHaveBeenCalledWith({ orgId: 'org-1', active: true })
    expect(deactivateDialogOf(wrapper).props('open')).toBe(false)
  })

  it('WR-03: a second deactivate-confirm click while a toggle is in flight fires the callable exactly once', async () => {
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
    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-active-button"]').trigger('click')

    const dialog = deactivateDialogOf(wrapper)
    const confirmButtons = dialog.findAll('button')
    const confirmButton = confirmButtons[confirmButtons.length - 1]!
    await confirmButton.trigger('click')
    expect(mockSetOrgActive).toHaveBeenCalledTimes(1)

    // A fast second click while togglingOrgId is set must be a no-op (the
    // dialog's own `confirming` prop disables the button too).
    await confirmButton.trigger('click')
    expect(mockSetOrgActive).toHaveBeenCalledTimes(1)

    resolveFn({ data: { orgId: 'org-1', active: false, memberCount: 3, claimFailures: 0 } })
    await flushPromises()
  })

  it('shows a Deactivated badge in the row; the drawer Active button reads Deactivate for an active org and Reactivate for a deactivated org', async () => {
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
    expect(rows[1]!.text()).toContain('Deactivated')

    // No per-row Deactivate/Reactivate button remains — both rows show only
    // the `>` Configure chevron for lifecycle/config actions.
    expect(rows[0]!.findAll('button').some((b) => b.text() === 'Deactivate')).toBe(false)
    expect(rows[1]!.findAll('button').some((b) => b.text() === 'Reactivate')).toBe(false)

    await openConfigDrawer(wrapper, 0)
    expect(wrapper.find('[data-testid="org-config-active-button"]').text()).toBe('Deactivate')
    await wrapper.find('button[aria-label="Close"]').trigger('click')

    await openConfigDrawer(wrapper, 1)
    expect(wrapper.find('[data-testid="org-config-active-button"]').text()).toBe('Reactivate')
  })

  it('WR-01: a deactivate with claimFailures > 0 surfaces a non-blocking retry warning (drawer activeFeedback) instead of an unqualified success message', async () => {
    mockSetOrgActive.mockImplementation(() =>
      Promise.resolve({ data: { orgId: 'org-1', active: false, memberCount: 3, claimFailures: 2, revokeFailures: 0 } }),
    )
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-active-button"]').trigger('click')
    const dialog = deactivateDialogOf(wrapper)
    const confirmButtons = dialog.findAll('button')
    await confirmButtons[confirmButtons.length - 1]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Deactivated, but 2 member claim updates failed')
    expect(wrapper.text()).toContain('click again to retry')
    expect(configDrawerOf(wrapper).props('activeFeedbackIsWarning')).toBe(true)
  })

  it('WR-01: a deactivate with claimFailures: 0 still shows the plain success message, unchanged', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-active-button"]').trigger('click')
    const dialog = deactivateDialogOf(wrapper)
    const confirmButtons = dialog.findAll('button')
    await confirmButtons[confirmButtons.length - 1]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Deactivated.')
    expect(wrapper.text()).not.toContain('failed')
  })

  it('a failed deactivate leaves the confirm dialog open showing confirmError, and does NOT call refreshOrgs()', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    mockListOrganizations.mockClear()
    mockSetOrgActive.mockImplementation(() => Promise.reject(new Error('server exploded')))

    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-active-button"]').trigger('click')
    const dialog = deactivateDialogOf(wrapper)
    const confirmButtons = dialog.findAll('button')
    await confirmButtons[confirmButtons.length - 1]!.trigger('click')
    await flushPromises()

    expect(deactivateDialogOf(wrapper).props('open')).toBe(true)
    expect(deactivateDialogOf(wrapper).props('confirmError')).toBe('server exploded')
    expect(wrapper.text()).toContain('server exploded')
    expect(mockListOrganizations).not.toHaveBeenCalled()
  })
})

describe('OrganizationsTab -- AI on/off toggle via drawer (R242, Phase 82, quick 260824)', () => {
  async function mountWithOneOrg(overrides: Partial<{ aiMasterEnabled: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('AI: the drawer checkbox is unchecked for an org with the master gate off, and checked for one with it on', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', aiMasterEnabled: false }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', aiMasterEnabled: true }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    await openConfigDrawer(wrapper, 0)
    expect((wrapper.find('[data-testid="org-config-ai-checkbox"]').element as HTMLInputElement).checked).toBe(false)
    await wrapper.find('button[aria-label="Close"]').trigger('click')

    await openConfigDrawer(wrapper, 1)
    expect((wrapper.find('[data-testid="org-config-ai-checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('AI: changing the checkbox on an org with the master gate off calls setOrgAiEnabled with {orgId, aiEnabled:true}', async () => {
    const wrapper = await mountWithOneOrg({ aiMasterEnabled: false })
    await openConfigDrawer(wrapper)

    const aiCheckbox = wrapper.find('[data-testid="org-config-ai-checkbox"]')
    await aiCheckbox.trigger('change')
    await flushPromises()

    expect(mockSetOrgAiEnabled).toHaveBeenCalledWith({ orgId: 'org-1', aiEnabled: true })
  })

  it('AI: changing the checkbox on an org with the master gate on calls setOrgAiEnabled with {orgId, aiEnabled:false}', async () => {
    mockSetOrgAiEnabled.mockImplementation(() =>
      Promise.resolve({ data: { orgId: 'org-1', aiEnabled: false } }),
    )
    const wrapper = await mountWithOneOrg({ aiMasterEnabled: true })
    await openConfigDrawer(wrapper)

    const aiCheckbox = wrapper.find('[data-testid="org-config-ai-checkbox"]')
    await aiCheckbox.trigger('change')
    await flushPromises()

    expect(mockSetOrgAiEnabled).toHaveBeenCalledWith({ orgId: 'org-1', aiEnabled: false })
  })

  it('AI: a successful toggle refreshes the org list so the drawer checkbox reflects the new state', async () => {
    const wrapper = await mountWithOneOrg({ aiMasterEnabled: false })
    mockListOrganizations.mockClear()
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', aiMasterEnabled: true })] },
      }),
    )
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-ai-checkbox"]').trigger('change')
    await flushPromises()

    expect(mockListOrganizations).toHaveBeenCalledTimes(1)
    // The drawer stayed open (configOrg is a computed lookup, not a captured
    // snapshot) and its checkbox now reflects the refreshed state.
    expect((wrapper.find('[data-testid="org-config-ai-checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('AI: a second change while a toggle is in flight fires the callable exactly once', async () => {
    let resolveFn: (v: { data: { orgId: string; aiEnabled: boolean } }) => void = () => {}
    mockSetOrgAiEnabled.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        }),
    )
    const wrapper = await mountWithOneOrg({ aiMasterEnabled: false })
    await openConfigDrawer(wrapper)

    const aiCheckbox = wrapper.find('[data-testid="org-config-ai-checkbox"]')
    await aiCheckbox.trigger('change')
    expect(mockSetOrgAiEnabled).toHaveBeenCalledTimes(1)

    // A fast second change while togglingAiOrgId is set must be a no-op
    // (the drawer's own :disabled="aiToggling" also blocks this in a real
    // browser; the handler guard is the belt-and-suspenders here).
    await aiCheckbox.trigger('change')
    expect(mockSetOrgAiEnabled).toHaveBeenCalledTimes(1)

    resolveFn({ data: { orgId: 'org-1', aiEnabled: true } })
    await flushPromises()
  })

  it('AI: a rejected callable surfaces the friendly error inside the drawer without crashing, and does NOT call refreshOrgs()', async () => {
    const wrapper = await mountWithOneOrg({ aiMasterEnabled: false })
    mockListOrganizations.mockClear()
    mockSetOrgAiEnabled.mockImplementation(() => Promise.reject(new Error('server exploded')))
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-ai-checkbox"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('server exploded')
    expect(mockListOrganizations).not.toHaveBeenCalled()
    // The drawer stays open and functional -- its checkbox still renders.
    expect(wrapper.find('[data-testid="org-config-ai-checkbox"]').exists()).toBe(true)
    expect(configDrawerOf(wrapper).props('aiError')).toBe('server exploded')
  })

  it('AI: a permission-denied rejection maps to the shared friendly-error string', async () => {
    const wrapper = await mountWithOneOrg({ aiMasterEnabled: false })
    mockSetOrgAiEnabled.mockImplementation(() =>
      Promise.reject(Object.assign(new Error('denied'), { code: 'functions/permission-denied' })),
    )
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-ai-checkbox"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('You do not have permission to perform this action.')
  })
})

describe('OrganizationsTab -- Bible API on/off toggle via drawer (Phase 101, R295)', () => {
  async function mountWithOneOrg(overrides: Partial<{ bibleApiEnabled: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('Bible: the drawer checkbox is unchecked for an org with the master gate off, and checked for one with it on', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', bibleApiEnabled: false }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', bibleApiEnabled: true }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    await openConfigDrawer(wrapper, 0)
    expect((wrapper.find('[data-testid="org-config-bible-checkbox"]').element as HTMLInputElement).checked).toBe(false)
    await wrapper.find('button[aria-label="Close"]').trigger('click')

    await openConfigDrawer(wrapper, 1)
    expect((wrapper.find('[data-testid="org-config-bible-checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('Bible: changing the checkbox on an org with the gate off calls setOrgBibleEnabled with {orgId, enabled:true}', async () => {
    const wrapper = await mountWithOneOrg({ bibleApiEnabled: false })
    await openConfigDrawer(wrapper)

    const bibleCheckbox = wrapper.find('[data-testid="org-config-bible-checkbox"]')
    await bibleCheckbox.trigger('change')
    await flushPromises()

    expect(mockSetOrgBibleEnabled).toHaveBeenCalledWith({ orgId: 'org-1', enabled: true })
  })

  it('Bible: changing the checkbox on an org with the gate on calls setOrgBibleEnabled with {orgId, enabled:false}', async () => {
    mockSetOrgBibleEnabled.mockImplementation(() =>
      Promise.resolve({ data: { orgId: 'org-1', enabled: false } }),
    )
    const wrapper = await mountWithOneOrg({ bibleApiEnabled: true })
    await openConfigDrawer(wrapper)

    const bibleCheckbox = wrapper.find('[data-testid="org-config-bible-checkbox"]')
    await bibleCheckbox.trigger('change')
    await flushPromises()

    expect(mockSetOrgBibleEnabled).toHaveBeenCalledWith({ orgId: 'org-1', enabled: false })
  })

  it('Bible: a successful toggle refreshes the org list so the drawer checkbox reflects the new state', async () => {
    const wrapper = await mountWithOneOrg({ bibleApiEnabled: false })
    mockListOrganizations.mockClear()
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', bibleApiEnabled: true })] },
      }),
    )
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-bible-checkbox"]').trigger('change')
    await flushPromises()

    expect(mockListOrganizations).toHaveBeenCalledTimes(1)
    expect((wrapper.find('[data-testid="org-config-bible-checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('Bible: a second change while a toggle is in flight fires the callable exactly once', async () => {
    let resolveFn: (v: { data: { orgId: string; enabled: boolean } }) => void = () => {}
    mockSetOrgBibleEnabled.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        }),
    )
    const wrapper = await mountWithOneOrg({ bibleApiEnabled: false })
    await openConfigDrawer(wrapper)

    const bibleCheckbox = wrapper.find('[data-testid="org-config-bible-checkbox"]')
    await bibleCheckbox.trigger('change')
    expect(mockSetOrgBibleEnabled).toHaveBeenCalledTimes(1)

    await bibleCheckbox.trigger('change')
    expect(mockSetOrgBibleEnabled).toHaveBeenCalledTimes(1)

    resolveFn({ data: { orgId: 'org-1', enabled: true } })
    await flushPromises()
  })

  it('Bible: a rejected callable surfaces the friendly error inside the drawer without crashing, and does NOT call refreshOrgs()', async () => {
    const wrapper = await mountWithOneOrg({ bibleApiEnabled: false })
    mockListOrganizations.mockClear()
    mockSetOrgBibleEnabled.mockImplementation(() => Promise.reject(new Error('server exploded')))
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-bible-checkbox"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('server exploded')
    expect(mockListOrganizations).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="org-config-bible-checkbox"]').exists()).toBe(true)
    expect(configDrawerOf(wrapper).props('bibleError')).toBe('server exploded')
  })

  it('Bible: a permission-denied rejection maps to the shared friendly-error string', async () => {
    const wrapper = await mountWithOneOrg({ bibleApiEnabled: false })
    mockSetOrgBibleEnabled.mockImplementation(() =>
      Promise.reject(Object.assign(new Error('denied'), { code: 'functions/permission-denied' })),
    )
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-bible-checkbox"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('You do not have permission to perform this action.')
  })

  it('Bible (R301): an enabled org renders the row "Bible API" badge; a default-OFF org renders none', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', bibleApiEnabled: true }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', bibleApiEnabled: false }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()
    const rows = wrapper.findAll('tbody tr')

    expect(rows[0]!.text()).toContain('Bible API')
    expect(rows[1]!.text()).not.toContain('Bible API')
  })
})

describe('OrganizationsTab -- Configure drawer shell (quick 260824, owner UX follow-up: row is data-only + trailing chevron)', () => {
  async function mountWithOneOrg(overrides: Partial<{ active: boolean; aiMasterEnabled: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('each row renders exactly one `>` Configure chevron (no visible text, aria-labeled) and NO other buttons -- every action (Assign admin, Enter church, AI, Deactivate/Reactivate, Delete) now lives in the drawer', async () => {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: {
          organizations: [
            makeOrg({ orgId: 'org-1', name: 'Grace Church', active: true, aiMasterEnabled: false }),
            makeOrg({ orgId: 'org-2', name: 'Hope Church', active: false, aiMasterEnabled: true }),
          ],
        },
      }),
    )
    const wrapper = await mountTab()

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)
    const expectedLabels = ['Configure Grace Church', 'Configure Hope Church']
    rows.forEach((row, i) => {
      const rowButtons = row.findAll('button')
      expect(rowButtons.length).toBe(1)
      expect(rowButtons[0]!.attributes('aria-label')).toBe(expectedLabels[i])
      // No visible text on the chevron itself -- an icon-only affordance
      // mirroring SongTable.vue's row-open chevron.
      expect(rowButtons[0]!.text()).toBe('')
    })
  })

  it('clicking the `>` chevron opens the drawer for that org', async () => {
    const wrapper = await mountWithOneOrg()
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)

    await openConfigDrawer(wrapper)
    expect(configDrawerOf(wrapper).props('org')).toMatchObject({ orgId: 'org-1', name: 'Grace Church' })
  })

  it('clicking anywhere else on the row also opens the drawer for that org (SongTable-style whole-row click)', async () => {
    const wrapper = await mountWithOneOrg()
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)

    const row = wrapper.findAll('tbody tr')[0]!
    // Click a plain data cell (not the trailing chevron button) -- the whole
    // row is clickable, not just the chevron.
    await row.findAll('td')[0]!.trigger('click')

    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(true)
    expect(configDrawerOf(wrapper).props('org')).toMatchObject({ orgId: 'org-1', name: 'Grace Church' })
  })

  it('opening the drawer surfaces Assign admin and Enter church actions (moved in from the row)', async () => {
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

    expect(wrapper.findAll('button').some((b) => b.text() === 'Assign admin')).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Enter church')).toBe(true)
  })

  it('the backdrop click closes the drawer (org -> null)', async () => {
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

    await wrapper.find('.z-40').trigger('click')
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)
    expect(configDrawerOf(wrapper).props('org')).toBe(null)
  })

  it('the x close button closes the drawer', async () => {
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

    await wrapper.find('button[aria-label="Close"]').trigger('click')
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)
  })

  it('Escape closes the drawer', async () => {
    const wrapper = await mountWithOneOrg()
    await openConfigDrawer(wrapper)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)
  })
})

describe('OrganizationsTab -- delete via drawer (R220/R221, owner testing follow-up)', () => {
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

  it('the drawer renders a Delete button ONLY for a deactivated org (hidden while active)', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    expect(wrapper.find('[data-testid="org-config-delete-button"]').exists()).toBe(false)
  })

  it('the drawer Delete button appears once the org is deactivated', async () => {
    const wrapper = await mountWithOneOrg({ active: false })
    await openConfigDrawer(wrapper)

    const deleteButton = wrapper.find('[data-testid="org-config-delete-button"]')
    expect(deleteButton.exists()).toBe(true)
    expect(deleteButton.attributes('disabled')).toBeUndefined()
  })

  it('clicking the drawer Delete button opens DeleteOrgConfirmDialog with the org name and member/pending counts as props', async () => {
    const wrapper = await mountWithOneOrg({ active: false })
    await openConfigDrawer(wrapper)

    await wrapper.find('[data-testid="org-config-delete-button"]').trigger('click')

    const dialog = deleteDialogOf(wrapper)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('orgName')).toBe('Grace Church')
    expect(dialog.props('memberCount')).toBe(5)
    expect(dialog.props('pendingCount')).toBe(2)
  })

  it('confirming with the correct typed name calls deleteOrganization (reusing openDeleteDialog/onConfirmDelete unchanged), closes the dialog, shows a success banner, refetches the list, and the drawer closes as the org drops out of the refreshed list', async () => {
    const wrapper = await mountWithOneOrg({ active: false })
    mockListOrganizations.mockClear()
    // After a successful delete, the org is gone from the refreshed list.
    mockListOrganizations.mockImplementation(() => Promise.resolve({ data: { organizations: [] } }))

    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-delete-button"]').trigger('click')

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
    // configOrg is a computed lookup into the refreshed orgs list -- the
    // deleted org is gone, so the drawer's `org` prop goes null and it closes.
    expect(configDrawerOf(wrapper).props('org')).toBe(null)
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)
  })

  it('on a rejected call (failed-precondition), the dialog stays open and shows the mapped error message', async () => {
    const err = Object.assign(new Error('not deactivated'), { code: 'failed-precondition' })
    mockDeleteOrganization.mockImplementation(() => Promise.reject(err))
    const wrapper = await mountWithOneOrg({ active: false })
    mockListOrganizations.mockClear()

    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-delete-button"]').trigger('click')

    const dialog = deleteDialogOf(wrapper)
    await dialog.find('input[type="text"]').setValue('Grace Church')
    const confirmButtons = dialog.findAll('button')
    const confirmButton = confirmButtons[confirmButtons.length - 1]!
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

    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-delete-button"]').trigger('click')

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

    await openConfigDrawer(wrapper)
    await wrapper.find('[data-testid="org-config-delete-button"]').trigger('click')
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

    // Assign admin now lives in the drawer (owner UX follow-up) -- open it first.
    await openConfigDrawer(wrapper)
    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await startButton.trigger('click')
    await wrapper.find('input[placeholder="Admin email"]').setValue('another@example.com')
    const confirmButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await confirmButton.trigger('click')
    await flushPromises()
    expect(mockAssignOrgAdmin).toHaveBeenCalled()
  })
})

describe('OrganizationsTab -- enter church via drawer (R224, Phase 78, owner UX follow-up)', () => {
  async function mountWithOneOrg(overrides: Partial<{ active: boolean }> = {}) {
    mockListOrganizations.mockImplementation(() =>
      Promise.resolve({
        data: { organizations: [makeOrg({ orgId: 'org-1', name: 'Grace Church', ...overrides })] },
      }),
    )
    return mountTab()
  }

  it('clicking "Enter church" in the drawer calls authStore.enterOrgAsSuperAdmin with that org\'s orgId', async () => {
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    const enterButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    await enterButton.trigger('click')
    await flushPromises()

    expect(mockEnterOrgAsSuperAdmin).toHaveBeenCalledWith('org-1')
  })

  it('the "Enter church" button is present and NOT disabled for a deactivated org', async () => {
    const wrapper = await mountWithOneOrg({ active: false })
    await openConfigDrawer(wrapper)

    const enterButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(enterButton.exists()).toBe(true)
    expect(enterButton.attributes('disabled')).toBeUndefined()
  })

  // WR-02 (78-REVIEW.md) — mirrors the double-submit guard convention this
  // file uses for Onboard/Assign/Deactivate/Delete: the button disables and
  // a second click while entering is a no-op.
  it('disables the button while entering and re-enables it once resolved', async () => {
    let resolveEnter!: (v: boolean) => void
    mockEnterOrgAsSuperAdmin.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (resolveEnter = resolve)),
    )
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    const enterButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    void enterButton.trigger('click')
    await flushPromises()

    const pendingButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(pendingButton.text()).toBe('Entering...')
    expect(pendingButton.attributes('disabled')).toBeDefined()

    // A second click while in-flight must not fire a second call.
    await pendingButton.trigger('click')
    await flushPromises()
    expect(mockEnterOrgAsSuperAdmin).toHaveBeenCalledTimes(1)

    resolveEnter(true)
    await flushPromises()

    const settledButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(settledButton.text()).toBe('Enter church')
    expect(settledButton.attributes('disabled')).toBeUndefined()
  })

  // WR-03 (78-REVIEW.md) — enterOrgAsSuperAdmin resolving false (bad/stale
  // org doc, denied read, error) must surface an inline error and NOT
  // navigate, instead of bouncing the super-admin to /select-church with no
  // explanation.
  it('shows an inline error and does not navigate when enterOrgAsSuperAdmin resolves false', async () => {
    mockEnterOrgAsSuperAdmin.mockResolvedValueOnce(false)
    const wrapper = await mountWithOneOrg({ active: true })
    await openConfigDrawer(wrapper)

    const enterButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    await enterButton.trigger('click')
    await flushPromises()

    expect(mockEnterOrgAsSuperAdmin).toHaveBeenCalledWith('org-1')
    expect(wrapper.text()).toContain("Couldn't enter this church. Refresh and try again.")
    // Guard re-enabled after the failed attempt (not left stuck disabled).
    const settledButton = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(settledButton.attributes('disabled')).toBeUndefined()
  })
})
