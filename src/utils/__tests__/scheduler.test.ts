import { describe, it, expect } from 'vitest'
import { proposeQuarterSchedule } from '@/utils/scheduler'
import type {
  Person,
  RoleSlotConfig,
  PersonQuarterData,
  QuarterCalendar,
  RoleGroup,
  RoleFrequencyEntry,
} from '@/types/roster'

// Factory helper for Person. Standing frequency fields (frequencyTargetN/roleFrequencies) are
// @deprecated (Phase 16 D-04) and no longer read by the scheduler — frequencyTargetN is still
// required by the Person type shape, so a harmless default is supplied, but no test below relies
// on it to convey scheduling behavior (see makePQD's roleFrequency instead).
function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    email: overrides.email ?? `${overrides.id}@example.com`,
    phone: overrides.phone ?? '',
    active: overrides.active ?? true,
    roles: overrides.roles ?? [],
    frequencyTargetN: overrides.frequencyTargetN ?? 4,
    pcPersonId: overrides.pcPersonId ?? null,
    createdAt: overrides.createdAt ?? ({} as any),
    updatedAt: overrides.updatedAt ?? ({} as any),
  }
}

// Factory helper for PersonQuarterData. Quarter-scoped, per-role frequency (D-04/D-05) is the
// single source of truth: roleFrequency[roleId] = { tier, n }. Absent role entry (or no PQD at
// all) defaults to { tier: 'regular', n: 4 } inside the scheduler.
function makePQD(overrides: Partial<PersonQuarterData> & { personId: string }): PersonQuarterData {
  return {
    personId: overrides.personId,
    blackoutDates: overrides.blackoutDates ?? [],
    pairedWith: overrides.pairedWith ?? [],
    ...(overrides.roleFrequency !== undefined ? { roleFrequency: overrides.roleFrequency } : {}),
    ...(overrides.note !== undefined ? { note: overrides.note } : {}),
  }
}

// Small helper to build a single-role roleFrequency map inline at call sites.
function freq(roleId: string, tier: RoleFrequencyEntry['tier'], n: number): Record<string, RoleFrequencyEntry> {
  return { [roleId]: { tier, n } }
}

// Simple static role resolver (no per-date overrides) unless a map is passed
function makeResolver(defaultRoles: RoleSlotConfig[], overrides?: Record<string, RoleSlotConfig[]>) {
  return (date: string): RoleSlotConfig[] => overrides?.[date] ?? defaultRoles
}

// roleId -> RoleGroup lookup helper, mirroring makeResolver's shape. Unknown roleIds default to
// 'other' (safe default per D-10 implementation notes), matching proposeQuarterSchedule's own default.
function makeRoleGroupOf(map: Record<string, RoleGroup>) {
  return (roleId: string): RoleGroup => map[roleId] ?? 'other'
}

describe('proposeQuarterSchedule', () => {
  it('blackout: never assigns a person on a blacked-out date, leaving the slot unfilled if they were the only candidate', () => {
    const people = [makePerson({ id: 'p1', roles: ['guitar'] })]
    const dates = ['2026-01-04', '2026-01-11']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [makePQD({ personId: 'p1', blackoutDates: ['2026-01-04'] })]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).not.toContain('p1')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' })
    // second week, no blackout — p1 should be assigned
    expect(result.calendar['2026-01-11']?.['guitar']).toContain('p1')
  })

  it('multi: fills a role with count 2 using exactly 2 distinct people; one person can appear in two roles same date (D-04)', () => {
    const people = [
      makePerson({ id: 'p1', roles: ['guitar', 'vocals'] }),
      makePerson({ id: 'p2', roles: ['guitar'] }),
      makePerson({ id: 'p3', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 2 },
      { roleId: 'vocals', count: 1 },
    ])
    const pqd: PersonQuarterData[] = []

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    const guitarAssignees = result.calendar['2026-01-04']?.['guitar'] ?? []
    expect(guitarAssignees).toHaveLength(2)
    expect(new Set(guitarAssignees).size).toBe(2)

    // p1 is eligible for both guitar and vocals — confirm a person can hold two roles same date
    const vocalsAssignees = result.calendar['2026-01-04']?.['vocals'] ?? []
    expect(vocalsAssignees).toContain('p1')
  })

  it('deficit: a weekly (N=1) never-served person outranks a monthly (N=4) already-served person', () => {
    const people = [
      makePerson({ id: 'weekly', roles: ['guitar'] }),
      makePerson({ id: 'monthly', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [
      makePQD({ personId: 'weekly', roleFrequency: freq('guitar', 'regular', 1) }),
      makePQD({ personId: 'monthly', roleFrequency: freq('guitar', 'regular', 4) }),
    ]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    // dateIndex 0: weekly deficit = 1/1 - 0 = 1; monthly deficit = 1/4 - 0 = 0.25
    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['weekly'])
  })

  it('deficit tie-break: identical deficits resolve deterministically and repeat runs yield identical calendars', () => {
    const people = [
      makePerson({ id: 'zed', name: 'Zed', roles: ['guitar'] }),
      makePerson({ id: 'amy', name: 'Amy', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [
      makePQD({ personId: 'zed', roleFrequency: freq('guitar', 'regular', 1) }),
      makePQD({ personId: 'amy', roleFrequency: freq('guitar', 'regular', 1) }),
    ]

    const result1 = proposeQuarterSchedule(people, dates, resolver, pqd)
    const result2 = proposeQuarterSchedule(people, dates, resolver, pqd)

    // Both have identical deficit (1/1 - 0 = 1) and identical servedCount (0) —
    // tie-break falls to name.localeCompare: 'Amy' < 'Zed'
    expect(result1.calendar['2026-01-04']?.['guitar']).toEqual(['amy'])
    expect(result2.calendar['2026-01-04']?.['guitar']).toEqual(result1.calendar['2026-01-04']?.['guitar'])
  })

  it('unfilled: a role with zero eligible/available candidates yields an unfilled entry, no fabricated assignment', () => {
    const people = [makePerson({ id: 'p1', roles: ['vocals'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd: PersonQuarterData[] = []

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).toHaveLength(0)
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' })
    expect(result.servedCounts['p1']).toBe(0)
  })

  it('pairing: when person A is scheduled, paired partner B is also assigned that date in one of B\'s own eligible roles (D-09)', () => {
    const people = [
      makePerson({ id: 'a', roles: ['guitar'] }),
      makePerson({ id: 'b', roles: ['vocals'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'vocals', count: 1 },
    ])
    const pqd = [
      makePQD({ personId: 'a', pairedWith: ['b'] }),
      makePQD({ personId: 'b', pairedWith: ['a'] }),
    ]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['guitar']).toContain('a')
    expect(result.calendar['2026-01-04']?.['vocals']).toContain('b')
  })

  it('pairing conflict: if partner B is blacked out, no assignment is made for B and a pairingConflicts entry is recorded (D-07 wins)', () => {
    const people = [
      makePerson({ id: 'a', roles: ['guitar'] }),
      makePerson({ id: 'b', roles: ['vocals'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'vocals', count: 1 },
    ])
    const pqd = [
      makePQD({ personId: 'a', pairedWith: ['b'] }),
      makePQD({ personId: 'b', pairedWith: ['a'], blackoutDates: ['2026-01-04'] }),
    ]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['guitar']).toContain('a')
    expect(result.calendar['2026-01-04']?.['vocals'] ?? []).not.toContain('b')
    expect(result.pairingConflicts).toContainEqual(
      expect.objectContaining({ date: '2026-01-04', personId: 'a', partnerId: 'b' }),
    )
  })

  it('override: resolveRolesForDate per-date override (count 0 for livestream, count 2 for vocals) is honored over the default (D-02)', () => {
    const people = [
      makePerson({ id: 'p1', roles: ['livestream', 'vocals'] }),
      makePerson({ id: 'p2', roles: ['vocals'] }),
    ]
    const dates = ['2026-01-04']
    const defaultRoles: RoleSlotConfig[] = [
      { roleId: 'livestream', count: 1 },
      { roleId: 'vocals', count: 1 },
    ]
    const overrides: Record<string, RoleSlotConfig[]> = {
      '2026-01-04': [
        { roleId: 'livestream', count: 0 },
        { roleId: 'vocals', count: 2 },
      ],
    }
    const resolver = makeResolver(defaultRoles, overrides)
    const pqd: PersonQuarterData[] = []

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['livestream'] ?? []).toHaveLength(0)
    expect(result.calendar['2026-01-04']?.['vocals']).toHaveLength(2)
  })

  it('consecutive: an N=1 person eligible+available every week IS assigned on consecutive weeks (no back-to-back suppression, D-12)', () => {
    const people = [makePerson({ id: 'p1', roles: ['guitar'] })]
    const dates = ['2026-01-04', '2026-01-11', '2026-01-18']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [makePQD({ personId: 'p1', roleFrequency: freq('guitar', 'regular', 1) })]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    for (const date of dates) {
      expect(result.calendar[date]?.['guitar']).toContain('p1')
    }
    expect(result.servedCounts['p1']).toBe(3)
  })

  it('fillin: a regular-tier candidate is always chosen over a fillin-tier candidate when both are eligible', () => {
    const people = [
      makePerson({ id: 'reg', roles: ['guitar'] }),
      makePerson({ id: 'fill', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [
      makePQD({ personId: 'reg', roleFrequency: freq('guitar', 'regular', 1) }),
      makePQD({ personId: 'fill', roleFrequency: freq('guitar', 'fillin', 1) }),
    ]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    // Both eligible — regular-tier person is always chosen first, never the fillin-tier person
    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['reg'])
  })

  it('fillin last resort: fillin-tier candidate is chosen only when the regular candidate is blacked out/assigned and no other regular exists', () => {
    const people = [
      makePerson({ id: 'reg', roles: ['guitar'] }),
      makePerson({ id: 'fill', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [
      makePQD({
        personId: 'reg',
        roleFrequency: freq('guitar', 'regular', 1),
        blackoutDates: ['2026-01-04'],
      }),
      makePQD({ personId: 'fill', roleFrequency: freq('guitar', 'fillin', 1) }),
    ]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    // reg is blacked out -> zero regular candidates -> fillin last-resort kicks in
    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['fill'])
  })

  it('out tier: an out-tier person eligible by role is never assigned and never appears in unfilled as a filler', () => {
    const people = [makePerson({ id: 'out1', roles: ['guitar'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [makePQD({ personId: 'out1', roleFrequency: freq('guitar', 'out', 4) })]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).not.toContain('out1')
    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).toHaveLength(0)
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' })
  })

  it('out tier: paired partner who is out-tier is not force-scheduled and produces a pairingConflicts entry', () => {
    const people = [
      makePerson({ id: 'a', roles: ['guitar'] }),
      makePerson({ id: 'b', roles: ['vocals'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'vocals', count: 1 },
    ])
    const pqd = [
      makePQD({ personId: 'a', pairedWith: ['b'] }),
      makePQD({ personId: 'b', pairedWith: ['a'], roleFrequency: freq('vocals', 'out', 4) }),
    ]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    expect(result.calendar['2026-01-04']?.['guitar']).toContain('a')
    expect(result.calendar['2026-01-04']?.['vocals'] ?? []).not.toContain('b')
    expect(result.pairingConflicts).toContainEqual(
      expect.objectContaining({ date: '2026-01-04', personId: 'a', partnerId: 'b', reason: 'partner out this quarter' }),
    )
  })

  it('default safety: a candidate whose PersonQuarterData has no roleFrequency entry for a role (or no PQD entry at all) defaults to regular tier with N=4, identical to prior fallback behavior', () => {
    const people = [
      makePerson({ id: 'p1', roles: ['guitar'] }),
      makePerson({ id: 'p2', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    // p1 has no PQD entry at all; p2 has a PQD entry but no roleFrequency map for 'guitar'
    const pqd = [makePQD({ personId: 'p2', note: 'has a PQD entry but no roleFrequency for guitar' })]

    const result = proposeQuarterSchedule(people, dates, resolver, pqd)

    // Both default to {tier: 'regular', n: 4} -> identical deficit (0.25) and servedCount (0) —
    // tie-break falls to name.localeCompare: 'p1' < 'p2'
    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['p1'])
  })

  it('fill gaps: existingCalendar seeds servedCounts so locked assignments reflect in deficit, only empty slots get filled', () => {
    const people = [
      makePerson({ id: 'p1', roles: ['guitar'] }),
      makePerson({ id: 'p2', roles: ['guitar'] }),
    ]
    const dates = ['2026-01-04', '2026-01-11']
    const resolver = makeResolver([{ roleId: 'guitar', count: 1 }])
    const pqd = [
      makePQD({ personId: 'p1', roleFrequency: freq('guitar', 'regular', 1) }),
      makePQD({ personId: 'p2', roleFrequency: freq('guitar', 'regular', 1) }),
    ]
    const existingCalendar: QuarterCalendar = {
      '2026-01-04': { guitar: ['p1'] },
    }

    const result = proposeQuarterSchedule(people, dates, resolver, pqd, existingCalendar)

    // locked assignment preserved
    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['p1'])
    // servedCounts seeded from the locked assignment
    expect(result.servedCounts['p1']).toBeGreaterThanOrEqual(1)
    // second date's empty slot gets filled by the algorithm (p2 has higher deficit, since p1 already served)
    expect(result.calendar['2026-01-11']?.['guitar']).toContain('p2')
  })

  // --- D-10/D-12 group co-occurrence enforcement + D-05 per-role cadence/tier (Phase 15) ---

  it('group TECH exclusivity: a person already on a TECH role that date is ineligible for a same-date BAND role (D-10)', () => {
    const people = [makePerson({ id: 'p1', roles: ['sound', 'guitar'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'sound', count: 1 },
      { roleId: 'guitar', count: 1 },
    ])
    const roleGroupOf = makeRoleGroupOf({ sound: 'tech', guitar: 'band' })

    const result = proposeQuarterSchedule(people, dates, resolver, [], undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['sound']).toEqual(['p1'])
    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).not.toContain('p1')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' })
  })

  it('group TECH exclusivity (vice versa): a person already on a BAND role that date is ineligible for a same-date TECH role (D-10)', () => {
    const people = [makePerson({ id: 'p1', roles: ['guitar', 'sound'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'sound', count: 1 },
    ])
    const roleGroupOf = makeRoleGroupOf({ guitar: 'band', sound: 'tech' })

    const result = proposeQuarterSchedule(people, dates, resolver, [], undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['p1'])
    expect(result.calendar['2026-01-04']?.['sound'] ?? []).not.toContain('p1')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'sound' })
  })

  it('group cardinality: a person already holding one BAND role that date is not given a second BAND role (D-10)', () => {
    const people = [makePerson({ id: 'p1', roles: ['guitar', 'bass'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'bass', count: 1 },
    ])
    const roleGroupOf = makeRoleGroupOf({ guitar: 'band', bass: 'band' })

    const result = proposeQuarterSchedule(people, dates, resolver, [], undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['p1'])
    expect(result.calendar['2026-01-04']?.['bass'] ?? []).not.toContain('p1')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'bass' })
  })

  it('group cardinality: a person already holding one VOCALS role that date is not given a second VOCALS role (D-10)', () => {
    const people = [makePerson({ id: 'p1', roles: ['vocals1', 'vocals2'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'vocals1', count: 1 },
      { roleId: 'vocals2', count: 1 },
    ])
    const roleGroupOf = makeRoleGroupOf({ vocals1: 'vocals', vocals2: 'vocals' })

    const result = proposeQuarterSchedule(people, dates, resolver, [], undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['vocals1']).toEqual(['p1'])
    expect(result.calendar['2026-01-04']?.['vocals2'] ?? []).not.toContain('p1')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'vocals2' })
  })

  it('group cardinality: OTHER group is uncapped — a person can hold two OTHER roles the same date (D-10)', () => {
    const people = [makePerson({ id: 'p1', roles: ['other1', 'other2'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'other1', count: 1 },
      { roleId: 'other2', count: 1 },
    ])
    const roleGroupOf = makeRoleGroupOf({ other1: 'other', other2: 'other' })

    const result = proposeQuarterSchedule(people, dates, resolver, [], undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['other1']).toEqual(['p1'])
    expect(result.calendar['2026-01-04']?.['other2']).toEqual(['p1'])
  })

  it('group allowed combo: 1 BAND + 1 VOCALS for the same person on one date IS produced when that is the fair assignment (D-10)', () => {
    const people = [makePerson({ id: 'p1', roles: ['guitar', 'vocals'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'vocals', count: 1 },
    ])
    const roleGroupOf = makeRoleGroupOf({ guitar: 'band', vocals: 'vocals' })

    const result = proposeQuarterSchedule(people, dates, resolver, [], undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['p1'])
    expect(result.calendar['2026-01-04']?.['vocals']).toEqual(['p1'])
  })

  it('propagatePairing group case (Pitfall 2, D-12): a partner pulled in via pairing to a TECH role is correctly excluded from a later conflicting BAND role, never producing an illegal combo', () => {
    // 'a' has no group-conflicting roles; 'b' is paired with 'a' and has roles spanning
    // both TECH ('sound') and BAND ('guitar'). Processing order: other_role (fills 'a' directly,
    // which propagates the pairing and pulls 'b' into 'sound'), then 'sound' (already filled by
    // the pairing propagation), then 'guitar' (the ONLY remaining candidate is 'b', who must now
    // be excluded because 'b' already holds a TECH role this date via propagatePairing).
    const people = [
      makePerson({ id: 'a', roles: ['other_role'] }),
      makePerson({ id: 'b', roles: ['sound', 'guitar'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'other_role', count: 1 },
      { roleId: 'sound', count: 1 },
      { roleId: 'guitar', count: 1 },
    ])
    const pqd = [
      makePQD({ personId: 'a', pairedWith: ['b'] }),
      makePQD({ personId: 'b', pairedWith: ['a'] }),
    ]
    const roleGroupOf = makeRoleGroupOf({ other_role: 'other', sound: 'tech', guitar: 'band' })

    const result = proposeQuarterSchedule(people, dates, resolver, pqd, undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['other_role']).toEqual(['a'])
    // 'b' was pulled into 'sound' (TECH) via propagatePairing.
    expect(result.calendar['2026-01-04']?.['sound']).toEqual(['b'])
    // 'b' must NEVER also appear in 'guitar' (BAND) — that would be an illegal TECH+BAND combo.
    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).not.toContain('b')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' })
  })

  it('per-role cadence: deficit is scored against each role\'s own N, not a blended per-person total (D-05)', () => {
    // p1 has an equally-weekly need for BOTH guitar and vocals (N=1 each). p4 only needs vocals
    // monthly (N=4). On the very first date, p1's guitar assignment (processed first in
    // rolesForDate order) must NOT inflate p1's vocals deficit via a shared/blended served
    // counter — if it did, p1's vocals deficit would incorrectly drop to 0 and p4 (0.25) would
    // wrongly win vocals despite p1's genuinely higher (tied, weekly) need.
    const people = [
      makePerson({ id: 'p1', name: 'Amy', roles: ['guitar', 'vocals'] }),
      makePerson({ id: 'p4', name: 'Zoe', roles: ['vocals'] }),
    ]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'vocals', count: 1 },
    ])
    const pqd = [
      makePQD({
        personId: 'p1',
        roleFrequency: { guitar: { tier: 'regular', n: 1 }, vocals: { tier: 'regular', n: 1 } },
      }),
      makePQD({ personId: 'p4', roleFrequency: freq('vocals', 'regular', 4) }),
    ]
    const roleGroupOf = makeRoleGroupOf({ guitar: 'band', vocals: 'vocals' })

    const result = proposeQuarterSchedule(people, dates, resolver, pqd, undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['guitar']).toEqual(['p1'])
    // Per-role tracking: p1's vocals-specific served count is still 0 going into the vocals
    // scoring pass (guitar's serve doesn't leak into vocals' deficit) — p1 (deficit 1) beats p4
    // (deficit 0.25) fairly.
    expect(result.calendar['2026-01-04']?.['vocals']).toEqual(['p1'])
  })

  it('per-role tier: a person \'out\' for one role but \'regular\' for another is excluded only from the \'out\' role (D-05)', () => {
    const people = [makePerson({ id: 'p1', roles: ['guitar', 'vocals'] })]
    const dates = ['2026-01-04']
    const resolver = makeResolver([
      { roleId: 'guitar', count: 1 },
      { roleId: 'vocals', count: 1 },
    ])
    const pqd = [
      makePQD({
        personId: 'p1',
        roleFrequency: { guitar: { tier: 'out', n: 4 }, vocals: { tier: 'regular', n: 4 } },
      }),
    ]
    const roleGroupOf = makeRoleGroupOf({ guitar: 'band', vocals: 'vocals' })

    const result = proposeQuarterSchedule(people, dates, resolver, pqd, undefined, roleGroupOf)

    expect(result.calendar['2026-01-04']?.['guitar'] ?? []).not.toContain('p1')
    expect(result.unfilled).toContainEqual({ date: '2026-01-04', roleId: 'guitar' })
    expect(result.calendar['2026-01-04']?.['vocals']).toEqual(['p1'])
  })
})
