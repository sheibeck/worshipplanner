---
phase: 116-lyric-editor-song-ux
fixed_at: 2026-09-04T00:00:00Z
review_path: .planning/phases/116-lyric-editor-song-ux/116-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 116: Code Review Fix Report

**Fixed at:** 2026-09-04
**Source review:** `.planning/phases/116-lyric-editor-song-ux/116-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, IN-01 — all Warning/Info findings; no Critical findings existed)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-02: Every credits-only edit permanently duplicated the entire lyrics document as a new Firestore version

**Files modified:** `src/components/SongLyricEditor.vue`, `src/components/__tests__/SongLyricEditor.test.ts`
**Commit:** `c5a6042c`
**Applied fix:** Investigated the store's public API (`src/stores/songLyrics.ts`) and confirmed a safe
in-place update path already exists and is already used by this same component's autosave path:
`updateCurrentLyrics(orgId, songId, lyricsId, partialData)`, which runs `updateDoc` against the
*current* lyrics document rather than `addDoc`-ing a new one. `saveCreditsEdit` now calls
`songLyricsStore.updateCurrentLyrics(props.orgId, props.songId, cur.id, { copyright: edited })`
instead of `saveLyrics(...)`.

Verified all three review-mandated semantics:
- (a) The write is a partial Firestore `updateDoc` containing only the `copyright` key, so it lands
  on the current/latest lyrics doc's copyright block.
- (b) `sections`/`performanceOrder` are never included in the update payload at all — not merely
  "passed through unchanged" as the old `saveLyrics` call did, but structurally impossible to touch,
  since Firestore `updateDoc` only writes the top-level keys present in the payload.
- (c) `currentLyrics` is a computed off the store's real-time `onSnapshot` subscription
  (`src/stores/songLyrics.ts`'s `subscribeLyrics`), so once the `updateDoc` write is acknowledged the
  snapshot listener re-fires and `currentLyrics.value.copyright` reflects the change reactively — the
  same mechanism the editor already relies on for autosaved section edits.

A credits-only edit (e.g. fixing a single CCLI number) now costs one field write on the existing
document, not a duplicate of the entire `sections` array as a new permanent version — and with
History hidden (R337) this growth is no longer invisible/unprunable, because there is no growth.

**Tests updated:** the two existing "saving calls saveLyrics..." tests (pre-filled edit, and
empty-credits-to-populated) were rewritten to assert `updateCurrentLyrics` is called with exactly
`{ copyright: <edited> }` (no `sections`/`performanceOrder` sibling keys — enforced by
`toHaveBeenCalledWith`'s exact-shape matching) and that `saveLyrics` is *not* called. The cancel test
was extended to also assert `updateCurrentLyrics` is not called.

### WR-01: `saveCreditsEdit` had no error handling — a failed save silently stranded the user

**Files modified:** `src/components/SongLyricEditor.vue`, `src/components/__tests__/SongLyricEditor.test.ts`
**Commit:** `c5a6042c` (same commit as WR-02 — the two fixes are inseparably intertwined, both editing
the same few lines of `saveCreditsEdit`; splitting them into two commits would have meant reverting
and reapplying overlapping hunks, which is more error-prone than committing them together. Both
finding IDs are called out explicitly in the commit message body.)
**Applied fix:** Wrapped the `updateCurrentLyrics` call in `try/catch`, mirroring the file's existing
autosave error-reporting convention exactly (`doAutoSave`'s status watcher, which reports into the
shared `saveStatus` store keyed by this component's `surfaceId` and renders through
`SaveStatusIndicator`). On catch: logs the error, and — if `surfaceId` is resolved — calls
`saveStatus.set(surfaceId.value, { status: 'error', errorText: "Couldn't save your changes — they're
still here. Try again." })`, the identical generic sentence `doAutoSave`'s own error path already
uses. `editingCredits.value = false` only runs on the success path, so a rejected save leaves the
form open with the user's in-progress edits intact, ready to retry.

**Tests added:** a new test rejects `updateCurrentLyrics` once, then asserts the `copyright-edit-form`
is still present, the title field still shows the user's unsaved edit, and
`[data-testid="save-status-error"]` renders the generic error text.

### IN-01: No test exercised the unsaved-drawer guard on the badge's new-tab navigation path

**Files modified:** `src/components/slides/__tests__/SlidesTab.test.ts`
**Commit:** `3e3590cd`
**Applied fix:** Added two tests inside the existing `mountWithControllableGuard` block (WR-04
describe), mirroring the menu-key guard tests at lines ~968/990 but driving `SlideGrid`'s
`edit-in-song` emit (the badge path -> `onEditInSongBadge`, not `menu-action` -> `onMenuAction`) and
asserting on `window.open` instead of `router.push`:
- A cancelled confirm (`confirmDiscard` resolves `false`) blocks the badge's navigation —
  `window.open` is not called.
- A confirmed discard (`confirmDiscard` resolves `true`) allows it through — `window.open` is called
  once.

These complement the pre-existing happy-path badge test, which mounts with the default auto-stubbed
`EditSlideDrawer` (whose `confirmDiscard` always resolves `true` via the `?? true` fallback) and so
could never observe a blocked navigation.

## Skipped Issues

None — all three in-scope findings were fixed.

## Verification

- `npm run type-check` (`vue-tsc --build`, includes test files): clean, no errors.
- `npx vitest run src/components/__tests__/SongLyricEditor.test.ts src/components/slides/__tests__/SlidesTab.test.ts`:
  151/151 passed (90 + 61).
- `npx vitest run src/stores/__tests__/songLyrics.test.ts`: 22/22 passed (store file itself was not
  modified — only its already-existing `updateCurrentLyrics` method was newly consumed — but run as
  an extra safety check since the review's fix guidance centered on that store method).
- Full `npx vitest run`: 185/186 files passed, 5054/5080 tests passed. The single failing file is
  `src/storage.rules.test.ts` — the documented baseline (Storage-emulator `firestore.exists()`
  limitation, see CLAUDE.md), unrelated to this phase's changes. No new regressions.

---

_Fixed: 2026-09-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
