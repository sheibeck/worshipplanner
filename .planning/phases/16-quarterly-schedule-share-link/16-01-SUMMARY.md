---
phase: 16-quarterly-schedule-share-link
plan: 01
subsystem: database
tags: [vue3, pinia, firestore, typescript, roster, scheduling]

# Dependency graph
requires:
  - phase: 15-per-role-frequency-and-vocal-instrument-pairing
    provides: PersonQuarterData.roleTiers/frequencyTier per-role tier split and Person.roleFrequencies/frequencyTargetN standing frequency fields this plan relocates
provides:
  - "PersonQuarterData.roleFrequency: Record<roleId, {tier, n}> — single quarter-scoped source of truth for per-role serve frequency (D-04/D-05)"
  - "createQuarter D-06 seeding: new quarters inherit per-role frequency + pairings from the chronologically prior quarter, always reset blackout"
  - "setPersonAvailability writes roleFrequency via scoped dot-path (no more frequencyTier/roleTiers params)"
  - "applyCsvToQuarter persists CSV Frequency column as per-role quarter-scoped roleFrequency (no standing frequency write)"
  - "Deprecated (not yet removed) Person.frequencyTargetN/roleFrequencies, PersonQuarterData.roleTiers/frequencyTier — @deprecated JSDoc, removed in plan 16-11"
affects: [16-04-availability-drawer-frequency-ui, 16-05, 16-06, 16-07, 16-11-remove-deprecated-frequency-fields]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quarter-scoped single-field frequency model: RoleFrequencyEntry {tier, n} replaces two parallel maps (roleTiers + roleFrequencies)"
    - "D-06 new-quarter seeding via quarterKey/findPriorQuarter pure helpers, applied only at quarter-creation time (never on ongoing scoped writes)"

key-files:
  created: []
  modified:
    - src/types/roster.ts
    - src/stores/quarters.ts
    - src/stores/__tests__/quarters.test.ts
    - src/utils/volunteerCsv.ts
    - src/utils/__tests__/volunteerCsv.test.ts
    - src/components/VolunteerCsvImportModal.vue
    - src/components/AvailabilityDrawer.vue
    - src/components/__tests__/AvailabilityDrawer.test.ts

key-decisions:
  - "Person.frequencyTargetN kept required (not optional) despite being deprecated — making it optional broke every existing reader (AvailabilityRosterTable, RosterView, scheduler.ts) that assumes a definite number; deprecation-in-place without an optionality change keeps the build green until Wave-2 plans repoint those readers"
  - "AvailabilityDrawer.vue (out of this plan's file scope, targeted by Wave-2 plan 16-04) patched with a minimal compile-safe shim mapping its existing per-role tier UI (draft.roleTiers) to roleFrequency with n defaulted to 4, since the setPersonAvailability signature change broke its call site — full per-role N editing UI is 16-04's job"

patterns-established:
  - "roleFrequency default-when-absent is always { tier: 'regular', n: 4 } — matches DEFAULT_ROLES/D-06 once-a-month default"

requirements-completed: [R-05, R-06, R-12]

# Metrics
duration: 13min
completed: 2026-07-10
---

# Phase 16 Plan 01: Relocate Per-Role Frequency to Quarter Scope Summary

**Added `PersonQuarterData.roleFrequency` as the single quarter-scoped per-role cadence field, wired createQuarter's D-06 prior-quarter seeding, and repointed the CSV volunteer-import pipeline to write per-role frequency onto the quarter instead of a standing field.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-10T05:36:00Z
- **Completed:** 2026-07-10T05:49:33Z
- **Tasks:** 3
- **Files modified:** 8 (6 planned + 2 deviation fixes)

## Accomplishments
- `RoleFrequencyEntry { tier, n }` + `PersonQuarterData.roleFrequency?: Record<roleId, RoleFrequencyEntry>` added; legacy `Person.frequencyTargetN`/`roleFrequencies` and `PersonQuarterData.roleTiers`/`frequencyTier` marked `@deprecated` but left in place (removed in plan 16-11)
- `createQuarter` now seeds every `(person, role)` pair from the chronologically nearest prior quarter (frequency + pairing), defaulting to `{tier: 'regular', n: 4}` when absent, and always resets `blackoutDates: []` (D-06)
- `setPersonAvailability` writes `roleFrequency` through the existing scoped dot-path convention; the brand-new-partner seed block writes `roleFrequency: {}` instead of `frequencyTier: 'regular'`
- `applyCsvToQuarter` persists the CSV `Frequency` column as per-role `roleFrequency` on the quarter entry — no more standing `frequencyTargetN` write via `rosterStore.updatePerson`
- CSV parser (`volunteerCsv.ts`) and `VolunteerCsvImportModal.vue` renamed `frequencyTargetN` → `frequencyN` throughout the parse/preview/commit pipeline; the Frequency preview column is unchanged for users

## Task Commits

Each task was committed atomically:

1. **Task 1: Add roleFrequency to the type model, deprecate the old frequency fields** - `d6a53fb` (feat)
2. **Task 2: Write roleFrequency in setPersonAvailability, createQuarter seeding (D-06), and applyCsvToQuarter** - `5e669de` (feat)
3. **Task 3: Repoint the CSV volunteer-import parser + modal to roleFrequency** - `2d40e87` (feat)

_TDD tasks: verification for all three tasks was type-check (`vue-tsc --build`) + `vitest run` on the affected test files rather than a separate RED/GREEN test-file cycle, since Task 1 has no dedicated test file target and Tasks 2/3 modify existing test suites in lockstep with their store/util changes (per the plan's own `<action>` instructions)._

## Files Created/Modified
- `src/types/roster.ts` - `RoleFrequencyEntry` interface + `PersonQuarterData.roleFrequency`; `@deprecated` JSDoc on the four legacy frequency fields
- `src/stores/quarters.ts` - `quarterKey`/`findPriorQuarter` helpers; `createQuarter` D-06 seeding; `setPersonAvailability` signature repoint; `applyCsvToQuarter` roleFrequency write; `ResolvedCsvPerson` gains `roleFrequency`, drops `standing.frequencyTargetN`
- `src/stores/__tests__/quarters.test.ts` - repointed `setPersonAvailability`/`applyCsvToQuarter` assertions to `roleFrequency`; added D-06 seeding coverage (no-prior default, prior-quarter carry-forward, nearest-prior selection)
- `src/utils/volunteerCsv.ts` - `ParsedVolunteerRow.frequencyTargetN` → `frequencyN`
- `src/utils/__tests__/volunteerCsv.test.ts` - renamed CSV-field assertions to `frequencyN`
- `src/components/VolunteerCsvImportModal.vue` - `PreviewRow.frequencyTargetN` → `frequencyN`; `onCommit` builds per-role `roleFrequency` map and pushes it onto `ResolvedCsvPerson`
- `src/components/AvailabilityDrawer.vue` *(deviation, out of plan scope)* - minimal shim converting `draft.roleTiers` to `roleFrequency` (n defaulted to 4) so its `setPersonAvailability` call compiles; full per-role N editing UI is plan 16-04
- `src/components/__tests__/AvailabilityDrawer.test.ts` *(deviation, out of plan scope)* - updated one assertion to match the new `roleFrequency` call shape

## Decisions Made
- Kept `Person.frequencyTargetN` required (not optional) even though deprecated — optionality change broke multiple readers outside this plan's scope; deprecation is JSDoc-only until those readers are repointed in Wave 2
- `setPersonAvailability`'s new `roleFrequency` parameter is required (not optional), replacing the previously-required `frequencyTier` + optional `roleTiers` pair with one required field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AvailabilityDrawer.vue broke type-check after setPersonAvailability signature change**
- **Found during:** Task 2 (setPersonAvailability repoint)
- **Issue:** `AvailabilityDrawer.vue` (not in this plan's `files_modified` list — targeted by Wave-2 plan 16-04 per RESEARCH.md) calls `quartersStore.setPersonAvailability` with the old `frequencyTier`/`roleTiers` shape, which no longer compiles after Task 2's signature change
- **Fix:** Added a minimal compile-safe shim in `onSave()` that converts the existing `draft.roleTiers` (tier only) into `roleFrequency` with `n` defaulted to 4, preserving current UI behavior; updated the corresponding `AvailabilityDrawer.test.ts` assertion to the new shape
- **Files modified:** `src/components/AvailabilityDrawer.vue`, `src/components/__tests__/AvailabilityDrawer.test.ts`
- **Verification:** `npx vue-tsc --build` exits 0; `AvailabilityDrawer.test.ts` (4 tests) passes
- **Committed in:** `5e669de` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the build green per the plan's own verification requirement ("`npx vue-tsc --build` green after all tasks"). No scope creep — the shim is explicitly temporary and documented for plan 16-04 to replace with real per-role N editing.

## Issues Encountered
- Making `Person.frequencyTargetN` optional (as an initial literal reading of "keep them optional" in Task 1's action text) broke type-check in `AvailabilityRosterTable.vue`, `scheduler.ts`, and `RosterView.vue`. Resolved by keeping the field required — "optional" in the plan's intent refers to fields that were already optional (`Person.roleFrequencies`, `PersonQuarterData.roleTiers`/`frequencyTier`), not a new optionality change to `frequencyTargetN`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `PersonQuarterData.roleFrequency` is now the single quarter-scoped frequency source; Wave-2 plans (16-04 through 16-07) can repoint their readers (scheduler.ts, AvailabilityRosterTable.vue, QuarterGrid.vue, RosterView.vue, roster.ts store) one file at a time, per RESEARCH.md's file list
- `AvailabilityDrawer.vue`'s temporary shim (n always 4) needs replacement in plan 16-04 with real per-role N editing UI
- Legacy fields (`Person.frequencyTargetN`/`roleFrequencies`, `PersonQuarterData.roleTiers`/`frequencyTier`) remain present and `@deprecated` — plan 16-11 removes them once all readers are repointed
- No data migration was performed (D-04 explicitly authorizes losing standing-frequency data — feature not yet live)

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files verified present; all four task commits (`d6a53fb`, `5e669de`, `2d40e87`) and the metadata commit (`bf45ac9`) verified present in git log.
