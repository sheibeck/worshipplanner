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
  // D-01/D-02 — even-spread cadence gate. "1-in-N" means "serve at most once every N dates", so
  // a person stays eligible for a role on the date at `dateIndex` ONLY while their per-role served
  // count is still below the running even-spread target (dateIndex+1)/n — i.e. while they are
  // behind their ideal pace. This is what spreads a monthly (n=4) person evenly across the WHOLE
  // quarter (weeks 1, 5, 9, 13…) instead of greedily booking them every week until a flat
  // whole-quarter budget runs out and then leaving the rest blank (the front-loading bug: the
  // sole guitarist getting every Sunday in June, then nothing). A simple count ceiling can't do
  // this — the target has to advance with the calendar. WR-02: n<=0 (the drawer's "As-needed
  // (fill-in)" preset writes n:0, and malformed/legacy entries could too) has no valid cadence,
  // so the person is NEVER proactively scheduled — no divide-by-zero into Infinity. Used by BOTH
  // the main assignment loop and propagatePairing so direct picks and pull-ins are spaced
  // identically (no front-loading on either path).
  const withinCadence = (personId: string, roleId: string, dateIndex: number): boolean => {
    const n = roleFrequencyOf(personId, roleId).n
    if (n <= 0) return false
    return getServedByRole(personId, roleId) < (dateIndex + 1) / n
  }

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
        // Fill-in tier is manual-only — a paired fill-in partner is NOT auto-pulled in. Silent
        // skip (like the cadence skip below), not a genuine conflict: the coordinator schedules
        // fill-ins by hand.
        const regularRoles = notOutTier.filter((r) => tierOf(partnerId, r.roleId) === 'regular')
        if (regularRoles.length === 0) continue
        // D-12/Pitfall 2 — the CONFIRMED landmine: propagatePairing is a second, independent
        // role-selection path. It MUST apply the exact same shared group-compatibility check as
        // the main loop below, or a paired partner can silently be pulled into an illegal combo.
        const eligibleRoles = regularRoles.filter((r) =>
          isGroupCompatible(rolesHeldThisDate(partnerId), r.roleId, roleGroupOf),
        )
        if (eligibleRoles.length === 0) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'group rule violation for partner today' })
          continue
        }
        // D-01/D-02 — only pull the partner in on the occurrences where they're behind their OWN
        // even-spread per-role pace (same withinCadence gate the main loop uses). This gives
        // containment its correct asymmetric shape AND spreads the pull-ins evenly: a lower-cadence
        // partner (e.g. Nolan, ~once/month) lands on an evenly-spaced subset of the higher-cadence
        // anchor's (e.g. Tim, ~twice/month) dates — every 4th of Tim's dates, not front-loaded onto
        // Tim's first several. Tim's "extra" occurrences beyond Nolan's pace proceed without Nolan,
        // never inflating Nolan's serve count up to Tim's cadence (anti-pattern rejected by D-01).
        const spaced = eligibleRoles.filter((r) => withinCadence(partnerId, r.roleId, dateIndex))
        if (spaced.length === 0) {
          // D-03: cadence-driven skip is silent — do NOT push to pairingConflicts. This is
          // expected/normal (the anchor's pace exceeds what the partner's cadence can absorb),
          // not a genuine problem like blackout/no-role/group-violation above.
          continue
        }
        // Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted):
        // this gate only constrains pull-ins via propagation. If the partner independently holds
        // a role the anchor does not, the main loop's spacing pass could in principle still pick
        // the partner directly on a date the anchor isn't serving at all, which a maximally strict
        // reading of containment would forbid. The canonical pairing shape (co-vocalists /
        // parent-child sharing the same role) does not hit this edge case, so it's shipped as-is.
        const withCapacity = spaced.find(
          (r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count,
        )
        const target = withCapacity ?? spaced[0]!
        assignToRole(target.roleId, partnerId)
        propagatePairing(partnerId, visited) // handle chained pairings (e.g. two kids, one parent)
      }
    }

    for (const { roleId, count } of rolesForDate) {
      calendar[date]![roleId] ??= []
      while (calendar[date]![roleId]!.length < count) {
        const alreadyInRole = new Set(calendar[date]![roleId])
        // Only 'regular'-tier people are auto-scheduled. 'fillin'-tier is manual-only — the
        // coordinator fills those gaps by hand (there is intentionally NO last-resort fillin
        // auto-fill), and 'out'-tier is excluded for the whole quarter. A regular candidate
        // stays eligible only while still BEHIND their even-spread cadence pace
        // (withinCadence): "1-in-N" means once every N dates, so a monthly (n=4) person is only
        // eligible on ~every 4th date and lands evenly across the whole quarter instead of being
        // front-loaded into the first few weeks and then dropped. When nobody is behind their
        // pace, the slot is left BLANK (pushed to `unfilled`) rather than over-serving someone:
        // hard caps win over full coverage, and blank spots are acceptable/expected (they get
        // filled in by hand). This is what stops the "only guitarist gets booked every single
        // week" and "once-a-month person lands twice a month" over-scheduling.
        const candidates = people.filter(
          (p) =>
            p.active &&
            p.roles.includes(roleId) &&
            !isBlackedOut(p.id, date) &&
            !alreadyInRole.has(p.id) &&
            tierOf(p.id, roleId) === 'regular' &&
            withinCadence(p.id, roleId, dateIndex) &&
            // D-10/D-12 — same shared helper as propagatePairing above.
            isGroupCompatible(rolesHeldThisDate(p.id), roleId, roleGroupOf),
        )

        if (candidates.length === 0) {
          unfilled.push({ date, roleId })
          break // stop trying to fill this role's remaining slots for this date
        }
        const scored = candidates
          .map((p) => {
            // Per-role cadence (D-05): N sourced from the quarter-scoped roleFrequency entry
            // (D-04); absent role entry defaults to n=4 via roleFrequencyOf. Only regular-tier
            // candidates reach here, so the deficit formula always applies.
            const n = roleFrequencyOf(p.id, roleId).n
            return {
              p,
              deficit: (dateIndex + 1) / n - getServedByRole(p.id, roleId),
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
