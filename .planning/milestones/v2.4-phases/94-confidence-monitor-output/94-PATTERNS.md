# Phase 94: Confidence Monitor Output Window - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 4 (1 new view, 1 route edit, 1+ new test, optional composable+refactor)
**Analogs found:** 4 / 4 (all near-exact siblings from Phase 93)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/ConfidenceOutputView.vue` | view (presentation output) | event-driven (receive-only channel) | `src/views/AudienceOutputView.vue` | exact sibling |
| `src/router/index.ts` (route entry) | route/config | request-response | `/present/audience/:serviceId` entry (same file, lines 88-99) | exact |
| `src/views/__tests__/ConfidenceOutputView.test.ts` | test | event-driven | `src/views/__tests__/AudienceOutputView.test.ts` | exact sibling |
| `src/composables/useOutputWindow.ts` (OPTIONAL, extracted) | composable | event-driven | none — new extraction from `AudienceOutputView.vue` script | no analog (novel) |

## Reuse-vs-Fork Analysis (the key deliverable)

### AudienceOutputView.vue block map — lifecycle-core vs render-body

Read end-to-end. Concrete line ranges (`src/views/AudienceOutputView.vue`):

**RENDER-BODY (per-view; confidence supplies its own):**
- `<template>` lines 1-62 — the entire template is render-body. Two logical parts:
  - Root shell lines 7-12 (`ref="rootRef"`, `data-testid`, `class="fixed inset-0 bg-black..."`, `:style="rootStyle"`) — SHARED shape but each view owns its `data-testid` and slot content.
  - Live-slide markup lines 19-24 (`<SlideCanvas v-if="currentSlide && fontReady" :interactive="false">`) — DIVERGES: confidence renders TWO `<SlideCanvas :suppressBackground="true" :interactive="false">` panes (dominant current + subordinate labeled next).
  - Re-enter affordance lines 32-60 — SHARED verbatim (only `data-testid` differs).

**LIFECYCLE-CORE (candidate for `useOutputWindow` extraction):**
- Imports lines 64-75 — shared (confidence adds nothing new).
- `channelFactory` prop seam lines 82-84 — SHARED (the test seam; MUST survive extraction).
- Org + service scoping lines 86-113: `serviceId`/`orgIdRef` computed (93-96), initial-load `watch(serviceStore.services)` into `localService` (98-109), `useSlideshowAssembly(localService, orgIdRef)` read-only (113) — SHARED.
- Run channel state lines 115-118 (`index`, `blackout`, `handle`) — SHARED.
- Media/play-pause watcher lines 120-137: `slideCanvasRef` + the `watch(index)` pause→nextTick→play (T-23-08) — **PARTIALLY entangled**: it drives a single `slideCanvasRef`. Confidence has TWO canvases (current + a static next that must NOT autoplay). This is the one block that does not lift cleanly (see risk below).
- Font gate lines 139-159 (`fontReady`, `rootStyle` computed, `resolvedFontChoice`) — SHARED. Note `rootStyle` (145-149) couples cursor to `isFullscreen` — belongs in the composable's returned surface.
- Fullscreen-loss recovery lines 161-181 (`rootRef`, `isFullscreen`, `handleFullscreenChange`, `handleReenterFullscreen`) — SHARED verbatim.
- Screen Wake Lock lines 183-200 (`wakeLock`, `acquireWakeLock`, `handleVisibilityChange`) — SHARED verbatim.
- Lifecycle hooks lines 202-280: `onMounted` (subscribe/WR-02 gate 218-221, channel open+onState+postHello 225-230, listeners+wakeLock 232-234, font gate 239-254, deferred first play 258-259), `onBeforeUnmount` pause (263-265), `onUnmounted` close+listeners+wakeLock release+unsubscribeAll (267-280) — SHARED, except the two `slideCanvasRef.value?.play()/pause()` touch-points (259, 264) which are canvas-specific.

**Summary:** ~90% of the `<script setup>` (lines 86-280 minus the ~6 `slideCanvasRef` lines) is verbatim-shared lifecycle-core. The ONLY entanglement is the media play/pause plumbing tied to a single canvas ref.

### Extracted `useOutputWindow` return surface (what BOTH bodies need)

For each view to render its own template, the composable must expose:

```
{
  // service/index source
  assembledSlideshow,        // Ref<AssembledSlide[]>  (both derive current/next from it)
  index,                     // Ref<number | null>     (both compute current/next)
  // render gate + root
  fontReady,                 // Ref<boolean>           (v-if gate on canvas)
  rootRef,                   // template ref for requestFullscreen
  rootStyle,                 // computed CSS-var + cursor:none-while-fullscreen wrapper
  isFullscreen,              // Ref<boolean>           (drives re-enter affordance v-if)
  handleReenterFullscreen,   // click handler
  // media hook — see risk: pass canvas ref(s) IN, or expose a registration API
}
```

`currentSlide`/`nextSlide` themselves are cheap `computed` the view can build locally from `index` + `assembledSlideshow` — keep them in the view so confidence can add `next = assembledSlideshow[index+1] ?? null` without touching the composable.

### Media plumbing — the one non-clean seam

`AudienceOutputView` owns `slideCanvasRef` and the `watch(index)` pause→nextTick→play (lines 127-137) plus the deferred first-play (258-259) and pre-unmount pause (263-265). Confidence has TWO canvases: a CURRENT pane that should follow the same pause→play media invariant, and a NEXT pane that is a static preview (must NOT autoplay — per CONTEXT §Rendering). Options for the planner:

- **Cleanest:** composable exposes `index`/`fontReady` etc. but the **view keeps its own canvas ref(s) + media watcher**. The media watcher is ~10 lines and genuinely per-view (audience=1 ref, confidence=1 live ref + 1 inert preview). Lifting it forces an awkward "register your canvas ref" callback. Leaving it in each view is lower-risk and the duplication is small and well-understood.
- Composable could optionally accept a `getCanvasRef: () => { play; pause } | null` param so the shared play/pause timing lives in one place. Justify in the plan; the simple option above is preferred.

### Risk to AudienceOutputView's existing tests

The Phase 93 suite (`AudienceOutputView.test.ts`, 13 tests in-file — CONTEXT says "18", treat the file as source of truth) reaches internals through TWO seams, both of which extraction MUST preserve:

1. **`channelFactory` prop** (view lines 82-84; test lines 40-44, 138-160, 170-172). The test injects an in-memory `BroadcastChannelLike` and drives `onState`. If `openRunChannel(serviceId, props.channelFactory)` moves into `useOutputWindow`, the composable MUST accept `channelFactory` as an argument and the view MUST keep forwarding its prop into it, or all channel-driven/handshake tests break.
2. **SlideCanvas stub + `slideCanvasSpies.play/pause`** (test lines 77, 108-130, 264-273). The T-23-08 pause→play ordering test asserts on the stub's exposed spies. If the media watcher stays in the view (recommended), these tests are untouched. If the watcher is lifted, the composable unit test must re-home the ordering assertion and the view test must still see pause/play fire.

Other test couplings that constrain extraction: `serviceStoreMock.subscribe` WR-02 gate (test 472-509 ↔ view 218-221), wake-lock install/delete idiom (test 362-418 ↔ view 183-200), `fullscreenchange` dispatch (test 420-470 ↔ view 170-181). All are verbatim-shared logic — safe to lift as long as the composable is instantiated inside the same `setup()` (hooks must register on the component instance).

**Verdict: extraction is CLEAN for ~90% of the lifecycle (channel, service-load/WR-02, wake lock, fullscreen recovery, font gate, cursor) and low-risk PROVIDED (a) `channelFactory` is threaded through as a composable argument, and (b) the per-canvas media play/pause watcher stays in each view rather than being forced into the composable.** The Phase 93 tests remain green because they exercise the view's public seams (prop + stubbed SlideCanvas), not the script's internal structure. A parallel `useOutputWindow` unit test can drive it directly with a fake `channelFactory` and assert index/isFullscreen/wake-lock transitions.

## Pattern Assignments

### `src/views/ConfidenceOutputView.vue` (view, event-driven)

**Analog:** `src/views/AudienceOutputView.vue` (share via `useOutputWindow` or copy the script core).

**Render-body divergence** — replace audience lines 19-24 with a current+next layout, both suppressed:
```vue
<!-- current = dominant; next = subordinate + small "Next" tag -->
<SlideCanvas v-if="currentSlide && fontReady" ref="currentCanvasRef"
  :slide="currentSlide" :suppressBackground="true" :interactive="false" />
<SlideCanvas v-if="nextSlide && fontReady"
  :slide="nextSlide" :suppressBackground="true" :interactive="false" />
```
`nextSlide` computed (mirror `currentSlide` at analog lines 124-126):
```ts
const nextSlide = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value + 1] ?? null))
```
Last-slide index → `assembledSlideshow[index+1]` is `undefined` → `?? null` → next pane black, no crash (verify in test).

**Re-enter affordance:** copy analog lines 32-60 verbatim, changing only the `data-testid` (e.g. `confidence-reenter-fullscreen`) and root `data-testid` (e.g. `confidence-output`).

**Media invariant:** apply the analog's `watch(index)` pause→nextTick→play (lines 133-137) to the CURRENT canvas ref ONLY. Do NOT drive play() on the next-pane canvas (static preview per CONTExT §Rendering). `SlideCanvas` exposes `play`/`pause` via `defineExpose` at `src/components/slides/SlideCanvas.vue:485-488`.

### `src/router/index.ts` (route entry)

**Analog:** the audience entry at `src/router/index.ts:88-99`. Copy verbatim, changing path/name/component:
```ts
{
  path: '/present/confidence/:serviceId',
  name: 'confidence-output',
  component: () => import('../views/ConfidenceOutputView.vue'),
  meta: { requiresAuth: true },
},
```
Placement rule (analog comment lines 89-94): among the static authed routes, BEFORE the trailing public dynamic slug routes, so it is never shadowed. `router.beforeEach` untouched.

### `src/views/__tests__/ConfidenceOutputView.test.ts` (test)

**Analog:** `src/views/__tests__/AudienceOutputView.test.ts` — mirror the whole harness:
- Mocks: `vue-router` reactive `mockRoute` (lines 40-44), `@/firebase` inert (81), `@/stores/auth` (83-90), `@/stores/services` `serviceStoreMock` (49-79, 92-94), `useSlideshowAssembly` returning fixed `fakeSlides` (98-103), **SlideCanvas stub** (108-130) — extend the stub to also surface the `suppressBackground` prop so a test can assert both panes receive `suppressBackground=true` and that NO `presentation-background` element renders.
- `createFakeChannel()` (138-160) + `setFullscreenElement` (162-168) + `mountView` (170-172) verbatim.
- `beforeEach`/`afterEach` (176-209) verbatim (Fullscreen stub, `document.fonts` stub, wakeLock delete).

**Confidence-specific assertions to add on top of the mirrored suite:**
- Mid-deck index (e.g. `emitState(1, seq)`): BOTH a current pane (`b`) and a next pane (`c`) render and are distinguishable.
- Last-slide index (`emitState(2, seq)`): current pane `c` renders, next pane is empty/absent — no crash, no wrap to `a`.
- Both canvases receive `suppressBackground=true`; assert no `presentation-background` element.
- Reuse Phase 93 assertions: channel-driven index + higher-seq advance, `postHello` on mount / never `postState` / `close` on unmount, chrome absence + `cursor:none`, wake-lock present/re-acquire/absent, fullscreen-loss → affordance without teardown.

### `src/composables/useOutputWindow.ts` (OPTIONAL — no analog)

If extracted: a `setup`-time composable `useOutputWindow({ channelFactory })` that owns lines 86-280 of the analog MINUS the per-canvas media watcher, returning the surface listed above. Its own unit test constructs a fake `channelFactory`, mounts a trivial host component, and asserts: index set from `onState`, `postHello` on mount / never `postState`, WR-02 subscribe gate, wake-lock acquire/re-acquire/release, `isFullscreen` toggling on dispatched `fullscreenchange`, `unsubscribeAll` on unmount. This is the same behavior the Phase 93 view test asserts — extraction lets it be tested once, centrally.

## Shared Patterns

### Receive-only run channel
**Source:** `src/views/AudienceOutputView.vue:225-230` (open+onState+postHello), `:268` (close); `src/utils/runChannel.ts` `openRunChannel`.
**Apply to:** confidence view / composable. NEVER `postState`.

### Screen Wake Lock
**Source:** `src/views/AudienceOutputView.vue:183-200` + release `:271-276`.
**Apply to:** confidence view / composable, verbatim.

### Non-teardown fullscreen-loss recovery
**Source:** `src/views/AudienceOutputView.vue:161-181` + affordance template `:32-60`.
**Apply to:** confidence view. The `handleFullscreenChange` MUST only update `isFullscreen` — never exit/teardown (Pitfall 6).

### WR-02 org-scoped subscribe gate
**Source:** `src/views/AudienceOutputView.vue:218-221` (`if (orgId && serviceStore.orgId !== orgId) subscribe`).
**Apply to:** confidence view / composable — prevents cross-org bleed on same-tab SPA nav.

### suppressBackground → black (Phase 90, first real consumer)
**Source:** `src/components/slides/SlideCanvas.vue:359-363` — `currentBackgroundUrl` checks `if (props.suppressBackground) return null` FIRST (ahead of the R070 video-suppresses-background rule). Prop declared `SlideCanvas.vue:298-300`. Autoplay affordances additionally gated on `interactive` at `:241, :251, :261` so a non-interactive preview shows none.
**Apply to:** BOTH confidence canvases (`:suppressBackground="true" :interactive="false"`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/composables/useOutputWindow.ts` | composable | event-driven | Novel extraction; no existing output-window composable. Source material is `AudienceOutputView.vue` lines 86-280. |

## Metadata

**Analog search scope:** `src/views/`, `src/views/__tests__/`, `src/router/`, `src/components/slides/`, `src/composables/`, `src/utils/`
**Files scanned:** AudienceOutputView.vue, AudienceOutputView.test.ts, SlideCanvas.vue, router/index.ts, 93-01/93-02 summaries
**Pattern extraction date:** 2026-08-28
