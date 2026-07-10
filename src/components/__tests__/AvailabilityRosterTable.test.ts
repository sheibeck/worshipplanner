import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AvailabilityRosterTable from '../AvailabilityRosterTable.vue'
import type { Person, Quarter, Role } from '@/types/roster'

const SERVICE_DATES = ['2026-07-05', '2026-07-12', '2026-07-19']

const mockRoles: Role[] = [
  { id: 'role-guitar', name: 'Guitar', group: 'band', defaultCount: 1, order: 0 },
  { id: 'role-drums', name: 'Drums', group: 'band', defaultCount: 1, order: 1 },
]

// person-out-role: 'out' for role-guitar only, 'regular' for role-drums (per-role, D-05).
// person-fillin-role: 'fillin' for role-guitar only, no other roleFrequency entry.
// person-out-all: 'out' for its one held role — genuinely out all quarter.
// person-regular: no personQuarterData entry at all (defaults to 'regular').
const mockPeople: Person[] = ([
  {
    id: 'person-out-role',
    name: 'Outrole Ollie',
    email: 'ollie@example.com',
    phone: '',
    active: true,
    roles: ['role-guitar', 'role-drums'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
  {
    id: 'person-fillin-role',
    name: 'Fillin Fiona',
    email: 'fiona@example.com',
    phone: '',
    active: true,
    roles: ['role-guitar'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
  {
    id: 'person-out-all',
    name: 'Allout Alan',
    email: 'alan@example.com',
    phone: '',
    active: true,
    roles: ['role-drums'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
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
] as unknown) as Person[]

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockPeople,
    activePeople: mockPeople,
    roles: mockRoles,
  }),
}))

function makeQuarter(): Quarter {
  return {
    id: 'quarter-1',
    label: 'Q3 2026',
    year: 2026,
    quarter: 3,
    serviceDates: SERVICE_DATES,
    roleOverridesByDate: {},
    personQuarterData: {
      'person-out-role': {
        personId: 'person-out-role',
        blackoutDates: [],
        pairedWith: [],
        roleFrequency: {
          'role-guitar': { tier: 'out', n: 4 },
          'role-drums': { tier: 'regular', n: 4 },
        },
        note: 'Traveling the first two Sundays',
      },
      'person-fillin-role': {
        personId: 'person-fillin-role',
        blackoutDates: [],
        pairedWith: [],
        roleFrequency: {
          'role-guitar': { tier: 'fillin', n: 4 },
        },
        note: '',
      },
      'person-out-all': {
        personId: 'person-out-all',
        blackoutDates: [],
        pairedWith: [],
        roleFrequency: {
          'role-drums': { tier: 'out', n: 2 },
        },
        note: '',
      },
    },
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  }
}

describe('AvailabilityRosterTable — columns (Quarter Note replaces Unavailable; no Status column)', () => {
  it('renders a "Quarter Note" header and no "Unavailable" or "Status" header', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers).toContain('Quarter Note')
    expect(headers).not.toContain('Unavailable')
    expect(headers).not.toContain('Status')
  })

  it('renders the per-quarter note text in the Quarter Note column', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const ollieRow = wrapper.findAll('tr').find((r) => r.text().includes('Outrole Ollie'))!
    expect(ollieRow.text()).toContain('Traveling the first two Sundays')
  })

  it('renders the em-dash placeholder for a person with an empty quarter note', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // Fiona's note is '' and her frequency badge is 'fill-in' (never an em-dash),
    // so the only '—' in her row is the empty-note placeholder.
    const fionaRow = wrapper.findAll('tr').find((r) => r.text().includes('Fillin Fiona'))!
    expect(fionaRow.text()).toContain('—')
  })

  it('does not render aggregate status labels as row content (Status column removed)', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // "Fill-in" only ever came from the removed status pill — it must be gone now.
    expect(wrapper.text()).not.toContain('Fill-in')
  })

  it('keeps the "Out this quarter" filter working off the aggregate tier (R-05)', async () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const outFilterBtn = wrapper.findAll('button').find((b) => b.text() === 'Out this quarter')!
    await outFilterBtn.trigger('click')

    // Ollie is out for one held role → aggregate 'out' → included.
    expect(wrapper.text()).toContain('Outrole Ollie')
    // Fiona is fill-in, not out → excluded.
    expect(wrapper.text()).not.toContain('Fillin Fiona')
  })

  it('derives the frequency badge from roleFrequency n (not a standing field)', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // person-out-all's held role-drums is tier 'out', n=2 (Twice a month baseline) —
    // but full-quarter-out renders '—' regardless of n.
    const alanRow = wrapper.findAll('tr').find((r) => r.text().includes('Allout Alan'))!
    expect(alanRow.text()).toContain('—')

    // person-regular has no personQuarterData entry — falls back to the default n=4 (Monthly).
    const rachelRow = wrapper.findAll('tr').find((r) => r.text().includes('Regular Rachel'))!
    expect(rachelRow.text()).toContain('Monthly')
  })
})
