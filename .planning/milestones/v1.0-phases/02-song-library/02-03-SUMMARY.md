---
phase: 02-song-library
plan: 03
subsystem: ui
tags: [vue3, pinia, firestore, tailwind, vitest, typescript, papaparse, csv-import]

# Dependency graph
requires:
  - phase: 02-song-library
    plan: 01
    provides: Song/Arrangement types, useSongStore with importSongs batch action, SongsView skeleton with Import Songs button

provides:
  - PapaParse CSV parsing pipeline for Planning Center export format
  - csvImport.ts pure utility functions (mapRowToSong, detectDuplicates, parseArrangementFromRow)
  - CsvImportModal.vue three-step modal (file select -> preview -> import)
  - CSV import accessible from Songs page button and ?import=true query param
  - Preview table with duplicate detection (red/strikethrough), warning rows (yellow), new rows (green)
  - Batched import with progress indicator via songStore.importSongs

affects:
  - GettingStarted step 2 completion check (song library populated after import)

# Tech tracking
tech-stack:
  added:
    - papaparse ^5.x (CSV parsing, header-based row parsing)
    - "@types/papaparse" (TypeScript types)
  patterns:
    - ParsedSongPreview interface extends Song input shape with isDuplicate and _warnings fields
    - CSV column mapping uses nullish coalescing chain for multiple Planning Center header variants
    - detectDuplicates uses CCLI match first, case-insensitive title fallback for songs without CCLI
    - CsvImportModal uses Teleport + Transition (same pattern as SongSlideOver)
    - Import strips ParsedSongPreview-specific fields before calling songStore.importSongs
    - ?import=true query param auto-opens modal and clears param via router.replace

key-files:
  created:
    - src/utils/csvImport.ts
    - src/components/CsvImportModal.vue
    - src/components/__tests__/CsvImportModal.test.ts
  modified:
    - src/views/SongsView.vue
    - package.json (added papaparse + @types/papaparse)
    - package-lock.json

key-decisions:
  - "PapaParse used with header:true mode — provides row objects keyed by column header strings"
  - "Column mapping is defensive with nullish coalescing chain — handles Title/Song Title, CCLI Number/CCLI/CCLI #, Author/Copyright, BPM/Tempo, Keys/Key variants"
  - "Duplicate detection: CCLI match is primary (when both sides have CCLI), title match is fallback (when parsed song has no CCLI)"
  - "Import flow: preview before commit — user can uncheck individual rows to exclude, no data written until Import button clicked"
  - "song-level teamTags computed as union of all arrangement teamTags via flatMap + Set deduplication"

requirements-completed: [SONG-01, SONG-06]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 2 Plan 03: CSV Import Pipeline Summary

**PapaParse CSV import pipeline with Planning Center column mapping, duplicate detection by CCLI then title, preview table with per-row checkboxes and validation warnings, and batched Firestore write via existing importSongs action**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T03:43:44Z
- **Completed:** 2026-03-04T03:49:XX Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 5

## Accomplishments

- Installed PapaParse and @types/papaparse; 36 unit tests covering all CSV column mapping variants, arrangement parsing (up to 5 per row), duplicate detection by CCLI + title, teamTag union computation, and "Missing title" validation warning — all passing
- CsvImportModal.vue: full three-step modal flow with drag-and-drop file picker, PapaParse parsing with detected column display, preview table (duplicates red/strikethrough, warnings yellow, new songs green), summary bar (total/duplicates/warnings/selected counts), per-row checkboxes with select-all toggle, chunked import with progress bar, done state with count
- SongsView.vue updated: importModalOpen ref wired to Import Songs button and ?import=true query param auto-open (param cleared via router.replace after opening)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install PapaParse, csvImport utilities, TDD tests** - `bb89aa6` (feat)
2. **Task 2: CsvImportModal component and SongsView wiring** - `d6f3215` (feat)

**Task 3 (human-verify checkpoint): Awaiting user verification of complete song library workflow**

## Files Created/Modified

- `src/utils/csvImport.ts` - Pure functions: mapRowToSong (column mapping), detectDuplicates (CCLI then title), parseArrangementFromRow (per-index arrangement parser)
- `src/components/__tests__/CsvImportModal.test.ts` - 36 unit tests: column mapping variants, arrangement parsing (5 arrangements, BPM/key/tags), duplicate detection, teamTag union, warnings
- `src/components/CsvImportModal.vue` - Three-step import modal: file select with drag-and-drop, preview table with status badges, import with progress bar
- `src/views/SongsView.vue` - Added importModalOpen ref, CsvImportModal component, router.replace to clear ?import=true param

## Decisions Made

- PapaParse with `header: true` mode — row objects keyed by column header strings, no index-based fragility
- Column mapping uses nullish coalescing chain for Planning Center CSV header variants (defensive per RESEARCH.md pitfall)
- Duplicate detection: CCLI match is primary when both songs have CCLI; falls back to case-insensitive title match only when parsed song has no CCLI number
- Preview-before-commit pattern: no data written to Firestore until user clicks Import button
- Song-level teamTags = `[...new Set(arrangements.flatMap(a => a.teamTags))]` — union deduplication

## Deviations from Plan

### Context Discovery

**SongsView.vue state at plan start:** Plan 02 (SongSlideOver) had already been executed but was not in STATE.md. SongsView.vue included SongSlideOver wiring, BatchQuickAssign component, and batch mode logic beyond what Plan 01 established. This was existing work — CsvImportModal was wired alongside it without disruption.

No behavior changes needed — the extra components integrated cleanly.

## Issues Encountered

None

## User Setup Required

Task 3 requires human verification:
1. Start dev server: `npm run dev`
2. Navigate to /songs
3. Click "Import Songs" — verify modal opens with drag-and-drop file zone
4. Select a Planning Center CSV file — verify preview table with count/duplicate/warning info
5. Import — verify songs appear in table, duplicates skipped
6. Import same file again — verify all flagged as duplicates, 0 imported
7. Test ?import=true query param — navigate to /songs?import=true, verify modal auto-opens and URL clears
8. Verify GettingStarted step 2 shows complete after songs imported

## Self-Check: PASSED

All 3 expected files exist. Task commits bb89aa6 and d6f3215 confirmed in git log. 91 total tests passing. Production build succeeds.

---
*Phase: 02-song-library*
*Completed: 2026-03-04*
