---
phase: 94-confidence-monitor-output
plan: 01
subsystem: presentation-output
tags: [composable, refactor, run-channel, output-window, R272]
requires:
  - "src/views/AudienceOutputView.vue (Phase 93 audience window + its 18-test regression gate)"
  - "src/utils/runChannel.ts (openRunChannel receive-only channel)"
  - "src/composables/useSlideshowAssembly.ts (read-only assembly)"
provides:
  - "src/composables/useOutputWindow.ts (shared output-window lifecycle-core)"
affects:
  - "src/views/AudienceOutputView.vue (now a thin consumer of useOutputWindow)"
tech-stack:
  added: []
  patterns:
    - "setup()-time composable owning onMounted/onUnmounted so cleanup registers on the consuming view's instance"
    - "channelFactory threaded through as a composable argument to preserve the in-memory channel test seam"
    - "per-canvas media plumbing kept view-local; deferred first-play re-homed to watch(fontReady)"
key-files:
  created:
    - src/composables/useOutputWindow.ts
  modified:
    - src/views/AudienceOutputView.vue
decisions:
  - "Media play/pause watcher stays in each view (audience=1 live canvas, confidence=1 live + 1 inert preview); the composable exposes index/fontReady only."
  - "Deferred first-play became a view-local watch(fontReady) instead of an onMounted touch-point, since it references the view's canvas ref."
metrics:
  duration: ~15m
  completed: 2026-08-28
status: complete
---

# Phase 94 Plan 01: Extract useOutputWindow + refactor AudienceOutputView Summary

Extracted the ~90%-shared output-window lifecycle-core out of `AudienceOutputView.vue` into a new
`src/composables/useOutputWindow.ts` (R272 reuse-not-fork), and refactored the audience view into a thin
consumer — with the unmodified Phase 93 18-test suite as the regression gate. No observable audience
behavior changed.

## What Was Built

### Task 1 — `src/composables/useOutputWindow.ts` (commit `d1369bf9`)

A single composable `useOutputWindow(options: { channelFactory?: BroadcastChannelFactory })`, called from
inside a component `setup()`, that owns the shared lifecycle-core moved verbatim-in-behavior from the view:

- `?org=` / `:serviceId` scoping (`serviceId`, `orgIdRef` computed, reading `useRoute` + `useAuthStore`).
- Read-only initial-load `watch(serviceStore.services)` into `localService` (initial-load branch only).
- `useSlideshowAssembly(localService, orgIdRef)` with `canWrite` omitted (stays its `false` default).
- Receive-only run channel: `openRunChannel(serviceId, options.channelFactory)`, `onState` (sets internal
  `index`/`blackout`), `postHello` — NEVER `postState`.
- WR-02 org-mismatch subscribe gate (`if (orgId && serviceStore.orgId !== orgId) subscribe`).
- Bounded font gate (`fontReady`, `resolvedFontChoice`, `Promise.race` with `FONT_LOAD_TIMEOUT_MS`, always
  resolving `fontReady` in `finally`).
- `rootStyle` computed (CSS-var wrapper + `cursor:none`-while-fullscreen coupling).
- Non-teardown fullscreen-loss recovery (`rootRef`, `isFullscreen`, `handleFullscreenChange` that ONLY sets
  `isFullscreen`, `handleReenterFullscreen` with `requestFullscreen()` as first statement — Pitfalls 5/6).
- Screen Wake Lock (`acquireWakeLock`, `handleVisibilityChange` re-acquire).
- `onMounted`/`onUnmounted` registered on the calling instance; unmount closes the channel, removes both
  listeners, releases the wake lock, and calls `serviceStore.unsubscribeAll()`.

**Return surface (exactly):**
`{ assembledSlideshow, index, fontReady, rootRef, rootStyle, isFullscreen, handleReenterFullscreen }`.

Deliberately absent: any SlideCanvas import, any Firestore/db import, the deferred first-play, and every
canvas-ref touch-point. `blackout` is kept internal (read for forward-compat, not returned).

### Task 2 — `src/views/AudienceOutputView.vue` refactor (commit `9f2763a4`)

- `<template>` (lines 1-62) UNCHANGED — same `data-testid=audience-output` root, single background-ON
  `<SlideCanvas :interactive="false">` (no `suppressBackground`), `data-testid=audience-reenter-fullscreen`
  affordance, `rootStyle` cursor toggle.
- `<script setup>` now calls `useOutputWindow({ channelFactory: props.channelFactory })` and destructures the
  return surface; the `channelFactory` prop is kept and forwarded.
- View-local per-canvas media plumbing retained: `currentSlide` computed, `slideCanvasRef`, the
  `watch(index)` pause→`nextTick`→play watcher, and `onBeforeUnmount(pause)`.
- Deferred first-play re-homed from `onMounted` to a view-local `watch(fontReady, ready => { if (!ready)
  return; void nextTick().then(() => slideCanvasRef.value?.play()) })`.
- Trimmed imports down to what remains view-local (`ref`, `computed`, `watch`, `nextTick`,
  `onBeforeUnmount` from vue; `useOutputWindow`; `SlideCanvas`; `AssembledSlide` type;
  `BroadcastChannelFactory` type for the prop). Net −180 / +20 lines.

## Verification Results

- `npm run type-check` (vue-tsc --build, includes the test file): **clean** (no output, exit 0) — ran clean
  after Task 1 and again after Task 2. No OOM; `NODE_OPTIONS` bump not needed.
- `npx vitest run src/views/__tests__/AudienceOutputView.test.ts`: **18/18 passed** with that test file
  UNMODIFIED — the primary regression gate.
- `npx vitest run` (bare, no `--dir src`): **162 test files passed, 1 failed** — the single failing file is
  `src/storage.rules.test.ts`, the documented CLAUDE.md baseline (Storage-emulator dependent; its failures
  here are 5s timeouts because no Storage emulator is running). No other regression. 4529 tests passed.

## Deviations from Plan

None — plan executed exactly as written. Both hard constraints honored: `channelFactory` is a composable
argument forwarded from the view's prop, and the per-canvas media watcher + deferred first-play +
pre-unmount pause stayed view-local.

## Self-Check: PASSED

- `src/composables/useOutputWindow.ts` — FOUND
- `src/views/AudienceOutputView.vue` — FOUND (modified)
- Commit `d1369bf9` — FOUND
- Commit `9f2763a4` — FOUND
