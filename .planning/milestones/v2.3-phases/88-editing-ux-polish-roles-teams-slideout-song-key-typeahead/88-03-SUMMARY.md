---
phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
plan: 03
subsystem: ui
tags: [vue, roster, teams, slideover, read-only-rows]

# Dependency graph
requires:
  - phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
    plan: 02
    provides: RoleSlideOver.vue, TeamSlideOver.vue (standalone edit/create/delete drawers, unwired)
  - phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
    plan: 01
    provides: SongSlideOver drawer shell pattern (reference for RosterView's parent-owns-selection wiring, mirrored from SongsView)
provides:
  - Read-only RolesConfigPanel.vue (grouped rows + @edit/@add)
  - Read-only TeamsConfigPanel.vue (flat rows + recurrence summary + @edit/@add)
  - RosterView.vue as slideout owner (selectedRole/roleSlideOpen, selectedTeam/teamSlideOpen)
  - (removed) src/components/TeamRecurrenceSlideOver.vue
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [parent-owns-selection + row-click-opens-slideout, applied a third time (Songs -> Roles/Teams); read-only row presenter emitting edit/add instead of mutating a store directly]

key-files:
  created: []
  modified:
    - src/components/RolesConfigPanel.vue
    - src/components/__tests__/RolesConfigPanel.test.ts
    - src/components/TeamsConfigPanel.vue
    - src/components/__tests__/TeamsConfigPanel.test.ts
    - src/views/RosterView.vue
    - src/views/__tests__/RosterView.test.ts
    - src/views/__tests__/RosterViewEditQuery.test.ts

key-decisions:
  - "RolesConfigPanel keeps the Band/Tech/Other group headers (owner decision, R257 CONTEXT) — only the row body changed from editable to a single clickable button per role"
  - "TeamsConfigPanel's formatRecurrence() helper lives in the panel (not a shared util) since only this read-only summary needs the 'Nth Sun' compact string; TeamSlideOver's own recurrence UI uses the raw ordinals array, not this formatter"
  - "RosterView mounts RoleSlideOver/TeamSlideOver directly in its template (not inside the existing Volunteer-drawer Teleport block) since both slideouts already Teleport to body internally — placement in the parent template is cosmetic only"
  - "Rule 3 fix: RosterViewEditQuery.test.ts (a separate, pre-existing test file exercising the ?edit deep-link, not touched by the plan's file list) broke because it mounts the real RosterView without stubbing the newly-mounted RoleSlideOver/TeamSlideOver, which now render for real and call the unmocked useToasts() Pinia store ('no active Pinia'). Fixed by adding matching stubs, mirroring RosterView.test.ts's pattern — the minimal in-scope fix for a regression this plan's own change caused."

requirements-completed: [R257]

coverage:
  - id: D1
    description: "RolesConfigPanel renders read-only grouped rows (name/group badge/default count/vocal marker) with zero form controls, emits edit(role)/add(), and keeps the R246/R256 header copy"
    requirement: R257
    verification:
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TeamsConfigPanel renders read-only flat rows (name + recurrence summary) with zero form controls, emits edit(team)/add(), preserves the zero-teams empty state, no longer imports TeamRecurrenceSlideOver"
    requirement: R257
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "RosterView owns selectedRole/roleSlideOpen + selectedTeam/teamSlideOpen, mounts RoleSlideOver/TeamSlideOver, opens them from panel add/edit events; TeamRecurrenceSlideOver.vue deleted with no dangling importer; stale 'Roles config' RosterView assertion fixed"
    requirement: R257
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts (21 tests, including 5 new wiring tests)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RosterViewEditQuery.test.ts (3 tests, fixed regression)"
        status: pass
    human_judgment: false

# Metrics
duration: 32min
completed: 2026-08-27
status: complete
---

# Phase 88 Plan 03: Roles/Teams Read-Only Rows + Slideout Wiring Summary

**Roles and Teams tabs now match the Songs editing pattern — RolesConfigPanel and TeamsConfigPanel are pure read-only row presenters emitting `edit`/`add`, RosterView owns the selection state and mounts Plan-02's RoleSlideOver/TeamSlideOver, and the now-absorbed TeamRecurrenceSlideOver.vue is deleted.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-27T05:22:00Z
- **Completed:** 2026-08-27T05:54:00Z
- **Tasks:** 3 completed
- **Files modified:** 7 (0 created, 6 modified, 1 deleted; plus 1 non-plan test file fixed as a Rule 3 deviation)

## Accomplishments
- Refactored `RolesConfigPanel.vue` from an always-editable, per-row-draft form into a pure read-only presenter: one clickable row per role (name, group badge, `Default {n}` muted text, a `Vocal` marker pill when `role.vocal`, trailing chevron) still grouped under Band/Tech/Other headers, plus a header `"+ Add role"` button. Deleted all inline-edit state (`roleDrafts`, `onSaveRole`, `confirmDeleteId`, the Add-Role form fields) and the panel's direct `rosterStore.addRole/updateRole/deleteRole` calls — those now live only in `RoleSlideOver` (Plan 02).
- Refactored `TeamsConfigPanel.vue` the same way: read-only flat rows (name + a new `formatRecurrence()` summary like `"1st & 3rd Sun"` or `"—"`, trailing chevron), header `"+ Add team"`. Removed `teamDrafts`, `onSaveTeam`, `isDuplicateName`, the rename soft-warn state, the `TeamRecurrenceSlideOver` import/mount, and the panel's `teamsStore.addTeam/updateTeam/deleteTeam` + `useToasts` calls (all absorbed into `TeamSlideOver`, Plan 02).
- Wired `RosterView.vue` as the slideout owner, mirroring `SongsView.vue`'s `selectedSong`/`slideOverOpen` pattern: new `selectedRole`/`roleSlideOpen` and `selectedTeam`/`teamSlideOpen` refs, `onAddRole`/`onEditRole`/`onAddTeam`/`onEditTeam` handlers, `RolesConfigPanel @edit/@add` and `TeamsConfigPanel @edit/@add` wired to them, and `RoleSlideOver`/`TeamSlideOver` mounted (each Teleports to `body` internally).
- Deleted `src/components/TeamRecurrenceSlideOver.vue` — grepped the repo first and confirmed the only remaining hit was a code comment in `TeamSlideOver.vue` ("absorbed from TeamRecurrenceSlideOver"), not an import.
- Fixed the pre-existing stale `RosterView.test.ts` assertion (`'wraps Roles config in CollapsibleSection'` asserting the literal text `'Roles config'`, which was never actually rendered since `RolesConfigPanel` is stubbed in that test) with an accurate `'renders a Roles tab button'` test, and added a new `describe` block with 5 wiring tests proving RosterView opens the correct slideout (open flag + role/team id) in response to each panel's `add`/`edit` events.

## Task Commits

Each task was committed atomically:

1. **Task 1: RolesConfigPanel → read-only grouped rows + @edit/@add**
   - `7b6b75ad` (feat) — read-only rows replace the inline editor; `RolesConfigPanel.test.ts` rewritten (7 tests: R246/R256 header copy kept, zero-form-controls, group headers, edit-emit, add-emit, vocal-marker)
2. **Task 2: TeamsConfigPanel → read-only rows + recurrence summary + @edit/@add, drop recurrence drawer**
   - `48f0dd05` (feat) — read-only rows + `formatRecurrence()` replace the inline editor and `TeamRecurrenceSlideOver` mount; `TeamsConfigPanel.test.ts` rewritten (5 tests)
3. **Task 3: RosterView owns the slideouts + mount them + delete TeamRecurrenceSlideOver + fix stale test**
   - `0ccdd5f0` (feat) — `RosterView.vue` wired as slideout owner; `TeamRecurrenceSlideOver.vue` deleted; `RosterView.test.ts` stale assertion fixed + 5 new wiring tests (21 tests total); `RosterViewEditQuery.test.ts` fixed (Rule 3 deviation, see below)

**Plan metadata:** (this commit, following SUMMARY.md creation)

_Note: `tdd_mode` is `false` for this milestone's config (per 88-01/88-02 precedent), so tasks were implemented directly with full test coverage in the same commit rather than a separate RED/GREEN commit pair._

## Files Created/Modified
- `src/components/RolesConfigPanel.vue` - read-only grouped rows, `@edit`/`@add` emits
- `src/components/__tests__/RolesConfigPanel.test.ts` - 7 tests (rewritten)
- `src/components/TeamsConfigPanel.vue` - read-only rows + recurrence summary, `@edit`/`@add` emits
- `src/components/__tests__/TeamsConfigPanel.test.ts` - 5 tests (rewritten)
- `src/views/RosterView.vue` - owns `selectedRole`/`roleSlideOpen` + `selectedTeam`/`teamSlideOpen`, mounts `RoleSlideOver`/`TeamSlideOver`
- `src/views/__tests__/RosterView.test.ts` - stale assertion fixed, 5 new wiring tests added (21 tests total)
- `src/views/__tests__/RosterViewEditQuery.test.ts` - added `RoleSlideOver`/`TeamSlideOver` stubs (Rule 3 fix, not in the plan's file list)
- `src/components/TeamRecurrenceSlideOver.vue` - deleted (absorbed into `TeamSlideOver` in Plan 02)

## Decisions Made
- Kept Roles' Band/Tech/Other grouping (owner decision from `88-CONTEXT.md`) — only the row body changed from editable to a single clickable row per role.
- `formatRecurrence()` lives locally in `TeamsConfigPanel.vue` rather than a shared util, since it is a display-only compact-summary formatter distinct from `TeamSlideOver`'s raw-ordinals editing UI.
- Mounted `RoleSlideOver`/`TeamSlideOver` directly in `RosterView`'s template body (not inside the existing Volunteer-drawer `<Teleport>` block) since both slideouts Teleport to `body` internally — template placement is cosmetic only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Fixed `RosterViewEditQuery.test.ts`, broken by mounting the new slideouts in `RosterView`**
- **Found during:** Task 3, running the full app suite (`npx vitest run`) as a broader regression check
- **Issue:** `RosterViewEditQuery.test.ts` is a separate, pre-existing test file (not in this plan's `files_modified` list) that exercises the `?edit={personId}` deep-link and mounts the real `RosterView` with its own stub set. It did not stub `RoleSlideOver`/`TeamSlideOver` (they didn't exist as RosterView children before this plan), so once `RosterView.vue` started mounting them for real, `TeamSlideOver`'s `useToasts()` call hit `getActivePinia()` with no active Pinia in that test file's setup — 3 test failures ("no active Pinia").
- **Fix:** Added `RoleSlideOver: { template: '<div />' }` and `TeamSlideOver: { template: '<div />' }` stubs to `RosterViewEditQuery.test.ts`'s `mountRosterView()`, mirroring the pattern already used in `RosterView.test.ts`.
- **Files modified:** `src/views/__tests__/RosterViewEditQuery.test.ts`
- **Commit:** `0ccdd5f0` (bundled into the Task 3 commit, since it's a direct consequence of that task's `RosterView.vue` change)

## Issues Encountered

None beyond the Rule 3 fix above. The full `npx vitest run` (155 files, 4440 tests) run at the end of Task 3 showed exactly the documented baseline: `src/storage.rules.test.ts` (25 tests, all `Test timed out in 5000ms` — the Storage emulator was not running; a pre-existing, documented environment limitation per `CLAUDE.md`, not a regression) failing, and all 154 other test files — including `RosterView.test.ts` and `RosterViewEditQuery.test.ts` — passing. The stale `RosterView.test.ts` half of the old two-file baseline is now fixed by this plan, narrowing the documented baseline to `storage.rules.test.ts` only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npx vitest run src/components/__tests__/RolesConfigPanel.test.ts src/components/__tests__/TeamsConfigPanel.test.ts src/views/__tests__/RosterView.test.ts src/views/__tests__/RosterViewEditQuery.test.ts` — all green (36 tests).
- `npm run type-check` (`vue-tsc --build`) is clean.
- Full app suite `npx vitest run` — only `src/storage.rules.test.ts` remains failing (documented environment-only baseline); `RosterView.test.ts`'s stale assertion is fixed.
- Grep confirms no remaining import of `TeamRecurrenceSlideOver` (only a code comment in `TeamSlideOver.vue`) and no `<input>`/`<select>` inside `RolesConfigPanel.vue`/`TeamsConfigPanel.vue` templates.
- R257 complete. Plan 04 (R258 — song Key type-ahead dropdown) is unblocked; it does not depend on this plan's files.

---
*Phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 6 modified/created files found on disk (`RolesConfigPanel.vue`, `RolesConfigPanel.test.ts`,
`TeamsConfigPanel.vue`, `TeamsConfigPanel.test.ts`, `RosterView.vue`, `RosterView.test.ts`) plus the
Rule-3-fixed `RosterViewEditQuery.test.ts` and this SUMMARY.md; `TeamRecurrenceSlideOver.vue` confirmed
deleted from disk; all 3 task commits (`7b6b75ad`, `48f0dd05`, `0ccdd5f0`) verified present in git log.
