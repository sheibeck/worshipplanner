import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RosterView from '../RosterView.vue'
import type { Person, Role } from '@/types/roster'
import type { Team } from '@/types/team'

// 129-02 (R400/R401): the drawer's Sign-in Link section calls
// httpsCallable(functions, 'adminVolunteerLink') — mock the whole module
// (ServiceEditorView.test.ts precedent) so per-test resolution/rejection is
// controllable. `@/firebase` also needs a mock: RosterView.vue now imports
// `functions` from it, and the real module requires VITE_FIREBASE_* env vars
// at load time.
const { mockHttpsCallable, mockAdminVolunteerLinkCallable, mockToastsPush } = vi.hoisted(() => {
  const mockAdminVolunteerLinkCallable = vi.fn<
    (...a: unknown[]) => Promise<{ data: { sent?: boolean; link?: string } }>
  >(() => Promise.resolve({ data: { sent: true } }))
  return {
    mockAdminVolunteerLinkCallable,
    mockHttpsCallable: vi.fn<(...a: unknown[]) => typeof mockAdminVolunteerLinkCallable>(
      () => mockAdminVolunteerLinkCallable,
    ),
    mockToastsPush: vi.fn(() => 'toast-id'),
  }
})

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: (...a: unknown[]) => mockHttpsCallable(...a),
}))

vi.mock('@/stores/toasts', () => ({
  useToasts: () => ({
    push: mockToastsPush,
  }),
}))

const mockAddPerson = vi.fn(() => Promise.resolve('new-id'))
const mockUpdatePerson = vi.fn((_id: string, _input: Record<string, unknown>) => Promise.resolve())
const mockDeactivatePerson = vi.fn(() => Promise.resolve())
const mockReactivatePerson = vi.fn(() => Promise.resolve())
const mockDeletePerson = vi.fn(() => Promise.resolve())
const mockDeleteAllPeople = vi.fn(() => Promise.resolve(0))
const mockSeedDefaultRolesIfEmpty = vi.fn(() => Promise.resolve())
const mockSubscribe = vi.fn()
const mockUnsubscribeAll = vi.fn()

// Roles alphabetically: drums, guitar, vocals (rolesSorted mirrors the store's
// alphabetical-by-name computed used for display/iteration in the form).
const mockRoles: Role[] = [
  { id: 'r-drums', name: 'drums', group: 'band', defaultCount: 1, order: 1 },
  { id: 'r-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
  { id: 'r-vocals', name: 'vocals', group: 'band', multiRole: true, defaultCount: 1, order: 2 },
]

let mockPeople: Person[] = []

// 39-05 (R089): `settings.pcEnabled` added as a getter-mock (SongTable.test.ts
// precedent) so a test can flip it mid-suite without re-mounting a fresh
// vi.mock. Defaults to true so every pre-existing test in this file keeps
// its current behavior unchanged.
let mockPcEnabled = true

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    orgId: 'org-1',
    settings: {
      get pcEnabled() {
        return mockPcEnabled
      },
    },
  }),
}))

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockPeople,
    roles: mockRoles,
    isLoading: false,
    activePeople: mockPeople.filter((p) => p.active),
    rolesSorted: [...mockRoles].sort((a, b) => a.name.localeCompare(b.name)),
    subscribe: mockSubscribe,
    unsubscribeAll: mockUnsubscribeAll,
    addPerson: mockAddPerson,
    updatePerson: mockUpdatePerson,
    deactivatePerson: mockDeactivatePerson,
    reactivatePerson: mockReactivatePerson,
    deletePerson: mockDeletePerson,
    seedDefaultRolesIfEmpty: mockSeedDefaultRolesIfEmpty,
    deleteAllPeople: mockDeleteAllPeople,
  }),
}))

// 79-02: RosterView.vue now also calls useTeamsStore()/useSongStore() directly
// (Teams tab subscribe + seed) — mocked here (not stubbed via TeamsConfigPanel
// alone) because those calls live in RosterView's own script setup, not just
// inside the stubbed child component.
vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    teams: [],
    subscribe: vi.fn(),
    unsubscribeAll: vi.fn(),
    seedDefaultTeamsIfEmpty: vi.fn(() => Promise.resolve()),
    addTeam: vi.fn(() => Promise.resolve('new-team-id')),
    updateTeam: vi.fn(() => Promise.resolve()),
    deleteTeam: vi.fn(() => Promise.resolve()),
  }),
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    allUserTags: [],
    subscribe: vi.fn(),
    unsubscribeAll: vi.fn(),
  }),
}))

// Cast via `unknown` — the Person type still carries its (deprecated, to be
// removed in plan 16-11) standing-frequency field, but this roles-only-form
// test suite never constructs or asserts on it (D-07/D-04).
function makePerson(overrides: Partial<Person> & { id: string; name: string }): Person {
  return {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email ?? `${overrides.id}@example.com`,
    phone: overrides.phone ?? '',
    active: overrides.active ?? true,
    roles: overrides.roles ?? [],
    pcPersonId: overrides.pcPersonId ?? null,
    createdAt: overrides.createdAt ?? ({} as never),
    updatedAt: overrides.updatedAt ?? ({} as never),
  } as unknown as Person
}

function mountRosterView() {
  return mount(RosterView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RolesConfigPanel: { template: '<div />' },
        TeamsConfigPanel: { template: '<div />' },
        RosterImportModal: { template: '<div />' },
        RoleSlideOver: { template: '<div />' },
        TeamSlideOver: { template: '<div />' },
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

// 88-03: wiring stubs for RolesConfigPanel/TeamsConfigPanel that can $emit
// 'edit'/'add', and RoleSlideOver/TeamSlideOver stubs that surface their
// :open/:role/:team props for assertion — proves RosterView owns and opens
// the slideouts in response to panel events.
const rolesConfigPanelWiringStub = { template: '<div />', emits: ['edit', 'add'] }
const teamsConfigPanelWiringStub = { template: '<div />', emits: ['edit', 'add'] }
const roleSlideOverWiringStub = {
  props: ['open', 'role'],
  template: '<div data-testid="role-slideover" :data-open="open" :data-role-id="role?.id ?? \'\'" />',
}
const teamSlideOverWiringStub = {
  props: ['open', 'team'],
  template: '<div data-testid="team-slideover" :data-open="open" :data-team-id="team?.id ?? \'\'" />',
}

function mountRosterViewForWiring() {
  return mount(RosterView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RolesConfigPanel: rolesConfigPanelWiringStub,
        TeamsConfigPanel: teamsConfigPanelWiringStub,
        RosterImportModal: { template: '<div />' },
        RoleSlideOver: roleSlideOverWiringStub,
        TeamSlideOver: teamSlideOverWiringStub,
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

// File-level reset so a mid-suite pcEnabled flip (39-05) never leaks into a
// later describe block's tests. Also resets the 129-02 callable/clipboard/
// toast mocks so no test's expectations leak into the next.
beforeEach(() => {
  mockPcEnabled = true
  mockHttpsCallable.mockClear()
  mockAdminVolunteerLinkCallable.mockClear()
  mockAdminVolunteerLinkCallable.mockImplementation(() => Promise.resolve({ data: { sent: true } }))
  mockToastsPush.mockClear()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('RosterView — roles-only Volunteer form (D-07)', () => {
  beforeEach(() => {
    mockAddPerson.mockClear()
    mockUpdatePerson.mockClear()
    mockDeactivatePerson.mockClear()
    mockReactivatePerson.mockClear()
    mockDeletePerson.mockClear()
  })

  it('does not render a serve-frequency/cadence control anywhere in the form', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar', 'r-vocals'],
      }),
    ]

    const wrapper = mountRosterView()
    // Edit button was removed (260711-dto) — rows are now fully clickable to open the edit drawer.
    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    expect(wrapper.findAll('select[data-role="cadence-select"]').length).toBe(0)
    expect(wrapper.text()).not.toContain('Serve frequency by role')
  })

  it('renders the roles checklist and toggles a role on/off', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar'],
      }),
    ]

    const wrapper = mountRosterView()
    // Edit button was removed (260711-dto) — rows are now fully clickable to open the edit drawer.
    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const guitarCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((c) => c.attributes('value') === 'r-guitar')!
    expect((guitarCheckbox.element as HTMLInputElement).checked).toBe(true)

    const drumsCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((c) => c.attributes('value') === 'r-drums')!
    expect((drumsCheckbox.element as HTMLInputElement).checked).toBe(false)
    await drumsCheckbox.setValue(true)
    expect((drumsCheckbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('onSaveVolunteer payload includes only name/email/phone/roles — no frequency fields', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar', 'r-vocals'],
      }),
    ]

    const wrapper = mountRosterView()
    // Edit button was removed (260711-dto) — rows are now fully clickable to open the edit drawer.
    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const form = wrapper.find('form#volunteer-form')
    await form.trigger('submit.prevent')

    expect(mockUpdatePerson).toHaveBeenCalledTimes(1)
    const [personId, input] = mockUpdatePerson.mock.calls[0]!
    expect(personId).toBe('p-1')
    expect(input).toEqual({
      name: 'Alice',
      email: 'p-1@example.com',
      phone: '',
      roles: ['r-guitar', 'r-vocals'],
    })
  })
})

describe('RosterView — collapsible dense sections (R-11)', () => {
  // 88-03: the prior assertion here checked for the literal text 'Roles config',
  // which was never true once RolesConfigPanel became a stub (its own "Roles"
  // header text lives inside the (stubbed) child component) — a knowingly-stale
  // case. Replaced with an accurate assertion: the Roles tab button itself renders.
  it('renders a Roles tab button', () => {
    mockPeople = [
      makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
    ]

    const wrapper = mountRosterView()

    const rolesTabButton = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(rolesTabButton).toBeTruthy()
  })
})

describe('RosterView — Role/Team slideout ownership (88-03, R257)', () => {
  it('RoleSlideOver and TeamSlideOver start closed', () => {
    mockPeople = []
    const wrapper = mountRosterViewForWiring()

    const roleSlideover = wrapper.find('[data-testid="role-slideover"]')
    const teamSlideover = wrapper.find('[data-testid="team-slideover"]')
    expect(roleSlideover.attributes('data-open')).toBe('false')
    expect(teamSlideover.attributes('data-open')).toBe('false')
  })

  it('RolesConfigPanel "add" opens RoleSlideOver in create mode (no role)', async () => {
    mockPeople = []
    const wrapper = mountRosterViewForWiring()

    const rolesPanel = wrapper.findComponent(rolesConfigPanelWiringStub)
    await rolesPanel.vm.$emit('add')

    const roleSlideover = wrapper.find('[data-testid="role-slideover"]')
    expect(roleSlideover.attributes('data-open')).toBe('true')
    expect(roleSlideover.attributes('data-role-id')).toBe('')
  })

  it('RolesConfigPanel "edit" opens RoleSlideOver with that role', async () => {
    mockPeople = []
    const wrapper = mountRosterViewForWiring()

    const rolesPanel = wrapper.findComponent(rolesConfigPanelWiringStub)
    await rolesPanel.vm.$emit('edit', mockRoles[0])

    const roleSlideover = wrapper.find('[data-testid="role-slideover"]')
    expect(roleSlideover.attributes('data-open')).toBe('true')
    expect(roleSlideover.attributes('data-role-id')).toBe(mockRoles[0]!.id)
  })

  it('TeamsConfigPanel "add" opens TeamSlideOver in create mode (no team)', async () => {
    mockPeople = []
    const wrapper = mountRosterViewForWiring()

    const teamsPanel = wrapper.findComponent(teamsConfigPanelWiringStub)
    await teamsPanel.vm.$emit('add')

    const teamSlideover = wrapper.find('[data-testid="team-slideover"]')
    expect(teamSlideover.attributes('data-open')).toBe('true')
    expect(teamSlideover.attributes('data-team-id')).toBe('')
  })

  it('TeamsConfigPanel "edit" opens TeamSlideOver with that team', async () => {
    mockPeople = []
    const wrapper = mountRosterViewForWiring()

    const team: Team = { id: 'team-1', name: 'Choir', order: 0 }
    const teamsPanel = wrapper.findComponent(teamsConfigPanelWiringStub)
    await teamsPanel.vm.$emit('edit', team)

    const teamSlideover = wrapper.find('[data-testid="team-slideover"]')
    expect(teamSlideover.attributes('data-open')).toBe('true')
    expect(teamSlideover.attributes('data-team-id')).toBe('team-1')
  })
})

describe('RosterView — unified table with Show-inactive toggle (260713-d60)', () => {
  it('hides inactive people by default and shows them when "Show inactive" is toggled on', async () => {
    mockPeople = [
      makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
      makePerson({ id: 'p-inactive', name: 'Bob', active: false, roles: [] }),
    ]

    const wrapper = mountRosterView()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')

    const toggle = wrapper.find('input[type="checkbox"]')
    await toggle.setValue(true)

    expect(wrapper.text()).toContain('Bob')
  })

  it('renders a Status column with Active/Inactive pills instead of Actions', async () => {
    mockPeople = [
      makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
      makePerson({ id: 'p-inactive', name: 'Bob', active: false, roles: [] }),
    ]

    const wrapper = mountRosterView()
    const headers = wrapper.findAll('th').map((h) => h.text())
    expect(headers).toContain('Status')
    expect(headers.some((h) => h.includes('Actions'))).toBe(false)
    expect(wrapper.text()).toContain('Active')

    const toggle = wrapper.find('input[type="checkbox"]')
    await toggle.setValue(true)
    expect(wrapper.text()).toContain('Inactive')
  })

  it('does not render a per-row Deactivate button', () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', active: true, roles: [] })]
    const wrapper = mountRosterView()
    const buttons = wrapper.findAll('button').map((b) => b.text())
    expect(buttons.some((t) => t.includes('Deactivate'))).toBe(false)
  })
})

describe('RosterView — drawer status actions (immediate-apply, 260713-d60)', () => {
  beforeEach(() => {
    mockDeactivatePerson.mockClear()
    mockReactivatePerson.mockClear()
    mockDeletePerson.mockClear()
    mockUpdatePerson.mockClear()
  })

  it('shows a Deactivate control for an active person and calls deactivatePerson, not updatePerson', async () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const deactivateBtn = wrapper.findAll('button').find((b) => b.text() === 'Deactivate')!
    await deactivateBtn.trigger('click')

    expect(mockDeactivatePerson).toHaveBeenCalledTimes(1)
    expect(mockDeactivatePerson).toHaveBeenCalledWith('p-1')
    expect(mockUpdatePerson).not.toHaveBeenCalled()
  })

  it('shows Reactivate and a Delete affordance for an inactive person; clicking Reactivate calls reactivatePerson', async () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Bob', active: false, roles: [] })]
    const wrapper = mountRosterView()

    // Toggle "Show inactive" on so the row is visible/clickable.
    const toggle = wrapper.find('input[type="checkbox"]')
    await toggle.setValue(true)

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const reactivateBtn = wrapper.findAll('button').find((b) => b.text() === 'Reactivate')!
    await reactivateBtn.trigger('click')

    expect(mockReactivatePerson).toHaveBeenCalledTimes(1)
    expect(mockReactivatePerson).toHaveBeenCalledWith('p-1')

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete permanently')
    expect(deleteBtn).toBeTruthy()
  })

  it('permanently deletes an inactive person from the drawer after confirmation', async () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Bob', active: false, roles: [] })]
    const wrapper = mountRosterView()

    const toggle = wrapper.find('input[type="checkbox"]')
    await toggle.setValue(true)

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete permanently')!
    await deleteBtn.trigger('click')

    const confirmDeleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
    await confirmDeleteBtn.trigger('click')

    expect(mockDeletePerson).toHaveBeenCalledTimes(1)
    expect(mockDeletePerson).toHaveBeenCalledWith('p-1')
  })

  it('does not render the status action section when adding a new volunteer', async () => {
    mockPeople = []
    const wrapper = mountRosterView()

    const addBtn = wrapper.findAll('button').find((b) => b.text().includes('Add Volunteer'))!
    await addBtn.trigger('click')

    expect(wrapper.text()).not.toContain('Deactivate')
    expect(wrapper.text()).not.toContain('Reactivate')
  })
})

describe('RosterView — drawer Sign-in Link section (129-02, R400/R401)', () => {
  it('renders the Email/Copy sign-in link buttons and help copy for a person WITH an email', async () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', email: 'alice@example.com', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    expect(wrapper.text()).toContain('Sign-in Link')
    expect(wrapper.text()).toContain("Send Alice their passwordless sign-in link, or copy it to share yourself.")
    expect(wrapper.findAll('button').find((b) => b.text() === 'Email sign-in link')).toBeTruthy()
    expect(wrapper.findAll('button').find((b) => b.text() === 'Copy sign-in link')).toBeTruthy()
  })

  it('Email sign-in link calls adminVolunteerLink with mode:email and pushes a success toast', async () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', email: 'alice@example.com', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const emailBtn = wrapper.findAll('button').find((b) => b.text() === 'Email sign-in link')!
    await emailBtn.trigger('click')
    await flushPromises()

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'adminVolunteerLink')
    expect(mockAdminVolunteerLinkCallable).toHaveBeenCalledWith({
      orgId: 'org-1',
      email: 'alice@example.com',
      mode: 'email',
    })
    expect(mockToastsPush).toHaveBeenCalledWith(
      'Sign-in link sent to Alice.',
      expect.objectContaining({ variant: 'success' }),
    )
  })

  it('Copy sign-in link calls adminVolunteerLink with mode:copy, writes to clipboard, and flips the label', async () => {
    mockAdminVolunteerLinkCallable.mockImplementation(() =>
      Promise.resolve({ data: { link: 'https://app.example/volunteer/verify?oobCode=xyz' } }),
    )
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', email: 'alice@example.com', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const copyBtn = wrapper.findAll('button').find((b) => b.text() === 'Copy sign-in link')!
    await copyBtn.trigger('click')
    await flushPromises()

    expect(mockAdminVolunteerLinkCallable).toHaveBeenCalledWith({
      orgId: 'org-1',
      email: 'alice@example.com',
      mode: 'copy',
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app.example/volunteer/verify?oobCode=xyz')

    const flippedBtn = wrapper.findAll('button').find((b) => b.text() === 'Link copied!')
    expect(flippedBtn).toBeTruthy()
  })

  it('WR-02 (129-REVIEW.md): a resolved copy-mode callable with no link surfaces the error label instead of silently no-oping', async () => {
    mockAdminVolunteerLinkCallable.mockImplementation(() => Promise.resolve({ data: {} }))
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', email: 'alice@example.com', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const copyBtn = wrapper.findAll('button').find((b) => b.text() === 'Copy sign-in link')!
    await copyBtn.trigger('click')
    await flushPromises()

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    const flippedBtn = wrapper.findAll('button').find((b) => b.text() === "Couldn't copy — try again")
    expect(flippedBtn).toBeTruthy()
  })

  it('WR-02: a resolved copy-mode callable with a link but no Clipboard API surfaces the error label', async () => {
    mockAdminVolunteerLinkCallable.mockImplementation(() =>
      Promise.resolve({ data: { link: 'https://app.example/volunteer/verify?oobCode=xyz' } }),
    )
    // Simulate a non-secure/older-browser context where Clipboard API is absent.
    Object.assign(navigator, { clipboard: undefined })
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', email: 'alice@example.com', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const copyBtn = wrapper.findAll('button').find((b) => b.text() === 'Copy sign-in link')!
    await copyBtn.trigger('click')
    await flushPromises()

    const flippedBtn = wrapper.findAll('button').find((b) => b.text() === "Couldn't copy — try again")
    expect(flippedBtn).toBeTruthy()
  })

  it('hides the Email/Copy buttons and shows the explanatory line for a person with NO email', async () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Bob', email: '', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    expect(wrapper.findAll('button').find((b) => b.text() === 'Email sign-in link')).toBeFalsy()
    expect(wrapper.findAll('button').find((b) => b.text() === 'Copy sign-in link')).toBeFalsy()
    expect(wrapper.text()).toContain('Add an email address above to email or copy a sign-in link for Bob.')
  })

  it('an email-mode callable rejection pushes an error-variant toast and does not throw', async () => {
    mockAdminVolunteerLinkCallable.mockImplementation(() => Promise.reject(new Error('network down')))
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', email: 'alice@example.com', active: true, roles: [] })]
    const wrapper = mountRosterView()

    const row = wrapper.findAll('tbody tr')[0]!
    await row.trigger('click')

    const emailBtn = wrapper.findAll('button').find((b) => b.text() === 'Email sign-in link')!
    await emailBtn.trigger('click')
    await flushPromises()

    // Default push() call (no opts) defaults to the 'error' variant — the
    // app-wide ToastHost "Save failed." prefix is applied at render time, not
    // by the caller (129-UI-SPEC.md Copywriting Contract).
    expect(mockToastsPush).toHaveBeenCalledWith(
      'Could not send the sign-in link to Alice. Try again, or use Copy sign-in link instead.',
    )
  })
})

describe('RosterView — name/role sort (frequency sort removed)', () => {
  beforeEach(() => {
    mockUpdatePerson.mockClear()
  })

  it('sorts alphabetically by name and toggles direction', async () => {
    mockPeople = [
      makePerson({ id: 'p-bob', name: 'Bob', roles: [] }),
      makePerson({ id: 'p-alice', name: 'Alice', roles: ['r-guitar'] }),
      makePerson({ id: 'p-zoe', name: 'Zoe', roles: ['r-vocals'] }),
    ]

    const wrapper = mountRosterView()

    const nameCells = wrapper.findAll('tbody tr td:first-child')
    const names = nameCells.map((c) => c.text())
    expect(names).toEqual(['Alice', 'Bob', 'Zoe'])

    const nameHeader = wrapper.findAll('button').find((b) => b.text().includes('Name'))!
    await nameHeader.trigger('click')

    const namesDesc = wrapper.findAll('tbody tr td:first-child').map((c) => c.text())
    expect(namesDesc).toEqual(['Zoe', 'Bob', 'Alice'])
  })

  it('has no Frequency column header', () => {
    mockPeople = [makePerson({ id: 'p-1', name: 'Alice', roles: [] })]
    const wrapper = mountRosterView()
    const headers = wrapper.findAll('th').map((h) => h.text())
    expect(headers.some((h) => h.includes('Frequency'))).toBe(false)
  })
})

describe('RosterView — pcEnabled (39-05, R089)', () => {
  it('pcEnabled false: both "Import from Planning Center" triggers are absent, "Add person manually" still renders', () => {
    mockPcEnabled = false
    mockPeople = []
    const wrapper = mountRosterView()

    const buttons = wrapper.findAll('button').map((b) => b.text())
    expect(buttons.some((t) => t.includes('Import from Planning Center'))).toBe(false)
    expect(buttons.some((t) => t.includes('Add person manually'))).toBe(true)
  })

  it('pcEnabled true: the empty-state "Import from Planning Center" trigger renders', () => {
    mockPcEnabled = true
    mockPeople = []
    const wrapper = mountRosterView()

    const buttons = wrapper.findAll('button').map((b) => b.text())
    expect(buttons.some((t) => t.includes('Import from Planning Center'))).toBe(true)
  })
})

describe('RosterView — tab-panel width (R244)', () => {
  it('R244: roles and teams tab wrappers are width-constrained but volunteers is not', () => {
    mockPeople = []
    const wrapper = mountRosterView()

    const widthConstrained = wrapper.findAll('.max-w-4xl')
    expect(widthConstrained.length).toBe(2)

    // Identify the volunteers tab wrapper by its distinctive empty-state copy
    // (the max-w-sm class on the inner <p> is unrelated to the wrapper-level
    // max-w-4xl constraint under test) and assert it is not among the
    // width-constrained set.
    const volunteersWrapper = wrapper.findAll('div').find((d) => d.text().includes('No volunteers yet'))
    expect(volunteersWrapper).toBeTruthy()
    expect(volunteersWrapper!.classes()).not.toContain('max-w-4xl')
    expect(widthConstrained.some((el) => el.element === volunteersWrapper!.element)).toBe(false)
  })
})
