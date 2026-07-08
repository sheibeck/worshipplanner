---
phase: 14-in-app-quarterly-availability-editor
plan: 03
subsystem: database
tags: [pinia, firestore, tdd, quarters-store, availability]

# Dependency graph
requires:
  - phase: 14-in-app-quarterly-availability-editor
    provides: "Plan 14-01's FrequencyTier type and PersonQuarterData shape (blackoutDates/pairedWith/frequencyTier/note)"
provides:
  - "setPersonAvailability(quarterId, personId, {blackoutDates, pairedWith, frequencyTier, note}) store action with symmetric bidirectional pairing sync"
affects: [14-in-app-quarterly-availability-editor availability drawer plan(s) consuming this store action]

# Tech tracking
tech-stack:
  added: []
  patterns: [scoped Firestore dot-path updates for single-person quarter data + partner pairedWith reciprocal sync]

key-files:
  created: []
  modified:
    - src/stores/quarters.ts
    - src/stores/__tests__/quarters.test.ts

key-decisions:
  - "Own person's entry is written as one whole nested object (personQuarterData.{personId}) since only one leader edits one person's drawer at a time — no concurrent-edit risk unlike the whole-map write."
  - "Partner reciprocal changes use narrower dot-paths: a brand-new partner gets a whole seeded object (personQuarterData.{partnerId}), while an existing partner losing the pairing gets only personQuarterData.{partnerId}.pairedWith touched — never their blackoutDates/frequencyTier/note."

patterns-established:
  - "Symmetric added/removed diff against the previous pairedWith array to support explicit un-pairing (contrasts with applyCsvToQuarter's add-only merge, which has no removal path)."

requirements-completed: [D-03, D-05, D-06]

# Metrics
duration: 15min
completed: 2026-07-08
---

# Phase 14 Plan 03: setPersonAvailability Store Action Summary

**Added `setPersonAvailability` to the quarters Pinia store, performing a symmetric add+remove bidirectional pairing sync via scoped Firestore dot-path writes so a single person's drawer save never clobbers concurrent edits to others' quarter data.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-08T11:42:00Z
- **Completed:** 2026-07-08T11:57:17Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- `setPersonAvailability(quarterId, personId, data)` action writes the editing person's own quarter-scoped fields (blackoutDates, pairedWith, frequencyTier, note) as one nested object under `personQuarterData.{personId}`
- Computes `added`/`removed` partner diffs against the *previous* `pairedWith` value: newly added partners get a whole seeded reciprocal entry, dropped partners get only their `.pairedWith` dot-path stripped of this person's id
- No write ever touches the bare `personQuarterData` map key — confirmed by a dedicated regression test and a source grep in acceptance criteria
- Registered on the store's returned object next to `applyCsvToQuarter`

## Task Commits

TDD gate sequence, both commits present in git log:

1. **Task 1 RED: failing setPersonAvailability tests** - `e8d802f` (test) — added own-entry, reciprocal-add, reciprocal-remove, and no-bare-map-key test cases against the mocked `updateDoc`; confirmed failing (`store.setPersonAvailability is not a function`) before implementation existed
2. **Task 1 GREEN: setPersonAvailability implementation** - `49aa36d` (feat) — added the action + store registration; full `quarters.test.ts` suite (26 tests) passes

**Plan metadata:** committed as part of this SUMMARY (no separate metadata commit — worktree mode, orchestrator handles final STATE/ROADMAP updates)

_TDD gate compliance confirmed: `test(...)` commit precedes `feat(...)` commit; no refactor commit needed (implementation matched the researched pattern with no cleanup required)._

## Files Created/Modified
- `src/stores/quarters.ts` - Added `setPersonAvailability` action (imports `FrequencyTier` from `@/types/roster`) and registered it in the store's returned object
- `src/stores/__tests__/quarters.test.ts` - Added `describe('setPersonAvailability (D-03, D-05, D-06)', ...)` with 4 test cases: own-entry write, reciprocal add, reciprocal remove, no-bare-map-key scoping

## Decisions Made
- Followed the exact implementation shape from `14-RESEARCH.md` Pattern 3 (whole-object own-entry write + scoped dot-path partner writes) — no deviation from the researched pattern was needed.
- Test for "reciprocal remove" additionally asserts `personQuarterData.lisa` (the whole-object key) is `undefined` when only the `.pairedWith` dot-path should be touched, tightening the scoping guarantee beyond the plan's literal wording.

## Deviations from Plan

None — plan executed exactly as written. The implementation matches 14-RESEARCH.md Pattern 3 verbatim (adapted only to read `quarter.personQuarterData[personId]?.pairedWith` via the already-fetched `quarter` object, consistent with `getQuarter`'s existing usage elsewhere in the file).

## Issues Encountered

None. To honor the TDD RED/GREEN gate honestly (the action was drafted once, read/verified, then temporarily removed to prove RED), the function and its store registration were briefly reverted via Edit, the test suite was run to confirm the 4 new tests failed with `store.setPersonAvailability is not a function`, the RED commit was made, then the implementation was restored and the GREEN commit followed once all 26 tests (existing 22 + new 4) passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The availability drawer plan (this phase's UI-facing plan) can now call `store.setPersonAvailability(quarterId, personId, {...})` directly on Save.
- `npm run type-check` passes with no new errors; no bare `personQuarterData` map write exists anywhere in `quarters.ts`.

---
*Phase: 14-in-app-quarterly-availability-editor*
*Completed: 2026-07-08*

## Self-Check: PASSED
- FOUND: src/stores/quarters.ts
- FOUND: src/stores/__tests__/quarters.test.ts
- FOUND: .planning/phases/14-in-app-quarterly-availability-editor/14-03-SUMMARY.md
- FOUND commit: e8d802f (test RED)
- FOUND commit: 49aa36d (feat GREEN)
- FOUND commit: bbd4021 (docs SUMMARY)
