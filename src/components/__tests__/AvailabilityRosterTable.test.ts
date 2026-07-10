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
        // Intentionally unsorted to prove chronological sorting in the column.
        blackoutDates: ['2026-07-19', '2026-07-05'],
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

describe('AvailabilityRosterTable — Roles & Frequency + Blackout & Note columns', () => {
  it('renders "Roles & Frequency" and "Blackout & Note" headers (no standalone Frequency/Roles/Quarter Note/Status)', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers).toContain('Roles & Frequency')
    expect(headers).toContain('Blackout & Note')
    expect(headers).not.toContain('Frequency')
    expect(headers).not.toContain('Roles')
    expect(headers).not.toContain('Quarter Note')
    expect(headers).not.toContain('Status')
  })

  it('shows EACH held role with its OWN per-role frequency (multi-role volunteer)', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // Ollie holds Guitar (tier out) + Drums (regular, n=4 → Monthly). Both roles and
    // both distinct frequencies must appear — not a single collapsed aggregate.
    const ollieRow = wrapper.findAll('tr').find((r) => r.text().includes('Outrole Ollie'))!
    expect(ollieRow.text()).toContain('Guitar')
    expect(ollieRow.text()).toContain('Drums')
    expect(ollieRow.text()).toContain('Out this quarter') // guitar tier
    expect(ollieRow.text()).toContain('Monthly') // drums cadence
  })

  it('labels a fill-in role as "Fill-in" and a default (no-entry) role as "Monthly"', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const fionaRow = wrapper.findAll('tr').find((r) => r.text().includes('Fillin Fiona'))!
    expect(fionaRow.text()).toContain('Fill-in') // role-guitar tier fillin

    // Rachel has no personQuarterData entry → her one role defaults to n=4 → Monthly.
    const rachelRow = wrapper.findAll('tr').find((r) => r.text().includes('Regular Rachel'))!
    expect(rachelRow.text()).toContain('Monthly')
  })

  it('shows actual blackout dates (chronologically sorted) plus the note in the Blackout & Note column', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const ollieRow = wrapper.findAll('tr').find((r) => r.text().includes('Outrole Ollie'))!
    // Actual dates, formatted and sorted (Jul 5 before Jul 19) — not just a count.
    expect(ollieRow.text()).toContain('Jul 5')
    expect(ollieRow.text()).toContain('Jul 19')
    expect(ollieRow.text().indexOf('Jul 5')).toBeLessThan(ollieRow.text().indexOf('Jul 19'))
    // …and the free-text note.
    expect(ollieRow.text()).toContain('Traveling the first two Sundays')
  })

  it('renders the em-dash placeholder when a person has no blackout dates and no note', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // Fiona: no blackout dates, empty note. Her row text otherwise contains 'Fill-in'
    // / 'Guitar' (never an em-dash), so the only '—' is the empty-cell placeholder.
    const fionaRow = wrapper.findAll('tr').find((r) => r.text().includes('Fillin Fiona'))!
    expect(fionaRow.text()).toContain('—')
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
})
