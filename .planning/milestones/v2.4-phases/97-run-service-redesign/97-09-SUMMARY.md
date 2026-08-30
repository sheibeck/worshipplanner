---
phase: 97-run-service-redesign
plan: 09
subsystem: ui
tags: [vue, run-control, presentation, broadcastchannel, live-presentation]

# Dependency graph
requires:
  - phase: 97-08
    provides: useRunControl composable surface (live/blackout/postBlackout/rehearse, clock/elapsed, pre-flight readiness, filmstrip/rail expansion, positionLabel/progress, openManage, audience/confidence objects)
  - phase: 97-04
    provides: RunHeader / RunPreflightPanel presentational children + prop/emit contracts
  - phase: 97-05
    provides: RunRail / RunPreviewPair / RunFilmstrip presentational children
  - phase: 97-06
    provides: RunTransportBar / RunDisplaysPanel presentational children
provides:
  - "RunControlView redesigned into pre-flight (State A) / live (State B) states driven by `live`"
  - "Seven presentational children wired to the 97-08 composable surface"
  - "The Phase 92-96 output-status cluster + recovery banner band preserved INLINE verbatim (output.test.ts green unedited)"
  - "Black/Clear output panel (R280), in-item filmstrip (R282), rehearse entry (R283), green-when-live (R277), clock/elapsed (R281)"
affects: [97-10, run-service-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State gating: !live -> State A, live -> State B; RunHeader + inline status/banner band render in BOTH (driven by outputStatus/recovery refs, NOT by live)"
    - "Testid-preservation contract: the tested honesty surface stays INLINE in the parent verbatim; presentational children are additive; only run-go-live-btn relocates (found by testid regardless of location)"
    - "Single-writer wiring: every child emit routes to a useRunControl function; no child posts to the channel"

key-files:
  created: []
  modified:
    - src/views/RunControlView.vue
    - src/views/__tests__/RunControlView.test.ts

key-decisions:
  - "Kept the output-status cluster + banner band inline in RunControlView verbatim rather than delegating to RunDisplaysPanel, so RunControlView.output.test.ts passes with zero edits"
  - "State B is unreachable pre-live, so the dual-preview control test enters live via run-rehearse-btn (no window.open) before asserting the previews"
  - "Nocturne palette applied as local CSS vars on the .run-root scope only; the app is not rethemed"

patterns-established:
  - "Pre-flight vs live state split gated by a single `live` ref; presentational-child wiring with intent-only emits"

requirements-completed: [R276, R277, R280, R281, R282, R283]

coverage:
  - id: D1
    description: "State gating by `live`: State A (pre-flight, RunPreflightPanel + rail) when !live; State B (preview split, filmstrip, Black/Clear, displays, transport) when live; RunHeader + inline status/banner band render in both"
    requirement: R276
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.test.ts#shows the current slide and the next slide, and \"End of service\" past the last slide"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts (25 tests — inline status cluster + banner band preserved)"
        status: pass
    human_judgment: false
  - id: D2
    description: "run-go-live-btn relocated into RunPreflightPanel; every tested output-status/recovery testid preserved inline so output.test.ts passes unedited"
    requirement: R277
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#does NOT call window.open on mount, shows run-go-live-btn, and claims nothing opened"
        status: pass
    human_judgment: false
  - id: D3
    description: "Black/Clear output panel (R280), in-item filmstrip (R282), rehearse (R283), green-when-live status (R277), clock/elapsed (R281) wired to the composable"
    requirement: R280
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.test.ts (12 tests, control suite) + output.test.ts (25 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full redesign on real hardware — pre-flight -> go-live feel, timers, filmstrip navigation, blackout, overall run/stop experience"
    verification: []
    human_judgment: true
    rationale: "Visual/hardware behaviour (multi-monitor go-live, timers ticking, blackout on real projector) cannot be proven by jsdom unit tests; deferred to the v2.4 DEFERRED-HUMAN-UAT set"

# Metrics
duration: 12min
completed: 2026-08-29
status: complete
---

# Phase 97 Plan 09: RunControlView Template Redesign Summary

**RunControlView redesigned into pre-flight (State A) / live (State B) states, wiring all seven presentational children to the 97-08 useRunControl surface while preserving every Phase 92-96 output-status/recovery testid inline so output.test.ts stays green unedited.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T06:02:12Z
- **Completed:** 2026-08-29T06:14:23Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Two-state layout gated by `live`: **State A** (`v-if="!live"`) renders `<RunPreflightPanel>` (the relocated `run-go-live-btn` lives here) beside `<RunRail>`; **State B** (`v-else`) renders `<RunPreviewPair>` + `<RunFilmstrip>` + the Black/Clear Output panel + `<RunDisplaysPanel>`, with `<RunRail>` on the left and `<RunTransportBar>` beneath.
- `<RunHeader>` renders in **both** states (green-when-live status, `run-service-name`, `run-exit-btn`, clock/elapsed, display dots).
- The entire Phase 92-96 output-status cluster (`run-status-opening/placed`, `run-output-ready/closed-*`, `run-reopen-*`, `run-*-muted`, `run-go-live-retry`) and banner band (`run-reassign-*`, `run-fallback/blocked/partial-*`) stay **inline verbatim**, driven by the unchanged `outputStatus`/recovery refs — so `RunControlView.output.test.ts` passes with **zero edits**.
- Every child emit routes to a `useRunControl` function (single-writer preserved); no `run-take`/`run-push-live` introduced.

## Full child wiring

| Child | Props (from composable) | Emits → composable |
|---|---|---|
| RunHeader (both states) | serviceHeading, live, positionLabel, clock, elapsed, audienceOpen, confidenceOpen | exit→openExitConfirm, reopen→reopenOutput, manage→openManage |
| RunRail (both states) | rows=railRows, activeIndex=currentSlotIndex, expandedSlides | jump→jumpToSlot, jump-slide→postIndex |
| RunPreflightPanel (State A) | serviceName, slideCount, itemCount, renderedCount, allRendered, audienceLabel, confidenceLabel | go-live→openOutputs, rehearse→rehearse, change-audience/confidence→openManage |
| RunPreviewPair (State B) | current, next, live | (display-only, no emit) |
| RunFilmstrip (State B) | slides=filmstripSlides, indices=filmstripIndices, currentIndex=index | jump→postIndex |
| Output panel (State B) | blackout (active state) | run-blackout-btn→postBlackout(true), run-clear-btn→postBlackout(false) |
| RunDisplaysPanel (State B) | audience, confidence, live | reopen→reopenOutput, manage→openManage |
| RunTransportBar (State B) | progress, positionLabel | prev→goBySlide(-1), next→goBySlide(1) |

The inline output-status cluster + banner band remain wired to `outputStatus`, `readyAudienceLabel`, `readyConfidenceLabel`, `blockedRole`, `audienceClosed`, `confidenceClosed`, `monitorChanged`, `reassignRole`, `reopenOutput`, `reopenReassignedOutputs`, `openOutputs`. The exit dialog and Nocturne Run-scoped palette (`--run-accent: #9184d9` local vars) are unchanged/scoped.

## Task Commits

Each task was committed atomically:

1. **Task 1: Header + State gating (RunHeader, State A pre-flight, run-go-live-btn relocation, inline status/banners preserved)** - `24b1e83e` (feat)
2. **Task 2: State B body (rail, preview pair, filmstrip, Black/Clear, displays, transport)** - `b3fb48c9` (feat)
3. **Task 3: Green-keep RunControlView.test.ts (dual-preview → rehearse-first)** - `97d2c715` (test)

## Files Created/Modified
- `src/views/RunControlView.vue` - Redesigned template: RunHeader + State A (RunPreflightPanel + RunRail) / State B (RunRail + RunPreviewPair + RunFilmstrip + Output panel + RunDisplaysPanel + RunTransportBar); inline output-status cluster + banner band preserved verbatim, gated by `live`; script binds the 97-08 composable surface; Nocturne Run-scoped palette on `.run-root`.
- `src/views/__tests__/RunControlView.test.ts` - The dual-preview block reworked to click `run-rehearse-btn` (enter live without windows) before asserting the previews + "End of service"; all other blocks unchanged.

## Which single pre-97 test changed and why
Only the **dual-preview block** of `RunControlView.test.ts` changed. In the redesign the program/next-up previews (`run-current-preview`/`run-next-preview`) live in **State B**, which is unreachable before go-live/rehearse. The block now clicks `run-rehearse-btn` first (which sets `live=true` **without** opening any output window), then makes the identical assertions. Running the control suite before the edit confirmed **exactly one** failing test (11/12 passing) — the escape hatch (a second broken block would signal a source testid-preservation miss) was **not** triggered.

## Decisions Made
- Kept the tested honesty surface (output-status cluster + banner band) inline in the parent verbatim rather than moving it into RunDisplaysPanel, honoring the preservation contract.
- State B is unreachable pre-live, so the dual-preview test enters live via `run-rehearse-btn` (no window.open) — the plan's single sanctioned test change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The full suite (`npx vitest run`) reports only `src/storage.rules.test.ts` failing (25 emulator-absent timeouts) — the documented environment-limitation baseline per CLAUDE.md, not a regression.

## Gate Results
- `npm run type-check` (vue-tsc --build, typechecks tests too): **clean**.
- `npx vitest run src/views/__tests__/RunControlView.test.ts src/views/__tests__/RunControlView.output.test.ts`: **37/37 pass**.
- `RunControlView.output.test.ts`: **UNEDITED** (empty diff vs 97-08 HEAD) and **passing (25/25)**.
- `npx vitest run` (bare, full app suite): **169 files / 4632 tests pass**; only `src/storage.rules.test.ts` fails (documented Storage-emulator baseline). No `--dir src` used.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The real RunControlView now presents both states with full child wiring; 97-10 can add the new behavioural coverage against the wired view.
- HUMAN-UAT deferred (v2.4 DEFERRED-HUMAN-UAT): the full redesign on real hardware — pre-flight → go-live feel, timers, filmstrip navigation, blackout, overall run/stop experience.

## Self-Check: PASSED
- Files verified on disk: `src/views/RunControlView.vue`, `src/views/__tests__/RunControlView.test.ts`, `97-09-SUMMARY.md`.
- Commits verified in git: `24b1e83e`, `b3fb48c9`, `97d2c715`.

---
*Phase: 97-run-service-redesign*
*Completed: 2026-08-29*
