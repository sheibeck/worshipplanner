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
// person-fillin-role: 'fillin' for role-guitar only, no other roleTiers entry.
// person-legacy-out: no roleTiers at all, legacy frequencyTier 'out' (back-compat).
// person-regular: no personQuarterData entry at all (defaults to 'regular').
const mockPeople: Person[] = [
  {
    id: 'person-out-role',
    name: 'Outrole Ollie',
    email: 'ollie@example.com',
    phone: '',
    active: true,
    roles: ['role-guitar', 'role-drums'],
    frequencyTargetN: 4,
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
    frequencyTargetN: 4,
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
  {
    id: 'person-legacy-out',
    name: 'Legacy Larry',
    email: 'larry@example.com',
    phone: '',
    active: true,
    roles: ['role-drums'],
    frequencyTargetN: 4,
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
    frequencyTargetN: 4,
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
]

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
        roleTiers: { 'role-guitar': 'out', 'role-drums': 'regular' },
        note: '',
      },
      'person-fillin-role': {
        personId: 'person-fillin-role',
        blackoutDates: [],
        pairedWith: [],
        roleTiers: { 'role-guitar': 'fillin' },
        note: '',
      },
      'person-legacy-out': {
        personId: 'person-legacy-out',
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
  }
}

describe('AvailabilityRosterTable — per-role tier aggregation (D-05 gap closure)', () => {
  it('shows "Out this quarter" status for a person out for one held role, and includes them in the out filter', async () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // Default 'all' filter — status pill shows the aggregate 'out' status.
    const ollieRow = wrapper.findAll('tr').find((r) => r.text().includes('Outrole Ollie'))!
    expect(ollieRow.text()).toContain('Out this quarter')

    // Switch to the "Out this quarter" filter — Ollie must still appear.
    const outFilterBtn = wrapper.findAll('button').find((b) => b.text() === 'Out this quarter')!
    await outFilterBtn.trigger('click')
    expect(wrapper.text()).toContain('Outrole Ollie')
  })

  it('shows a non-Regular (Fill-in) status for a person fillin for one held role, and excludes them from the out filter', async () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const fionaRow = wrapper.findAll('tr').find((r) => r.text().includes('Fillin Fiona'))!
    expect(fionaRow.text()).toContain('Fill-in')
    expect(fionaRow.text()).not.toContain('Regular')

    const outFilterBtn = wrapper.findAll('button').find((b) => b.text() === 'Out this quarter')!
    await outFilterBtn.trigger('click')
    expect(wrapper.text()).not.toContain('Fillin Fiona')
  })

  it('still resolves "Out this quarter" via the legacy frequencyTier when roleTiers is absent (back-compat)', async () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const larryRow = wrapper.findAll('tr').find((r) => r.text().includes('Legacy Larry'))!
    expect(larryRow.text()).toContain('Out this quarter')

    const outFilterBtn = wrapper.findAll('button').find((b) => b.text() === 'Out this quarter')!
    await outFilterBtn.trigger('click')
    expect(wrapper.text()).toContain('Legacy Larry')
  })

  it('shows "Regular" status for a person with no personQuarterData entry at all', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    const rachelRow = wrapper.findAll('tr').find((r) => r.text().includes('Regular Rachel'))!
    expect(rachelRow.text()).toContain('Regular')
  })

  it('does NOT render full-quarter unavailability for a person out for only SOME held roles (WR-01)', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // Ollie is out for role-guitar but regular for role-drums — she is still available.
    // The aggregate status pill reads "Out this quarter" (audit surface), but the
    // Frequency and Unavailable columns must NOT assert she is out all quarter.
    const ollieRow = wrapper.findAll('tr').find((r) => r.text().includes('Outrole Ollie'))!
    expect(ollieRow.text()).not.toContain('out all quarter')
    expect(ollieRow.text()).toContain('fully available')
  })

  it('DOES render full-quarter unavailability for a person out for ALL held roles (legacy fallback)', () => {
    const wrapper = mount(AvailabilityRosterTable, { props: { quarter: makeQuarter() } })

    // Larry holds only role-drums and is legacy frequencyTier 'out' → genuinely out all quarter.
    const larryRow = wrapper.findAll('tr').find((r) => r.text().includes('Legacy Larry'))!
    expect(larryRow.text()).toContain('out all quarter')
  })
})
