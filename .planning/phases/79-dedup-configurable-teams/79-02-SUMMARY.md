---
phase: 79-dedup-configurable-teams
plan: 02
subsystem: ui
tags: [vue3, pinia, tailwind, teams, accessibility]

# Dependency graph
requires:
  - phase: 79-dedup-configurable-teams (wave 1)
    provides: useTeamsStore() (subscribe/addTeam/updateTeam/deleteTeam/seedDefaultTeamsIfEmpty), Team type, DEFAULT_TEAMS
provides:
  - TeamsConfigPanel.vue — accessible-from-the-start Teams editor (draft + explicit Save, inline soft-warn delete-confirm, Add-Team row, per-team song-tag filter select)
  - A third "Teams" tab in RosterView.vue, mounted beside Volunteers/Roles
  - RosterView subscribes teamsStore + songStore and seeds team defaults on first load
affects: [79-03 (service-plan checkboxes + AI song-tag filter consuming the teams store)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-row draft + explicit Save (no autosave) mirrored exactly from RolesConfigPanel.vue for a second config-list surface (Teams)"
    - "Inline soft-warn delete-confirm panel (not a modal, not a hard block) reused across Roles and Teams editors"

key-files:
  created:
    - src/components/TeamsConfigPanel.vue
    - src/components/__tests__/TeamsConfigPanel.test.ts
  modified:
    - src/views/RosterView.vue
    - src/views/__tests__/RosterView.test.ts
    - src/views/__tests__/RosterViewEditQuery.test.ts

key-decisions:
  - "TeamsConfigPanel.vue copies RolesConfigPanel.vue's outer shape verbatim but drops the group-badge section entirely — teams are a single flat list, per 79-CONTEXT.md/79-UI-SPEC.md."
  - "Every team-name input and song-tag select gets a real :aria-label (not placeholder-only) — the one deliberate a11y deviation from copying Roles verbatim, per CONTEXT.md."
  - "onUnmounted calls teamsStore.unsubscribeAll() (mirroring rosterStore's existing teardown) but deliberately does NOT call songStore.unsubscribeAll() — songStore is a broadly shared org-scoped store (Songs page, Service editor, Dashboard) whose lifecycle is owned by resetOrgScopedStores() on church switch, not by any single view's unmount."

requirements-completed: [R228, R230]

coverage:
  - id: D1
    description: "TeamsConfigPanel renders one editable row per team with a name input (draft) and a song-tag select, explicit 'Save Team' commits the draft to the store (not on keystroke)"
    requirement: R228
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#renders one row per team, ordered"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#editing a name then clicking Save Team calls updateTeam with the draft — not on every keystroke"
        status: pass
    human_judgment: false
  - id: D2
    description: "Delete reveals an inline soft-warn confirm (not a hard block); Cancel dismisses, confirming calls deleteTeam"
    requirement: R228
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#clicking Delete reveals an inline soft-warn confirm; Cancel dismisses without deleting; confirming calls deleteTeam"
        status: pass
    human_judgment: false
  - id: D3
    description: "Add-Team row calls addTeam with name/order/songFilterTag and clears its inputs afterward"
    requirement: R228
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#Add-Team row calls addTeam with name/order/songFilterTag and clears the inputs afterward"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-team song-tag select lists 'No filter' + songStore.allUserTags, reflects the team's songFilterTag, and still renders (never disabled) with zero song tags"
    requirement: R230
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#song-tag select shows \"No filter\" + one option per allUserTags entry and reflects the team songFilterTag"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#the song-tag select still renders (only \"No filter\") and is never disabled when there are zero song tags"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every team name input and song-tag select carries a real, non-empty aria-label (accessible from the start)"
    requirement: R228
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts#every team name input and song-tag select has a non-empty aria-label"
        status: pass
    human_judgment: false
  - id: D6
    description: "A 'Teams' tab appears in RosterView's tab bar next to Volunteers and Roles, mounts TeamsConfigPanel, and RosterView subscribes teamsStore/songStore and seeds defaults on first load"
    requirement: R228
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
      - kind: unit
        ref: "npx vitest run — full suite at the pre-existing 2-file baseline (storage.rules.test.ts, RosterView.test.ts), zero new failures introduced by the RosterView.vue Teams-tab wiring"
        status: pass
    human_judgment: true
    rationale: "Visual tab-bar placement, mount timing, and end-to-end add/rename/delete round-trip against a live Firestore org are deferred to /gsd-verify-work per the plan's own verification section — no Playwright/e2e harness exists for this surface yet."

# Metrics
duration: 55min
completed: 2026-08-24
status: complete
---

# Phase 79 Plan 02: Teams Editor Panel Summary

**New accessible-from-the-start Teams tab in RosterView.vue — TeamsConfigPanel.vue mirrors RolesConfigPanel.vue's draft+Save+soft-warn-delete UX as a flat list, adds a per-team song-tag filter select, and RosterView seeds/subscribes it on first load.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-23T22:12:00Z (approx, per session start)
- **Completed:** 2026-08-24T02:37:02Z
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `TeamsConfigPanel.vue` — a new editable Teams list copying `RolesConfigPanel.vue`'s shape exactly (no group badges, per-row draft + explicit "Save Team", inline soft-warn delete-confirm, Add-Team row at the bottom), plus a per-team optional song-tag `<select>` over `songStore.allUserTags` defaulting to "No filter" and never disabled.
- Every team-name input and song-tag select carries a real `aria-label` — ships accessible from the start, per 79-CONTEXT.md.
- `RosterView.vue` gains a third "Teams" tab (after Roles), subscribes `teamsStore` + `songStore`, and seeds the 4 default teams on the first snapshot of an org with none — mirroring the existing roles seed-watch guard exactly.
- 8 new component tests cover row rendering/ordering, save-on-click-not-keystroke, the song-tag select's option list (including the zero-tags case), soft-warn delete confirm/cancel, Add-Team, aria-labels, and the empty state.

## Task Commits

Each task was committed atomically:

1. **Task 1: TeamsConfigPanel.vue + component test** - `45ac2184` (feat)
2. **Task 2: Mount the Teams tab in RosterView and seed on load** - `a8a05fe8` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/TeamsConfigPanel.vue` - New Teams editor panel (flat list, draft+Save, soft-warn delete, Add row, song-tag filter select, aria-labels).
- `src/components/__tests__/TeamsConfigPanel.test.ts` - 8 tests covering the behavior contract above.
- `src/views/RosterView.vue` - Adds the "Teams" tab button, widens `activeTab` to include `'teams'`, mounts `<TeamsConfigPanel />`, subscribes `teamsStore`/`songStore` in `initStore()` with a first-snapshot seed-watch, and unsubscribes `teamsStore` (not `songStore`) on unmount.
- `src/views/__tests__/RosterView.test.ts` - Added `vi.mock('@/stores/teams')` / `vi.mock('@/stores/songs')` and a `TeamsConfigPanel` stub so the file's existing (store-mocked) mount pattern still works now that `RosterView.vue` itself calls `useTeamsStore()`/`useSongStore()`.
- `src/views/__tests__/RosterViewEditQuery.test.ts` - Same store-mock + stub addition as above (this file also mounts `RosterView`).

## Decisions Made
- Teams editor is a single flat list — no group badges, unlike Roles' band/tech/vocals/other groups (per 79-CONTEXT.md/79-UI-SPEC.md).
- Accessibility is the one deliberate deviation from copying Roles verbatim: real `aria-label`s on every name input and song-tag select, without restructuring the single-line flex row.
- `teamsStore.unsubscribeAll()` is called on RosterView unmount (mirrors the existing `rosterStore.unsubscribeAll()` teardown); `songStore.unsubscribeAll()` is deliberately NOT called there, since `songStore` is a broadly shared org-scoped store whose teardown is owned by `resetOrgScopedStores()` on church switch, not by any single view.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked `@/stores/teams` and `@/stores/songs` in `RosterView.test.ts` and `RosterViewEditQuery.test.ts`**
- **Found during:** Task 2 (Mount the Teams tab in RosterView and seed on load)
- **Issue:** `RosterView.vue`'s script setup now calls `useTeamsStore()` and `useSongStore()` directly (for the new Teams tab's subscribe/seed logic). Neither test file previously mocked those stores or installed a real Pinia instance — they only mock `@/stores/roster` and stub `RolesConfigPanel`. Running the full suite after the RosterView.vue edit showed all 12 tests in `RosterView.test.ts` and all 3 tests in `RosterViewEditQuery.test.ts` newly failing with `"[🍍]: getActivePinia() was called but there was no active Pinia"` — a direct, blocking regression caused by this task's own change, not a pre-existing issue.
- **Fix:** Added `vi.mock('@/stores/teams', ...)` and `vi.mock('@/stores/songs', ...)` (mirroring the existing `@/stores/roster` mock pattern in each file) plus a `TeamsConfigPanel: { template: '<div />' }` stub to both test files' `mountRosterView()` helper.
- **Files modified:** `src/views/__tests__/RosterView.test.ts`, `src/views/__tests__/RosterViewEditQuery.test.ts`
- **Verification:** Full suite re-run after the fix: `RosterViewEditQuery.test.ts` 3/3 pass; `RosterView.test.ts` back down to its single pre-existing known-failing assertion ("Roles config" stale text, unrelated to this phase). Full `npx vitest run`: 2 failed files (`storage.rules.test.ts` — emulator timeouts, `RosterView.test.ts` — the one stale assertion), 4136 passed / 26 failed tests — identical failing-file set to the documented CLAUDE.md baseline, zero new failures.
- **Committed in:** `a8a05fe8` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the full suite at the documented 2-file baseline per the plan's own verification criteria. No scope creep — both files were already RosterView-mounting test files whose mocks needed to track RosterView.vue's new store dependencies; no new test files or unrelated changes were introduced.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `TeamsConfigPanel.vue` and the "Teams" tab are ready for a church admin to add/rename/delete teams and set a song-tag filter, backed by the wave-1 `useTeamsStore()`.
- 79-03 can now wire the service-plan team checkboxes (`NewServiceDialog.vue`, `ServiceEditorView.vue`) and the AI song-suggestion tag filter to `useTeamsStore()`, replacing the hard-coded `AVAILABLE_TEAMS` array and the Orchestra-only filter, per 79-UI-SPEC.md sections 2 and 3.
- Manual verification of visual parity with the Roles panel and a live add/rename/delete round-trip against Firestore is deferred to `/gsd-verify-work`, per this plan's own `<verification>` section.

---
*Phase: 79-dedup-configurable-teams*
*Completed: 2026-08-24*

## Self-Check: PASSED
- All created/modified files verified present on disk.
- Both task commits (45ac2184, a8a05fe8) verified in git log.
