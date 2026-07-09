import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuarterGrid from '../QuarterGrid.vue'
import type { Quarter, Role, Person } from '@/types/roster'

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    assignPerson: vi.fn(),
    clearAssignment: vi.fn(),
    swapAssignment: vi.fn(),
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
    frequencyTargetN: 4,
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
    frequencyTargetN: 4,
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
    frequencyTargetN: 4,
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
        frequencyTier: 'out',
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

describe('QuarterGrid', () => {
  it('excludes an out tier person from the manual gap-filling candidate list', async () => {
    const wrapper = mount(QuarterGrid, {
      props: {
        quarter: makeQuarter(),
        roles: makeRoles(),
        lastProposeResult: null,
      },
    })

    // Expand the cell for the only date/role to reveal the candidate list.
    const cellButton = wrapper.find('button[aria-expanded]')
    expect(cellButton.exists()).toBe(true)
    await cellButton.trigger('click')

    const text = wrapper.text()
    expect(text).toContain('Regular Rachel')
    expect(text).not.toContain('Outbound Otto')
  })

  it('still offers a person with no frequencyTier (defaults regular) as a candidate', async () => {
    const quarter = makeQuarter({ personQuarterData: {} })
    const wrapper = mount(QuarterGrid, {
      props: {
        quarter,
        roles: makeRoles(),
        lastProposeResult: null,
      },
    })

    const cellButton = wrapper.find('button[aria-expanded]')
    await cellButton.trigger('click')

    const text = wrapper.text()
    expect(text).toContain('Regular Rachel')
    expect(text).toContain('Outbound Otto')
  })

  it('excludes a person from a candidate list only for the role they are out for, per-role (D-05 gap closure)', async () => {
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
          roleTiers: { 'role-guitar': 'out', 'role-drums': 'regular' },
          note: '',
        },
      },
    })
    const wrapper = mount(QuarterGrid, {
      props: { quarter, roles, lastProposeResult: null },
    })

    const guitarCell = wrapper.find('button[data-role-id="role-guitar"][data-date="2026-07-05"]')
    const drumsCell = wrapper.find('button[data-role-id="role-drums"][data-date="2026-07-05"]')

    // Expand role-guitar: Petra is 'out' for this role => excluded from candidates.
    await guitarCell.trigger('click')
    expect(wrapper.text()).not.toContain('Perrole Petra')

    // Collapse guitar, expand role-drums: Petra is 'regular' for this role (per-role,
    // not per-person) => still eligible here.
    await guitarCell.trigger('click')
    await drumsCell.trigger('click')
    expect(wrapper.text()).toContain('Perrole Petra')
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
    return wrapper.find(`button[data-role-id="${roleId}"][data-date="${DATE}"]`)
  }

  it('shows a Group conflict warning on both cells when the same person holds a TECH role and a BAND role the same date, and does not remove either assignment', () => {
    const quarter = makeQuarter({
      serviceDates: [DATE],
      calendar: {
        [DATE]: {
          'role-guitar': ['person-regular'],
          'role-sound': ['person-regular'],
        },
      },
    })
    const wrapper = mount(QuarterGrid, {
      props: { quarter, roles: makeRolesFull(), lastProposeResult: null },
    })

    const guitarCell = cellFor(wrapper, 'role-guitar')
    const soundCell = cellFor(wrapper, 'role-sound')

    expect(guitarCell.text()).toContain('Group conflict')
    expect(soundCell.text()).toContain('Group conflict')

    // The warning never blocks the edit — the assignment stays present in both cells.
    expect(guitarCell.text()).toContain('Regular Rachel')
    expect(soundCell.text()).toContain('Regular Rachel')
  })

  it('shows a Group conflict warning on both cells when a person holds 2 BAND roles the same date', () => {
    const quarter = makeQuarter({
      serviceDates: [DATE],
      calendar: {
        [DATE]: {
          'role-guitar': ['person-regular'],
          'role-bass': ['person-regular'],
        },
      },
    })
    const wrapper = mount(QuarterGrid, {
      props: { quarter, roles: makeRolesFull(), lastProposeResult: null },
    })

    const guitarCell = cellFor(wrapper, 'role-guitar')
    const bassCell = cellFor(wrapper, 'role-bass')

    expect(guitarCell.text()).toContain('Group conflict')
    expect(bassCell.text()).toContain('Group conflict')
  })

  it('shows NO Group conflict warning for the legal 1 BAND + 1 VOCALS combo', () => {
    const quarter = makeQuarter({
      serviceDates: [DATE],
      calendar: {
        [DATE]: {
          'role-guitar': ['person-regular'],
          'role-vocals': ['person-regular'],
        },
      },
    })
    const wrapper = mount(QuarterGrid, {
      props: { quarter, roles: makeRolesFull(), lastProposeResult: null },
    })

    const guitarCell = cellFor(wrapper, 'role-guitar')
    const vocalsCell = cellFor(wrapper, 'role-vocals')

    expect(guitarCell.text()).not.toContain('Group conflict')
    expect(vocalsCell.text()).not.toContain('Group conflict')
  })
})
