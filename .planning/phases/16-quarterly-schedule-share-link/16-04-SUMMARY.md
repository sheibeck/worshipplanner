---
phase: 16-quarterly-schedule-share-link
plan: 04
subsystem: scheduler
tags: [vue3, typescript, scheduling, pure-function, vitest, tdd]

# Dependency graph
requires:
  - phase: 16-quarterly-schedule-share-link
    plan: 01
    provides: "PersonQuarterData.roleFrequency: Record<roleId, {tier, n}> quarter-scoped single source of truth"
provides:
  - "scheduler.ts::propagatePairing gated by remaining per-role cadence budget (D-01/D-02/D-03) — a must-serve-with partner is only pulled in while within their own roleBudget"
  - "scheduler.ts tierOf/cadence-N reads fully repointed to PersonQuarterData.roleFrequency (zero legacy roleTiers/frequencyTier/frequencyTargetN/roleFrequencies reads remain)"
  - "scheduler.test.ts factories (makePerson/makePQD) rewritten to the roleFrequency shape; canonical Nolan/Tim containment + even-spread + silent-skip regression tests"
affects: [16-11-remove-deprecated-frequency-fields]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "roleBudget(personId, roleId) = ceil(serviceDates.length / roleFrequencyOf(...).n) — whole-quarter cadence ceiling, computed once per propagation attempt, reused from the existing servedByRole tracking (no new state)"
    - "Cadence-driven pairing skip uses a bare `continue` (no pairingConflicts push) to keep D-03's silent-skip contract distinct from genuine conflict reasons (blackout/no-role/out-tier/group-violation)"

key-files:
  created: []
  modified:
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts

key-decisions:
  - "Canonical R-12 acceptance test uses a THIRD competing vocalist (Jamie) sharing Nolan/Tim's exact role — this is the RESEARCH.md Pitfall-4-recommended construction that sidesteps the documented residual edge case (a partner being picked directly by the main eligible() loop independent of the anchor) by ensuring Nolan is never the top-deficit candidate on his own; the residual edge case itself is left unfixed and documented in a code comment as a consciously-accepted scope boundary (Open Question 1)"
  - "roleBudget/roleFrequencyOf added as plain closures inside proposeQuarterSchedule (same pattern as existing tierOf/getServedByRole), not extracted to module scope, since they close over serviceDates.length and pqdById"

patterns-established:
  - "Cadence-budget gate sits between the existing eligibleRoles (group-compat) filter and assignToRole — inserted, not replacing, any existing hard-constraint check in propagatePairing's filter chain"

requirements-completed: [R-12, R-05]

# Metrics
duration: 25min
completed: 2026-07-10
---

# Phase 16 Plan 04: Scheduler Pairing Honors Per-Role Frequency Summary

**Gated `propagatePairing`'s partner pull-in by a whole-quarter remaining-cadence budget (`ceil(serviceDates.length / n)`), repointed all scheduler frequency reads to `PersonQuarterData.roleFrequency`, and proved containment/even-spread/silent-skip with a canonical Nolan(once-a-month)/Tim(twice-a-month) co-vocalist regression scenario.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `scheduler.ts`'s `tierOf` and the per-role cadence-N lookup both now read from `PersonQuarterData.roleFrequency[roleId]` (via a new `roleFrequencyOf` helper, default `{tier:'regular', n:4}`) — zero remaining reads of the legacy `roleTiers`/`frequencyTier`/`frequencyTargetN`/`roleFrequencies` fields in `scheduler.ts`
- `propagatePairing` gains a `roleBudget`-based `withinCadence` filter inserted between the existing group-compatibility `eligibleRoles` computation and `assignToRole` — a partner is pulled in only while `getServedByRole(partnerId, roleId) < roleBudget(partnerId, roleId)`; once exhausted the anchor's remaining dates proceed alone via a silent `continue` (no `pairingConflicts` entry, per D-03)
- All existing hard constraints (blackout, no-eligible-role, out-tier, group co-occurrence via `isGroupCompatible`) are untouched — the new gate is purely additive to the filter chain
- Rewrote `scheduler.test.ts`'s `makePerson`/`makePQD` factories to the new `roleFrequency: Record<roleId, {tier, n}>` shape and updated all ~20 pre-existing test cases (Task 1, no behavior change) before adding the new R-12 gate + tests (Task 2)
- New canonical scenario (Nolan n=4, Tim n=2, sharing role `vocals`, plus a third competing vocalist `Jamie` to sidestep the documented residual main-loop edge case) proves: full-calendar containment (every Nolan date has Tim), budget-capped served count (`ceil(26/4) = 7`, verified exact), even 2-week gap spacing (inherited from Tim's own deficit-fair-share schedule), and zero `pairingConflicts` entries for the cadence-driven skips

## Task Commits

Each task was committed atomically:

1. **Task 1: Repoint scheduler reads to roleFrequency; rewrite test factories (keep suite green)** - `335f7c0` (refactor)
2. **Task 2: Gate propagatePairing by remaining cadence budget + containment tests** - `8197b22` (feat)

_TDD: Task 1 established the pure repoint with the existing 24-test suite green (no gate yet). Task 2 added the RED tests for the Nolan/Tim scenario, implemented the `roleBudget`/`withinCadence` gate (GREEN), and confirmed the full 28-test suite plus the entire project's 675-test `vitest run` stayed green._

## Files Created/Modified
- `src/utils/scheduler.ts` - `roleFrequencyOf`/`roleBudget` helpers added; `tierOf` and the deficit-scoring cadence-N read repointed to `roleFrequencyOf`; `propagatePairing`'s filter chain gains the `withinCadence` cadence-budget gate (silent `continue` on exhaustion) plus a code comment documenting the accepted residual edge case (main-loop independent selection, RESEARCH Pitfall 4 / Open Question 1)
- `src/utils/__tests__/scheduler.test.ts` - `makePerson`/`makePQD` factories rewritten to the `roleFrequency` shape (dropped `frequencyTargetN`/`roleFrequencies`/`roleTiers`/`frequencyTier` from all call sites); all pre-existing cases updated; new `describe('cadence-gated pairing (R-12)')` block with 4 tests (containment, cadence-budget cap, even spread, silent skip)

## Decisions Made
- Canonical acceptance test deliberately includes a third "Jamie" competitor holding the same role as Nolan/Tim, per RESEARCH.md's explicit Pitfall-4 mitigation guidance, so the required regression test exercises the gate's intended behavior without tripping the acknowledged residual edge case
- The residual edge case (partner independently selected by the main `eligible()` loop on a date the anchor doesn't serve) is NOT fixed in this plan — documented in-code as a consciously-accepted scope boundary per the plan's own instruction and RESEARCH.md's Open Question 1 recommendation

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria (grep checks for `roleFrequency`/`roleBudget`/`withinCadence`, zero legacy-field reads, `isGroupCompatible` call count preserved, full `vitest run` green) were verified directly.

## Issues Encountered

Constructing the canonical Nolan/Tim test scenario required empirical iteration: a naive 2-candidate-only construction (just Nolan and Tim sharing a role) produced real containment violations, because the main loop's own deficit-fair-share competition eventually picks the lower-cadence partner directly once the higher-cadence partner's budget is already exhausted — this is exactly the residual edge case RESEARCH.md flags as an accepted scope boundary (Pitfall 4 / Open Question 1), not a bug in the new gate. Resolved per RESEARCH's own recommended mitigation: added a third competing candidate holding the identical role so the lower-cadence partner is never the main loop's top-deficit pick, isolating the test to the gate's actual intended behavior. Verified empirically (not hand-derived) via a disposable exploratory test file, deleted before the final commit.

## User Setup Required

None - pure algorithm/unit-test change, no external service configuration.

## Next Phase Readiness
- `scheduler.ts` is now fully repointed to `PersonQuarterData.roleFrequency` — plan 16-11 (remove deprecated frequency fields) can safely delete `Person.frequencyTargetN`/`roleFrequencies` and `PersonQuarterData.roleTiers`/`frequencyTier` once the remaining Wave-2 readers (`AvailabilityRosterTable.vue`, `QuarterGrid.vue`, `RosterView.vue`, `roster.ts` store) are also repointed by their respective plans
- The residual main-loop-independent-selection edge case (Open Question 1) remains open by design; if a future bug report surfaces a real-world containment violation, the fix would need to constrain the main `eligible()` loop itself (a larger, riskier change explicitly deferred by this plan)

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: src/utils/scheduler.ts
- FOUND: src/utils/__tests__/scheduler.test.ts
- FOUND commit 335f7c0 (Task 1)
- FOUND commit 8197b22 (Task 2)
