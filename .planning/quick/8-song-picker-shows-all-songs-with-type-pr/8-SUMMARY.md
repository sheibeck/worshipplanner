---
phase: quick-8
plan: 01
subsystem: song-slot-picker
tags: [suggestions, song-picker, vw-type, search, scoring]
dependency_graph:
  requires: []
  provides: [unfiltered-song-picker-with-type-priority]
  affects: [SongSlotPicker, rankSongsForSlot]
tech_stack:
  added: []
  patterns: [soft-priority-scoring, typeBonus]
key_files:
  created: []
  modified:
    - src/utils/suggestions.ts
    - src/utils/__tests__/suggestions.test.ts
    - src/components/SongSlotPicker.vue
decisions:
  - "typeBonus of +100 applied after base score calculation — ensures matching-type songs outrank non-matching at any recency level"
  - "Team filtering (AND logic) now operates on full song list (not post-type-filter), correctly including cross-type team-compatible songs"
  - "null vwType songs receive 0 typeBonus (not filtered out), appear in results below matching-type songs"
metrics:
  duration: 3
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 8: Song Picker Shows All Songs with VW Type Priority — Summary

**One-liner:** Replaced hard VW type gate with soft +100 score bonus so SongSlotPicker suggestions and search show all songs with matching-type songs sorted first.

## What Was Built

The song slot picker previously hard-filtered to only show songs matching the slot's required VW type. Users couldn't see or pick any song outside that type. This change removes the gate:

- `rankSongsForSlot` in `src/utils/suggestions.ts` — removed the `songs.filter(s => s.vwType === requiredVwType)` line; now all songs pass through team filtering. Added `typeBonus = song.vwType === requiredVwType ? 100 : 0` applied after the base recency/staleness score. Matching-type songs always rank above equivalent non-matching songs.

- `SongSlotPicker.vue` search — removed `.filter((s) => s.vwType === props.requiredVwType)` from the `searchResults` computed. Added a `.sort()` that places matching-type songs first. The existing `SongBadge` already renders the VW type badge next to every result, so the user can see each song's type at a glance.

- Empty state message updated from "No songs with this category." to "No songs in your library." since the picker no longer filters by category.

## Scoring After Change

| Song scenario | Base score | typeBonus | Total |
|---------------|-----------|-----------|-------|
| Never used, matching type | 500 | +100 | 600 |
| Never used, non-matching/null | 500 | +0 | 500 |
| Stale (3 weeks), matching | 245 | +100 | 345 |
| Stale (3 weeks), non-matching | 245 | +0 | 245 |
| Recent (1 week), matching | 60 | +100 | 160 |
| Recent (1 week), non-matching | 60 | +0 | 60 |

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace hard VW type filter with priority scoring | d39c4c3 | suggestions.ts, suggestions.test.ts |
| 2 | Remove hard VW type filter from SongSlotPicker search | 54106ae | SongSlotPicker.vue |

## Test Results

- `suggestions.test.ts`: 23 tests pass (12 new/updated tests covering priority sort, typeBonus, null vwType inclusion)
- `ServiceEditorView.test.ts`: 3 tests pass
- Full suite: 236 tests across 16 files — all green, zero regressions

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/utils/suggestions.ts` — typeBonus implemented, hard filter removed
- [x] `src/utils/__tests__/suggestions.test.ts` — VW type prioritization tests updated
- [x] `src/components/SongSlotPicker.vue` — search unfiltered with priority sort
- [x] Commit d39c4c3 exists (Task 1)
- [x] Commit 54106ae exists (Task 2)
- [x] Full test suite: 236/236 passing

## Self-Check: PASSED
