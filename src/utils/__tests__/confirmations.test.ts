import { describe, it, expect } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { Service } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import { confirmationKey, computeValidConfirmationKeys } from '@/utils/confirmations'

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

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    name: 'Dana',
    email: 'dana@example.com',
    phone: '',
    active: true,
    roles: [],
    pcPersonId: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    date: '2026-09-06',
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

describe('confirmationKey', () => {
  it('joins roleId and emailLower with an underscore, without lowercasing', () => {
    expect(confirmationKey('roleX', 'dana@example.com')).toBe('roleX_dana@example.com')
  })

  it('does not lowercase the email — caller is responsible for passing an already-lowercased value', () => {
    expect(confirmationKey('roleX', 'Dana@Example.com')).toBe('roleX_Dana@Example.com')
  })
})

describe('computeValidConfirmationKeys', () => {
  it('returns one key per (role, assigned person with a non-empty email)', () => {
    const roleGuitar = makeRole({ id: 'role-guitar', name: 'guitar', order: 0 })
    const roleVocals = makeRole({ id: 'role-vocals', name: 'vocals', order: 1 })
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: {
        '2026-09-06': { 'role-guitar': ['person-1'], 'role-vocals': ['person-1'] },
      },
    })
    const person = makePerson({ id: 'person-1', email: 'Dana@Example.com' })
    const service = makeService({ date: '2026-09-06' })

    const result = computeValidConfirmationKeys(service, [quarter], [roleGuitar, roleVocals], [person])

    expect(result).toEqual(new Set(['role-guitar_dana@example.com', 'role-vocals_dana@example.com']))
  })

  it('skips an assigned person with an empty-string email (mirrors buildRehearseAccess)', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', email: '' })
    const service = makeService({ date: '2026-09-06' })

    const result = computeValidConfirmationKeys(service, [quarter], [role], [person])

    expect(result).toEqual(new Set())
  })

  it('a roleAssignmentOverrides change alters the valid key set (override replaces the scheduled assignment)', () => {
    const role = makeRole({ id: 'role-guitar' })
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const dana = makePerson({ id: 'person-1', email: 'dana@example.com' })
    const erin = makePerson({ id: 'person-2', email: 'erin@example.com' })
    const service = makeService({
      date: '2026-09-06',
      roleAssignmentOverrides: { 'role-guitar': ['person-2'] },
    })

    const result = computeValidConfirmationKeys(service, [quarter], [role], [dana, erin])

    expect(result).toEqual(new Set(['role-guitar_erin@example.com']))
  })

  it('lowercases the email in the produced key', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', email: 'Dana@Example.COM' })
    const service = makeService({ date: '2026-09-06' })

    const result = computeValidConfirmationKeys(service, [quarter], [role], [person])

    expect(result).toEqual(new Set(['role-guitar_dana@example.com']))
  })
})
