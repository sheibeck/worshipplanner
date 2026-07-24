import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuarterGrid from '../QuarterGrid.vue'
import type { Quarter, Role, Person } from '@/types/roster'

const mockAssignPerson = vi.fn()
const mockClearAssignment = vi.fn()
const mockSwapAssignment = vi.fn()

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    assignPerson: mockAssignPerson,
    clearAssignment: mockClearAssignment,
    swapAssignment: mockSwapAssignment,
  }),
}))

const mockActivePeople: Person[] = [
  {
    id: 'person-regular',
    name: 'Regular Rachel',
    email: 'rachel@example.com',
    phone: '',
    active: true,
    roles: ['role-guitar'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
  {
    id: 'person-out',
    name: 'Outbound Otto',
    email: 'otto@example.com',
    phone: '',
    active: true,
    roles: ['role-guitar'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
  {
    id: 'person-role-tier',
    name: 'Perrole Petra',
    email: 'petra@example.com',
    phone: '',
    active: true,
    roles: ['role-guitar', 'role-drums'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
]

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockActivePeople,
    activePeople: mockActivePeople,
  }),
}))

function makeRoles(): Role[] {
  return [{ id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 }]
}

function makeQuarter(overrides: Partial<Quarter> = {}): Quarter {
  return {
    id: 'quarter-1',
    label: 'Q3 2026',
    year: 2026,
    quarter: 3,
    serviceDates: ['2026-07-05'],
    roleOverridesByDate: {},
    personQuarterData: {
      'person-out': {
        personId: 'person-out',
        blackoutDates: [],
        pairedWith: [],
        roleFrequency: { 'role-guitar': { tier: 'out', n: 4 } },
        note: '',
      },
    },
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

// The group editor slide-out (R-14) is a Teleport; stub it so teleported content is
// reachable via wrapper.find/findAll/text (mirrors AvailabilityDrawer.test.ts's pattern).
function mountGrid(props: { quarter: Quarter; roles: Role[]; lastProposeResult: null }) {
  return mount(QuarterGrid, {
    props,
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

// Open the whole-row drawer for a given date by clicking its row.
async function openRow(wrapper: ReturnType<typeof mount>, date: string) {
  const row = wrapper.find(`tr[data-date="${date}"]`)
  expect(row.exists()).toBe(true)
  await row.trigger('click')
}

describe('QuarterGrid', () => {
  it('excludes an out tier person from the manual gap-filling candidate list', async () => {
    const wrapper = mountGrid({
      quarter: makeQuarter(),
      roles: makeRoles(),
      lastProposeResult: null,
    })

    // Open the row drawer to reveal the per-role candidate list.
    await openRow(wrapper, '2026-07-05')

    const section = wrapper.find('[data-role-section="role-guitar"]')
    expect(section.text()).toContain('Regular Rachel')
    expect(section.text()).not.toContain('Outbound Otto')
  })

  it('still offers a person with no roleFrequency entry (defaults regular) as a candidate', async () => {
    const quarter = makeQuarter({ personQuarterData: {} })
    const wrapper = mountGrid({
      quarter,
      roles: makeRoles(),
      lastProposeResult: null,
    })

    await openRow(wrapper, '2026-07-05')

    const section = wrapper.find('[data-role-section="role-guitar"]')
    expect(section.text()).toContain('Regular Rachel')
    expect(section.text()).toContain('Outbound Otto')
  })

  it('excludes a person from a candidate list only for the role they are out for, per-role (D-05 gap closure, R-05 single source)', async () => {
    const DATE = '2026-07-05'
    const roles: Role[] = [
      { id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
      { id: 'role-drums', name: 'drums', group: 'band', defaultCount: 1, order: 1 },
    ]
    const quarter = makeQuarter({
      serviceDates: [DATE],
      personQuarterData: {
        'person-role-tier': {
          personId: 'person-role-tier',
          blackoutDates: [],
          pairedWith: [],
          roleFrequency: {
            'role-guitar': { tier: 'out', n: 4 },
            'role-drums': { tier: 'regular', n: 4 },
          },
          note: '',
        },
      },
    })
    const wrapper = mountGrid({ quarter, roles, lastProposeResult: null })

    // The whole-row drawer shows every role section at once. Petra is 'out' for
    // guitar (excluded there) but 'regular' for drums (offered there) — per-role,
    // not per-person.
    await openRow(wrapper, DATE)

    const guitarSection = wrapper.find('[data-role-section="role-guitar"]')
    const drumsSection = wrapper.find('[data-role-section="role-drums"]')
    expect(guitarSection.text()).not.toContain('Perrole Petra')
    expect(drumsSection.text()).toContain('Perrole Petra')
  })

  describe('whole-row click opens the slide-out row editor', () => {
    const DATE = '2026-07-05'

    it('clicking a date row opens the slide-out editor titled with that date', async () => {
      const wrapper = mountGrid({
        quarter: makeQuarter({ serviceDates: [DATE], calendar: { [DATE]: { 'role-guitar': ['person-regular'] } } }),
        roles: makeRoles(),
        lastProposeResult: null,
      })

      // Slide-out is closed initially — the close button (panel-only element) absent.
      expect(wrapper.find('[aria-label="Close editor"]').exists()).toBe(false)

      await openRow(wrapper, DATE)

      // Panel now rendered (Teleport stubbed in place) with the date title.
      expect(wrapper.find('[aria-label="Close editor"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Sun, Jul 5')
    })
  })

  describe('row-drawer actions invoke the corresponding store methods', () => {
    const DATE = '2026-07-05'

    it('assigning a person from the "Add a person" select calls assignPerson', async () => {
      mockAssignPerson.mockClear()
      const quarter = makeQuarter({ serviceDates: [DATE] })
      const wrapper = mountGrid({ quarter, roles: makeRoles(), lastProposeResult: null })

      await openRow(wrapper, DATE)

      const section = wrapper.find('[data-role-section="role-guitar"]')
      const addSelect = section.find('select')
      await addSelect.setValue('person-regular')
      const assignButton = section.findAll('button').find((b) => b.text() === 'Assign' && !b.attributes('disabled'))!
      await assignButton.trigger('click')

      expect(mockAssignPerson).toHaveBeenCalledWith('quarter-1', DATE, 'role-guitar', 'person-regular')
    })

    it('clearing an assigned person from the drawer\'s Clear button calls clearAssignment', async () => {
      mockClearAssignment.mockClear()
      const quarter = makeQuarter({
        serviceDates: [DATE],
        calendar: { [DATE]: { 'role-guitar': ['person-regular'] } },
      })
      const wrapper = mountGrid({ quarter, roles: makeRoles(), lastProposeResult: null })

      await openRow(wrapper, DATE)

      const clearButton = wrapper.findAll('button').find((b) => b.text() === 'Clear')!
      await clearButton.trigger('click')

      expect(mockClearAssignment).toHaveBeenCalledWith('quarter-1', DATE, 'role-guitar', 'person-regular')
    })

    it('swapping an assigned person via the swap select calls swapAssignment', async () => {
      mockSwapAssignment.mockClear()
      const quarter = makeQuarter({
        serviceDates: [DATE],
        calendar: { [DATE]: { 'role-guitar': ['person-regular'] } },
      })
      const wrapper = mountGrid({ quarter, roles: makeRoles(), lastProposeResult: null })

      await openRow(wrapper, DATE)

      // First select in the guitar section is the swap select for the assigned person.
      const swapSelect = wrapper.find('[data-role-section="role-guitar"]').findAll('select')[0]!
      await swapSelect.setValue('person-role-tier')

      expect(mockSwapAssignment).toHaveBeenCalledWith('quarter-1', DATE, 'role-guitar', 'person-regular', 'person-role-tier')
    })
  })
})

describe('QuarterGrid — live group co-occurrence warning (D-11)', () => {
  const DATE = '2026-07-05'

  function makeRolesFull(): Role[] {
    return [
      { id: 'role-guitar', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
      { id: 'role-bass', name: 'bass', group: 'band', defaultCount: 1, order: 1 },
      { id: 'role-vocals', name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
      { id: 'role-sound', name: 'sound', group: 'tech', defaultCount: 1, order: 3 },
    ]
  }

  function cellFor(wrapper: ReturnType<typeof mount>, roleId: string) {
    return wrapper.find(`td[data-role-id="${roleId}"][data-date="${DATE}"]`)
  }

  it('shows a group conflict marker on both cells when the same person holds a TECH role and a BAND role the same date, and does not remove either assignment', () => {
    const quarter = makeQuarter({
      serviceDates: [DATE],
      calendar: {
        [DATE]: {
          'role-guitar': ['person-regular'],
          'role-sound': ['person-regular'],
        },
      },
    })
    const wrapper = mountGrid({ quarter, roles: makeRolesFull(), lastProposeResult: null })

    const guitarCell = cellFor(wrapper, 'role-guitar')
    const soundCell = cellFor(wrapper, 'role-sound')

    expect(guitarCell.text()).toContain('group')
    expect(soundCell.text()).toContain('group')

    // The warning never blocks the edit — the assignment stays present in both cells.
    expect(guitarCell.text()).toContain('Regular Rachel')
    expect(soundCell.text()).toContain('Regular Rachel')
  })

  it('shows a group conflict marker on both cells when a person holds 2 BAND roles the same date', () => {
    const quarter = makeQuarter({
      serviceDates: [DATE],
      calendar: {
        [DATE]: {
          'role-guitar': ['person-regular'],
          'role-bass': ['person-regular'],
        },
      },
    })
    const wrapper = mountGrid({ quarter, roles: makeRolesFull(), lastProposeResult: null })

    const guitarCell = cellFor(wrapper, 'role-guitar')
    const bassCell = cellFor(wrapper, 'role-bass')

    expect(guitarCell.text()).toContain('group')
    expect(bassCell.text()).toContain('group')
  })

  it('shows NO group conflict marker for the legal 1 BAND + 1 VOCALS combo', () => {
    const quarter = makeQuarter({
      serviceDates: [DATE],
      calendar: {
        [DATE]: {
          'role-guitar': ['person-regular'],
          'role-vocals': ['person-regular'],
        },
      },
    })
    const wrapper = mountGrid({ quarter, roles: makeRolesFull(), lastProposeResult: null })

    const guitarCell = cellFor(wrapper, 'role-guitar')
    const vocalsCell = cellFor(wrapper, 'role-vocals')

    expect(guitarCell.text()).not.toContain('group')
    expect(vocalsCell.text()).not.toContain('group')
  })
})
