---
id: T05
parent: S01
milestone: M001
key_files:
  - src/components/SongLyricEditor.vue
  - src/components/__tests__/SongLyricEditor.test.ts
key_decisions:
  - Used reactive() wrapping computed() in test mocks to match Pinia store auto-unwrapping behavior
  - Local editableSections ref with isDirty guard prevents auto-save on initial load and non-changes
duration: 
verification_result: passed
completed_at: 2026-07-24T04:39:37.852Z
blocker_discovered: false
---

# T05: Song Lyric Editor with section editing, auto-save status, copyright display, version snapshots, and paste dialog integration — 13 passing tests

**Song Lyric Editor with section editing, auto-save status, copyright display, version snapshots, and paste dialog integration — 13 passing tests**

## What Happened

Created `SongLyricEditor.vue` component with all planned features:

- **Section display & editing**: Renders each lyric section as a card with label header and auto-sizing textarea. Edits update a local `editableSections` ref that is deep-watched by the auto-save composable.
- **Auto-save integration**: Wired `useAutoSave` composable (from T02) watching `editableSections` with an `isDirty` computed guard. Calls `songLyricsStore.updateCurrentLyrics()` on debounced save. Status indicator in header shows pending dot, "Saving...", or "Saved ✓".
- **Copyright display**: Bottom section shows title, authors, copyright lines, CCLI song number, and license number (R002). Conditionally hidden when no CCLI song number present.
- **"Save Version" button**: Creates a new version snapshot via `songLyricsStore.saveLyrics()` (R004 light versioning).
- **"Paste New Lyrics" button**: Opens `LyricPasteDialog` (from T04) to re-import/overwrite lyrics.
- **Empty state**: When no lyrics exist, shows prominent "Paste Lyrics from SongSelect" CTA button.
- **Lifecycle**: Subscribes to `songLyricsStore` on mount, cleans up auto-save timers and unsubscribes on unmount.
- **Dark-first styling**: Consistent with existing components (gray-800/900 backgrounds, indigo accents).

Test suite covers: section rendering, editing state, auto-save status indicators (pending/saving/saved), Save Version button creating new versions, empty state CTA, copyright display, and copyright hiding when CCLI number is empty.

Mock strategy used `reactive()` wrapping `computed()` refs to match Pinia's auto-unwrapping behavior — initial attempt with plain object mocks failed because Vue's computed wrapper couldn't track reactivity through non-reactive property access.

## Verification

Ran task-level verification (`npx vitest run src/components/__tests__/SongLyricEditor.test.ts`) — 13/13 tests pass. Ran full slice regression check across all 4 S01 test files (ccliParser, useAutoSave, LyricPasteDialog, SongLyricEditor) — 56/56 tests pass with zero regressions.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/SongLyricEditor.test.ts --reporter=verbose` | 0 | pass | 7866ms |
| 2 | `npx vitest run src/utils/__tests__/ccliParser.test.ts src/composables/__tests__/useAutoSave.test.ts src/components/__tests__/LyricPasteDialog.test.ts src/components/__tests__/SongLyricEditor.test.ts --reporter=verbose` | 0 | pass | 11420ms |

## Deviations

None

## Known Issues

None

## Files Created/Modified

- `src/components/SongLyricEditor.vue`
- `src/components/__tests__/SongLyricEditor.test.ts`
