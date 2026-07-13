import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RosterView from '../RosterView.vue'
import type { Person, Role } from '@/types/roster'

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
  { id: 'r-vocals', name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
]

let mockPeople: Person[] = []

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ orgId: 'org-1' }),
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
        RosterImportModal: { template: '<div />' },
        Teleport: { template: '<div><slot /></div>' },
      },
    },
  })
}

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
  it('wraps Roles config in CollapsibleSection', () => {
    mockPeople = [
      makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
    ]

    const wrapper = mountRosterView()

    expect(wrapper.text()).toContain('Roles config')
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
