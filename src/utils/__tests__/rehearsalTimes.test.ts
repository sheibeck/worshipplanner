import { describe, it, expect, afterEach } from 'vitest'
import {
  sortRehearsals,
  formatWallClockTime,
  formatRehearsalDateShort,
  isDisplayableRehearsal,
  normalizeWeekday,
  isRealYmd,
  weekdayOfYmd,
  mostRecentWeekdayOnOrBefore,
  toPublicRehearsal,
  buildAutoRehearsal,
  moveAutoRehearsals,
  type Rehearsal,
  type StoredRehearsal,
} from '../rehearsalTimes'
import { inZone, TZ_ZONES } from './inZone'

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

describe('formatRehearsalDateShort', () => {
  it('formats a YYYY-MM-DD string as a short month/day label', () => {
    expect(formatRehearsalDateShort('2026-09-11')).toBe('Sep 11')
    expect(formatRehearsalDateShort('2026-11-06')).toBe('Nov 6')
  })

  it('returns "" for an empty string', () => {
    expect(formatRehearsalDateShort('')).toBe('')
  })

  it('returns "" for a malformed string (never "Invalid Date")', () => {
    expect(formatRehearsalDateShort('not-a-date')).toBe('')
  })
})
describe('normalizeWeekday', () => {
  it('accepts whole numbers 0 to 6, Sunday included', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6]) expect(normalizeWeekday(n)).toBe(n)
  })

  it('reads anything else as null', () => {
    for (const v of [-1, 7, 1.5, NaN, '3', '', null, undefined, {}, true]) expect(normalizeWeekday(v)).toBeNull()
  })
})

describe('isRealYmd / weekdayOfYmd', () => {
  it('accepts real dates, including a leap day', () => {
    expect(isRealYmd('2026-11-08')).toBe(true)
    expect(isRealYmd('2028-02-29')).toBe(true)
  })

  it('rejects unreal or malformed dates', () => {
    for (const v of ['2026-02-30', '2026-13-01', '2027-02-29', '', 'not-a-date', '12026-11-08', '2026-1-1']) {
      expect(isRealYmd(v)).toBe(false)
    }
  })

  it('weekdayOfYmd gives 0 for a Sunday and null for an unreal date', () => {
    expect(weekdayOfYmd('2026-11-08')).toBe(0)
    expect(weekdayOfYmd('2026-11-04')).toBe(3)
    expect(weekdayOfYmd('2026-02-30')).toBeNull()
  })

  it('handles years below 100 without mapping them to 19xx', () => {
    expect(isRealYmd('0099-01-01')).toBe(true)
    expect(weekdayOfYmd('0099-01-01')).not.toBeNull()
  })
})

describe('mostRecentWeekdayOnOrBefore', () => {
  it('AC-RHD-12: lands on the most recent day with the weekday, and one day later still does', () => {
    expect(mostRecentWeekdayOnOrBefore('2026-11-08', 3)).toBe('2026-11-04')
    expect(mostRecentWeekdayOnOrBefore('2026-11-05', 3)).toBe('2026-11-04')
  })

  it('AC-RHD-13: stays on the service date when it falls on the weekday', () => {
    expect(mostRecentWeekdayOnOrBefore('2026-11-04', 3)).toBe('2026-11-04')
  })

  it('AC-RHD-14: is correct across a month end, a year end and a leap day', () => {
    expect(mostRecentWeekdayOnOrBefore('2026-03-01', 3)).toBe('2026-02-25')
    expect(mostRecentWeekdayOnOrBefore('2027-01-01', 3)).toBe('2026-12-30')
    expect(mostRecentWeekdayOnOrBefore('2028-03-01', 2)).toBe('2028-02-29')
    expect(mostRecentWeekdayOnOrBefore('2024-03-03', 4)).toBe('2024-02-29')
  })

  it.each(TZ_ZONES)('AC-RHD-15: gives the same date in %s', async (tz, offset) => {
    await inZone(tz, offset, () => {
      expect(mostRecentWeekdayOnOrBefore('2026-11-08', 3)).toBe('2026-11-04')
      expect(mostRecentWeekdayOnOrBefore('2026-11-04', 3)).toBe('2026-11-04')
    })
  })

  it('AC-RHD-16: an unreal service date gives null', () => {
    for (const d of ['2026-02-30', '2026-13-01', '', 'not-a-date', '12026-11-08']) {
      expect(mostRecentWeekdayOnOrBefore(d, 3)).toBeNull()
    }
  })

  it('AC-RHD-16: a weekday that is not a whole number 0 to 6 gives null, and 0 is valid', () => {
    for (const w of [-1, 7, 1.5, '3', null, undefined]) {
      expect(mostRecentWeekdayOnOrBefore('2026-11-08', w)).toBeNull()
    }
    expect(mostRecentWeekdayOnOrBefore('2026-11-08', 0)).toBe('2026-11-08')
  })
})

describe('toPublicRehearsal', () => {
  it('returns exactly id, date and time', () => {
    const stored = { id: 'r1', date: '2026-11-04', time: '18:30', autoAdded: true } as StoredRehearsal
    const pub = toPublicRehearsal(stored)
    expect(Object.keys(pub).sort()).toEqual(['date', 'id', 'time'])
    expect(pub).toEqual({ id: 'r1', date: '2026-11-04', time: '18:30' })
  })
})

describe('buildAutoRehearsal', () => {
  it('returns a marked row on the default date at the given time', () => {
    expect(buildAutoRehearsal('2026-11-08', 3, '18:30', () => 'id-1')).toEqual({
      id: 'id-1',
      date: '2026-11-04',
      time: '18:30',
      autoAdded: true,
    })
  })

  it('uses a real id when none is supplied', () => {
    const row = buildAutoRehearsal('2026-11-08', 0, '09:00')
    expect(row?.id).toBeTruthy()
    expect(row?.date).toBe('2026-11-08')
  })

  it('returns null and never calls makeId when there is nothing to add', () => {
    const boom = () => {
      throw new Error('makeId must not be called')
    }
    expect(buildAutoRehearsal('2026-11-08', null, '18:30', boom)).toBeNull()
    expect(buildAutoRehearsal('2026-11-08', undefined, '18:30', boom)).toBeNull()
    expect(buildAutoRehearsal('2026-02-30', 3, '18:30', boom)).toBeNull()
    expect(buildAutoRehearsal('2026-11-08', 3, '', boom)).toBeNull()
    expect(buildAutoRehearsal('2026-11-08', 3, '6:30', boom)).toBeNull()
    expect(buildAutoRehearsal('2026-11-08', 3, undefined, boom)).toBeNull()
    expect(buildAutoRehearsal('2026-11-08', 3, 1830, boom)).toBeNull()
  })
})

describe('moveAutoRehearsals', () => {
  const marked = (over: Partial<StoredRehearsal> = {}): StoredRehearsal => ({
    id: 'a',
    date: '2026-11-04',
    time: '18:30',
    autoAdded: true,
    ...over,
  })

  it('AC-RHD-27: moves a marked row to its own weekday on or before the new date, keeping its time', () => {
    expect(moveAutoRehearsals([marked()], '2026-11-22')).toEqual([marked({ date: '2026-11-18' })])
    expect(moveAutoRehearsals([marked()], '2026-11-09')).toEqual([marked({ date: '2026-11-04' })])
    expect(moveAutoRehearsals([marked()], '2026-11-14')).toEqual([marked({ date: '2026-11-11' })])
  })

  it('AC-RHD-31: leaves an unmarked row where it is', () => {
    const plain: StoredRehearsal = { id: 'p', date: '2026-11-04', time: '18:30' }
    expect(moveAutoRehearsals([plain], '2026-11-22')).toEqual([plain])
    expect(moveAutoRehearsals([plain], '2026-11-09')).toEqual([plain])
  })

  it('AC-RHD-33: drops a moved row that lands on another row at the same date and time', () => {
    const other: StoredRehearsal = { id: 'o', date: '2026-11-18', time: '18:30' }
    expect(moveAutoRehearsals([marked(), other], '2026-11-22')).toEqual([other])
  })

  it('AC-RHD-33: keeps one of two moved rows that land together', () => {
    const rows = [marked({ id: 'a' }), marked({ id: 'b', date: '2026-11-11' })]
    const out = moveAutoRehearsals(rows, '2026-11-22')
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('a')
  })

  it('AC-RHD-34: keeps both rows when the time differs', () => {
    const other: StoredRehearsal = { id: 'o', date: '2026-11-18', time: '19:00' }
    expect(moveAutoRehearsals([marked(), other], '2026-11-22')).toEqual([marked({ date: '2026-11-18' }), other])
  })

  it('returns rows unchanged for a cleared or unreal new date', () => {
    const rows = [marked()]
    expect(moveAutoRehearsals(rows, '')).toBe(rows)
    expect(moveAutoRehearsals(rows, '2026-02-30')).toBe(rows)
  })

  it('returns [] for [] and does not mutate its input', () => {
    expect(moveAutoRehearsals([], '2026-11-22')).toEqual([])
    const rows = [marked()]
    const snapshot = JSON.parse(JSON.stringify(rows))
    moveAutoRehearsals(rows, '2026-11-22')
    expect(rows).toEqual(snapshot)
  })

  it('leaves a row whose own date is not real as it is', () => {
    const undated = marked({ id: 'u', date: '' })
    expect(moveAutoRehearsals([undated], '2026-11-22')).toEqual([undated])
  })
})
