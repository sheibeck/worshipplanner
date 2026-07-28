---
phase: 23-presentation-preview-mode
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/PresentationViewer.vue
  - src/components/AudioPlayer.vue
  - src/components/VideoPlayer.vue
  - src/components/SlideshowPreview.vue
  - src/views/ServiceEditorView.vue
  - src/components/__tests__/PresentationViewer.test.ts
  - src/components/__tests__/AudioPlayer.test.ts
  - src/components/__tests__/VideoPlayer.test.ts
  - src/components/__tests__/SlideshowPreview.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the new `PresentationViewer.vue` in full, and the Phase-23 diffs (not the pre-existing bodies) of `AudioPlayer.vue`, `VideoPlayer.vue`, `SlideshowPreview.vue`, and `ServiceEditorView.vue`, plus all five associated test files. No XSS vectors, hardcoded secrets, or dangerous-function usage found — all slide content renders through Vue text interpolation, and the "renders markup literally" test confirms it. The already-known `onUnmounted`→`onBeforeUnmount` fix is correctly applied and is covered by a real regression test (it asserts the native `pause()` was invoked, which would fail if the ref-nulling race reappeared).

However, several **sibling lifecycle bugs of the same class** as the one already found and fixed are present, all centered on the interaction between the imperative play/pause driver and Vue's reactive `:key`-based remounting of `AudioPlayer`/`VideoPlayer`. None of these crash the app or leak data, but they produce real incorrect states (silent-muted playback with no visible affordance, stale degraded-state flags suppressing the correct slide's media, an unhandled promise rejection on a very common interaction) that would be visible to a volunteer using this feature live. There is also a real accessibility gap (auto-hide timer defeats the "exit must always be reachable" requirement during loading, and there's no focus trap on the full-screen surface).

## Warnings

### WR-01: Unhandled promise rejection when `pause()` interrupts a pending `play()` (or media errors mid-flight)

**File:** `src/components/VideoPlayer.vue:81-114`, `src/components/AudioPlayer.vue:74-93`, `src/components/PresentationViewer.vue:395-409`

**Issue:** `playCurrentMedia()` fires `void videoRef.value?.play()` / `void audioRef.value?.play()` with no `.catch` (documented in the code comment as intentional, on the assumption the only rejection is `NotAllowedError`, which the players already swallow). But `pauseCurrentMedia()` — called at the *start* of every `goToIndex()`, in `exitPresentation()`, and in `onBeforeUnmount()` — calls `.pause()` on the very media element whose `play()` may still be pending (network fetch for `preload="none"` content is not instantaneous). Per the HTML media spec (and well-documented Chrome behavior, "the play() request was interrupted by a call to pause()"), this rejects the in-flight `play()` promise with an `AbortError`, not a `NotAllowedError`. Both `VideoPlayer.play()`'s outer catch (`isNotAllowedError(err)` check at line 93) and `AudioPlayer.play()`'s catch (line 86) explicitly `throw err` for anything that isn't `NotAllowedError`. Since the caller never awaits or catches that rethrown promise, this becomes an unhandled promise rejection on ordinary rapid navigation through media-carrying slides — precisely the "rapid key-repeat through several media-carrying slides" scenario the UI-SPEC calls out as a required behavior (pause outgoing before playing incoming). The same applies when a native media `error` fires while `play()` is still pending (rejects with `NotSupportedError`/similar, also not `NotAllowedError`).

**Fix:** Treat interruption as an expected, silent outcome alongside `NotAllowedError`, e.g.:
```ts
function isExpectedPlaybackRejection(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')
}
```
and use it in place of `isNotAllowedError` in both players' `play()` catch blocks (video's outer catch and audio's single catch), so a pause-interrupted play never surfaces as an uncaught rejection.

---

### WR-02: `:key="currentVideoUrl"` / `:key="currentAudioUrl"` lets child-component state leak across consecutive slides that share a media URL

**File:** `src/components/PresentationViewer.vue:158-183`, `src/components/VideoPlayer.vue:58,98-113,131-140`

**Issue:** `VideoPlayer`/`AudioPlayer` are only remounted (fresh `muted`/`showPlayAffordance` state) when the *URL* changes between consecutive slides (`:key="currentVideoUrl"`). `resetMediaState()` in the parent only clears the driver's own flags (`mediaFailed`, `audioBlocked`, `videoBlocked`, `videoMutedPlaying`) — it does not, and cannot, reach into the child's internal `muted` ref. If two adjacent slides carry the identical `videoUrl` (e.g. the same background/intro clip attached to two slots in a row), the `VideoPlayer` instance is reused rather than remounted. If the prior slide had gone through the muted-retry path (`muted.value = true`), the reused instance still has `muted === true` when the new slide's `playCurrentMedia()` calls `play()` again: since the element is already muted, the browser's muted-autoplay call now succeeds on the *first* attempt, so the `catch`/`autoplay-blocked` branch is never entered and `emit('autoplay-blocked')` never fires. The parent's `videoMutedPlaying` flag was just reset to `false` by `resetMediaState()`, so no "tap to unmute" chip is ever shown — the new slide plays silently muted with **zero on-screen indication**, contradicting the documented discrimination contract ("`isMuted` lets the driving layer tell muted-success from hard-block apart").

**Fix:** Key on something that uniquely identifies the *slide*, not just its media URL, e.g. `:key="currentSlide?.slide.id"` (or `` `${currentSlide?.slide.id}:${currentVideoUrl}` ``), so every slide transition forces a fresh player instance and the muted/affordance state genuinely resets each time.

---

### WR-03: The `slides.length` watcher clamps `currentIndex` without going through the pause/reset/play lifecycle

**File:** `src/components/PresentationViewer.vue:384-390`

**Issue:** `goToIndex()` is the only place that calls `pauseCurrentMedia()`, `resetMediaState()`, and `playCurrentMedia()` around an index change. The separate watcher on `props.slides.length` (added specifically to keep `currentIndex` in range when a live edit shortens the show) mutates `currentIndex.value` directly, bypassing all three. Consequences when a live edit clamps the index onto a different slide while presenting: (1) `mediaFailed`/`audioBlocked`/`videoBlocked`/`videoMutedPlaying` are never reset, so a stale `true` flag from the *old* slide (e.g. `mediaFailed`) suppresses the *new* slide's `v-if="currentVideoUrl && !mediaFailed"` media wrapper even though the new slide's media is fine; (2) even once the new media element does mount (Vue's own reactivity destroys/recreates it because the computed URL changed), nothing ever calls `.play()` on it, so it sits silently unplayed until the presenter manually navigates away and back.

**Fix:** Route the watcher's clamp through the same helper, e.g. replace the direct assignment with a call that also resets/re-drives media:
```ts
watch(() => props.slides.length, async (len) => {
  const clamped = Math.min(Math.max(currentIndex.value, 0), Math.max(0, len - 1))
  if (clamped !== currentIndex.value) {
    pauseCurrentMedia()
    resetMediaState()
    currentIndex.value = clamped
    await nextTick()
    playCurrentMedia()
  }
})
```

---

### WR-04: Auto-hiding chrome timer hides the exit affordance during loading/empty states, with no non-keyboard fallback

**File:** `src/components/PresentationViewer.vue:228-234, 484-490, 547-554`

**Issue:** `registerActivity()` (which starts the 3s auto-hide timer) is called unconditionally in `onMounted`, and the exit button's opacity/interactivity is governed solely by `chromeVisible` (`opacity-0 pointer-events-none` when hidden) — there is no special case for the loading or empty states. If the assembled slideshow takes more than ~3s to finish loading (a real possibility for a PPTX-heavy or lyrics-fetch-heavy service) and the presenter doesn't touch the mouse/keyboard while waiting, the exit "×" button fades out and becomes `pointer-events-none` — i.e., not just invisible but unclickable — while there is still nothing else on screen to interact with. `Escape` still works, but on a touch-only device (a tablet running the presentation with no physical keyboard) there is no way to trigger it, leaving the volunteer stuck on a blank black screen with no reachable exit. This directly contradicts the phase's own stated requirement (reflected in the code's own comment at line 228, "Exit button — always present... never hidden by v-if, only fades opacity") and the UI-SPEC's empty-state row ("+ a visible 'Exit' affordance"). No test exercises the idle-timeout path against anything other than a populated slide (`hasSlides`/slide-canvas state).

**Fix:** Suppress the idle-hide behavior while `isLoadingState`/`isEmptyState` is true (e.g. gate `chromeVisible` or skip starting/clear the timer in those states so the exit button and, for empty-state, any available controls stay at full opacity and interactive until real slide content is showing).

---

### WR-05: `bodyIsCaption` does not revert after the attached video errors out

**File:** `src/components/PresentationViewer.vue:341, 152-167, 189-194`

**Issue:** `bodyIsCaption` is `computed(() => Boolean(currentVideoUrl.value))` — it depends only on whether the *slide* carries a `videoUrl`, not on whether the video actually rendered. When the video's `@error` fires, `mediaFailed` becomes `true`, which removes the `presentation-video` wrapper (`v-if="currentVideoUrl && !mediaFailed"`) and shows the "Media unavailable" notice — but `bodyIsCaption` stays `true` because `currentVideoUrl` itself hasn't changed, so the slide's own text stays locked at the small caption scale (`text-2xl`) even though there is no longer any dominant video occupying the screen to justify demoting the text. The slide ends up with small caption text and a small gray "Media unavailable" notice, with no full-size (`text-5xl`) content at all.

**Fix:** Gate the caption demotion on both the URL and the non-failed state, e.g. `computed(() => Boolean(currentVideoUrl.value) && !mediaFailed.value)`.

---

### WR-06: No focus containment / modal semantics on the full-screen viewer

**File:** `src/components/PresentationViewer.vue:2-10, 494-510`

**Issue:** The viewer is teleported to `document.body` and covers the viewport visually (`fixed inset-0 z-50`), but it has no `role="dialog"`/`aria-modal="true"` and no focus trap. `handleKeydown` only intercepts `ArrowRight/Left`, `Space`, `Backspace`, and `Escape` — `Tab` is not handled, so keyboard focus can move past the viewer's own buttons into whatever `ServiceEditorView` content remains in the DOM behind the overlay (it is hidden visually, not removed), and screen-reader users get no announcement that a full-screen/modal region has opened. This matters specifically for this component: it is the presentation-facing surface reviewed for accessibility per this phase's scope.

**Fix:** Add `role="dialog"` and `aria-modal="true"` to the teleported root, and either trap `Tab`/`Shift+Tab` within the viewer's focusable elements (exit/prev/next/affordance buttons) or move the rest of the app out of the accessibility tree while presenting (e.g. `aria-hidden` on the app root while `presenting` is true).

## Info

### IN-01: Dead defensive branch in the slides-length watcher

**File:** `src/components/PresentationViewer.vue:384-390`

**Issue:** The second guard, `if (currentIndex.value < 0) currentIndex.value = 0`, can never execute: the preceding branch already clamps via `Math.max(0, len - 1)`, and no other code path ever sets `currentIndex` negative (`goToIndex` guards `next < 0` before assigning, and the initial value is `0`). This is unreachable code that reads as intentional defense-in-depth but adds noise.

**Fix:** Remove the second `if`, or combine both into a single `Math.min(Math.max(...), ...)` clamp (see WR-03's suggested fix, which subsumes this).

### IN-02: Test suite doesn't exercise the pause-interrupts-play rejection path

**File:** `src/components/__tests__/PresentationViewer.test.ts:574-643`

**Issue:** The "pause before play" ordering tests (lines 574-643) mock `HTMLMediaElement.prototype.play`/`pause` as always-resolving/synchronous functions, so they can never reproduce the real browser behavior described in WR-01 (calling `pause()` while a `play()` promise is still pending rejects that promise with `AbortError`). The tests correctly verify *ordering* of the mocked calls, but because the mock never actually rejects when interrupted, this whole class of bug (unhandled rejection on real interrupted playback) is untestable with the current mock shape and was not caught by the suite.

**Fix:** Not required to fix now (per phase scope, jsdom media behavior is deliberately deferred to human-verify), but worth a note in the deferred-verification checklist: add a test double whose `play()` returns a promise that rejects with `AbortError` when `pause()` is called on the same element before it settles, to lock in the WR-01 fix once made.

---

_Reviewed: 2026-07-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
