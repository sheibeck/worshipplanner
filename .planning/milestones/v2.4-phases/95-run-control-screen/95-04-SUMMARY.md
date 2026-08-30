---
phase: 95-run-control-screen
plan: 04
subsystem: ui
tags: [vue, window-management-api, getScreenDetails, requestFullscreen, run-mode, multi-monitor]

# Dependency graph
requires:
  - phase: 95-03
    provides: "RunControlView core — single-writer run channel, onHello resend, confirmExit seam, serviceId/orgIdRef/assembledSlideshow from useServiceAssembly"
  - phase: 91-config-channel-utilities
    provides: "loadMapping/matchMapping/computeFingerprint monitor-mapping utils"
  - phase: 92-monitor-configuration-screen
    provides: "MonitorSetupView.onDetectClick activation-preserving getScreenDetails idiom; /monitor-setup route"
provides:
  - "Explicit Go-live gesture that opens + places both output windows from a fresh transient activation"
  - "Honest output-status state machine (idle/opening/placed/fallback/blocked) gated on real non-null window.open returns"
  - "closeOutputs() teardown wired first into the exit-confirm"
affects: [95-05, 95-06, run-mode-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activation-preserving open+place: getScreenDetails() as the first statement after the feature-detect (only a synchronous ref set before it), .then runs while the click activation is live so window.open + requestFullscreen({screen}) are honored"
    - "Non-null-return gating: every 'opened/ready' claim requires an actual non-null window.open handle; both-null → honest 'blocked' state, never a false success"

key-files:
  created: []
  modified:
    - "src/views/RunControlView.vue"

key-decisions:
  - "openOutputs bound ONLY to the run-go-live-btn click, never onMounted (planned UI-SPEC divergence): a cold-first-Run onMounted open loses activation after router.push + lazy chunk import + guard + mount tick and silently opens zero windows"
  - "Added an honest 'blocked' state beyond the UI-SPEC's three states — both window.open returns null (pop-up blocked) shows a distinct amber recoverable banner with a Go live retry, never a green/amber success"
  - "Blocked banner's retry uses testid run-blocked-retry (not run-go-live-retry) because the top-bar cluster already renders run-go-live-retry simultaneously — avoids a duplicate testid"

patterns-established:
  - "Output-window orchestration seam: openWindow (null-guarded handle store) → openPlaced/openUnplaced → openOutputs (gesture entry) → closeOutputs (guarded teardown)"

requirements-completed: [R261, R266]

coverage:
  - id: D1
    description: "Go-live gesture opens + places both output windows from a fresh transient activation; getScreenDetails() is the first post-feature-detect statement (mirrors MonitorSetupView.onDetectClick); NOT called from onMounted"
    requirement: "R261"
    verification:
      - kind: manual_procedural
        ref: "Human UAT (deferred): real two-monitor open+place+fullscreen from one Go live click on Chrome/Edge; behavioral test coverage authored in 95-06"
        status: unknown
    human_judgment: true
    rationale: "Real multi-monitor placement + requestFullscreen({screen}) requires live transient activation on real hardware — jsdom returns null handles; behavioral coverage lands in 95-06, real-hardware placement is milestone-end UAT"
  - id: D2
    description: "Honest state machine (idle/opening/placed/fallback/blocked): every 'opened/ready' claim gated on a non-null window.open return; both-null → blocked, never a false success"
    requirement: "R261"
    verification:
      - kind: unit
        ref: "Authored in 95-06 (Go live → matched/needs-reprompt/blocked branches; close-on-exit)"
        status: unknown
    human_judgment: true
    rationale: "Behavioral tests are authored in wave 4 (95-06) per plan; not written in this wave"
  - id: D3
    description: "closeOutputs() guarded-.close()s each stored window, called FIRST inside confirmExit before handle.close() + router.push"
    requirement: "R266"
    verification:
      - kind: unit
        ref: "Authored in 95-06 (close-on-exit)"
        status: unknown
    human_judgment: true
    rationale: "Behavioral coverage lands in 95-06"

# Metrics
duration: 25min
completed: 2026-08-28
status: complete
---

# Phase 95 Plan 04: RunControlView Output-Window Orchestration Summary

**Explicit "Go live" gesture on RunControlView that opens + places both audience/confidence output windows from a fresh transient activation, with an honest idle/opening/placed/fallback/blocked state machine gating every "opened" claim on a real non-null window.open handle, and closeOutputs() teardown wired first into the exit-confirm.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-28
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added the Go-live gesture entry (`openOutputs`) bound ONLY to the `run-go-live-btn` click — NOT onMounted. `getScreenDetails()` is the first statement after the `'getScreenDetails' in window` feature-detect (only a synchronous `outputStatus.value='opening'` ref set before it), so its `.then` fires while the click's transient activation is live, letting `window.open` + `requestFullscreen({ screen })` act in the sanctioned one-gesture window (mirrors `MonitorSetupView.onDetectClick`).
- `openWindow` stores each `window.open` return under its stable name (`wp-audience`/`wp-confidence`), plain (no `noopener`, so the child inherits the opener sessionStorage org), and immediately null-guards it. `moveTo`/`requestFullscreen` run only on a non-null handle, both try/catch-wrapped (no throw). `openPlaced` recomputes `computeFingerprint` over the live screens to resolve role→fingerprint→`ScreenLike`.
- Honest state machine `OutputStatus = 'idle' | 'opening' | 'placed' | 'fallback' | 'blocked'`. Every "opened/ready" claim is gated on a real non-null handle: matched + ≥1 window → `placed`; un-positioned + ≥1 window → `fallback`; **both `window.open` returns null (pop-up blocked) → `blocked`** (distinct honest amber banner + Go live retry), never a green/amber success.
- Template: filled the top-bar status cluster (idle Go live button + hint, `run-status-opening` spinner, green-dot `run-status-placed` with Audience/Confidence labels, blocked compact indicator + retry), plus two mutually-exclusive banners between the top bar and main region — amber `run-fallback-banner` (heading + 3-step list + `/monitor-setup` link) and honest `run-blocked-banner`.
- `closeOutputs()` guarded-`.close()`s each stored window and is called FIRST inside `confirmExit`, before `handle?.close()` + `router.push`, replacing the 95-03 seam comment — so ending run mode blanks the projector.

## Task Commits

1. **Task 1: Go-live gesture + output open/place/close orchestration (script)** - `ae1188d0` (feat)
2. **Task 2: Go-live control + status cluster + fallback/blocked banners (template)** - `ac1ae9fd` (feat)

## Files Created/Modified
- `src/views/RunControlView.vue` - Added the output-window orchestration script block (openWindow/openPlaced/openUnplaced/openOutputs/closeOutputs, resolveScreen, OutputStatus state), wired closeOutputs into confirmExit, added orgIdRef to the assembly destructure, imported loadMapping/matchMapping/computeFingerprint/types from @/utils/monitorConfig; filled the top-bar status cluster and added the amber fallback + honest blocked banners.

## Decisions Made
- **Go live is an explicit gesture, not onMounted (planned per `<ui_spec_deviation>`):** a cold-first-Run onMounted open loses the Run click's activation after router.push + lazy route-chunk import + async guard + mount tick and would silently open zero windows while claiming success. The Go live button supplies a fresh live activation.
- **Added a fifth honest `blocked` state** beyond the UI-SPEC's matched/needs-reprompt/unavailable: both `window.open` returns null means the pop-up blocker fired; surfaced as an amber (recoverable, not red) `run-blocked-banner` with a retry that never implies success.
- **Blocked banner retry uses `run-blocked-retry` testid** (not `run-go-live-retry`) since the top-bar cluster already renders `run-go-live-retry` in the blocked state — both render simultaneously, so distinct testids avoid a duplicate id that would break `getByTestId` in 95-06.

## Deviations from Plan

None — plan executed exactly as written. The explicit Go-live gesture and the `blocked` state are PLANNED per the plan's `<ui_spec_deviation>` note, not unplanned deviations. The one authoring choice (a distinct `run-blocked-retry` testid on the banner button) resolves the plan's own "if not already rendered in the cluster, else this banner's own primary button" instruction to avoid a duplicate testid.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The output-window orchestration seam is in place; wave 4 (95-05/95-06) authors the behavioral tests (Go live → matched/needs-reprompt/blocked; close-on-exit). This wave deliberately wrote no tests.
- Real two-monitor open + place + fullscreen from one Go live click on Chrome/Edge, plus the pop-out drag+fullscreen fallback and the pop-up-blocked recovery, remain milestone-end HUMAN-UAT (mark human_needed).

## Self-Check: PASSED

- `src/views/RunControlView.vue` — FOUND
- `.planning/phases/95-run-control-screen/95-04-SUMMARY.md` — FOUND
- Commit `ae1188d0` (Task 1) — FOUND
- Commit `ac1ae9fd` (Task 2) — FOUND
- `npm run type-check` — clean (vue-tsc --build)
- `npx vitest run` — baseline only: 1 file failed (`src/storage.rules.test.ts`), 164 passed

---
*Phase: 95-run-control-screen*
*Completed: 2026-08-28*
