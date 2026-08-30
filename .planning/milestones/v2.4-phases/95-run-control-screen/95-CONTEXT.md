# Phase 95: Run/Control Screen + Run Entry Point - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` and the Phase 90–94 artifacts it composes)

<domain>
## Phase Boundary

Build the **Run/control screen** and its **Run entry point** — the milestone's centerpiece where the
monitor config (Phase 92), audience output (Phase 93), and confidence output (Phase 94) finally come
together under one operator surface. A projectionist starts running a **locked** service from a Run
button, lands on a calm standalone control screen, and drives BOTH output windows from it with the
current/selected slide always being what's live. Requirements: **R261, R262, R263, R264, R265, R266,
R275**.

IN SCOPE:
- **Run entry (R261, R275):** a **Run** button that appears on a **locked** service
  (`status !== 'draft'`, i.e. `isLocked`) and opens the standalone Run/control screen via ordinary SPA
  navigation (`router.push('/run/' + serviceId)`); it is **absent/disabled on a draft** service. It is
  available to **any authenticated org member — editor OR viewer** (gate on membership/`orgId`, NOT
  `isEditor`; running is presentation-only and grants no edit ability — R275). Place it where a locked
  service is viewed (the `ServiceEditorView` locked/read-only view is the primary home; the services
  list is an acceptable secondary — Claude's discretion + pattern-mapper).
- **New route + view:** `RunControlView.vue` at `/run/:serviceId` (org via `?org=` to match the output
  routes), `requiresAuth` only (no new RBAC tier — R275). Self-bootstraps the service load + slide
  assembly the same way the output windows do (`serviceStore.subscribe` + `watch(services).find(id)` →
  `ref<Service|null>`, `useSlideshowAssembly` read-only), so a reload of the control screen re-derives
  state.
- **Order-of-service rail (R262, R263):** render the service order as a list using
  `sortedSlotsWithIndex(service)` (Phase 91) — the SAME ordering the assembler uses. The item
  **containing the current slide is clearly highlighted** ("you are here"): the active item is the one
  whose `slot` array-index equals `currentSlide.slotIndex`. **Clicking an item jumps** the live output
  to that item's **first** assembled slide via `firstAssembledIndexBySlot(slides).get(slotIndex)`
  (Phase 91); an item with no assembled slide (absent from the map) is not clickable / no-ops.
- **Previews (R264):** a **large current-slide preview** (what the audience sees) + a smaller
  **next-slide preview**, both via `<SlideCanvas :interactive="false" />` rendered windowed/small (NOT
  fullscreen) — reuse the same renderer, backgrounds shown (this is the operator's fidelity view of the
  audience output). `current = slides[index]`, `next = slides[index+1] ?? null`.
- **Keyboard navigation (R265):** Right Arrow / Space = next slide; Left Arrow = previous slide;
  Down Arrow = next order-of-service item; Up Arrow = previous item; **Escape = exit run mode WITH a
  confirmation** (a stray Escape must NOT tear down a live service — gate the teardown behind a confirm
  dialog). Use the app's existing keyboard-handling idiom (`PresentationViewer.vue`'s `handleKeydown`
  is the closest analog; do not fight it). Item-level Up/Down move to the prev/next item's first slide.
- **Single-selection live model (R266):** the current/selected slide **is** what is live — there is NO
  separate "push to live" step. Every navigation immediately updates the live outputs.
- **Output-window orchestration (the integration seam):** the control window is the **single writer**
  of the run channel — `openRunChannel(serviceId)` and `postState({ index, blackout:false, seq })` on
  every navigation, with a **monotonically increasing `seq`** the control owns (Phase 91's `onState`
  stale-drop depends on it). On the output side's `hello` (an output window (re)mounting), the control
  **re-sends current state** so a freshly-opened/reloaded output syncs (`onHello` → `postState`).
  - **Opening the outputs:** `window.open('/present/audience/' + serviceId + '?org=' + orgId,
    'wp-audience', features)` and the confidence equivalent — **plain `window.open`, never
    `noopener`** (the HTML spec copies the opener's `sessionStorage` to the child ONLY without
    noopener, carrying the picked org — ARCHITECTURE.md). Stable window names so re-open reuses the slot.
  - **Placing them on the assigned monitors:** on Run, call `getScreenDetails()` (permission already
    obtained in Phase 92, so no fresh prompt) and `matchMapping(loadMapping(), liveScreens)`
    (Phase 91/92). If `matched`, resolve each role→fingerprint to the live `ScreenDetailed` (recompute
    `computeFingerprint` per live screen), `window.open` then `moveTo(screen.left, screen.top)` +
    `requestFullscreen({ screen })` per window — the sanctioned "essentially one click" path
    (Chrome/Edge, PITFALLS Pitfall 5). This MUST originate from the operator's Run click gesture.
  - **Fallback (first-class, not an error):** if `matchMapping` is `needs-reprompt`, or the permission
    is denied/unavailable, open the outputs **un-positioned** (plain pop-outs) and rely on each output
    window's OWN "Enter/Re-enter fullscreen" affordance (already built in Phases 93/94) — the operator
    drags each to its monitor and clicks fullscreen. Link to `/monitor-setup` (Phase 92) to (re)assign.

OUT OF SCOPE (Phase 96 / future):
- Robust **closed-window / monitor-unplug mid-service recovery** and one-click reopen/reassign
  WITHOUT losing slide position (R274), and **sync-lag robustness over a realistic service** (R273) →
  Phase 96 (this phase establishes the single-writer channel + handshake + open/place; Phase 96 hardens
  the failure/endurance behavior).
- Any **blackout** affordance (protocol field only, no UI) → out of scope for v2.4.
- Slide transitions/fades, preview/live two-pane staged model, remote companion control → out of scope
  (REQUIREMENTS.md § Out of Scope).
</domain>

<decisions>
## Implementation Decisions (verify exact shapes during plan-phase / pattern-mapping)

### Composition (reuse, don't fork)
- Previews reuse `src/components/slides/SlideCanvas.vue` (Phase 90) at `:interactive="false"`, windowed.
- The control screen loads/assembles the service exactly like the output windows — strongly consider
  reusing the **service-load helper** the pattern-mapper identifies (the `serviceStore.subscribe` +
  `watch(services).find(id)` idiom; possibly the same shape `useOutputWindow` uses, though the control
  screen does NOT need wake-lock/fullscreen/cursor — it is a normal in-app screen, so a full
  `useOutputWindow` reuse is likely wrong here; extract or share only the service-load+assembly part if
  it's clean).
- Channel: `src/utils/runChannel.ts` (Phase 91). Control = single writer (`postState`), plus `onHello`
  → resend. Own the `seq` counter in the control view (increment per navigation).

### Run entry & authorization
- `isLocked = localService.status !== 'draft'`. Run button shown when `isLocked` AND the user is an
  authenticated member (editor OR viewer). NOT gated on `isEditor` (diverges from `canEditService` on
  purpose — R275). Disabled/absent on draft. Mirror the existing button/nav conventions.

### Monitor placement
- Reuse Phase 91/92 `monitorConfig`: `loadMapping()`, `matchMapping(saved, liveScreens)`,
  `computeFingerprint(screen)`. `getScreenDetails()` MUST be called synchronously in the Run-click
  gesture chain (no awaited call before it) so the (already-granted) permission + `requestFullscreen({
  screen })` keep user activation (PITFALLS Pitfall 1/5). Guard all three states (matched / reprompt /
  unavailable) as first-class, mirroring Phase 92.

### Keyboard & exit
- Escape → a confirmation dialog before exiting/closing outputs (R265). Right/Space/Left = slide;
  Up/Down = item. Match `PresentationViewer.vue`'s `handleKeydown` structure and cleanup (add/remove on
  mount/unmount). Ensure keys don't fire while a confirm dialog / input is focused.

### Claude's Discretion
Exact Run-button placement, the control-screen layout (rail + dual preview), the confirm-dialog
component, window `features` strings, and copy are at Claude's discretion — follow the UI-SPEC produced
for this phase and existing conventions (`ServiceEditorView.vue`, `SlidesTab.vue`, `PresentationViewer.vue`,
`MonitorSetupView.vue`, the shared dialog/button components).
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase / pattern-mapping)
- `src/utils/serviceSlots.ts` (Phase 91) — `sortedSlotsWithIndex(service)` + `firstAssembledIndexBySlot(slides)`:
  the rail ordering + item↔first-slide join for R262/R263. Agrees byte-for-byte with the assembler.
- `src/utils/runChannel.ts` (Phase 91) — `openRunChannel(serviceId)` → `postState`/`onState`/`postHello`/
  `onHello`/`close`; control is the single `state` writer; `seq` owned by the caller.
- `src/utils/monitorConfig.ts` (Phase 91/92) — `loadMapping`, `matchMapping` (`{status:'matched'|'needs-reprompt'}`),
  `computeFingerprint`; `MonitorAssignment { fingerprint, role }`.
- `src/views/AudienceOutputView.vue` / `ConfidenceOutputView.vue` (Phase 93/94) — the output windows this
  screen opens/places; their routes are `/present/audience/:serviceId?org=` and `/present/confidence/:serviceId?org=`.
  They already own their own wake-lock + fullscreen-recovery + `postHello` handshake.
- `src/composables/useOutputWindow.ts` (Phase 94) — the shared output lifecycle; note the service-load +
  assembly portion is the reusable bit for the control screen (NOT the wake-lock/fullscreen parts).
- `src/views/ServiceEditorView.vue` — `isLocked` (`:2092`) / `canEditService` (`:2094`); the locked
  read-only view is the primary Run-button home; also the service-load pattern (`serviceStore.subscribe`
  + `watch(services).find(id)`) and status labels.
- `src/components/PresentationViewer.vue` — `handleKeydown` keyboard idiom + `initialIndex`/R061 jump.
- `src/views/MonitorSetupView.vue` (Phase 92) — the synchronous-`getScreenDetails()`-in-a-gesture idiom
  and the matched/reprompt/unavailable state handling to mirror for placement.
- `src/router/index.ts` — `/present/audience` + `/present/confidence` (Phase 93/94) are the exact
  `requiresAuth`-only precedents for `/run/:serviceId`.
- `.planning/research/ARCHITECTURE.md` — the control→output single-writer model, `window.open` (no
  noopener) sessionStorage-carry, and placement flow. `.planning/research/PITFALLS.md` — Pitfall 1/5/6.
</code_context>

<specifics>
## Verification
- Unit tests (jsdom): the rail highlights the item matching `currentSlide.slotIndex`; clicking an item
  posts a `state` with the index from `firstAssembledIndexBySlot`; an empty slot is not clickable.
  Keyboard: Right/Space→+1, Left→−1, Down/Up→next/prev item's first slide, Escape→confirm (NOT immediate
  teardown). Single-selection: every navigation calls `postState` with a strictly increasing `seq` (mock
  `openRunChannel`/inject a fake channel). `onHello` → control re-`postState`s current state. Run button:
  present+enabled on a locked service, absent/disabled on draft, present for a viewer (not just editor).
  Placement: mock `getScreenDetails` + `matchMapping` — matched → `window.open` + `requestFullscreen({screen})`
  per role; needs-reprompt/unavailable → un-positioned pop-outs + the monitor-setup link, no throw. Mock
  `window.open` (jsdom returns null) and assert the calls/features, never actually open a window.
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build; `NODE_OPTIONS=--max-old-space-size=8192` if
  it OOM-crashes; NO `Array.prototype.at`) and bare `npx vitest run` (baseline `src/storage.rules.test.ts`
  only — do not chase; no `--dir src`).
- **Human UAT (expected — deferred to milestone end):** real two-monitor open+place+fullscreen from one
  Run click on Chrome/Edge; the audience/confidence windows actually landing on their assigned monitors;
  end-to-end keyboard driving of a live service; the Escape-confirm feel; and the pop-out fallback drag+
  fullscreen. The verifier marks these `human_needed`; the autonomous run defers.
</specifics>

<deferred>
## Deferred Ideas
- Closed-window / monitor-unplug mid-service recovery + one-click reopen/reassign without losing
  position (R274); sync-lag robustness over a realistic service (R273) → Phase 96.
- Blackout affordance (protocol field only) → out of scope for v2.4.
</deferred>
