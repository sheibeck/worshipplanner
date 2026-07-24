---
phase: 16-quarterly-schedule-share-link
plan: 11
subsystem: types
tags: [typescript, roster, scheduler, cleanup]

# Dependency graph
requires:
  - phase: 16-quarterly-schedule-share-link
    provides: roleFrequency reader migration (plans 16-04 scheduler, 16-05 drawer, 16-06 roster/table, 16-07 grid)
provides:
  - Cleaned Person/PersonQuarterData type model — roleFrequency is the sole frequency source
  - Zero remaining references to frequencyTargetN, roleFrequencies, roleTiers, frequencyTier anywhere in src/
affects: [phase-16-remaining-plans, any-future-work-touching-roster-types]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/types/roster.ts
    - src/components/QuarterGrid.vue
    - src/components/__tests__/AvailabilityDrawer.test.ts
    - src/components/__tests__/QuarterGrid.test.ts
    - src/stores/__tests__/quarters.test.ts
    - src/utils/__tests__/scheduler.test.ts
    - src/utils/__tests__/volunteerCsv.test.ts
    - src/views/__tests__/RosterView.test.ts

key-decisions:
  - "Also removed UpsertPersonInput.frequencyTargetN/roleFrequencies (not explicitly listed in the plan's four target fields) because they share the exact same names and the plan's own acceptance criteria demands a literal zero-count grep across all of src/. These two fields were already unused/dead (no writer set them; existing tests already asserted their absence on import output), so removing them carried zero behavior risk."
  - "Reworded surviving comments in roster.ts and QuarterGrid.vue that referenced the old field names by name, rather than just deleting the deprecated declarations, since the acceptance criteria's grep gate counts comment text as well as code."
  - "Removed redundant toHaveProperty('frequencyTargetN'/'roleFrequencies') negative-assertions in RosterView.test.ts and volunteerCsv.test.ts rather than renaming them — the existing toEqual/exact-key-set assertions in the same tests already fully pin the output shape, so no coverage was lost."

patterns-established: []

requirements-completed: [R-05]

# Metrics
duration: ~10min
completed: 2026-07-10
---

# Phase 16 Plan 11: Remove Deprecated Frequency Fields Summary

**Deleted the four deprecated standing/quarter frequency fields from `src/types/roster.ts` (plus the two dead `UpsertPersonInput` twins), leaving `PersonQuarterData.roleFrequency` as the single frequency source across the whole codebase, with a full green vue-tsc build and 682-test vitest suite.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments
- Removed `Person.frequencyTargetN`, `Person.roleFrequencies`, `PersonQuarterData.roleTiers`, `PersonQuarterData.frequencyTier` from `src/types/roster.ts`
- Removed the unused `UpsertPersonInput.frequencyTargetN`/`roleFrequencies` twins (dead fields, same names, needed for a true zero-reference grep gate)
- Updated all test fixtures/factories across 6 test files that previously constructed or asserted these fields
- Reworded stale comments (roster.ts, QuarterGrid.vue) that named the removed fields
- Confirmed zero literal references to `frequencyTargetN`, `roleFrequencies`, `roleTiers`, `frequencyTier` anywhere in `src/` via grep
- Full `vue-tsc --build --force` (clean cache) and full `vitest run` (33 files / 682 tests) both green

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove deprecated frequency fields with a zero-reference grep gate** - `6f3f4b7` (feat)

_Single-task plan — no plan metadata commit yet (see final commit)._

## Files Created/Modified
- `src/types/roster.ts` - Removed the four deprecated fields + dead UpsertPersonInput twins; reworded surviving comments
- `src/components/QuarterGrid.vue` - Reworded a comment that named the removed `frequencyTier` field
- `src/components/__tests__/AvailabilityDrawer.test.ts` - Dropped `frequencyTargetN` from two Person fixtures
- `src/components/__tests__/QuarterGrid.test.ts` - Dropped `frequencyTargetN` from three Person fixtures
- `src/stores/__tests__/quarters.test.ts` - Dropped `frequencyTargetN` from `makePerson` factory default and one override call
- `src/utils/__tests__/scheduler.test.ts` - Dropped `frequencyTargetN` from `makePerson` factory; reworded its doc comment
- `src/utils/__tests__/volunteerCsv.test.ts` - Dropped `frequencyTargetN` from `makePerson` factory; removed a redundant `roleFrequencies` negative assertion and reworded a test title
- `src/views/__tests__/RosterView.test.ts` - Removed redundant `frequencyTargetN`/`roleFrequencies` negative assertions (already covered by the adjacent exact-shape `toEqual`)

## Decisions Made
- Removed `UpsertPersonInput`'s two frequency fields even though the plan's `<interfaces>` section only listed four fields, because they share the exact literal names the acceptance criteria's grep gate checks for, and they were already dead/unused. Documented as an in-scope extension of the same cleanup, not a new architectural change.
- Reworded (rather than left untouched) all surviving prose comments that named the removed fields, since the acceptance criteria's grep pattern has no code-vs-comment distinction.
- Removed redundant negative property assertions in two test files instead of trying to preserve them under different names — the same tests already have exact-shape assertions (`toEqual` and `Object.keys` checks) that fully cover the intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical / scope-completion] Removed unused `UpsertPersonInput.frequencyTargetN`/`roleFrequencies` fields**
- **Found during:** Task 1 grep gate
- **Issue:** The plan named only 4 fields to remove, but `UpsertPersonInput` carried two more fields with the identical literal names. The plan's own acceptance criteria (`grep -rc "frequencyTargetN\|roleFrequencies\b\|roleTiers\|frequencyTier" src/` === 0, "no references anywhere, including types") could not be satisfied while these remained.
- **Fix:** Deleted both optional fields from `UpsertPersonInput` in `src/types/roster.ts`. Confirmed via grep that neither field was read/written anywhere in production code (`RosterImportModal.vue`, `stores/roster.ts`, `planningCenterApi.ts`) — existing tests already asserted CSV/PC-import output never carried these keys.
- **Files modified:** `src/types/roster.ts`
- **Verification:** Full grep across `src/` for the four (now six) field name patterns returns zero matches; full vue-tsc build and vitest suite green.
- **Committed in:** `6f3f4b7` (Task 1 commit)

**2. [Rule 1 - correctness of grep gate] Reworded stale comments naming the removed fields**
- **Found during:** Task 1 grep gate
- **Issue:** Several surviving doc comments in `roster.ts` and one in `QuarterGrid.vue` mentioned the old field names in prose (e.g., "replaces the old standing Person.roleFrequencies/frequencyTargetN..."), which the strict grep gate would still catch even after the fields themselves were deleted.
- **Fix:** Reworded each comment to describe the same behavior without naming the removed identifiers.
- **Files modified:** `src/types/roster.ts`, `src/components/QuarterGrid.vue`
- **Verification:** grep gate zero; comments still convey the same intent (D-04/D-05 rationale, defaulting behavior).
- **Committed in:** `6f3f4b7` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 scope-completion under Rule 2's spirit, 1 grep-gate correctness under Rule 1)
**Impact on plan:** Both were required to actually satisfy the plan's own stated acceptance criteria (a literal zero-reference grep gate). No architectural changes, no data-migration code added (D-04 respected — existing Firestore docs keep orphaned fields untouched).

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `roleFrequency` is now the single, unambiguous frequency source across the whole codebase — no remaining plans in this phase depend on the removed fields (all readers were repointed in 16-04/05/06/07 before this plan ran).
- Type model is clean for any future phase work touching `Person`/`PersonQuarterData`.

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*

## Self-Check: PASSED
- FOUND: .planning/phases/16-quarterly-schedule-share-link/16-11-SUMMARY.md
- FOUND: src/types/roster.ts
- FOUND: commit 6f3f4b7
