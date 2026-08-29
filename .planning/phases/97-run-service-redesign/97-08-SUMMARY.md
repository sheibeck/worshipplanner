---
phase: 97-run-service-redesign
plan: 08
subsystem: run-control
tags: [run-service, composable, live, blackout, rehearse, timers, filmstrip, R276, R277, R280, R281, R282, R283]
dependency_graph:
  requires:
    - "97-01 (useRunControl extraction — the composable being extended)"
    - "97-04 (useRunTimers — clock/elapsed/startElapsed/resetElapsed)"
  provides:
    - "useRunControl live flag (R277) + blackout state + postBlackout + B key (R280)"
    - "useRunControl rehearse() — live without opening windows (R283)"
    - "useRunControl timer wiring (R281) + readiness/label/open/position/progress/filmstrip derivations (R276/R282)"
  affects:
    - "97-09 (RunControlView redesign — pure wiring consuming this extended surface)"
    - "97-10 (behavioural coverage of live/blackout/rehearse)"
tech-stack:
  added: []
  patterns:
    - "seq-advance-before-post so runChannel's monotonic stale-drop accepts a state change (postBlackout mirrors resendCurrent)"
    - "honest live flag set only by real go-live/rehearse, never derived from outputStatus"
    - "readiness derived from slide.renderState (undefined = drawable), never CCLI"
    - "additive return extension — no existing binding removed, so the old template stays green"
key-files:
  created: []
  modified:
    - src/composables/useRunControl.ts
decisions:
  - "postBlackout advances seq BEFORE postState (mirrors resendCurrent) so the projector actually blacks out; a bump-less post is swallowed by runChannel's stale-drop (T-97-08-01)."
  - "live is set true ONLY in openPlaced/openUnplaced (past the bothOpened gate) and rehearse(); partial/blocked never set it (owner fix #4 — no false live)."
  - "rehearse() opens NO window (no openPlaced/openUnplaced/openWindow/getScreenDetails); outputStatus stays idle, displays dots stay amber (T-97-08-02)."
  - "positionLabel enriched to 'Item X of N · slide Y of M' (per orchestrator directive) to close the 97-09 header wiring gap; format is free (no test asserts it yet — 97-10 owns behavioural coverage)."
  - "Exposed serviceName, itemCount, expandedSlides, and audience/confidence {open,label} objects to close the plan-checker-flagged 97-09 wiring gaps directly in the composable."
metrics:
  duration_sec: 900
  completed: 2026-08-29
  tasks: 2
  files: 1
status: complete
---

# Phase 97 Plan 08: Wire Run Features into useRunControl Summary

Extended `src/composables/useRunControl.ts` (the Phase 92–96 control brain) with every control-side FEATURE the redesigned template (97-09) needs, so 97-09 is pure wiring: the honest live flag (R277), blackout state + `postBlackout` + the B key (R280), rehearse-without-screens (R283), the clock/elapsed timers (R281), and the pre-flight readiness + in-item filmstrip + header/transport derivations (R276/R282). All new bindings are ADDED to the return; the still-old template renders none of them, so the pre-97 control suites stay green untouched.

## New exposed surface (for 97-09)

- **Live + blackout + timers:** `live`, `blackout`, `postBlackout(v)`, `rehearse()`, `clock`, `elapsed`.
- **Readiness (R276, honest from `slide.renderState`):** `slideCount`, `itemCount`, `renderedCount`, `allRendered`.
- **Monitor labels + open flags:** `audienceLabel`, `confidenceLabel` (from `loadMapping()` fingerprint first colon-segment), `audienceOpen`, `confidenceOpen` (`placed|fallback && !closed`), plus `audience`/`confidence` `{ open, label }` objects for `RunDisplaysPanel`.
- **Filmstrip (R282) + rail expansion:** `filmstrip` (`{ slides, indices }`), `filmstripSlides`, `filmstripIndices`, `filmstripCurrentIndex`, and `expandedSlides` (`{ arrayIndex, label, isCurrent }[]` for `RunRail`).
- **Header/transport derivations:** `serviceName`, `positionLabel` ("Item X of N · slide Y of M"), `progress` (0–100), `openManage()` (new tab).

Every prior binding (`serviceHeading`, `railRows`, `jumpToSlot`, `goBySlide`, `goByItem`, `postIndex`, the open state machine, the Phase-96 recovery surface, exit-confirm, etc.) is preserved unchanged.

## Behaviour wired

- **live (R277):** `const live = ref(false)`, set true in `openPlaced` (after `outputStatus='placed'`) and `openUnplaced` (after `'fallback'`) — both PAST the `bothOpened()` gate so `partial`/`blocked` never set it — and in `rehearse()`; reset to false in `confirmExit`. Never derived from `outputStatus`.
- **blackout (R280):** `const blackout = ref(false)`; `postIndex`/`resendCurrent` now post `blackout: blackout.value` (default false preserves the existing `{ blackout:false }` post assertions). `postBlackout(v)` sets `blackout.value`, then (guard `index != null`) `seq += 1` then `handle?.postState({ index, blackout, seq })` — mirrors `resendCurrent`'s seq-advance-then-post so runChannel's stale-drop accepts it (T-97-08-01). The reserved `B`/`b` key in `handleKeydown` calls `postBlackout(!blackout.value)`; the existing early returns keep it inert in the exit dialog and text inputs.
- **rehearse (R283):** sets `live=true`, `startElapsed()`, and (if `index==null` and slides exist) `postIndex(0)`. Calls NONE of `openPlaced`/`openUnplaced`/`openWindow`/`getScreenDetails`, so NO `window.open` fires; `outputStatus` stays `idle` (T-97-08-02).
- **timers (R281):** `useRunTimers()` wired; `startElapsed()` on go-live success AND rehearse; `resetElapsed()` in `confirmExit`.

## Deviations from Plan

**1. [Orchestrator directive — enrichment] `positionLabel` format + extra exposed bindings**
- The plan Task 2 defined `positionLabel` as `${index+1} of ${slideCount}`. The orchestrator prompt directed the richer "Item X of N · slide Y of M" (item position + slide-within-item) to close the 97-09 header wiring gap. Implemented the richer format. No test asserts the string (97-10 owns behavioural coverage), so this is free.
- Also exposed `serviceName`, `itemCount`, `expandedSlides`, `audience`/`confidence` `{ open, label }` objects, `filmstripCurrentIndex`, and `filmstripSlides`/`filmstripIndices` — the plan-checker-flagged 97-09 wiring gaps — so 97-09 needs minimal derivation. These are additive return keys; no behaviour change to existing bindings.

No Rule 1–4 code deviations. No auth gates. No package installs.

## Known Stubs
None. The bindings are honest: readiness reads `slide.renderState`, `live` reflects a real go-live/rehearse, labels read the saved mapping. The composable is intentionally unconsumed by the still-old template (97-09 owns wiring) — by design, not a stub.

## Threat surface
Faithful to the plan's `<threat_model>`: postBlackout advances seq before posting (T-97-08-01), rehearse opens no window (T-97-08-02), readiness is renderState-honest (T-97-08-03). No new trust boundary introduced beyond the register.

## Gate results
- `npm run type-check` (`vue-tsc --build`, typechecks tests too): **clean**, no errors (no `Array.prototype.at`).
- `npx vitest run src/views/__tests__/RunControlView.test.ts src/views/__tests__/RunControlView.output.test.ts`: **37/37 passed** with NO edits — the seq `[0,1,2,1]` progression and default `{ blackout:false }` posts hold.
- `npx vitest run` (bare, correct scoped command): **169 files passed | 1 failed** — the ONLY failure is `src/storage.rules.test.ts` (25 Storage-emulator tests, firebase-js-sdk#6803), the exact documented baseline. Not chased. No `--dir src`.
- Grep gates: `postBlackout` / `function rehearse` / `blackout: blackout.value` present; `allRendered` / `filmstrip` / `openManage` / `renderState === undefined` present; NO hard-coded `blackout: false` remains.

## Self-Check: PASSED
- FOUND: src/composables/useRunControl.ts (modified)
- FOUND commit: 23f9316f (feat 97-08 — composable extension)
