import { describe, it, expect } from 'vitest'
import {
  parseVolunteerCsvRow,
  frequencyLabelToN,
  expandBlackoutCell,
  matchNameToPerson,
} from '@/utils/volunteerCsv'
import type { Person } from '@/types/roster'

function makePerson(id: string, name: string, active = true): Person {
  return {
    id,
    name,
    email: '',
    phone: '',
    active,
    roles: [],
    pcPersonId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedAt: null as any,
  }
}

describe('parseVolunteerCsvRow', () => {
  it('parses a well-formed row into a ParsedVolunteerRow', () => {
    const result = parseVolunteerCsvRow({
      Name: 'Sarah Smith',
      Roles: 'vocals; guitar',
      Frequency: 'twice a month',
      'Blackout Dates': '2026-07-05; 2026-08-16',
      'Serve-With': 'Ben Smith',
    })
    expect(result).toEqual({
      name: 'Sarah Smith',
      rolesRaw: ['vocals', 'guitar'],
      frequencyN: 2,
      blackoutCellRaw: '2026-07-05; 2026-08-16',
      serveWithRaw: ['Ben Smith'],
      warnings: [],
    })
  })

  it('pushes a "Missing name" warning when Name is empty', () => {
    const result = parseVolunteerCsvRow({
      Name: '',
      Roles: 'vocals',
      Frequency: 'weekly',
      'Blackout Dates': '',
      'Serve-With': '',
    })
    expect(result.warnings).toContain('Missing name')
  })

  it('defaults frequencyN and warns when Frequency is unrecognized', () => {
    const result = parseVolunteerCsvRow({
      Name: 'Jamie Lee',
      Roles: 'drums',
      Frequency: 'sometimes-ish',
      'Blackout Dates': '',
      'Serve-With': '',
    })
    expect(result.frequencyN).toBe(4)
    expect(result.warnings.some((w) => w.includes('Frequency'))).toBe(true)
  })

  // WR-03 regression: "1-in-0" is matched by the "1-in-N" shape but N=0 is invalid — it must
  // surface the same unrecognized/defaulted warning as an invalid bare integer, not be
  // silently accepted (which is what let scheduler.ts see an Infinity deficit score).
  it('defaults frequencyN to 4 and warns for "1-in-0" (non-positive N)', () => {
    const result = parseVolunteerCsvRow({
      Name: 'Jamie Lee',
      Roles: 'drums',
      Frequency: '1-in-0',
      'Blackout Dates': '',
      'Serve-With': '',
    })
    expect(result.frequencyN).toBe(4)
    expect(result.warnings.some((w) => w.includes('Frequency'))).toBe(true)
  })

  it('splits multi-value cells on ";", trims, and drops empties', () => {
    const result = parseVolunteerCsvRow({
      Name: 'Pat Doe',
      Roles: 'vocals;  ; guitar',
      Frequency: 'weekly',
      'Blackout Dates': '',
      'Serve-With': '',
    })
    expect(result.rolesRaw).toEqual(['vocals', 'guitar'])
  })
})

describe('parseVolunteerCsvRow — no per-role CSV schema change (Pitfall 4, D-07 graceful degrade)', () => {
  it('emits exactly one scalar frequencyN per row, regardless of role count — no per-role structure', () => {
    const result = parseVolunteerCsvRow({
      Name: 'Multi Role Person',
      Roles: 'guitar; vocals; bass',
      Frequency: 'twice a month',
      'Blackout Dates': '',
      'Serve-With': '',
    })
    expect(typeof result.frequencyN).toBe('number')
    expect(result.frequencyN).toBe(2)
    expect(result.rolesRaw).toHaveLength(3)
    // Exact key set — proves the parser's output shape is unchanged by Phase 15
    // (the per-role application happens at the caller layer, not here).
    expect(Object.keys(result)).toEqual([
      'name',
      'rolesRaw',
      'frequencyN',
      'blackoutCellRaw',
      'serveWithRaw',
      'warnings',
    ])
  })
})

describe('frequencyLabelToN', () => {
  it('maps known friendly labels', () => {
    expect(frequencyLabelToN('weekly')).toBe(1)
    expect(frequencyLabelToN('twice a month')).toBe(2)
    expect(frequencyLabelToN('once a month')).toBe(4)
  })

  it('parses a bare integer string', () => {
    expect(frequencyLabelToN('3')).toBe(3)
  })

  it('parses a "1-in-N" string', () => {
    expect(frequencyLabelToN('1-in-6')).toBe(6)
  })

  it('defaults unknown labels to 4', () => {
    expect(frequencyLabelToN('whenever')).toBe(4)
  })

  // WR-03 regression: "1-in-0" must not be accepted as a literal N=0 (which would produce an
  // Infinity deficit score in scheduler.ts) — it must fall back to the same default-4 path as
  // an invalid bare integer like "0" or "-5".
  it('rejects "1-in-0" (non-positive N) and defaults to 4, same as an invalid bare integer', () => {
    expect(frequencyLabelToN('1-in-0')).toBe(4)
  })
})

describe('expandBlackoutCell', () => {
  const serviceDates = [
    '2026-07-05',
    '2026-08-09',
    '2026-08-16',
    '2026-08-23',
    '2026-08-30',
    '2026-09-06',
  ]

  it('expands a range to exactly the in-range Sundays (inclusive endpoints) plus a single date', () => {
    const result = expandBlackoutCell(
      '2026-07-05; 2026-08-02..2026-08-30',
      serviceDates,
    )
    expect(result).toEqual([
      '2026-07-05',
      '2026-08-09',
      '2026-08-16',
      '2026-08-23',
      '2026-08-30',
    ])
  })

  it('ignores a date not present in serviceDates', () => {
    const result = expandBlackoutCell('2026-12-25', serviceDates)
    expect(result).toEqual([])
  })

  it('returns a de-duplicated, ascending list', () => {
    const result = expandBlackoutCell(
      '2026-08-16; 2026-08-09..2026-08-16',
      serviceDates,
    )
    expect(result).toEqual(['2026-08-09', '2026-08-16'])
  })
})

describe('matchNameToPerson', () => {
  it('matches despite double internal whitespace', () => {
    const roster = [makePerson('p1', 'sarah  smith')]
    const result = matchNameToPerson('Sarah Smith', roster)
    expect(result).toEqual({ status: 'matched', personId: 'p1', candidates: [] })
  })

  it('matches despite trailing whitespace', () => {
    const roster = [makePerson('p1', 'Sarah Smith ')]
    const result = matchNameToPerson('Sarah Smith', roster)
    expect(result.status).toBe('matched')
    expect(result.personId).toBe('p1')
  })

  it('returns ambiguous with all candidate ids when two people normalize the same', () => {
    const roster = [makePerson('p1', 'Chris'), makePerson('p2', 'chris ')]
    const result = matchNameToPerson('Chris', roster)
    expect(result.status).toBe('ambiguous')
    expect(result.personId).toBeNull()
    expect(result.candidates.sort()).toEqual(['p1', 'p2'])
  })

  it('returns unmatched with null personId when no roster entry normalizes the same', () => {
    const roster = [makePerson('p1', 'Sarah Smith')]
    const result = matchNameToPerson('Nobody Here', roster)
    expect(result).toEqual({ status: 'unmatched', personId: null, candidates: [] })
  })

  it('includes inactive people in matching (caller decides eligibility)', () => {
    const roster = [makePerson('p1', 'Sarah Smith', false)]
    const result = matchNameToPerson('Sarah Smith', roster)
    expect(result.status).toBe('matched')
    expect(result.personId).toBe('p1')
  })

  it('does not mutate the roster input and is deterministic across calls', () => {
    const roster = [makePerson('p1', 'Sarah Smith')]
    const snapshot = JSON.stringify(roster)
    const first = matchNameToPerson('Sarah Smith', roster)
    const second = matchNameToPerson('Sarah Smith', roster)
    expect(JSON.stringify(roster)).toBe(snapshot)
    expect(first).toEqual(second)
  })
})
