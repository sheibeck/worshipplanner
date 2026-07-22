import { describe, it, expect } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { Service } from '@/types/service'
import type { Quarter, Role } from '@/types/roster'
import { findQuarterForDate, resolveServiceRoleAssignments } from '@/utils/serviceRoles'

const ts = {} as Timestamp

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-guitar',
    name: 'guitar',
    group: 'band',
    defaultCount: 1,
    order: 0,
    ...overrides,
  }
}

function makeQuarter(overrides: Partial<Quarter> = {}): Quarter {
  return {
    id: 'quarter-1',
    label: 'Q3 2026',
    year: 2026,
    quarter: 3,
    serviceDates: [],
    roleOverridesByDate: {},
    personQuarterData: {},
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    date: '2026-08-02',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'planned',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('findQuarterForDate', () => {
  it('returns the quarter whose serviceDates includes the date', () => {
    const q1 = makeQuarter({ id: 'q1', serviceDates: ['2026-07-05'] })
    const q2 = makeQuarter({ id: 'q2', serviceDates: ['2026-08-02', '2026-08-09'] })
    expect(findQuarterForDate([q1, q2], '2026-08-02')).toBe(q2)
  })

  it('returns undefined when no quarter matches', () => {
    const q1 = makeQuarter({ id: 'q1', serviceDates: ['2026-07-05'] })
    expect(findQuarterForDate([q1], '2026-12-25')).toBeUndefined()
  })
})

describe('resolveServiceRoleAssignments', () => {
  it('Test A (seed): resolves effectivePersonIds to the quarter-scheduled ids when no override is present', () => {
    const guitar = makeRole({ id: 'role-guitar', order: 0 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: { '2026-08-02': { 'role-guitar': ['person-1'] } },
    })
    const service = makeService({ date: '2026-08-02' })

    const result = resolveServiceRoleAssignments(service, [quarter], [guitar])

    expect(result).toHaveLength(1)
    expect(result[0]!.roleId).toBe('role-guitar')
    expect(result[0]!.scheduledPersonIds).toEqual(['person-1'])
    expect(result[0]!.overriddenPersonIds).toBeNull()
    // Round-trip invariant: un-overridden role's effectivePersonIds === quarter.calendar[date][roleId]
    expect(result[0]!.effectivePersonIds).toEqual(quarter.calendar['2026-08-02']!['role-guitar'])
  })

  it('Test B (override wins): a role with roleAssignmentOverrides present resolves effectivePersonIds to the override, ignoring the schedule', () => {
    const guitar = makeRole({ id: 'role-guitar', order: 0 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: { '2026-08-02': { 'role-guitar': ['person-1'] } },
    })
    const service = makeService({
      date: '2026-08-02',
      roleAssignmentOverrides: { 'role-guitar': ['person-2'] },
    })

    const result = resolveServiceRoleAssignments(service, [quarter], [guitar])

    expect(result[0]!.scheduledPersonIds).toEqual(['person-1'])
    expect(result[0]!.overriddenPersonIds).toEqual(['person-2'])
    expect(result[0]!.effectivePersonIds).toEqual(['person-2'])
  })

  it('Test C (explicit clear vs inherit): an override of [] means nobody serving, distinct from an absent override which inherits the schedule', () => {
    const guitar = makeRole({ id: 'role-guitar', order: 0 })
    const drums = makeRole({ id: 'role-drums', order: 1 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: {
        '2026-08-02': {
          'role-guitar': ['person-1'],
          'role-drums': ['person-3'],
        },
      },
    })
    const service = makeService({
      date: '2026-08-02',
      roleAssignmentOverrides: { 'role-guitar': [] },
    })

    const result = resolveServiceRoleAssignments(service, [quarter], [guitar, drums])
    const guitarResult = result.find((r) => r.roleId === 'role-guitar')!
    const drumsResult = result.find((r) => r.roleId === 'role-drums')!

    // Explicit clear: override present as [] -> nobody serving
    expect(guitarResult.overriddenPersonIds).toEqual([])
    expect(guitarResult.effectivePersonIds).toHaveLength(0)

    // Absent override on a scheduled role: inherits the scheduled ids
    expect(drumsResult.overriddenPersonIds).toBeNull()
    expect(drumsResult.effectivePersonIds).toEqual(['person-3'])
  })

  it('Test D (no quarter): when no quarter covers the service date, every role resolves with empty scheduledPersonIds and no throw', () => {
    const guitar = makeRole({ id: 'role-guitar', order: 0 })
    const drums = makeRole({ id: 'role-drums', order: 1 })
    const quarter = makeQuarter({ serviceDates: ['2026-07-05'] })
    const service = makeService({ date: '2026-12-25' })

    expect(() => resolveServiceRoleAssignments(service, [quarter], [guitar, drums])).not.toThrow()
    const result = resolveServiceRoleAssignments(service, [quarter], [guitar, drums])

    for (const r of result) {
      expect(r.scheduledPersonIds).toEqual([])
      expect(r.overriddenPersonIds).toBeNull()
      expect(r.effectivePersonIds).toEqual([])
    }
  })

  it('Test E (ordering): returned array is sorted by role.order ascending', () => {
    const drums = makeRole({ id: 'role-drums', order: 3 })
    const guitar = makeRole({ id: 'role-guitar', order: 1 })
    const sound = makeRole({ id: 'role-sound', order: 2 })
    const service = makeService({ date: '2026-08-02' })

    const result = resolveServiceRoleAssignments(service, [], [drums, guitar, sound])

    expect(result.map((r) => r.roleId)).toEqual(['role-guitar', 'role-sound', 'role-drums'])
  })

  it('Test F (findQuarterForDate integration): first-match tie-break is deterministic when two quarters list the same date', () => {
    const qFirst = makeQuarter({ id: 'q-first', serviceDates: ['2026-08-02'] })
    const qSecond = makeQuarter({ id: 'q-second', serviceDates: ['2026-08-02'] })
    expect(findQuarterForDate([qFirst, qSecond], '2026-08-02')).toBe(qFirst)
  })
})
