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
})
