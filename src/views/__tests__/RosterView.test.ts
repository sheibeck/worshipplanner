import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RosterView from '../RosterView.vue'
import type { Person, Role } from '@/types/roster'

const mockAddPerson = vi.fn(() => Promise.resolve('new-id'))
const mockUpdatePerson = vi.fn((_id: string, _input: Record<string, unknown>) => Promise.resolve())
const mockDeactivatePerson = vi.fn(() => Promise.resolve())
const mockReactivatePerson = vi.fn(() => Promise.resolve())
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
  it('wraps Roles config and Inactive Volunteers in CollapsibleSection', () => {
    mockPeople = [
      makePerson({ id: 'p-active', name: 'Alice', active: true, roles: [] }),
      makePerson({ id: 'p-inactive', name: 'Bob', active: false, roles: [] }),
    ]

    const wrapper = mountRosterView()

    expect(wrapper.text()).toContain('Roles config')
    expect(wrapper.text()).toContain('Inactive Volunteers (1)')
    // Both sections default expanded (D-17) — the inactive person's name is visible.
    expect(wrapper.text()).toContain('Bob')
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
