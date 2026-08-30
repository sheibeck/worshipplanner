---
phase: 96-live-ops-hardening
plan: 02
subsystem: run-mode-output-orchestration
tags: [testing, live-ops, run-control, broadcast-channel, monitor-recovery]
requires: ["96-01"]
provides:
  - "RunControlView.output.test.ts live-ops coverage: closed detection, per-role reopen, position preservation, monitor-unplug reassign + precedence, single-teardown no-leak, rapid-nav sync"
affects:
  - src/views/__tests__/RunControlView.output.test.ts
tech-stack:
  added: []
  patterns:
    - "Fake-timer-scoped poll driving via vi.advanceTimersByTimeAsync (flushes microtasks between ticks so getScreenDetails().then settles)"
    - "Captured-listener screenschange fake: installGetScreenDetails returns { details, control } with a mutable screens getter + control.setScreens/fireScreensChange"
    - "In-memory channel deliver(): fires an inbound { type:'hello' } to exercise the real onHello(resendCurrent) handshake"
key-files:
  created: []
  modified:
    - src/views/__tests__/RunControlView.output.test.ts
decisions:
  - "Extended mockSlides to 4 slides (plan said >=3) so both the position-preserved runway (ArrowRight->index 2) and the rapid-nav path (3 fwd, 1 back -> index 2) land on deterministic non-zero indices"
  - "screenschange tests invoke the captured listener directly with NO timers, isolating them from the flushPromises/fake-timer interaction; only poll-driving blocks use fake timers, scoped locally"
metrics:
  duration: ~12m
  completed: 2026-08-28
  tasks: 2
  files: 1
  tests_added: 12
status: complete
---

# Phase 96 Plan 02: Live-Ops Hardening (Tests) Summary

Extended `src/views/__tests__/RunControlView.output.test.ts` with 12 new behavioral tests (24 total in file) proving Phase 96's live-ops recovery: a closed output window is detected and reopened per-role without losing position, a monitor unplug surfaces the reassign banner with correct precedence, the poll + screenschange listener tear down exactly once, and rapid navigation stays in sync — all client-only, no Firestore/emulator touched.

## What Was Built

**Task 1 — harness upgrades + closed/reopen/position (commit `40f5d2c1`)**
- Harness upgrades shared by both tasks: `FakeWin` gained a mutable `closed` field; `createFakeChannel` captures the message listener and exposes `deliver(data)` to fire an inbound message; `installGetScreenDetails` now resolves a `{ screens (mutable getter), addEventListener (capturing), removeEventListener (spy) }` object and returns `{ fn, details, control }` where `control.setScreens`/`control.fireScreensChange` drive the captured `screenschange` listener; `mockSlides` extended to 4 slides.
- New blocks: per-role closed detection (audience-only, confidence-only; cluster stays `placed`), per-role reopen (that role's window only, amber row cleared on a non-null handle), a refused-reopen honesty case (null handle keeps the amber row), and **position preservation** — after `ArrowRight`→index 2, close→reopen→`deliver({type:'hello'})`, the last posted `state.index === 2 === the pre-close index`, proving re-sync via the handshake with nothing persisted.

**Task 2 — unplug reassign, precedence, no-leak, rapid-nav (commit `dae9dbb3`)**
- Monitor-unplug: dropping an assigned monitor (`control.setScreens([screenA])` + `fireScreensChange()`) surfaces `run-reassign-banner` ("Your monitor setup changed" + the `/monitor-setup` link); a still-matching refresh raises no banner (no false alarm).
- **Precedence**: a simultaneous closed audience window + monitor change shows the reassign banner and **suppresses** `run-reopen-audience`.
- **No-leak**: `removeEventListener('screenschange', …)` asserted on the run-exit-confirm exit AND on `wrapper.unmount()`; after a deliberate exit, advancing timers ~2s surfaces NO reopen chip (the load-bearing proof that the poll was cleared even though `closeOutputs()` leaves handles non-nulled).
- **Rapid-nav sync**: `ArrowRight`×3 / `ArrowLeft`×1 posts state messages with strictly-increasing `seq` and the correct final index (2).

## Deviations from Plan

None — plan executed as written. Chose 4 slides (plan floor was ">=3") to give both the position-preserved and rapid-nav paths a deterministic runway; documented in decisions.

## Gate Results

- `npx vitest run src/views/__tests__/RunControlView.output.test.ts` — **24 passed** (12 pre-96 + 12 new).
- `npm run type-check` (vue-tsc --build) — **clean** (no OOM; no `NODE_OPTIONS` bump needed; no `Array.prototype.at`).
- `npx vitest run` (bare, per CLAUDE.md) — **166 files passed, 1 failed**: only `src/storage.rules.test.ts` (25 timeouts, Storage-emulator dependent — the documented baseline). No `--dir src` used. `npm run test:rules` NOT run (no rules change; suite is client-only).
- The wider RunControlView suite and the output-window regression stayed green.

## Client-Only Confirmation

The suite imports no `firebase`/`firestore`/emulator module and asserts no server path; R273/R274 recovery is proven purely via BroadcastChannel + localStorage + fake windows/screens/timers. Threat mitigations T-96-11 (leaked poll/listener), T-96-12 (false recovered claim), T-96-13 (position loss), T-96-14 (false-alarm/missed reassign), T-96-15 (client-only line) all have dedicated assertions.

## Known Stubs

None.

## Self-Check: PASSED
- `src/views/__tests__/RunControlView.output.test.ts` — FOUND (24 tests pass)
- Commit `40f5d2c1` (Task 1) — FOUND
- Commit `dae9dbb3` (Task 2) — FOUND
