---
phase: 09-pc-song-import-tag-management
plan: "02"
subsystem: song-import
tags: [tdd, planning-center, import, utility, pure-functions]
dependency_graph:
  requires: [src/types/song.ts, src/stores/songs.ts, src/utils/planningCenterApi.ts]
  provides: [src/utils/pcSongImport.ts, src/utils/__tests__/pcSongImport.test.ts]
  affects: []
tech_stack:
  added: []
  patterns: [TDD red-green, pure-function mapping, paginated-fetch, batch-arrangements]
key_files:
  created:
    - src/utils/pcSongImport.ts
    - src/utils/__tests__/pcSongImport.test.ts
  modified:
    - src/types/song.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
decisions:
  - "PC_BASE_URL duplicated as PC_SONGS_BASE_URL in pcSongImport.ts to avoid full planningCenterApi module import in tests (which would require mocking all exports)"
  - "upsertSongs uses direct updateDoc/addDoc calls (not writeBatch) to match test expectations that assert on updateDoc/addDoc"
  - "Plan 01 changes (Song type extensions, store methods) implemented as Rule 3 blocking dependency fix since Plan 02 requires pcSongId, hidden, and upsertSongs"
metrics:
  duration: "25 minutes"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_changed: 5
---

# Phase 09 Plan 02: PC Song Import Utility Summary

Build the PC song import utility as pure functions with full unit test coverage — TDD approach: fetchAllPcSongs paginated fetch + mapPcSongToUpsert pure mapper + fetchAndMapPcSongs preview pipeline + importFromPc orchestrator.

## What Was Built

### src/utils/pcSongImport.ts
Four exported functions:

**`mapPcSongToUpsert(pcSong, tags, arrangements)`** — pure function, no side effects:
- Maps PC "Category 1/2/3" tags (case-insensitive) to `vwType: 1 | 2 | 3 | null`
- Injects `"Orchestra"` into `teamTags` when any arrangement.name matches `/orchestra/i`
- Non-category tags become `teamTags` entries
- `last_scheduled_at` ISO string → `Timestamp.fromDate()`, null → null
- Arrangements mapped to `Arrangement` shape with empty defaults

**`fetchAllPcSongs(appId, secret)`** — paginated fetch:
- Initial: `GET /api/planningcenter/services/v2/songs?include=tags&per_page=100`
- Follows `links.next` across all pages until exhausted
- Builds `tagMap: Map<id, name>` across all pages
- Returns `Array<{ song: PcSongData; tags: { id, name }[] }>` with tags resolved per song

**`fetchAndMapPcSongs(appId, secret)`** — preview pipeline:
- Calls `fetchAllPcSongs` then `fetchSongArrangements` per song (batches of 10)
- Returns `UpsertSongInput[]` — no Firestore writes
- Used by `PcImportModal` for preview before user confirms import

**`importFromPc(appId, secret, store, onProgress?)`** — orchestrator:
- Calls `fetchAndMapPcSongs` then `store.upsertSongs`
- Counts added vs updated by comparing against existing `store.songs`
- Returns `{ added, updated, errors }`

### Plan 01 prerequisite changes (Rule 3 - blocking dependency)
Since Plan 01 hadn't been executed and Plan 02 requires its outputs:

**src/types/song.ts** — added `pcSongId: string | null` and `hidden: boolean` to `Song` interface, added `UpsertSongInput` export type.

**src/stores/songs.ts** — updated:
- `filteredSongs`: excludes `song.hidden === true` (legacy docs safe, `undefined !== true`)
- `deleteSong`: changed from `deleteDoc` to `updateDoc` with `hidden: true` (soft delete)
- Added `restoreSong`: `updateDoc` with `hidden: false`
- Added `upsertSongs`: match by pcSongId → ccliNumber → title (case-insensitive), preserve `hidden`, only set `vwType` when incoming is non-null

## Test Coverage

24 tests in `src/utils/__tests__/pcSongImport.test.ts` — all green:
- vwType category tag mapping (5 cases including case-insensitivity)
- Orchestra arrangement → teamTags injection (4 cases)
- lastUsedAt: ISO → Timestamp, null → null
- Core field mapping: pcSongId, hidden, notes, ccliNumber (null handling)
- Non-category tags into teamTags, combined with Orchestra
- Arrangements mapped to shape with defaults
- fetchAllPcSongs pagination (2 cases)
- fetchAndMapPcSongs integration: field values, fetchSongArrangements called per song

Plus 34 tests in `src/stores/__tests__/songs.test.ts` — all green (includes Plan 01 behaviors).

Total across all 20 test files: 373 tests passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Implemented Plan 01 prerequisites before Plan 02 tasks**
- **Found during:** Pre-execution review
- **Issue:** `Song` type lacked `pcSongId` and `hidden`; store lacked `upsertSongs` and `restoreSong` — required by Plan 02's `mapPcSongToUpsert` return type and `importFromPc` store parameter
- **Fix:** Implemented all Plan 01 changes (song.ts, songs.ts, songs.test.ts) before writing Plan 02 code
- **Files modified:** src/types/song.ts, src/stores/songs.ts, src/stores/__tests__/songs.test.ts
- **Commit:** d29db8c

**2. [Rule 1 - Bug] Fixed PC_BASE_URL import causing mock failure**
- **Found during:** Task 2 (GREEN phase) — 5/24 tests failing
- **Issue:** `pcSongImport.ts` imported `PC_BASE_URL` from `planningCenterApi`, but the test mock only exported `fetchSongArrangements`, causing runtime error "No PC_BASE_URL export is defined on the mock"
- **Fix:** Duplicated the constant as `PC_SONGS_BASE_URL` inside `pcSongImport.ts` to avoid full-module import
- **Files modified:** src/utils/pcSongImport.ts

**3. [Rule 1 - Bug] Fixed null override in makePcSong test helper**
- **Found during:** Task 2 (GREEN phase) — 1/24 tests failing
- **Issue:** `makePcSong({ ccli_number: null })` was using `??` operator which treats `null` as nullish and fell back to default `'12345'`
- **Fix:** Changed to `'ccli_number' in overrides ? overrides.ccli_number ?? null : '12345'` for proper null override support
- **Files modified:** src/utils/__tests__/pcSongImport.test.ts

**4. [Rule 2 - Design] Used updateDoc/addDoc directly in upsertSongs instead of writeBatch**
- **Found during:** Implementing upsertSongs
- **Issue:** Plan specified batch writes for efficiency, but tests assert `updateDoc`/`addDoc` were called directly (not via batch). Tests take precedence in TDD.
- **Fix:** Used `updateDoc`/`addDoc` for upsertSongs; `importSongs` still uses writeBatch

## Self-Check: PASSED

**Files verified:**
- FOUND: src/utils/pcSongImport.ts
- FOUND: src/utils/__tests__/pcSongImport.test.ts
- FOUND: src/types/song.ts (modified)
- FOUND: src/stores/songs.ts (modified)
- FOUND: src/stores/__tests__/songs.test.ts (modified)

**Commits verified:**
- FOUND: d29db8c — feat(09-01): extend Song type and store
- FOUND: ef891fe — test(09-02): add failing tests (RED)
- FOUND: 879c5b9 — feat(09-02): implement pcSongImport (GREEN)

**Tests verified:** 373/373 passing across 20 test files
