---
phase: 97-run-service-redesign
plan: 04
subsystem: run-control
tags: [run-service, presentational-components, timers, vue3, R281, R277, R276]
dependency_graph:
  requires: ["97-01 (useRunControl surface, wave 1)"]
  provides:
    - "useRunTimers() composable — clock + elapsed-since-go-live"
    - "RunHeader.vue — presentational State-B header"
    - "RunTransportBar.vue — presentational transport bar"
  affects: ["97-09 (RunControlView wiring consumes all three)"]
tech-stack:
  added: []
  patterns:
    - "Composable single self-clearing setInterval (onMounted create / onUnmounted clear)"
    - "padStart-based time formatting (no Array.prototype.at)"
    - "Pure props-in/emits-out presentational components with Run-scoped CSS-var palette"
    - "Fake-timer harness component (defineComponent + captured API closure)"
key-files:
  created:
    - src/composables/useRunTimers.ts
    - src/components/run/RunHeader.vue
    - src/components/run/RunTransportBar.vue
    - src/components/run/__tests__/useRunTimers.test.ts
  modified: []
decisions:
  - "RunHeader displays dots are buttons emitting reopen(role) on click — satisfies the reopen emit contract and lets a closed display be reopened from the header cluster."
  - "Live status is driven ONLY by the `live` prop, never derived from an output-status machine, honoring owner fix #4 (never a pre-live red)."
metrics:
  duration_sec: 1788
  completed: 2026-08-29
  tasks: 3
  files: 4
status: complete
---

# Phase 97 Plan 04: useRunTimers + RunHeader + RunTransportBar Summary

Built the timer composable and two pure presentational State-B chrome components the Run-control redesign consumes — a wall clock + elapsed-since-go-live timer (R281), the honest green-when-live header (R277), and the prev/next + keyboard-legend + progress transport bar (R276) — all disjoint NEW files with no parent edit, ready to wire into RunControlView in 97-09.

## What was built

### `src/composables/useRunTimers.ts` (R281)
- Exports `useRunTimers()` returning `{ clock, elapsed, startElapsed, resetElapsed }`.
- ONE ~1s `setInterval` created in `onMounted` (after an immediate `tick()`), cleared and null-guarded in `onUnmounted` — mirrors the stopRecoveryWatchers clearInterval discipline.
- `startElapsed()` is idempotent: only the FIRST call (first go-live OR rehearse) records the origin; later calls are no-ops. `resetElapsed()` clears the origin so `elapsed` returns to `00:00`.
- `elapsed` is a computed formatted string: `M:SS` (or `H:MM:SS` past an hour) via `padStart` — NO `Array.prototype.at`. `clock` is a short wall time via `toLocaleTimeString`.
- Fake-timer friendly: `advanceTimersByTime` drives both the clock and the elapsed count.

### `src/components/run/RunHeader.vue` (R277)
Pure presentation (no channel, no store, no timer logic).
- **Props (exact contract for 97-09):** `{ serviceHeading: string; live: boolean; positionLabel: string; clock: string; elapsed: string; audienceOpen: boolean; confidenceOpen: boolean }`
- **Emits:** `exit: []`, `reopen: [role: 'audience' | 'confidence']`, `manage: []`
- Live status (`run-live-status`): GREEN dot + "LIVE" only when `live`; muted/amber dot + "Not open" otherwise (owner fix #4 — never a pre-live red). Green is applied via the `run-status--live` class binding so a test can assert green-when-live.
- Renders heading (`run-service-name`), position (`run-position`), clock (`run-clock`) + elapsed (`run-elapsed`), audience/confidence dots (`run-display-dot-audience`/`-confidence`, green when open else amber), a Manage link (`run-manage-link`), and an End-service button (`run-exit-btn`, aria-label "End service (Esc)").
- Nocturne Run-scoped palette via local CSS custom properties on the root only.

### `src/components/run/RunTransportBar.vue` (R276)
Pure presentation.
- **Props (exact contract for 97-09):** `{ progress: number; positionLabel: string }` (progress 0–100)
- **Emits:** `prev: []`, `next: []`
- Previous (`run-prev-btn`) / Next (`run-next-btn`) buttons (min-h 44px), the keyboard legend (Space → Next, ↑↓ → Item, B → Black, Esc → Exit), and a progress bar (`run-progress`) whose fill width binds to `progress` + position label (`run-position-label`).
- Introduces NO `run-take` / `run-push-live` testid (single-selection contract — verified by a negative grep).

### `src/components/run/__tests__/useRunTimers.test.ts`
Fake-timer coverage via a Host harness component (mounts the composable so lifecycle hooks fire): clock non-empty after mount + updates on advance; elapsed `00:00` before start; `01:05` after `startElapsed()` + 65s; `resetElapsed()` back to `00:00`; `startElapsed()` idempotent (first origin kept). `enableAutoUnmount` proves the interval self-clears.

## Prop contracts (for 97-09 wiring)
- `RunHeader`: `serviceHeading, live, positionLabel, clock, elapsed, audienceOpen, confidenceOpen` → `@exit`, `@reopen(role)`, `@manage`.
- `RunTransportBar`: `progress, positionLabel` → `@prev`, `@next`.
- `useRunTimers`: `{ clock, elapsed, startElapsed, resetElapsed }`.

## Testids introduced / preserved
- Preserved: `run-service-name`, `run-exit-btn` (existing control-suite reads).
- New: `run-header`, `run-live-status`, `run-position`, `run-clock`, `run-elapsed`, `run-display-dot-audience`, `run-display-dot-confidence`, `run-manage-link`, `run-transport`, `run-prev-btn`, `run-next-btn`, `run-progress`, `run-position-label`.

## Verification / Gate results
- `npx vitest run src/components/run/__tests__/useRunTimers.test.ts` → 5/5 passed.
- `npm run type-check` (`vue-tsc --build`) → my three files are type-clean (grep for useRunTimers/RunHeader/RunTransportBar in the error output returns NONE). See Deviations for concurrent-plan noise.
- `npx vitest run` (bare, full suite) → Test Files 169 passed | 1 failed (170); Tests 4632 passed | 25 failed. The ONLY failing file is `src/storage.rules.test.ts` — the documented Storage-emulator baseline (emulator not running this session). No failures in any run component or my files.

## Deviations from Plan

### Out-of-scope discovery (NOT fixed — concurrent plan)
`npm run type-check` reports 5 `TS2339`/`TS2532` errors, ALL in `src/components/run/RunFilmstrip.vue` and `src/components/run/__tests__/RunFilmstrip.test.ts` — files created by a concurrent wave-2 plan (97-05/06/07), not this plan. Per the scope boundary these were left untouched; none of my three files appear in the error output. `vue-tsc --build` typechecks the whole project, so this concurrent-plan noise is expected during parallel execution and is owned by the plan that authored RunFilmstrip. Logged to `deferred-items.md`.

No Rule 1–4 deviations in this plan's own files. No auth gates.

## Known Stubs
None. All three components are complete for their presentational contract; they are intentionally unwired (97-09 owns wiring) which is the plan's design, not a stub.

## Self-Check: PASSED
- FOUND: src/composables/useRunTimers.ts
- FOUND: src/components/run/RunHeader.vue
- FOUND: src/components/run/RunTransportBar.vue
- FOUND: src/components/run/__tests__/useRunTimers.test.ts
- FOUND commit c56df079 (Task 1), 1a8f4a24 (Task 2), 5c5a6885 (Task 3)
