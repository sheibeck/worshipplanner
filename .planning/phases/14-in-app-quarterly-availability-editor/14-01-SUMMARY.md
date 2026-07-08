---
phase: 14-in-app-quarterly-availability-editor
plan: 01
subsystem: scheduling
tags: [typescript, vitest, tdd, scheduler]

# Dependency graph
requires:
  - phase: 13-quarterly-roster-and-scheduling
    provides: PersonQuarterData shape, proposeQuarterSchedule two-pass fill-loop foundation
provides:
  - FrequencyTier type ('regular' | 'fillin' | 'out') exported from src/types/roster.ts
  - Optional frequencyTier/note fields on PersonQuarterData (quarter-scoped, default-safe)
  - Two-pass tier-aware fill in proposeQuarterSchedule (regular-first, fillin last-resort, out fully excluded)
  - propagatePairing 'out'-tier partner conflict reporting (reason: 'partner out this quarter')
affects: [14-02, 14-03, drawer, roster-table, gap-filling-grid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tierOf(personId) closure defaulting via ?? 'regular', mirroring existing isBlackedOut/partnersOf closures"
    - "Two-pass eligible(tier) candidate filter: regular pass first, fillin pass only if regular pass is empty"

key-files:
  created: []
  modified:
    - src/types/roster.ts
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts

key-decisions:
  - "frequencyTier/note added as OPTIONAL fields (not required) per plan's explicit executor decision, so all existing PersonQuarterData construction sites (quarters.ts, VolunteerCsvImportModal.vue, test factories) keep compiling untouched"
  - "fillin-tier candidates get deficit forced to 0 (frequencyTargetN is meaningless for them) and are tie-broken purely by (servedCount asc, name asc)"

patterns-established:
  - "Pattern: tierOf(personId) => pqdById.get(personId)?.frequencyTier ?? 'regular' — every future tier-consumer (drawer, roster table, gap-filling grid) should mirror this exact default-safe read pattern"

requirements-completed: [D-04, D-05]

# Metrics
duration: 20min
completed: 2026-07-08
---

# Phase 14 Plan 01: Frequency Tier Data Contract + Scheduler Two-Pass Fill Summary

**Two-pass tier-aware scheduler (regular-first, fillin last-resort, out fully excluded) built on a new optional `FrequencyTier` field on `PersonQuarterData`**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-08T11:26:00Z
- **Completed:** 2026-07-08T11:46:24Z
- **Tasks:** 2 completed (Task 2 was TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- `FrequencyTier` type (`'regular' | 'fillin' | 'out'`) exported and wired into `PersonQuarterData` as optional fields, keeping every existing construction site compiling untouched
- Scheduler now runs a two-pass candidate search per role/date: regular-tier candidates first, fillin-tier only as a last resort when zero regular candidates exist; `'out'`-tier people are excluded from both passes unconditionally
- `propagatePairing` now excludes `'out'`-tier partners from force-scheduling, recording a `pairingConflicts` entry with `reason: 'partner out this quarter'`
- Absent/missing `frequencyTier` data (pre-migration Phase 13 records) behaves identically to prior scheduler behavior — verified by a dedicated regression test

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FrequencyTier type + optional PersonQuarterData fields** - `6db38b9` (feat)
2. **Task 2: Two-pass tier-aware scheduler fill (RED)** - `3a81a78` (test)
3. **Task 2: Two-pass tier-aware scheduler fill (GREEN)** - `48e49fc` (feat)

**Plan metadata:** committed separately after this SUMMARY

_TDD gate sequence verified: `test(...)` commit (3a81a78) precedes `feat(...)` commit (48e49fc) in git log._

## Files Created/Modified
- `src/types/roster.ts` - Added `FrequencyTier` union type; added optional `frequencyTier`/`note` fields to `PersonQuarterData`
- `src/utils/scheduler.ts` - Added `tierOf(personId)` closure; refactored single-pass candidate loop into two-pass (regular→fillin) with `'out'` exclusion; extended `propagatePairing` with an `'out'`-tier partner conflict branch
- `src/utils/__tests__/scheduler.test.ts` - Added 5 new test cases (fillin preference, fillin last-resort, out-tier exclusion, out-tier pairing conflict, default-safety regression); extended `makePQD` factory to accept `frequencyTier`/`note` overrides

## Decisions Made
- Followed the plan's explicit "DECISION for the executor" to make `frequencyTier`/`note` OPTIONAL fields rather than required (as `14-PATTERNS.md`'s illustrative snippet showed) — this was necessary to avoid touching `quarters.ts`, `VolunteerCsvImportModal.vue`, or test factories in this plan, exactly as the plan intended.
- fillin-tier candidates' `deficit` is forced to `0` in the scoring step (their standing `frequencyTargetN` is meaningless when not `'regular'`), so ties among fillin candidates resolve via `(servedCount asc, name asc)` only, matching the plan's `<action>` spec exactly.

## Deviations from Plan

None — plan executed exactly as written. `tierOf` placement, two-pass loop shape, and `propagatePairing` extension all match the plan's `<action>` and the `14-PATTERNS.md`/`14-RESEARCH.md` worked examples verbatim.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `FrequencyTier` contract and `tierOf` read-pattern are now settled and ready for every downstream consumer (quarters store `setPersonAvailability`, `AvailabilityDrawer.vue`, `AvailabilityRosterTable.vue`, `QuarterGrid.vue`'s `availableUnassigned`) to build against without further scheduler changes.
- Full `scheduler.test.ts` suite (15 tests) and `npm run type-check` are both green with zero regressions to pre-existing behavior.
- No blockers for 14-02.

---
*Phase: 14-in-app-quarterly-availability-editor*
*Completed: 2026-07-08*
