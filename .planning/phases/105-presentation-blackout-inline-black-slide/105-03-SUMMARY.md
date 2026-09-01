---
phase: 105-presentation-blackout-inline-black-slide
plan: 03
subsystem: presentation
tags: [vue, vitest, run-control, output-windows]

# Dependency graph
requires:
  - phase: 94-band-confidence-monitor
    provides: ConfidenceOutputView.vue's useOutputWindow-based lifecycle + the confidence-blackout overlay this plan removes
provides:
  - "ConfidenceOutputView no longer renders a runtime blackout overlay — the confidence-blackout div and its `blackout` destructure from useOutputWindow are removed"
  - "R305 test proving the runtime 'Go to black' control no longer reaches the confidence monitor (overlay absent, current/next panes stay live across blackout:true/false)"
  - "Content-path test proving an authored blackout SLIDE (contentKind:'blackout') still renders black on the confidence current pane via the real SlideCanvas, independent of the runtime control"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consumer-side suppression: a shared wire-protocol field (blackout) is broadcast unchanged, but one consumer (ConfidenceOutputView) simply stops reading/rendering it while another (AudienceOutputView) keeps honoring it — no protocol branching needed."

key-files:
  created: []
  modified:
    - src/views/ConfidenceOutputView.vue
    - src/views/__tests__/ConfidenceOutputView.test.ts

key-decisions:
  - "No wire-protocol change: useOutputWindow.ts, AudienceOutputView.vue, useRunControl.ts, and runChannel.ts are all untouched — blackout still broadcasts to both outputs, only ConfidenceOutputView stops consuming it (matches CONTEXT.md/ARCHITECTURE.md Option B)."
  - "The removed overlay's R280 test was inverted in place (same describe-block position) rather than deleted, so git history and diff show the exact behavior flip from 'overlay renders' to 'overlay never renders'."
  - "The authored-blackout-slide content-path test mounts the REAL SlideCanvas directly (vi.importActual) with suppressBackground=true — mirroring ConfidenceOutputView's own current-pane wiring — rather than routing through ConfidenceOutputView's stubbed-SlideCanvas mount, since the file-level vi.mock('@/components/slides/SlideCanvas.vue') applies to every ConfidenceOutputView mount in this suite."

patterns-established: []

requirements-completed: [R305]

coverage:
  - id: D1
    description: "Runtime 'Go to black' (blackout:true) no longer renders any overlay on the confidence monitor; current + next panes keep showing the real slides across blackout:true and blackout:false"
    requirement: R305
    verification:
      - kind: unit
        ref: "src/views/__tests__/ConfidenceOutputView.test.ts#ConfidenceOutputView — runtime \"Go to black\" is Audience-only, no overlay (R305)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An authored blackout SLIDE (contentKind:'blackout') still renders black on the confidence current pane via the real SlideCanvas — the content path is preserved and distinct from the removed runtime overlay"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ConfidenceOutputView.test.ts#ConfidenceOutputView — authored blackout SLIDE still renders black content (distinct from the removed R305 runtime overlay)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AudienceOutputView and RunControlView.output regression suites (audience blackout + control broadcast) pass unchanged, proving the wire protocol and audience-side blackout are untouched"
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts, src/views/__tests__/RunControlView.output.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-09-01
status: complete
---

# Phase 105 Plan 03: "Go to black" -> Audience Only Summary

**Removed the confidence-blackout overlay + its now-unused `blackout` destructure from ConfidenceOutputView.vue — a pure consumer-side suppression with zero wire-protocol change, so the band's confidence monitor keeps showing current/next slides through a runtime "Go to black".**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-01T06:20:00Z (approx.)
- **Completed:** 2026-09-01T06:28:46Z
- **Tasks:** 1/1
- **Files modified:** 2

## Accomplishments
- Deleted the `<div v-if="blackout" ... data-testid="confidence-blackout">` overlay block from `ConfidenceOutputView.vue` and the `blackout` destructure off `useOutputWindow(...)` (now unused), replaced with a comment explicitly warning against re-adding a runtime-blackout overlay to this surface and distinguishing it from the authored blackout-slide content path.
- Inverted the existing R280 "blackout overlay obeys the channel field" test into an R305 test: emitting `blackout:true` over the channel now asserts the overlay is absent and both current/next region panes keep rendering the real slides ('a' / 'b'); `blackout:false` remains a no-op.
- Added a content-path test mounting the REAL SlideCanvas (bypassing this suite's stub) with a `contentKind:'blackout'` slide and `suppressBackground:true` (matching ConfidenceOutputView's own current-pane wiring) — proving no `presentation-body`/`presentation-background`/`presentation-background-scrim` render, so an authored blackout slide still shows black on the confidence monitor independent of the runtime control.
- Ran `AudienceOutputView.test.ts` and `RunControlView.output.test.ts` as regression guards — both pass unchanged, confirming the audience blackout overlay and the control's broadcast are untouched.
- `npm run type-check` (vue-tsc --build, typechecks test files too) is clean — the removed `blackout` binding left no unused-var/type error.

## Task Commits

Each task was committed atomically:

1. **Task 1: Suppress the runtime blackout overlay on the Confidence monitor + invert its test** - `3a23eaec` (feat)

_No separate RED/GREEN/REFACTOR commits — this task was not `tdd="true"`; the removal + inverted/added tests were authored together and verified via the scoped test run before commit._

## Files Created/Modified
- `src/views/ConfidenceOutputView.vue` - Removed the `confidence-blackout` overlay div and the `blackout` destructure from `useOutputWindow(...)`; added a comment naming the R305/authored-blackout-slide distinction
- `src/views/__tests__/ConfidenceOutputView.test.ts` - Inverted the R280 overlay test into an R305 "no overlay, panes stay live" test; added a real-SlideCanvas content-path test for an authored blackout slide; added a `blackoutSlide()` fixture builder

## Decisions Made
- No wire-protocol change: `useOutputWindow.ts`, `AudienceOutputView.vue`, `useRunControl.ts`, and `runChannel.ts` are all untouched per CONTEXT.md/ARCHITECTURE.md Option B — `blackout` still broadcasts to both outputs, only `ConfidenceOutputView` stops reading it.
- The content-path proof for an authored blackout slide mounts the real `SlideCanvas` directly (as the existing R272 "real-SlideCanvas black suppression" test does) rather than through `ConfidenceOutputView` itself, since this test file's `vi.mock('@/components/slides/SlideCanvas.vue')` stub applies file-wide to every `ConfidenceOutputView` mount.
- This test does not depend on Plan 105-02 (which adds a dedicated `presentation-blackout` marker branch to `SlideCanvas`) having executed — it currently passes because a `contentKind:'blackout'` slide matches none of `SlideCanvas`'s existing per-kind branches, so no lyric body renders regardless of ordering. It will continue to pass once 105-02 lands.

## Deviations from Plan

None - plan executed exactly as written. Only `src/views/ConfidenceOutputView.vue` and its test file were touched; `useOutputWindow.ts`, `AudienceOutputView.vue`, `useRunControl.ts`, and `runChannel.ts` were read for context but not modified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R305 is fully delivered and isolated from 105-01/105-02 (the black-slide authoring/rendering work) — no dependency in either direction.
- Manual/UAT verification (deferred to phase-level verification per this plan's `<verification>` section): during a real Run with "Go to black" pressed, confirm the audience projector goes black while the confidence monitor keeps showing current/next.
- No blockers for closing out Phase 105 once 105-02's editor/render work and its own UAT are complete.

---
*Phase: 105-presentation-blackout-inline-black-slide*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 2 modified files (`src/views/ConfidenceOutputView.vue`, `src/views/__tests__/ConfidenceOutputView.test.ts`) verified present on disk; task commit hash `3a23eaec` verified present in git history.
