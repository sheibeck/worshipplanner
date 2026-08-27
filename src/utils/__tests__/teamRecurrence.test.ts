import { describe, it, expect } from 'vitest'
import { ordinalOfMonth, teamMatchesDate } from '../teamRecurrence'
import type { Team } from '@/types/team'

// Reference calendar (Phase 86 — matches the phase's other test suites):
//   Sundays: 2026-09-06 (1st), -13 (2nd), -20 (3rd), -27 (4th)
//   2026-08-30 is a 5th-Sunday date (August 2026 has a 5th Sunday).

describe('ordinalOfMonth', () => {
  it('returns 1 for the 1st occurrence (day 6 -> ceil(6/7) = 1)', () => {
    expect(ordinalOfMonth('2026-09-06')).toBe(1)
  })

  it('returns 2 for day 13', () => {
    expect(ordinalOfMonth('2026-09-13')).toBe(2)
  })

  it('returns 3 for day 20', () => {
    expect(ordinalOfMonth('2026-09-20')).toBe(3)
  })

  it('returns 4 for day 27', () => {
    expect(ordinalOfMonth('2026-09-27')).toBe(4)
  })

  it('returns 5 for a 5th-Sunday-month date (day 30)', () => {
    expect(ordinalOfMonth('2026-08-30')).toBe(5)
  })

  it('returns 1 for day 1 and day 7 (both in the first 7-day block)', () => {
    expect(ordinalOfMonth('2026-09-01')).toBe(1)
    expect(ordinalOfMonth('2026-09-07')).toBe(1)
  })

  it('returns 2 for day 8 (first day of the second block)', () => {
    expect(ordinalOfMonth('2026-09-08')).toBe(2)
  })

  it('is UTC-stable: an early-month date resolves to ordinal 1 and does not slip to the prior month', () => {
    expect(ordinalOfMonth('2026-03-01')).toBe(1)
  })
})

describe('teamMatchesDate', () => {
  it('matches when ordinals includes the computed ordinal', () => {
    const team: Pick<Team, 'recurrence'> = { recurrence: { ordinals: [1, 3] } }
    expect(teamMatchesDate(team, '2026-09-06')).toBe(true) // 1st
    expect(teamMatchesDate(team, '2026-09-20')).toBe(true) // 3rd
  })

  it('does not match when the computed ordinal is not in the list', () => {
    const team: Pick<Team, 'recurrence'> = { recurrence: { ordinals: [1, 3] } }
    expect(teamMatchesDate(team, '2026-09-13')).toBe(false) // 2nd
  })

  it('returns false when recurrence is absent (undefined)', () => {
    const team: Pick<Team, 'recurrence'> = {}
    expect(teamMatchesDate(team, '2026-09-06')).toBe(false)
  })

  it('returns false when recurrence.ordinals is empty', () => {
    const team: Pick<Team, 'recurrence'> = { recurrence: { ordinals: [] } }
    expect(teamMatchesDate(team, '2026-09-06')).toBe(false)
  })

  it('matches a 5th-ordinal team on a 5th-Sunday date', () => {
    const team: Pick<Team, 'recurrence'> = { recurrence: { ordinals: [5] } }
    expect(teamMatchesDate(team, '2026-08-30')).toBe(true)
  })

  it('does not match a 5th-ordinal team on a month lacking a 5th occurrence', () => {
    const team: Pick<Team, 'recurrence'> = { recurrence: { ordinals: [5] } }
    expect(teamMatchesDate(team, '2026-09-27')).toBe(false) // 4th, September 2026 has no 5th Sunday
  })
})
