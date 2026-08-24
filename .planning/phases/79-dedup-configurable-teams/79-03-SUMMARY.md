---
phase: 79-dedup-configurable-teams
plan: 03
subsystem: ui
tags: [vue3, pinia, ai-song-suggestions, teams, dedup]

# Dependency graph
requires:
  - phase: 79-dedup-configurable-teams (wave 1)
    provides: useTeamsStore() (teams, subscribe, seedDefaultTeamsIfEmpty), Team type, DEFAULT_TEAMS
  - phase: 79-dedup-configurable-teams (79-02)
    provides: TeamsConfigPanel.vue, RosterView Teams tab (admin-facing team CRUD + song-tag filter select)
provides:
  - NewServiceDialog.vue and ServiceEditorView.vue's service-plan team checkboxes now render from teamsStore.teams (org-configured), not a hard-coded 4-item array
  - Empty-state hint on both surfaces when an org has zero configured teams
  - form.teams initializes to [] unconditionally — no ordinal-Sunday auto-selection (R231 removed)
  - filterSongsByTeamTags() — the single shared union-of-selected-team-tags AI song filter, replacing two duplicated Orchestra-only blocks
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consumer-side store repoint: v-for now iterates teamsStore.teams keyed by team.id, using team.name where the old array held plain strings"
    - "Editor-guarded subscribe + first-snapshot seed-watch (mirrors the roster/teams pattern already established in RosterView.vue) added to two more mount sites (ServiceEditorView, ServicesView)"
    - "Single shared filter helper (Set-based tag union) replacing copy-pasted inline boolean-filter logic at two call sites"

key-files:
  created: []
  modified:
    - src/components/NewServiceDialog.vue
    - src/components/__tests__/NewServiceDialog.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/ServicesView.vue
    - src/views/__tests__/ServicesView.test.ts

key-decisions:
  - "NewServiceDialog.vue is no longer Pinia-free — CONTEXT.md locks a shared Pinia teams store over prop-passing for this data, so the dialog's test-contract comment was corrected (not deleted) to describe the new reality instead of claiming a stale 'store-free' guarantee."
  - "The R231 ordinal-Sunday-auto-select regression test block was rewritten (not deleted) to assert the new empty-default behavior, per RESEARCH Pitfall 5 — a future regression reintroducing auto-selection would be caught here."
  - "fetchAiForSlot() (not suggestAllSongs()) was chosen as the test-drive path for the song-tag-filter describe block — it fires exactly one getSongSuggestions() call per invocation, whereas suggestAllSongs() loops once per SONG slot, making single-call assertions simpler without changing which code the tests exercise (both call sites share the same filterSongsByTeamTags() helper)."

requirements-completed: [R229, R230, R231, R241]

coverage:
  - id: D1
    description: "NewServiceDialog's checkbox row renders one pill per teamsStore.teams entry (not a fixed four); toggling still writes into form.teams"
    requirement: R229
    verification:
      - kind: unit
        ref: "src/components/__tests__/NewServiceDialog.test.ts#renders one checkbox pill per configured team, store-driven (R229/R241)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zero configured teams replaces the checkbox row with the empty-state hint on both NewServiceDialog and ServiceEditorView"
    requirement: R229
    verification:
      - kind: unit
        ref: "src/components/__tests__/NewServiceDialog.test.ts#renders the empty-state hint in place of the checkbox row when the org has no teams"
        status: pass
    human_judgment: false
  - id: D3
    description: "Opening the dialog on ANY Sunday initializes form.teams to [] — no ordinal-based pre-selection; no checkbox is ever pre-checked"
    requirement: R231
    verification:
      - kind: unit
        ref: "src/components/__tests__/NewServiceDialog.test.ts#starts with no teams pre-selected on the 5th-Sunday-skip-to-1st-Sunday date pair"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/NewServiceDialog.test.ts#starts with no teams pre-selected on the 2nd-Sunday-skip-to-3rd-Sunday date pair"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/NewServiceDialog.test.ts#renders no checkbox as checked in the UI regardless of the chosen Sunday"
        status: pass
    human_judgment: false
  - id: D4
    description: "ServiceEditorView's editor-branch checkbox row is store-driven (teamsStore.teams), viewer branch and 'Special' free-text field unchanged; teams subscribed+seeded editor-guarded on both ServiceEditorView and ServicesView"
    requirement: R229
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — existing 'Orchestra' checkbox-label test (line ~3192) still passes after the repoint"
        status: pass
      - kind: static
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
    human_judgment: false
  - id: D5
    description: "A single filterSongsByTeamTags() helper unions (OR) the songFilterTag of every selected team that has one; zero filtered teams uses the full pool; the legacy single-Orchestra case is preserved exactly"
    requirement: R230
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#a single selected team with a filter tag narrows the pool to that tag (legacy Orchestra case)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#two selected teams each with a filter tag UNION (OR) their tags, never intersect"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#zero selected teams carrying a filter tag uses the full candidate pool"
        status: pass
    human_judgment: false
  - id: D6
    description: "R241 de-dup complete: no hard-coded team-list literal and no duplicated isOrchestraService block remains in either consumer"
    requirement: R241
    verification:
      - kind: static
        ref: "grep -c \"isOrchestraService\" src/views/ServiceEditorView.vue -> 0"
        status: pass
      - kind: static
        ref: "grep -rn \"AVAILABLE_TEAMS|availableTeams = ['Choir'\" src/ -> no matches"
        status: pass
    human_judgment: false
  - id: D7
    description: "Full app suite stays at the pre-existing 2-file known-failing baseline; type-check clean"
    requirement: R229, R230, R231, R241
    verification:
      - kind: unit
        ref: "npx vitest run -> 2 failed files (storage.rules.test.ts, RosterView.test.ts), 4141 passed, 26 failed — identical to the documented baseline, zero new failures"
        status: pass
      - kind: static
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-08-24
status: complete
---

# Phase 79 Plan 03: Consumer Rewiring, De-dup & Ordinal Removal Summary

**Both service-plan team-checkbox surfaces and the AI song-suggestion filter now read the shared teams store instead of a hard-coded `['Choir','Orchestra','Communion','Special']` array and a twice-duplicated Orchestra-only filter — the ordinal-Sunday auto-team-selection is deleted outright.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-23T22:43:01-04:00 (first task commit)
- **Completed:** 2026-08-23T23:09:55-04:00 (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- `NewServiceDialog.vue`'s team checkbox row now iterates `teamsStore.teams` (keyed by `team.id`, labeled `team.name`) instead of a local `availableTeams` array, with an empty-state hint (`"No teams configured — add teams in Volunteers → Teams."`) when the org has zero teams.
- R231: `sundayOrdinal()`, the `defaultForm()` ordinal branch, and the date-change watcher's team mutation are all deleted — `form.teams` now initializes to `[]` unconditionally on every dialog open, on any Sunday.
- `ServiceEditorView.vue`'s editor-branch checkbox row is likewise repointed to `teamsStore.teams`, with the same empty-state hint; the read-only viewer branch and the `'Special'` free-text-name coupling are untouched, per 79-UI-SPEC.md.
- `initStores()` (ServiceEditorView) and `initStore()` (ServicesView) both subscribe + idempotently seed the teams store, editor-guarded exactly like roster/quarters already are — `ServicesView.vue` needed this too since it mounts `NewServiceDialog` unconditionally.
- `filterSongsByTeamTags(base, selectedTeamNames)` — one new helper reading `teamsStore.teams` — replaces the two duplicated `isOrchestraService` inline blocks in `suggestAllSongs()` and `fetchAiForSlot()`. Zero filtered teams returns the full pool; multiple filtered teams union (OR) their tags; the legacy single-Orchestra behavior is preserved exactly when Orchestra's `songFilterTag` is `'Orchestra'`.
- R241 de-dup verified by grep: `isOrchestraService` no longer appears anywhere in `ServiceEditorView.vue`; no hard-coded team-list literal remains in either consumer file.

## Task Commits

Each task was committed atomically (Task 2's checkbox-repoint work and Task 3's filter-helper work landed in the same file region, so they were split into separate commits by isolating each task's hunks rather than by natural git staging boundaries):

1. **Task 1: NewServiceDialog — store-driven checkboxes, empty default, test rewrite** - `caae5f0a` (feat)
2. **Task 2: ServiceEditorView + ServicesView — store-driven checkboxes, subscribe/seed, teams mock** - `f77bbeef` (feat)
3. **Task 3: Generic union-of-team-tags AI filter helper** - `f694c3ee` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/NewServiceDialog.vue` - Team checkbox row now iterates `teamsStore.teams`; deleted `availableTeams`, `sundayOrdinal()`, the `defaultForm()` ordinal branch, and the date-change watcher; `form.teams` starts `[]` unconditionally; empty-state hint added; corrected the stale "store-free" doc comment.
- `src/components/__tests__/NewServiceDialog.test.ts` - Added `setActivePinia(createPinia())` + `vi.mock('@/stores/teams')` (seeded with the 4 default teams); rewrote the "Task 3 — team side effect" describe block to assert the new empty-default behavior instead of the deleted ordinal auto-select; added a new empty-state describe block.
- `src/views/ServiceEditorView.vue` - Imports/instantiates `useTeamsStore()`; editor-branch checkbox `v-for` repointed to `teamsStore.teams`; empty-state hint added; `AVAILABLE_TEAMS` deleted; `initStores()` subscribes + seed-watches the teams store (editor-guarded); new `filterSongsByTeamTags()` helper replaces both `isOrchestraService` blocks in `suggestAllSongs()`/`fetchAiForSlot()`.
- `src/views/__tests__/ServiceEditorView.test.ts` - Added a `@/stores/teams` mock (4 default teams, `songFilterTag` optional per-team) and reset it in `beforeEach`; added `aiCandidateSongs` to the `@/stores/songs` mock and a `@/utils/claudeApi` mock (`getSongSuggestions` spy + safe stubs for the module's other two exports); added a new "song-tag filter (R230/R241)" describe block covering the single-tag, union, and zero-tag cases.
- `src/views/ServicesView.vue` - Imports/instantiates `useTeamsStore()`; `initStore()` now also subscribes + seed-watches the teams store, editor-guarded (needed because this view mounts `NewServiceDialog` unconditionally, and that dialog now reads the teams store directly).
- `src/views/__tests__/ServicesView.test.ts` - Added a `@/stores/teams` mock (deviation — see below) so mounting `ServicesView` (which unconditionally mounts `NewServiceDialog`) no longer throws "no active Pinia".

## Decisions Made
- `NewServiceDialog.vue`'s "store-free" design comment was updated to reflect the new reality (it now reads `useTeamsStore()` directly) rather than silently going stale or being deleted outright — CONTEXT.md's locked decision is a shared Pinia store, not prop-passing, for this data.
- The R231 regression test block was rewritten in place (not deleted), per RESEARCH Pitfall 5, to assert the new "no ordinal auto-selection" behavior.
- `fetchAiForSlot()` was the chosen test-drive path for the song-tag-filter unit tests (single call per invocation vs. `suggestAllSongs()`'s one-call-per-SONG-slot loop) — both functions share the same `filterSongsByTeamTags()` helper, so this doesn't reduce coverage of the actual dedup target.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a `@/stores/teams` mock to `ServicesView.test.ts`**
- **Found during:** Task 2 (ServiceEditorView + ServicesView — store-driven checkboxes, subscribe/seed, teams mock)
- **Issue:** The plan's `files_modified` list for this plan did not include `ServicesView.test.ts`, but `ServicesView.vue` mounts `NewServiceDialog` unconditionally (not behind a `v-if`), and both `ServicesView.vue` itself (Task 2) and `NewServiceDialog.vue` (Task 1) now call `useTeamsStore()` at setup. `ServicesView.test.ts` mounts the real component tree with every other store `vi.mock`-ed but no Pinia instance installed — running it after the repoint failed all 4 tests with `"[🍍]: getActivePinia() was called but there was no active Pinia."`
- **Fix:** Added `vi.mock('@/stores/teams', ...)` (seeded with the 4 default team names, mirroring the `@/stores/services` mock already in the file) and reset its state in the existing `beforeEach`.
- **Files modified:** `src/views/__tests__/ServicesView.test.ts`
- **Verification:** `npx vitest run src/views/__tests__/ServicesView.test.ts` — 4/4 pass.
- **Committed in:** `f77bbeef` (part of Task 2 commit)

**2. [Rule 3 - Blocking] Built AI-suggestion test infrastructure from scratch in `ServiceEditorView.test.ts`**
- **Found during:** Task 3 (Generic union-of-team-tags AI filter helper)
- **Issue:** RESEARCH's Test Map assumed an "existing Orchestra-tag assertion" to generalize, but no test in this file previously exercised `suggestAllSongs()`/`fetchAiForSlot()` at all — the `@/stores/songs` mock had no `aiCandidateSongs` getter and `@/utils/claudeApi` was entirely unmocked, so any call would have hit the real network-calling module.
- **Fix:** Added `aiCandidateSongs` to the songs store mock and a `@/utils/claudeApi` mock (a hoisted `getSongSuggestions` spy plus safe no-op stubs for `getScriptureSuggestions`/`splitCongregationalReading`, so `ScriptureInput.vue`/`CongregationalEditor.vue` — real child components mounted by OTHER tests in this same file — keep their existing never-called contract intact).
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** All 327 tests in the file pass, including the 3 new song-tag-filter tests.
- **Committed in:** `f694c3ee` (part of Task 3 commit)

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking test breakage caused by this plan's own store repoint, not scope creep).
**Impact on plan:** Both were necessary to keep the full suite at the documented 2-file baseline. No new test FILES were created and no unrelated behavior was changed; every addition mocks a dependency this plan's own code changes newly introduced.

## Issues Encountered
- Commit granularity: Task 2 and Task 3 both edited overlapping regions of `src/views/ServiceEditorView.vue` and its test file in the same working-tree pass. To honor the plan's per-task atomic-commit requirement, the Task-3-only hunks were isolated (via a scratch reverse-patch on the `.vue` file and precise line-range removal on the `.test.ts` file) so Task 2's commit reflects only the checkbox/subscribe/seed work and Task 3's commit reflects only the filter-helper work. Both intermediate states were independently verified (scoped test run + full type-check) before being committed.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 79's R228–R231/R241 requirement set is now fully implemented across all three plans (79-01 store, 79-02 editor panel, 79-03 consumer rewiring + de-dup).
- Manual verification of cross-tenant behavior (two orgs with different team lists seeing two different checkbox rows) is deferred to `/gsd-verify-work`, per this plan's own `<verification>` section.

---
*Phase: 79-dedup-configurable-teams*
*Completed: 2026-08-24*

## Self-Check: PASSED
- All modified files verified present on disk.
- All three task commits (caae5f0a, f77bbeef, f694c3ee) verified in git log.
