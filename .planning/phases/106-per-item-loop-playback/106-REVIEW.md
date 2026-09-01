---
phase: 106-per-item-loop-playback
reviewed: 2026-09-01T08:01:30Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/types/service.ts
  - src/views/ServiceEditorView.vue
  - src/composables/useLoopTimer.ts
  - src/composables/useRunControl.ts
  - src/components/run/RunRail.vue
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
fix_status: all_fixed
fixed_at: 2026-09-01T04:16:00Z
---

# Phase 106: Code Review Report

**Reviewed:** 2026-09-01T08:01:30Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the per-item loop playback feature (R306/R307/R308) with a focus on timer
correctness: leaked/duplicate timers, the single-writer navigation invariant, wrap
semantics, go-to-black pause/resume, interval clamping, and watcher ordering.

The core timer-safety invariants hold up under adversarial tracing:

- **Single interval, always:** `useLoopTimer` keeps exactly one `intervalId` in a
  closure; `arm()` unconditionally calls `disarm()` first (`useLoopTimer.ts:43-47`), so
  no code path can ever leave two live intervals. `onUnmounted(disarm)` is registered
  unconditionally (`useLoopTimer.ts:49`), so a bare route-away/unmount can never leak a
  timer even if `useRunControl.ts` forgot an explicit disarm somewhere.
- **Single-writer confirmed by exhaustive grep:** `index.value =` is assigned in exactly
  one place, `postIndex()` (`useRunControl.ts:127`); `advanceLoop()` never touches
  `index.value` or the channel directly — it only calls `postIndex()`
  (`useRunControl.ts:1154-1161`). The loop can never fight or double-drive the output
  window.
- **Wrap semantics correct:** `advanceLoop()` operates on `filmstrip.value.indices` (the
  current item's global indices only), wraps to `indices[0]` from the last position, and
  never calls `goByItem` — a single/zero-slide item can never satisfy
  `filmstrip.value.slides.length > 1` in `reconcileLoop()`, so it never arms
  (`useRunControl.ts:1170-1179`). Verified against the behavioral suite's wrap and
  single-slide-no-op cases.
- **Go-to-black pause/resume is synchronous and race-free:** `postBlackout()` sets
  `blackout.value` and calls `reconcileLoop()` synchronously in the same call
  (`useRunControl.ts:152-161`), so there is no window where blackout is true and the
  timer is still armed (or vice versa). `reconcileLoop()`'s `arm()` always resets the
  clock via `disarm()`-then-`setInterval`, so a resume always starts a fresh full
  interval — no partial/stale tick survives a blackout toggle.
- **Interval clamping is sound:** `clampInterval()` clamps to 1–3600, rounds, and falls
  back to 10 on any non-finite input (`useRunControl.ts:1137-1140`), applied on every
  `arm()` call, so a malformed/legacy `intervalSeconds` can never produce a zero,
  negative, or runaway interval.

Two watcher-ordering gaps and one dead-code item remain — none of them produce a leaked
or duplicate timer, but they are real correctness/consistency gaps worth fixing given
this phase's explicit R308 focus.

## Fix Log (2026-09-01)

All three findings fixed and committed atomically on `master`:

- **WR-01 — FIXED** (`6c8f5080`... see `86105b48`): added
  `watch(() => filmstrip.value.slides.length, reconcileLoop)` in
  `src/composables/useRunControl.ts` (after the existing `watch(currentSlotIndex, ...)`
  / `watch(live, ...)`), so a mid-run async render (e.g. a PPTX deck resolving late)
  that grows the CURRENT item's slide count past 1 arms the loop timer without
  requiring a navigation event. Regression test added to
  `src/views/__tests__/RunControlView.loop.test.ts`: mutates the mocked
  `assembledSlideshow` ref post-mount to grow a 1-slide looping item to 3 slides with
  no navigation, and asserts the timer arms and auto-advances a full interval later.
  The test mock was restructured to stash the live `assembledSlideshow` ref on the
  hoisted fixture object (`H.assembledSlideshowRef`) so tests can mutate it after
  mount. Commit: `86105b48`.
- **WR-02 — FIXED** (commit `e004fe32`): added an explicit `loopTimer.disarm()` call
  at the top of `endRehearsal()` in `src/composables/useRunControl.ts`, mirroring
  `endServiceTeardown()`'s existing defense-in-depth disarm — this exit path does not
  unmount the component, so `useLoopTimer`'s own `onUnmounted(disarm)` safety net does
  not apply, and disarming previously depended solely on the async
  `watch(live, reconcileLoop)`. Regression test added: "ending a rehearsal while
  looping clears the timer" exercises the header exit affordance
  (`run-exit-btn` → `onExitRequest` → `endRehearsal()`) while a loop is armed and
  asserts no further auto-advance posts across 30s. Commit: `e004fe32`.
- **IN-01 — FIXED** (commit `6c8f5080`): removed the unused `isArmed` ref/field from
  `UseLoopTimer`'s interface and implementation in `src/composables/useLoopTimer.ts`
  (dead code — no consumer in `useRunControl.ts` or any test referenced it; every
  test in the suite already asserts behavior via `fake.posted` state messages).
  Commit: `6c8f5080`.

Verification: `npm run type-check` clean; `npx vitest run
src/views/__tests__/RunControlView.loop.test.ts
src/views/__tests__/RunControlView.output.test.ts` — 47/47 passing (8 in the loop
suite, up from 6 pre-fix). Full `npx vitest run` shows only the two pre-existing
baseline failures (`src/storage.rules.test.ts` — Storage-emulator dependent, and the
stale duplicate `src/stores/appConfig.test.ts` assertion), neither touched by these
changes.

## Warnings

### WR-01: `reconcileLoop()` is never re-evaluated when the current item's slide count changes without navigation

**File:** `src/composables/useRunControl.ts:1170-1189` (see also `filmstrip` at
`useRunControl.ts:1107-1117` and `assembledSlideshow` in
`src/composables/useSlideshowAssembly.ts:511-522`)

**Issue:** `reconcileLoop()` is a plain function, not a `computed`/`watchEffect` — reading
`filmstrip.value.slides.length` inside it does **not** create a reactive subscription.
It is only ever invoked from four explicit triggers: `postIndex()`, `postBlackout()`,
`watch(currentSlotIndex, ...)`, and `watch(live, ...)`. None of these fire when the
*slide count of the currently-active item* changes for a reason other than navigation —
and `assembledSlideshow` (which `filmstrip` derives from) is a live computed over
`pptxRendersByImportId` / `renderedImageUrlsByImportId` / `importedDecksById`
(`useSlideshowAssembly.ts:511-522`), all of which can resolve asynchronously **after**
Run has started (a PPTX/IMPORTED item's render finishing, or scripture/song content
arriving late).

Concretely: if a looping IMPORTED (or any) item is the *current* item at Run start with
only 1 assembled slide (so `reconcileLoop()` correctly does not arm it), and its deck
finishes rendering into 3 slides a few seconds later while the operator has not
navigated, the timer stays disarmed — the item silently never starts looping until the
operator happens to trigger any navigation/blackout event. The reverse (item shrinks
from armed to ≤1 slide with no accompanying navigation) leaves the timer needlessly
armed until the next reconcile, though `advanceLoop()`'s own `indices.length <= 1` guard
(`useRunControl.ts:1156`) makes that direction merely a harmless dead tick rather than a
misfire.

**Fix:** Add a watcher on the current item's assembled slide count so a mid-run render
completion is reconciled without requiring a navigation:
```ts
// after the existing watch(currentSlotIndex, reconcileLoop) / watch(live, reconcileLoop)
watch(() => filmstrip.value.slides.length, reconcileLoop)
```

### WR-02: `endRehearsal()` has no explicit `loopTimer.disarm()`, unlike `endServiceTeardown()`, and the path is untested

**File:** `src/composables/useRunControl.ts:967-972`

**Issue:** `endServiceTeardown()` explicitly calls `loopTimer.disarm()` "as defense in
depth alongside... the watch(live) reconcile" (`useRunControl.ts:903-907`). `endRehearsal()`
— the sibling exit path used when a rehearsal ends (`onExitRequest()` branches to it at
`useRunControl.ts:982-988`) — sets `live.value = false` and three other flags but does
**not** call `loopTimer.disarm()` directly; it relies solely on the async
`watch(live, reconcileLoop)` (`useRunControl.ts:1189`) to disarm. Unlike
`endServiceTeardown()`, the component is **not** unmounted here (Run stays on the same
route, re-rendering State A), so `useLoopTimer`'s own `onUnmounted(disarm)` safety net
does not apply either — disarming genuinely depends on the watcher firing.

In practice Vue's default `flush: 'pre'` watcher timing resolves on the next microtask,
which is always far shorter than the minimum 1s loop interval, so this is not observed
to leak a tick today. But it is an inconsistency with the codebase's own stated
"defense-in-depth" posture for this exact concern, and — more importantly — there is no
test in `RunControlView.loop.test.ts` that exercises "End Rehearsal while a loop is
armed" and asserts the timer stops (the suite covers unmount, item-change, and blackout
disarm, but not this fourth teardown path called out in 106-CONTEXT.md: "the operator
leaves the Run screen ... or the run ends").

**Fix:** Make `endRehearsal()` symmetric with `endServiceTeardown()`:
```ts
function endRehearsal() {
  loopTimer.disarm() // explicit, mirrors endServiceTeardown's defense-in-depth
  rehearsing.value = false
  live.value = false
  blackout.value = false
  resetElapsed()
}
```
and add a regression case to `RunControlView.loop.test.ts` asserting no further
auto-advance posts after ending a rehearsal while looping.

## Info

### IN-01: `useLoopTimer`'s `isArmed` ref is dead code

**File:** `src/composables/useLoopTimer.ts:22-29, 33, 40, 46, 51`

**Issue:** `isArmed` is documented as "exposed for tests" and returned from the
composable, but `useRunControl.ts` never reads `loopTimer.isArmed`, never re-exports it
in its return object, and no test in the codebase (`RunControlView.loop.test.ts` or
otherwise) references `isArmed` — every test asserts behavior via `fake.posted` state
messages instead. It is unused public surface.

**Fix:** Either wire it into a test assertion (e.g. assert `isArmed` transitions
alongside the `fake.posted` checks) to justify keeping it, or drop it from the
interface/implementation until an actual consumer needs it.

---

_Reviewed: 2026-09-01T08:01:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
