import { describe, it, expect } from 'vitest'
import type { RehearseAccessDoc, RehearseSong, RehearseAttachment } from '@/utils/rehearseAccess'
import { groupMySchedule, countdownLabel, readinessOf } from '@/utils/myScheduleGrouping'

// Fixed clock: 2026-09-06 is a Sunday (getDay() === 0), which makes the
// "coming Saturday inclusive" boundary easy to reason about without any
// hidden weekday arithmetic: this-week spans today (Sun) through +6 days (Sat).
const NOW = new Date(2026, 8, 6)

function makeDoc(overrides: Partial<RehearseAccessDoc> = {}): RehearseAccessDoc {
  return {
    serviceId: 'svc',
    orgId: 'org',
    serviceDate: '2026-09-06',
    title: 'Sunday Worship',
    status: 'planned',
    assignedEmailsLower: [],
    rolesByEmailLower: {},
    songs: [],
    ...overrides,
  }
}

function makeAttachment(kind: RehearseAttachment['kind'], overrides: Partial<RehearseAttachment> = {}): RehearseAttachment {
  return { id: 'att-1', name: 'file', kind, ...overrides }
}

function makeSong(overrides: Partial<RehearseSong> = {}): RehearseSong {
  return { id: 'song-1', title: 'Song', attachments: [], ...overrides }
}

describe('groupMySchedule', () => {
  it('buckets docs into thisWeek / laterThisMonth / past and picks nextUpId', () => {
    const docs: RehearseAccessDoc[] = [
      makeDoc({ serviceId: 'today', serviceDate: '2026-09-06' }), // today (Sun) -> thisWeek
      makeDoc({ serviceId: 'sat', serviceDate: '2026-09-12' }), // coming Sat -> thisWeek (inclusive)
      makeDoc({ serviceId: 'nextSun', serviceDate: '2026-09-13' }), // day after Sat -> laterThisMonth
      makeDoc({ serviceId: 'laterFar', serviceDate: '2026-09-20' }), // laterThisMonth
      makeDoc({ serviceId: 'past1', serviceDate: '2026-08-30' }), // past
      makeDoc({ serviceId: 'past2', serviceDate: '2026-08-20' }), // further past
    ]

    const result = groupMySchedule(docs, NOW)

    expect(result.thisWeek.map((d) => d.serviceId)).toEqual(['today', 'sat'])
    expect(result.laterThisMonth.map((d) => d.serviceId)).toEqual(['nextSun', 'laterFar'])
    // past sorted descending (most recent first)
    expect(result.past.map((d) => d.serviceId)).toEqual(['past1', 'past2'])
    expect(result.nextUpId).toBe('today')
  })

  it('nextUpId is null when there are no upcoming services', () => {
    const docs: RehearseAccessDoc[] = [
      makeDoc({ serviceId: 'past1', serviceDate: '2026-08-30' }),
    ]
    const result = groupMySchedule(docs, NOW)
    expect(result.nextUpId).toBeNull()
    expect(result.thisWeek).toEqual([])
    expect(result.laterThisMonth).toEqual([])
  })

  it('a section with zero matching docs is an empty array (not omitted/undefined)', () => {
    const result = groupMySchedule([], NOW)
    expect(result).toEqual({ thisWeek: [], laterThisMonth: [], past: [], nextUpId: null })
  })
})

describe('countdownLabel — future', () => {
  it('returns Today for a same-day service', () => {
    expect(countdownLabel('2026-09-06', NOW)).toBe('Today')
  })

  it('returns Tomorrow for a next-day service', () => {
    expect(countdownLabel('2026-09-07', NOW)).toBe('Tomorrow')
  })

  it('returns "In N days" for 2-6 days out', () => {
    expect(countdownLabel('2026-09-08', NOW)).toBe('In 2 days')
    expect(countdownLabel('2026-09-12', NOW)).toBe('In 6 days')
  })

  it('returns "In N days" (no special phrasing) at and beyond the 7-day boundary', () => {
    expect(countdownLabel('2026-09-13', NOW)).toBe('In 7 days')
    expect(countdownLabel('2026-09-20', NOW)).toBe('In 14 days')
  })
})

describe('countdownLabel — past', () => {
  it('returns Yesterday for a one-day-ago service', () => {
    expect(countdownLabel('2026-09-05', NOW)).toBe('Yesterday')
  })

  it('returns "N days ago" for 2-6 days ago', () => {
    expect(countdownLabel('2026-09-04', NOW)).toBe('2 days ago')
    expect(countdownLabel('2026-08-31', NOW)).toBe('6 days ago')
  })

  it('returns "Last week" at the exact 7-day boundary through 13 days ago', () => {
    expect(countdownLabel('2026-08-30', NOW)).toBe('Last week') // exactly 7 days ago
    expect(countdownLabel('2026-08-24', NOW)).toBe('Last week') // exactly 13 days ago
  })

  it('returns "N weeks ago" at the exact 14-day boundary and beyond', () => {
    expect(countdownLabel('2026-08-23', NOW)).toBe('2 weeks ago') // exactly 14 days ago
    expect(countdownLabel('2026-08-16', NOW)).toBe('3 weeks ago') // 21 days ago
  })
})

describe('readinessOf', () => {
  it('returns ready when every song has a document or audio attachment', () => {
    const songs = [
      makeSong({ attachments: [makeAttachment('document')] }),
      makeSong({ attachments: [makeAttachment('audio')] }),
    ]
    expect(readinessOf(songs)).toEqual({ state: 'ready', missingCount: 0 })
  })

  it('returns partial when some songs have media and some do not', () => {
    const songs = [
      makeSong({ id: 'a', attachments: [makeAttachment('document')] }),
      makeSong({ id: 'b', attachments: [] }),
      makeSong({ id: 'c', attachments: [makeAttachment('link')] }),
    ]
    expect(readinessOf(songs)).toEqual({ state: 'partial', missingCount: 2 })
  })

  it('returns waiting when zero songs have any media', () => {
    const songs = [
      makeSong({ id: 'a', attachments: [] }),
      makeSong({ id: 'b', attachments: [makeAttachment('link')] }),
    ]
    expect(readinessOf(songs)).toEqual({ state: 'waiting', missingCount: 2 })
  })

  it('returns waiting for the zero-songs edge case', () => {
    expect(readinessOf([])).toEqual({ state: 'waiting', missingCount: 0 })
  })
})
