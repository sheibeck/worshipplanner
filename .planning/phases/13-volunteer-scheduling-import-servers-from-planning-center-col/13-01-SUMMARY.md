---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 01
subsystem: types
tags: [typescript, firestore, vitest, tdd, date-math]

# Dependency graph
requires: []
provides:
  - "src/types/roster.ts — the shared roster type contract (Person, Role, RoleGroup, RoleSlotConfig, PersonQuarterData, Quarter, QuarterCalendar, ProposeResult, UpsertPersonInput, DEFAULT_ROLES)"
  - "src/utils/quarterDates.ts — pure generateSundaysInQuarter + applyDateAdditionsRemovals functions"
  - "PROJECT.md scope reversal (musician/volunteer scheduling now in-app)"
affects: [13-02, 13-03, 13-04, 13-05, 13-06, 13-07, 13-08, 13-09, 13-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standing vs quarter-scoped data split: Person.roles/frequencyTargetN are standing (upserted on re-import); PersonQuarterData.blackoutDates/pairedWith are quarter-scoped (fully replaced per quarter, per D-18/D-19)"
    - "Pure date-math utilities with local fmtDate helper mirroring planningCenterApi.ts's zero-padded date formatting for lexicographic-equals-chronological ordering"

key-files:
  created:
    - src/types/roster.ts
    - src/utils/quarterDates.ts
    - src/utils/__tests__/quarterDates.test.ts
  modified:
    - .planning/PROJECT.md

key-decisions:
  - "Reworded the DEFAULT_ROLES doc comment to avoid the literal string \"worship leader\" (used \"Leaders self-assign and are intentionally excluded (D-05)\" instead) so the file satisfies both the interfaces-block content requirement and the acceptance-criteria grep check for zero occurrences of that phrase"

patterns-established:
  - "Type-only contract files (roster.ts) contain zero functions/Firestore calls/Vue imports — downstream plans import types only"
  - "TDD pure-function utils: write test first (RED), confirm failure via missing-module error, then implement to green"

requirements-completed: [D-01, D-03, D-05, D-06, D-18]

# Metrics
duration: 5min
completed: 2026-07-07
---

# Phase 13 Plan 01: Roster Type Contract & Quarter Date Generator Summary

**Established the shared Person/Role/Quarter/PersonQuarterData type contract (with standing-vs-quarter-scoped field split) and a pure, TDD-tested Sunday-date generator for the volunteer-scheduling phase.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-07T17:02:00-04:00
- **Completed:** 2026-07-07T17:06:20-04:00
- **Tasks:** 3 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `src/types/roster.ts` defines the full type contract (10 named exports) that every downstream Plan 13-02 through 13-10 will import
- `src/utils/quarterDates.ts` is a pure, dependency-free date generator with 8 passing Vitest assertions (TDD RED → GREEN)
- `PROJECT.md` "Out of Scope" musician-scheduling bullet reversed to reflect Phase 13 bringing volunteer scheduling in-app

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the roster type contract** - `9e3dcad` (feat)
2. **Task 2: Quarter Sunday generation (pure, TDD)** - `fd409f4` (test, RED) → `c28ad38` (feat, GREEN)
3. **Task 3: Reverse the PROJECT.md musician-scheduling out-of-scope line** - `a9f6ece` (docs)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/types/roster.ts` - RoleGroup, Role, Person, RoleSlotConfig, PersonQuarterData, QuarterCalendar, Quarter, ProposeResult, UpsertPersonInput types + DEFAULT_ROLES seed (8 roles, no worship-leader entry)
- `src/utils/quarterDates.ts` - generateSundaysInQuarter(year, quarter) and applyDateAdditionsRemovals(dates, changes) pure functions
- `src/utils/__tests__/quarterDates.test.ts` - 8 assertions covering Q3 2026 full-quarter generation, Q1 boundary, zero-padded Sunday validation, ascending order, add/remove/dedupe behavior
- `.planning/PROJECT.md` - Out of Scope bullet reversed: musician scheduling now in-scope as of Phase 13

## Decisions Made
- Reworded the DEFAULT_ROLES doc comment from `NO "worship leader" role (D-05...)` to `Leaders self-assign and are intentionally excluded (D-05)` — the plan's literal interfaces-block text contained the phrase "worship leader" in a comment, which would fail the acceptance criterion's literal `grep -c "worship leader" == 0` check on the whole file. Rewording preserves the D-05 intent (no worship-leader role in DEFAULT_ROLES) while satisfying the automated check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance-criteria/interfaces-block phrasing conflict**
- **Found during:** Task 1 (Define the roster type contract)
- **Issue:** The plan's own interfaces block specified a doc comment containing the literal phrase "worship leader" (`// D-03 default role list, grouped. Note: NO "worship leader" role (D-05...)`), but the acceptance criteria required `grep -c "worship leader" src/types/roster.ts == 0`. Copying the interfaces block verbatim would fail that literal grep check.
- **Fix:** Reworded the comment to convey the same D-05 intent without using the literal phrase "worship leader" (now reads "Leaders self-assign and are intentionally excluded (D-05)").
- **Files modified:** src/types/roster.ts
- **Verification:** `grep -c "worship leader" src/types/roster.ts` returns 0; DEFAULT_ROLES still has 8 entries, none named "worship leader"; `npx vue-tsc --build` reports no errors in roster.ts
- **Committed in:** 9e3dcad (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/wording conflict)
**Impact on plan:** No scope creep — purely a wording fix to satisfy the plan's own literal acceptance check while preserving its stated intent.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/types/roster.ts` and `src/utils/quarterDates.ts` are ready for Plans 02-10 to import via `@/types/roster` and `@/utils/quarterDates`
- No blockers for downstream plans (scheduler, CSV parser, stores, views)

---
*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Completed: 2026-07-07*
