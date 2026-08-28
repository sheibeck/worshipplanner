---
phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
plan: 02
subsystem: ui
tags: [vue, slideover, roster, teams, recurrence]

# Dependency graph
requires:
  - phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
    plan: 01
    provides: SongSlideOver drawer shell pattern (Teleport, backdrop, translate-x-full transition, header, create/edit/delete)
  - phase: 79-teams-configurable
    provides: teamsStore.addTeam/updateTeam/deleteTeam, WR-01 duplicate-name guard, WR-02 rename soft-warn (from TeamsConfigPanel.vue)
  - phase: 85-role-vocal-refinements
    provides: Role.vocal flag, Band-only vocal checkbox behavior (from RolesConfigPanel.vue)
  - phase: 86-team-recurrence
    provides: Team.recurrence.ordinals + TeamRecurrenceSlideOver's ordinal multi-select body (folded into TeamSlideOver, TeamRecurrenceSlideOver itself untouched)
provides:
  - src/components/RoleSlideOver.vue — standalone role edit/create/delete drawer
  - src/components/TeamSlideOver.vue — standalone team edit/create/delete drawer absorbing recurrence
affects: [88-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [SongSlideOver drawer shell reused a second/third time (Teleport + backdrop Transition + right-drawer Transition + header create/edit/delete), single-form-watch-on-open seeding pattern]

key-files:
  created:
    - src/components/RoleSlideOver.vue
    - src/components/__tests__/RoleSlideOver.test.ts
    - src/components/TeamSlideOver.vue
    - src/components/__tests__/TeamSlideOver.test.ts
  modified: []

key-decisions:
  - "RoleSlideOver's vocal checkbox is moved verbatim from RolesConfigPanel — no rename/generalization (multi-role is Phase 89 scope, per plan boundary)"
  - "TeamSlideOver absorbs TeamRecurrenceSlideOver's ordinal multi-select body into one drawer rather than keeping two separate slideouts; TeamRecurrenceSlideOver.vue itself is left in place (untouched) — Plan 03 removes it once RosterView stops using it"
  - "WR-01 duplicate-name guard and WR-02 rename soft-warn ported with matching copy/logic from TeamsConfigPanel.vue; save-handler order is trim -> empty-check -> duplicate-name -> (edit only) rename soft-warn -> write, matching the plan's specified sequence"
  - "Recurrence ordinals dedupe+sort on both read (seed from props.team on open) and write (Save payload), mirroring TeamRecurrenceSlideOver's WR-2 pattern"
  - "Neither drawer uses useUnsavedGuard (SongSlideOver's dirty-tracking composable) — Cancel/backdrop/close always emits close immediately, matching TeamRecurrenceSlideOver's simpler Cancel behavior rather than SongSlideOver's confirm-on-discard; the plan's behavior spec does not require a dirty-guard for these two drawers"

requirements-completed: [R257]

coverage:
  - id: D1
    description: "RoleSlideOver create/edit/delete round-trips through rosterStore.addRole/updateRole/deleteRole; vocal checkbox is Band-only and persists correctly"
    requirement: R257
    verification:
      - kind: unit
        ref: "src/components/__tests__/RoleSlideOver.test.ts (10 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TeamSlideOver create/edit/delete + recurrence ordinal round-trip through teamsStore.addTeam/updateTeam/deleteTeam; duplicate-name guard and WR-02 rename soft-warn preserved"
    requirement: R257
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamSlideOver.test.ts (17 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-27
status: complete
---

# Phase 88 Plan 02: Role/Team Slideout Editors Summary

**Two new standalone slide-over editors — RoleSlideOver and TeamSlideOver — mirror SongSlideOver's drawer shell for create/edit/delete, with TeamSlideOver absorbing the Phase-86 recurrence multi-select into one drawer and preserving both the WR-01 duplicate-name guard and the WR-02 rename soft-warn.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-27T04:52:00Z
- **Completed:** 2026-08-27T05:27:00Z
- **Tasks:** 2 completed
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments
- Created `RoleSlideOver.vue`: name/group/defaultCount/vocal edit + create + delete, mirroring SongSlideOver's Teleport/backdrop/drawer/header shell. The vocal checkbox is shown and persisted for Band roles only, moved verbatim from `RolesConfigPanel.vue` (no rename/generalization).
- Created `TeamSlideOver.vue`: name + Nth-Sunday recurrence edit + create + delete, absorbing `TeamRecurrenceSlideOver.vue`'s ordinal multi-select body so there is one team drawer, not two. `TeamRecurrenceSlideOver.vue` itself is untouched (Plan 03 removes it after rewiring the consumer).
- Ported WR-01 (duplicate-name guard, case/whitespace-insensitive, excludes self) and WR-02 (rename soft-warn: first Save on a changed name surfaces a confirm block and does not write; a second confirming Save — or the inline "Rename anyway" button — commits the rename) from `TeamsConfigPanel.vue`, with the save-handler order specified in the plan: trim → empty-check → duplicate-name → (edit-mode-only) rename soft-warn → write.
- Recurrence ordinals dedupe+sort on both read (seeded from `props.team.recurrence.ordinals` on open) and write (the Save payload), matching `TeamRecurrenceSlideOver`'s existing WR-2 guard against a duplicate entering via a direct Firestore edit.
- Neither component is wired to a consumer yet — RosterView, RolesConfigPanel, and TeamsConfigPanel are untouched; Plan 03 wires both drawers in and removes the old inline editors + `TeamRecurrenceSlideOver`.

## Task Commits

Each task was committed atomically:

1. **Task 1: RoleSlideOver.vue — role edit/create/delete drawer**
   - `c9ec8da5` (feat) — `RoleSlideOver.vue` + `RoleSlideOver.test.ts` created; 10 tests covering create/edit/delete, Band-only vocal handling, and open=false rendering nothing
2. **Task 2: TeamSlideOver.vue — team edit/create/delete drawer (absorbs recurrence)**
   - `46109fd2` (feat) — `TeamSlideOver.vue` + `TeamSlideOver.test.ts` created; 17 tests covering create/edit/delete, recurrence round-trip (including read/write dedupe of a corrupted seed), the WR-01 duplicate-name guard, and the WR-02 rename soft-warn (including the recurrence-only-edit exemption)

**Plan metadata:** (this commit, following SUMMARY.md creation)

_Note: `tdd_mode` is `false` for this milestone's config, so tasks were implemented directly with full test coverage in the same commit rather than a separate RED/GREEN commit pair — consistent with 88-01's precedent._

## Files Created/Modified
- `src/components/RoleSlideOver.vue` - role edit/create/delete drawer (name/group/defaultCount/Band-only vocal)
- `src/components/__tests__/RoleSlideOver.test.ts` - 10 tests
- `src/components/TeamSlideOver.vue` - team edit/create/delete drawer + absorbed recurrence multi-select, WR-01/WR-02 guards
- `src/components/__tests__/TeamSlideOver.test.ts` - 17 tests

## Decisions Made
- Kept the vocal checkbox behavior byte-identical to `RolesConfigPanel.vue`'s existing logic (label text, Band-only visibility, forced `vocal:false` off-Band) — Phase 89 scope covers any generalization to multi-role.
- `TeamRecurrenceSlideOver.vue` was deliberately left in place, unmodified, and un-imported by the new components — the plan scopes its removal to Plan 03, after `RosterView`/`TeamsConfigPanel` stop referencing it.
- The rename soft-warn's confirm block includes both the standard header Save button (works because `pendingRenameConfirm` gates the second call) and an explicit inline "Rename anyway" button for a more discoverable single click — the plan's behavior spec ("a second Save... or an explicit 'Rename anyway' confirm button") explicitly allows either path, which the test suite exercises via the inline button.
- Neither drawer uses `useUnsavedGuard` — Cancel/backdrop/× always emit `close` immediately. The plan's behavior/must-haves specify create/edit/delete round-trips and the WR-01/WR-02 guards, not a dirty-state discard confirmation; `TeamRecurrenceSlideOver` (the closest existing precedent for a non-Song drawer) also does not use it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Running the full bare `npx vitest run` suite as a broader regression check hit `[vitest-pool]: Failed to start forks worker` timeouts on three unrelated test files (`src/utils/__tests__/slug.test.ts`, `src/constants/__tests__/keys.test.ts`, `src/utils/__tests__/planningCenterExport.test.ts`) when run concurrently with a second vitest invocation in this sandboxed environment — a resource-contention artifact of two overlapping full-suite runs, not a code regression. This plan adds only 4 new, standalone files with zero consumers wired (confirmed via `git diff --stat` across both task commits: 0 files modified, 4 created) — there is no code path by which these changes could affect the 3 flagged files or any other existing test. The plan's own `<verification>` block requires only the two targeted test files plus `npm run type-check`, both of which are green (see below).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npx vitest run src/components/__tests__/RoleSlideOver.test.ts src/components/__tests__/TeamSlideOver.test.ts` — both green: 10 + 17 = 27 tests pass.
- `npm run type-check` (vue-tsc --build) is clean.
- `RoleSlideOver.vue` and `TeamSlideOver.vue` are ready for Plan 03 to wire into `RosterView.vue` (parent-owns-`selectedRole`/`selectedTeam` pattern, mirroring `SongsView.vue`), replace the inline editors in `RolesConfigPanel.vue`/`TeamsConfigPanel.vue` with read-only rows + chevron, and remove `TeamRecurrenceSlideOver.vue`.
- No blockers for 88-03.

---
*Phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 4 created files found on disk (`RoleSlideOver.vue`, `RoleSlideOver.test.ts`, `TeamSlideOver.vue`, `TeamSlideOver.test.ts`) plus this SUMMARY.md; both task commits (`c9ec8da5`, `46109fd2`) verified present in git log.
