import { describe, it, expect } from 'vitest'
import type { Timestamp } from 'firebase/firestore'
import type { Service, ServiceSlot, SongSlot, StageMarker } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import type { Song, Arrangement } from '@/types/song'
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

function makeArrangement(overrides: Partial<Arrangement> = {}): Arrangement {
  return {
    id: 'arr-1',
    name: 'Default',
    key: 'G',
    bpm: 120,
    lengthSeconds: null,
    chordChartUrl: '',
    notes: '',
    teamTags: [],
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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

    expect(result.assignedEmailsLower).toEqual([])
  })

  it('projects id/name/kind/downloadUrl/href/linkSource on each attachment, stripping storagePath/mimeType/sizeBytes/createdAt/createdBy', () => {
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

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [song])

    expect(result.songs).toHaveLength(1)
    expect(result.songs[0]!.title).toBe('Amazing Grace')
    expect(result.songs[0]!.keyOrArrangement).toBe('G')
    expect(result.songs[0]!.attachments).toEqual([
      { id: 'att-1', name: 'chart.pdf', kind: 'document', downloadUrl: 'https://storage.example.com/chart.pdf?token=abc' },
      { id: 'att-2', name: 'YouTube reference', kind: 'link', href: 'https://youtube.com/watch?v=abc', linkSource: 'youtube' },
    ])
    for (const attachment of result.songs[0]!.attachments) {
      expect('storagePath' in attachment).toBe(false)
      expect('mimeType' in attachment).toBe(false)
      expect('sizeBytes' in attachment).toBe(false)
      expect('createdAt' in attachment).toBe(false)
      expect('createdBy' in attachment).toBe(false)
      expect(Object.keys(attachment).sort()).toEqual(
        [...new Set(['id', 'name', 'kind', 'downloadUrl', 'href', 'linkSource'].filter((k) => k in attachment))].sort(),
      )
    }
  })

  it('IN-02 (126-REVIEW): keeps a visible stub for a slot referencing a deleted/missing catalog song, instead of silently dropping it', () => {
    const service = makeService({
      slots: [makeSongSlot({ songId: 'song-1', songKey: 'G' }), makeSongSlot({ id: 'slot-2', songId: 'song-missing', songKey: 'D' })],
    })
    const song = makeSong({ id: 'song-1' })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [song])

    // The count matches what the leader actually built (2 slots), not a
    // silently-shrunk 1.
    expect(result.songs).toHaveLength(2)
    expect(result.songs[1]).toEqual({
      id: 'song-missing',
      title: '(song removed)',
      keyOrArrangement: 'D',
      bpm: null,
      attachments: [],
    })
  })

  it('returns only the schema fields — no notes or other private planner fields', () => {
    const service = makeService()

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])

    // No slots/markers on the default fixture — orderOfService/roleAssignments
    // are still required keys (empty arrays), stageLayout stays ABSENT (never
    // an empty-elements object) per the conditional-spread contract.
    expect(Object.keys(result).sort()).toEqual(
      [
        'serviceId',
        'orgId',
        'serviceDate',
        'title',
        'status',
        'assignedEmailsLower',
        'rolesByEmailLower',
        'songs',
        'orderOfService',
        'roleAssignments',
      ].sort(),
    )
    expect(JSON.stringify(result)).not.toContain('private planner notes')
    expect(result.serviceId).toBe('service-1')
    expect(result.orgId).toBe('org-1')
    expect(result.serviceDate).toBe('2026-09-06')
    expect(result.title).toBe('Sunday Service')
    expect(result.status).toBe('planned')
    expect(result.orderOfService).toEqual([])
    expect(result.roleAssignments).toEqual([])
    expect(result.stageLayout).toBeUndefined()
  })

  it('excludes song notes from the songs projection', () => {
    const service = makeService({ slots: [makeSongSlot({ songId: 'song-1' })] })
    const song = makeSong({ id: 'song-1', notes: 'this must never appear in rehearseAccess' })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [song])

    expect(JSON.stringify(result.songs)).not.toContain('this must never appear')
  })

  it('performs no I/O and is a pure function of its arguments', () => {
    const service = makeService()
    const before = JSON.stringify(service)
    buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [roleGuitar, roleVocals], [person], [])

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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

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

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

    expect(JSON.stringify(result.rolesByEmailLower)).not.toContain('Dana Smith')
    expect(JSON.stringify(result.rolesByEmailLower)).not.toContain('person-1')
  })

  // ── Phase 127 (T-127-01/02): orderOfService/roleAssignments/stageLayout/bpm ──

  it('orderOfService lists every slot kind with only structured fields, stripping per-slot notes/body entirely', () => {
    const PII_MARKER = 'THIS-MUST-NEVER-LEAK'
    const service = makeService({
      slots: [
        makeSongSlot({ id: 'slot-song', position: 0, notes: PII_MARKER, section: 'worship' }),
        {
          id: 'slot-scripture',
          kind: 'SCRIPTURE',
          position: 1,
          book: 'John',
          chapter: 3,
          verseStart: 16,
          verseEnd: null,
          notes: PII_MARKER,
          section: 'worship',
        },
        {
          id: 'slot-hymn',
          kind: 'HYMN',
          position: 2,
          hymnName: 'Holy, Holy, Holy',
          hymnNumber: '1',
          verses: '1-3',
          notes: PII_MARKER,
          section: 'worship',
        },
        { id: 'slot-imported', kind: 'IMPORTED', position: 3, importId: 'import-1', section: 'worship' },
        { id: 'slot-prayer', kind: 'PRAYER', position: 4, body: PII_MARKER, section: 'pre-service' },
        { id: 'slot-message', kind: 'MESSAGE', position: 5, body: PII_MARKER, section: 'message' },
        { id: 'slot-announcements', kind: 'ANNOUNCEMENTS', position: 6, body: PII_MARKER, section: 'pre-service' },
        { id: 'slot-misc', kind: 'MISC', position: 7, label: 'Offering', body: PII_MARKER, section: 'sending' },
      ] as ServiceSlot[],
    })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])

    expect(result.orderOfService).toHaveLength(8)
    for (const item of result.orderOfService) {
      expect('notes' in (item as object)).toBe(false)
      expect('body' in (item as object)).toBe(false)
    }
    const miscItem = result.orderOfService.find((i) => i.id === 'slot-misc')
    expect(miscItem).toMatchObject({ kind: 'MISC', label: 'Offering' })
    expect(JSON.stringify(result.orderOfService)).not.toContain(PII_MARKER)
  })

  it('a slot with a runtime kind outside the compile-time union still maps to a structured {id,kind,position} stand-in, never undefined', () => {
    const service = makeService({
      slots: [{ id: 'slot-unknown', kind: 'FUTURE_KIND', position: 0 } as unknown as ServiceSlot],
    })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])

    expect(result.orderOfService).toEqual([{ id: 'slot-unknown', kind: 'FUTURE_KIND', position: 0 }])
  })

  it('roleAssignments carries names-only (roleId/roleName/group/personNames) — no personId, no email', () => {
    const role = makeRole({ id: 'role-guitar', name: 'guitar', group: 'band' })
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-1'] } },
    })
    const person = makePerson({ id: 'person-1', name: 'Dana Smith', email: 'dana@example.com' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

    expect(result.roleAssignments).toEqual([
      { roleId: 'role-guitar', roleName: 'guitar', group: 'band', personNames: ['Dana Smith'] },
    ])
    for (const assignment of result.roleAssignments) {
      expect('personId' in (assignment as object)).toBe(false)
      expect('email' in (assignment as object)).toBe(false)
    }
    expect(JSON.stringify(result.roleAssignments)).not.toContain('dana@example.com')
  })

  it('WR-04: a scheduled person removed from the roster falls back to a neutral placeholder, not the raw personId', () => {
    const role = makeRole({ id: 'role-guitar', name: 'guitar', group: 'band' })
    const quarter = makeQuarter({
      serviceDates: ['2026-09-06'],
      calendar: { '2026-09-06': { 'role-guitar': ['person-deleted', 'person-1'] } },
    })
    // Only 'person-1' exists in the roster passed in — 'person-deleted' is
    // still referenced by the calendar but no longer in `people` (removed
    // from the roster after being scheduled).
    const person = makePerson({ id: 'person-1', name: 'Dana Smith' })
    const service = makeService({ date: '2026-09-06' })

    const result = buildRehearseAccess(service, 'org-1', undefined, [quarter], [role], [person], [])

    expect(result.roleAssignments).toEqual([
      { roleId: 'role-guitar', roleName: 'guitar', group: 'band', personNames: ['(removed)', 'Dana Smith'] },
    ])
    expect(JSON.stringify(result.roleAssignments)).not.toContain('person-deleted')
  })

  it('stageLayout is absent (key not present) for a service with zero markers', () => {
    const service = makeService({ stageLayout: { elements: [] } })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])

    expect('stageLayout' in result).toBe(false)
  })

  it('stageLayout strips the free-text marker note but keeps every other display field, clamped', () => {
    const PII_MARKER = 'XLR run from stage left — do not repeat to anyone'
    const markers: StageMarker[] = [
      {
        id: 'm1',
        label: 'Lead Vocal',
        kind: 'lead',
        zone: 'onstage',
        xPct: 150,
        yPct: -10,
        note: PII_MARKER,
        roleName: 'Vocals',
        personName: 'Dana Smith',
        withVocal: true,
      },
    ]
    const service = makeService({ stageLayout: { elements: markers } })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])

    expect(result.stageLayout).toBeDefined()
    const [element] = result.stageLayout!.elements
    expect('note' in (element as object)).toBe(false)
    expect(element).toEqual({
      id: 'm1',
      label: 'Lead Vocal',
      kind: 'lead',
      zone: 'onstage',
      xPct: 100,
      yPct: 0,
      roleName: 'Vocals',
      personName: 'Dana Smith',
      withVocal: true,
    })
    expect(JSON.stringify(result.stageLayout)).not.toContain(PII_MARKER)
  })

  // Phase 130 (R403/R404): orgName lets a zero-membership volunteer label
  // churches without reading organizations/{orgId} (membership-gated).
  it('orgName equals the passed org name when a non-empty name is given', () => {
    const service = makeService()

    const result = buildRehearseAccess(service, 'org-1', 'Grace Church', [], [], [], [])

    expect(result.orgName).toBe('Grace Church')
  })

  it('orgName is absent (not undefined) when an empty string or undefined name is given', () => {
    const service = makeService()

    const resultUndefined = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    const resultEmpty = buildRehearseAccess(service, 'org-1', '', [], [], [], [])

    expect('orgName' in resultUndefined).toBe(false)
    expect('orgName' in resultEmpty).toBe(false)
  })

  it('resolves bpm to the arrangement matching the slot key, falling back to the first arrangement, and null for an arrangement-less song', () => {
    const songWithMatch = makeSong({
      id: 'song-match',
      arrangements: [makeArrangement({ key: 'G', bpm: 90 }), makeArrangement({ key: 'D', bpm: 140 })],
    })
    const songFallback = makeSong({
      id: 'song-fallback',
      arrangements: [makeArrangement({ key: 'C', bpm: 100 })],
    })
    const songNoArrangements = makeSong({ id: 'song-none', arrangements: [] })
    const service = makeService({
      slots: [
        makeSongSlot({ id: 'slot-1', songId: 'song-match', songKey: 'D' }),
        makeSongSlot({ id: 'slot-2', songId: 'song-fallback', songKey: 'NOT-FOUND' }),
        makeSongSlot({ id: 'slot-3', songId: 'song-none', songKey: 'G' }),
      ],
    })

    const result = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [songWithMatch, songFallback, songNoArrangements])

    const byId = new Map(result.songs.map((s) => [s.id, s]))
    expect(byId.get('song-match')?.bpm).toBe(140)
    expect(byId.get('song-fallback')?.bpm).toBe(100)
    expect(byId.get('song-none')?.bpm).toBeNull()
  })
})
