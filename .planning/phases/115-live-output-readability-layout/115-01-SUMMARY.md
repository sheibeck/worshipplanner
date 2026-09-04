---
phase: 115-live-output-readability-layout
plan: 01
subsystem: frontend
tags: [auto-fit, resize-observer, composable, slide-rendering, pure-math]

# Dependency graph
requires: []
provides:
  - "computeFitScale(fits, opts?) — pure binary search for the largest scale where an injected oracle returns true; caps at MAX_FIT_SCALE, floors at MIN_FIT_SCALE, returns the fitting low edge (never the overflowing upper edge)"
  - "computeContainScale(cW, cH, refW, refH) — pure min-of-ratios letterbox scale; DEFAULT_FIT_SCALE for any non-finite/non-positive input"
  - "useSlideAutoFit(options?) — { frameRef, contentRef, scale, retrigger } per-slide text-fit composable (ResizeObserver, never-throws, jsdom-safe)"
  - "useContainScale(options?) — { containerRef, scale } geometric stage-to-container scaler (ResizeObserver, never-throws)"
  - "DEFAULT_FIT_SCALE=1, MAX_FIT_SCALE=4 exported constants"
  - "REFERENCE_WIDTH=1280, REFERENCE_HEIGHT=720 — canonical slide frame, single import source for Plan 03"
affects: [115-03-slidecanvas-output-integration, 115-05-remove-slide-font-scale]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-oracle fit math: computeFitScale takes an injected `fits(scale)` predicate so the search is DOM-free, deterministic, and unit-testable in isolation; the DOM wiring is a thin ResizeObserver shell around it"
    - "Never-throws / identity-default composable shell: feature-detect ResizeObserver, guard 0-size layout, degrade to DEFAULT_FIT_SCALE (jsdom/SSR) — mirrors RunPreviewPair's useScaleToFit"

key-files:
  created:
    - src/composables/useSlideAutoFit.ts
    - src/composables/__tests__/useSlideAutoFit.test.ts
  modified: []

key-decisions:
  - "MAX_FIT_SCALE fixed at 4 and DEFAULT_STEPS at 12 (Claude's discretion per CONTEXT.md) — 12 binary-search iterations resolve [0.3, 4] to <1px tolerance while bounding the T-115-01 DoS surface to a fixed oracle-call count"
  - "computeFitScale returns the LOW edge of the final bracket, not the midpoint — guarantees the returned scale actually fits (the upper edge may overflow), so no consumer is ever handed an overflowing scale"
  - "The fit oracle drives sizing through a `--slide-fit-scale` CSS custom property set on contentRef and reads back scrollWidth/scrollHeight — the same custom-property mechanism Plan 03 will consume in SlideCanvas, so the measured contract matches the render contract (WYSIWYG across Audience/Confidence/previews)"
  - "No consumers wired in this plan — highest-leverage/lowest-risk piece first; the --slide-font-scale emission stays live until Plan 05 removes it (Plan 03 migrates readers), so no reader is ever stranded"

patterns-established:
  - "Pure fit math + thin DOM shell split (fit engine reused identically by every R329 render site)"
  - "Geometric contain-scale primitive (letterbox a fixed reference stage into any container without stretching)"

requirements-completed: [R329]

coverage:
  - id: D1
    description: "computeFitScale returns the largest fitting scale within [min,max] — grows to fill (returns MAX when all fit), shrinks to avoid overflow (never exceeds the last fitting scale)"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideAutoFit.test.ts#computeFitScale (always-true→MAX, oracle s<=2.3→~2.3 not above)"
        status: pass
    human_judgment: false
  - id: D2
    description: "computeFitScale never exceeds MAX_FIT_SCALE and never drops below the min floor / yields 0/NaN/negative"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideAutoFit.test.ts#computeFitScale (always-false→min floor, cap enforced)"
        status: pass
    human_judgment: false
  - id: D3
    description: "computeContainScale returns min(width,height) ratio so a 16:9 stage letterboxes rather than stretches; safe identity default on 0-size/non-finite input"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideAutoFit.test.ts#computeContainScale (1920x1080→1.5, 1280x1280→1 height-constrained, 0x0→DEFAULT_FIT_SCALE)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both composables degrade to DEFAULT_FIT_SCALE where layout is unavailable (jsdom clientW/H 0), feature-detect ResizeObserver, and disconnect on unmount without throwing"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideAutoFit.test.ts#useSlideAutoFit / useContainScale jsdom harness (scale===DEFAULT_FIT_SCALE, retrigger no-throw, clean unmount)"
        status: pass
    human_judgment: false
---

# Phase 115 Plan 01: Auto-Fit Engine Summary

**Built the framework-light auto-fit engine every R329 render site will share: a pure, binary-searched text-fit function (`computeFitScale`) plus its ResizeObserver composable (`useSlideAutoFit`), and a geometric "contain" scaler (`computeContainScale` / `useContainScale`) for the canonical 1280x720 stage. No consumers wired yet — this is the highest-leverage, lowest-risk piece that unblocks the SlideCanvas + output-view integration in Plan 03.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-09-03T17:55Z (approx)
- **Completed:** 2026-09-03T18:01:04-04:00
- **Tasks:** 2 completed (both `tdd="true"`)
- **Files modified:** 2 (1 source, 1 test — both new)

> **Note (close-out):** This plan's two tasks were executed and committed atomically on 2026-09-03, but the execute-phase run was interrupted before the SUMMARY was written. This SUMMARY was reconstructed on 2026-09-04 via the execute-phase `safe_resume_gate` "close out manually" path — the committed source, exports, and the plan's own acceptance tests were re-verified green before writing (17/17 unit tests pass; type-check clean). No code was re-executed or changed.

## Accomplishments
- `computeFitScale(fits, opts?)` — pure binary search over `[min=0.3, max=MAX_FIT_SCALE]` (12 iterations) driven by an injected `fits(scale)` oracle. Returns `max` when everything fits (cap enforced — a two-word slide is not scaled without bound), `min` when nothing fits (degrades to smallest, never 0/NaN/negative), otherwise the low edge of the final bracket so the returned scale is guaranteed to fit.
- `computeContainScale(cW, cH, refW, refH)` — pure `min(cW/refW, cH/refH)` letterbox scale; returns `DEFAULT_FIT_SCALE` for any non-finite or non-positive argument (a 0-size jsdom/SSR container never yields 0 or NaN).
- `useSlideAutoFit(options?)` — per-slide text-fit composable exposing `{ frameRef, contentRef, scale, retrigger }`. Measures `contentRef` against `frameRef` by driving a `--slide-fit-scale` CSS custom property and reading back `scrollWidth`/`scrollHeight`; re-measures on mount, on `retrigger()` (slide change / fontReady), and via a feature-detected ResizeObserver; disconnects on unmount.
- `useContainScale(options?)` — geometric stage-to-container scaler exposing `{ containerRef, scale }`, defaulting refW/refH to `REFERENCE_WIDTH`/`REFERENCE_HEIGHT`; same never-throws ResizeObserver lifecycle.
- Exported constants: `DEFAULT_FIT_SCALE=1`, `MAX_FIT_SCALE=4`, `REFERENCE_WIDTH=1280`, `REFERENCE_HEIGHT=720` — the single source Plan 03 imports so the canonical stage size is defined once.
- 17 unit tests cover every behavior bullet with pure numeric oracles (fit math) plus jsdom harness mounts (composable identity-default + clean unmount) — no real-pixel assertions in jsdom (deferred to Plan 03 integration + hardware UAT per plan).

## Task Commits

Each task was committed atomically:

1. **Task 1: pure fit math — computeFitScale (binary search) + computeContainScale + constants** - `1ecb64c8` (feat)
2. **Task 2: ResizeObserver composables — useSlideAutoFit + useContainScale (never-throws shells)** - `d3541921` (feat)

_Both tasks were `tdd="true"`; each commit bundles the source and its tests together per the plan's `<action>` blocks (the second commit extends the same test file with the jsdom harness cases)._

## Files Created/Modified
- `src/composables/useSlideAutoFit.ts` (new) - `computeFitScale`, `computeContainScale`, `useSlideAutoFit`, `useContainScale`, and the DEFAULT/MAX/REFERENCE constants. Pure math is DOM-free; the composables are feature-detected, never-throws ResizeObserver shells that degrade to the identity default.
- `src/composables/__tests__/useSlideAutoFit.test.ts` (new) - 17 tests: pure-oracle fit-math cases (cap, floor, tolerance, contain ratios, non-finite guards) + jsdom harness mounts asserting `scale === DEFAULT_FIT_SCALE`, `retrigger()` no-throw, and clean unmount.

## Decisions Made
- `MAX_FIT_SCALE` fixed at 4, `MIN_FIT_SCALE` at 0.3, `DEFAULT_STEPS` at 12 (all Claude's discretion per CONTEXT.md's "Auto-fit text scaling" grey area) — 12 iterations resolve the bracket to sub-pixel tolerance while bounding the T-115-01 DoS surface to a fixed oracle-call count inside the ResizeObserver callback.
- `computeFitScale` returns the **low** edge of the final bracket (guaranteed-fitting), never the midpoint or upper edge — the returned scale is safe to apply directly with no overflow re-check by the consumer.
- The fit oracle sets a `--slide-fit-scale` CSS custom property on `contentRef` and reads back scroll dimensions — deliberately the same custom-property mechanism Plan 03 wires into SlideCanvas, so the measured contract equals the render contract (identical fit flows to Audience, Confidence, and Run previews — WYSIWYG).
- No consumers wired in this plan (per plan scope) — the manual `--slide-font-scale` emission stays live until Plan 05 removes it after Plan 03/04 migrate the readers, so no reader is ever stranded on an undefined variable.

## Deviations from Plan

None. Both tasks were implemented exactly as specified; all acceptance criteria and behavior bullets are covered by passing tests.

## Issues Encountered

The execute-phase run was interrupted after both task commits landed but before the SUMMARY was written and STATE/ROADMAP were advanced. Recovered via the `safe_resume_gate` close-out path (commits inspected, exports + tests re-verified green, SUMMARY written) — no duplicate execution.

## User Setup Required

None — pure client-side layout math over already-trusted slide geometry. No new dependencies, no network/storage surface, no external service configuration.

## Next Phase Readiness

- The auto-fit engine (pure `computeFitScale`/`computeContainScale` + the `useSlideAutoFit`/`useContainScale` composables) and the `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` constants are in place and unit-tested — **Wave 2 Plan 03** (SlideCanvas + Audience/Confidence output integration) can now import and wire them.
- `useContainScale` generalizes the width-only scale currently inlined in `RunPreviewPair` to a true contain (min of both ratios); Plan 03 uses it to letterbox the 1280x720 stage into the output panes.
- Verified green at close-out: 17/17 plan unit tests pass; `npm run type-check` clean. Full-suite baseline unchanged (the new file wires no existing consumer).
