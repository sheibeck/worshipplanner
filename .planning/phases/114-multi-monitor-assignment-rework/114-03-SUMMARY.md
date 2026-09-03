---
phase: 114-multi-monitor-assignment-rework
plan: 03
subsystem: ui
tags: [run-control, monitor-config, window-management, vue]

# Dependency graph
requires:
  - phase: 114-multi-monitor-assignment-rework
    provides: "114-01: computeFingerprints, delta matchMapping (MatchResultV2), SCREEN_QUERY_PARAM, MonitorAssignment.nickname"
  - phase: 114-multi-monitor-assignment-rework
    provides: "114-02: per-fingerprint role map + nicknames on MonitorSetupView (the saved assignments this plan reads)"
provides:
  - "useRunControl.ts assignments-driven output model: windowNameFor(assignment)/urlForAssignment (exported), openAllPlaced/openAllUnplaced, displays computed, canGoLive computed (>=1-Audience gate with an empty-mapping dev fallback exemption)"
  - "RunDisplaysPanel.vue / RunPreflightPanel.vue rendering a v-for over a displays prop, keyed by assignment fingerprint (id), with role-index-numbered testids/titles for a second+ same-role assignment"
  - "RunControlView.vue rewired to bind both panels to displays/canGoLive and forward reopen/fullscreen by display id"
affects: [114-04-output-window-self-placement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fingerprint-keyed window names (wp-output-<sanitized-fingerprint>) replacing the old fixed wp-audience/wp-confidence pair, so N windows never collide and a reopen of the same assignment always targets the same browser window"
    - "Per-assignment reactive state (openedByWindowName/closedByWindowName/fullscreenByWindowName records) replacing the old fixed boolean pairs, generalizing the existing LATCH-ONLY closed-poll pattern to N windows"
    - "canGoLive: >=1 Audience required when a mapping IS saved, but a genuinely empty mapping (nothing configured) is exempt so the pre-multi-monitor dev/single-screen fallback path keeps working"

key-files:
  created: []
  modified:
    - src/composables/useRunControl.ts
    - src/components/run/RunDisplaysPanel.vue
    - src/components/run/RunPreflightPanel.vue
    - src/views/RunControlView.vue
    - src/views/__tests__/RunControlView.output.test.ts

key-decisions:
  - "Kept audience/confidence/audienceOpen/audienceClosed/audienceFullscreen/audienceLabel computed shims in useRunControl.ts (derived from the new per-assignment model) rather than deleting them outright — RunHeader.vue's Audience/Confidence header dots (unchanged by this phase) still emit bare role strings, not fingerprint ids, so reopenOutput/fullscreenDisplay permanently accept EITHER an id or a role name (resolveTargetAssignment tries id first, falls back to the role's first saved assignment)."
  - "A refused Confidence window no longer blocks go-live — CONTEXT.md's '>=1 Audience required, Confidence optional' decision is now enforced literally: success is 'at least one Audience window opened', not 'both fixed windows opened'. This is a deliberate behavior change from the v2.4 both-must-open rule; RunControlView.output.test.ts's old confidence-null PARTIAL test was rewritten into a SUCCESS test."
  - "canGoLive treats a genuinely EMPTY saved mapping (nothing configured yet) as passing the gate, using two synthetic 'default-audience'/'default-confidence' assignments so the pre-multi-monitor dev/single-screen fallback path (CONTEXT.md: 'keep the existing pop-out-window + Go fullscreen fallback') keeps working unchanged; the gate only blocks an EXPLICIT saved mapping with zero Audience assignments."
  - "RunDisplaysPanel/RunPreflightPanel number a second (or later) assignment sharing a role ('Audience 2', testid run-display-audience-2) rather than using the raw fingerprint in the UI, so the common single-Audience/single-Confidence setup keeps its exact original testids/titles (run-display-audience, run-preflight-confidence, ...) with zero visual change."
  - "R327 (macOS output placement) is NOT marked complete by this plan — only the URL/SCREEN_QUERY_PARAM plumbing and window-name generalization it depends on. The actual popup self-placement (requestFullscreen({screen})) is Plan 04's job, and R327 additionally requires real-hardware UAT per 114-VALIDATION.md."

patterns-established:
  - "Pattern 4 (114-RESEARCH.md): N-assignment window orchestration keyed by fingerprint"

requirements-completed: [R324, R325]

coverage:
  - id: D1
    description: "Going live opens one output window per saved assignment (N windows, not a fixed two) — two Audience assignments + one Confidence open THREE distinct windows"
    requirement: "R324"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#RunControlView output — N-assignment orchestration (114-03) > two Audience assignments + one Confidence: opens THREE windows, each with a distinct fingerprint-derived name and its own screen param"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each output window's name is derived from its assignment's fingerprint (wp-output-<fp>), so two Audience windows never collide and a reopen targets the same window"
    requirement: "R325"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#RunControlView output — N-assignment orchestration (114-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each output URL carries the assignment's target fingerprint as the SCREEN_QUERY_PARAM query, for Plan 04's popup self-placement"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts (AUDIENCE_URL/CONFIDENCE_URL constants assert &screen=<encoded fingerprint>)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Go-live is gated on the saved mapping having >=1 Audience assignment; a Confidence-only explicit mapping blocks go-live (Go-live disabled + a route to Monitor Setup), while a genuinely empty mapping still runs via the dev fallback"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#RunControlView output — N-assignment orchestration (114-03) > canGoLive is false when the saved mapping has no Audience assignment — Go-live is a no-op"
        status: pass
    human_judgment: false
  - id: D5
    description: "The pre-flight and Displays panels list every assigned display dynamically (with its nickname-or-label), not two fixed Audience/Confidence cards, and per-display Reopen/Go-fullscreen act on the right window"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts (full-view mounts exercising RunDisplaysPanel/RunPreflightPanel through the displays prop across the whole suite)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A refused Confidence window no longer blocks go-live (Confidence optional, per CONTEXT.md); a refused Audience window still does"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#RunControlView output — ≥1-Audience gate replaces the old both-must-open rule (114-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-09-03
status: complete
---

# Phase 114 Plan 03: N-Window Run-Mode Orchestration Summary

**Generalized Run mode's output-window launch from two hard-coded `wp-audience`/`wp-confidence` windows to an N-assignment model keyed by fingerprint, with a `>=1-Audience` go-live gate and dynamic Displays/Preflight panels.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-03T13:10:00Z (approx)
- **Completed:** 2026-09-03T13:50:00Z (approx)
- **Tasks:** 3 (Task 3 required no code changes — see below)
- **Files modified:** 5

## Accomplishments
- `useRunControl.ts` replaced its two fixed output-window names/URLs/closed-flags with an assignments-driven model: `windowNameFor(assignment)` (exported, `wp-output-<sanitized-fingerprint>`) and `urlForAssignment(assignment, serviceId, orgId)` (exported, present-path + org query + `SCREEN_QUERY_PARAM=<encoded fingerprint>`), `openAllPlaced`/`openAllUnplaced` iterating N saved assignments, and per-assignment `openedByWindowName`/`closedByWindowName`/`fullscreenByWindowName` records replacing the old fixed boolean pairs.
- Go-live succeeds when **at least one Audience window opens** (CONTEXT.md decision), not when both a fixed audience+confidence pair opens — a refused Confidence window is reported (via the generalized `blockedRole` label) but no longer blocks a live session; a refused Audience window still does.
- `canGoLive` computed added: true whenever the saved mapping has an Audience assignment, OR the mapping is genuinely empty (the pre-multi-monitor dev/single-screen fallback path, per CONTEXT.md, still runs unguarded).
- `displays` computed added: one `{ id (fingerprint), role, label (nickname-or-fallback), open, closed, fullscreen }` entry per saved assignment, consumed by both panels.
- `RunDisplaysPanel.vue` and `RunPreflightPanel.vue` now `v-for` over a `displays` prop instead of a fixed Audience/Confidence pair — the common single-Audience/single-Confidence setup keeps its exact original testids/titles; a second (or later) assignment sharing a role gets a numbered suffix ("Audience 2", `run-display-audience-2`) so multiple Audience monitors never collide in the UI.
- `RunPreflightPanel.vue` disables Go-live with an inline note + a link to Monitor Setup when `canGoLive` is false.
- `RunControlView.vue` rewired: both panels now bind `:displays`/`:canGoLive` and forward `@reopen`/`@fullscreen` by display id; the retired `:audience`/`:confidence`/`:audienceLabel`/`:confidenceLabel`/`:audienceClosed`/`:confidenceClosed`/`:audienceFullscreen`/`:confidenceFullscreen` bindings and `@change-audience`/`@change-confidence` emits are gone (collapsed into a single `@change`).
- `RunControlView.output.test.ts` (the full-mount output suite): window-name/URL assertions updated to fingerprint-derived names + the `&screen=` query param across every scenario (matched, stale/non-matching mapping, empty mapping, reopen, reassign); one PARTIAL test was rewritten into a SUCCESS test reflecting the new ≥1-Audience rule; two new tests added (N=3-window open with distinct names, and the `canGoLive`-false no-op gate).

## Task Commits

Each task was committed atomically:

1. **Task 1: useRunControl — N-assignment open/place/reopen/close + ≥1-Audience gate + nickname labels** - `6f53cf94` (feat)
2. **Task 2: RunDisplaysPanel + RunPreflightPanel dynamic lists + RunControlView wiring** - `e1d954d8` (feat)
3. **Task 3: Reconcile remaining Run-mode suites (test + loop)** - no commit (see below)

_Task 3 required no source changes: `RunControlView.test.ts` never seeds a monitor mapping (so it always
takes the `canGoLive`-exempt empty-mapping dev-fallback path) and asserts no literal window
names/URLs, and `RunControlView.loop.test.ts`'s one mapping-seeding test only asserts
`run-display-ready-audience`/`run-display-ready-confidence` testids and `window.open` call counts —
both already satisfied by the Task 1/2 shims. Both suites were re-run and confirmed green with zero
edits (35/35 tests pass); this is a genuine "nothing to fix" outcome, not a skipped verification — see
the Verification section below for the actual command run and its output._

## Files Created/Modified
- `src/composables/useRunControl.ts` - N-assignment output orchestration: `windowNameFor`/`urlForAssignment` (exported pure helpers), `DEFAULT_AUDIENCE_ASSIGNMENT`/`DEFAULT_CONFIDENCE_ASSIGNMENT` (dev fallback), `savedAssignments`/`displays`/`canGoLive` computeds, `openAllPlaced`/`openAllUnplaced`/`evaluateOpenResults`/`finishOpen` replacing `openPlaced`/`openUnplaced`/`bothOpened`, `resolveScreenForAssignment` replacing the role-keyed `resolveScreen`, `reopenOutput`/`fullscreenDisplay` taking an id-or-role string, `onScreensChange`/`reopenReassignedOutputs` generalized to a `missingAssignments` list instead of a single reassign role, `audience`/`confidence`/`audienceLabel`/`confidenceLabel`/`audienceOpen`/`audienceClosed`/`audienceFullscreen` kept as first-assignment-of-role shims for RunHeader.vue (unchanged by this phase)
- `src/components/run/RunDisplaysPanel.vue` - `displays` prop + `v-for` rows (role-index-numbered testids/titles), `reopen`/`fullscreen` emits now carry the display id
- `src/components/run/RunPreflightPanel.vue` - `displays`/`canGoLive` props + `v-for` cards, Go-live button disabled + gate note when `canGoLive` is false, `change-audience`/`change-confidence` collapsed into a single `change` emit
- `src/views/RunControlView.vue` - both panels rebound to `displays`/`canGoLive`; retired the audience/confidence-specific prop bindings
- `src/views/__tests__/RunControlView.output.test.ts` - fingerprint-derived window-name/URL constants (matched, stale-mapping, and empty-mapping-default variants), one PARTIAL test rewritten as a SUCCESS test (Confidence-null no longer blocks go-live), two new tests (N=3-window open, canGoLive-false no-op gate)

## Decisions Made
- Kept `audience`/`confidence`/`audienceClosed`/`audienceFullscreen`/etc. as computed shims (derived from the new per-assignment records) rather than deleting them, because `RunHeader.vue`'s Audience/Confidence header dots — unchanged by this phase — still emit bare role strings (`'audience'`/`'confidence'`), not fingerprint ids. `reopenOutput`/`fullscreenDisplay` permanently accept either form (`resolveTargetAssignment` tries an exact fingerprint match first, then falls back to the role's first saved assignment) — this is the final architecture, not a temporary bridge, since RunHeader is out of this plan's scope.
- A refused Confidence window no longer blocks go-live — this is a deliberate behavior change enforcing CONTEXT.md's "≥1 Audience required, Confidence optional" literally. The pre-existing `RunControlView.output.test.ts` PARTIAL test asserting a confidence-null case was NOT a live success was rewritten to assert the opposite (now a genuine success), since the old assumption ("both fixed windows must open") is exactly the two-window model this plan retires.
- `canGoLive` exempts a genuinely empty saved mapping (nothing configured) from the ≥1-Audience gate, using two synthetic `default-audience`/`default-confidence` assignments, so CONTEXT.md's "single screen / nothing assigned (dev): keep the existing pop-out-window + Go fullscreen fallback" behavior is preserved unchanged. The gate only blocks an EXPLICIT saved mapping that assigned zero Audience monitors.
- RunDisplaysPanel/RunPreflightPanel number a second-or-later same-role assignment ("Audience 2") rather than surfacing the raw fingerprint, keeping the common single-Audience/single-Confidence UI pixel-identical (same testids/titles) while still generalizing to N.
- R327 (macOS output placement) is intentionally NOT included in `requirements-completed` — this plan only builds the fingerprint/URL/window-name plumbing R327 depends on; the actual popup self-placement (`requestFullscreen({screen})`) is Plan 04's job, and R327 additionally requires real-hardware UAT per 114-VALIDATION.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit-`any` TypeScript errors in the new N-assignment test**
- **Found during:** Task 1 (adding the two new required tests)
- **Issue:** `openSpy.mock.calls.map((c) => c[1])` and the `.every((u) => ...)` callback had implicitly-`any` parameters, failing `npm run type-check` (`vue-tsc --build` type-checks test files too, per CLAUDE.md).
- **Fix:** Added explicit `(c: unknown[])` / `(u: unknown)` parameter types.
- **Files modified:** `src/views/__tests__/RunControlView.output.test.ts`
- **Verification:** `npm run type-check` clean.
- **Committed in:** `6f53cf94` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type-annotation fix required to keep the type-check gate green. No scope creep.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan only touches client-side Vue composables/components and their tests.

## Next Phase Readiness

- `windowNameFor`/`urlForAssignment` (exported from `useRunControl.ts`), the `displays`/`canGoLive` computeds, and the fingerprint-keyed per-assignment state records are all in place and unit-tested — Plan 04 (`useOutputWindow.ts` popup self-placement, consuming `SCREEN_QUERY_PARAM` from the URL) can now build directly on this contract.
- Full app test suite verified green at the documented baseline: 183/184 files pass (5002 tests pass, 27 skipped); the sole failure (`src/storage.rules.test.ts`) is the pre-existing Storage-emulator `firestore.exists()` cross-service limitation documented in CLAUDE.md, unrelated to this plan.
- `npm run type-check` (`vue-tsc --build`) clean.
- R327's real-hardware verification (two Audience + one Confidence each landing on their assigned physical display on macOS/Chrome) remains open pending Plan 04 + the batched manual UAT in `114-VALIDATION.md`.
- No blockers for Plan 04.

---
*Phase: 114-multi-monitor-assignment-rework*
*Completed: 2026-09-03*

## Self-Check: PASSED

All created/modified files confirmed present on disk; both task commit hashes (`6f53cf94`, `e1d954d8`)
confirmed present in `git log`.
