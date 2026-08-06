---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 03
subsystem: testing
tags: [csv-parsing, name-matching, vitest, pure-functions]

# Dependency graph
requires:
  - phase: 13-01
    provides: "Person/PersonQuarterData/Quarter types in src/types/roster.ts"
provides:
  - "parseVolunteerCsvRow — quarterly CSV row -> ParsedVolunteerRow, ';'-split multi-value cells (D-15)"
  - "frequencyLabelToN / nToFrequencyLabel — friendly label <-> 1-in-N integer mapping"
  - "expandBlackoutCell — blackout range expansion against a finite serviceDates list (D-17)"
  - "matchNameToPerson — normalize-both-sides exact name matching, never fuzzy (D-16)"
affects: [13-08-import-modal, 13-scheduler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure parsing module (no Firestore/Vue/PapaParse imports) mirroring mapRowToSong's defensive-header + warnings[] pattern from csvImport.ts"
    - "Normalize-both-sides string matching (trim + collapse whitespace + lowercase) rather than fuzzy/Levenshtein matching"

key-files:
  created:
    - src/utils/volunteerCsv.ts
    - src/utils/__tests__/volunteerCsv.test.ts
  modified: []

key-decisions:
  - "Unknown frequency labels default to N=4 (once a month) with a warning naming the fallback, matching CONTEXT.md Claude's Discretion guidance"
  - "nToFrequencyLabel returns a generic '1-in-N' string for values outside the three known round-trip labels (1, 2, 4), rather than throwing"
  - "matchNameToPerson includes inactive roster people in matching (returning volunteers); the caller (Plan 08 UI/store) decides eligibility filtering"

patterns-established:
  - "expandBlackoutCell iterates only the finite serviceDates list (never a raw day-by-day calendar walk) — a DoS mitigation pattern (T-13-03-01) reusable anywhere date-range expansion against a bounded date list is needed"

requirements-completed: [D-15, D-16, D-17]

# Metrics
duration: 5min
completed: 2026-07-07
---

# Phase 13 Plan 03: Volunteer CSV Parsing Layer Summary

**Pure TypeScript parsing/matching module for the quarterly volunteer CSV: `;`-split multi-value cells, blackout-range expansion against generated Sundays, frequency label mapping, and normalize-both-sides exact name matching — 18 passing vitest cases, zero Firestore/Vue/PapaParse coupling.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-07T17:15:00-04:00
- **Completed:** 2026-07-07T17:20:44-04:00
- **Tasks:** 2 completed (both TDD: RED then GREEN)
- **Files modified:** 2

## Accomplishments
- `parseVolunteerCsvRow` parses a quarterly CSV row into a structured `ParsedVolunteerRow`, splitting Roles/Blackout Dates/Serve-With on `;` (not `,`), with warnings for missing name and unrecognized frequency
- `frequencyLabelToN` / `nToFrequencyLabel` map friendly labels (weekly, twice a month, once a month) to/from 1-in-N integers, plus bare-integer and `"1-in-N"` string parsing
- `expandBlackoutCell` expands `a..b` ranges and single dates against a finite `serviceDates` list, inclusive endpoints, de-duplicated ascending output, silently dropping out-of-quarter dates (T-13-03-01 DoS mitigation — no unbounded day-by-day walk)
- `matchNameToPerson` normalizes both the CSV name and every roster person's name (trim, collapse internal whitespace, lowercase) before comparing, classifying each row as `matched` / `ambiguous` (2+ candidates) / `unmatched` — never fuzzy-matching beyond that (D-16, T-13-03-02, Pitfall 4)

## Task Commits

Each task followed RED -> GREEN as two commits:

1. **Task 1: RED+GREEN — row parsing + frequency mapping + blackout expansion**
   - `74178ca` test(13-03): add failing tests for volunteer CSV row/frequency/blackout parsing
   - `13643e0` feat(13-03): implement volunteer CSV row parsing, frequency mapping, blackout expansion
2. **Task 2: RED+GREEN — normalize-both-sides name matching**
   - `436d49d` test(13-03): add failing tests for normalize-both-sides name matching
   - `2cc8d9a` feat(13-03): implement normalize-both-sides name matching

_Both TDD tasks confirmed RED (test run failing before implementation existed) before writing implementation code._

## Files Created/Modified
- `src/utils/volunteerCsv.ts` - Pure parsing/matching functions: `parseVolunteerCsvRow`, `frequencyLabelToN`, `nToFrequencyLabel`, `expandBlackoutCell`, `matchNameToPerson`, plus `ParsedVolunteerRow`/`NameMatchStatus`/`NameMatchResult` types
- `src/utils/__tests__/volunteerCsv.test.ts` - 18 vitest cases covering all behavior bullets from the plan (parse, frequency mapping, blackout expansion, name matching incl. whitespace/case variants, ambiguous, unmatched, inactive-inclusion, no-mutation/determinism)

## Decisions Made
- Unknown frequency labels default to N=4 with a warning naming the fallback (per CONTEXT.md Claude's Discretion)
- `nToFrequencyLabel` falls back to a generic `1-in-N` string for values outside {1,2,4} rather than throwing, keeping the function total
- `matchNameToPerson` includes inactive people in the match set — filtering by active status is left to the caller (Plan 08), since a returning/reactivated volunteer should still be matchable

## Deviations from Plan

None - plan executed exactly as written. All behavior bullets, acceptance criteria greps, and threat-model mitigations (T-13-03-01 through T-13-03-03) were satisfied directly by the planned implementation with no additional fixes needed.

## Issues Encountered

None. Both TDD cycles went RED -> GREEN cleanly on first implementation attempt; `vue-tsc --build` was clean with no additional type fixes required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/utils/volunteerCsv.ts` is ready to be consumed as a thin-shell dependency by the Plan 08 import modal (PapaParse invocation + preview/reconciliation UI live there, not in this pure module)
- `matchNameToPerson`'s `NameMatchResult` shape (matched/ambiguous/unmatched + candidates) is the exact contract the Plan 08 preview table needs for per-row reconciliation UI
- No blockers for downstream plans; all three requirements (D-15, D-16, D-17) fully covered by tests

---
*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/utils/volunteerCsv.ts
- FOUND: src/utils/__tests__/volunteerCsv.test.ts
- FOUND: .planning/phases/13-volunteer-scheduling-import-servers-from-planning-center-col/13-03-SUMMARY.md
- FOUND commit: 74178ca (test - RED task 1)
- FOUND commit: 13643e0 (feat - GREEN task 1)
- FOUND commit: 436d49d (test - RED task 2)
- FOUND commit: 2cc8d9a (feat - GREEN task 2)
