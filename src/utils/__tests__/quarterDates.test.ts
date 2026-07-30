import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  generateSundaysInQuarter,
  applyDateAdditionsRemovals,
  nextFreeSunday,
} from '@/utils/quarterDates'

describe('generateSundaysInQuarter', () => {
  it('returns every Sunday from 2026-07-01 through 2026-09-30 for Q3 2026, ascending', () => {
    const result = generateSundaysInQuarter(2026, 3)
    expect(result).toEqual([
      '2026-07-05',
      '2026-07-12',
      '2026-07-19',
      '2026-07-26',
      '2026-08-02',
      '2026-08-09',
      '2026-08-16',
      '2026-08-23',
      '2026-08-30',
      '2026-09-06',
      '2026-09-13',
      '2026-09-20',
      '2026-09-27',
    ])
  })

  it('Q1 boundary: first returned date is the first Sunday on/after Jan 1; last is the last Sunday on/before Mar 31', () => {
    const result = generateSundaysInQuarter(2026, 1)
    expect(result[0]).toBe('2026-01-04') // Jan 1, 2026 is a Thursday; first Sunday is Jan 4
    expect(result[result.length - 1]).toBe('2026-03-29') // last Sunday on/before Mar 31, 2026
  })

  it('every returned string is zero-padded YYYY-MM-DD and parses to a Sunday (getDay() === 0)', () => {
    const result = generateSundaysInQuarter(2026, 2)
    expect(result.length).toBeGreaterThan(0)
    for (const dateStr of result) {
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const parsed = new Date(dateStr + 'T00:00:00')
      expect(parsed.getDay()).toBe(0)
    }
  })

  it('returns dates in ascending (sorted) order', () => {
    const result = generateSundaysInQuarter(2026, 4)
    const sorted = [...result].sort()
    expect(result).toEqual(sorted)
  })
})

describe('applyDateAdditionsRemovals', () => {
  it('adds a date and removes a date, sorted ascending and de-duplicated', () => {
    const base = ['2026-07-05', '2026-07-12', '2026-07-19']
    const result = applyDateAdditionsRemovals(base, {
      add: ['2026-08-19'],
      remove: ['2026-07-05'],
    })
    expect(result).toEqual(['2026-07-12', '2026-07-19', '2026-08-19'])
  })

  it('returns the base list unchanged (sorted, deduped) when add/remove are empty', () => {
    const base = ['2026-07-19', '2026-07-05', '2026-07-12']
    const result = applyDateAdditionsRemovals(base, {})
    expect(result).toEqual(['2026-07-05', '2026-07-12', '2026-07-19'])
  })

  it('de-duplicates when an added date already exists in base', () => {
    const base = ['2026-07-05', '2026-07-12']
    const result = applyDateAdditionsRemovals(base, { add: ['2026-07-05'] })
    expect(result).toEqual(['2026-07-05', '2026-07-12'])
  })

  it('handles removing a date not present in base without error', () => {
    const base = ['2026-07-05', '2026-07-12']
    const result = applyDateAdditionsRemovals(base, { remove: ['2026-12-25'] })
    expect(result).toEqual(['2026-07-05', '2026-07-12'])
  })
})

// R038 / D-12 / D-13. Reference calendar (all verified Sundays, see the Q3 2026 test above):
// 2026-08-16, -23, -30, then 2026-09-06, -13, -20, -27.
describe('nextFreeSunday', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the next Sunday when nothing is taken', () => {
    // Wed 2026-08-26 -> Sun 2026-08-30
    expect(nextFreeSunday(new Date(2026, 7, 26))).toBe('2026-08-30')
  })

  it('skips the first two taken Sundays and returns the third', () => {
    const taken = ['2026-08-30', '2026-09-06']
    expect(nextFreeSunday(new Date(2026, 7, 26), taken)).toBe('2026-09-13')
  })

  it('skips however many consecutive Sundays are taken', () => {
    const taken = ['2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20']
    expect(nextFreeSunday(new Date(2026, 7, 26), taken)).toBe('2026-09-27')
  })

  it('ignores taken dates that are behind `from` — the walk is forward-only (D-12)', () => {
    // 2026-08-23 is a Sunday already in the past relative to Wed 2026-08-26.
    expect(nextFreeSunday(new Date(2026, 7, 26), ['2026-08-23'])).toBe('2026-08-30')
  })

  it('★ when `from` IS a Sunday, returns the FOLLOWING Sunday, never that same day', () => {
    // The strictly-forward convention, deliberately different from
    // generateSundaysInQuarter's "first Sunday on/after" advance. See D-13.
    expect(nextFreeSunday(new Date(2026, 7, 30))).toBe('2026-09-06')
  })

  it('★ a Sunday `from` whose following Sunday is taken keeps walking forward', () => {
    expect(nextFreeSunday(new Date(2026, 7, 30), ['2026-09-06'])).toBe('2026-09-13')
  })

  it('falls back to the plain next Sunday when every Sunday within the bound is taken', () => {
    const from = new Date(2026, 7, 26)
    // Build all 52 Sundays the search can reach, starting at 2026-08-30.
    const taken: string[] = []
    const d = new Date(2026, 7, 30)
    for (let i = 0; i < 52; i++) {
      taken.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      )
      d.setDate(d.getDate() + 7)
    }
    expect(nextFreeSunday(from, taken)).toBe('2026-08-30')
  })

  it('honours a custom maxWeeks bound and then falls back to the plain next Sunday', () => {
    const taken = ['2026-08-30', '2026-09-06', '2026-09-13']
    expect(nextFreeSunday(new Date(2026, 7, 26), taken, 3)).toBe('2026-08-30')
    // One more week of headroom and it finds the free Sunday instead of falling back.
    expect(nextFreeSunday(new Date(2026, 7, 26), taken, 4)).toBe('2026-09-20')
  })

  it('crosses a month boundary', () => {
    expect(nextFreeSunday(new Date(2026, 7, 26), ['2026-08-30'])).toBe('2026-09-06')
  })

  it('crosses a year boundary', () => {
    // Wed 2026-12-30 -> Sun 2027-01-03; taken, so 2027-01-10.
    expect(nextFreeSunday(new Date(2026, 11, 30))).toBe('2027-01-03')
    expect(nextFreeSunday(new Date(2026, 11, 30), ['2027-01-03'])).toBe('2027-01-10')
  })

  it('accepts a Set as well as an array', () => {
    const taken: ReadonlySet<string> = new Set(['2026-08-30'])
    expect(nextFreeSunday(new Date(2026, 7, 26), taken)).toBe('2026-09-06')
  })

  it('ignores any time component on `from`', () => {
    expect(nextFreeSunday(new Date(2026, 7, 26, 23, 59, 59))).toBe('2026-08-30')
    expect(nextFreeSunday(new Date(2026, 7, 26, 0, 0, 0))).toBe('2026-08-30')
  })

  it('is pure: identical inputs give identical output, and it does not read the clock', () => {
    const from = new Date(2026, 7, 26)
    const taken = ['2026-08-30']
    const first = nextFreeSunday(from, taken)

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 1))
    const underADifferentNow = nextFreeSunday(from, taken)
    vi.useRealTimers()

    expect(first).toBe('2026-09-06')
    expect(underADifferentNow).toBe(first)
    expect(nextFreeSunday(from, taken)).toBe(first)
    // `from` itself is not mutated by the walk.
    expect(from.getTime()).toBe(new Date(2026, 7, 26).getTime())
  })

  it('returns zero-padded YYYY-MM-DD that parses to a Sunday', () => {
    const result = nextFreeSunday(new Date(2026, 0, 7)) // Wed 2026-01-07
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(result + 'T00:00:00').getDay()).toBe(0)
  })
})
