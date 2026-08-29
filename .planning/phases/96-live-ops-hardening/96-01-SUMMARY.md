---
phase: 96-live-ops-hardening
plan: 01
subsystem: ui
tags: [vue, run-mode, output-windows, screenschange, live-ops, recovery]

# Dependency graph
requires:
  - phase: 95-run-control
    provides: "RunControlView output-window orchestration (openWindow/openPlaced/openUnplaced/openOutputs), the honest OutputStatus state machine, the WR-01/WR-02 guards, and the hello→resendCurrent handshake"
  - phase: 92-monitor-configuration-screen
    provides: "MonitorSetupView ScreenDetailsLike + screenschange add/remove idiom, /monitor-setup route"
provides:
  - "Closed-output detection: a single shared ~1s latch-only poll reading outputWindows[name]?.closed into audienceClosed/confidenceClosed"
  - "Per-role synchronous reopen (reopenOutput) reusing the held liveScreenDetails — no fresh getScreenDetails, clears the closed flag only on a non-null handle"
  - "Monitor-unplug detection: held Go-live ScreenDetails + typeof-guarded screenschange listener → matchMapping → monitorChanged/reassignRole"
  - "Single-teardown stopRecoveryWatchers() wired into confirmExit (before closeOutputs) and onUnmounted"
  - "Amber per-role closed rows in the placed cluster + a first-class run-reassign-banner, with reassign-wins precedence"
affects: [96-02, live-ops-uat, run-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Latch-only recovery flags cleared only by a proven-successful action (honesty rule)"
    - "Hold-and-listen on a Go-live ScreenDetails after the WR-01 stale guard, torn down exactly once in both existing teardown sites"

key-files:
  created: []
  modified:
    - "src/views/RunControlView.vue"

key-decisions:
  - "Closed detection does NOT extend OutputStatus — the cluster stays 'placed'; only the affected per-output line turns amber (96-UI-SPEC §A)"
  - "reopenOutput is synchronous (reuses held liveScreenDetails.screens) so it needs no new stale-resolution token; the original openOutputs().then WR-01 guard is left fully intact"
  - "Reassign-wins precedence: while monitorChanged the reopen chip is suppressed via && !monitorChanged (reassigning is the superset action)"
  - "Optional 'Reopen & replace {role}' secondary action omitted per the planned in-spec UI deviation; reassignment routes through the shipped /monitor-setup flow"
  - "Client-only: no Firestore doc, no firestore.rules change, no localStorage index write, no heartbeat — R273 satisfied by the UNCHANGED handshake"

patterns-established:
  - "stopRecoveryWatchers() clears the interval + removes the screenschange listener, null-guarded for a safe double call from confirmExit then onUnmounted"

requirements-completed: [R273, R274]

coverage:
  - id: D1
    description: "Closed-output detection: single shared latch-only ~1s poll latches audienceClosed/confidenceClosed from a try/catch-guarded outputWindows[name]?.closed read; closed detection adds no OutputStatus value"
    requirement: "R274"
    verification: []
    human_judgment: true
    rationale: "Behavioral fake-timer coverage lands in 96-02; real close→detect is human-UAT (actually closing an output mid-service)"
  - id: D2
    description: "Per-role reopen (reopenOutput) re-opens ONE role from the held liveScreenDetails.screens, clears the closed ref only on a non-null handle, and re-syncs to the current slide via the unchanged hello→resendCurrent handshake (no position persisted)"
    requirement: "R274"
    verification: []
    human_judgment: true
    rationale: "Position-preserved handshake + null-handle honesty assertions authored in 96-02; real reopen-onto-the-right-monitor with the current slide intact is human-UAT"
  - id: D3
    description: "Monitor-unplug detection: held Go-live ScreenDetails + typeof-guarded screenschange listener → matchMapping → monitorChanged + reassignRole; a still-matching change raises no false alarm"
    requirement: "R274"
    verification: []
    human_judgment: true
    rationale: "screenschange-listener fake + no-false-alarm coverage lands in 96-02; physical monitor unplug is human-UAT"
  - id: D4
    description: "Amber per-role closed rows in the placed cluster (run-output-closed-{role} + run-reopen-{role} + place-is-safe reassurance) and a first-class run-reassign-banner (Your monitor setup changed + /monitor-setup link), with reassign-wins precedence suppressing the reopen chip"
    requirement: "R274"
    verification: []
    human_judgment: true
    rationale: "UI-checker + 96-02 render assertions verify markup/precedence; amber-never-red calm-recovery UX is a visual human judgment"
  - id: D5
    description: "Endurance/single-teardown: stopRecoveryWatchers() clears the poll + removes the listener, called in confirmExit (before closeOutputs) AND onUnmounted, null-guarded for the double call — no reopen chip re-surfaces for a deliberately-closed window after exit"
    requirement: "R274"
    verification: []
    human_judgment: true
    rationale: "No-leak-on-exit+unmount assertions authored in 96-02; a full realistic-length service with no accumulation is human-UAT"

# Metrics
duration: 24min
completed: 2026-08-28
status: complete
---

# Phase 96 Plan 01: Live-Ops Hardening Summary

**RunControlView now survives a mid-service output close (single latch-only ~1s poll + synchronous per-role reopen that re-syncs via the unchanged handshake) and a monitor unplug (held Go-live ScreenDetails + typeof-guarded screenschange → matchMapping → amber reassign banner), with both recovery watchers torn down exactly once in confirmExit + onUnmounted — client-only, no Firestore touched.**

## Performance

- **Duration:** 24 min
- **Tasks:** 2
- **Files modified:** 1 (src/views/RunControlView.vue)

## Accomplishments
- Closed-output detection via a SINGLE shared ~1s latch-only setInterval (started once at the openPlaced/openUnplaced tails), reading a try/catch-guarded `outputWindows[name]?.closed` into per-output refs — the cluster stays `placed`, only the affected line turns amber.
- Synchronous `reopenOutput(role)` reusing the HELD `liveScreenDetails.screens` via the existing `resolveScreen` + `openWindow` (no fresh `getScreenDetails`), clearing the closed flag ONLY on a non-null handle; position restored purely by the unchanged `hello → resendCurrent` handshake (nothing persisted).
- Monitor-unplug detection: the Go-live `ScreenDetails` is held and a typeof-guarded `screenschange` listener is attached INSIDE `openOutputs().then` AFTER the WR-01 stale guard; `onScreensChange` re-runs `matchMapping` and sets `monitorChanged` + the affected `reassignRole` (a still-matching change clears it — no false alarm).
- `stopRecoveryWatchers()` clears the interval AND removes the listener (null-guarded), called in BOTH `confirmExit` (before `closeOutputs`) and `onUnmounted` — the load-bearing endurance fix, since `closeOutputs()` never nulls `outputWindows`.
- Template: amber per-role closed rows (`run-output-closed-{role}` + `run-reopen-{role}` + reassurance sub-label) inside the placed cluster, and a first-class `run-reassign-banner` ("Your monitor setup changed" + `/monitor-setup` link); reassign-wins precedence via `&& !monitorChanged`.

## Task Commits

Each task was committed atomically:

1. **Task 1: closed-poll + per-role reopen + monitor-unplug listener + single-teardown cleanup (script)** - `bb9236ce` (feat)
2. **Task 2: amber closed rows + reassign banner + precedence (template)** - `bc225aef` (feat)

## Files Created/Modified
- `src/views/RunControlView.vue` - Script: `ScreenDetailsLike` interface, recovery refs (audienceClosed/confidenceClosed/monitorChanged/reassignRole), `readClosed`/`startClosedPoll`/`reopenOutput`/`onScreensChange`/`stopRecoveryWatchers`, `startClosedPoll()` grafted into openPlaced/openUnplaced tails, the hold+attach graft inside `openOutputs().then` (param widened to `ScreenDetailsLike`), and teardown in confirmExit + onUnmounted. Template: the amber closed rows in the placed cluster and the reassign banner in the banner band.

## Decisions Made
None beyond the plan — executed exactly as specified, including the two PLANNED in-spec UI choices (reassignRole names the specific missing role when resolvable, else "audience or confidence"; the optional "Reopen & replace {role}" secondary action omitted in favor of the /monitor-setup flow).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Both gates were clean on the first run of each task.

## User Setup Required
None - no external service configuration required. Client-only change; `npm run test:rules` not required (no firestore.rules change).

## Gate Results
- `npm run type-check` (vue-tsc --build, typechecks test files too): **clean** after both tasks. No `Array.prototype.at` used.
- `npx vitest run`: **1 failed file only — `src/storage.rules.test.ts`** (the known Storage-emulator baseline per CLAUDE.md), 166 files / 4593 tests passing. The pre-96 `RunControlView.output.test.ts` stayed green (the screenschange addEventListener is typeof-guarded against the old `{ screens }`-only fake; the closed poll reads a `closed` field the old FakeWin lacks → `undefined` → never latches). No `--dir src`; `test:rules` not run.

## Next Phase Readiness
- 96-02 authors the behavioral coverage (fake-timer poll tests, the screenschange-listener fake, the position-preserved handshake assertion, the no-leak-on-exit+unmount assertions, and the client-only re-confirmation). The script exports everything those tests need: `audienceClosed`/`confidenceClosed`/`monitorChanged`/`reassignRole`/`reopenOutput` plus the testids `run-output-closed-{role}`/`run-reopen-{role}`/`run-reassign-banner`.
- Human-UAT (deferred to milestone end): real close→one-click-reopen onto the right monitor with the current slide intact; physical monitor unplug + reassign; a full realistic-length service with no sync lag or teardown accumulation.

## Self-Check: PASSED

---
*Phase: 96-live-ops-hardening*
*Completed: 2026-08-28*
