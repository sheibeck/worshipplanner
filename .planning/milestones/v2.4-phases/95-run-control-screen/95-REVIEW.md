---
phase: 95-run-control-screen
reviewed: 2026-08-29T00:25:52Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/composables/useServiceAssembly.ts
  - src/composables/useOutputWindow.ts
  - src/views/RunControlView.vue
  - src/router/index.ts
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/RunControlView.test.ts
  - src/views/__tests__/RunControlView.output.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 95: Code Review Report

**Reviewed:** 2026-08-29T00:25:52Z
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the milestone-centerpiece Run/Control screen: the new `useServiceAssembly` extraction, the
`useOutputWindow` refactor that now consumes it, the large `RunControlView.vue` (single-writer
channel, rail, dual preview, keyboard, Escape-confirm, Go-live orchestration, honest output state
machine), the new `/run/:serviceId` route, the `ServiceEditorView` Run button + `canRunService`, and
the three new/extended test suites. Cross-checked `runChannel.ts`, `serviceSlots.ts`,
`monitorConfig.ts`, and the `MonitorSetupView.vue` gesture precedent. Verified in SOURCE (not just via
passing tests) against 95-01…95-06-PLAN, 95-UI-SPEC, 95-CONTEXT, REQUIREMENTS R261-R266/R275, and
PITFALLS 1/5/6.

**Six of the seven highest-risk contracts hold up in the source:**

1. **Single-writer seq correctness (R266) — CLEAN.** `seq` (a per-instance `let seq = 0`) advances on
   EVERY write path: `postIndex` (`RunControlView.vue:444-448`, `seq += 1` before every post) covers
   initial go-live, every navigation, and the `watch(assembledSlideshow)` late-arrival; `resendCurrent`
   (`:451-455`) increments before the onHello resend. No double slide-0: both the onMounted go-live
   (`:772`) and the late-arrival watch (`:777-779`) gate on `index.value == null`, which becomes non-null
   after the first `postIndex(0)`, so exactly one is ever taken. The view registers `onHello` only and
   NEVER `onState` — it is genuinely write-only on `state`, so runChannel's own broadcast-back exclusion
   plus the absent `onState` mean control can never act on its own state. seq is strictly monotonic, so
   runChannel's `seq <= highestDeliveredSeq` stale-drop (`runChannel.ts:133`) never rejects a legitimate
   advance.
2. **Activation-correct Go-live (Pitfall 1/5) — CLEAN.** `openOutputs` (`:704`) is bound ONLY to the
   three click handlers (`run-go-live-btn` `:28`, `run-go-live-retry` `:106`, `run-blocked-retry` `:203`)
   — never `onMounted`. `onMounted` (`:768-773`) opens the channel and posts slide 0 but opens ZERO
   windows. Inside `openOutputs` the only statement before `getScreenDetails()` is the synchronous
   `outputStatus.value = 'opening'` ref set and the `'getScreenDetails' in window` feature-detect; there
   is no await/store/router before it, so `window.open` + `requestFullscreen({ screen })` run in the
   `.then` while the click's transient activation is live. Mirrors `MonitorSetupView.onDetectClick`.
3. **Honest state machine — CLEAN (with one real gap, WR-02 below).** Every "opened/ready" claim is
   gated on a non-null `window.open` handle: `openPlaced` (`:664-668`) and `openUnplaced` (`:680-684`)
   both set `blocked` when `!aWin && !cWin`, otherwise `placed`/`fallback`. `blocked` and `fallback` are
   mutually exclusive by the single `outputStatus` ref. `openWindow` (`:620-645`) wraps `moveTo` and
   `requestFullscreen` in try/catch and returns the raw handle, never throwing on a null window or a
   rejected fullscreen. The blocked/fallback banners never render a green success dot.
4. **Escape = no teardown until confirmed (Pitfall 6) — CLEAN.** `handleKeydown`'s `Escape` branch
   (`:578-581`) only sets `confirmOpen = true`; the top guard `if (confirmOpen.value) return` (`:557`)
   makes every nav key inert while the dialog is open. Only `confirmExit` (`:748-754`) tears down, and it
   wires `closeOutputs()` FIRST, then `handle?.close()`, then `router.push`. `closeOutputs` (`:731-739`)
   iterates every opened handle with a guarded `.close()`.
5. **useServiceAssembly extraction did NOT regress Phases 93/94 — CLEAN.** `unsubscribeAll()` lives
   ONLY in `useOutputWindow.onUnmounted` (`useOutputWindow.ts:181`); `useServiceAssembly` registers no
   `onUnmounted` and no `unsubscribeAll` (`useServiceAssembly.ts:63-83`), and `RunControlView.onUnmounted`
   (`:781-784`) only closes the channel and removes the keydown listener — so this in-app route never
   tears down peers' subscriptions. Subscribe-before-channel ordering is preserved by call order:
   `useServiceAssembly()` is called first in both consumers, so its WR-02 subscribe `onMounted` registers
   and fires before the channel-opening `onMounted`. The WR-02 gate keys on org mismatch
   (`orgId && serviceStore.orgId !== orgId`).
6. **RBAC (R275) — CLEAN.** `canRunService = isLocked.value && !!authStore.orgId`
   (`ServiceEditorView.vue:2125`) — NOT `isEditor`. The button `v-if="canRunService"` (`:102`) sits in the
   header flex row, not the editor-gated lock banner, so a viewer of a locked service can Run; it is
   absent on a draft and for an org-less user. The `/run/:serviceId` route is `requiresAuth` only
   (`router/index.ts:125-128`). `onRun` (`:2132-2135`) is pure navigation, no store mutation. Proven by
   the five-test describe block (editor present, viewer present, draft absent, org-less absent, click
   navigates).
7. **Rail/keyboard correctness (R262/R263/R265) — CLEAN.** `isActive` matches `currentSlotIndex`
   (`current.value?.slotIndex`, `:463`/`:505`); `jumpToSlot` and `goByItem` jump via
   `firstAssembledIndexBySlot` and no-op on empty slots (`:526-539`); empty slots render the
   non-interactive `rail-item-empty` div (`:271-282`); Up/Down walk to the previous/next item with slides;
   `window.open` uses plain features with no `noopener` (`:624`), preserving the sessionStorage org carry.

The two warnings both live in the Go-live output orchestration — the one contract the tests exercise
only with all-or-nothing window mocks, so neither race is caught by the suite. Neither touches the
single-writer, no-teardown-on-Escape, write-only, or RBAC invariants.

## Warnings

### WR-01: `openOutputs()` has no stale-resolution / unmount guard — a late `getScreenDetails()` resolve re-opens orphaned output windows AFTER the operator has exited Run mode — ✅ RESOLVED

> **Resolved 2026-08-28** (commit `e3072efa`). `openOutputs()` now claims a monotonic `goLiveRequestId`
> token (`const requestId = ++goLiveRequestId`) at the start of the gesture — mirroring
> `MonitorSetupView`'s `detectRequestId` precedent — and its `getScreenDetails().then/.catch` both
> short-circuit with `if (isUnmounted || requestId !== goLiveRequestId) return` before opening any
> window. `confirmExit()` bumps `goLiveRequestId += 1` (invalidating any in-flight resolve) and
> `onUnmounted` sets `isUnmounted = true`, so a `getScreenDetails()` that resolves AFTER a confirmed
> exit or an unmount is a no-op and can never open orphaned audience/confidence windows. A fresh Go-live
> click also bumps the token, collapsing the double-click concurrent-open symptom. Two regression tests
> were added to `RunControlView.output.test.ts` using a deferred `getScreenDetails` whose resolution the
> test controls: one exits run mode (Escape → confirm) and one unmounts the view BETWEEN the Go-live
> click and the resolution, each asserting `window.open` was never called and zero windows opened.
> `npm run type-check` clean; bare `npx vitest run` shows only the `storage.rules.test.ts` baseline.

**File:** `src/views/RunControlView.vue:704-728` (no guard), vs `src/views/MonitorSetupView.vue:208-214` (the precedent it omits)
**Issue:** `openOutputs()` fires `getScreenDetails().then(...)` with no monotonic token and no
mounted-check. If the operator clicks Go live and then — while the Window-Management permission prompt
or the `getScreenDetails()` promise is still in flight — presses Escape and confirms exit, `confirmExit`
runs `closeOutputs()` + `handle.close()` + `router.push` and the component unmounts, but the pending
promise is not cancelled. When it later resolves, its `.then` still runs `openPlaced`/`openUnplaced`,
which call `window.open` and open BRAND-NEW audience/confidence windows that are now orphaned: the
component is gone, `outputWindows` is unreachable, and nothing will ever `close()` them. The operator
believes they blacked the projector, but two live output windows re-appear. This is exactly the
teardown-correctness hazard Pitfall 6 warns about, and the SAME class of bug was already fixed once in
this repo — `MonitorSetupView` carries a `detectRequestId` monotonic token (`:214`) bumped by every new
attempt AND the manual-fallback so a stale resolution is a no-op. That guard was not carried into the
Run/Control gesture. A secondary symptom of the same gap: double-clicking Go live (or clicking a retry
while a resolve is in flight) runs two concurrent `openPlaced` passes and double `requestFullscreen`
calls (partly masked by named-window dedupe, but still redundant activation churn).
**Fix:** Add a monotonic guard mirroring `MonitorSetupView`, and short-circuit the `.then`/`.catch` when
the token is stale or the view has unmounted:
```ts
let goLiveRequestId = 0
let isUnmounted = false
onUnmounted(() => { isUnmounted = true /* ...existing teardown... */ })
function confirmExit() { goLiveRequestId += 1 /* invalidate any in-flight resolve */; closeOutputs(); handle?.close(); router.push(/*…*/) }
function openOutputs() {
  const requestId = ++goLiveRequestId
  outputStatus.value = 'opening'
  if (!('getScreenDetails' in window)) { openUnplaced(); return }
  ;(window as …).getScreenDetails()
    .then((details) => {
      if (isUnmounted || requestId !== goLiveRequestId) return   // stale — do NOT open
      /* …existing matched/fallback branch… */
    })
    .catch(() => { if (isUnmounted || requestId !== goLiveRequestId) return; openUnplaced() })
}
```
Add a test that triggers Go live, resolves `getScreenDetails` only AFTER a confirmed exit, and asserts
`window.open` was not called post-exit.

### WR-02: A partial pop-up open (exactly one of the two `window.open` calls returns null) is reported as full success — the honest-state contract only treats BOTH-null as blocked — ✅ RESOLVED

> **Resolved 2026-08-28** (commit `e3072efa`). Both open paths now route their two handles through a
> shared `bothOpened(aWin, cWin)` gate before any success claim: both-null → `blocked` (unchanged),
> both-open → returns `true` so the caller may claim `placed`/`fallback` (unchanged), and exactly-one-null
> → a NEW honest `partial` state that records the refused role (`blockedRole.value = aWin ? 'confidence'
> : 'audience'`) and returns `false`. A `run-partial-banner` (amber, never green) names the dark display
> ("The **confidence** display was blocked … click Go live again") and offers a `run-partial-retry`
> affordance, mutually exclusive with fallback/blocked by the single `outputStatus` ref. A green
> "Displays ready" or a "two windows opened" fallback claim now requires BOTH handles. Two regression
> tests were added: matched-placement with the confidence `window.open` returning null asserts NOT
> `run-status-placed`, no fallback banner, and a partial banner naming "confidence"; the fallback path
> with the audience `window.open` null asserts NO `run-fallback-banner` and a partial banner naming
> "audience". `npm run type-check` clean; all prior output tests stay green (8 → 12).

**File:** `src/views/RunControlView.vue:659-672` (`openPlaced`) and `:675-685` (`openUnplaced`)
**Issue:** Both open paths gate the blocked state on `!aWin && !cWin`, then unconditionally claim success
(`placed` with both `readyAudienceLabel`/`readyConfidenceLabel`, or `fallback`) whenever ≥1 handle is
non-null. The inline comment justifies this as "a pop-up blocker in a gesture is all-or-nothing," but
that assumption is not universally true: several browsers grant only ONE window per user activation, so
the FIRST `openWindow(audienceUrl, 'wp-audience', …)` succeeds (non-null) and the SECOND
`openWindow(confidenceUrl, 'wp-confidence', …)` is blocked (null). That falls into `!aWin && !cWin ===
false`, so the UI paints a green "Displays ready → Audience → X, Confidence → Y" while the confidence
monitor never opened and stays black. This directly contradicts the phase's headline "honest output
state machine" (95-04) — a green/ready claim while a display is dark. Likelihood is lower on the primary
Chrome/Edge target (which permit multiple popups per gesture and are where the Window-Management API
exists), which is why it is a warning rather than a blocker, but the `matched`/`fallback` copy asserts a
per-monitor guarantee the code does not verify. The test suite only exercises both-open or both-null, so
it cannot catch this.
**Fix:** Track the two handles independently and degrade to an honest partial state — e.g. if exactly one
is non-null, keep the successfully-opened side's label but surface a "one display was blocked — allow
pop-ups and Go live again" affordance for the missing one (reuse the blocked banner copy scoped to the
missing role), rather than claiming both are ready. At minimum, treat `!aWin || !cWin` (not only
`&&`) as not-fully-placed. Add a test that returns null for only the second `window.open` and asserts no
`run-status-placed` / no full "Displays ready" claim.

## Info

### IN-01: The rail shows the "Nothing to present yet" empty state during the initial load window, conflicting with the preview's "Loading slideshow…"

**File:** `src/views/RunControlView.vue:225` (`v-if="firstIndexBySlot.size === 0"`) vs `:304-310` (current preview loading text)
**Issue:** `firstIndexBySlot` derives from `assembledSlideshow`, which is empty until `localService`
resolves and the assembly computes. On first paint (before Firestore returns), the rail renders
"Nothing to present yet — This service doesn't have any slides," while the current-preview pane
simultaneously shows "Loading slideshow…". The two disagree during the load window: one asserts the
service is empty, the other that it is loading. For a genuinely-empty locked service the empty state is
correct, but there is no distinction between "still loading" and "truly empty."
**Fix:** Gate the empty state on a loaded-but-empty condition, e.g. `v-if="localService && firstIndexBySlot.size === 0"`
(and optionally a distinct "Loading order of service…" placeholder while `localService` is null), so the
rail never claims emptiness before the service has loaded.

### IN-02: An out-of-range `index` after a mid-run assembly shrink is never re-clamped — the current preview shows "Loading slideshow…" misleadingly

**File:** `src/views/RunControlView.vue:457-462` (`current`/`next`) and `:777-779` (`watch(assembledSlideshow)`)
**Issue:** If `assembledSlideshow` shrinks while `index` points past the new end (e.g. content edited in
another tab during a run), `current` resolves to `undefined ?? null` and the pane falls back to the
"Loading slideshow…" copy even though nothing is loading — the index is simply stale. The
`watch(assembledSlideshow)` only re-posts when `index.value == null`, so it never clamps a now-invalid
index back into range. Low likelihood (running is read-only), but the fallback text is misleading and the
posted `state.index` would point outside the deck.
**Fix:** In the assembly watch, clamp a non-null `index` into `[0, slides.length - 1]` (and `postIndex`
the clamped value if it changed) so the live index always addresses a real slide; distinguish the
genuine null-index "Loading…" case from an out-of-range one.

### IN-03: `onRun` builds the `/run` URL by string concatenation without `encodeURIComponent` — ✅ RESOLVED

> **Resolved 2026-08-28** (commit `36394d0f`). `onRun` now wraps both interpolated ids in
> `encodeURIComponent` — `'/run/' + encodeURIComponent(localService.value.id) + '?org=' +
> encodeURIComponent(authStore.orgId ?? '')` — so a service/org id carrying a URL-reserved character can
> no longer corrupt the `/run` path or the `?org=` query. Kept the string form (rather than the object
> form) deliberately so the existing five Run-button tests, which assert the exact pushed string
> `'/run/service-1?org=org-1'`, stay green — Firestore ids are URL-safe so the emitted URL is byte-identical
> for real ids; this is defence against a future id shape, not a behaviour change. All 340
> `ServiceEditorView.test.ts` tests pass; `npm run type-check` clean.

**File:** `src/views/ServiceEditorView.vue:2132-2135`
**Issue:** `router.push('/run/' + localService.value.id + '?org=' + authStore.orgId)` interpolates the
service id and org id directly. Both are Firestore-generated ids today (URL-safe), and the value is not
user-controlled free text, so this is not an injection risk — but the string-built query diverges from
the object-form `router.push` used elsewhere and would silently break if an id ever contained a
reserved character.
**Fix:** Prefer the object form for consistency and safety:
`router.push({ name: 'run-control', params: { serviceId: localService.value.id }, query: { org: authStore.orgId } })`.

### IN-04: Theoretical — `index` could be set-but-never-posted if the assembly ref changes between `setup()` and `onMounted`

**File:** `src/views/RunControlView.vue:777-779` (`watch(assembledSlideshow)`) vs `:768-773` (`onMounted`)
**Issue:** The `watch(assembledSlideshow)` is registered in `setup()` and calls `postIndex(0)` through
`handle?.postState`, but `handle` is not assigned until `onMounted`. If the assembly ref transitioned
from empty to non-empty in the narrow window between `setup()` and `onMounted`, the watch would set
`index.value = 0` and advance `seq` while `handle` is still null (post silently dropped by the `?.`), and
`onMounted`'s go-live guard (`index.value == null`) would then be false — so slide 0 is set locally but
never broadcast until a navigation or an onHello resend. In practice `assembledSlideshow` only changes on
async Firestore data, which cannot land before the synchronous mount, so this is not reachable today and
self-heals on the first Go-live hello; noted only because the ordering is load-bearing.
**Fix:** Optional hardening — assign `handle` in `setup()` (or move the go-live post entirely into the
watch with `{ immediate: true }`) so the single-writer never depends on the setup→mount gap.

---

_Reviewed: 2026-08-29T00:25:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
