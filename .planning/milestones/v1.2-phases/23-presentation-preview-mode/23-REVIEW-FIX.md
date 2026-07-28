---
phase: 23-presentation-preview-mode
fixed_at: 2026-07-25T16:50:00Z
review_path: .planning/phases/23-presentation-preview-mode/23-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-07-25T16:50:00Z
**Source review:** .planning/phases/23-presentation-preview-mode/23-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01 through WR-06; the 2 Info findings were out of
  scope per fix_scope and are not addressed here)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### WR-01: Unhandled promise rejection when `pause()` interrupts a pending `play()` (or media errors mid-flight)

**Files modified:** `src/components/VideoPlayer.vue`, `src/components/AudioPlayer.vue`, `src/components/__tests__/VideoPlayer.test.ts`, `src/components/__tests__/AudioPlayer.test.ts`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** f82b0c1
**Applied fix:** Both players now treat `AbortError` (a `pause()`-interrupted `play()`, per the HTML media spec) alongside `NotAllowedError` as an expected, silent outcome, replacing the narrower `isNotAllowedError` check with `isExpectedPlaybackRejection` in every `play()`/`unmute()` catch block that previously rethrew. Adds unit-level AbortError tests in both players plus a `PresentationViewer` test using a realistic interruptible play/pause double (per IN-02's suggestion) that reproduces a real process-level `unhandledRejection` against the pre-fix code.

### WR-02: `:key="currentVideoUrl"` / `:key="currentAudioUrl"` lets child-component state leak across consecutive slides that share a media URL

**Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** e741651
**Applied fix:** Added `currentVideoKey`/`currentAudioKey` computeds keyed on `` `${slide.id}:${url}` `` and bound them in place of the URL-only keys, forcing a fresh `VideoPlayer`/`AudioPlayer` instance on every slide transition regardless of URL reuse. Regression test mounts two adjacent slides sharing an identical `videoUrl`, drives the first through the muted-retry path, and asserts the second slide gets a distinct DOM node with `muted` reset to `false`.

### WR-03: The `slides.length` watcher clamps `currentIndex` without going through the pause/reset/play lifecycle

**Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** 0c2ce7e
**Applied fix:** Replaced the watcher's direct `currentIndex` assignment with the suggested `Math.min(Math.max(...))` clamp routed through `pauseCurrentMedia()`/`resetMediaState()`/`playCurrentMedia()` — the same three steps `goToIndex()` always uses. This also removes IN-01's now-dead defensive branch (subsumed by the single clamp expression), which is why that Info finding needed no separate action. Regression test navigates to a slide whose video then errors, shortens the slideshow so that slide is clamped away, and asserts the clamped-to slide's `mediaFailed` flag is cleared and its media is actually played.

### WR-04: Auto-hiding chrome timer hides the exit affordance during loading/empty states, with no non-keyboard fallback

**Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** 464bce9
**Applied fix:** Added an `exitVisible` computed (`chromeVisible || isLoadingState || isEmptyState`) and bound the exit button's opacity/interactivity class to it instead of raw `chromeVisible`, so the 3s idle timer itself is untouched but the exit button stays fully opaque and clickable during loading/empty states regardless of idle time. Regression tests for both states assert the exit button keeps `opacity-100` (no `opacity-0`/`pointer-events-none`) after the idle timer fires.

### WR-05: `bodyIsCaption` does not revert after the attached video errors out

**Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** ee9bcf7
**Applied fix:** Gated `bodyIsCaption` on both the URL and the non-failed state: `Boolean(currentVideoUrl.value) && !mediaFailed.value`, exactly as suggested. Regression test asserts the slide body switches from `text-2xl` (caption) to `text-5xl` (full Body scale) once the video's `error` event fires.

### WR-06: No focus containment / modal semantics on the full-screen viewer

**Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** 523ecc7 (plus a small follow-up type-check fix in 407b273)
**Applied fix:** Added `role="dialog"`, `aria-modal="true"`, and `aria-label="Presentation"` to the teleported root, and implemented a `Tab`/`Shift+Tab` focus trap (`trapFocus`, wired into `handleKeydown`) that cycles focus among the viewer's own currently-enabled focusable elements (exit/prev/next/affordance buttons), wrapping at either end instead of letting focus escape into the still-present (visually hidden) app content behind the overlay. Regression tests assert the dialog attributes are present, Tab from the last focusable element wraps to the first, Shift+Tab from the first wraps to the last, and with only one focusable element Tab keeps focus on it.

## Skipped Issues

None — all 6 in-scope findings (WR-01 through WR-06) were fixed.

## Verification

- `npx vitest run src/components/__tests__/ src/views/__tests__/ServiceEditorView.test.ts` (excluding `.gsd/quarantine/worktrees/**`, which carries known pre-existing failures unrelated to this phase): 26 test files, 347 tests, all passing.
- `npx vitest run src/components/__tests__/SlideshowPreview.test.ts` re-verified green after every fix (hard constraint 5 — default `AudioPlayer`/`VideoPlayer` rendering unaffected).
- Every regression test added above was confirmed to **fail** against the pre-fix source (verified via `git stash` of the source-only diff, tests kept) before being confirmed to pass against the fixed source — per the phase's "a fix without a test that would have caught the bug is not done" requirement.
- `npm run type-check`: exits 0.
- `npm run build`: exits 0 (pre-existing chunk-size warning only, no errors).

---

_Fixed: 2026-07-25T16:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
