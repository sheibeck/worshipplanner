import { describe, it, expect, afterEach } from 'vitest'
import { sortRehearsals, formatWallClockTime, type Rehearsal } from '../rehearsalTimes'

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
