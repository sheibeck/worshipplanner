---
phase: 83-roles-teams-tab-ux-copy
plan: 01
subsystem: ui
tags: [vue, tailwind, roster, teams, ux-polish]

# Dependency graph
requires:
  - phase: 79-dedup-configurable-teams
    provides: TeamsConfigPanel.vue built to mirror RolesConfigPanel.vue, including the existing inline Delete text-link + soft-warn confirm pattern this plan restyles
provides:
  - "Roles/Teams config tabs constrained to max-w-4xl (Volunteers tab stays full-width)"
  - "Real destructive Delete button (bg-red-900/20 + text-red-400) in both RolesConfigPanel and TeamsConfigPanel"
  - "Corrected schedulable-roles copy describing the scheduler's real per-role auto-fill behavior"
  - "New RolesConfigPanel.test.ts — first unit test coverage for that component"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Destructive-button treatment (bg-red-900/20 hover:bg-red-900/40 text-red-400) reused verbatim from SettingsView's Clear Credentials button, trimmed to compact row sizing (text-xs px-3 py-1.5)"
    - "max-w-4xl width wrapper applied at the tab-panel v-show level in RosterView.vue, not inside child components, so both Roles and Teams get it identically without touching Volunteers"

key-files:
  created:
    - src/components/__tests__/RolesConfigPanel.test.ts
  modified:
    - src/components/RolesConfigPanel.vue
    - src/components/TeamsConfigPanel.vue
    - src/types/roster.ts
    - src/views/RosterView.vue
    - src/components/__tests__/TeamsConfigPanel.test.ts
    - src/views/__tests__/RosterView.test.ts

key-decisions:
  - "Delete button class swap only (bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs px-3 py-1.5) — the element was already a real <button>, click handler and inline soft-warn confirm blocks left untouched in both panels"
  - "R246 copy: 'Default count is the number of volunteers the scheduler auto-fills for this role each service.' — confirmed accurate against scheduler.ts's fill loop per 83-RESEARCH.md; scheduler behavior itself unchanged"
  - "Bundled the src/types/roster.ts:9 stale doc-comment fix into Task 1 (RESEARCH Pitfall 2 / Open Q1) — zero-risk comment-only correction removing the same outdated 'soft planning default, NOT a hard cap' framing"
  - "max-w-4xl applied to the roles/teams v-show wrapper divs in RosterView.vue only — not the Volunteers wrapper, not the page container"

patterns-established:
  - "Config-tab panels (stacked-row editors) get max-w-4xl at their v-show wrapper in the parent view; data-table/matrix views stay unconstrained"

requirements-completed: [R244, R245, R246]

coverage:
  - id: D1
    description: "RolesConfigPanel header copy accurately states the scheduler auto-fills the default count each service; old soft-target/no-cap framing removed"
    requirement: R246
    verification:
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts#R246: header copy states the scheduler auto-fills the count each service, dropping the old soft-target framing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Delete button in RolesConfigPanel renders as a real destructive button (bg-red-900/20 + text-red-400) at compact row sizing, with click handler and confirm flow unchanged"
    requirement: R245
    verification:
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts#R245: the per-row Delete button renders as a real destructive button at compact row sizing"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts#clicking Delete reveals an inline soft-warn confirm; Cancel dismisses without deleting; confirming calls deleteRole with that role id"
        status: pass
    human_judgment: false
  - id: D3
    description: "Delete button in TeamsConfigPanel mirrors the same destructive treatment; all existing rename/delete/aria-label assertions survive the class-only change"
    requirement: R245
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#R245: the per-row Delete button renders as a real destructive button"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#IN-02: each row Delete button carries a per-row aria-label naming the team"
        status: pass
    human_judgment: false
  - id: D4
    description: "Roles and Teams tab-panel wrappers in RosterView carry max-w-4xl; the Volunteers wrapper does not"
    requirement: R244
    verification:
      - kind: unit
        ref: "src/views/__tests__/RosterView.test.ts#R244: roles and teams tab wrappers are width-constrained but volunteers is not"
        status: pass
    human_judgment: false
  - id: D5
    description: "src/types/roster.ts:9 doc-comment no longer contradicts the corrected R246 copy"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) — comment-only change, no type impact"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-24
status: complete
---

# Phase 83 Plan 01: Roles/Teams Tab UX & Copy Summary

**Constrained the Roles/Teams config tabs to max-w-4xl, restyled both panels' Delete text-link into a real destructive button matching SettingsView's Clear Credentials, and corrected the schedulable-roles copy (plus a matching stale type doc-comment) to accurately describe the scheduler's real per-role auto-fill behavior.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-24T15:57:33Z
- **Completed:** 2026-08-24T20:21:43Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Roles and Teams tab panels in RosterView.vue now render inside a `max-w-4xl` wrapper (mirroring SettingsView's width convention); the Volunteers tab stays full-width, verified by a new scoped test asserting exactly 2 `.max-w-4xl` elements and that the Volunteers wrapper is excluded.
- Both RolesConfigPanel.vue and TeamsConfigPanel.vue's Delete `<button>` (already a real button styled as a text link) is now a genuine destructive button — `bg-red-900/20 hover:bg-red-900/40 text-red-400`, compact row sizing — with the `@click` handler and inline soft-warn confirm block untouched in both panels.
- RolesConfigPanel.vue's header copy no longer frames the default count as a "soft planning target, not a hard cap"; it now states the scheduler auto-fills that count each service — traced and confirmed accurate against `scheduler.ts`'s fill loop in 83-RESEARCH.md. Scheduler behavior itself was not touched.
- Created `src/components/__tests__/RolesConfigPanel.test.ts` — the first unit test file for this component — covering the corrected copy, the destructive Delete button, the delete-confirm flow, save, and add.
- Fixed the identical stale "soft planning default, NOT a hard cap" doc-comment on `Role.defaultCount` in `src/types/roster.ts`, which contradicted the just-corrected UI copy.

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED → GREEN):

1. **Task 1 (RED): failing RolesConfigPanel tests for R245/R246** - `f538281f` (test)
2. **Task 1 (GREEN): corrected Roles copy (R246) and destructive Delete button (R245)** - `1a1a1569` (feat)
3. **Task 2: mirror the destructive Delete button in TeamsConfigPanel (R245)** - `9fc7054f` (feat)
4. **Task 3: constrain Roles/Teams tab width to max-w-4xl (R244)** - `e40675a1` (feat)

_Task 1 used the plan's TDD gate: RED commit `f538281f` (5 tests, 2 failing against pre-change source) followed by GREEN commit `1a1a1569` (all 5 passing)._

## Files Created/Modified
- `src/components/RolesConfigPanel.vue` - Header copy (R246) + Delete button class swap (R245)
- `src/components/__tests__/RolesConfigPanel.test.ts` - New test file: copy, Delete button, confirm flow, save, add
- `src/types/roster.ts` - Fixed stale `defaultCount` doc-comment (Pitfall 2 bonus fix)
- `src/components/TeamsConfigPanel.vue` - Delete button class swap (R245), same treatment as Roles
- `src/components/__tests__/TeamsConfigPanel.test.ts` - Added one class assertion for the destructive button
- `src/views/RosterView.vue` - Added `max-w-4xl` to the roles/teams `v-show` wrappers (R244)
- `src/views/__tests__/RosterView.test.ts` - Added R244-scoped width-constraint test

## Decisions Made
- Delete button treatment: class swap only, reusing SettingsView's exact color family (`bg-red-900/20 hover:bg-red-900/40 text-red-400`) trimmed to the row's existing `text-xs px-3 py-1.5` sizing rather than the larger Settings `px-4 py-2 text-sm` form — Claude's discretion per CONTEXT.md, avoids visually dominating a dense table row.
- R246 wording: "Default count is the number of volunteers the scheduler auto-fills for this role each service." — the owner-suggested form from 83-RESEARCH.md, confirmed accurate by tracing `scheduler.ts`'s fill loop.
- Bundled the `roster.ts:9` doc-comment fix into Task 1 per RESEARCH's recommendation — zero-risk, same stale claim, avoids leaving a contradictory comment next to the just-corrected UI string.
- Width constraint applied at the RosterView tab-panel `v-show` level (not inside each child component) so both panels get it identically and the Volunteers table is unaffected.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched the plan's exact class strings, copy string, and injection points as specified in 83-RESEARCH.md.

## Issues Encountered

None. The full app suite (`npx vitest run`) was run after all edits and returned exactly the documented 2-file known-failing baseline (`src/storage.rules.test.ts` — Storage emulator's `firestore.exists()` cross-service limitation; `src/views/__tests__/RosterView.test.ts` — the pre-existing "wraps Roles config in CollapsibleSection" stale assertion), confirming no regressions. 144/146 test files passed (4285/4311 tests). `npm run type-check` (`vue-tsc --build`) is clean.

## User Setup Required

None - no external service configuration required. Client-only change; no rules/functions/deploy.

## Next Phase Readiness

This is the final phase of v2.2. Roles/Teams tab UX polish is complete: width-constrained, destructive Delete buttons in both panels, and accurate schedulable-roles copy. No blockers. Milestone-completion workflow (`/gsd-complete-milestone`) can proceed next.

---
*Phase: 83-roles-teams-tab-ux-copy*
*Completed: 2026-08-24*

## Self-Check: PASSED

All created/modified files verified present on disk; all 4 task commit hashes (f538281f, 1a1a1569, 9fc7054f, e40675a1) verified in git log.
