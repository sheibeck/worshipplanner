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
 * Pure group co-occurrence rule (D-10, derived purely from group + the multi-role flag, NOT
 * configurable). Rewritten for R259 — the flag generalizes from vocals-only to any role in any
 * group: filter the person's roleIds down to the NON-multi-role ones first, then apply the
 * existing rule to just that remainder:
 * - Band and Tech are mutually exclusive on the non-multi remainder: holding a non-multi
 *   'band'-group role that date rules out a non-multi 'tech'-group role that date, and vice
 *   versa.
 * - Other combines freely with either Band or Tech (relaxes the old TECH-exclusive-of-all rule).
 * - Cardinality: at most one non-multi Band-group role (the one-instrument cap) per person per
 *   date.
 * A multi-role role NEVER causes a conflict — it may co-occur with anything, crossing
 * Band/Tech/Other (R259). This is a deliberate behavior change from the Phase-85 rule: a
 * multi-role vocalist can now also run a Tech role the same date (filtered out of the
 * remainder), where previously vocals folded into Band and blocked it.
 * Exported so QuarterGrid.vue (D-11) can reuse the exact same evaluation for its manual-grid
 * warning badge, since it cannot import scheduler.ts's internal closures.
 */
export function evaluateGroupCombo(
  roleIds: string[],
  roleGroupOf: (roleId: string) => RoleGroup,
  isMultiRole: (roleId: string) => boolean,
): { ok: boolean; reason?: string } {
  // Multi-role roles never cause a conflict and may cross Band/Tech/Other. Filter them out;
  // apply the existing rule only to the non-multi remainder (R259).
  const nonMulti = roleIds.filter((id) => !isMultiRole(id))
  const groups = nonMulti.map((id) => roleGroupOf(id))
  const hasBand = groups.includes('band')
  const hasTech = groups.includes('tech')
  if (hasBand && hasTech) {
    return { ok: false, reason: 'Band and Tech are mutually exclusive on the same date' }
  }
  // At most one non-multi Band role (the one-instrument cap). Multi-role band roles (e.g.
  // vocals) are already excluded above, so they never count here.
  const bandInstrumentCount = groups.filter((g) => g === 'band').length
  if (bandInstrumentCount > 1) {
    return {
      ok: false,
      reason: 'at most 1 Band instrument role per person per date (multi-role exempt)',
    }
  }
  return { ok: true }
}

/** See ADR-0187 (docs/adr/0187-whether-adding-candidateroleid-to-a-person-s-already-assigne.md) */
export function isGroupCompatible(
  assignedRoleIdsThisDate: string[],
  candidateRoleId: string,
  roleGroupOf: (roleId: string) => RoleGroup,
  isMultiRole: (roleId: string) => boolean,
): boolean {
  return evaluateGroupCombo([...assignedRoleIdsThisDate, candidateRoleId], roleGroupOf, isMultiRole)
    .ok
}

/** See ADR-0187 (docs/adr/0187-whether-adding-candidateroleid-to-a-person-s-already-assigne.md) */
export function proposeQuarterSchedule(
  people: Person[],
  serviceDates: string[],
  resolveRolesForDate: (date: string) => RoleSlotConfig[],
  personQuarterData: PersonQuarterData[],
  existingCalendar?: QuarterCalendar,
  // See ADR-0188 (docs/adr/0188-caller-quarters-ts-builds-this-from-rosterstore-roles-unknow.md)
  roleGroupOf: (roleId: string) => RoleGroup = () => 'other',
  // Caller (quarters.ts) builds this from rosterStore.roles alongside roleGroupOf
  // (buildIsMultiRole). Unknown roleIds default to false (safe/non-exempt default) so existing
  // call-sites that omit this param keep compiling and behave as "nothing is multi-role" (R259).
  isMultiRole: (roleId: string) => boolean = () => false,
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
  // See ADR-0189 (docs/adr/0189-a-person-stays-eligible-for-a-role-on-the-date-at-dateindex.md)
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
        // See ADR-0187 (docs/adr/0187-whether-adding-candidateroleid-to-a-person-s-already-assigne.md)
        const eligibleRoles = regularRoles.filter((r) =>
          isGroupCompatible(rolesHeldThisDate(partnerId), r.roleId, roleGroupOf, isMultiRole),
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
        // See ADR-0190 (docs/adr/0190-r260-a-pulled-in-paired-partner-who-is-themselves-a-multi-ro.md)
        const withCapacity = spaced.find(
          (r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count,
        )
        const target = withCapacity ?? spaced[0]!
        assignToRole(target.roleId, partnerId)
        // See ADR-0190 (docs/adr/0190-r260-a-pulled-in-paired-partner-who-is-themselves-a-multi-ro.md)
        if (isMultiRole(target.roleId)) propagateMultiRole(partnerId)
        propagatePairing(partnerId, visited) // handle chained pairings (e.g. two kids, one parent)
      }
    }

    // See ADR-0187 (docs/adr/0187-whether-adding-candidateroleid-to-a-person-s-already-assigne.md)
    const propagateMultiRole = (personId: string) => {
      const person = people.find((p) => p.id === personId)
      if (!person) return
      for (const { roleId, count } of rolesForDate) {
        if (!isMultiRole(roleId)) continue // only bundle multi-role roles
        if (!person.roles.includes(roleId)) continue // must actually hold it
        if (calendar[date]![roleId]?.includes(personId)) continue // already on it today
        if (tierOf(personId, roleId) !== 'regular') continue // fill-in/out never auto
        if (!withinCadence(personId, roleId, dateIndex)) continue // consume, never exceed cadence
        if ((calendar[date]![roleId]?.length ?? 0) >= count) continue // no slot capacity -> yield
        // Group-compat is always true for a multi-role role, but call it for uniformity/safety.
        if (!isGroupCompatible(rolesHeldThisDate(personId), roleId, roleGroupOf, isMultiRole)) continue
        assignToRole(roleId, personId)
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
            isGroupCompatible(rolesHeldThisDate(p.id), roleId, roleGroupOf, isMultiRole),
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
        // R260 — fire after propagatePairing so a pulled partner is already present. Deterministic for a
        // FIXED role order (no wall-clock/randomness), but NOT order-independent: because a bundling pull
        // pre-claims a slot before that role's own fill loop runs, changing the role-template order can
        // change who wins a contested slot (bundling can beat a competitor that direct deficit-scoring
        // would otherwise pick — the intended R260 behavior). `resolveRolesForDate`'s order is stable, so
        // the schedule is reproducible; do not assume roles can be freely reordered without effect.
        if (isMultiRole(roleId)) propagateMultiRole(chosen.id)
      }
    }
  })

  return { calendar, servedCounts: Object.fromEntries(served), unfilled, pairingConflicts }
}
