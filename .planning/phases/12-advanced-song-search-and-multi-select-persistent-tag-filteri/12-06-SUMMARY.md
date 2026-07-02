---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
plan: 06
subsystem: ui
tags: [vue, pinia, filters, tag-filter, gap-closure]

# Dependency graph
requires:
  - phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri (Plan 03)
    provides: shared TagFilterChecklist component and tagFilterChecked/tagFilterHide store state (D-08/D-09/D-10)
provides:
  - Single unified Songs-panel tag control fed by the union of teamTags/themes/tags
  - Removal of the redundant teamTags-only "All tags" select and its filterTag store state
affects: [12-uat, songs-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [union-of-fields client-side filter matching]

key-files:
  created: []
  modified:
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
    - src/components/SongFilters.vue
    - src/views/SongsView.vue

key-decisions:
  - "Kept teamTags, themes, and tags as three separate Song fields (Option A) — only the UI/filter surface was unified, not the data model"
  - "Store removal of filterTag and the SongFilters/SongsView template binding removal landed in a single atomic commit to keep vue-tsc --build green at every commit boundary"

patterns-established:
  - "Union-of-fields tag matching: carriesChecked checks teamTags, themes, and tags with .some(), OR'd together, then show/hide toggle inverts the result"

requirements-completed: [D-06, D-08, D-09, D-10]

# Metrics
duration: ~20min
completed: 2026-07-02
---

# Phase 12 Plan 06: Unify Songs-panel tag filter Summary

**Songs panel now filters through one combined tag checklist sourced from the union of teamTags ∪ themes ∪ tags, with the redundant teamTags-only "All tags" select and filterTag store state fully removed.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-02T21:19:42Z
- **Tasks:** 1 (atomic, per plan's atomicity note)
- **Files modified:** 4

## Accomplishments
- Widened `filteredSongs` in the songs store to match a song when any checked value appears in `teamTags`, `themes`, OR `tags` (union), in both show and hide modes
- Removed the `filterTag` ref, `matchesTag` branch, and store export entirely
- Removed the teamTags "All tags" `<select>` and its `filterTag`/`availableTags` prop/emit from `SongFilters.vue`, keeping the VW-type and Key selects (D-06) and the shared `TagFilterChecklist`
- Widened `SongsView.vue`'s `availableUserTags` computed to the de-duplicated, sorted union of all three tag fields and removed the now-unused `availableTags` computed and binding
- Updated store tests: converted the teamTags-only filter tests to drive `tagFilterChecked`, and added three new tests proving the union (themes match, teamTags match, hide-mode themes exclusion)

## Task Commits

Each task was committed atomically:

1. **Task 1: Unify the Songs-panel tag filter to the three-field union and remove filterTag (store + SongFilters + SongsView + tests) in ONE atomic commit** - `e362a41` (fix)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `src/stores/songs.ts` - Removed `filterTag` ref/branch/export; widened `carriesChecked` to `teamTags ?? [] .some() || themes ?? [] .some() || tags ?? [] .some()`
- `src/stores/__tests__/songs.test.ts` - Converted 2 existing tests from `store.filterTag = 'Choir'` to `store.tagFilterChecked = new Set(['Choir'])`; added 3 new union-coverage tests
- `src/components/SongFilters.vue` - Removed the teamTags "All tags" `<select>` block and its `filterTag`/`availableTags` props and `update:filterTag` emit
- `src/views/SongsView.vue` - Removed `v-model:filterTag` and `:availableTags` bindings and the `availableTags` computed; widened `availableUserTags` computed to the three-field union

## Decisions Made
- Followed the plan's Option A scope guard exactly: no data-model merge, `teamTags`/`themes`/`tags` remain three separate `Song` fields; Planning Center import (`upsertSongs`/`importSongs`) and the Phase 10 orchestra suggestion filter were not touched.
- Store, component, and view changes landed in a single commit per the plan's atomicity note, since splitting them would leave `vue-tsc --build` broken at an intermediate commit (template bindings reference store fields removed in the same change).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

First `npx vitest run` invocation hit a transient `vitest-pool-runner: Timeout waiting for worker to respond` error unrelated to the code changes (worker pool startup flake on this machine). Re-ran the identical command and all 60 tests passed cleanly. No code or plan changes required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The Songs panel now presents exactly one tag control (VW-type select, Key select, combined tag checklist) — the UAT test-3 complaint about a duplicate teamTags dropdown is resolved on the Songs panel side.
- `grep -rn "filterTag\b"` across the store/component/view returns no matches; `grep -n "store.filterTag"` in the test file returns no matches.
- `npm run type-check`, `npm run build-only`, and `npx vitest run src/stores/__tests__/songs.test.ts` all pass.
- Ready for re-UAT verification of the Songs panel tag filtering, and for any remaining gap-closure plans (12-07, 12-08) that address other UAT findings.

---
*Phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/stores/songs.ts
- FOUND: src/components/SongFilters.vue
- FOUND: src/views/SongsView.vue
- FOUND: src/stores/__tests__/songs.test.ts
- FOUND: .planning/phases/12-advanced-song-search-and-multi-select-persistent-tag-filteri/12-06-SUMMARY.md
- FOUND: commit e362a41
