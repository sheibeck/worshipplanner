---
phase: 28-song-lyrics-editor-rework-risk-low
plan: 02
subsystem: songs
tags: [vue, pinia, firestore, typescript, vitest]

# Dependency graph
requires:
  - phase: 28-song-lyrics-editor-rework-risk-low
    provides: "28-01's pure pool/order helpers (songSectionOrder.ts), including normalizeParsedSections which this plan's paste-dialog rewrite consumes"
provides:
  - "SongLyrics.performanceOrder as the single source of truth for a song's slide order — Song.performanceOrder deleted outright (D-19)"
  - "resolveSongOrder's three-tier precedence chain deleted from both slideshowAssembler.ts and slideGroupMaterializer.ts — each now reads lyrics.performanceOrder directly"
  - "PerformanceOrderBuilder.vue deleted from disk; the Lyrics tab mounts one editor and no second list"
  - "LyricPasteDialog.vue performs ONE order write (to the lyrics document) instead of two, and pools repeated CCLI section markers via normalizeParsedSections"
affects: [28-03, 28-04, 28-05, 28-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Single order source read inline at each call site rather than a shared precedence helper — resolveSongOrder deleted entirely from both assembler and materializer"]

key-files:
  created: []
  modified:
    - src/types/song.ts
    - src/stores/songs.ts
    - src/stores/songLyrics.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/slideGroupMaterializer.ts
    - src/composables/useSlideshowAssembly.ts
    - src/components/SongSlideOver.vue
    - src/components/LyricPasteDialog.vue
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/stores/__tests__/songLyrics.test.ts
    - src/components/__tests__/SongSlideOver.test.ts
    - src/components/__tests__/LyricPasteDialog.test.ts
  deleted:
    - src/components/PerformanceOrderBuilder.vue
    - src/components/__tests__/PerformanceOrderBuilder.test.ts

key-decisions:
  - "Task order followed literally: fixtures moved to the lyrics document first (Task 1) while the precedence chain still existed, keeping every intermediate vitest run green before either order source was deleted."
  - "Task 2 alone leaves whole-project type-check red (SongSlideOver.vue / LyricPasteDialog.vue still reference the deleted store action and Song field) — documented as an expected transient state in the Task 2 commit message rather than deviated from, since Task 3 (same plan, no checkpoint) closes the gap in the very next commit."
  - "normalizeParsedSections (28-01) is the pooling guard for LyricPasteDialog's rewrite — a repeated CCLI section marker now saves one pooled section referenced twice, not two duplicated sections (D-02/D006)."

requirements-completed: [R035]

coverage:
  - id: D1
    description: "Song's slide order has exactly one source of truth: SongLyrics.performanceOrder. No second field on the Song record, no precedence chain."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts, src/utils/__tests__/slideGroupMaterializer.test.ts, src/composables/__tests__/useSlideshowAssembly.test.ts — all pass with performanceOrderById absent from AssemblyInputs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Lyrics tab mounts one editor and no second list — PerformanceOrderBuilder.vue and its test file deleted from disk, no importer left behind."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#mounts the lyric editor and no second list on the Lyrics tab"
        status: pass
    human_judgment: false
  - id: D3
    description: "A CCLI paste performs ONE order write, to the lyrics document, and pools a repeated section marker into one section referenced twice."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteDialog.test.ts#calls saveLyrics with sections and performanceOrder together, with no song-store write"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/LyricPasteDialog.test.ts#pools a repeated section marker into one section with two order entries"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Slides tab still renders song slides in the user's chosen order, and Phase 26's Edit-in-song link still opens the Lyrics tab."
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (45 tests, unchanged assertions), src/components/__tests__/SongSlideOver.test.ts#opening tab (initialTab prop) describe block"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-07-27
status: complete
---

# Phase 28 Plan 02: Collapse the duplicated song-order model Summary

**Deleted `Song.performanceOrder`, its three-tier resolveSongOrder precedence chain (duplicated across the assembler and materializer), `PerformanceOrderBuilder.vue`'s second list, and `LyricPasteDialog`'s duplicate order write — `SongLyrics.performanceOrder` is now the single, sole source of a song's slide order.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 14 modified, 2 deleted

## Accomplishments

- Every `AssemblyInputs` fixture across three test files now states its order on the lyrics document instead of a `performanceOrderById` map, with implicit tier-three (stored-section-order) fixtures made explicit before the fallback was deleted (Task 1).
- `Song.performanceOrder` deleted outright from the type, the songs store's legacy-doc default, and `songLyrics.ts`'s `updatePerformanceOrder` action (which wrote onto the Song document despite living in the lyrics store) — no migration, no fallback, per D-19 (Task 2).
- `resolveSongOrder`'s three-tier precedence chain — byte-identical duplicates in `slideshowAssembler.ts` and `slideGroupMaterializer.ts` — deleted from both files; a song's order is now `lyrics.performanceOrder`, inlined at each of the three call sites (Task 2).
- `useSlideshowAssembly.ts`'s `performanceOrderById` computed and its four `AssemblyInputs` object-literal entries deleted (Task 2).
- `SongSlideOver.vue`'s Lyrics tab now mounts only the lyric editor — `PerformanceOrderBuilder`'s element, props, import, and `onPerformanceOrderUpdate` handler removed; the tab bar, `initialTab` prop/watch (Phase 26's link contract), and Details tab are untouched (Task 3).
- `LyricPasteDialog.vue`'s `onConfirm` now feeds the CCLI parse through 28-01's `normalizeParsedSections` and performs one write (`sections` + `performanceOrder`) to the lyrics document; the second write to the song store is gone along with the now-unused `songs` store import (Task 3).
- `PerformanceOrderBuilder.vue` and its test file deleted from disk after confirming `SongSlideOver.vue` was the only importer (Task 3, D-19).

## Task Commits

Each task was committed atomically:

1. **Task 1: Move every test fixture's order onto the lyrics document** - `2fe18d0` (test)
2. **Task 2: Delete the second order source and the precedence chain** - `254a274` (feat)
3. **Task 3: Delete the second list and the paste dialog's duplicate write** - `4a1190d` (feat)

_No TDD tasks in this plan — all three are `type="auto"`._

## Files Created/Modified

- `src/types/song.ts` - Deleted the `performanceOrder?: string[]` field and its doc comment.
- `src/stores/songs.ts` - Deleted the legacy-doc default block for that field.
- `src/stores/songLyrics.ts` - Deleted `updatePerformanceOrder` and its entry in the store's returned object.
- `src/utils/slideshowAssembler.ts` - Deleted `performanceOrderById` from `AssemblyInputs` and the `resolveSongOrder` helper; a song's order is `lyrics.performanceOrder`, inlined.
- `src/utils/slideGroupMaterializer.ts` - Same collapse at its own `resolveSongOrder`; updated all three call sites (`deriveGroupEntries`, `sourceSignature`, `reconcileSongGroup`); removed the now-unused `SongLyrics` type import.
- `src/composables/useSlideshowAssembly.ts` - Deleted the `performanceOrderById` computed and its four `AssemblyInputs` literals; updated the module doc comment.
- `src/components/SongSlideOver.vue` - Removed `PerformanceOrderBuilder` (element, import, handler) from the Lyrics tab.
- `src/components/LyricPasteDialog.vue` - `onConfirm` now saves one lyrics write via `normalizeParsedSections`; deleted the song-store write and its import.
- `src/components/PerformanceOrderBuilder.vue` - Deleted (D-19).
- `src/utils/__tests__/slideshowAssembler.test.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`, `src/composables/__tests__/useSlideshowAssembly.test.ts` - Fixtures moved onto lyrics documents; `performanceOrderById` overrides and the default map member removed; one precedence-specific test deleted.
- `src/stores/__tests__/songLyrics.test.ts` - Deleted the `updatePerformanceOrder` describe block.
- `src/components/__tests__/SongSlideOver.test.ts` - Removed the deleted component's mock/stub; added a regression assertion that the Lyrics tab renders the lyric editor and no second-list element.
- `src/components/__tests__/LyricPasteDialog.test.ts` - Save assertion now expects a single lyrics write with no song-store write; added a case proving a repeated CCLI section marker saves one pooled section referenced twice.
- `src/components/__tests__/PerformanceOrderBuilder.test.ts` - Deleted (D-19; legitimately reduces the passing test-file count per D-02).

## Decisions Made

- **Task ordering held exactly as planned.** Task 1's fixture move happened while the precedence chain still existed in production, so every fixture continued resolving through tier two to the identical array — behavior-preserving, verified green (142 tests, type-check 0) before any production deletion.
- **Task 2/Task 3 boundary is not independently type-check-clean, and that is expected.** After Task 2 deleted `Song.performanceOrder` and `songLyricsStore.updatePerformanceOrder`, `SongSlideOver.vue` and `LyricPasteDialog.vue` still referenced both — `npm run type-check` reported exactly two errors, isolated to precisely the two files Task 3 (the very next commit, same non-checkpointed plan) was already scoped to rewrite. Documented in the Task 2 commit message rather than treated as a blocking deviation, since stopping mid-plan to "fix" what Task 3 already fixes would duplicate work. Type-check is 0 errors again after Task 3's commit.
- **`normalizeParsedSections` (28-01) is the D006/D-02 pooling guard** consumed by the paste-dialog rewrite — verified with a new test asserting a repeated CCLI `Chorus` marker pools to one section referenced twice in the order, not two duplicated sections.

## Deviations from Plan

None — plan executed exactly as written, task order followed literally. The Task 2/Task 3 type-check gap described above is an artifact of the plan's own task boundaries (Task 2's file list does not include the two Vue components Task 3 rewrites) rather than an executor deviation; it was resolved by proceeding directly to Task 3 within the same autonomous, non-checkpointed run, as the plan's `autonomous: true` frontmatter and lack of any `checkpoint:*` task both anticipate.

## Issues Encountered

None beyond the expected Task 2/Task 3 type-check gap noted above, which resolved itself once Task 3 landed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **28-03** can now build `reconcileSongGroup`'s repeat handling against a single, unambiguous order source with no precedence chain to reason about.
- **28-04/28-05** (the reworked editor itself) render and mutate through 28-01's helpers against `SongLyrics.performanceOrder` alone — there is no second field or second list left to accidentally re-wire.
- D006 (`Paste lyrics`) and Phase 26's "Edit in song" link (`initialTab`) both verified intact by the updated component tests.
- No blockers identified.

---
*Phase: 28-song-lyrics-editor-rework-risk-low*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: commit 2fe18d0 (Task 1)
- FOUND: commit 254a274 (Task 2)
- FOUND: commit 4a1190d (Task 3)
- CONFIRMED DELETED: src/components/PerformanceOrderBuilder.vue
- FOUND: .planning/phases/28-song-lyrics-editor-rework-risk-low/28-02-SUMMARY.md
