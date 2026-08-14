import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import RosterView from '../RosterView.vue'
import type { Person, Role } from '@/types/roster'

// A dedicated test file for the 60-03 ?edit={personId} deep-link handler so it
// never entangles with the known-failing (stale-assertion) RosterView.test.ts.

// A mutable reactive route so a test can drive the ?edit query the handler reads.
const mockRoute = reactive<{ query: Record<string, string | undefined> }>({ query: {} })
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

const mockRoles: Role[] = [
  { id: 'r-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
]

let mockPeople: Person[] = []
const mockSubscribe = vi.fn()
const mockUnsubscribeAll = vi.fn()
const mockSeedDefaultRolesIfEmpty = vi.fn(() => Promise.resolve())

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    orgId: 'org-1',
    settings: { pcEnabled: true },
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
    addPerson: vi.fn(() => Promise.resolve('new-id')),
    updatePerson: vi.fn(() => Promise.resolve()),
    deactivatePerson: vi.fn(() => Promise.resolve()),
    reactivatePerson: vi.fn(() => Promise.resolve()),
    deletePerson: vi.fn(() => Promise.resolve()),
    seedDefaultRolesIfEmpty: mockSeedDefaultRolesIfEmpty,
    deleteAllPeople: vi.fn(() => Promise.resolve(0)),
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

describe('RosterView — ?edit={personId} deep-link (60-03)', () => {
  beforeEach(() => {
    mockRoute.query = {}
    mockPeople = []
    mockSubscribe.mockClear()
  })

  it('opens the matching person edit form when mounted at /volunteers?edit=p1', async () => {
    mockPeople = [
      makePerson({ id: 'p1', name: 'Micah Torres', email: 'micah@example.com' }),
      makePerson({ id: 'p2', name: 'Dana Ruiz' }),
    ]
    mockRoute.query = { edit: 'p1' }

    const wrapper = mountRosterView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Edit Volunteer')
    const nameInput = wrapper.find('#volunteer-form input[type="text"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Micah Torres')
  })

  it('opens nothing for an unknown ?edit=zzz (graceful fallback)', () => {
    mockPeople = [makePerson({ id: 'p1', name: 'Micah Torres' })]
    mockRoute.query = { edit: 'zzz' }

    const wrapper = mountRosterView()

    expect(wrapper.text()).not.toContain('Edit Volunteer')
    expect(wrapper.find('#volunteer-form').exists()).toBe(false)
  })

  it('opens nothing when there is no ?edit query', () => {
    mockPeople = [makePerson({ id: 'p1', name: 'Micah Torres' })]
    mockRoute.query = {}

    const wrapper = mountRosterView()

    expect(wrapper.text()).not.toContain('Edit Volunteer')
    expect(wrapper.find('#volunteer-form').exists()).toBe(false)
  })
})
