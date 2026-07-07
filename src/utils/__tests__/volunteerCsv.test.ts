import { describe, it, expect } from 'vitest'
import {
  parseVolunteerCsvRow,
  frequencyLabelToN,
  nToFrequencyLabel,
  expandBlackoutCell,
} from '@/utils/volunteerCsv'

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
      frequencyTargetN: 2,
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

  it('defaults frequencyTargetN and warns when Frequency is unrecognized', () => {
    const result = parseVolunteerCsvRow({
      Name: 'Jamie Lee',
      Roles: 'drums',
      Frequency: 'sometimes-ish',
      'Blackout Dates': '',
      'Serve-With': '',
    })
    expect(result.frequencyTargetN).toBe(4)
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
})

describe('nToFrequencyLabel', () => {
  it('round-trips the known labels', () => {
    expect(nToFrequencyLabel(1)).toBe('weekly')
    expect(nToFrequencyLabel(2)).toBe('twice a month')
    expect(nToFrequencyLabel(4)).toBe('once a month')
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
