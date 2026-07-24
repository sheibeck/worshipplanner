---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 02
subsystem: scheduling
tags: [typescript, pure-function, vitest, tdd, greedy-algorithm, deterministic]

# Dependency graph
requires:
  - phase: 13-01
    provides: "src/types/roster.ts type contract (Person, RoleSlotConfig, PersonQuarterData, QuarterCalendar, ProposeResult)"
provides:
  - "proposeQuarterSchedule pure function — deterministic greedy weighted-fair-share quarterly scheduler"
  - "Comprehensive constraint test suite covering D-02,04,06,07,08,09,10,11,12"
affects: [13-06-quarters-store, 13-09-schedule-grid-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pure-function scheduler with injected resolveRolesForDate callback (mirrors suggestions.ts injectable-nowMs pattern)"]

key-files:
  created:
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts
  modified: []

key-decisions:
  - "Lifted the RESEARCH.md reference algorithm (lines 375-489) verbatim — no deviation from the specified deficit formula, sort tie-break, or pairing-propagation recursion"
  - "Reworded the pure-function doc comment to avoid literal 'Firestore/Vue/Date.now/Math.random' substrings so the acceptance-criteria grep check (grep -c == 0) passes cleanly against the file"

patterns-established:
  - "Pure scheduling function pattern: inject all external inputs (people, dates, role resolver, quarter data, optional existing calendar) — zero I/O, fully unit-testable, same pattern as suggestions.ts"

requirements-completed: [D-02, D-04, D-06, D-07, D-08, D-09, D-10, D-11, D-12]

# Metrics
duration: 8min
completed: 2026-07-07
---

# Phase 13 Plan 02: Quarterly Scheduler Core Summary

**Deterministic greedy weighted-fair-share `proposeQuarterSchedule` function with hard blackout/pairing constraints, unfilled-slot reporting, and pairing-conflict reporting — fully covered by a 10-test TDD suite.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-07T17:12:28-04:00
- **Completed:** 2026-07-07T17:18:29-04:00
- **Tasks:** 2 (RED, GREEN)
- **Files modified:** 2

## Accomplishments
- Wrote a 10-test constraint suite (`scheduler.test.ts`) pinning every D-02/04/06-12 behavior: blackout, multi-fill, deficit ranking, deficit tie-break determinism, unfilled reporting, pairing propagation, pairing conflict, per-date role override, no-back-to-back suppression, and fill-gaps seeding
- Implemented `proposeQuarterSchedule` in `src/utils/scheduler.ts`: chronological outer loop over service dates, role-order inner loop, slot-count innermost loop; deficit-based candidate scoring with deterministic sort; recursive pairing propagation with cycle-safe `visited` set; unfilled/pairingConflicts arrays instead of fabricated assignments
- Verified purity and determinism: zero `Math.random`, zero Firestore/Vue/`Date.now` references, `vue-tsc --build` clean, and repeated test runs produce identical results

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — write the failing scheduler constraint suite** - `394f846` (test)
2. **Task 2: GREEN — implement proposeQuarterSchedule to pass the suite** - `2ef72d6` (feat)

_Note: No separate refactor commit was needed — the reference algorithm from RESEARCH.md was lifted directly and passed all 10 tests on the first implementation pass; only a doc-comment wording tweak was needed afterward (folded into the feat commit before it was staged)._

## Files Created/Modified
- `src/utils/scheduler.ts` - `proposeQuarterSchedule` pure function: deficit-based greedy fill, hard blackout/pairing constraints, unfilled + pairingConflicts reporting, existingCalendar fill-gaps seeding
- `src/utils/__tests__/scheduler.test.ts` - 10-test Vitest suite covering all constraint behaviors with factory helpers (`makePerson`, `makePQD`, `makeResolver`)

## Decisions Made
- Lifted the RESEARCH.md reference algorithm verbatim (deficit formula `(dateIndex+1)/frequencyTargetN - served`, three-key deterministic sort, recursive `propagatePairing` with `visited` set, pairing overflow-first-eligible-role fallback per Pitfall 1) — no design changes were needed
- Reworded the file's top-of-function doc comment (originally literally said "no Firestore, no Vue, no Date.now(), no Math.random()") to avoid matching the acceptance-criteria's literal grep patterns for those same terms, replacing with equivalent non-matching phrasing ("no database reads/writes, no framework imports, no wall-clock reads, no non-deterministic randomness") — this is the same class of fix used in Plan 01 (DEFAULT_ROLES comment reworded to avoid a literal-phrase grep collision)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comment literally matched the acceptance-criteria's negative grep check**
- **Found during:** Task 2 (GREEN implementation), post-implementation self-verification of acceptance criteria
- **Issue:** The doc comment above `proposeQuarterSchedule` stated "Pure function: no Firestore, no Vue, no Date.now(), no Math.random()" — these are the exact substrings the acceptance criteria greps for (`grep -c "Math.random"` and `grep -ci "firebase\|firestore\|from 'vue'\|Date.now"` must both be 0), so the comment itself caused both checks to report a false-positive match (count 1 instead of 0) even though no actual usage existed.
- **Fix:** Reworded the comment to describe the same purity guarantees without using the literal matched substrings.
- **Files modified:** src/utils/scheduler.ts
- **Verification:** Re-ran `grep -c "Math.random" src/utils/scheduler.ts` (0) and `grep -ci "firebase\|firestore\|from 'vue'\|Date.now" src/utils/scheduler.ts` (0); re-ran full test suite (still 10/10 green) and `vue-tsc --build` (clean) after the edit.
- **Committed in:** `2ef72d6` (part of Task 2 commit — comment fix applied before staging/committing)

---

**Total deviations:** 1 auto-fixed (1 bug — grep-collision in doc comment)
**Impact on plan:** Cosmetic-only fix to a comment; no behavior change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `proposeQuarterSchedule` is ready for the quarters store (Plan 06) to call and persist results into `Quarter.calendar`
- The schedule grid UI (Plan 09) can render `unfilled` and `pairingConflicts` as distinct visual flags per the RESEARCH.md Open Question 2 resolution
- No blockers

---
*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/utils/scheduler.ts
- FOUND: src/utils/__tests__/scheduler.test.ts
- FOUND commit: 394f846 (test)
- FOUND commit: 2ef72d6 (feat)
