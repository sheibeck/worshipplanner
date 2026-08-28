---
phase: 89-multi-role-scheduling
plan: 02
subsystem: scheduling
tags: [typescript, scheduler, algorithm, testing]

# Dependency graph
requires:
  - phase: 89-multi-role-scheduling (plan 01)
    provides: "Role.multiRole flag, filter-multi-first evaluateGroupCombo/isGroupCompatible, buildIsMultiRole projection wired into proposeQuarterSchedule"
provides:
  - "propagateMultiRole(personId) — a non-recursive same-date bundling pass in proposeQuarterSchedule, parallel to propagatePairing"
  - "Two trigger points: after every multi-role main-loop pick, and after every multi-role propagatePairing partner pull-in"
  - "describe('multi-role bundling (R260)') test suite: canonical ride-along/extras-elsewhere/cadence-bound/determinism fixture, the load-bearing competition fixture, coverage-bounded-solo fixture, cross-type fixture"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-recursive same-person bundling pass mirroring an existing cross-person propagation pass (propagatePairing): reuse the same withinCadence/capacity/group-compat gates and the same assignToRole writer so the new pass inherits determinism and fairness bounds for free instead of re-deriving them"
    - "Emergent constraint satisfaction over explicit ordering: rarity-anchoring achieved by gating each pulled role independently on its OWN withinCadence check rather than sorting roles by rarity or biasing the deficit score"

key-files:
  created: []
  modified:
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts

key-decisions:
  - "propagateMultiRole is non-recursive — a single sweep over rolesForDate per triggering assignment, never re-invoking itself (RESEARCH Pitfall 2, no infinite-propagation risk by construction)"
  - "Fired at BOTH trigger points per RESEARCH Open Question 1's recommendation: a paired partner who is themselves a multi-role holder also bundles their own other multi-roles once pulled in via propagatePairing — implemented as the consistent version, not the minimal one"
  - "No rarity sort and no deficit-score change — rarity-anchoring, 'never exceeds cadence', and 'fills solo not empty' are all emergent from applying the existing withinCadence even-spread gate independently to each pulled role, per RESEARCH B.2/B.3/B.4"
  - "existingCalendar seeding loop intentionally NOT wired to propagateMultiRole — locked/fill-gaps cells are respected as-is, not re-bundled (RESEARCH Pitfall 7)"

patterns-established:
  - "When adding a new propagation pass to a greedy scheduler, gate every pulled item independently on the same cadence/capacity/compat checks the main loop uses (never a parallel writer) so determinism and fairness bounds inherit automatically instead of requiring a new proof"

requirements-completed: [R260]

coverage:
  - id: D1
    description: "propagateMultiRole(personId) non-recursive pass added inside proposeQuarterSchedule, parallel to propagatePairing, gated per pulled role by isMultiRole + person.roles.includes + not-already-assigned + regular-tier + withinCadence + slot capacity + isGroupCompatible, writing exclusively through the shared assignToRole"
    requirement: "R260"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#canonical: rarest multi-role anchors bundling; higher-cadence roles ride along on the anchor dates AND fill their extra occurrences elsewhere"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#coverage-bounded solo (Pitfall 5/8): when the bundled role is already at its own cadence cap, the anchor role still fills solo and the capped role is never exceeded"
        status: pass
    human_judgment: false
  - id: D2
    description: "propagateMultiRole actually changes scheduling outcomes (proves propagation, not just the pre-existing main loop) — wl's bass pick pre-claims a shared vocals slot ahead of a competitor who would otherwise win the name.localeCompare tie-break; confirmed genuinely RED before Task 2's implementation, then GREEN after"
    requirement: "R260"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#competition (LOAD-BEARING): bundling wins wl the shared vocals slot on the bass date ahead of a competitor who would otherwise win the name.localeCompare tie-break directly"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bundling crosses Band/Tech/Other with no group violation, and composes with pairing (a pulled-in paired partner who is a multi-role holder also bundles their own other multi-roles)"
    requirement: "R260"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#cross-type (Pitfall 3): a person's multi-role sound (tech) + vocals (band) bundle onto the same date with no group violation"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts (full file, 44/44 pass) — existing pairing/determinism (Nolan/Tim) and R259 group-rule tests unaffected"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-27
status: complete
---

# Phase 89 Plan 02: Same-Date Multi-Role Bundling Summary

**Added a non-recursive `propagateMultiRole` pass to `proposeQuarterSchedule`, mirroring `propagatePairing`, so a person's multi-role assignments (e.g. bass + vocals + lead) co-schedule onto the same date — anchored on their rarest role for free via the existing `withinCadence` even-spread gate, with no rarity sort or scoring change.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-27T08:03:00-04:00
- **Completed:** 2026-08-27T08:23:01-04:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `propagateMultiRole(personId)` — a non-recursive closure inside `proposeQuarterSchedule`, parallel in shape to `propagatePairing`, sweeps `rolesForDate` after any multi-role assignment and pulls in each of the person's OTHER multi-role roles that passes its own `withinCadence` + slot capacity + `isGroupCompatible` gate, writing exclusively through the shared `assignToRole`
- Wired at both trigger points: (a) in the main loop, right after `propagatePairing` for the chosen candidate's pick; (b) inside `propagatePairing`, right after a partner pull-in — so a pulled-in paired partner who is themselves a multi-role holder also bundles their own other multi-roles
- New `describe('multi-role bundling (R260)')` suite: the canonical worship-leader fixture (bass anchors on the rarest cadence; vocals+lead ride along on bass dates and fill extras elsewhere; exact cadence caps; determinism across two runs), the load-bearing competition fixture (proves propagation actually changes the outcome, not just documents the sole-candidate main-loop path), a coverage-bounded-solo fixture (bass fills solo when vocals is already at cadence cap), and a cross-type fixture (sound+vocals bundle across Tech/Band with no group violation)
- Confirmed the competition fixture RED before implementing (competitor `ava` won the shared vocals slot via `name.localeCompare`), then GREEN after (`wl` bundles vocals onto the bass date)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — add the multi-role bundling test suite (canonical + load-bearing competition fixture)** - `014cadd6` (test)
2. **Task 2: GREEN — add propagateMultiRole pass + trigger points; full suite + type-check gate** - `359a020c` (feat)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `src/utils/scheduler.ts` - Added `propagateMultiRole(personId)` closure inside `proposeQuarterSchedule` (alongside `propagatePairing`); wired trigger points after the main-loop chosen pick and after `propagatePairing`'s partner pull-in
- `src/utils/__tests__/scheduler.test.ts` - Added `describe('multi-role bundling (R260)')` with the canonical, competition (load-bearing RED->GREEN), coverage-bounded-solo, and cross-type fixtures

## Decisions Made
- Implemented the "consistent" version of RESEARCH Open Question 1: a paired partner who is themselves a multi-role holder also bundles their own other multi-roles once pulled in via `propagatePairing`, rather than the minimal version that would leave pulled-in partners unbundled.
- Fired the main-loop trigger AFTER `propagatePairing` (not before) per RESEARCH B.4's recommendation — order does not affect the final bundled set since the pass is commutative, but firing after ensures a pulled partner is already present when the multi-role sweep runs.
- No rarity sort, no deficit-score bias — verified via the canonical fixture that anchoring on the rarest role (bass, n=4) emerges for free from applying `withinCadence` independently to each pulled role (vocals/lead, n=2), exactly as RESEARCH B.3 predicted.
- `existingCalendar` seeding loop left untouched (no `propagateMultiRole` call there) — locked/fill-gaps cells are respected, not re-bundled, per RESEARCH Pitfall 7. The coverage-bounded-solo fixture relies on this: seeding a locked vocals assignment via `existingCalendar` consumes cadence budget without ever invoking propagation.

## Deviations from Plan

None - plan executed exactly as written. The RED confirmation step (competition fixture genuinely failing before Task 2) was performed and its failure output recorded below.

### RED confirmation (Task 1, before Task 2's implementation)

Running `npx vitest run src/utils/__tests__/scheduler.test.ts -t "multi-role bundling"` after Task 1's commit and before any scheduler.ts changes:

```
✓ canonical: rarest multi-role anchors bundling...
× competition (LOAD-BEARING): bundling wins wl the shared vocals slot...
  AssertionError: expected [ 'ava' ] to include 'wl'
✓ coverage-bounded solo (Pitfall 5/8): ...
✓ cross-type (Pitfall 3): ...
Tests  1 failed | 3 passed
```

This confirms the competition fixture is the genuinely load-bearing RED proof — the other three fixtures pass via the pre-existing sole-candidate main loop (expected per RESEARCH B.3) and do not by themselves prove propagation. After Task 2's implementation, all 44 tests in the file pass (RED->GREEN).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 89 (R259 + R260) is now complete: both plans executed, all requirements delivered.
- Full app suite green except the documented baseline `src/storage.rules.test.ts` (Storage-emulator cross-service limitation, unrelated to this phase) — 4440 passed, 26 skipped, 1 known-failing file.
- `npm run type-check` (`vue-tsc --build`) clean.
- No functions deploy performed or required (per RESEARCH A.6 — the flag is never read server-side).
- No blockers.

---
*Phase: 89-multi-role-scheduling*
*Completed: 2026-08-27*

## Self-Check: PASSED
All files (src/utils/scheduler.ts, src/utils/__tests__/scheduler.test.ts, this SUMMARY.md) and both commit hashes (014cadd6, 359a020c) verified present.
