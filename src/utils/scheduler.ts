import type {
  Person,
  RoleSlotConfig,
  PersonQuarterData,
  QuarterCalendar,
  ProposeResult,
  FrequencyTier,
  RoleFrequencyEntry,
  RoleGroup,
} from '@/types/roster'

/**
 * Pure group co-occurrence rule (D-10, derived purely from group, NOT configurable):
 * - TECH is exclusive: a person holding a TECH role that date cannot also hold any
 *   BAND/VOCALS/OTHER role that date, and vice versa.
 * - Cardinality per person per date: at most 1 BAND role, at most 1 VOCALS role. OTHER is
 *   uncapped. The canonical allowed combo is "1 BAND + 1 VOCALS (+ OTHER)".
 * Exported so QuarterGrid.vue (plan 15-06) can reuse the exact same evaluation for its
 * manual-grid warning badge, since it cannot import scheduler.ts's internal closures.
 */
export function evaluateGroupCombo(
  roleIds: string[],
  roleGroupOf: (roleId: string) => RoleGroup,
): { ok: boolean; reason?: string } {
  const groups = roleIds.map((id) => roleGroupOf(id))
  const hasTech = groups.includes('tech')
  const hasNonTech = groups.some((g) => g !== 'tech')
  if (hasTech && hasNonTech) {
    return { ok: false, reason: 'TECH is exclusive of all other role groups on the same date' }
  }
  const bandCount = groups.filter((g) => g === 'band').length
  if (bandCount > 1) {
    return { ok: false, reason: 'at most 1 BAND role per person per date' }
  }
  const vocalsCount = groups.filter((g) => g === 'vocals').length
  if (vocalsCount > 1) {
    return { ok: false, reason: 'at most 1 VOCALS role per person per date' }
  }
  return { ok: true }
}

/**
 * Whether adding `candidateRoleId` to a person's already-assigned roleIds for a given date
 * (`assignedRoleIdsThisDate`) keeps the resulting combo legal (D-10/D-12). Pure/deterministic —
 * used by BOTH the main `eligible()` filter and `propagatePairing`'s role selection so paired
 * partners can never be pulled into an illegal combo (RESEARCH Pitfall 2).
 */
export function isGroupCompatible(
  assignedRoleIdsThisDate: string[],
  candidateRoleId: string,
  roleGroupOf: (roleId: string) => RoleGroup,
): boolean {
  return evaluateGroupCombo([...assignedRoleIdsThisDate, candidateRoleId], roleGroupOf).ok
}

/**
 * Deterministic, pure, greedy weighted-fair-share quarterly scheduler (D-06 through D-12).
 *
 * Processes service dates chronologically; for each date, fills each role's slots (in the
 * order returned by resolveRolesForDate) by picking the eligible/available candidate furthest
 * below their 1-in-N frequency target for THAT role (D-05 — cadence and tier are scored per
 * (person, role), not blended across a person's roles). Blackout dates (D-07) and pairings
 * (D-09) are hard constraints — never violated. Unfillable slots are reported in `unfilled`
 * rather than fabricating an assignment (D-10); pairings that can't be honored (partner
 * blacked out, out-tier for every eligible role, or no group-compatible role available) are
 * reported in `pairingConflicts` rather than silently dropped or forced. Group co-occurrence
 * rules (D-10) are enforced identically in both the main assignment loop and the pairing
 * propagation path via the shared `isGroupCompatible` helper (RESEARCH Pitfall 2).
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
  // Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other'
  // (safe default) so existing call-sites that omit this param keep compiling and behave as
  // "everything combines" (RESEARCH Pitfall 1).
  roleGroupOf: (roleId: string) => RoleGroup = () => 'other',
): ProposeResult {
  const pqdById = new Map(personQuarterData.map((p) => [p.personId, p]))
  const isBlackedOut = (personId: string, date: string) =>
    pqdById.get(personId)?.blackoutDates.includes(date) ?? false
  const partnersOf = (personId: string) => pqdById.get(personId)?.pairedWith ?? []
  // undefined = pre-migration data (or no PQD entry at all) — treat as 'regular' (D-05).
  // Quarter-scoped, per-role single source of truth (D-04) — tier and cadence-N both read
  // from PersonQuarterData.roleFrequency; absent role entry defaults to {tier:'regular', n:4}.
  const roleFrequencyOf = (personId: string, roleId: string): RoleFrequencyEntry =>
    pqdById.get(personId)?.roleFrequency?.[roleId] ?? { tier: 'regular', n: 4 }
  const tierOf = (personId: string, roleId: string): FrequencyTier =>
    roleFrequencyOf(personId, roleId).tier
  // D-01/D-02 — whole-quarter cadence budget ceiling for a person's role, e.g. n=4 over 13
  // dates -> ceil(13/4) = 4. Used by propagatePairing's remaining-cadence-budget gate below.
  const roleBudget = (personId: string, roleId: string): number =>
    Math.ceil(serviceDates.length / roleFrequencyOf(personId, roleId).n)

  // Aggregate served count — kept for the external ProposeResult.servedCounts shape (unchanged,
  // Record<personId, number>; nothing outside scheduler.ts reads it beyond that shape).
  const served = new Map<string, number>(people.map((p) => [p.id, 0]))
  // Internal per-(person, role) served tracking, keyed `${personId}::${roleId}` — deficit
  // scoring uses this so one role's cadence never leaks into another role's fairness (D-05).
  const servedByRole = new Map<string, number>()
  const servedByRoleKey = (personId: string, roleId: string) => `${personId}::${roleId}`
  const getServedByRole = (personId: string, roleId: string) =>
    servedByRole.get(servedByRoleKey(personId, roleId)) ?? 0

  const calendar: QuarterCalendar = {}
  const unfilled: Array<{ date: string; roleId: string }> = []
  const pairingConflicts: Array<{ date: string; personId: string; partnerId: string; reason: string }> = []

  // Seed with existing (locked) assignments in "fill gaps" mode so servedCount/deficit
  // accounts for people already scheduled.
  if (existingCalendar) {
    for (const date of serviceDates) {
      calendar[date] = { ...(existingCalendar[date] ?? {}) }
      for (const [roleId, ids] of Object.entries(calendar[date] ?? {})) {
        for (const id of ids ?? []) {
          served.set(id, (served.get(id) ?? 0) + 1)
          servedByRole.set(servedByRoleKey(id, roleId), getServedByRole(id, roleId) + 1)
        }
      }
    }
  }

  serviceDates.forEach((date, dateIndex) => {
    calendar[date] ??= {}
    const rolesForDate = resolveRolesForDate(date)

    // Roles a person already holds THIS date — recomputed fresh (reads live calendar[date]
    // state), so it correctly reflects assignments made moments earlier in the same date's
    // processing, including ones made via propagatePairing.
    const rolesHeldThisDate = (personId: string): string[] =>
      Object.entries(calendar[date] ?? {})
        .filter(([, ids]) => ids?.includes(personId))
        .map(([roleId]) => roleId)

    const assignToRole = (roleId: string, personId: string) => {
      calendar[date]![roleId] ??= []
      if (!calendar[date]![roleId]!.includes(personId)) {
        calendar[date]![roleId]!.push(personId)
        served.set(personId, (served.get(personId) ?? 0) + 1)
        servedByRole.set(servedByRoleKey(personId, roleId), getServedByRole(personId, roleId) + 1)
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
        // Own roles only (D-09) — prefer a role with remaining template capacity, else overflow
        // first eligible role.
        const roleMatchesByName = rolesForDate.filter((r) => partner.roles.includes(r.roleId))
        if (roleMatchesByName.length === 0) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'no eligible role for partner today' })
          continue
        }
        const notOutTier = roleMatchesByName.filter((r) => tierOf(partnerId, r.roleId) !== 'out')
        if (notOutTier.length === 0) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'partner out this quarter' })
          continue
        }
        // D-12/Pitfall 2 — the CONFIRMED landmine: propagatePairing is a second, independent
        // role-selection path. It MUST apply the exact same shared group-compatibility check as
        // eligible() below, or a paired partner can silently be pulled into an illegal combo.
        const eligibleRoles = notOutTier.filter((r) =>
          isGroupCompatible(rolesHeldThisDate(partnerId), r.roleId, roleGroupOf),
        )
        if (eligibleRoles.length === 0) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'group rule violation for partner today' })
          continue
        }
        // D-01/D-02 — the R-12 fix: only pull the partner in when doing so stays within their
        // OWN remaining per-role cadence budget (whole-quarter ceiling, not "so far"). This is
        // what gives containment its correct asymmetric shape: a lower-cadence partner (e.g.
        // Nolan, ~once/month) is pulled onto a subset of the higher-cadence anchor's (e.g. Tim,
        // ~twice/month) already fair-share-spread dates, capped at Nolan's own budget — Tim's
        // "extra" occurrences beyond that budget proceed without Nolan, never inflating Nolan's
        // serve count up to Tim's cadence (anti-pattern explicitly rejected by D-01).
        const withinCadence = eligibleRoles.filter(
          (r) => getServedByRole(partnerId, r.roleId) < roleBudget(partnerId, r.roleId),
        )
        if (withinCadence.length === 0) {
          // D-03: cadence-driven skip is silent — do NOT push to pairingConflicts. This is
          // expected/normal (the anchor's cadence exceeds what the partner's budget can absorb),
          // not a genuine problem like blackout/no-role/group-violation above.
          continue
        }
        // Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted):
        // this gate only constrains pull-ins via propagation. If the partner independently holds
        // a role the anchor does not, the main eligible() loop's deficit-fair-share pass could in
        // principle still pick the partner directly on a date the anchor isn't serving at all,
        // which a maximally strict reading of containment would forbid. A fully general fix would
        // require constraining the main loop too (larger, riskier change than this SPEC's
        // acceptance criteria require) — the canonical pairing shape (co-vocalists / parent-child
        // sharing the same role) does not hit this edge case, so it's shipped as-is.
        const withCapacity = withinCadence.find(
          (r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count,
        )
        const target = withCapacity ?? withinCadence[0]!
        assignToRole(target.roleId, partnerId)
        propagatePairing(partnerId, visited) // handle chained pairings (e.g. two kids, one parent)
      }
    }

    for (const { roleId, count } of rolesForDate) {
      calendar[date]![roleId] ??= []
      while (calendar[date]![roleId]!.length < count) {
        const alreadyInRole = new Set(calendar[date]![roleId])
        const eligible = (tier: FrequencyTier) =>
          people.filter(
            (p) =>
              p.active &&
              p.roles.includes(roleId) &&
              !isBlackedOut(p.id, date) &&
              !alreadyInRole.has(p.id) &&
              tierOf(p.id, roleId) === tier &&
              // D-10/D-12 — same shared helper as propagatePairing above.
              isGroupCompatible(rolesHeldThisDate(p.id), roleId, roleGroupOf),
          )
        // Regular-tier pass first; fillin-tier is a last resort only when zero regular
        // candidates exist (D-04). 'out'-tier people are excluded from both passes.
        let candidates = eligible('regular')
        if (candidates.length === 0) candidates = eligible('fillin')

        if (candidates.length === 0) {
          unfilled.push({ date, roleId })
          break // stop trying to fill this role's remaining slots for this date
        }
        const scored = candidates
          .map((p) => {
            // Per-role cadence (D-05): N sourced from the quarter-scoped roleFrequency entry
            // (D-04); absent role entry defaults to n=4 via roleFrequencyOf.
            const n = roleFrequencyOf(p.id, roleId).n
            return {
              p,
              // fillin-tier candidates have no meaningful cadence-based deficit — tie-break
              // purely by (per-role servedCount asc, name asc) instead.
              deficit:
                tierOf(p.id, roleId) === 'regular'
                  ? (dateIndex + 1) / n - getServedByRole(p.id, roleId)
                  : 0,
            }
          })
          .sort(
            (a, b) =>
              b.deficit - a.deficit ||
              getServedByRole(a.p.id, roleId) - getServedByRole(b.p.id, roleId) ||
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
