---
phase: 15-per-role-frequency-role-categories
plan: 02
subsystem: scheduler
tags: [typescript, tdd, deterministic-algorithm, group-exclusivity]

# Dependency graph
requires:
  - phase: 15-per-role-frequency-role-categories
    plan: 01
    provides: "RoleGroup union with 'vocals', Person.roleFrequencies?, PersonQuarterData.roleTiers? optional schema fields"
provides:
  - "proposeQuarterSchedule roleGroupOf param (optional, defaults to () => 'other')"
  - "Exported pure evaluateGroupCombo/isGroupCompatible helpers encoding D-10 TECH-exclusivity + 1-BAND/1-VOCALS cardinality caps"
  - "Per-(person, role) deficit scoring and per-role tier reads (D-05), external ProposeResult shape unchanged"
affects: [quarters-store, quarter-grid]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-pure-predicate-across-two-selection-paths, per-key-internal-tracking-with-unchanged-external-aggregate-shape]

key-files:
  created: []
  modified:
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts

key-decisions:
  - "isGroupCompatible/evaluateGroupCombo exported as pure functions (not internal closures) so QuarterGrid.vue (plan 15-06) can reuse the identical rule for its manual-grid warning badge without importing scheduler internals"
  - "propagatePairing's conflict-reason ordering: role-name match -> per-role out-tier -> group compatibility, so the pre-existing 'partner out this quarter' / 'no eligible role for partner today' regression tests keep their exact original reason strings"
  - "Deficit scoring tracks served counts internally per '${personId}::${roleId}' key; ProposeResult.servedCounts stays an aggregate Record<personId, number> since nothing outside scheduler.ts reads a richer shape"
  - "roleGroupOf defaults to () => 'other' when omitted, so every pre-existing test call-site (which doesn't pass it) keeps compiling and behaves as before (unknown/unclassified roles never trigger group restrictions)"

requirements-completed: [D-05, D-07, D-10, D-11, D-12]

# Metrics
duration: ~18min
completed: 2026-07-09
---

# Phase 15 Plan 02: Group Co-occurrence Enforcement + Per-Role Cadence in Scheduler Summary

**Added a shared, exported `isGroupCompatible`/`evaluateGroupCombo` pure predicate (TECH exclusive; 1-BAND + 1-VOCALS cap, OTHER uncapped) applied identically inside both `eligible()` and `propagatePairing()`, plus per-(person, role) deficit/tier scoring — all via TDD (RED then GREEN), full regression suite green.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-09T01:08:00Z (approx.)
- **Completed:** 2026-07-09T01:26:39Z
- **Tasks:** 2 completed (RED, GREEN)
- **Files modified:** 2

## Accomplishments
- `src/utils/scheduler.ts` gains an optional final `roleGroupOf: (roleId: string) => RoleGroup` parameter (default `() => 'other'`), threading role-group awareness into the pure scheduler for the first time
- New exported pure helpers `evaluateGroupCombo(roleIds, roleGroupOf)` and `isGroupCompatible(assignedRoleIdsThisDate, candidateRoleId, roleGroupOf)` encode D-10's group rules once, reused by both the main `eligible()` filter predicate and `propagatePairing`'s role-selection filter — closing the confirmed RESEARCH Pitfall 2 gap (paired partners could previously bypass group rules entirely)
- `propagatePairing` restructured to filter partner role candidates in order: role-name match -> per-role out-tier exclusion -> group compatibility, pushing a new `pairingConflicts` reason `'group rule violation for partner today'` when no compliant role remains, while preserving the exact original reason strings (`'partner blacked out'`, `'partner out this quarter'`, `'no eligible role for partner today'`) for existing regression tests
- `tierOf(personId, roleId)` now reads `roleTiers[roleId]` first, falling back to legacy `frequencyTier`, then `'regular'` (D-05)
- Deficit numerator now uses `roleFrequencies[roleId] ?? frequencyTargetN` and an internal `servedByRole` map keyed `${personId}::${roleId}`, so one role's cadence/served-count never leaks into a different role's fairness scoring for the same person — while the external `ProposeResult.servedCounts` stays the unchanged aggregate `Record<personId, number>` shape
- `npx vitest run src/utils/__tests__/scheduler.test.ts` — 24/24 green (17 pre-existing regression cases + 7 new); full suite `npx vitest run` — 618/618 green; `npm run type-check` (`vue-tsc --build`) — clean

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 (RED): Extend test factories and write failing co-occurrence + per-role cases** - `f043e15` (test)
2. **Task 2 (GREEN): Implement roleGroupOf param, shared group helper in both paths, per-role deficit/tier** - `552c512` (feat)

## TDD Gate Compliance

Both required gate commits present in git log, in order: `f043e15` (`test(15-02): ...` — RED, 7 new cases confirmed failing against pre-fix scheduler.ts, 17 existing cases untouched and green) then `552c512` (`feat(15-02): ...` — GREEN, all 24 cases pass). No REFACTOR commit was needed (implementation matched the planned shape on first pass; no post-GREEN cleanup required).

## Files Created/Modified
- `src/utils/scheduler.ts` — `roleGroupOf` param, exported `evaluateGroupCombo`/`isGroupCompatible`, group-check applied in both `eligible()` and `propagatePairing()`, per-role `tierOf`, per-role deficit via `servedByRole` map, external `ProposeResult` shape unchanged
- `src/utils/__tests__/scheduler.test.ts` — `makePerson`/`makePQD` extended with `roleFrequencies`/`roleTiers` conditional-spread overrides, new `makeRoleGroupOf` factory, 7 new test cases (TECH exclusivity both directions, 1-BAND cap, 1-VOCALS cap, OTHER uncapped, allowed 1-BAND+1-VOCALS combo, the `propagatePairing` group case, per-role cadence deficit, per-role tier exclusion)

## Decisions Made
- Kept `isGroupCompatible`/`evaluateGroupCombo` as standalone exported pure functions (not scheduler-internal closures) specifically so plan 15-06's `QuarterGrid.vue` manual-grid warning badge can call the identical rule against `Quarter.calendar` without duplicating logic or importing scheduler internals.
- Restructured `propagatePairing`'s conflict-detection order (role-match -> out-tier -> group-compat) rather than keeping the original early `tierOf(partnerId) === 'out'` short-circuit, so the newly-added group check has a well-defined place in the filter chain while the two pre-existing regression tests (`'partner out this quarter'`, `'no eligible role for partner today'`) still receive their exact original reason strings for the scenarios they cover.
- The "propagatePairing group case" test (`a`/`b` pairing scenario) demonstrates the shared-helper requirement by showing a role obtained via pairing propagation (`b` pulled into TECH `sound`) correctly blocks a *later*, independently-processed conflicting role (`guitar`, BAND) in the main `eligible()` loop — this is the practically-reachable manifestation of RESEARCH Pitfall 2 given the codebase's existing `alreadyToday`/`visited` guards, which structurally prevent a *single* `propagatePairing` invocation from ever assigning a genuinely new partner a role that conflicts with something they *already* hold at that exact moment (a not-yet-assigned partner's first role can never violate a cap in isolation). The `isGroupCompatible` filter is still applied literally inside `propagatePairing`'s own role selection (verified via the plan's required grep checks) as specified, providing defense-in-depth regardless.
- Tie-break secondary sort key switched from the aggregate `served` count to the per-role `servedByRole` count for consistency with the new per-role fairness model — verified to produce identical results on all pre-existing tie-break regression tests (both start at 0 either way).

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their acceptance criteria; no auto-fixes, no architectural questions, no blockers. The `propagatePairing` conflict-reason reordering (role-match before out-tier check, vs. the original's out-tier-first short-circuit) is an implementation-detail restructuring required to correctly place the new group-compatibility filter in the chain — it is fully covered by Rule 1/Rule 3 (necessary correctness wiring for the task, not a deviation from what was planned) and produces identical externally-observable behavior for every existing regression test.

## Issues Encountered
None.

## User Setup Required
None — pure internal TypeScript logic change, no external services, no new packages (per the plan's threat model, T-15-02-SC disposition is "accept — zero packages installed").

## Next Phase Readiness
`proposeQuarterSchedule` now enforces D-10/D-12 group co-occurrence rules identically in both assignment paths and scores fairness per-(person, role) per D-05, with `evaluateGroupCombo`/`isGroupCompatible` exported for reuse. Downstream Wave 2/3 plans (quarters.ts `buildRoleGroupOf` + threading the new param through `generateProposal`, QuarterGrid.vue's live group-violation warning badge reusing `evaluateGroupCombo`, RosterView/AvailabilityDrawer per-role UI) can now safely build on this contract. No blockers.

---
*Phase: 15-per-role-frequency-role-categories*
*Completed: 2026-07-09*
