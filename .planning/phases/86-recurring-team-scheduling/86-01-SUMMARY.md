---
phase: 86-recurring-team-scheduling
plan: 01
subsystem: ui
tags: [vue, pinia, team-scheduling, recurrence]

# Dependency graph
requires:
  - phase: 79-dedup-configurable-teams
    provides: "Per-org configurable Team type/store (organizations/{org}/teams, useTeamsStore)"
provides:
  - "Team.recurrence?: { ordinals: number[] } optional storage field for Nth-Sunday-of-month patterns"
  - "ordinalOfMonth / teamMatchesDate pure, UTC-stable matching helpers (src/utils/teamRecurrence.ts)"
  - "Creation-only recurring auto-select wired into NewServiceDialog.vue (R255)"
affects: [86-02-recurrence-slideout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UTC-stable YYYY-MM-DD date parsing (split('-') + integer day math), mirroring the Phase 84 serviceDateToMillis convention"
    - "Auto-added-vs-manually-touched dual tracking set for a 'smart default that never clobbers manual overrides' UI pattern"

key-files:
  created:
    - src/utils/teamRecurrence.ts
    - src/utils/__tests__/teamRecurrence.test.ts
  modified:
    - src/types/team.ts
    - src/components/NewServiceDialog.vue
    - src/components/__tests__/NewServiceDialog.test.ts

key-decisions:
  - "Two tracking sets (autoAddedTeams + manuallyTouchedTeams), not the plan's literally-described single set — needed so a manually UNCHECKED team is never re-added on a later matching date, and a manually CHECKED team is never removed on a later non-matching date (see Deviations)."
  - "applyRecurrenceAutoSelect is invoked once at setup time (immediately after form is built) in addition to the open watcher and the date @change handler, so a dialog mounted already-open still auto-selects on first render."

patterns-established:
  - "Recurrence match helpers live in a pure, framework-free utils module (no firebase/vue imports) so they stay trivially unit-testable and reusable by 86-02's slideout without pulling in component/store wiring."

requirements-completed: [R254, R255]

coverage:
  - id: D1
    description: "Team type carries an optional recurrence?: { ordinals: number[] } field; existing team docs (no recurrence) remain valid and untouched; DEFAULT_TEAMS unchanged"
    requirement: "R254"
    verification:
      - kind: unit
        ref: "npx vue-tsc --noEmit -p tsconfig.app.json (type-check, no errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ordinalOfMonth(dateStr) computes Math.ceil(dayOfMonth/7) via a UTC-stable YYYY-MM-DD parse; teamMatchesDate(team, dateStr) returns true only when team.recurrence.ordinals includes that ordinal, false for absent/empty recurrence"
    requirement: "R254"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/teamRecurrence.test.ts (14 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Creating a service on a date matching a configured team's ordinals pre-checks that team in NewServiceDialog; the pre-check is overridable, a manual uncheck survives a later matching date change, a manual check survives a later non-matching date change, a non-matching date selects nothing, and teams without recurrence never auto-select"
    requirement: "R255"
    verification:
      - kind: unit
        ref: "src/components/__tests__/NewServiceDialog.test.ts (20 tests, all pass — includes 5 new recurring-auto-select tests plus the updated R231 2nd-Sunday assertion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Auto-select logic exists ONLY in NewServiceDialog.vue; ServiceEditorView is untouched, so opening/editing an existing service never retroactively applies the pattern"
    requirement: "R255"
    verification:
      - kind: other
        ref: "git diff --stat confirms only src/types/team.ts, src/utils/teamRecurrence.ts(+test), src/components/NewServiceDialog.vue(+test) changed — no ServiceEditorView.vue in the diff"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-08-26
status: complete
---

# Phase 86 Plan 01: Recurrence Data Model & Creation-Time Auto-Select Summary

**Optional `Team.recurrence` field + pure UTC-stable `teamMatchesDate` helper, wired into NewServiceDialog so picking/changing the Service Date pre-checks every team whose configured Nth-Sunday pattern matches — fully overridable, never clobbering manual choices, and never applied to existing services.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-08-27T01:16:00Z (approx, first commit 2026-08-26T21:16:48-04:00)
- **Completed:** 2026-08-27T01:33:00Z (approx, last task commit 2026-08-26T21:32:50-04:00)
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created, 3 modified — see Files Created/Modified)

## Accomplishments
- `Team` gains an optional `recurrence?: { ordinals: number[] }` field; existing team docs and `DEFAULT_TEAMS` are untouched.
- `src/utils/teamRecurrence.ts` — pure, framework-free `ordinalOfMonth` + `teamMatchesDate`, UTC-stable per the Phase 84 `serviceDateToMillis` precedent, with 14 unit tests covering ordinals 1–5, 5th-Sunday months, non-matching dates, and absent/empty recurrence.
- `NewServiceDialog.vue` now pre-checks every team whose recurrence matches the Service Date — on initial mount, on dialog re-open, and on explicit date changes — while a dual-tracking-set design (`autoAddedTeams` / `manuallyTouchedTeams`) guarantees manual overrides are never clobbered by a later recompute. `ServiceEditorView.vue` is untouched, so the pattern is never applied retroactively.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add optional recurrence field to the Team type** - `d6cd003a` (feat)
2. **Task 2: Pure UTC-stable matching helper (ordinalOfMonth + teamMatchesDate)** - `35d5edd4` (test, RED) → `3aa94f55` (feat, GREEN)
3. **Task 3: Creation-only auto-select in NewServiceDialog** - `06ddda94` (test, RED) → `d01304da` (feat, GREEN)

**Plan metadata:** (this commit, docs: complete plan)

_TDD tasks (2 and 3) each carry a test → feat commit pair; no refactor commit was needed for either since the GREEN implementation was already clean._

## Files Created/Modified
- `src/types/team.ts` - `Team.recurrence?: { ordinals: number[] }` optional field + doc comments
- `src/utils/teamRecurrence.ts` - `ordinalOfMonth(dateStr)` and `teamMatchesDate(team, dateStr)` pure helpers
- `src/utils/__tests__/teamRecurrence.test.ts` - 14 unit tests for the helpers
- `src/components/NewServiceDialog.vue` - `applyRecurrenceAutoSelect`, `onDateChange`, `onTeamCheckboxChange`, wired into the date input's `@change`, each team checkbox's `@change`, dialog setup, and the open watcher
- `src/components/__tests__/NewServiceDialog.test.ts` - Choir given a configured recurrence in `mockTeams`; 5 new tests for initial match / date-change swap / manual-uncheck sticky / manual-check sticky / non-matching-selects-nothing; the pre-existing 2nd-Sunday R231 assertion updated to expect Choir now auto-selects there

## Decisions Made
- **Two tracking sets instead of the plan's literally-described one.** See Deviations below — `autoAddedTeams` alone could not satisfy the "manual uncheck is not re-added" requirement, so a second `manuallyTouchedTeams` set was added to permanently exclude any manually-toggled team from all future recomputes for the dialog session.
- **`applyRecurrenceAutoSelect` runs once at setup time**, immediately after `form` is constructed, in addition to the open watcher and the date `@change` handler — otherwise a dialog mounted already-`open` (the common case in tests and in `ServicesView`) would skip the first auto-select, since Vue's `watch` (without `immediate: true`) does not fire for the initial value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Single-set design in the plan's action text does not satisfy its own behavior requirements — implemented a two-set design instead**
- **Found during:** Task 3 (Creation-only auto-select in NewServiceDialog)
- **Issue:** The plan's `<action>` describes one `autoAddedTeams` set: step 3 of `applyRecurrenceAutoSelect` re-adds any matching team whose name is "not already in form.teams." Tracing through the "manual uncheck" scenario: the checkbox handler removes the name from `autoAddedTeams` and (via `v-model`) removes it from `form.teams`. On the next date change, the removal step doesn't touch it (already out of the set), but the addition step sees a matching team whose name is NOT in `form.teams` and re-adds it — directly violating the plan's own required behavior ("A team the planner manually UNCHECKS is not re-added when the date changes again to a date that would match it") and the corresponding test case.
- **Fix:** Added a second ref, `manuallyTouchedTeams`, populated by the same per-checkbox `@change` handler. `applyRecurrenceAutoSelect`'s addition step now skips any team whose name is in `manuallyTouchedTeams`, regardless of current `form.teams` membership — so a manual uncheck stays unchecked and a manual check stays checked across any number of subsequent date changes, for the life of the open dialog.
- **Files modified:** src/components/NewServiceDialog.vue
- **Verification:** All 5 new recurring-auto-select tests pass, including the manual-uncheck-survives-matching-date-change and manual-check-survives-non-matching-date-change cases; full existing R038/R231 suite (20 tests total) still passes.
- **Committed in:** d01304da (Task 3 GREEN commit)

**2. [Rule 1 - Bug] Existing R231 test collided with the new recurrence test data**
- **Found during:** Task 3 (updating NewServiceDialog.test.ts)
- **Issue:** The plan's own instruction to give Choir a 2nd-Sunday recurrence (`ordinals: [2]`) so "the reference calendar's 2nd Sunday (2026-09-13) matches it" collides with a pre-existing R231 test that asserts `teams: []` at exactly that date (`'starts with no teams pre-selected on the 2nd-Sunday-skip-to-3rd-Sunday date pair'`).
- **Fix:** Updated that test's baseline assertion from `expect(baselinePayload.teams).toEqual([])` to `expect(baselinePayload.teams).toEqual(['Choir'])`, with an updated comment explaining Choir now carries a CONFIGURED (not hard-coded) recurrence per this plan. The test's second assertion (3rd Sunday, no match) is unaffected and still asserts `[]`. This preserves the R231 principle being tested — no team auto-selects without an explicit, per-team, user-configured pattern — while accommodating the new fixture data.
- **Files modified:** src/components/__tests__/NewServiceDialog.test.ts
- **Verification:** Test passes; the R231 describe block's other three tests (which use dates that don't hit Choir's ordinal-2 pattern) are unaffected and still assert empty team arrays.
- **Committed in:** 06ddda94 (Task 3 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the plan's literal design/test-data, not in existing shipped code)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own stated behavior requirements and test coverage goals. No scope creep — the two-set design and the collision fix are both scoped entirely to Task 3's stated files.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `Team.recurrence` is now the shared storage field that 86-02's Volunteer → Teams slideout will read/write via `teamsStore.updateTeam(id, { recurrence })`.
- `teamMatchesDate` / `ordinalOfMonth` are ready for reuse by any future consumer without additional wiring.
- No blockers. `npm run type-check` and the full `npx vitest run` suite (150 files) both pass with only the pre-existing, documented baseline failures (`src/storage.rules.test.ts` — no local Storage emulator; `RosterView.test.ts` — stale assertion, unrelated to this plan).

---
*Phase: 86-recurring-team-scheduling*
*Completed: 2026-08-26*
