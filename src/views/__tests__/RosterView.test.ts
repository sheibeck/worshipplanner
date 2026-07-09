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

function makePerson(overrides: Partial<Person> & { id: string; name: string }): Person {
  return {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email ?? `${overrides.id}@example.com`,
    phone: overrides.phone ?? '',
    active: overrides.active ?? true,
    roles: overrides.roles ?? [],
    frequencyTargetN: overrides.frequencyTargetN ?? 4,
    roleFrequencies: overrides.roleFrequencies,
    pcPersonId: overrides.pcPersonId ?? null,
    createdAt: overrides.createdAt ?? ({} as never),
    updatedAt: overrides.updatedAt ?? ({} as never),
  }
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

describe('RosterView — per-role cadence controls (D-01/D-02)', () => {
  beforeEach(() => {
    mockAddPerson.mockClear()
    mockUpdatePerson.mockClear()
    mockDeactivatePerson.mockClear()
    mockReactivatePerson.mockClear()
  })

  it('renders exactly one cadence select per held role, defaulting a missing entry to frequencyTargetN', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar', 'r-vocals'],
        roleFrequencies: { 'r-guitar': 1 }, // vocals has no tuned entry
        frequencyTargetN: 2,
      }),
    ]

    const wrapper = mountRosterView()
    const editButton = wrapper.findAll('button').find((b) => b.text() === 'Edit')!
    await editButton.trigger('click')

    const selects = wrapper.findAll('select[data-role="cadence-select"]')
    expect(selects.length).toBe(2)

    const guitarSelect = selects.find((s) => s.attributes('data-role-id') === 'r-guitar')!
    const vocalsSelect = selects.find((s) => s.attributes('data-role-id') === 'r-vocals')!
    expect(guitarSelect.exists()).toBe(true)
    expect(vocalsSelect.exists()).toBe(true)
    expect((guitarSelect.element as HTMLSelectElement).value).toBe('1')
    // No roleFrequencies entry for vocals — falls back to frequencyTargetN (D-03-at-read-time).
    expect((vocalsSelect.element as HTMLSelectElement).value).toBe('2')
  })

  it('checking a new role adds a cadence select defaulting to N=4 (monthly, D-02)', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar'],
        roleFrequencies: { 'r-guitar': 1 },
        frequencyTargetN: 1,
      }),
    ]

    const wrapper = mountRosterView()
    const editButton = wrapper.findAll('button').find((b) => b.text() === 'Edit')!
    await editButton.trigger('click')

    expect(wrapper.findAll('select[data-role="cadence-select"]').length).toBe(1)

    const drumsCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((c) => c.attributes('value') === 'r-drums')!
    await drumsCheckbox.setValue(true)

    const selects = wrapper.findAll('select[data-role="cadence-select"]')
    expect(selects.length).toBe(2)
    const drumsSelect = selects.find((s) => s.attributes('data-role-id') === 'r-drums')!
    expect((drumsSelect.element as HTMLSelectElement).value).toBe('4')
  })

  it('unchecking a role removes its cadence row', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar', 'r-vocals'],
        roleFrequencies: { 'r-guitar': 1, 'r-vocals': 2 },
        frequencyTargetN: 2,
      }),
    ]

    const wrapper = mountRosterView()
    const editButton = wrapper.findAll('button').find((b) => b.text() === 'Edit')!
    await editButton.trigger('click')

    expect(wrapper.findAll('select[data-role="cadence-select"]').length).toBe(2)

    const vocalsCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((c) => c.attributes('value') === 'r-vocals')!
    await vocalsCheckbox.setValue(false)

    const selects = wrapper.findAll('select[data-role="cadence-select"]')
    expect(selects.length).toBe(1)
    expect(selects.find((s) => s.attributes('data-role-id') === 'r-vocals')).toBeUndefined()
  })

  it('onSaveVolunteer payload includes roleFrequencies for all held roles', async () => {
    mockPeople = [
      makePerson({
        id: 'p-1',
        name: 'Alice',
        roles: ['r-guitar', 'r-vocals'],
        roleFrequencies: { 'r-guitar': 1 },
        frequencyTargetN: 2,
      }),
    ]

    const wrapper = mountRosterView()
    const editButton = wrapper.findAll('button').find((b) => b.text() === 'Edit')!
    await editButton.trigger('click')

    const form = wrapper.find('form#volunteer-form')
    await form.trigger('submit.prevent')

    expect(mockUpdatePerson).toHaveBeenCalledTimes(1)
    const [personId, input] = mockUpdatePerson.mock.calls[0]!
    expect(personId).toBe('p-1')
    expect(input).toMatchObject({
      roleFrequencies: { 'r-guitar': 1, 'r-vocals': 2 },
    })
  })
})

describe('RosterView — frequency sort reconciled with per-role cadence', () => {
  beforeEach(() => {
    mockUpdatePerson.mockClear()
  })

  it('sorts by minimum per-role cadence N, with a deterministic name tie-break, and never throws on an absent roleFrequencies map', async () => {
    mockPeople = [
      makePerson({
        id: 'p-bob',
        name: 'Bob',
        roles: [],
        roleFrequencies: undefined, // absent map — must fall back to frequencyTargetN, never NaN/throw
        frequencyTargetN: 2,
      }),
      makePerson({
        id: 'p-alice',
        name: 'Alice',
        roles: ['r-guitar'],
        roleFrequencies: { 'r-guitar': 1 },
        frequencyTargetN: 4,
      }),
      makePerson({
        id: 'p-zoe',
        name: 'Zoe',
        roles: ['r-vocals'],
        roleFrequencies: { 'r-vocals': 1 },
        frequencyTargetN: 4,
      }),
    ]

    const wrapper = mountRosterView()

    const frequencyHeader = wrapper.findAll('button').find((b) => b.text().includes('Frequency'))!
    await frequencyHeader.trigger('click')

    const nameCells = wrapper.findAll('tbody tr td:first-child')
    const names = nameCells.map((c) => c.text())
    // Alice and Zoe both have min-N=1 (tie-break by name); Bob (absent map, falls back to
    // frequencyTargetN=2) sorts last. No NaN/throw for Bob's absent roleFrequencies map.
    expect(names).toEqual(['Alice', 'Zoe', 'Bob'])
  })
})
