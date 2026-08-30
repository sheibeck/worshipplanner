---
phase: 94-confidence-monitor-output
reviewed: 2026-08-28T22:18:59Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/composables/useOutputWindow.ts
  - src/views/AudienceOutputView.vue
  - src/views/ConfidenceOutputView.vue
  - src/router/index.ts
  - src/views/__tests__/ConfidenceOutputView.test.ts
  - src/composables/__tests__/useOutputWindow.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 94: Code Review Report

**Reviewed:** 2026-08-28T22:18:59Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the shared lifecycle-core extraction (`useOutputWindow.ts`), the refactored
`AudienceOutputView.vue`, the new `ConfidenceOutputView.vue`, the new
`/present/confidence/:serviceId` route, and the two new test suites (22 + 12), against 94-01-PLAN,
94-UI-SPEC, 94-CONTEXT, REQUIREMENTS R272, and PITFALLS 5/6 + the Wake-Lock note. Cross-checked the
real `SlideCanvas.vue`, `runChannel.ts`, `VideoPlayer.vue`, `AudioPlayer.vue`, and the actual
pre-/post-refactor git diff of `AudienceOutputView.vue` (commits d1369bf9 / 9f2763a4).

**All seven of the phase's highest-risk contracts check out in the source, not just in passing
tests:**

1. **Extraction is behavior-preserving for AudienceOutputView — CLEAN.** The `9f2763a4` diff is a
   pure lift: the template (lines 1-62) is byte-identical, and the moved blocks (scoping, WR-02 gate,
   read-only assembly, channel, font gate, rootStyle, fullscreen recovery, wake lock, onMounted/
   onUnmounted) are removed verbatim into the composable. The three view-local pieces stayed local:
   `currentSlide`, `slideCanvasRef`, the `watch(index)` pause→nextTick→play watcher, and the
   `onBeforeUnmount` pause. The `channelFactory` seam survives as a composable argument
   (`useOutputWindow({ channelFactory: props.channelFactory })`). The one imperative touch-point —
   the old `onMounted` deferred first-play (`await nextTick(); play()`) — is re-homed to a
   `watch(fontReady)` that plays once after the DOM flush; this is behaviorally equivalent (fontReady
   transitions false→true exactly once, pre-flush watcher then `nextTick().then(play)`).
2. **Black-suppression invariant (R272) — CLEAN.** Both confidence panes pass
   `:suppressBackground="true"` (`ConfidenceOutputView.vue:29, :48`). `SlideCanvas`'s
   `currentBackgroundUrl` checks `suppressBackground` FIRST and returns `null`
   (`SlideCanvas.vue:359-363`), so neither `presentation-background` nor `presentation-background-scrim`
   is emitted. The suite closes the DOM chain with the REAL (`vi.importActual`) canvas for a
   background-carrying slide AND a video slide, plus a non-vacuous `suppressBackground=false` control.
   No path leaks a background on either pane.
3. **Next = index+1, last-slide no reflow — CLEAN.** `nextSlide = assembledSlideshow[index+1] ?? null`
   (`:133-135`); out-of-range → `undefined` → `null` (no wrap to 0, no throw). The next-region wrapper
   (`flex-[3_1_0%]`, `:41-58`) is always present; only the inner `SlideCanvas`
   (`v-if="nextSlide && fontReady"`) and the "Next" tag (`v-if="nextSlide"`) disappear on the last
   slide. Current region stays `flex-[7_1_0%]`. Verified by the last-slide test.
4. **Next pane never autoplays media — CLEAN.** The next `SlideCanvas` has no `ref` and is never
   sent `play()`. Confirmed defense-in-depth: `VideoPlayer.vue`/`AudioPlayer.vue` carry NO `autoplay`
   attribute (playback is imperative-only via the exposed `play()`), and `:interactive="false"`
   suppresses the autoplay-blocked affordances. The band cannot hear/see the upcoming slide's media.
5. **Composable lifecycle — CLEAN.** `onMounted`/`onUnmounted` register on the consuming instance;
   channel `close()`, both `removeEventListener`s, wake-lock release, and `unsubscribeAll()` all run
   on unmount. The WR-02 gate keys on org MISMATCH (`orgId && serviceStore.orgId !== orgId`), proven
   by the fresh/different/same-org tests in both suites. Receive-only: `onState`/`postHello`/`close`
   only — `grep` finds `postState` only in a doc comment.
6. **No auto-teardown on fullscreen loss (Pitfall 6) — CLEAN for both views.**
   `handleFullscreenChange` (`useOutputWindow.ts:110-112`) has exactly one statement setting
   `isFullscreen`; it reaches no exit/close/unmount path. Since it lives in the composable, both views
   inherit the correct divergence from `PresentationViewer`.
7. **Chrome absence + shared-surface parity — CLEAN.** Confidence has zero operator chrome; the
   re-enter affordance markup, `cursor` toggle, and pure-black loading gate are the same shared
   surface (rootStyle + isFullscreen + fontReady come from the one composable). The suite asserts zero
   buttons while fullscreen and `cursor: none`.

One warning and four info items follow. None is a blocker; none touches the black-suppression,
no-teardown, receive-only, or next-static invariants R272 hinges on. The warning is a narrow
loading-state leak specific to the confidence view's "Next" label.

## Warnings

### WR-01: The confidence "Next" label is gated on `nextSlide` only (not `fontReady`) — it renders during the font-gate loading window, breaking the pure-black/zero-elements loading contract — ✅ RESOLVED

> **Resolved 2026-08-28.** The "Next" label's condition is now `v-if="nextSlide && fontReady"`, matching
> the two `SlideCanvas` panes it labels, so nothing renders on the confidence surface while the bounded
> font gate holds. A new regression test in the pure-black loading-gate suite
> ("does NOT render the 'Next' label when a state arrives before the font gate resolves, then reveals it
> once fontReady resolves") reproduces the exact race the existing tests avoid: it holds the gate open
> with a pending `document.fonts.ready`, emits a mid-deck `RunState` underneath it (index set →
> `currentSlide`/`nextSlide` both non-null, `fontReady` still false), and asserts BOTH panes hidden AND
> `confidence-next-label` absent AND `wrapper.text()` empty — then resolves the gate and asserts the
> label plus both panes ('b' current, 'c' next) appear. All prior tests stay green (confidence 22 → 23,
> audience 18 unchanged); `npm run type-check` clean.

**File:** `src/views/ConfidenceOutputView.vue:51-57` (label), vs `:45` (next canvas) and `:25` (current canvas)
**Issue:** Both `SlideCanvas` panes are correctly gated `v-if="... && fontReady"`, but the "Next" tag
is gated only `v-if="nextSlide"`. There is a real race — the one the deferred-first-play code exists
to handle — where the first `RunState` arrives BEFORE the bounded font gate resolves. In that window
`fontReady` is still `false` while `index` is set (say 0), so `currentSlide` and `nextSlide` are both
non-null: both canvases stay hidden (pure black, correct) but the "Next" label renders — a stray gray
`NEXT` in the top-left of an otherwise-black surface. This violates the loading contract the UI-SPEC
states verbatim ("Before slides assemble AND before the first `RunState` arrives AND while the font
gate holds: pure black, zero elements") and its own rationale that a stray label on a black stage
surface "reads as broken." The font gate is bounded but can hold up to `FONT_LOAD_TIMEOUT_MS` on a
cold font load, so this is a multi-second flash on a slow-font/fast-control ordering, not a
sub-frame blip. It is also the ONLY way an element renders while `currentSlide` is null: for every
non-race null-current case (`index` null, or out-of-range) `nextSlide` is also null, so the label is
correctly hidden — which is exactly why no existing test catches this (every test lets `fontReady`
resolve before emitting state).
**Fix:** Gate the label the same way as the pane it names:
```html
<span
  v-if="nextSlide && fontReady"
  data-testid="confidence-next-label"
  ...
>Next</span>
```
Add a test that emits a state while `fontReady` is held false and asserts `confidence-next-label`
does not exist (and `wrapper.text()` is empty), to lock the pure-black loading invariant.

## Info

### IN-01: `onUnmounted` gates `serviceStore.unsubscribeAll()` behind an awaited `wakeLock.release()` (carry-over of 93 IN-04, now in shared code)

**File:** `src/composables/useOutputWindow.ts:201-214`
**Issue:** The hook is `async`; `serviceStore.unsubscribeAll()` runs only after
`await wakeLock.value?.release()`. The critical synchronous teardown (`handle.close()`, both
`removeEventListener`s) correctly precedes the first `await`, and a rejected release is try/caught —
but if `release()` ever hung, the services-store Firestore listener would leak. Moot for a closing
standalone window and not a realistic browser failure, but this ordering nit now lives in shared code
consumed by BOTH output windows, so it is worth hardening once.
**Fix:** Move `serviceStore.unsubscribeAll()` above the awaited release (or drop the `await` and let
release settle detached) so store teardown never depends on an external promise settling.

### IN-02: `acquireWakeLock()` overwrites the sentinel ref without releasing the prior or observing its `release` event (carry-over of 93 IN-03, now shared)

**File:** `src/composables/useOutputWindow.ts:126-140`
**Issue:** Every call assigns `wakeLock.value = await navigator.wakeLock.request('screen')`, including
from `handleVisibilityChange`. Nothing listens to the sentinel's `release` event to null the ref, and
the previous sentinel is not released before being overwritten. Harmless in normal operation (the
browser auto-releases on tab-hide, which is why re-acquisition is needed), but a `visibilitychange`→
visible without a preceding auto-release would orphan the old sentinel. Low likelihood; flagged for
robustness now that it is shared across both views.
**Fix:** Optionally attach `sentinel.addEventListener('release', () => { wakeLock.value = null })`
after a successful request, and/or release a non-null sentinel before re-requesting.

### IN-03: `rootStyle` computed forward-references `isFullscreen` before its declaration

**File:** `src/composables/useOutputWindow.ts:85-89` (uses `isFullscreen.value`) vs `:105` (declares `isFullscreen`)
**Issue:** `rootStyle` (line 85) reads `isFullscreen.value` but `isFullscreen` is not declared until
line 105. This is runtime-safe — a computed's getter is lazy and only runs at first access (render),
by which point `isFullscreen` is initialized — so it is not a TDZ crash. It is a readability/
maintenance smell: a future refactor that eagerly evaluates `rootStyle` in setup, or reorders these
blocks, could trip the temporal dead zone.
**Fix:** Declare `rootRef`/`isFullscreen` above `rootStyle` so the dependency reads top-to-bottom.

### IN-04: `resolvedFontChoice` + `DEFAULT_FONT_*` constants remain duplicated with `PresentationViewer.vue` (carry-over of 93 IN-05)

**File:** `src/composables/useOutputWindow.ts:80-99`
**Issue:** The extraction correctly de-duplicates these between the audience and confidence windows
(they now share the composable), but the thin `resolvedFontChoice()` wrapper and the
`DEFAULT_FONT_FAMILY`/`DEFAULT_FONT_WEIGHT` constants are still a second copy of what lives in
`PresentationViewer.vue`. The load-bearing gate logic is already shared via `slideTypography.ts`, so
this is a minor consolidation opportunity, not a defect (Pitfall 17 drift risk on the wrapper only).
**Fix:** Consider promoting `resolvedFontChoice`/the default constants into `slideTypography.ts` so
`PresentationViewer` and `useOutputWindow` call one implementation.

---

_Reviewed: 2026-08-28T22:18:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
