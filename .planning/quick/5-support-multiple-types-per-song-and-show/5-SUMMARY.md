---
phase: quick-5
plan: 5
subsystem: song-library, service-editor
tags: [vwTypes, multi-type, song-classification, PC-import, ui]
dependency_graph:
  requires: []
  provides: [Song.vwTypes array, multi-badge SongBadge, dynamic service slot type display]
  affects: [SongBadge, SongSlideOver, SongSlotPicker, SongTable, ServiceEditorView, SongsView, DashboardView, songs store, pcSongImport, suggestions]
tech_stack:
  added: []
  patterns: [vwTypes array normalization on Firestore read, multi-select toggle array]
key_files:
  created: []
  modified:
    - src/types/song.ts
    - src/utils/pcSongImport.ts
    - src/stores/songs.ts
    - src/utils/suggestions.ts
    - src/components/SongBadge.vue
    - src/components/SongSlideOver.vue
    - src/components/SongSlotPicker.vue
    - src/components/SongTable.vue
    - src/views/ServiceEditorView.vue
    - src/views/SongsView.vue
    - src/views/DashboardView.vue
    - src/utils/__tests__/pcSongImport.test.ts
    - src/stores/__tests__/songs.test.ts
    - src/utils/__tests__/suggestions.test.ts
    - src/components/__tests__/SongBadge.test.ts
    - src/utils/__tests__/planningCenterApi.test.ts
decisions:
  - "Song.vwTypes: VWType[] replaces vwType: VWType | null — empty array means uncategorized"
  - "Firestore normalization on read: legacy vwType scalar converted to [vwType], null to []"
  - "upsertSongs preserves existing vwTypes when incoming is empty (mirrors old null guard)"
  - "Service slot badge shows selected song vwTypes, nothing when slot has no song assigned"
  - "SongBadge rendered in inline-flex gap-1 container to handle multiple badges gracefully"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_modified: 16
---

# Quick Task 5: Multi-type support per song and dynamic service slot type display

**One-liner:** Songs now store `vwTypes: VWType[]` supporting simultaneous Type 1/2/3 assignment; PC import captures all matching category tags; service editor slots show the selected song's actual type badges.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migrate Song type to vwTypes array and update data/logic layer | a6f584f | song.ts, pcSongImport.ts, songs.ts, suggestions.ts |
| 2 | Update UI components for multi-type display | 2a9ecbc | SongBadge.vue, SongSlideOver.vue, SongSlotPicker.vue, ServiceEditorView.vue |

## What Was Built

### Data Layer (Task 1)
- `Song.vwTypes: VWType[]` replaces `vwType: VWType | null` — empty array is the uncategorized state
- `UpsertSongInput` automatically inherits the change via Omit
- Firestore onSnapshot handler normalizes legacy documents: `vwType: 2` becomes `vwTypes: [2]`, `vwType: null` becomes `vwTypes: []`
- `pcSongImport.mapPcSongToUpsert` collects ALL matching category tags instead of stopping at the first — a song with Category 1 and Category 3 tags gets `vwTypes: [1, 3]`
- `filteredSongs` computed: uncategorized filter uses `vwTypes.length === 0`, type filter uses `vwTypes.includes()`
- `upsertSongs` update path: includes `vwTypes` only when incoming is non-empty (preserves user-set classification when PC import has no category tags)
- `rankSongsForSlot` type bonus uses `song.vwTypes.includes(requiredVwType)`

### UI Layer (Task 2)
- `SongBadge` now accepts `types: VWType[]` — renders one badge span per type in an `inline-flex gap-1` wrapper, dash span for empty array
- `SongSlideOver` form state uses `vwTypes: VWType[]` — toggle function adds/removes from array instead of set/null
- `SongSlotPicker` search sort comparator and all three badge usages updated to `vwTypes`
- `SongTable` badge updated to `vwTypes`
- `ServiceEditorView` song slot header: replaced static `<SongBadge :type="slot.requiredVwType" />` with dynamic lookup by `slot.songId` in `songStore.songs`; badge hidden when no song assigned
- `SongsView` and `DashboardView` uncategorized counts updated to `vwTypes.length === 0`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tag resolution bug in fetchAllPcSongs**
- **Found during:** Task 1 (tests failing)
- **Issue:** Operator precedence bug: `song.relationships?.tags?.data ?? [] .map(...).filter(...)` evaluated as `(data) ?? ([] .map().filter())` — tags were never resolved, only raw `{ type, id }` refs returned
- **Fix:** Split into `const tagRefs = ... ?? []` then `tagRefs.map(...).filter(...)`
- **Files modified:** src/utils/pcSongImport.ts
- **Commit:** a6f584f

**2. [Rule 1 - Bug] Fixed makeArrangement helper missing key field in pcSongImport tests**
- **Found during:** Task 1
- **Issue:** Test helper `makeArrangement(id, name)` didn't include `key`, causing `arr.key` to be undefined when the test expected `''`
- **Fix:** Added `key: string = ''` default parameter to helper
- **Files modified:** src/utils/__tests__/pcSongImport.test.ts
- **Commit:** a6f584f

**3. [Rule 1 - Bug] Fixed planningCenterApi test expectation for arrangement shape**
- **Found during:** Task 2 full test run
- **Issue:** `fetchSongArrangements` already returned `{ id, name, key }` but test expected `{ id, name }` and mock didn't include `chord_chart_key`
- **Fix:** Updated mock to include `chord_chart_key` and test expectation to include `key`
- **Files modified:** src/utils/__tests__/planningCenterApi.test.ts
- **Commit:** 2a9ecbc

**4. [Rule 1 - Bug] Updated suggestions.test.ts fixtures from vwType to vwTypes**
- **Found during:** Task 2 full test run
- **Issue:** suggestions.test.ts used `vwType: 1` (old scalar field) in all fixtures
- **Fix:** Updated makeSong helper and all fixture usages to use `vwTypes: [1]` etc.
- **Files modified:** src/utils/__tests__/suggestions.test.ts
- **Commit:** 2a9ecbc

## Test Results

All 384 tests pass across 20 test files.

New tests added:
- Multi-category PC import maps to `vwTypes: [1, 2]`, `[1, 3]`, `[1, 2, 3]`
- Firestore legacy normalization (scalar → array, null → [])
- `vwTypes` preserved when incoming is empty (upsertSongs)
- Multi-type song gets type bonus when one type matches (suggestions)
- SongBadge renders two spans for `types: [1, 2]`

## Self-Check: PASSED

- src/types/song.ts: FOUND (vwTypes: VWType[])
- src/components/SongBadge.vue: FOUND (types: VWType[] prop)
- src/views/ServiceEditorView.vue: FOUND (dynamic vwTypes lookup)
- Commit a6f584f: FOUND
- Commit 2a9ecbc: FOUND
