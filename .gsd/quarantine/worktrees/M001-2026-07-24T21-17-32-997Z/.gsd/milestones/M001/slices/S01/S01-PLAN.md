# S01: Song Lyric Slides and Editor

**Goal:** **Demo:** Paste CCLI lyrics, see auto-split slides with copyright, arrange performance order with repeats, edit and revert with auto-save
**Demo:** Paste CCLI lyrics, see auto-split slides with copyright, arrange performance order with repeats, edit and revert with auto-save

## Must-Haves

- R001: CCLI SongSelect paste auto-splits into lyric sections with correct section labels\n- R002: Copyright info (title, authors, CCLI song number, copyright lines, license number) extracted and displayed\n- R003: Performance order builder allows adding, removing, reordering sections with repeats via drag-and-drop\n- R004: Version snapshots created on explicit save, revert to any previous version works\n- R017: Auto-save with 800ms debounce persists edits as user works, status indicator shows save state\n- R018: Dark-first polished UI usable by non-technical volunteers on first attempt\n- R019: Unified Slide type with contentKind discriminator field established\n- R020: Lyrics stored per-song in catalog subcollection, not per-service copies

## Verification

- Run the task and slice verification checks for this slice.

<tasks>
- [x] **T01**: CCLI paste parser and core lyric/slide types with 19 passing tests _(M)_
  Create the foundational types and the CCLI SongSelect paste parser.
  - Files: `src/types/slide.ts`, `src/types/songLyrics.ts`, `src/utils/ccliParser.ts`, `src/utils/__tests__/ccliParser.test.ts`
  - Verify: npx vitest run src/utils/__tests__/ccliParser.test.ts --reporter=verbose
- [x] **T02**: Reusable useAutoSave composable extracted from ServiceEditorView pattern with 12 passing tests _(M)_
  Extract the auto-save debounce pattern from ServiceEditorView into a reusable composable.
  - Files: `src/composables/useAutoSave.ts`, `src/composables/__tests__/useAutoSave.test.ts`
  - Verify: npx vitest run src/composables/__tests__/useAutoSave.test.ts --reporter=verbose
- [x] **T03**: Song Lyrics Pinia store with Firestore subcollection CRUD, real-time subscription, version snapshots, and performance order updates — 20 passing tests _(M)_
  Create the Pinia store for lyrics subcollection CRUD, subscription, and version snapshots.
  - Files: `src/stores/songLyrics.ts`, `src/types/song.ts`, `src/stores/songs.ts`, `src/stores/__tests__/songLyrics.test.ts`
  - Verify: npx vitest run src/stores/__tests__/songLyrics.test.ts --reporter=verbose
- [x] **T04**: Lyric Paste Dialog with CCLI paste, live preview, confirm/cancel guards, and 12 passing tests _(M)_
  Create the paste dialog where users paste CCLI SongSelect text and preview parsed sections before confirming.
  - Files: `src/components/LyricPasteDialog.vue`, `src/components/__tests__/LyricPasteDialog.test.ts`
  - Verify: npx vitest run src/components/__tests__/LyricPasteDialog.test.ts --reporter=verbose
- [x] **T05**: Song Lyric Editor with section editing, auto-save status indicators, copyright display, and 13 passing tests _(L)_
  Create the main lyric editor that displays parsed sections with inline editing, auto-save status, and copyright display.
  - Files: `src/components/SongLyricEditor.vue`, `src/components/__tests__/SongLyricEditor.test.ts`
  - Verify: npx vitest run src/components/__tests__/SongLyricEditor.test.ts --reporter=verbose
- [x] **T06**: Performance Order Builder with drag-and-drop reorder, section add/remove/repeat, reset-to-default, and 8 passing tests _(M)_
  Create the performance order builder where users arrange section order with repeats using drag-and-drop.
  - Files: `src/components/PerformanceOrderBuilder.vue`, `src/components/__tests__/PerformanceOrderBuilder.test.ts`
  - Verify: npx vitest run src/components/__tests__/PerformanceOrderBuilder.test.ts --reporter=verbose
- [x] **T07**: LyricVersionHistory component with confirm-to-revert, and SongSlideOver tabbed Lyrics integration with 16 passing tests _(L)_
  Create the version history component and integrate all lyrics UI into SongSlideOver as a tabbed interface.
  - Files: `src/components/LyricVersionHistory.vue`, `src/components/SongSlideOver.vue`, `src/components/__tests__/LyricVersionHistory.test.ts`, `src/components/__tests__/SongSlideOver.test.ts`
  - Verify: npx vitest run src/components/__tests__/LyricVersionHistory.test.ts src/components/__tests__/SongSlideOver.test.ts --reporter=verbose
</tasks>

## Files Likely Touched

- src/types/slide.ts
- src/types/songLyrics.ts
- src/utils/ccliParser.ts
- src/utils/__tests__/ccliParser.test.ts
- src/composables/useAutoSave.ts
- src/composables/__tests__/useAutoSave.test.ts
- src/stores/songLyrics.ts
- src/types/song.ts
- src/stores/songs.ts
- src/stores/__tests__/songLyrics.test.ts
- src/components/LyricPasteDialog.vue
- src/components/__tests__/LyricPasteDialog.test.ts
- src/components/SongLyricEditor.vue
- src/components/__tests__/SongLyricEditor.test.ts
- src/components/PerformanceOrderBuilder.vue
- src/components/__tests__/PerformanceOrderBuilder.test.ts
- src/components/LyricVersionHistory.vue
- src/components/SongSlideOver.vue
- src/components/__tests__/LyricVersionHistory.test.ts
- src/components/__tests__/SongSlideOver.test.ts
