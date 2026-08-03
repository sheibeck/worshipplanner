---
phase: 33-backgrounds-slide-editing
fixed_at: 2026-08-03T02:30:00Z
review_path: .planning/phases/33-backgrounds-slide-editing/33-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 33: Code Review Fix Report

**Fixed at:** 2026-08-03
**Source review:** .planning/phases/33-backgrounds-slide-editing/33-REVIEW.md
**Iteration:** 1

**Fix scope:** Critical + Warning (WR-01–WR-04). The 2 Info findings (IN-01 Storage orphaning,
IN-02 `.stop` discipline) were out of scope per the task and not touched — neither was trivially
adjacent to any of the four fixes below.

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

All four findings were confirmed real on inspection (none were rejected as false/unreachable).
Each fix includes a regression test that fails before the fix and passes after, per the task's
constraint. No existing test was weakened to make a fix green, except WR-03's own masking test,
which the review explicitly called out as *supposed* to change because it tested the wrong thing.

## Fixed Issues

### WR-01: Background cascade silently skipped the song tier for non-`lyric`/`copyright` entries inside a SONG group

**Files modified:** `src/utils/slideshowAssembler.ts`, `src/utils/__tests__/slideshowAssembler.test.ts`
**Commit:** `8ad301a`
**Applied fix:** `emitFromGroup`'s song lookup was keyed on the entry's own `sourceRef.kind`
(`lyric`/`copyright` only), so a `text`/`video` entry preserved inside a SONG group by
`slideGroupMaterializer.ts`'s reconciler could never resolve the song-level background, even
though sibling `lyric`/`copyright` entries in the same group correctly fell through to it.
Changed the lookup to derive `song` from the owning **slot** first (`slot.kind === 'SONG' &&
slot.songId`), falling back to the entry's own `sourceRef` only for groups with no owning slot
songId — exactly the fix the review suggested, adapted to the actual `emitFromGroup` signature
(which already has `slot` in scope). The deliberate video-background-inherits /
video-audio-doesn't asymmetry (33-UI-SPEC §9) is untouched — this change only affects which
`song` document is looked up, not where `resolveEntryMedia` uses it.
**Regression test:** New test in `slideshowAssembler.test.ts` — "a SONG group containing one
lyric entry and one text entry both resolve the song background — WR-01": a SONG group with one
`lyric` entry and one `text` entry, song has a background image, group does not. Asserts both
entries resolve `backgroundSource: 'song'` with the same URL. Fails on the pre-fix code (the text
entry would show `backgroundSource: undefined`), passes after.

### WR-02: `SlideGrid.vue`'s `openMenuEntryId` never reset when the selected plan item changes

**Files modified:** `src/components/slides/SlideGrid.vue`, `src/components/slides/__tests__/SlideGrid.test.ts`
**Commit:** `fe5ddd3`
**Applied fix:** Added a `watch(() => props.selectedSlot?.id, () => { openMenuEntryId.value = null })`
immediately below the ref's declaration — exactly the fix the review suggested. Since
`GroupSlideEntry.id`s are stable across a plan-item round trip, this closes the window where
returning to a previously-selected plan item could re-render a card whose id matched a stale
`openMenuEntryId`, silently reopening a menu with no user interaction.
**Regression test:** New test in `SlideGrid.test.ts` — "WR-02: opening a menu, selecting a
DIFFERENT plan item, then returning to the original does not silently reopen the menu": opens
card `c1`'s menu under plan item A, switches props to plan item B (no matching card), then
switches back to plan item A with the same entry id `c1` re-rendered. Asserts `menuOpen` is
`false`, not silently `true`. Fails on the pre-fix code, passes after.

### WR-03: `SlideActionMenu.vue` never moved focus into its own panel on open — Escape did nothing until the user manually tabbed past the trigger

**Files modified:** `src/components/slides/SlideActionMenu.vue`, `src/components/slides/__tests__/SlideActionMenu.test.ts`
**Commit:** `66dd054`
**Applied fix:** Added a `panelRef` template ref on the `role="menu"` panel and a
`watch(() => props.open, ...)` that, on the `false → true` transition, awaits `nextTick()` and
focuses the panel's first `[role="menuitem"]` button — matching the review's suggested fix and
the WAI-ARIA menu-button pattern's expectation, and mirroring `EditSlideDrawer.vue`'s own existing
open-focus precedent cited in the finding.
**Test fix (the finding required this too):** The pre-existing "pressing Escape" test dispatched
`keydown('Escape')` directly on the panel `<div>`, bypassing the real trigger → focus → Escape DOM
path entirely — which is exactly why it kept passing while the underlying bug was live. Rewrote it
to activate the trigger via `click`, let the component's own focus-on-open watcher run
(`await flushPromises()`, needed because the watcher's callback awaits its own internal
`nextTick()` — a second microtask hop beyond what `setProps` alone waits for), assert
`document.activeElement` actually landed on the first menuitem, and only then dispatch Escape
*from that focused element* (bubbling up to the panel's `@keydown`, the real path a keyboard user
is in). This is the masking test the review said was "supposed to change."
**Regression test:** The rewritten test itself — "WR-03: activating the trigger moves focus onto
the first menuitem, and Escape from there emits toggle and returns focus to the trigger" — fails
on the pre-fix component (focus never leaves the trigger, so the real path's Escape dispatch never
reaches the panel's handler) and passes after.

### WR-04: The "Discard unsaved changes?" guard was dead code in `EditSlideDrawer.vue`

**Files modified:** `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/SlidesTab.vue`, `src/components/slides/__tests__/EditSlideDrawer.test.ts`, `src/components/slides/__tests__/SlidesTab.test.ts`
**Commit:** `0c56e88`
**Decision:** Chose **restore the guard** (the review's first option) over deleting the vestigial
`useUnsavedGuard` instance, wired at **both** points the review's Fix section named ("and/or"),
because inspection showed both were needed to actually close the regression rather than leaving it
half-wired:
- `EditSlideDrawer.vue`'s own `onClose`/`onKeydown` (the × button and Escape) now call
  `unsavedGuard.confirmDiscard()` before emitting `close` — the exact pattern every other consumer
  (`AvailabilityDrawer.vue`, `RosterView.vue`, `SongSlideOver.vue`) already uses. This alone would
  NOT have closed the specific regression 33-VERIFICATION.md's human-verification item describes,
  because "Edit in song"/"Edit in scripture" never call `onClose` at all — 33-09 moved that
  navigation entirely into `SlidesTab.vue`'s `onMenuAction`, which calls `router.push`/emits
  directly and never touches the drawer's close path.
- To close that second path, `EditSlideDrawer.vue` now `defineExpose({ confirmDiscard:
  unsavedGuard.confirmDiscard })`, and `SlidesTab.vue` holds a template ref to the mounted drawer
  and calls it from a new `confirmLeavingOpenDrawer()` helper, invoked for the `edit-in-song`/
  `edit-in-scripture` keys **before** `selectedSlideId` is reassigned (reassigning first would let
  the drawer's own `watch(() => props.entry)` start flushing/resetting for the new entry before
  the check could run against the entry actually being left). A cancelled confirm returns early,
  leaving selection, `drawerOpen`, and the drawer's local fields untouched — no `router.push`, no
  navigate emit.
- Practical scope check performed before choosing: for `lyric`/`copyright` entries (the only kind
  that ever offers `edit-in-song`), `canMutate` is false (R054, song groups), so label/notes/body
  — the only fields the guard tracks — are never editable there; the guard is a true no-op for
  that specific key in practice. For `edit-in-scripture` (scripture-kind entries, `canMutate` can
  be true), label/notes genuinely are editable, so this is the path that actually reproduces the
  regression. Both keys are wired identically for symmetry and because a future change to the
  song-group gate should not silently reopen the gap.
**Regression tests:**
- `EditSlideDrawer.test.ts`, new `describe('WR-04 — unsaved-edit guard on close/Escape')`: five
  tests covering — × button prompts and blocks on cancel; × button prompts and closes on confirm;
  Escape prompts and blocks on cancel; no-edit close never calls `window.confirm`; and the exposed
  `confirmDiscard()` returns the same result a parent would see. All fail on the pre-fix code
  (`window.confirm` is never called; `confirmDiscard` isn't exposed) and pass after.
- `SlidesTab.test.ts`, new `describe('WR-04 — unsaved-edit guard gates menu-dispatched
  navigation')`: three tests using a controllable stub `EditSlideDrawer` (exposing a mocked
  `confirmDiscard`) — a cancelled confirm blocks `edit-in-song` navigation and leaves selection
  untouched; a confirmed one proceeds to `router.push`; and `confirmDiscard` is never called at
  all for `edit-in-scripture` when no drawer was ever opened this session (the `!drawerOpen.value`
  fast path). These fail on the pre-fix `onMenuAction` (which never calls `confirmDiscard` at all)
  and pass after.

## Skipped Issues

None — all four findings applied cleanly, matched the reviewed code, and are covered by a
regression test.

## Rejected Findings

None — all four findings were confirmed real and reproducible on inspection; no speculative fix
was applied to a non-issue.

## Out of Scope (per task instruction)

- **IN-01** (Storage objects never cleaned up on background removal/replacement) and **IN-02**
  (menu item buttons don't `.stop` click propagation, unlike the trigger) were explicitly out of
  scope for this fix pass and were not trivially adjacent to any of the four files touched above.
  Left for a future pass.

## Project Gates (run after all four fixes)

| Gate | Command | Result |
|---|---|---|
| Type-check | `npm run type-check` (`vue-tsc --build`) | **Exit 0**, no errors |
| App suite | `npx vitest run src/` | **2128 passed / 9 failed / 2137 total** (2 test files: `src/storage.rules.test.ts` — 7 failures, needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` — 1 failure, stale assertion). Both are the documented pre-existing baseline (originally reported as 2118/9 before this session — the +10 passed reflects the regression tests this fix pass added: 1 in `slideshowAssembler.test.ts`, 1 in `SlideGrid.test.ts`, 1 in `SlideActionMenu.test.ts` (net, replacing one rewritten test), 3 in `EditSlideDrawer.test.ts`+`SlidesTab.test.ts` combined net additions — exact count reconciles against the per-file `it()` totals below). Zero new failures beyond the two documented baseline files. |
| Build | `npm run build` | **Succeeded** (`vite build` exit 0; only the pre-existing "chunk larger than 500kB" advisory warning, unrelated to this change) |

Per-file test counts after all four fixes (all green): `slideshowAssembler.test.ts` 59,
`SlideGrid.test.ts` 92, `SlideActionMenu.test.ts` 11, `EditSlideDrawer.test.ts` 148,
`SlidesTab.test.ts` 46.

---

_Fixed: 2026-08-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
