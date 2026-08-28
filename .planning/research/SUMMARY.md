# Project Research Summary

**Project:** WorshipPlanner — v2.4 "Run the Service (Live Presentation)"
**Domain:** Browser-based live worship-service presentation/projection — multi-monitor delivery from a single Chrome/Edge tab, integrated into an existing Vue 3 + Firebase app
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is pure integration work on top of an already-correct slide engine, not a new product. `slideshowAssembler.ts` (the pure `service → AssembledSlide[]` builder) is untouched, and `PresentationViewer.vue` already contains every piece of rendering logic the new run/control, audience, and confidence-monitor windows need — it just needs its slide-canvas guts extracted into a reusable `SlideCanvas.vue` so three thin per-role windows can compose it instead of forking it. The recommended stack is zero new npm dependencies: the Window Management API + `requestFullscreen({screen})` for multi-monitor placement (Chromium 100+, matching the project's confirmed Chrome/Edge-only target), `BroadcastChannel` for low-latency same-machine control→output sync (not Firestore — a server round-trip is the wrong tool for sub-100ms slide-advance), `localStorage` for the per-device monitor→role mapping (never Firestore — this describes a physical cable, not an org/user preference), and the Screen Wake Lock API to keep the projector and confidence monitor from sleeping during a 60-90 minute service.

The feature shape converges strongly across every reference tool researched (ProPresenter, EasyWorship, Proclaim, OpenLP, FreeShow): an order-of-service list with a current-item highlight, a large current-slide preview, click-to-jump, standard keyboard nav (Right/Space=next, Left=prev, Up/Down=next/prev item, Escape=exit — carefully re-scoped for a multi-window world), a chrome-free fullscreen audience output, and a black-background current+next confidence monitor. WorshipPlanner should deliberately follow Proclaim's simpler single-selection model (no Preview/Live pane split) rather than ProPresenter's more powerful-but-heavier pattern, matching the explicit "non-technical projectionist" target user. All of this is a client-side derivation over data the app already has — `AssembledSlide.slotIndex` is the pre-existing service-item↔slide join, so no new Firestore schema is needed for the core Run experience.

The two biggest risks are both about the permission/gesture model, not the UI: (1) the `window-management` permission grant AND denial are both primary, must-be-built paths — a volunteer clicking "block" by reflex must land on a fully-supported pop-out+drag+F11 fallback, not a dead end — and (2) every `window.open()`/`getScreenDetails()`/`requestFullscreen()` call must fire synchronously inside the original click handler with zero `await` in between, or the popup blocker silently kills the flow. Beyond that, live-operation robustness (monitor replug, output-window crash/close recovery, fullscreen-loss not cascading into a full session teardown, wake-lock re-acquisition, preloading images to avoid flash) needs a dedicated hardening pass, and requirements must resolve one open design question the architecture researcher flagged: who is authorized to Run a service (existing editor role, vs. a new "projectionist" role tier hinted at in PROJECT.md).

## Key Findings

### Recommended Stack

Every recommended technology is a native browser API already available in Chrome/Edge 100+; the project's explicit Chrome/Edge-only constraint removes the usual "not Baseline" objection to the Window Management API, since there is no cross-browser fallback to build beyond the pop-out/manual path that's needed anyway. No fullscreen-shim, no BroadcastChannel wrapper package, no Presentation API (that's wireless casting, a different problem).

**Core technologies:**
- **Window Management API** (`window.getScreenDetails()`, `ScreenDetailed`) — enumerate connected monitors for the monitor-config screen — the only web API that exposes multi-screen topology at all
- **Fullscreen API with `{screen}` option** (`element.requestFullscreen({screen})`) — places a window fullscreen on a specific monitor in one call, avoiding the flicker of moveTo-then-fullscreen
- **`window.open()`** — bootstraps the two output windows (both the primary placement path and the universal fallback)
- **BroadcastChannel** — control→output state sync (`{type:'state', index, blackout, seq}`); in-process, same-tick, zero network cost, zero Firestore write volume per keypress
- **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`) — keeps audience/confidence displays awake through a 60-90 min service; must be requested independently per output window and re-acquired on `visibilitychange`
- **`localStorage`** — per-device monitor→role mapping, keyed by a synthesized screen fingerprint, not Firestore

### Expected Features

**Must have (table stakes) — v2.4 launch:**
- Order-of-service list (grouped by `slotIndex`) with current-item highlight
- Large current-slide preview on the run/control screen (reuses `PresentationViewer.vue`'s rendering)
- Click an order-of-service item to jump to its first slide (reuses the existing `initialIndex`/R061 mechanic)
- Standard keyboard nav: Right/Space=next, Left=prev, Escape=exit (already implemented, extend don't replace), NEW Down/Up=next/prev order-of-service item
- Audience output: fullscreen slide + background, zero operator chrome, routed to a real second display
- Confidence monitor: current + next slide, background suppressed to black, no chrome
- Locked-service gate on the Run entry point (existing app invariant, just wire behind it)
- Standalone, persistent per-device monitor-role assignment (Audience vs Confidence) — the concrete translation of the "one-click start" usability finding

**Should have (differentiators):**
- Single-selection model (no Preview/Live split) — a deliberate simplicity choice, not a feature to build
- Calm, minimal operator chrome tuned for a first-time volunteer
- Section/label (e.g. "Verse 2") on the confidence monitor — trivial reuse of existing `section` metadata
- Countdown/elapsed timer on the confidence monitor — no slide-model dependency, purely additive

**Defer (v2.4.x / v3+):**
- Instant blackout/logo-cut button — explicitly deferred by PROJECT.md; reserve a UI slot and key (e.g. `B`) now
- Non-Chromium monitor auto-detection — explicitly deferred
- Slide transitions/fades — conflicts with the existing `goToIndex` instant-swap media-lifecycle invariant (T-23-08); not requested by any reference tool as baseline
- Full Preview/Live two-pane operator model — explicit anti-feature, adds complexity for the non-technical target user
- Remote/mobile companion control app — materially larger scope than this milestone's single-browser-window model

### Architecture Approach

Everything new is a thin per-role wrapper around the existing slide engine, plus two small client-only utility modules (a BroadcastChannel protocol, a localStorage device-config store) — no new Firebase surface, no new Firestore collection, no Cloud Function. `SlideCanvas.vue` is extracted from `PresentationViewer.vue` to hold pure per-slide rendering (lyric/scripture/copyright/image/video + media playback), while `PresentationViewer.vue` keeps its chrome (exit button, nav, fullscreen, keyboard, font gate) and now composes `SlideCanvas` internally with zero behavior change at its one existing call site. Three new thin windows — `RunControlView.vue`, `AudienceOutputView.vue`, `ConfidenceOutputView.vue` — each independently instantiate `useSlideshowAssembly(service, orgId, {canWrite:false})` and therefore independently compute the identical `AssembledSlide[]` from the same Firestore documents; only a cheap integer index (plus a blackout flag) crosses via BroadcastChannel — never slide content. `AssembledSlide.slotIndex` (already stamped by `assembleSlideshow`) is the load-bearing join between the order-of-service rail and the flat slide array; a new `serviceSlots.ts` utility centralizes the sort/lookup so the rail's display order never drifts from the assembler's own. A standalone, service-independent `/monitor-setup` route persists the monitor→role mapping to `localStorage`, keyed by a synthesized fingerprint (`label:widthxheight:isPrimary`), never Firestore.

**Major components:**
1. `SlideCanvas.vue` (new, in `components/slides/`) — pure per-slide render + media playback, consumed by both `PresentationViewer.vue` and the three new Run windows
2. `RunControlView.vue` + `RunOrderRail.vue` (new) — owns `currentIndex`/`blackout`, opens/positions the two output windows, broadcasts state, renders the order-of-service rail
3. `AudienceOutputView.vue` / `ConfidenceOutputView.vue` (new, thin) — chromeless listeners; confidence forces `suppressBackground` and renders current+next
4. `MonitorSetupView.vue` (new, standalone route `/monitor-setup`) — screen enumeration, role assignment, localStorage persistence
5. `runChannel.ts` / `monitorConfig.ts` / `serviceSlots.ts` (new utils) — BroadcastChannel protocol, device-config fingerprinting, slot↔slide lookup — all pure, framework-agnostic, unit-testable in isolation

### Critical Pitfalls

1. **Permission-grant and permission-denied are both primary paths, not happy-path-vs-error-state** — `getScreenDetails()` must be called synchronously inside the click handler with no prior `await`; denial must route to a fully-built pop-out+drag+F11 fallback shipped in the SAME phase as auto-detect, not deferred as "polish."
2. **Synchronous dual `window.open()`** — both output windows must open in direct response to the same click, before any async work; an `await` in between silently trips the popup blocker, and a non-technical operator gets no visible error.
3. **Monitor→role mapping instability on replug** — persist a composite fingerprint (label + width/height + position), never array index or label alone; re-validate against the live screen list on every Run launch and force re-prompt only on a genuine mismatch, exactly as PROJECT.md specifies.
4. **Fullscreen-loss cascading into a full session teardown** — the existing `PresentationViewer.vue` pattern (`fullscreenchange` → `exitPresentation()`) is explicitly wrong to copy per-window; each output window must offer a local "click to re-enter fullscreen" affordance on loss, never tear down the session or the other windows.
5. **Auth/org context in popped-out windows** — a `window.open()` child is a separate JS realm with no automatic Pinia/store sharing; Firebase Auth persistence covers session survival for free, but org selection (sessionStorage-scoped by design) must also be passed explicitly via `?org=` query param, not relied on implicitly.
6. **Un-preloaded images causing a flash** — background images and PPTX-rendered PNGs must be preloaded 2-3 slides ahead, independently in each output window, or a live click-jump into a large deck shows a visible pop-in/flash-to-black, undermining the "calm" UX goal.

## Implications for Roadmap

### Phase 1: SlideCanvas Extraction (foundation)
**Rationale:** Every downstream phase (control preview, audience output, confidence output) depends on a working, tested `SlideCanvas.vue`; doing this first isolates the one refactor risk to the existing, well-tested `PresentationViewer.vue` call site before any new surface is built on top of it.
**Delivers:** `SlideCanvas.vue` extracted with `slide`/`suppressBackground`/`interactive` props; `PresentationViewer.vue` refactored to compose it with zero behavior change (verified against its existing test file's `data-testid` markers).
**Avoids:** Anti-Pattern 1 (forking `PresentationViewer.vue` three times) — establishes the single-source-of-truth rendering discipline the rest of the milestone depends on.

### Phase 2: Config + Channel Utilities
**Rationale:** `runChannel.ts`, `monitorConfig.ts`, and `serviceSlots.ts` are pure, framework-agnostic, independently unit-testable modules with no UI dependency — building and testing the sync/persistence primitives before any window consumes them catches the highest-consequence pitfalls (fingerprint instability, feedback loops, single-writer discipline) in isolation.
**Delivers:** A typed BroadcastChannel protocol (`state`/`hello` messages), the screen-fingerprint diff/match algorithm, and the `slotIndex`↔first-assembled-slide-index lookup.
**Uses:** BroadcastChannel, localStorage fingerprinting per STACK.md; `AssembledSlide.slotIndex` per ARCHITECTURE.md Pattern 3.
**Avoids:** Pitfall 2 (stale monitor mapping), Pitfall 12 (feedback loop on shared channel) — get the single-writer/fingerprint-diff design right before any window depends on it.

### Phase 3: Monitor Configuration Screen
**Rationale:** This is the single riskiest user-gesture flow in the whole milestone (permission prompt UX) and must be built and manually tested — both granted and denied paths — before the Run flow that depends on it exists.
**Delivers:** Standalone `/monitor-setup` route: screen enumeration via `getScreenDetails()`, Audience/Confidence role assignment UI, persistence to `localStorage`, and the pop-out+drag+F11 fallback as an equally-supported primary path (not an error state).
**Addresses:** "Standalone, persistent monitor configuration" (table stakes, FEATURES.md).
**Avoids:** Pitfall 1 (permission requested at the wrong moment), Pitfall 3 (no fallback when API absent/unsupported), Pitfall 7 (fullscreen on wrong screen).

### Phase 4: Audience Output Window
**Rationale:** Builds directly on Phases 1-3; the simpler of the two output windows (single `SlideCanvas`, background on) — validates the window-open/position/fullscreen/BroadcastChannel-listener pipeline before adding the confidence monitor's extra current+next complexity.
**Delivers:** `AudienceOutputView.vue` — fullscreen, chrome-free, listens-only, own `useSlideshowAssembly` instance, own Wake Lock, own preload-ahead logic, own font-load gate reuse (`slideTypography.ts`).
**Addresses:** "Audience output: fullscreen + background, zero chrome" (table stakes).
**Avoids:** Pitfall 5 (fullscreen gesture-origin failure), Pitfall 6 (fullscreen-loss cascade), Pitfall 16 (un-preloaded images), Pitfall 17 (font gate not shared), Pitfall 19 (operator chrome/cursor leaking).

### Phase 5: Confidence Monitor Output Window
**Rationale:** A rendering-mode fork of the same audience-window pattern (Pattern 2: suppress-background is one prop, not a second render path) — sequenced after Audience so the shared window-lifecycle/Wake Lock/preload patterns are already proven once.
**Delivers:** `ConfidenceOutputView.vue` — current+next `SlideCanvas` pair, `suppressBackground` forced true, chrome-free.
**Addresses:** "Confidence monitor: current+next, black background, no chrome" (table stakes).
**Avoids:** Same pitfall set as Phase 4, plus confirms the black-background transform stays a prop, not a duplicated content path.

### Phase 6: Run/Control Screen + Run Entry Point
**Rationale:** The most complex phase — owns the sync architecture decision (BroadcastChannel primary, resolved in Phase 2), the order-of-service rail, the "one click" Run bootstrap that opens both output windows synchronously, and the locked-service gate. Sequenced last among the "core delivery" phases because it depends on all four prior phases (SlideCanvas, utilities, monitor config, both output windows) being in place to open/position/sync against.
**Delivers:** `RunControlView.vue` + `RunOrderRail.vue`; new "Run" button on locked services (`ServiceCard.vue`/`ServiceEditorView.vue`); keyboard nav (Right/Space/Left existing, NEW Up/Down for item-jump); click-to-jump; window-open orchestration with the matched/unmatched monitor-config branches.
**Addresses:** "Run button on locked service," "order-of-service list with current-item highlight," "click to jump," "standard keyboard nav" (all table stakes).
**Avoids:** Pitfall 9 (popup blocker), Pitfall 10 (race condition on window open), Pitfall 18 (operator can't tell windows apart in fallback), Pitfall 20 ("you are here" indicator), Pitfall 21 (accidental exit).
**Owns the requirements-level decision:** who may click Run — resolve the editor-only vs. new "projectionist" role tier question here (see Gaps below) before this phase is planned in detail.

### Phase 7: Live-Ops Hardening
**Rationale:** Sequenced last — these are cross-cutting robustness concerns (monitor replug mid-service, closed-window recovery, wake-lock re-acquisition over a realistic 60-90 min session, Firestore-rules coverage for any new state) that only matter once the core three-window flow already works end-to-end, and several require real-length manual testing that's wasteful to run before the core flow stabilizes.
**Delivers:** `screenschange`/`resize` listener + control-window banner for mid-service monitor changes; `window.closed` polling + one-click reopen for a closed output window; Wake Lock re-acquisition on `visibilitychange`; `firestore.rules` coverage (if any new run-state document is introduced) verified via `npm run test:rules`.
**Avoids:** Pitfall 4 (monitor unplug mid-service), Pitfall 13 (closed output window, no recovery), Pitfall 14 (machine sleep/screensaver).

### Phase Ordering Rationale

- Foundation-first sequencing (SlideCanvas → utilities → monitor config) isolates the highest-blast-radius refactor and the riskiest permission/fingerprint logic before any new UI depends on them, matching both the architecture researcher's "reuse not fork" framing and the pitfalls researcher's "test the riskiest gesture call first, isolated" recommendation.
- Output windows before the control screen lets the simpler, independently-testable consumer of `SlideCanvas` + BroadcastChannel-listening validate the pattern before the control screen's more complex orchestration (window-open sequencing, rail, keyboard nav) is layered on top.
- Live-Ops Hardening is deliberately last and separable — FEATURES.md's dependency graph confirms multi-monitor delivery is orthogonal to slide-rendering work, and PITFALLS.md explicitly scopes several of these (replug, closed-window recovery, long-run wake-lock) to a dedicated hardening phase distinct from the initial builds.
- This order avoids Anti-Pattern 2 (routing state through Firestore) and Anti-Pattern 3 (storing monitor config in Firestore) by settling the sync/persistence architecture (Phase 2) before any window that would be tempted to reach for the app's familiar Firestore-realtime default instead.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Monitor Configuration Screen):** the permission-prompt UX and pop-out fallback need real-device testing (mixed-DPI monitors, actual permission-denial flow) that this research pass could not fully simulate — flag for `--research-phase` if the plan needs concrete UI copy/flow validation beyond what STACK.md/PITFALLS.md already specify.
- **Phase 6 (Run/Control Screen):** the projectionist-role decision (below) is a requirements gap, not just an implementation detail — plan-phase should not proceed until requirements resolves it, since it affects the Run entry point's auth/RBAC gating.

Phases with standard patterns (skip research-phase):
- **Phase 1 (SlideCanvas Extraction):** a well-documented, low-risk Vue component-extraction pattern; ARCHITECTURE.md already provides the exact prop shape and migration approach.
- **Phase 2 (Config + Channel Utilities):** BroadcastChannel and fingerprint-diff patterns are fully spec'd in STACK.md/ARCHITECTURE.md/PITFALLS.md with code-shape examples already provided.
- **Phases 4-5 (Output Windows):** the rendering-fork pattern (Pattern 2) and font/preload reuse are already concretely specified against this exact codebase.
- **Phase 7 (Live-Ops Hardening):** each item has a documented MDN/Chrome-for-Developers pattern (visibilitychange re-acquire, screenschange listener, window.closed polling) — implementation is standard, though verification needs real-length manual testing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | All core APIs verified against MDN/Chrome-for-Developers/W3C spec repo; two facts (long-run `id` persistence across browser restarts, exact Edge version parity) could not be pinned to a single authoritative source |
| Features | MEDIUM | Cross-checked across ≥2 independent sources per claim (vendor docs + trade press), but no Context7/Ref-authoritative doc provider was available; exact keystrokes are a strong convention to imitate, verify via UAT once built |
| Architecture | HIGH | All claims verified against live source in this repo; the two external-API claims (Firebase Auth default persistence, Window Management API shape) are well-established, stable platform behavior |
| Pitfalls | MEDIUM-HIGH | Window Management/Fullscreen/Wake Lock/BroadcastChannel mechanics are HIGH confidence (official docs); live-operation and non-technical-UX pitfalls are MEDIUM — synthesized from platform behavior + this project's own existing code, not a published post-mortem of church presentation software specifically |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **WHO may run a service** (flagged explicitly by the architecture researcher): PROJECT.md introduces a "new projectionist role concept" but does not specify whether this is (a) the existing editor role simply gaining a new "Run" affordance, or (b) a genuinely new, narrower RBAC tier distinct from editor/viewer. This directly determines the auth-gating logic on the Run entry point (Phase 6) and possibly `firestore.rules` scope — **requirements must resolve this before Phase 6 is planned in detail.**
- **Exact keyboard shortcut map:** the researched convention (Right/Space=next, Left=prev, Up/Down=item-jump, Escape=exit-with-confirmation) is a synthesis across tools, not a single documented spec for this app — validate the final binding set with the milestone's own planned UI-research/UAT pass before treating it as final.
- **Edge browser version parity:** Window Management API support in Edge is corroborated via policy-documentation cross-referencing (Edge 123 `DefaultWindowManagementSetting`) rather than a single authoritative "ships since Edge X" statement — low risk given the project already targets modern evergreen Edge, but worth a quick manual smoke-test on the actual church's Edge version if known.
- **Screen `id` stability across a cookie/data clear:** documented as an edge case (Pitfall/Stack), mitigated by the fingerprint-based re-validation design — but has not been exercised against this specific app; include an explicit "clear site data, confirm re-prompt" test in Phase 3's or Phase 7's verification.

## Sources

### Primary (HIGH confidence)
- MDN — Window Management API, ScreenDetailed, Fullscreen API, Screen Wake Lock API, BroadcastChannel (official docs)
- Chrome for Developers — "Manage several displays with the Window Management API," "Stay awake with the Screen Wake Lock API"
- W3C `window-management` spec repo — HOWTO.md, EXPLAINER.md
- Direct source inspection of this repo: `src/components/PresentationViewer.vue`, `src/utils/slideshowAssembler.ts`, `src/composables/useSlideshowAssembly.ts`, `src/types/slide.ts`, `src/stores/auth.ts`, `src/firebase/index.ts`, `src/router/index.ts`
- `.planning/PROJECT.md` — v2.4 milestone scope and owner decisions

### Secondary (MEDIUM confidence)
- Renewed Vision (ProPresenter official support docs), EasyWorship official help, Faithlife Proclaim official features/support, OpenLP official manual, FreeShow official docs, Church Presenter blog, Church Production Magazine, Igniter Media, MediaShout/The Lead Pastor — cross-checked feature/keyboard/confidence-monitor convention claims
- caniuse.com (`mdn-api_window_getscreendetails`) — live browser-support source of truth
- Scott Logic (multi-window browser apps), community cross-window-communication write-ups — BroadcastChannel/noopener behavior corroboration

### Tertiary (LOW confidence)
- W3C `window-management` GitHub Issue #80 (`ScreenDetailed` object-identity stability) — used as corroboration only, not sole source
- Edge Chromium-parity via policy documentation cross-reference — treat exact version boundary as approximate

---
*Research completed: 2026-08-28*
*Ready for roadmap: yes*
