import type {
  Person,
  RoleSlotConfig,
  PersonQuarterData,
  QuarterCalendar,
  ProposeResult,
} from '@/types/roster'

/**
 * Deterministic, pure, greedy weighted-fair-share quarterly scheduler (D-06 through D-12).
 *
 * Processes service dates chronologically; for each date, fills each role's slots (in the
 * order returned by resolveRolesForDate) by picking the eligible/available candidate furthest
 * below their 1-in-N frequency target. Blackout dates (D-07) and pairings (D-09) are hard
 * constraints — never violated. Unfillable slots are reported in `unfilled` rather than
 * fabricating an assignment (D-10); pairings that can't be honored (partner blacked out, or
 * partner has no eligible role that date) are reported in `pairingConflicts` rather than
 * silently dropped or forced.
 *
 * Pure function: no database reads/writes, no framework imports, no wall-clock reads, no
 * non-deterministic randomness — fully deterministic and unit-testable, mirroring the
 * pattern established by src/utils/suggestions.ts.
 */
export function proposeQuarterSchedule(
  people: Person[],
  serviceDates: string[],
  resolveRolesForDate: (date: string) => RoleSlotConfig[],
  personQuarterData: PersonQuarterData[],
  existingCalendar?: QuarterCalendar,
): ProposeResult {
  const pqdById = new Map(personQuarterData.map((p) => [p.personId, p]))
  const isBlackedOut = (personId: string, date: string) =>
    pqdById.get(personId)?.blackoutDates.includes(date) ?? false
  const partnersOf = (personId: string) => pqdById.get(personId)?.pairedWith ?? []

  const served = new Map<string, number>(people.map((p) => [p.id, 0]))
  const calendar: QuarterCalendar = {}
  const unfilled: Array<{ date: string; roleId: string }> = []
  const pairingConflicts: Array<{ date: string; personId: string; partnerId: string; reason: string }> = []

  // Seed with existing (locked) assignments in "fill gaps" mode so servedCount/deficit
  // accounts for people already scheduled.
  if (existingCalendar) {
    for (const date of serviceDates) {
      calendar[date] = { ...(existingCalendar[date] ?? {}) }
      for (const ids of Object.values(calendar[date] ?? {})) {
        for (const id of ids) served.set(id, (served.get(id) ?? 0) + 1)
      }
    }
  }

  serviceDates.forEach((date, dateIndex) => {
    calendar[date] ??= {}
    const rolesForDate = resolveRolesForDate(date)

    const assignToRole = (roleId: string, personId: string) => {
      calendar[date]![roleId] ??= []
      if (!calendar[date]![roleId]!.includes(personId)) {
        calendar[date]![roleId]!.push(personId)
        served.set(personId, (served.get(personId) ?? 0) + 1)
      }
    }

    const propagatePairing = (personId: string, visited: Set<string>) => {
      for (const partnerId of partnersOf(personId)) {
        if (visited.has(partnerId)) continue
        visited.add(partnerId)
        const alreadyToday = Object.values(calendar[date] ?? {}).some((ids) => ids.includes(partnerId))
        if (alreadyToday) continue
        if (isBlackedOut(partnerId, date)) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'partner blacked out' })
          continue
        }
        const partner = people.find((p) => p.id === partnerId)
        if (!partner) continue
        // Own roles only (D-09) — prefer a role with remaining template capacity, else overflow first eligible role
        const eligibleRoles = rolesForDate.filter((r) => partner.roles.includes(r.roleId))
        const withCapacity = eligibleRoles.find(
          (r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count,
        )
        const target = withCapacity ?? eligibleRoles[0]
        if (!target) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'no eligible role for partner today' })
          continue
        }
        assignToRole(target.roleId, partnerId)
        propagatePairing(partnerId, visited) // handle chained pairings (e.g. two kids, one parent)
      }
    }

    for (const { roleId, count } of rolesForDate) {
      calendar[date]![roleId] ??= []
      while (calendar[date]![roleId]!.length < count) {
        const alreadyInRole = new Set(calendar[date]![roleId])
        const candidates = people.filter(
          (p) => p.active && p.roles.includes(roleId) && !isBlackedOut(p.id, date) && !alreadyInRole.has(p.id),
        )
        if (candidates.length === 0) {
          unfilled.push({ date, roleId })
          break // stop trying to fill this role's remaining slots for this date
        }
        const scored = candidates
          .map((p) => ({
            p,
            deficit: (dateIndex + 1) / p.frequencyTargetN - (served.get(p.id) ?? 0),
          }))
          .sort(
            (a, b) =>
              b.deficit - a.deficit ||
              (served.get(a.p.id) ?? 0) - (served.get(b.p.id) ?? 0) ||
              a.p.name.localeCompare(b.p.name), // deterministic final tie-break
          )
        const chosen = scored[0]!.p
        assignToRole(roleId, chosen.id)
        propagatePairing(chosen.id, new Set([chosen.id]))
      }
    }
  })

  return { calendar, servedCounts: Object.fromEntries(served), unfilled, pairingConflicts }
}
