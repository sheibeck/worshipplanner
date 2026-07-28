---
phase: 28-song-lyrics-editor-rework-risk-low
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/utils/songSectionOrder.ts
  - src/utils/__tests__/songSectionOrder.test.ts
  - src/components/SongLyricEditor.vue
  - src/components/__tests__/SongLyricEditor.test.ts
  - src/components/__tests__/SongLyricsTab.r035.test.ts
  - src/components/SongSlideOver.vue
  - src/components/LyricPasteDialog.vue
  - src/components/__tests__/LyricPasteDialog.test.ts
  - src/components/LyricVersionHistory.vue
  - src/utils/slideGroupMaterializer.ts
  - src/utils/__tests__/slideGroupMaterializer.test.ts
  - src/utils/slideshowAssembler.ts
  - src/stores/songLyrics.ts
  - src/stores/songs.ts
  - src/types/song.ts
  - src/types/songLyrics.ts
  - src/composables/useSlideshowAssembly.ts
  - src/composables/useAutoSave.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-07-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is a well-executed rework. I traced the two highest-risk items in detail and could not
break either:

- **`reconcileSongGroup`'s occurrence-aware merge** (`slideGroupMaterializer.ts`) is genuinely
  idempotent. I hand-traced N=M, N<M, N>M, and N=1/M=2 (the 26-09 duplicate-survival case) against
  the code (not just the tests) and every path either reuses a stored entry positionally, mints a
  fresh entry only when the stored array is exhausted, or emits the true surplus exactly once
  immediately after the section's last occurrence — never dropping, never multiplying. The test
  suite (`slideGroupMaterializer.test.ts` lines ~763-963) independently covers the same matrix
  (N=2/M=1, N=2/M=3, two-pass idempotency, 26-09 byte-equivalence) and matches my trace.
- **The model collapse (28-02)** is clean. `Song` (`types/song.ts`) carries no `performanceOrder`
  field, `stores/songs.ts` never writes one, and a codebase-wide grep for
  `song.performanceOrder`/`Song[.performanceOrder]` turns up nothing. `slideshowAssembler.ts` and
  `slideGroupMaterializer.ts` both read `SongLyrics.performanceOrder` alone, with an explicit
  comment that the precedence chain is gone. No `PerformanceOrderBuilder` component exists; the
  only references to that name are the R035/SongSlideOver regression-guard assertions that it
  must NOT exist.
- **D-02 pool/order helpers** (`songSectionOrder.ts`) are pure (only a type-only import), and
  `moveRow`/`duplicateRow`/`removeRow`/`addSection` correctly preserve or drop pooled sections
  based on remaining references — I hand-traced the "remove one of two occurrences" and "remove
  the last occurrence" cases and both match the documented contract.
- **`normalizeParsedSections`** correctly folds a repeated CCLI section marker into one pooled
  entry referenced twice, and correctly mints a fresh id when two same-labelled blocks carry
  different, non-empty text.
- **R035's acceptance test** is a real assertion, not a trivially-passing one: the scroll-region
  selector (`[class*="overflow-y-auto"]`) matches the actual Tailwind class every relevant
  component in this subtree uses (verified via a codebase-wide grep of `overflow-*` classes — no
  sibling component in the mounted subtree uses a different overflow utility that the selector
  would miss), and the list-count assertion searches the whole mounted body, not one level.
- **The restored copyright block (28-06)** lives inside the single scroll region, contains no
  input elements, and does not introduce a second `overflow-y-auto` container.

I did find two real (non-data-loss) UI-state defects in `SongLyricEditor.vue` and a gap in
failure-path error handling, detailed below.

## Warnings

### WR-01: Row expand/collapse state can silently reattach to the wrong occurrence after a reorder

**File:** `src/components/SongLyricEditor.vue:287-298, 394-419, 486-498`
**File:** `src/utils/songSectionOrder.ts:56-78` (root cause: `rowKey` derivation)

**Issue:** `expandedRowKeys` is a `Set<string>` keyed by `SectionRow.rowKey`, which is
`${sectionId}#${occurrenceIndex}` — and `occurrenceIndex` is derived *positionally* by
`buildSectionRows` (count of the same `sectionId` seen so far in `performanceOrder`). For a
section referenced only once, this key is stable across reorders (occurrenceIndex is always 0).
But for a section referenced **more than once**, any action that changes which occurrence comes
first — a drag reorder, a `Duplicate` inserted before an existing occurrence, or `Remove` of an
earlier occurrence — reassigns `occurrenceIndex` (and therefore `rowKey`) to a *different physical
row* than the one that held it before the mutation.

Concrete repro: order `[chorus, verse-1, chorus]` (chorus at position 1 is `chorus#0`/followed,
chorus at position 3 is `chorus#1`/repeat). User expands the repeat (`chorus#1`,
`expandedRowKeys = {'chorus#1'}`). User then drags the followed chorus (index 0) to the end
(`moveRow(order, 0, 2)` → `[verse-1, chorus, chorus]`). After rebuilding rows, the chorus that WAS
the repeat is now `chorus#0` (occurrenceIndex 0, no longer in `expandedRowKeys` → renders
collapsed, even though the user had it open), and the chorus that WAS the followed row is now
`chorus#1` (occurrenceIndex 1 → matches the stale key → renders expanded, showing the read-only
"shared text" panel the user never asked to open). No test in `SongLyricEditor.test.ts` exercises
expand-state persistence across a reorder/duplicate/remove that changes occurrence ordering among
repeats of the same section, so this is not caught by the existing suite.

This causes no data loss — the underlying section text is edited by `sectionId`, not by row
identity, so nothing gets corrupted — but it is a real, reproducible UI-state defect: the wrong
row silently expands or collapses, and which occurrence displays the editable textarea vs. the
read-only "shared text" panel can change with no user action.

**Fix:** Key `expandedRowKeys` by something stable across a mutation instead of the
positionally-derived `occurrenceIndex` — e.g. mint a per-order-slot stable id (a UUID stored
alongside each `performanceOrder` entry, or an index into a stable parallel array) and expose that
as `SectionRow.rowKey` instead of `${sectionId}#${occurrenceIndex}`. If that is too large a model
change for this phase, a smaller mitigation is to clear `expandedRowKeys` (or remap it by
best-effort content match) inside `onDuplicate`/`onRemove`/the Sortable `onEnd` handler whenever
the mutation touches a `sectionId` with more than one occurrence, so a stale key can never
silently reattach to a different row.

### WR-02: Trailing newline in the section textarea persists a spurious blank line

**File:** `src/components/SongLyricEditor.vue:373-376`

**Issue:**
```ts
function onSectionInput(sectionId: string, value: string) {
  const section = editableState.sections.find((s) => s.id === sectionId)
  if (section) section.lines = value.split('\n')
}
```
`value.split('\n')` on a textarea value that ends with a newline (e.g. the user pressed Enter
after the last line, or pasted text with a trailing newline) produces a trailing empty-string
element in `lines`. That empty line is stored verbatim in `LyricSection.lines` and autosaved —
`slideGroupMaterializer.ts`/`slideshowAssembler.ts` render `lines` as-is on the assembled
`LyricSlide`, so this becomes a visible blank line at the end of that section on the projector.
This is easy to trigger accidentally (Enter is a natural way to "finish" typing a line) and is not
guarded against anywhere in the write path (`doAutoSave`, `onSaveVersion`, `saveLyrics`,
`updateCurrentLyrics`).

**Fix:** Strip a single trailing empty line (or filter out empty trailing entries) before
assigning `section.lines`, e.g.:
```ts
function onSectionInput(sectionId: string, value: string) {
  const section = editableState.sections.find((s) => s.id === sectionId)
  if (!section) return
  const lines = value.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  section.lines = lines
}
```

## Info

### IN-01: Save/paste/revert failures are silent — no error surfaced to the user

**File:** `src/components/SongLyricEditor.vue:330-339` (`doAutoSave`), `:509-517`
(`onSaveVersion`), `:519-521` (`onRevertVersion`)
**File:** `src/components/LyricPasteDialog.vue:184-203` (`onConfirm`)

**Issue:** None of these functions catch a rejected Firestore call. `doAutoSave` is invoked both
from `useAutoSave`'s debounce (whose own `scheduleSave`/`flush` wrap `saveFn()` in a bare
`try/finally`, no `catch`) and directly from the `currentLyrics` watcher's load-time repair path —
in both cases, a failed write (network blip, revoked access, offline) leaves the UI showing
whatever status it had going in, with no toast/banner telling the user their edit, saved version,
revert, or pasted lyrics did not persist. `LyricPasteDialog.onConfirm` has the same gap: on
failure, `isSaving` resets via `finally`, the button re-enables, and the dialog stays open with no
indication anything went wrong — a user could plausibly close the dialog believing the paste
succeeded.

**Fix:** Wrap each of these calls in a try/catch that surfaces a visible error state (a toast, an
inline banner, or at minimum a `status.value` distinct from the current pending/saving/saved
states in `useAutoSave`), so a failed persistence attempt is never indistinguishable from a
successful one.

---

_Reviewed: 2026-07-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
