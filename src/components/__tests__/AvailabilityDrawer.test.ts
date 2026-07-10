import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AvailabilityDrawer from '../AvailabilityDrawer.vue'
import type { Person, Quarter, Role } from '@/types/roster'

// Q3 2026 Sundays (13 total) — same demo data as the sketch (.planning/sketches/001-availability-editor).
const SERVICE_DATES = [
  '2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26',
  '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30',
  '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
]

const FREQ_PRESET_COUNT = 5 // weekly, biweek, monthly, fillin, out

const mockSetPersonAvailability = vi.fn(() => Promise.resolve())
const mockUpdatePerson = vi.fn(() => Promise.resolve())

function makeQuarter(overrides: Partial<Quarter> = {}): Quarter {
  return {
    id: 'quarter-1',
    label: 'Q3 2026',
    year: 2026,
    quarter: 3,
    serviceDates: SERVICE_DATES,
    roleOverridesByDate: {},
    personQuarterData: {
      'person-1': {
        personId: 'person-1',
        blackoutDates: ['2026-07-19'],
        pairedWith: ['dean'],
        roleFrequency: { sound: { tier: 'out', n: 0 } },
        note: 'x',
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

let mockQuarter: Quarter = makeQuarter()

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    getQuarter: (id: string) => {
      if (id !== mockQuarter.id) throw new Error(`Quarter ${id} not found`)
      return mockQuarter
    },
    setPersonAvailability: mockSetPersonAvailability,
  }),
}))

// person-1 holds two roles (one TECH, one VOCALS) so per-role tier controls (D-06)
// have something real to render for.
const mockPeople: Person[] = [
  {
    id: 'person-1',
    name: 'Test Person',
    email: 'test@example.com',
    phone: '',
    active: true,
    roles: ['sound', 'vocals'],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
  {
    id: 'dean',
    name: 'Dean Woodard',
    email: 'dean@example.com',
    phone: '',
    active: true,
    roles: [],
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
]

// 'guitar' is intentionally NOT held by person-1 — used to test toggling a
// role ON via the drawer's roles checklist (D-09).
const mockRoles: Role[] = [
  { id: 'sound', name: 'Sound', group: 'tech', defaultCount: 1, order: 0 },
  { id: 'vocals', name: 'Vocals', group: 'vocals', defaultCount: 1, order: 1 },
  { id: 'guitar', name: 'Guitar', group: 'band', defaultCount: 1, order: 2 },
]

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockPeople,
    roles: mockRoles,
    updatePerson: mockUpdatePerson,
  }),
}))

describe('AvailabilityDrawer', () => {
  function mountDrawer() {
    return mount(AvailabilityDrawer, {
      props: { quarterId: 'quarter-1', personId: 'person-1' },
      global: {
        // Render Teleport's default slot in place — content actually teleported to
        // document.body isn't reachable via wrapper.find/findAll.
        stubs: { Teleport: { template: '<div><slot /></div>' } },
      },
    })
  }

  it('renders one tier control (preset row) per held role, populated from roleFrequency with a regular/monthly default for absent roles (D-05/D-06)', () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const soundButtons = wrapper.findAll('button[data-role-id="sound"]')
    const vocalsButtons = wrapper.findAll('button[data-role-id="vocals"]')
    expect(soundButtons.length).toBe(FREQ_PRESET_COUNT)
    expect(vocalsButtons.length).toBe(FREQ_PRESET_COUNT)

    // Sound has an explicit roleFrequency entry: { tier: 'out', n: 0 }.
    const soundOut = soundButtons.find((b) => b.attributes('data-preset') === 'out')!
    expect(soundOut.attributes('data-active')).toBe('true')

    // Vocals has no roleFrequency entry — defaults to { tier: 'regular', n: 4 },
    // which maps to the 'monthly' preset (D-05).
    const vocalsMonthly = vocalsButtons.find((b) => b.attributes('data-preset') === 'monthly')!
    expect(vocalsMonthly.attributes('data-active')).toBe('true')
  })

  // WR-04 regression: a non-preset n (e.g. imported via CSV as a bare "3" or "1-in-6",
  // both valid frequencyLabelToN inputs) must not be shown as an active preset — previously
  // this fell back to highlighting "Monthly" as active even though the real cadence differs,
  // so clicking it silently overwrote the person's real n with 4.
  it('does not highlight any preset as active for a non-canonical regular-tier n, and shows a distinct custom readout', () => {
    mockQuarter = makeQuarter({
      personQuarterData: {
        'person-1': {
          personId: 'person-1',
          blackoutDates: [],
          pairedWith: [],
          roleFrequency: { sound: { tier: 'regular', n: 3 } },
          note: '',
        },
      },
    })
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const soundButtons = wrapper.findAll('button[data-role-id="sound"]')
    expect(soundButtons.length).toBe(FREQ_PRESET_COUNT)
    // None of weekly/biweek/monthly/fillin/out should be marked active for n:3.
    for (const button of soundButtons) {
      expect(button.attributes('data-active')).toBe('false')
    }

    // The readout explicitly surfaces the custom cadence instead of silently agreeing with
    // whichever preset the fallback used to pick.
    expect(wrapper.text()).toContain('Custom (1-in-3)')
  })

  it('does not render a date-range picker — per-Sunday click-to-toggle is the only blackout entry method (R-08)', () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    expect(wrapper.findAll('input[type="date"]').length).toBe(0)
    expect(wrapper.text()).not.toContain('Block Sundays in range')
  })

  it('pre-populates blackout calendar, pairing chips, and quarter note from existing PersonQuarterData (D-07 unchanged)', () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    // Blacked-out Sunday rendered marked off
    const blockedCell = wrapper.find('button[data-date="2026-07-19"]')
    expect(blockedCell.exists()).toBe(true)
    expect(blockedCell.classes()).toContain('line-through')

    // Pairing chip
    expect(wrapper.text()).toContain('Dean Woodard')

    // Note text
    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('x')
  })

  it('calendar renders exactly one clickable Sunday per serviceDate and toggles blackout on click', async () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const sundayButtons = wrapper.findAll('button[data-role="sunday-cell"]')
    expect(sundayButtons.length).toBe(SERVICE_DATES.length)

    const renderedDates = sundayButtons.map((b) => b.attributes('data-date'))
    expect(renderedDates.sort()).toEqual([...SERVICE_DATES].sort())

    // Clicking a not-yet-blocked date adds exactly that ISO date to the draft blackout set.
    const notYetBlocked = wrapper.find('button[data-date="2026-07-05"]')
    expect(notYetBlocked.classes()).not.toContain('line-through')
    await notYetBlocked.trigger('click')
    expect(notYetBlocked.classes()).toContain('line-through')

    // Only the clicked date + the pre-seeded one are now blocked (nothing else).
    const blockedNow = wrapper
      .findAll('button[data-role="sunday-cell"]')
      .filter((b) => b.classes().includes('line-through'))
      .map((b) => b.attributes('data-date'))
    expect(blockedNow.sort()).toEqual(['2026-07-05', '2026-07-19'].sort())
  })

  it('changing per-role tiers (Vocals -> Monthly, Sound -> Out) then saving calls setPersonAvailability with roleFrequency carrying both, and never writes a standing frequency through rosterStore (D-05)', async () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const vocalsMonthly = wrapper
      .findAll('button[data-role-id="vocals"]')
      .find((b) => b.attributes('data-preset') === 'monthly')!
    await vocalsMonthly.trigger('click')

    const soundOut = wrapper
      .findAll('button[data-role-id="sound"]')
      .find((b) => b.attributes('data-preset') === 'out')!
    await soundOut.trigger('click')

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockSetPersonAvailability).toHaveBeenCalledWith('quarter-1', 'person-1', {
      blackoutDates: ['2026-07-19'],
      pairedWith: ['dean'],
      roleFrequency: { sound: { tier: 'out', n: 0 }, vocals: { tier: 'regular', n: 4 } },
      note: 'x',
    })

    // No standing frequency write remains — frequency is fully quarter-scoped (D-05).
    expect(mockUpdatePerson).not.toHaveBeenCalled()
  })

  it('renders a roles checklist bound to person.roles and toggling a role ON calls the roster store (not the quarters store) (D-09)', async () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const soundCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="sound"]')
    const vocalsCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="vocals"]')
    const guitarCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="guitar"]')
    expect((soundCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect((vocalsCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect((guitarCheckbox.element as HTMLInputElement).checked).toBe(false)

    await guitarCheckbox.trigger('change')

    expect(mockUpdatePerson).toHaveBeenCalledWith('person-1', { roles: ['sound', 'vocals', 'guitar'] })
    expect(mockSetPersonAvailability).not.toHaveBeenCalled()
  })

  it('toggling an already-held role OFF calls rosterStore.updatePerson with it removed (D-09)', async () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const soundCheckbox = wrapper.find('input[data-role="role-checkbox"][data-role-id="sound"]')
    await soundCheckbox.trigger('change')

    expect(mockUpdatePerson).toHaveBeenCalledWith('person-1', { roles: ['vocals'] })
    expect(mockSetPersonAvailability).not.toHaveBeenCalled()
  })
})
