# Phase 94: Confidence Monitor Output Window - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` and the Phase 90/91/93 artifacts it consumes)

<domain>
## Phase Boundary

Build the **confidence monitor output window**: a standalone route/view the worship band/team sees,
showing the **current slide AND the next upcoming slide**, clearly distinguished, with **background
images always suppressed to a plain black background** (the actual background image is never shown)
and **no operator chrome**. Requirement: **R272**.

IN SCOPE:
- A new standalone route + view — `ConfidenceOutputView.vue` at `/present/confidence/:serviceId`
  (org via `?org=` query), `requiresAuth` only (R275 — any authenticated member; presentation-only).
  Mirror Phase 93's `AudienceOutputView` route exactly, differing only in name/path/component.
- Render the **current** slide and the **next upcoming** slide, both via
  `<SlideCanvas :suppressBackground="true" :interactive="false" />` (Phase 90's `suppressBackground`
  forces the resolved background to null and paints black regardless of what the slide carries — this
  is the prop's first real consumer). Layout must make "current" the dominant element and "next"
  clearly secondary/subordinate (e.g. large current + smaller next, each labeled) so the band can
  read what's live and glance at what's coming. The confidence output shows NO arrows, slide counts,
  or organizational labels — the only text chrome permitted is a minimal, unobtrusive
  current/next distinction (a small "Next" tag on the upcoming pane is acceptable; it serves the band,
  not the operator, and is explicitly part of the "clearly distinguished" requirement — decide the
  exact treatment in the UI-SPEC).
- **"Next" = the next flat assembled slide** (`assembledSlideshow[index + 1]`), i.e. what plays next in
  the linear flow — NOT a service-item lookup (that's the control screen's job in Phase 95). When the
  current slide is the last one, the next pane renders empty/black (never a crash or a wrap-around).
- Reuse Phase 93's output-window machinery: self-bootstrap service load (`serviceStore.subscribe` +
  `watch(services).find(id)` into a local `ref<Service|null>`, org from `?org=`, re-key on org change
  per Phase 93's WR-02 fix), `useSlideshowAssembly(...)` read-only (omit `canWrite`), receive-only
  `openRunChannel(serviceId)` → `onState` (set index) + `postHello` (mount) + `close` (unmount), NEVER
  `postState`; Screen Wake Lock (acquire on mount, re-acquire on `visibilitychange`→visible,
  feature-detected, released on unmount, try/caught); fullscreen-loss recovery that surfaces a single
  "Re-enter fullscreen" affordance and NEVER tears down the session or the other output (Pitfall 6);
  `cursor:none`-while-fullscreen/restored-when-windowed; pure-black loading/empty state.

### Reuse-not-fork decision (Claude's discretion, lean toward extraction)
Phase 93's `AudienceOutputView` and this confidence view share a large lifecycle core (service load +
assembly + channel + wake lock + fullscreen recovery + cursor). Per the milestone's "reuse, don't
fork" principle, **prefer extracting that shared core into a composable** (e.g.
`src/composables/useOutputWindow.ts`) consumed by BOTH views, with each view supplying only its own
render body (audience = one background-ON canvas; confidence = current+next background-suppressed
canvases). The pattern-mapper/planner should assess whether the extraction is clean and low-risk
against the already-verified `AudienceOutputView`; if extraction would meaningfully risk regressing
Phase 93, a carefully-shared-helper or minimal-duplication fallback is acceptable — but justify the
choice. Any refactor of `AudienceOutputView` MUST keep its 18 existing tests green.

OUT OF SCOPE (later phases / future):
- Opening/positioning this window on the assigned Confidence monitor + `requestFullscreen({ screen })`
  → Phase 95.
- The Run/control screen, order-of-service rail, keyboard nav → Phase 95.
- Closed-window / monitor-unplug recovery + sync hardening → Phase 96.
- Section label (e.g. "Verse 2") and countdown/elapsed timer on the confidence monitor → explicitly
  **R-future** (deferred in REQUIREMENTS.md); do NOT build them now.
- Any `blackout` UI driver → out of scope for v2.4.
</domain>

<decisions>
## Implementation Decisions (verify exact shapes during plan-phase / pattern-mapping)

### Rendering (consumes Phase 90 `SlideCanvas.vue`)
- `SlideCanvas` props `{ slide: AssembledSlide | null; suppressBackground?: boolean; interactive?: boolean }`.
  Confidence passes `:suppressBackground="true"` + `:interactive="false"` on BOTH the current and next
  canvases. `suppressBackground` is checked FIRST in `currentBackgroundUrl` and forces black — verified
  in `SlideCanvas.vue` (Phase 90). This is the prop's first exercised use (it was wired but dormant).
- Media on the confidence monitor: the band monitor is a glanceable reference; a background video's
  motion is suppressed with the background anyway. Follow the audience view's media handling for the
  CURRENT pane if `SlideCanvas` still plays a video slide's own source; the NEXT pane is a static
  preview (do not autoplay the upcoming slide's media). Confirm the desired behavior in the plan
  against `SlideCanvas`'s exposed `play()/pause()` and the video-vs-background distinction.

### Channel / index math (consumes Phase 91 `runChannel.ts`)
- `current = index == null ? null : (assembledSlideshow[index] ?? null)`;
  `next = index == null ? null : (assembledSlideshow[index + 1] ?? null)`. `onState`'s built-in
  stale-seq drop guards the reopen/reload race — rely on it.

### Routing / access
- `/present/confidence/:serviceId` (+ `?org`), `requiresAuth` only. No new RBAC tier (R275). Opened by
  Phase 95 and also directly loadable (self-bootstraps).

### UI
- Fullscreen black surface, `cursor:none` (while fullscreen). Current pane dominant, next pane clearly
  subordinate + labeled. No operator chrome. The only interactive chrome is the shared "Re-enter
  fullscreen" affordance (windowed-only). Match `SlideCanvas`/`AudienceOutputView` visual language.

### Claude's Discretion
Exact current/next layout + labeling, the extraction-vs-duplication structure, and copy are at Claude's
discretion — follow the UI-SPEC and existing conventions (`AudienceOutputView.vue`, `PresentationViewer.vue`).
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase / pattern-mapping)
- `src/views/AudienceOutputView.vue` (Phase 93) — the sibling output window to mirror/share from:
  self-bootstrap load, receive-only channel, wake lock, fullscreen-loss recovery, cursor toggle,
  pure-black gate. The confidence view differs ONLY in the render body (current+next, suppressed bg).
- `src/views/__tests__/AudienceOutputView.test.ts` (Phase 93) — the 18-test harness pattern to mirror
  (injectable `channelFactory`, fullscreen stub, wakeLock install/delete idiom, SlideCanvas stub spies).
- `src/components/slides/SlideCanvas.vue` (Phase 90) — `suppressBackground` forces black (first real use).
- `src/utils/runChannel.ts` (Phase 91) — receive-only `onState`/`postHello`/`close`.
- `src/composables/useSlideshowAssembly.ts` — the in-window slide source (read-only; omit `canWrite`).
- `src/router/index.ts` — the `/present/audience/:serviceId` entry (Phase 93) is the exact precedent.
- `.planning/research/PITFALLS.md` — Pitfall 5/6 + Wake Lock re-acquire note (same as Phase 93).
</code_context>

<specifics>
## Verification
- Unit tests (jsdom): assert BOTH current and next panes render for a mid-deck index, are visually
  distinguished, and that a last-slide index renders the next pane empty (no crash). Assert BOTH
  canvases receive `suppressBackground=true` (the actual background image is never shown — a
  `presentation-background` element must NOT render). Reuse Phase 93's assertions for: channel-driven
  index + higher-seq advance, `postHello` on mount / `postState` NEVER / `close` on unmount, chrome
  absence + cursor toggle, wake-lock present/re-acquire/absent, fullscreen-loss → affordance renders
  without teardown. If a shared `useOutputWindow` composable is extracted, unit-test it directly AND
  keep `AudienceOutputView`'s 18 tests green.
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build; `NODE_OPTIONS=--max-old-space-size=8192`
  if it OOM-crashes) and bare `npx vitest run` (baseline `src/storage.rules.test.ts` only — do not
  chase; no `--dir src`).
- **Human UAT (expected — deferred to milestone end):** real confidence monitor on a second physical
  screen, true black-background suppression as seen by the band, and glanceable current/next legibility
  cannot be proven by unit tests. The verifier marks these `human_needed`; the autonomous run defers.
</specifics>

<deferred>
## Deferred Ideas
- Section label ("Verse 2") + countdown/elapsed timer on the confidence monitor → R-future.
- Window open + on-assigned-monitor placement + `requestFullscreen({ screen })` → Phase 95.
- Closed-window / monitor-unplug recovery + sync robustness → Phase 96.
- Blackout affordance (protocol field only, no UI) → out of scope for v2.4.
</deferred>
