import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AvailabilityDrawer from '../AvailabilityDrawer.vue'
import type { Person, Quarter } from '@/types/roster'

// Q3 2026 Sundays (13 total) — same demo data as the sketch (.planning/sketches/001-availability-editor).
const SERVICE_DATES = [
  '2026-07-05', '2026-07-12', '2026-07-19', '2026-07-26',
  '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30',
  '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27',
]

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
        frequencyTier: 'fillin',
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

const mockPeople: Person[] = [
  {
    id: 'person-1',
    name: 'Test Person',
    email: 'test@example.com',
    phone: '',
    active: true,
    roles: [],
    frequencyTargetN: 4,
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
    frequencyTargetN: 2,
    pcPersonId: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  },
]

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockPeople,
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

  it('pre-populates frequency, calendar, pairing chips, and note from existing PersonQuarterData', () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    // Fill-in preset active
    const fillinButton = wrapper.find('button[data-preset="fillin"]')
    expect(fillinButton.exists()).toBe(true)
    expect(fillinButton.attributes('data-active')).toBe('true')

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

  it('save calls setPersonAvailability with the current draft blackoutDates/pairedWith/frequencyTier/note', async () => {
    mockQuarter = makeQuarter()
    mockSetPersonAvailability.mockClear()
    mockUpdatePerson.mockClear()

    const wrapper = mountDrawer()

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save')!
    await saveButton.trigger('click')

    expect(mockSetPersonAvailability).toHaveBeenCalledWith('quarter-1', 'person-1', {
      blackoutDates: ['2026-07-19'],
      pairedWith: ['dean'],
      frequencyTier: 'fillin',
      note: 'x',
    })
  })
})
