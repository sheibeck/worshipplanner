import { describe, it, expect } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { Service } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import {
  resolveRecipients,
  MESSAGING_TEAM_LABELS,
  type RecipientSelection,
} from '@/utils/messagingRecipients'

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

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    name: 'Alice',
    email: 'alice@example.com',
    phone: '',
    active: true,
    roles: [],
    pcPersonId: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeSelection(overrides: Partial<RecipientSelection> = {}): RecipientSelection {
  return {
    teams: [],
    individualPersonIds: [],
    includeEveryone: false,
    ...overrides,
  }
}

describe('MESSAGING_TEAM_LABELS', () => {
  it('maps every RoleGroup to its own messaging-surface label, independent of RolesConfigPanel groupLabels', () => {
    expect(MESSAGING_TEAM_LABELS).toEqual({
      band: 'Band',
      tech: 'Tech',
      other: 'Other',
    })
  })
})

describe('resolveRecipients', () => {
  it('Test A (team filter): teams=["band"] returns only people whose assigned role.group is band', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const sound = makeRole({ id: 'role-sound', group: 'tech', order: 1 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: {
        '2026-08-02': {
          'role-guitar': ['person-1'],
          'role-sound': ['person-2'],
        },
      },
    })
    const service = makeService({ date: '2026-08-02' })
    const alice = makePerson({ id: 'person-1', name: 'Alice', email: 'alice@example.com' })
    const bob = makePerson({ id: 'person-2', name: 'Bob', email: 'bob@example.com' })

    const result = resolveRecipients(service, [quarter], [guitar, sound], [alice, bob], makeSelection({ teams: ['band'] }))

    expect(result.reachable).toEqual([{ id: 'person-1', name: 'Alice', email: 'alice@example.com' }])
    expect(result.unreachableCount).toBe(0)
  })

  it('Test B (includeEveryone ignores teams): includeEveryone=true returns every assigned person regardless of group', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const sound = makeRole({ id: 'role-sound', group: 'tech', order: 1 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: {
        '2026-08-02': {
          'role-guitar': ['person-1'],
          'role-sound': ['person-2'],
        },
      },
    })
    const service = makeService({ date: '2026-08-02' })
    const alice = makePerson({ id: 'person-1', name: 'Alice', email: 'alice@example.com' })
    const bob = makePerson({ id: 'person-2', name: 'Bob', email: 'bob@example.com' })

    const result = resolveRecipients(
      service,
      [quarter],
      [guitar, sound],
      [alice, bob],
      makeSelection({ teams: [], includeEveryone: true }),
    )

    expect(result.reachable.map((r) => r.id).sort()).toEqual(['person-1', 'person-2'])
    expect(result.unreachableCount).toBe(0)
  })

  it('Test C (individuals always included): individualPersonIds are included even when not on any selected team', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: { '2026-08-02': { 'role-guitar': ['person-1'] } },
    })
    const service = makeService({ date: '2026-08-02' })
    const alice = makePerson({ id: 'person-1', name: 'Alice', email: 'alice@example.com' })
    const carol = makePerson({ id: 'person-3', name: 'Carol', email: 'carol@example.com' })

    const result = resolveRecipients(
      service,
      [quarter],
      [guitar],
      [alice, carol],
      makeSelection({ teams: ['tech'], individualPersonIds: ['person-3'] }),
    )

    expect(result.reachable).toEqual([{ id: 'person-3', name: 'Carol', email: 'carol@example.com' }])
    expect(result.unreachableCount).toBe(0)
  })

  it('Test D (dedup by person id): a person assigned to two matching roles appears exactly once in reachable', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const bass = makeRole({ id: 'role-bass', group: 'band', order: 1 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: {
        '2026-08-02': {
          'role-guitar': ['person-1'],
          'role-bass': ['person-1'],
        },
      },
    })
    const service = makeService({ date: '2026-08-02' })
    const alice = makePerson({ id: 'person-1', name: 'Alice', email: 'alice@example.com' })

    const result = resolveRecipients(service, [quarter], [guitar, bass], [alice], makeSelection({ teams: ['band'] }))

    expect(result.reachable).toHaveLength(1)
    expect(result.reachable[0]).toEqual({ id: 'person-1', name: 'Alice', email: 'alice@example.com' })
    expect(result.unreachableCount).toBe(0)
  })

  it('Test E (empty-email assignee): a matched person whose email === "" is excluded from reachable and increments unreachableCount by 1', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: { '2026-08-02': { 'role-guitar': ['person-1'] } },
    })
    const service = makeService({ date: '2026-08-02' })
    const noEmailPerson = makePerson({ id: 'person-1', name: 'NoEmail', email: '' })

    const result = resolveRecipients(
      service,
      [quarter],
      [guitar],
      [noEmailPerson],
      makeSelection({ teams: ['band'] }),
    )

    expect(result.reachable).toEqual([])
    expect(result.unreachableCount).toBe(1)
  })

  it('Test F (unfilled role): a role with effectivePersonIds=[] contributes 0 recipients and does NOT change unreachableCount', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: {}, // role-guitar unscheduled for this date -> effectivePersonIds = []
    })
    const service = makeService({ date: '2026-08-02' })

    const result = resolveRecipients(service, [quarter], [guitar], [], makeSelection({ teams: ['band'] }))

    expect(result.reachable).toEqual([])
    expect(result.unreachableCount).toBe(0)
  })

  it('Test G (stale personId silently skipped): a matched personId absent from people is skipped and does NOT increment unreachableCount', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: { '2026-08-02': { 'role-guitar': ['person-deleted'] } },
    })
    const service = makeService({ date: '2026-08-02' })

    // people array does NOT contain 'person-deleted'
    const result = resolveRecipients(service, [quarter], [guitar], [], makeSelection({ teams: ['band'] }))

    expect(result.reachable).toEqual([])
    expect(result.unreachableCount).toBe(0)
  })

  it('Test H (stale vs unreachable distinguished in the same call): one stale id and one empty-email id together only inflate unreachableCount by 1', () => {
    const guitar = makeRole({ id: 'role-guitar', group: 'band', order: 0 })
    const bass = makeRole({ id: 'role-bass', group: 'band', order: 1 })
    const quarter = makeQuarter({
      serviceDates: ['2026-08-02'],
      calendar: {
        '2026-08-02': {
          'role-guitar': ['person-deleted'],
          'role-bass': ['person-1'],
        },
      },
    })
    const service = makeService({ date: '2026-08-02' })
    const noEmailPerson = makePerson({ id: 'person-1', name: 'NoEmail', email: '' })

    const result = resolveRecipients(
      service,
      [quarter],
      [guitar, bass],
      [noEmailPerson],
      makeSelection({ teams: ['band'] }),
    )

    expect(result.reachable).toEqual([])
    expect(result.unreachableCount).toBe(1)
  })
})
