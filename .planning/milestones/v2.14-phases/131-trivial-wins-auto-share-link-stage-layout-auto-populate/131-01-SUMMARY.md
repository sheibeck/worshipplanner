---
phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate
plan: 01
subsystem: ui
tags: [vue, stage-layout, stage-plan, pure-function, vitest]

# Dependency graph
requires:
  - phase: 107-stage-layout
    provides: "src/utils/stageLayout.ts geometry/creation primitives (createMarker, STAGE_BAND, zoneFromPosition), the StageMarker model, and ServiceEditorView's stageServingAssignments computed"
provides:
  - "autoPopulateMarkers(servingAssignments) -> StageMarker[] pure function in src/utils/stageLayout.ts"
  - "One-time empty-canvas seed trigger (onAutoPopulateStageLayout) wired to ServiceEditorView's activeTab watch"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure geometry function (autoPopulateMarkers) kept store-free alongside the rest of src/utils/stageLayout.ts, mirroring createMarker's contract"
    - "One-time seed trigger guarded by a zero-elements check PLUS a per-service Set (in setup scope), riding the existing useAutoSave deep-watch instead of a new save call"

key-files:
  created: []
  modified:
    - src/utils/stageLayout.ts
    - src/utils/__tests__/stageLayout.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.stage.test.ts

key-decisions:
  - "Deterministic 4-column grid layout, inset 8% inside STAGE_BAND on X and clamped to y in [20, 60], row count derived from ceil(count/4) — guarantees no duplicate positions and strictly-onstage bounds regardless of roster size (Claude's discretion per plan)."
  - "Non-clobber invariant implemented with TWO guards: a zero-elements check (load-bearing — never runs against a non-empty canvas) AND a per-service seeded-guard Set (prevents re-seed after delete-all-then-revisit in the same session, since the canvas can be momentarily empty again after a manual delete)."
  - "The seeded-guard Set is only populated AFTER a successful (non-empty) seed, so an empty-assignments visit never marks the service seeded — a later visit once the roster resolves can still seed."

requirements-completed: [R420]

coverage:
  - id: D1
    description: "autoPopulateMarkers(servingAssignments) pure function: N-in/N-out incl. double-booked person, empty input, onstage bounds, no-overlap positions, roleId/roleName+personId/personName identity, determinism, no input mutation"
    requirement: "R420"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/stageLayout.test.ts#autoPopulateMarkers"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceEditorView one-time seed trigger: seeds on first empty-canvas visit to Stage Layout, persists through existing autosave, never touches a populated canvas, never re-seeds after tab revisit or delete-all-then-revisit in the same session, no-ops for a viewer/locked service, and does not seed (or mark seeded) when no assignments resolve yet"
    requirement: "R420"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.stage.test.ts#auto-populate (R420)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seeded stage layout is visually plausible (legible, spread across the stage, not piled up) and a human confirms drag-and-revisit never re-seeds or clobbers a manual placement"
    requirement: "R420"
    verification: []
    human_judgment: true
    rationale: "Visual/UX plausibility of the seeded geometry is a judgment call the plan's Task 3 checkpoint explicitly reserves for a human; deferred to milestone-end batched UAT per owner instruction (2026-09-07)."

# Metrics
duration: ~20min
completed: 2026-09-07
status: complete
---

# Phase 131 Plan 01: Stage Layout Auto-Populate Summary

**Pure `autoPopulateMarkers()` in stageLayout.ts seeds a deterministic non-overlapping grid of stage markers from `stageServingAssignments`, triggered exactly once per service the first time the Stage Layout tab opens against an empty canvas.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-07T13:51:54Z
- **Tasks:** 2 automated tasks completed; 1 human-verify checkpoint deferred (see Deferred UAT below)
- **Files modified:** 4

## Accomplishments
- Added `autoPopulateMarkers(servingAssignments)` — an exported, pure, store-free function in `src/utils/stageLayout.ts` that maps `{id,name,roleId,roleName}[]` serving assignments to `StageMarker[]`, laid out in a deterministic 4-column grid strictly inside `STAGE_BAND` with no duplicate positions.
- Wired a guarded `onAutoPopulateStageLayout()` in `ServiceEditorView.vue`, triggered by a new `watch(activeTab, ...)` on `'stage'`, that seeds `localService.stageLayout.elements` exactly once per service when the canvas is empty — riding the existing `useAutoSave` deep-watch (no new save call, no new store).
- Both the zero-elements guard and the per-service seeded-guard `Set` are load-bearing: a populated canvas (including one this function seeded earlier) is never touched, and a delete-all-then-revisit in the same session does not re-seed.
- 6 new unit tests for `autoPopulateMarkers` (29 total in the file) and 6 new component tests for the trigger/guard behavior (19 total in `ServiceEditorView.stage.test.ts`) — all passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pure autoPopulateMarkers() to stageLayout.ts with unit tests** - `b8a8c413` (feat)
2. **Task 2: Wire the one-time empty-canvas seed trigger in ServiceEditorView.vue with component tests** - `7f623dcd` (feat)

_Task 3 (checkpoint:human-verify) deferred per autonomous_deferred_uat_mode — see Deferred UAT below._

## Files Created/Modified
- `src/utils/stageLayout.ts` - Added `autoPopulateMarkers()` plus the fixed grid-layout constants (`AUTO_POPULATE_COLS`, `AUTO_POPULATE_INSET_X`, `AUTO_POPULATE_START_Y`, `AUTO_POPULATE_END_Y`)
- `src/utils/__tests__/stageLayout.test.ts` - New `describe('autoPopulateMarkers', ...)` block (6 tests: empty, count incl. double-booked, identity fields, onstage bounds, no-overlap at 9 markers, determinism, no input mutation)
- `src/views/ServiceEditorView.vue` - Imported `autoPopulateMarkers`; added `stageAutoPopulateSeededServiceIds` (per-service guard `Set`), `onAutoPopulateStageLayout()`, and a `watch(activeTab, ...)` trigger
- `src/views/__tests__/ServiceEditorView.stage.test.ts` - Made the `useRosterStore`/`useQuartersStore` mocks mutable (mirrors the fixture pattern in `ServiceEditorView.test.ts`) and added a new `describe('auto-populate (R420)', ...)` block (6 tests)

## Decisions Made
- **Grid geometry (Claude's discretion):** 4 columns, 8% inset inside `STAGE_BAND` horizontally, rows spread between y=20 and y=60 (below `STAGE_BAND.maxY`=64), row/column step derived from the actual assignment count so any roster size stays strictly onstage with zero duplicate positions.
- **Two-guard non-clobber design:** the zero-elements check is what actually prevents any clobber; the per-service `Set` exists purely to stop an *immediate* re-seed inside the same mounted session after a full delete (when the canvas is transiently empty again) — it does not persist across page reloads/remounts, which is acceptable because on remount the canvas would already have the previously-seeded markers (non-empty) unless the user genuinely deleted them all in a prior session, in which case a fresh seed on next visit is arguably the more helpful behavior and does not violate the plan's "no clobber on a manual placement" invariant (there IS no manual placement in that case — the canvas is legitimately empty).
- **Seeded-guard is not set on an empty-assignments visit:** guarantees a service whose roster resolves after the first Stage Layout visit (e.g. quarter published mid-session, or navigated to Stage Layout before Roles data loaded) can still seed on a later visit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Deferred UAT

**Task 3 (checkpoint:human-verify, gate="blocking") was deferred per `autonomous_deferred_uat_mode`** (owner instruction 2026-09-07: UAT batched to milestone end). What the owner should visually confirm, batched into `.planning/v2.14-DEFERRED-VERIFICATION.md`:

1. Run the app (`npm run dev`) and open a NEW service (Draft) that has band-role assignments for its date.
2. Open the "Stage Layout" tab. Confirm markers appear automatically — one per assigned person/role — and that they are spread across the stage (not piled on top of each other at center).
3. Drag one marker to a new spot, then switch to another tab and back to Stage Layout. Confirm NOTHING re-seeds and the moved marker stays where it was placed.
4. Open an EXISTING service that already had a hand-built stage layout. Confirm it is unchanged.
5. Confirm the seeded layout reads as a plausible starting point a planner would refine, not noise.

All automated verification (unit tests, component tests, type-check, full app suite) is green; only the visual/UX judgment call in the checklist above is outstanding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- R420 fully implemented and automated-tested; only the deferred visual UAT above remains before this can be considered fully closed for the milestone.
- Plan 131-02 (auto share-link, R421) already executed on this same branch (commits `9c4720db`, `8276125e`, `14acd96f`) — both 131-01 and 131-02 files are non-overlapping, no merge conflicts.
- No blockers for subsequent phases in v2.14.

---
*Phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 5 claimed files found on disk; both task commits (`b8a8c413`, `7f623dcd`) found in git log.
