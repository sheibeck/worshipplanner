---
phase: 94-confidence-monitor-output
plan: 03
subsystem: presentation-output
tags: [confidence-monitor, output-window, testing, suppress-background, vitest]
requires:
  - "94-01: useOutputWindow composable"
  - "94-02: ConfidenceOutputView.vue + /present/confidence/:serviceId route"
provides:
  - "ConfidenceOutputView.test.ts — R272 behavioral coverage (two-pane, black-suppression, last-slide, next-static, inherited lifecycle)"
  - "useOutputWindow.test.ts — direct unit test of the shared lifecycle-core"
affects:
  - "Locks R272 mocked-path proofs for the autonomous run"
  - "HUMAN-UAT items (real black suppression / 30%-height legibility) remain deferred"
tech-stack:
  added: []
  patterns:
    - "Non-vacuous black-suppression proof: real SlideCanvas via vi.importActual + false control (T-94-08)"
    - "Per-instance play/pause spies pushed to a module-scope registry; instance reuse yields one current-region + one next-region record"
    - "Composable unit-tested through a trivial host component that captures the returned surface into a module-scope closure"
key-files:
  created:
    - src/views/__tests__/ConfidenceOutputView.test.ts
    - src/composables/__tests__/useOutputWindow.test.ts
  modified: []
decisions:
  - "Next-pane-never-autoplays asserted by partitioning the registry into played/not-played rather than by ambiguous slide id (b appears as both next-then-current across an advance)"
  - "Real-SlideCanvas suppression proven for a background-carrying AND a video slide, with a suppressBackground=false false-control that DOES render presentation-background so the negative cannot pass trivially"
  - "Instance reuse (no :key on either pane) means the current-region and next-region SlideCanvas each register once — the current pane's play spy is driven, the next pane's is never called"
metrics:
  duration: ~20m
  completed: 2026-08-28
status: complete
---

# Phase 94 Plan 03: Confidence Monitor Output Tests Summary

Authored the behavioral coverage for the confidence output window (94-02) plus a direct unit test of the shared `useOutputWindow` composable (94-01). All R272-critical properties — two-pane current+next render, both backgrounds suppressed to black (view wiring AND the real SlideCanvas emitting no background element), last-slide no-reflow safety, and the next pane never autoplaying — are now proven by passing jsdom tests, alongside the inherited Phase 93 lifecycle re-proven against the confidence view and directly against the composable.

## What Was Built

**`src/views/__tests__/ConfidenceOutputView.test.ts` (22 tests):**
- **Two-pane mid-deck:** `emitState(1)` renders current `b` (in `confidence-current-region`) + next `c` (in `confidence-next-region`), with the `confidence-next-label` "Next" tag on the next pane only.
- **Both panes suppressed (view wiring):** after the mid-deck render, both registry records carry `suppressBackground === true` and `interactive === false`.
- **Non-vacuous real-SlideCanvas black suppression (T-94-08):** `vi.importActual` mounts the REAL `SlideCanvas` and asserts NEITHER `presentation-background` NOR `presentation-background-scrim` renders under `suppressBackground=true` for a background-carrying slide AND a video slide, PLUS a mandatory false-control (`suppressBackground=false` on the same background-carrying slide DOES render `presentation-background` with the bg url), so the negative assertions cannot pass trivially.
- **Last-slide no-reflow:** `emitState(2)` (current = last `c`, `next == null`) renders current `c` (no wrap to `a`, no throw), the next pane's SlideCanvas absent, the "Next" tag hidden, and BOTH `confidence-current-region` and `confidence-next-region` wrappers still present.
- **Next pane never autoplays:** per-instance `play`/`pause` spies in a module-scope registry; after `emitState(0)` then `emitState(1)`, the registry partitions into exactly one played record (current pane — `pause` before its last `play`) and one never-played record (next pane).
- **Inherited Phase 93 lifecycle (retargeted testids):** channel-driven index + higher-seq advance + stale-seq drop; `postHello` on mount / NEVER `postState` / `close` on unmount; chrome absence + `cursor:none` while fullscreen; pure-black gate (index null + out-of-range); wake-lock present / re-acquire / released / absent-no-throw; fullscreen-loss → `confidence-reenter-fullscreen` renders WITHOUT teardown and click calls `requestFullscreen`; WR-02 subscribe gate (fresh / different-org / same-org).

**`src/composables/__tests__/useOutputWindow.test.ts` (12 tests):**
- Drives the composable through a trivial host component (`defineComponent` + `setup()` calling `useOutputWindow({ channelFactory })`), capturing the returned surface into a module-scope closure so tests read the raw refs directly.
- Asserts: index from `onState` (+ higher-seq advance + stale-seq drop); `postHello` on mount / never `postState`; WR-02 subscribe gate (three cases); wake-lock acquire / re-acquire-on-visibilitychange / release-on-unmount / absent-no-throw; `isFullscreen` tracking a dispatched `fullscreenchange` without ever calling channel `close()` (Pitfall 6); `handleReenterFullscreen` calling `requestFullscreen`; `fontReady` resolving true; `handle.close()` + `serviceStore.unsubscribeAll()` on unmount.

## Non-Vacuous Suppression Proof

The black-suppression chain is closed end-to-end and cannot pass trivially:
1. **View wiring** — the SlideCanvas stub records `suppressBackground`/`interactive`; both panes prove `true`/`false`.
2. **Real DOM** — the unstubbed SlideCanvas emits no `presentation-background`/`-scrim` under `suppressBackground=true` for a background-carrying AND a video slide.
3. **False control** — the same background slide with `suppressBackground=false` DOES render `presentation-background`, proving the negative assertion is meaningful (mitigates T-94-08).

## Deviations from Plan

None - plan executed exactly as written. Both task files created against the real views/composable, mirroring the AudienceOutputView.test.ts harness. No package installs, no source changes.

## Verification / Gate Results

- `npx vitest run src/views/__tests__/ConfidenceOutputView.test.ts` → 22/22 pass.
- `npx vitest run src/composables/__tests__/useOutputWindow.test.ts` → 12/12 pass.
- Audience + both new files together → 52/52 pass (audience 18 stay green).
- `npm run type-check` (vue-tsc --build, includes test files) → clean.
- Bare `npx vitest run` → 164 files passed, only `src/storage.rules.test.ts` failing (documented Storage-emulator baseline — no emulator running; not chased, per CLAUDE.md). No `--dir src` used.

## Deferred (HUMAN-UAT)

Real black-background suppression as seen by the band and glanceable current/next legibility with the next pane at ~30% height on real second-monitor hardware are not provable by jsdom — deferred to milestone-end UAT (94-CONTEXT `<specifics>`; 94-UI-SPEC 30%-height legibility FLAG).

## Self-Check: PASSED
- FOUND: src/views/__tests__/ConfidenceOutputView.test.ts (commit 934aaeaa)
- FOUND: src/composables/__tests__/useOutputWindow.test.ts (commit 688010aa)
