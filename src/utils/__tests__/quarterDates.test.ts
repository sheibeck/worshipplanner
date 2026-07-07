import { describe, it, expect } from 'vitest'
import { generateSundaysInQuarter, applyDateAdditionsRemovals } from '@/utils/quarterDates'

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
