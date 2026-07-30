import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import NewServiceDialog from '../NewServiceDialog.vue'

// R038: the dialog's default date is "the nearest FUTURE Sunday with no plan yet".
// It reads the clock at setup time (defaultForm()), so every test pins the clock.
//
// Reference calendar used throughout (verified against quarterDates.test.ts):
//   Sundays: 2026-08-16, -23, -30 | 2026-09-06, -13, -20, -27
//   Sunday-of-month ordinals: 08-30 -> 5, 09-06 -> 1, 09-13 -> 2, 09-20 -> 3
//   Team defaults by ordinal: 1 -> ['Orchestra','Communion'], 3 -> ['Choir'], else []
const THURSDAY_BEFORE_AUG_30 = new Date(2026, 7, 27, 10, 0, 0)

function mountDialog(props: { open?: boolean; takenDates?: string[] } = {}) {
  return mount(NewServiceDialog, {
    // `takenDates` is deliberately omitted unless supplied, so the tests also
    // exercise the prop's default.
    props: { open: true, ...props },
    global: {
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

function dateInputValue(wrapper: VueWrapper): string {
  return (wrapper.find('input[type="date"]').element as HTMLInputElement).value
}

async function clickCreate(wrapper: VueWrapper) {
  const button = wrapper.findAll('button').find((b) => b.text() === 'Create Service')
  expect(button).toBeDefined()
  await button!.trigger('click')
  const emitted = wrapper.emitted('create')
  expect(emitted).toBeTruthy()
  return emitted![0]![0] as { date: string; name: string; teams: string[] }
}

describe('NewServiceDialog default date (R038)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(THURSDAY_BEFORE_AUG_30)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to the plain next Sunday when no Sunday is taken', () => {
    const wrapper = mountDialog({ takenDates: [] })
    expect(dateInputValue(wrapper)).toBe('2026-08-30')
  })

  it('behaves exactly as before R038 when takenDates is empty', () => {
    // Pre-R038 behaviour was "next Sunday, never today" — this is the same value.
    const withEmpty = mountDialog({ takenDates: [] })
    const withNone = mountDialog()
    expect(dateInputValue(withEmpty)).toBe('2026-08-30')
    expect(dateInputValue(withNone)).toBe('2026-08-30')
  })

  it('the takenDates prop is optional, so an existing mount site keeps working', () => {
    // Mounted with only `open` — no takenDates at all.
    const wrapper = mountDialog()
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    expect(dateInputValue(wrapper)).toBe('2026-08-30')
  })

  it('skips a taken Sunday and defaults to the next free one', () => {
    const wrapper = mountDialog({ takenDates: ['2026-08-30'] })
    expect(dateInputValue(wrapper)).toBe('2026-09-06')
  })

  it('skips however many consecutive Sundays are taken', () => {
    const wrapper = mountDialog({
      takenDates: ['2026-08-30', '2026-09-06', '2026-09-13'],
    })
    expect(dateInputValue(wrapper)).toBe('2026-09-20')
  })

  it('ignores taken dates in the past — the search is forward-only (D-12)', () => {
    const wrapper = mountDialog({ takenDates: ['2026-08-16', '2026-08-23'] })
    expect(dateInputValue(wrapper)).toBe('2026-08-30')
  })

  it('★ when opened ON a Sunday, defaults to the FOLLOWING Sunday, not today', () => {
    // The strictly-forward convention this plan settled on (D-13): the fallback must
    // degrade to exactly the pre-R038 behaviour, which never offered "today".
    vi.setSystemTime(new Date(2026, 7, 30, 9, 0, 0)) // Sunday 2026-08-30
    const wrapper = mountDialog({ takenDates: [] })
    expect(dateInputValue(wrapper)).toBe('2026-09-06')
  })

  it('★ when opened on a Sunday whose following Sunday is taken, keeps walking forward', () => {
    vi.setSystemTime(new Date(2026, 7, 30, 9, 0, 0)) // Sunday 2026-08-30
    const wrapper = mountDialog({ takenDates: ['2026-09-06'] })
    expect(dateInputValue(wrapper)).toBe('2026-09-13')
  })

  it('recomputes the default each time the dialog is reopened', async () => {
    const wrapper = mountDialog({ open: false, takenDates: [] })
    await wrapper.setProps({ open: true })
    expect(dateInputValue(wrapper)).toBe('2026-08-30')

    // The service the user just created shows up in the list; reopening skips it.
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ takenDates: ['2026-08-30'], open: true })
    expect(dateInputValue(wrapper)).toBe('2026-09-06')
  })

  it('emits the chosen free Sunday on create', async () => {
    const wrapper = mountDialog({ takenDates: ['2026-08-30'] })
    const payload = await clickCreate(wrapper)
    expect(payload.date).toBe('2026-09-06')
  })
})

// ★ Task 3 — the team side effect. sundayOrdinal() drives the default TEAM selection,
// so changing the default date changes the default teams. This is a real, deliberate
// behaviour change introduced by R038; these tests pin it so it cannot surface later
// as a surprise (or be "fixed" by someone who does not know it was intended).
describe('NewServiceDialog default teams follow the chosen Sunday (R038 side effect)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('★ skipping a taken Sunday selects the SECOND Sunday\'s ordinal teams (5th -> 1st)', async () => {
    vi.setSystemTime(THURSDAY_BEFORE_AUG_30)

    // Baseline: nothing taken -> 2026-08-30, the 5th Sunday -> no default teams.
    const baseline = mountDialog({ takenDates: [] })
    const baselinePayload = await clickCreate(baseline)
    expect(baselinePayload.date).toBe('2026-08-30')
    expect(baselinePayload.teams).toEqual([])

    // First candidate taken -> 2026-09-06, the 1st Sunday -> Orchestra + Communion.
    const wrapper = mountDialog({ takenDates: ['2026-08-30'] })
    const payload = await clickCreate(wrapper)
    expect(payload.date).toBe('2026-09-06')
    expect(payload.teams).toEqual(['Orchestra', 'Communion'])
  })

  it('★ the same effect with a different ordinal pair (2nd -> 3rd Sunday -> Choir)', async () => {
    vi.setSystemTime(new Date(2026, 8, 10, 10, 0, 0)) // Thursday 2026-09-10

    // Baseline: 2026-09-13, the 2nd Sunday -> no default teams.
    const baseline = mountDialog({ takenDates: [] })
    const baselinePayload = await clickCreate(baseline)
    expect(baselinePayload.date).toBe('2026-09-13')
    expect(baselinePayload.teams).toEqual([])

    // First candidate taken -> 2026-09-20, the 3rd Sunday -> Choir.
    const wrapper = mountDialog({ takenDates: ['2026-09-13'] })
    const payload = await clickCreate(wrapper)
    expect(payload.date).toBe('2026-09-20')
    expect(payload.teams).toEqual(['Choir'])
  })

  it('renders the skipped-to Sunday\'s teams as checked in the UI', () => {
    vi.setSystemTime(THURSDAY_BEFORE_AUG_30)
    const wrapper = mountDialog({ takenDates: ['2026-08-30'] })
    const checked = wrapper
      .findAll('input[type="checkbox"]')
      .filter((c) => (c.element as HTMLInputElement).checked)
      .map((c) => (c.element as HTMLInputElement).value)
    expect(checked).toEqual(['Orchestra', 'Communion'])
  })
})
