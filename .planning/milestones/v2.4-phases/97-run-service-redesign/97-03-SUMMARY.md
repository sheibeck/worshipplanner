---
phase: 97-run-service-redesign
plan: 03
subsystem: run-service-output-windows
tags: [output-window, blackout, self-fullscreen, confidence-monitor, broadcastchannel]
requires:
  - useOutputWindow lifecycle-core (Phase 94)
  - monitorConfig loadMapping/computeFingerprint (Phase 91)
  - RunState.blackout protocol field (runChannel.ts)
provides:
  - useOutputWindow returns blackout + accepts role option (self-fullscreen on mount)
  - AudienceOutputView blackout overlay + role:'audience'
  - ConfidenceOutputView left/right split + next-pane scale + blackout overlay + role:'confidence'
affects:
  - src/composables/useOutputWindow.ts
  - src/views/AudienceOutputView.vue
  - src/views/ConfidenceOutputView.vue
tech-stack:
  added: []
  patterns:
    - "Feature-detected + try/catch-swallowed getScreenDetails/requestFullscreen (never throws at a congregation)"
    - "Full-bleed absolute inset-0 bg-black overlay as a view sibling ABOVE SlideCanvas (blackout), mirroring the reenter-overlay idiom"
    - "transform: scale() wrapper to shrink a SlideCanvas that has no font-size prop"
key-files:
  created: []
  modified:
    - src/composables/useOutputWindow.ts
    - src/views/AudienceOutputView.vue
    - src/views/ConfidenceOutputView.vue
decisions:
  - "Role is a static per-view literal ('audience'/'confidence') — the /present/audience|confidence routes make it statically known, so NO control-side &role= URL param was added."
  - "selfFullscreen() degrades to a single plain requestFullscreen() when getScreenDetails is absent or no screen resolves; the manual Re-enter affordance stays as the final fallback."
  - "requestFullscreen rejects ASYNC, so the returned promise is .catch-swallowed (not only try/catch) to avoid unhandled rejections."
metrics:
  duration: ~35m
  completed: 2026-08-29
status: complete
---

# Phase 97 Plan 03: Output Windows — Self-Fullscreen + Blackout + Confidence Left/Right + Next-Scale Summary

Wired the first real use of the channel `blackout` field and redesigned both output windows: each output self-fullscreens onto its assigned monitor on load (R278), the confidence window shows current+next side-by-side left/right (R279) with the next pane scaled smaller (R276), and both outputs render a full-bleed black overlay on `blackout:true` (R280 output side). Client-only, receive-only — outputs still never `postState`. Zero protocol change.

## What Was Built

### Task 1 — useOutputWindow: expose blackout + guarded self-fullscreen-on-mount (`28bb9d00`)
- Extended `UseOutputWindowOptions` with `role?: MonitorRole`; imported `loadMapping`, `computeFingerprint`, `MonitorRole`, `ScreenLike` from `@/utils/monitorConfig`.
- Added `resolveAssignedScreen()` — feature-detects `getScreenDetails`, resolves the role's saved fingerprint via `loadMapping()` then matches the live screen via `computeFingerprint` (mirrors `RunControlView.resolveScreen`); returns `null` and never throws on absence/rejection/no-match.
- Added `selfFullscreen()` — early-returns if already fullscreen; `requestFullscreen({ screen })` when resolved (cast+guarded exactly as `RunControlView.openWindow`), else a single plain `requestFullscreen()`; async rejection `.catch`-swallowed.
- Called `void selfFullscreen()` in `onMounted` AFTER `postHello()` so channel setup is never blocked.
- Added `blackout` to the returned object; receive-only contract intact (no `postState`).

### Task 2 — AudienceOutputView: blackout overlay + role:'audience' (`cc3891fa`)
- Passes `role: 'audience'` to `useOutputWindow`; destructures `blackout`.
- Renders `<div v-if="blackout" class="absolute inset-0 bg-black" data-testid="audience-blackout" aria-hidden="true">` as a sibling AFTER the SlideCanvas (paints on top), with the reenter overlay still after it so the re-enter button stays reachable mid-blackout.

### Task 3 — ConfidenceOutputView: left/right split + next-scale + blackout + role (`16141b05`)
- Root `flex-col` → `flex-row`; current region `flex-[7_1_0%]` → `flex-[3_1_0%]` (LEFT, dominant); next region `flex-[3_1_0%]` → `flex-[2_1_0%]` (RIGHT); seam `border-t` → `border-l` (R279).
- Wrapped the next SlideCanvas in a `transform: scale(0.8); transform-origin: center` container so the upcoming slide reads smaller in the narrower right column (R276); current pane unscaled.
- Preserved both Phase 94 invariants: both panes keep `:suppressBackground="true"` (black-suppression) and the next wrapper stays UNCONDITIONALLY present (only the inner scaled canvas + "Next" label are `v-if="nextSlide && fontReady"`), so the current pane never resizes on the final advance (last-slide no-reflow).
- Passes `role: 'confidence'` + `confidence-blackout` overlay over both panes (R280).
- `confidence-current-region` / `confidence-next-region` testids unchanged.

## Deviations from Plan

None — plan executed exactly as written. (One minor hardening within Task 1's spec: `selfFullscreen()` uses `.catch()` on the requestFullscreen promise in addition to the surrounding `try/catch`, because `requestFullscreen` rejects asynchronously; this stays within the "never throws / fully swallowed" contract the plan mandated.)

## Gate Results

- `npm run type-check` (vue-tsc --build, typechecks test files too): **clean**.
- `npx vitest run src/views/__tests__/AudienceOutputView.test.ts src/views/__tests__/ConfidenceOutputView.test.ts`: **41/41 pass** (18 audience + 23 confidence), untouched.
- Bare `npx vitest run` (full app suite): **166 files passed, 1 failed = `src/storage.rules.test.ts` only** (4611 tests passed, 25 failed — all in storage.rules, the documented Storage-emulator cross-service `firestore.exists()` environment limitation, not a regression). This is the exact known baseline. No `--dir src` used.

## Self-Check: PASSED

- src/composables/useOutputWindow.ts — modified, FOUND (blackout returned, role option, selfFullscreen).
- src/views/AudienceOutputView.vue — modified, FOUND (audience-blackout, role:'audience').
- src/views/ConfidenceOutputView.vue — modified, FOUND (flex-row, border-l, confidence-blackout, role:'confidence', scale).
- Commits 28bb9d00, cc3891fa, 16141b05 — all present in git log.

## Deferred / Human-UAT

Cross-monitor self-fullscreen and real blackout are only provable on hardware (T-97-03-02, accept): on real multi-monitor hardware, confirm both outputs auto-fullscreen on the correct monitors on Go-live, confidence left/right legibility, and the projector blackout. Added to the v2.4 DEFERRED-HUMAN-UAT set. New behavioural coverage (blackout/self-fs/left-right) lands in plan 97-07 (Wave 2).
