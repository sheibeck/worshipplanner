import { describe, it, expect } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { Service, SongSlot } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import type { Song } from '@/types/song'
import { buildRehearseAccess } from '@/utils/rehearseAccess'

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

function makeSongSlot(overrides: Partial<SongSlot> = {}): SongSlot {
  return {
    id: 'slot-1',
    kind: 'SONG',
    position: 0,
    requiredVwType: 1,
    songId: 'song-1',
    songTitle: 'Amazing Grace',
    songKey: 'G',
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
    notes: 'private planner notes — must never leak',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '',
    author: '',
    themes: [],
    notes: 'private song notes — must never leak',
    vwTypes: [],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: ts,
    updatedAt: ts,
    pcSongId: null,
    hidden: false,
    tags: [],
    removedThemes: [],
    ...overrides,
  }
}

describe('buildRehearseAccess', () => {
  it('normalizes a mixed-case roster email to lowercase in assignedEmailsLower', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ email: 'Dana@Example.com' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', [quarter], [role], [person], [])

    expect(result.assignedEmailsLower).toEqual(['dana@example.com'])
  })

  it('excludes an assigned person with an empty-string email', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ email: '' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', [quarter], [role], [person], [])

    expect(result.assignedEmailsLower).toEqual([])
  })

  it('projects only id/name/kind/downloadUrl/href on each attachment', () => {
    const service = makeService({
      slots: [makeSongSlot({ songId: 'song-1', songKey: 'G' })],
    })
    const song = makeSong({
      id: 'song-1',
      attachments: [
        {
          id: 'att-1',
          kind: 'document',
          name: 'chart.pdf',
          storagePath: 'orgs/org-1/song-files/att-1/chart.pdf',
          downloadUrl: 'https://storage.example.com/chart.pdf?token=abc',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          createdAt: ts,
          createdBy: 'uid-1',
        },
        {
          id: 'att-2',
          kind: 'link',
          name: 'YouTube reference',
          linkSource: 'youtube',
          href: 'https://youtube.com/watch?v=abc',
          createdAt: ts,
          createdBy: 'uid-1',
        },
      ],
    })

    const result = buildRehearseAccess(service, 'org-1', [], [], [], [song])

    expect(result.songs).toHaveLength(1)
    expect(result.songs[0]!.title).toBe('Amazing Grace')
    expect(result.songs[0]!.keyOrArrangement).toBe('G')
    expect(result.songs[0]!.attachments).toEqual([
      { id: 'att-1', name: 'chart.pdf', kind: 'document', downloadUrl: 'https://storage.example.com/chart.pdf?token=abc' },
      { id: 'att-2', name: 'YouTube reference', kind: 'link', href: 'https://youtube.com/watch?v=abc' },
    ])
    for (const attachment of result.songs[0]!.attachments) {
      expect(Object.keys(attachment).sort()).toEqual(
        [...new Set(['id', 'name', 'kind', 'downloadUrl', 'href'].filter((k) => k in attachment))].sort(),
      )
    }
  })

  it('IN-02 (126-REVIEW): keeps a visible stub for a slot referencing a deleted/missing catalog song, instead of silently dropping it', () => {
    const service = makeService({
      slots: [makeSongSlot({ songId: 'song-1', songKey: 'G' }), makeSongSlot({ id: 'slot-2', songId: 'song-missing', songKey: 'D' })],
    })
    const song = makeSong({ id: 'song-1' })

    const result = buildRehearseAccess(service, 'org-1', [], [], [], [song])

    // The count matches what the leader actually built (2 slots), not a
    // silently-shrunk 1.
    expect(result.songs).toHaveLength(2)
    expect(result.songs[1]).toEqual({
      id: 'song-missing',
      title: '(song removed)',
      keyOrArrangement: 'D',
      attachments: [],
    })
  })

  it('returns only the schema fields — no notes or other private planner fields', () => {
    const service = makeService()

    const result = buildRehearseAccess(service, 'org-1', [], [], [], [])

    expect(Object.keys(result).sort()).toEqual(
      ['serviceId', 'orgId', 'serviceDate', 'title', 'status', 'assignedEmailsLower', 'rolesByEmailLower', 'songs'].sort(),
    )
    expect(JSON.stringify(result)).not.toContain('private planner notes')
    expect(result.serviceId).toBe('service-1')
    expect(result.orgId).toBe('org-1')
    expect(result.serviceDate).toBe('2026-09-06')
    expect(result.title).toBe('Sunday Service')
    expect(result.status).toBe('planned')
  })

  it('excludes song notes from the songs projection', () => {
    const service = makeService({ slots: [makeSongSlot({ songId: 'song-1' })] })
    const song = makeSong({ id: 'song-1', notes: 'this must never appear in rehearseAccess' })

    const result = buildRehearseAccess(service, 'org-1', [], [], [], [song])

    expect(JSON.stringify(result.songs)).not.toContain('this must never appear')
  })

  it('performs no I/O and is a pure function of its arguments', () => {
    const service = makeService()
    const before = JSON.stringify(service)
    buildRehearseAccess(service, 'org-1', [], [], [], [])
    expect(JSON.stringify(service)).toBe(before)
  })

  // R381 (Phase 126, My Schedule): rolesByEmailLower — per-email role names,
  // mirrors functions/src/serviceRoles.ts's roleNamesByPerson map-building,
  // keyed by lowercased email instead of personId.
  it('gives a person holding two roles on one service BOTH role names in their email key, deduped', () => {
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

    const result = buildRehearseAccess(service, 'org-1', [quarter], [roleGuitar, roleVocals], [person], [])

    expect(result.rolesByEmailLower).toEqual({ 'dana@example.com': ['guitar', 'vocals'] })
  })

  it('does not duplicate a role name when the same person is scheduled under the same role via override and schedule', () => {
    const role = makeRole({ id: 'role-guitar', name: 'guitar' })
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', email: 'dana@example.com' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', [quarter], [role], [person], [])

    expect(result.rolesByEmailLower).toEqual({ 'dana@example.com': ['guitar'] })
  })

  it('skips an assigned person with an empty-string email from rolesByEmailLower entirely', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', email: '' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', [quarter], [role], [person], [])

    expect(result.rolesByEmailLower).toEqual({})
  })

  it('lowercases the email key in rolesByEmailLower, matching assignedEmailsLower normalization', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', email: 'Dana@Example.COM' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', [quarter], [role], [person], [])

    expect(Object.keys(result.rolesByEmailLower)).toEqual(['dana@example.com'])
  })

  it('rolesByEmailLower carries no PII beyond role-name strings', () => {
    const role = makeRole()
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', name: 'Dana Smith', email: 'dana@example.com' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', [quarter], [role], [person], [])

    expect(JSON.stringify(result.rolesByEmailLower)).not.toContain('Dana Smith')
    expect(JSON.stringify(result.rolesByEmailLower)).not.toContain('person-1')
  })
})
