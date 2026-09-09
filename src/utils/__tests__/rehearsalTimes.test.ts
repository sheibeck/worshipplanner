import { describe, it, expect, afterEach } from 'vitest'
import { sortRehearsals, formatWallClockTime, isDisplayableRehearsal, type Rehearsal } from '../rehearsalTimes'

describe('sortRehearsals', () => {
  it('orders by date ascending then time ascending, regardless of insert order', () => {
    const rehearsals: Rehearsal[] = [
      { id: 'c', date: '2026-09-15', time: '18:00' },
      { id: 'a', date: '2026-09-10', time: '19:00' },
      { id: 'd', date: '2026-09-15', time: '07:00' },
      { id: 'b', date: '2026-09-10', time: '08:00' },
    ]
    const sorted = sortRehearsals(rehearsals)
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('sorts undated rehearsals (date === "") after all dated rows', () => {
    const rehearsals: Rehearsal[] = [
      { id: 'undated-late', date: '', time: '20:00' },
      { id: 'dated', date: '2026-09-10', time: '19:00' },
      { id: 'undated-early', date: '', time: '06:00' },
    ]
    const sorted = sortRehearsals(rehearsals)
    expect(sorted.map((r) => r.id)).toEqual(['dated', 'undated-early', 'undated-late'])
  })

  it('returns a new array without mutating the input', () => {
    const rehearsals: Rehearsal[] = [
      { id: 'b', date: '2026-09-15', time: '18:00' },
      { id: 'a', date: '2026-09-10', time: '19:00' },
    ]
    const originalOrder = rehearsals.map((r) => r.id)
    const sorted = sortRehearsals(rehearsals)
    expect(rehearsals.map((r) => r.id)).toEqual(originalOrder)
    expect(sorted).not.toBe(rehearsals)
  })
})

describe('formatWallClockTime', () => {
  it('formats a morning time', () => {
    expect(formatWallClockTime('08:00')).toBe('8:00 AM')
  })

  it('formats an afternoon time', () => {
    expect(formatWallClockTime('13:05')).toBe('1:05 PM')
  })

  it('formats midnight as 12:00 AM', () => {
    expect(formatWallClockTime('00:00')).toBe('12:00 AM')
  })

  it('returns "" (not "Invalid Date") for an empty/blank input', () => {
    // CR-01 (139-REVIEW.md) — a date-only rehearsal row reaches this with
    // time === '' and must never surface the literal string "Invalid Date".
    expect(formatWallClockTime('')).toBe('')
  })

  describe('timezone stability', () => {
    const originalTz = process.env.TZ

    afterEach(() => {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    })

    it('produces the identical string regardless of the runner system timezone', () => {
      process.env.TZ = 'UTC'
      const utcResult = formatWallClockTime('18:30')

      process.env.TZ = 'Pacific/Kiritimati' // UTC+14, an extreme offset
      const extremeResult = formatWallClockTime('18:30')

      process.env.TZ = 'Etc/GMT+12' // UTC-12
      const negativeResult = formatWallClockTime('18:30')

      expect(utcResult).toBe('6:30 PM')
      expect(extremeResult).toBe('6:30 PM')
      expect(negativeResult).toBe('6:30 PM')
    })
  })
})

describe('isDisplayableRehearsal', () => {
  // CR-01 (139-REVIEW.md) — a rehearsal is only "real" for a read-only
  // surface when BOTH date and time are set. A dated-but-timeless row is a
  // plausible mid-edit autosave state and must be excluded.
  it('is true only when both date and time are set', () => {
    expect(isDisplayableRehearsal({ id: 'a', date: '2026-09-11', time: '19:00' })).toBe(true)
  })

  it('is false when date is blank', () => {
    expect(isDisplayableRehearsal({ id: 'a', date: '', time: '19:00' })).toBe(false)
  })

  it('is false when time is blank (dated-but-timeless)', () => {
    expect(isDisplayableRehearsal({ id: 'a', date: '2026-09-11', time: '' })).toBe(false)
  })

  it('is false when both are blank', () => {
    expect(isDisplayableRehearsal({ id: 'a', date: '', time: '' })).toBe(false)
  })
})
