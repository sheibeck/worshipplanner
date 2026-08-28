# Phase 93: Audience Output Window - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` — ARCHITECTURE.md, PITFALLS.md, STACK.md, FEATURES.md — and the Phase 90/91/92 artifacts it consumes)

<domain>
## Phase Boundary

Build the **audience output window**: a standalone route/view that renders the live service's current
slide **fullscreen, with its background image, and zero operator chrome** (no arrows, slide counts,
organizational labels, or visible cursor), stays **awake** for the whole service (Screen Wake Lock),
and **recovers gracefully if it loses fullscreen** (offers a one-click re-enter; never tears down the
session or the other output). Requirements: **R270, R271**.

IN SCOPE:
- A new standalone route + view — `AudienceOutputView.vue` at `/present/audience/:serviceId` (org via
  `?org=` query, matching how the app already scopes org-bound routes). Guard `requiresAuth` only
  (per R275 — any authenticated org member; this is presentation-only, no editor tier).
- Compose `src/components/slides/SlideCanvas.vue` (Phase 90) as the single rendering source of truth:
  `<SlideCanvas :slide="currentSlide" :interactive="false" />` — background **ON** (do NOT pass
  `suppressBackground`; that is the Confidence monitor's job in Phase 94). No exit button, no nav bar,
  no progress pill, no auto-hiding chrome — the output is receive-only and chromeless by construction.
- **Assemble the service's slides in-window**: this is a standalone browsing context, so it must load
  the `Service` by `:serviceId`/`?org` and run `useSlideshowAssembly(service, orgId, ...)`
  (`src/composables/useSlideshowAssembly.ts`) itself to get `AssembledSlide[]` — it does NOT receive
  slides as a prop the way `PresentationViewer.vue` does from `SlidesTab.vue`.
- **Subscribe (receive-only) to the run channel** (Phase 91 `src/utils/runChannel.ts`):
  `openRunChannel(serviceId).onState(cb)` to track the live `index`; `postHello()` on mount so the
  control window re-sends current state to a freshly-opened/reloaded output (the hello handshake). The
  audience window NEVER posts `state` — control is the single writer. `currentSlide = slides[index]`.
  `onState`'s built-in stale-seq drop already guards the reopen/reload race — rely on it; do not
  reimplement sequencing here.
- **Screen Wake Lock** (R271): `navigator.wakeLock.request('screen')` acquired **in this window
  independently** on mount; **re-acquire on `visibilitychange` → visible** (the lock auto-releases when
  the tab is hidden — PITFALLS "Screen Wake Lock" / Pitfall notes); feature-detect `'wakeLock' in
  navigator`; release on unmount. A wake lock only keeps THIS document's screen awake.
- **Fullscreen-loss recovery** (R271, PITFALLS Pitfall 6): do **NOT** copy `PresentationViewer.vue`'s
  `handleFullscreenChange → exitPresentation()` auto-teardown. When `document.fullscreenElement`
  becomes null, show a single calm **"Re-enter fullscreen"** affordance that calls
  `requestFullscreen()` from that click gesture, in this window (PITFALLS Pitfall 5 — only a gesture
  *in this window* can re-enter). Losing fullscreen must never tear down the run session or touch the
  confidence output.
- Hide the cursor over the output (`cursor: none`), matching R270's "no visible cursor".

OUT OF SCOPE (later phases):
- **Opening/positioning** this window on the assigned monitor from the control screen
  (`window.open(...)` + `requestFullscreen({ screen })` placement via `monitorConfig.matchMapping`) →
  Phase 95 (Run/Control + Run entry). This phase builds the output window that Phase 95 opens; it does
  not itself launch or place windows.
- The Confidence output (current+next, black background) → Phase 94.
- Closed-window / monitor-unplug mid-service recovery and cross-window sync hardening → Phase 96.
- Any `blackout` UI driver — the field rides in `RunState` but has no button this milestone.
</domain>

<decisions>
## Implementation Decisions (from research + Phase 90/91/92 artifacts — verify exact shapes during plan-phase)

### Rendering (consumes Phase 90 `SlideCanvas.vue`)
- `SlideCanvas` props are `{ slide: AssembledSlide | null; suppressBackground?: boolean; interactive?: boolean }`
  and it `defineExpose({ play, pause })` for media. The audience window passes `:interactive="false"`
  and omits `suppressBackground` (background shown). Media playback: if a straight
  `<SlideCanvas :slide="currentSlide" />` swap needs the T-23-08 pause→reset→play invariant on index
  change, drive it through the exposed `play()`/`pause()` exactly as `PresentationViewer.vue` does —
  do not restructure that invariant.

### Channel (consumes Phase 91 `runChannel.ts`)
- `openRunChannel(serviceId)` → `{ postState, onState, postHello, onHello, close }`. Audience uses
  `onState` (set index) + `postHello` (on mount) + `close` (on unmount) only. `RunState` is
  `{ index, blackout, seq }`. Ignore/hold `blackout` (no UI this milestone) but keep reading it so the
  protocol stays forward-compatible.

### Service load + assembly
- `useSlideshowAssembly(service, orgId, options)` returns the assembled slideshow + loading state
  (`UseSlideshowAssemblyReturn`). Provide it a `Ref<Service | null>` loaded by `:serviceId`/`?org`
  from the services store (mirror how an existing standalone/service-scoped route loads a single
  service — the pattern-mapper should surface the exact loader). Render an "empty/loading" state that
  is itself congregation-safe (plain black, no chrome) until slides + the first `state` arrive.

### Routing / access
- `/present/audience/:serviceId` (+ `?org`), `requiresAuth` only. No new RBAC tier (R275). It is opened
  programmatically by Phase 95 and is also directly loadable (e.g. after a reload) — so it must
  self-bootstrap (load service, assemble, `postHello`) without depending on the opener being alive.

### UI
- Fullscreen, edge-to-edge, pure black underlay, `cursor: none`. The ONLY chrome ever shown is the
  fullscreen-recovery affordance, and only while not in fullscreen. Dark-mode canonical theme is moot
  here (it's a black projection surface) — match `SlideCanvas`/`PresentationViewer` visual language.

### Claude's Discretion
Exact route/query shape, the service loader, component decomposition, and the recovery-affordance copy
are at Claude's discretion — follow the UI-SPEC produced for this phase and existing conventions
(`PresentationViewer.vue`, `SlidesTab.vue`, the router's `requiresAuth` pattern).
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase / pattern-mapping)
- `src/components/slides/SlideCanvas.vue` (Phase 90) — the reusable per-slide renderer; props/expose above.
- `src/components/PresentationViewer.vue` — the existing single-window presenter: `slides: AssembledSlide[]`
  prop, `initialIndex`, `currentSlide = slides[currentIndex]`, media `play()/pause()` routing, the
  `handleFullscreenChange`/`requestFullscreen` pattern to **learn from but deliberately diverge from**
  (do not auto-teardown on fullscreen loss).
- `src/composables/useSlideshowAssembly.ts` — `useSlideshowAssembly(service, orgId, options)`; the
  in-window slide source.
- `src/components/slides/SlidesTab.vue` — shows how `assembledSlideshow` + `presentStartIndex` feed the
  viewer today (the audience window replaces the prop-drilling with its own assembly + channel index).
- `src/utils/runChannel.ts` (Phase 91) — the receive-only control→output protocol.
- `src/router/index.ts` — route table + `requiresAuth` guard; add the new route here.
- `.planning/research/PITFALLS.md` — Pitfall 5 (same-window-gesture fullscreen), Pitfall 6 (fullscreen-loss
  auto-teardown is catastrophic per-window), and the Screen Wake Lock re-acquire-on-visibilitychange note.
</code_context>

<specifics>
## Verification
- Unit tests (jsdom): mock `runChannel` (inject a fake `BroadcastChannelFactory` or spy `openRunChannel`)
  and assert `currentSlide` follows `onState`'s `index`; assert `postHello` fires on mount; assert NO
  operator chrome / exit button / nav renders and `cursor: none` is applied. Mock `navigator.wakeLock`
  (present → request called on mount and re-called on a simulated `visibilitychange` to visible; absent →
  no throw). Mock `document.fullscreenElement`/`fullscreenchange`: assert that losing fullscreen renders
  the "Re-enter fullscreen" affordance and does NOT tear down / close the channel, and that clicking it
  calls `requestFullscreen`. Assert the audience view NEVER calls `postState`.
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build; use `NODE_OPTIONS=--max-old-space-size=8192`
  if it OOM-crashes under memory pressure) and bare `npx vitest run` (baseline: `src/storage.rules.test.ts`
  only — do not chase; do not use `--dir src`).
- **Human UAT (expected — deferred to milestone end):** real fullscreen on a second physical monitor,
  actual wake-lock behavior over a realistic service length, and true chrome-free/cursor-free projection
  cannot be proven by unit tests. The verifier should mark these `human_needed`; the autonomous run defers.
</specifics>

<deferred>
## Deferred Ideas
- Programmatic window open + on-assigned-monitor placement + `requestFullscreen({ screen })` → Phase 95.
- Closed-window / monitor-unplug detection + one-click recovery, cross-window sync robustness → Phase 96.
- Blackout affordance (protocol field only, no UI) → out of scope for v2.4.
</deferred>
