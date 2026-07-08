---
phase: 14-in-app-quarterly-availability-editor
plan: 02
subsystem: api
tags: [planning-center, pagination, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 08-planning-center-export
    provides: basicAuthHeader + PC_BASE_URL proxy pattern, PC pagination/429-retry convention (fetchAllPeople)
  - phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
    provides: fetchTeamPositions (team-scoped positions list) that supplies selectedPositionIds upstream
provides:
  - "fetchPeopleForTeamPositions(appId, secret, teamId, selectedPositionIds) — scoped Planning Center fetch returning distinct people currently serving the caller's selected team positions"
affects: [14-04 (selective import modal wiring), any future PC-scoped-fetch work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "include=person on person_team_position_assignments to avoid N+1 per-person fetch"
    - "Map<pcPersonId, name> for O(1) dedupe across paginated assignment pages"

key-files:
  created: []
  modified:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts

key-decisions:
  - "fetchPeopleForTeamPositions throws on non-ok (unlike fetchTeamPositions' silent []) — selective import must surface fetch failures rather than silently returning zero people"
  - "Emails intentionally NOT fetched here — deferred to Plan 04's concern per plan's explicit scope boundary"

patterns-established:
  - "Team-scoped person_team_position_assignments?include=person endpoint for 'who currently serves this position' lookups (D-10) — reuse this over the service_type-scoped sibling"

requirements-completed: [D-08, D-09, D-10]

# Metrics
duration: ~12min
completed: 2026-07-08
---

# Phase 14 Plan 02: Selective Planning Center Fetch Summary

**Added `fetchPeopleForTeamPositions` — a team-scoped, position-filtered, deduped, paginated Planning Center fetch that powers selective import (D-08/D-09/D-10), replacing the whole-church `fetchAndMapPeople` pull for this use case.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 2

## Accomplishments
- `fetchPeopleForTeamPositions(appId, secret, teamId, selectedPositionIds)` exported from `src/utils/planningCenterApi.ts`, using the team-scoped `/teams/{teamId}/person_team_position_assignments?include=person&per_page=100` endpoint (NOT the service_type-scoped sibling, per RESEARCH.md Pitfall 4)
- Filters assignments to only those whose `team_position.data.id` is in the caller's `selectedPositionIds` Set — choir/orchestra positions excluded simply by never being selected (D-09)
- Dedupes people serving multiple selected positions via a `Map<pcPersonId, name>` keyed by person id
- Paginates via `links.next`, rewriting the absolute PC host to the local proxy path, with a 429/`Retry-After` retry loop copied from `fetchAllPeople`
- Three new test cases (filter+dedupe+pagination, 429 retry, non-ok throw) — full `planningCenterApi.test.ts` suite (97 tests) and `vue-tsc --build` both green

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1 RED: failing test for fetchPeopleForTeamPositions** - `c2a034e` (test)
2. **Task 1 GREEN: implement fetchPeopleForTeamPositions** - `ed4483e` (feat)

_No REFACTOR commit needed — implementation was clean on first pass, matching the RESEARCH.md worked example plus the plan's 429-retry requirement._

## Files Created/Modified
- `src/utils/planningCenterApi.ts` - Added `fetchPeopleForTeamPositions` (+ private `PcAssignment`/`PcIncludedPerson` interfaces) after `fetchAllPeople`
- `src/utils/__tests__/planningCenterApi.test.ts` - Added `describe('fetchPeopleForTeamPositions', ...)` with 3 test cases; added the function to the top-of-file import list

## Decisions Made
- Function throws `Error('Failed to fetch team position assignments: ' + status)` on non-ok responses (per plan's explicit GREEN instruction), unlike the existing `fetchTeamPositions` which silently returns `[]` — selective import needs the caller (Plan 04) to be able to distinguish "no positions configured" from "the fetch actually failed"
- Emails are NOT fetched by this function — plan explicitly scoped that to Plan 04's concern; `PersonTeamPositionAssignment`'s `include=person` doesn't carry nested Email resources anyway (confirmed in RESEARCH.md)

## Deviations from Plan

None - plan executed exactly as written. The RESEARCH.md Pattern 4 worked example was used as the base implementation, with the 429/`Retry-After` retry loop added per the plan's GREEN action (RESEARCH.md's example omitted the retry loop; the plan's `<action>` text explicitly required copying it from `fetchAllPeople`).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Reuses existing Phase 8 Planning Center credentials/proxy; live verification against a real PC account happens in Plan 04 per this plan's `user_setup` note.

## Next Phase Readiness
- `fetchPeopleForTeamPositions` is a settled, unit-tested contract ready for Plan 04 to wire into the selective-import modal
- No blockers or concerns

---
*Phase: 14-in-app-quarterly-availability-editor*
*Completed: 2026-07-08*
