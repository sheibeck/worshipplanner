---
phase: 10
plan: "02"
subsystem: suggestions
tags: [suggestions, song-picker, orchestra, scoring, tdd]
dependency_graph:
  requires: []
  provides: [orchestra-soft-scoring, orchestra-visual-dimming, orchestra-search-sort]
  affects: [SongSlotPicker.vue, suggestions.ts]
tech_stack:
  added: []
  patterns: [soft-bonus scoring, :class array binding, computed sort predicate]
key_files:
  created: []
  modified:
    - src/utils/suggestions.ts
    - src/utils/__tests__/suggestions.test.ts
    - src/components/SongSlotPicker.vue
decisions:
  - "Orchestra treated as soft +200 scoring bonus rather than hard AND-logic filter (D-07)"
  - "nonOrchestraTeams splits serviceTeams to preserve Choir/other AND-logic while exempting Orchestra from hard filter"
  - "isNonOrchestraSong helper in SongSlotPicker drives opacity-50 binding in both By Rotation and Search Results sections (D-08)"
  - "Orchestra-first sort in searchResults uses teamTags.includes('Orchestra') as primary sort key before VW type secondary sort"
  - "Pre-existing test 'excludes songs missing any required team tag' revised to use SpecialService instead of Orchestra to correctly test non-Orchestra AND-exclusion"
metrics:
  duration_seconds: 514
  completed_date: "2026-04-15T20:24:05Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 10 Plan 02: Orchestra Soft Scoring Bonus + Visual Dimming Summary

Orchestra scoring and visual treatment: `rankSongsForSlot` now gives orchestra-tagged songs a +200 soft scoring bonus (replacing the hard filter), and `SongSlotPicker` dims non-orchestra songs with `opacity-50` and sorts orchestra songs first in search results.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Update rankSongsForSlot orchestra handling + tests | d8a7c17 | src/utils/suggestions.ts, src/utils/__tests__/suggestions.test.ts |
| 2 | Add orchestra visual dimming + orchestra-first search sort | be76fc4 | src/components/SongSlotPicker.vue |

## What Was Built

### Task 1: rankSongsForSlot orchestra scoring (TDD)

**RED:** Added 4 new failing tests in `describe('rankSongsForSlot - orchestra scoring bonus')` plus revised the Orchestra-only team-filter test to expect all songs to appear (not just the universal one).

**GREEN:** Modified `src/utils/suggestions.ts`:
- Split `serviceTeams` into `hasOrchestra` flag and `nonOrchestraTeams` array
- Hard filter now uses `nonOrchestraTeams` instead of `serviceTeams` — Orchestra no longer blocks non-orchestra songs
- Added `orchestraBonus = hasOrchestra && song.teamTags.includes('Orchestra') ? 200 : 0` to scoring
- Updated JSDoc to document the split behavior

All 28 tests pass (4 new orchestra scoring bonus tests + 24 pre-existing tests).

### Task 2: SongSlotPicker visual dimming + search sort

Modified `src/components/SongSlotPicker.vue`:
- Added `isOrchestraService = computed(() => props.serviceTeams.includes('Orchestra'))`
- Added `isNonOrchestraSong(song)` helper function
- Changed "By Rotation" button from static `class` to `:class` array binding with `opacity-50` conditional
- Changed "Search Results" button from static `class` to `:class` array binding with `opacity-50` conditional
- Updated `searchResults` computed to sort orchestra-tagged songs first when `isOrchestraService` is true, before the existing VW type secondary sort

TypeScript (`vue-tsc --noEmit`) and full test suite pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test asserted wrong exclusion for Choir+Orchestra serviceTeams**

- **Found during:** Task 1 GREEN phase
- **Issue:** Test `'excludes songs missing any required team tag'` used `serviceTeams: ['Choir', 'Orchestra']` with a song tagged `['Choir']` and asserted `length === 0`. Under the new logic, Orchestra is excluded from the AND-filter so `nonOrchestraTeams = ['Choir']` — the `['Choir']`-tagged song now correctly passes. The test was asserting the old hard-filter behavior.
- **Fix:** Changed test to use `['Choir', 'SpecialService']` as serviceTeams so it correctly tests AND-exclusion for non-Orchestra teams (song has `['Choir']` but lacks `'SpecialService'`, so it is excluded). Test description updated to `'excludes songs missing a required non-Orchestra team tag'`.
- **Files modified:** src/utils/__tests__/suggestions.test.ts
- **Commit:** d8a7c17

## Known Stubs

None — all functionality is fully implemented and wired.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Changes are purely client-side scoring logic and CSS class bindings.

## TDD Gate Compliance

- RED gate commit: d8a7c17 (test commit via feat — RED and GREEN combined per plan's step A/B/C structure within same commit)
- GREEN gate: All 28 tests pass including 4 new orchestra scoring bonus tests
- Note: Per plan instructions, RED test writing and GREEN implementation were done in sequence within Task 1 and committed together after GREEN passed

## Self-Check

Files created/modified:
- src/utils/suggestions.ts: FOUND
- src/utils/__tests__/suggestions.test.ts: FOUND
- src/components/SongSlotPicker.vue: FOUND

Commits:
- d8a7c17: feat(10-02): orchestra becomes +200 soft bonus instead of hard filter in rankSongsForSlot
- be76fc4: feat(10-02): dim non-orchestra songs with opacity-50 and sort orchestra-first in search

## Self-Check: PASSED
