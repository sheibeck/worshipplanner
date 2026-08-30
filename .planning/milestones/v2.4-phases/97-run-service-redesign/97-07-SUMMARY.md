---
phase: 97-run-service-redesign
plan: 07
subsystem: run-service-output-windows
tags: [output-window, blackout, self-fullscreen, confidence-monitor, tests]
requires:
  - useOutputWindow blackout + role self-fullscreen (97-03)
  - monitorConfig computeFingerprint/saveMapping (Phase 91)
  - AudienceOutputView.test.ts / ConfidenceOutputView.test.ts harnesses (Phase 93/94)
provides:
  - Behavioural coverage that the outputs obey the channel blackout field (R280)
  - Behavioural coverage that each output self-fullscreens on its assigned monitor with a safe fallback (R278)
  - Behavioural coverage that the confidence window is a left/right split with suppression + no-reflow + next-scale (R279/R276)
affects:
  - src/views/__tests__/AudienceOutputView.test.ts
  - src/views/__tests__/ConfidenceOutputView.test.ts
tech-stack:
  added: []
  patterns:
    - "Fake window.getScreenDetails (resolved { screens, addEventListener, removeEventListener }) + seeded saveMapping mapping to exercise the REAL role→screen resolution without a real Window Management API"
    - "DOM-order proof (root.children index compare) that the blackout overlay is a LATER sibling → paints ABOVE the SlideCanvas / region panes (non-vacuous 'above')"
    - "vi.mocked(Element.prototype.requestFullscreen).mock.calls[0][0].screen to assert the { screen } option object without a real fullscreen"
key-files:
  created: []
  modified:
    - src/views/__tests__/AudienceOutputView.test.ts
    - src/views/__tests__/ConfidenceOutputView.test.ts
decisions:
  - "Screen fixtures screenA (audience) / screenB (confidence) carry DISTINCT fingerprints so the seeded per-role mapping resolves to exactly one live screen — proving the resolution is mapping-driven, not first-screen."
  - "localStorage.clear() added to each suite's beforeEach and delete window.getScreenDetails to afterEach so the new R278 seeds never bleed into the existing (and the absent-API fallback) tests."
  - "No Array.prototype.at used; DOM order asserted via Array.from(el.children).findIndex."
metrics:
  duration: ~20m
  completed: 2026-08-29
status: complete
---

# Phase 97 Plan 07: Output-Window Tests — Blackout + Self-Fullscreen + Confidence Left/Right Summary

Authored behavioural coverage for the Phase 97 output-window behaviour shipped in 97-03: both output windows now have tests proving they black out / clear on the channel `blackout` field (R280), self-fullscreen onto their assigned monitor on mount with a safe never-throw fallback (R278), and that the confidence window is a left/right split with background suppression, last-slide no-reflow, and a smaller next pane intact (R279 + R276). Every window/screen/channel message is faked — no real window opens, no real `getScreenDetails` is called.

## What Was Built

### Task 1 — AudienceOutputView.test.ts: blackout + self-fullscreen(screen) + no-throw fallback (`e0e6c70f`)
- Added `screenA`/`screenB` fixtures (distinct fingerprints) + an `installGetScreenDetails` helper mirroring the MonitorSetupView idiom; imported `computeFingerprint`, `saveMapping`, `ScreenLike` from `@/utils/monitorConfig`. Added `localStorage.clear()` to `beforeEach` and `delete window.getScreenDetails` to `afterEach`.
- **Blackout (R280):** `emitState(0, 2, true)` renders `audience-blackout`; a DOM-order compare of `audience-output`'s children proves the overlay is a LATER sibling than `slide-canvas` (paints ABOVE it) while the SlideCanvas stays mounted underneath; `emitState(0, 3, false)` removes it and the slide returns. A second test proves the re-enter affordance survives a windowed blackout.
- **Self-fullscreen resolvable (R278):** seed `saveMapping({ audience → computeFingerprint(screenA) })` + `installGetScreenDetails([screenA, screenB])` → mount → `getScreenDetails` called once and `Element.prototype.requestFullscreen` first call carries `{ screen: screenA }`.
- **No-throw fallbacks (R278):** with NO `getScreenDetails` installed and no mapping → no throw + exactly one PLAIN `requestFullscreen()` (arg `undefined`); and an unresolvable screen (mapping→screenA but only screenB live) → no throw + one plain `requestFullscreen()`.

### Task 2 — ConfidenceOutputView.test.ts: blackout + left/right split + self-fullscreen(confidence) (`f23bca74`)
- Same imports/helpers/fixtures + `beforeEach`/`afterEach` hygiene.
- **Blackout (R280):** `confidence-blackout` renders over both region panes on `blackout:true` (both region wrappers stay mounted; DOM-order proof over the next-region seam) and clears on `blackout:false`.
- **Left/right layout (R279) + next-scale (R276):** root class list contains `flex-row`; `confidence-next-region` carries `border-l`; `confidence-current-region` precedes `confidence-next-region` in DOM order (left→right); BOTH recorded canvas instances keep `suppressBackground === true` (non-vacuous — 2 instances, all suppressed); the `scale(0.8)` wrapper lives in the next-region only (current has none) → next pane smaller. A separate test re-proves last-slide no-reflow: both region wrappers stay present with only the inner next canvas + "Next" label toggling off, current pane still 'c' (no wrap).
- **Self-fullscreen confidence (R278):** seed `saveMapping({ confidence → computeFingerprint(screenB) })` + `installGetScreenDetails([screenA, screenB])` → `requestFullscreen` first call carries `{ screen: screenB }` (proving per-role resolution, distinct from audience's screenA); plus the absent-API no-throw plain fallback.

## Deviations from Plan

None — plan executed exactly as written. Both new suites are additive; every pre-97 block (subscribe gate, media invariant, suppression, no-reflow, reenter affordance, receive-only handshake) stays green.

## Gate Results

- `npm run type-check` (vue-tsc --build, typechecks test files too): **clean** (no `NODE_OPTIONS` bump needed).
- `npx vitest run src/views/__tests__/AudienceOutputView.test.ts`: **23/23 pass** (18 prior + 5 new).
- `npx vitest run src/views/__tests__/ConfidenceOutputView.test.ts`: **28/28 pass** (23 prior + 5 new).
- Bare `npx vitest run` (full app suite): **169 files passed, 1 failed = `src/storage.rules.test.ts` only** (4632 tests passed, 25 failed — all in storage.rules, the documented Storage-emulator cross-service `firestore.exists()` environment limitation, not a regression). This is the exact known baseline. No `--dir src` used; no rules suite invoked.

## Threat Coverage

All three mitigate-disposition threats from the plan's register are now covered by assertions:
- **T-97-07-01** (blackout not hiding the slide) — the on/off overlay + DOM-order-above blocks.
- **T-97-07-02** (self-fullscreen throwing on mount) — the resolvable `{ screen }` block + the two no-throw plain-fallback blocks.
- **T-97-07-03** (confidence reflow / background reveal) — the flex-row/border-l/order + suppression + last-slide no-reflow block.

No new security-relevant surface introduced (test-only changes) — no threat flags.

## Self-Check: PASSED

- src/views/__tests__/AudienceOutputView.test.ts — modified, FOUND (audience-blackout, getScreenDetails, requestFullscreen({ screen })).
- src/views/__tests__/ConfidenceOutputView.test.ts — modified, FOUND (confidence-blackout, flex-row, border-l, scale(0.8), self-fullscreen confidence→screenB).
- Commits e0e6c70f, f23bca74 — both present in git log.

## Deferred / Human-UAT

The real cross-monitor auto-fullscreen, confidence left/right legibility, and projector blackout remain milestone-end hardware UAT (carried from 97-03's T-97-03-02 accept). This suite covers the faked behavioural contract only.
