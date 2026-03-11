---
phase: 09-pc-song-import-tag-management
plan: "01"
subsystem: database
tags: [pinia, firestore, vue, typescript, soft-delete, upsert]

# Dependency graph
requires:
  - phase: 02-song-library
    provides: "Song type, Pinia store, filteredSongs computed"
provides:
  - "Song interface extended with pcSongId and hidden fields"
  - "UpsertSongInput type for batch upsert operations"
  - "filteredSongs computed excludes hidden songs (invisible to UI and AI)"
  - "deleteSong soft-delete via updateDoc hidden:true"
  - "restoreSong via updateDoc hidden:false"
  - "upsertSongs additive import with pcSongId/ccliNumber/title matching, preserved hidden status, conditional vwType"
affects: [09-02, 09-03, phase-06-ai-suggestions, song-library-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-delete via hidden:boolean field instead of hard deleteDoc"
    - "Upsert matching order: pcSongId (primary key) > ccliNumber (non-empty) > title (lowercase)"
    - "Hidden flag preserved on upsert — import never unhides previously hidden songs"
    - "vwType conditional update — null incoming value skips field to preserve user-set type"
    - "O(1) lookup Maps built from songs.value before batch upsert"

key-files:
  created: []
  modified:
    - src/types/song.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts

key-decisions:
  - "Song.hidden uses strict equality check (=== true) so legacy docs without the field pass through as visible"
  - "UpsertSongInput exported from song.ts (not songs.ts) so Plans 02 and 03 can import the type cleanly"
  - "upsertSongs uses individual addDoc/updateDoc calls (not writeBatch) to enable easy per-song error isolation in future"
  - "vwType omitted from update payload entirely when null — not set to null — so Firestore does not overwrite existing value"

patterns-established:
  - "Soft-delete pattern: updateDoc with hidden:true instead of deleteDoc — enables restore workflow"
  - "Upsert with preserved fields: destructure incoming data, override preserved fields explicitly before spreading"

requirements-completed:
  - soft-delete
  - hidden-exclusion
  - re-import-safe
  - upsert-store

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 9 Plan 01: Song Type Extension Summary

**Song soft-delete and upsert foundation: pcSongId + hidden fields on Song type, filteredSongs excludes hidden, deleteSong is now a soft-delete, restoreSong and upsertSongs added with pcSongId/ccliNumber/title matching and hidden preservation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T17:24:10Z
- **Completed:** 2026-03-11T17:28:18Z
- **Tasks:** 1 (TDD)
- **Files modified:** 3

## Accomplishments
- Extended Song interface with `pcSongId: string | null` and `hidden: boolean`
- Added `UpsertSongInput` type exported from song.ts for use in Plans 02 and 03
- `filteredSongs` computed now excludes hidden songs (`song.hidden === true` strict check preserves legacy docs)
- `deleteSong` converted from hard-delete (`deleteDoc`) to soft-delete (`updateDoc` with `hidden: true`)
- Added `restoreSong` to flip `hidden: false` via `updateDoc`
- Added `upsertSongs` with O(1) Map lookups, three-level matching (pcSongId > ccliNumber > title), preserved hidden status, and conditional vwType update
- 34 tests green including 10 new tests for all new behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Song type + update store with soft-delete and upsert** - `d29db8c` (feat)

**Plan metadata:** (created in this summary commit)

_Note: TDD task — test file updated in same commit as implementation (RED confirmed on unmodified store, GREEN after implementation)_

## Files Created/Modified
- `src/types/song.ts` - Added `pcSongId: string | null`, `hidden: boolean`, exported `UpsertSongInput` type
- `src/stores/songs.ts` - filteredSongs hidden check, soft-delete deleteSong, new restoreSong, new upsertSongs with match logic
- `src/stores/__tests__/songs.test.ts` - Added 10 new tests covering hidden filter (3), deleteSong soft-delete (1), restoreSong (1), upsertSongs (5); updated makeSong helper with pcSongId/hidden defaults

## Decisions Made
- `song.hidden === true` strict equality used in filteredSongs so legacy Firestore docs without the field are treated as visible without migration
- `UpsertSongInput` placed in `src/types/song.ts` (not the store) so downstream consumers (Plans 02, 03) can import the type without coupling to the store module
- `upsertSongs` uses individual `addDoc`/`updateDoc` calls rather than `writeBatch` to simplify implementation while keeping the batch chunking pattern available for future optimization
- When incoming `vwType` is null, the field is omitted entirely from the Firestore update payload rather than being set to null — this preserves any user-configured type on the song

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01 contracts fully established: Song type with pcSongId/hidden, upsertSongs store method, filteredSongs hidden-aware
- Plan 02 (PC API fetch and upsert) can now call `store.upsertSongs(mappedSongs)` with `UpsertSongInput[]`
- Plan 03 (UI for hidden songs / restore) can call `store.deleteSong(id)` and `store.restoreSong(id)` and read `songs.value` for all songs vs `filteredSongs` for visible

---
*Phase: 09-pc-song-import-tag-management*
*Completed: 2026-03-11*
