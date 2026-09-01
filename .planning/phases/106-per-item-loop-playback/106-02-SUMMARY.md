---
phase: 106-per-item-loop-playback
plan: 02
subsystem: ui
tags: [vue, typescript, run-control, composable, broadcastchannel]

# Dependency graph
requires:
  - "106-01: MediaAttachableSlot.loop?: { enabled, intervalSeconds } — additive, absent-safe, no migration"
provides:
  - "useLoopTimer.ts — the single-active-timer primitive (arm disarms-first, onUnmounted disarm, isArmed for tests)"
  - "useRunControl.ts: clampInterval / currentLoopSlot / advanceLoop / reconcileLoop — the run-time per-item loop timer wired through postIndex/postBlackout/watch(currentSlotIndex)/watch(live)"
  - "RailRow.loop?: boolean — the optional Run-rail 'Loop' badge pass-through"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-place-decides arm/disarm: reconcileLoop() is the SOLE function that decides whether the loop timer should be running, called from every state transition that could change the answer (postIndex, postBlackout, watch(currentSlotIndex), watch(live)) — never duplicated arm/disarm logic at each call site."
    - "Self-rescheduling single interval: useLoopTimer.arm() always disarm()s first, so re-arming from within reconcileLoop (called after every postIndex, including the loop's own tick) never accumulates a second live interval — this is also what makes a manual nav mid-interval restart the clock for free."

key-files:
  created:
    - src/composables/useLoopTimer.ts
    - src/views/__tests__/RunControlView.loop.test.ts
  modified:
    - src/composables/useRunControl.ts
    - src/components/run/RunRail.vue
    - src/components/run/__tests__/RunRail.test.ts

key-decisions:
  - "Loop advance wraps WITHIN the current item's filmstrip only (global indices from filmstrip.value.indices), never calling goByItem — matches 106-CONTEXT.md's explicit 'loop back to the item's FIRST slide, never into the next item' decision."
  - "'Go to black' PAUSES the loop (disarm on blackout=true) and restoring RESUMES it (re-arm on blackout=false) — the explicit 106-CONTEXT.md decision, verified against fake.posted state messages on a matched go-live with BOTH output windows open, not just the control screen (R308 #4)."
  - "Gate arming on `live` (not on whether output windows are open) so Rehearse mode gets on-screen loop parity too, per ARCHITECTURE Feature 5 — the loop is otherwise indistinguishable from a manual next-slide from the channel's point of view."
  - "clampInterval() clamps a (possibly hand-edited/persisted) intervalSeconds to 1–3600, falling back to 10 on a non-finite value, before every arm (T-106-05)."
  - "The optional Run-rail 'Loop' badge was kept (Task 3) — it stayed a clean boolean pass-through (RailRow.loop?: boolean set from item.slot.loop?.enabled ?? false) exactly as the UI-SPEC's drop-if-costly gate allowed."

patterns-established:
  - "useLoopTimer.ts is a small, reusable single-active-timer composable (arm/disarm/isArmed) that any future single-timer Run-control concern can reuse rather than hand-rolling its own setInterval/clearInterval pair."

requirements-completed: [R306, R308]

coverage:
  - id: D1
    description: "useLoopTimer holds exactly ONE interval id; arm() disarms any prior interval first; onUnmounted(disarm) guarantees no leak on route-away/unmount."
    requirement: "R308"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RunControlView.loop.test.ts#RunControlView — per-item loop (R306/R308) > unmounting the view while looping clears the timer — advancing 60s afterward posts nothing further and raises no error (R308)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A looping multi-slide item auto-advances on its interval and, from the last slide, wraps to the item's FIRST global index — never into the next item."
    requirement: "R306"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.loop.test.ts#RunControlView — per-item loop (R306/R308) > auto-advances 0→1→2 then wraps to the item FIRST slide, never leaving slotIndex 0 (R306)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A single-slide looping item is a harmless no-op — the timer never arms."
    requirement: "R306"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.loop.test.ts#RunControlView — per-item loop (R306/R308) > a single-slide looping item never auto-advances (the timer never arms) across 30s"
        status: pass
    human_judgment: false
  - id: D4
    description: "A manual nav mid-interval restarts the interval from the new position — the next auto-advance is a full interval later, never fighting a stale tick."
    requirement: "R308"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.loop.test.ts#RunControlView — per-item loop (R306/R308) > a manual nav mid-interval restarts the clock — the next auto-advance is a full interval later, never a stale leftover tick (R308)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Navigating to a non-looping item disarms the timer — no further auto-advance posts."
    requirement: "R308"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.loop.test.ts#RunControlView — per-item loop (R306/R308) > navigating to a non-looping item disarms the timer — advancing 30s produces no further auto-advance posts (R308)"
        status: pass
    human_judgment: false
  - id: D6
    description: "'Go to black' PAUSES the loop; restoring from black RESUMES it — asserted against the output-window channel (fake.posted), not just the control screen."
    requirement: "R308"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.loop.test.ts#RunControlView — per-item loop (R306/R308) > \"Go to black\" PAUSES the loop and clearing it RESUMES — verified against fake.posted on a matched go-live with BOTH output windows open (R308 #4)"
        status: pass
    human_judgment: false
  - id: D7
    description: "No regression to the existing RunControlView output/control suites; the optional Run-rail Loop badge renders per the UI-SPEC with no plumbing beyond a boolean pass-through."
    verification:
      - kind: unit
        ref: "npx vitest run src/views/__tests__/RunControlView.loop.test.ts src/views/__tests__/RunControlView.output.test.ts src/views/__tests__/RunControlView.test.ts src/components/run/__tests__/RunRail.test.ts (78/78 passing)"
        status: pass
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Human-verify the loop on real hardware with a real second display (auto-advance/wrap, manual-nav reset, item-change stop, teardown, blackout pause/resume on the physical Audience output)."
    requirement: "R308"
    verification: []
    human_judgment: true

duration: 55min
completed: 2026-09-01
status: complete
---

# Phase 106 Plan 02: Run-time per-item loop timer Summary

**A single-active-timer `useLoopTimer` composable, driven from `useRunControl.ts`, that auto-advances a looping multi-slide item on its interval, wraps to the item's FIRST slide (never into the next item), and cleanly arms/disarms through every navigation, blackout, item-change, and exit path — every advance routed through the existing `postIndex()` single-writer choke point, with "Go to black" explicitly PAUSING the loop.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-01
- **Tasks:** 3 automated (Task 4's human-hardware checkpoint deferred — see below)
- **Files modified:** 5

## Accomplishments
- `src/composables/useLoopTimer.ts` — a tiny composable owning exactly one interval id: `arm()` always `disarm()`s first (never more than one live timer), `disarm()` is idempotent, `onUnmounted(disarm)` guarantees no leak on route-away/unmount, and `isArmed` is exposed for tests.
- `useRunControl.ts` gained the run-time loop machinery: `clampInterval()` (1–3600s, fallback 10), `currentLoopSlot()`, `advanceLoop()` (wraps WITHIN the current item's filmstrip to its FIRST global index, never into another item, no-op for ≤1 slide), and `reconcileLoop()` — the ONE place that decides arm vs. disarm, wired from `postIndex()` (after every navigation — manual AND the loop's own tick), `postBlackout()` (pause/resume), `watch(currentSlotIndex)` (item change), `watch(live)` (go-live/rehearse arms, end disarms), and `endServiceTeardown()` (defensive disarm).
- `src/views/__tests__/RunControlView.loop.test.ts` — a 6-case behavioral suite covering auto-advance+wrap, the single-slide no-op, manual-nav clock reset, item-change disarm, unmount teardown, and — the R308 #4 gate — "Go to black" pause/resume asserted against `fake.posted` state messages on a matched go-live with BOTH fake output windows open (the standard output-window proof this codebase uses).
- The optional Run-rail "Loop" indicator (Task 3, drop-if-costly) shipped: `RailRow.loop?: boolean` set from `item.slot.loop?.enabled ?? false`, and a verbatim `rail-loop-badge` span in `RunRail.vue` gated on `row.loop`, with a scoped RunRail test.
- `REQUIREMENTS.md`: R306 and R308 marked complete (R306's Run-time half; R307 was already complete from 106-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: useLoopTimer composable + loop arming/advance/teardown in useRunControl** - `911c1497` (feat)
2. **Task 2: Behavioral suite — auto-advance/wrap, manual-nav reset, item-change + unmount teardown, and Go-to-black pause in an output-window context** - `4b10ed81` (test)
3. **Task 3 (drop-if-costly, kept): Optional Run-rail "Loop" indicator** - `52819382` (feat)

_Task 4 (human-verify checkpoint) is deferred per this run's execution instructions — see "Deferred Human-UAT Item" below. STATE.md/ROADMAP.md/REQUIREMENTS.md updates land in this docs commit per the executor workflow._

## Files Created/Modified
- `src/composables/useLoopTimer.ts` (new) - the single-active-timer primitive.
- `src/composables/useRunControl.ts` - loop instantiation, `clampInterval`/`currentLoopSlot`/`advanceLoop`/`reconcileLoop`, wiring into `postIndex`/`postBlackout`/`watch(currentSlotIndex)`/`watch(live)`/`endServiceTeardown`, and `RailRow.loop?: boolean`.
- `src/views/__tests__/RunControlView.loop.test.ts` (new) - the 6-case behavioral suite.
- `src/components/run/RunRail.vue` - the `rail-loop-badge` span.
- `src/components/run/__tests__/RunRail.test.ts` - a scoped test for the badge's presence/absence.

## Decisions Made
- **Advance wraps WITHIN the item only** — `advanceLoop()` operates on `filmstrip.value.indices` (the current item's global indices) and never calls `goByItem`, matching the explicit 106-CONTEXT.md "loop back to the item's first slide, NOT into the next item" decision.
- **"Go to black" PAUSES the loop, restoring RESUMES it** — `postBlackout()` calls `reconcileLoop()` after setting `blackout.value`, so a blackout-true post disarms and a blackout-false post re-arms; verified specifically against `fake.posted` on a matched go-live with both output windows open per R308 #4's explicit "verified in a real output window, not just the control screen" requirement.
- **Gate on `live`, not on outputs being open** — Rehearse mode (`live=true`, no windows) gets the same loop behavior as a real go-live, per ARCHITECTURE Feature 5's on-screen-parity note; the loop is indistinguishable from a manual next-slide from the channel's perspective (no `runChannel.ts` protocol change).
- **`reconcileLoop()` is the single decision point** — called from every place that could change the arm/disarm answer, rather than duplicating arm/disarm logic at each call site; this is also what makes a manual nav restart the clock "for free" (arming always disarms first).
- **The optional Run-rail badge was kept** (not dropped) — it stayed a clean two-line boolean pass-through exactly as the UI-SPEC's drop-if-costly gate allowed, so Task 3 shipped rather than being cut.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3/4 auto-fixes were needed; the implementation matched the plan's `<action>` blocks directly and all six behavioral cases plus the existing Run suites passed on the first test run.

## Deferred Human-UAT Item (Task 4 — NOT approved, NOT verified)

Per this execution run's explicit instructions, **Task 4 (the real-hardware / real-second-display human-verify checkpoint) was deferred rather than blocked on**. It is recorded here as a **PENDING** deferred item, not accepted or approved:

> **On a machine with a second display connected:** open a draft service, mark a multi-slide item as Loop with a short interval (e.g. 5s), Go live so the Audience output opens on the second display, and confirm: (1) auto-advance every 5s wrapping to the item's first slide (never into the next item); (2) a mid-interval arrow-key press takes effect immediately with the next auto-advance a full interval later; (3) navigating to a non-looping item stops auto-advance and returning resumes it; (4) "Go to black" stops the slides advancing behind the blackout and restoring resumes without an unexpected jump; (5) exiting Run and reopening starts clean with nothing still ticking.

This is a **batched end-of-milestone item** — the automated output-window test (`RunControlView.loop.test.ts`'s "Go to black" case, asserting `fake.posted` state on a matched go-live with both output windows open) stands as the R308 #4 evidence for this plan's completion, per this run's instructions. The real-hardware spot-check should still be performed before the v2.7 milestone is archived.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. (A real second display is needed only for the deferred Task 4 human-hardware spot-check above, not for anything in this plan's automated scope.)

## Next Phase Readiness
- R306 and R308 are both marked complete in `REQUIREMENTS.md`; R307 was already complete from 106-01. Phase 106 (per-item loop playback) is now fully built and automated-test-verified, with only the batched end-of-milestone human-hardware spot-check outstanding.
- `npm run type-check` and the full Run-control/RunRail suite (78 tests across `RunControlView.loop.test.ts`, `RunControlView.output.test.ts`, `RunControlView.test.ts`, `RunRail.test.ts`) are green.
- `useLoopTimer.ts` is a small, reusable single-active-timer primitive — any future Run-control concern needing exactly one interval (never a leak, never a duplicate) can reuse it rather than hand-rolling `setInterval`/`clearInterval` again.

---
*Phase: 106-per-item-loop-playback*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: src/composables/useLoopTimer.ts
- FOUND: src/composables/useRunControl.ts
- FOUND: src/views/__tests__/RunControlView.loop.test.ts
- FOUND: src/components/run/RunRail.vue
- FOUND: src/components/run/__tests__/RunRail.test.ts
- FOUND: .planning/phases/106-per-item-loop-playback/106-02-SUMMARY.md
- FOUND commit: 911c1497
- FOUND commit: 4b10ed81
- FOUND commit: 52819382
