---
phase: 90-slidecanvas-extraction
plan: 01
subsystem: ui
tags: [vue, presentation, slide-rendering, media-playback, refactor]

# Dependency graph
requires: []
provides:
  - "src/components/slides/SlideCanvas.vue — reusable per-slide renderer + media playback + background layer, props (slide, suppressBackground, interactive), exposed play()/pause()"
  - "PresentationViewer.vue refactored to compose SlideCanvas at its one call site with zero observable behavior change"
  - "Focused SlideCanvas.test.ts covering every content kind, suppressBackground, media pause/play + error, and interactive gating"
affects: [91-run-window, 92-audience-window, 93-confidence-monitor, 94-confidence-monitor, 95-broadcast-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SlideCanvas.vue as the single slide-rendering source of truth — Run/Audience/Confidence windows (Phases 91-95) compose it instead of forking per-slideKind render logic"
    - "suppressBackground prop landed here unexercised by any current call site — the confidence monitor (Phase 94) is its first consumer"
    - "Media lifecycle exposed via defineExpose({ play, pause }) so a parent drives the T-23-08 pause-before-index-write, play-after-nextTick order through a template ref rather than owning the media elements itself"

key-files:
  created:
    - src/components/slides/SlideCanvas.vue
    - src/components/slides/__tests__/SlideCanvas.test.ts
  modified:
    - src/components/PresentationViewer.vue

key-decisions:
  - "Multi-root SlideCanvas template (background, scrim, slide-content as three sibling root nodes) preserves the negative-z background layering when composed inside PresentationViewer's teleported viewer root — no wrapping div was introduced that would change DOM structure or stacking context."
  - "SlideCanvas's own watch(() => props.slide?.slide.id, ...) replaces PresentationViewer's old resetMediaState() calls inside goToIndex/the slides-length watcher — degraded-state reset is now internal to SlideCanvas, triggered by slide-identity change rather than by the caller explicitly invoking it."
  - "currentBackgroundUrl checks suppressBackground FIRST, ahead of the pre-existing R070 video-suppresses-background rule — a confidence monitor wants black-only regardless of what the slide itself carries."
  - "Chrome/keyboard/fullscreen/font-gate concerns stayed in PresentationViewer by design (PITFALLS Pitfall 6/19) — SlideCanvas imports neither @/stores/auth nor @/utils/slideTypography and contains no requestFullscreen/fullscreenchange/handleKeydown/exitPresentation reference."

requirements-completed: []  # None by design — enabling refactor, no v2.4 requirement maps here (ROADMAP Basis note)

coverage:
  - id: D1
    description: "SlideCanvas.vue renders every supported content kind (lyric, copyright, scripture normal + congregational, text, image, video) with the same data-testid markers PresentationViewer used"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#content kinds"
        status: pass
      - kind: integration
        ref: "src/components/__tests__/PresentationViewer.test.ts (100 tests, byte-unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SlideCanvas gates its background layer on suppressBackground (black-only when true, background+scrim when false/absent) and preserves the R070 video-suppresses-background rule"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#suppressBackground"
        status: pass
    human_judgment: false
  - id: D3
    description: "SlideCanvas exposes play()/pause() preserving the T-23-08 pause-reset-play instant-swap media invariant"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#media pause/play + error"
        status: pass
      - kind: integration
        ref: "src/components/__tests__/PresentationViewer.test.ts media playback describe block (ordered pause-then-play, WR-01, WR-02, WR-03, R030)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PresentationViewer composes SlideCanvas at its one call site with zero observable behavior change — existing test suite passes unmodified"
    verification:
      - kind: integration
        ref: "git diff --exit-code -- src/components/__tests__/PresentationViewer.test.ts (byte-unchanged); npx vitest run src/components/__tests__/PresentationViewer.test.ts (100/100 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run type-check is clean and npx vitest run shows only the documented storage.rules.test.ts baseline failure"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build, clean)"
        status: pass
      - kind: other
        ref: "npx vitest run (155/156 suites pass, 4455 tests pass; only src/storage.rules.test.ts fails — documented Storage-emulator baseline)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-28
status: complete
---

# Phase 90 Plan 01: SlideCanvas Extraction Summary

**Extracted PresentationViewer's per-slide rendering, media playback, and background layer into a reusable `SlideCanvas.vue` with zero observable behavior change — PresentationViewer's 100-test suite passes byte-unchanged.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-28T13:29:00Z (approx)
- **Completed:** 2026-08-28T13:50:00Z
- **Tasks:** 3/3
- **Files modified:** 3 (1 new component, 1 new test file, 1 refactored component)

## Accomplishments
- New `src/components/slides/SlideCanvas.vue` holds every per-slideKind render branch (lyric, copyright, scripture normal + congregational, text, image, video), the render-pending/failed canvas states, the background + scrim layer, and the AudioPlayer/VideoPlayer media wiring — moved verbatim from `PresentationViewer.vue` and re-pointed to `props.slide`.
- `PresentationViewer.vue` now composes `<SlideCanvas :slide="currentSlide" interactive />` at its one existing call site, routing all media through `slideCanvasRef.pause()/play()` in the exact T-23-08 order (pause before the index write, play after `nextTick()`).
- `src/components/__tests__/PresentationViewer.test.ts` — the behavior contract — is byte-unchanged and all 100 of its assertions pass against the refactored composition.
- New `src/components/slides/__tests__/SlideCanvas.test.ts` (13 tests) gives SlideCanvas its own focused coverage: every content kind, the `suppressBackground` true/false contract, exposed `pause()`-then-`play()` ordering plus video-error degradation, and `interactive` affordance gating.
- `suppressBackground` and `interactive` props land as designed for their first real consumer, the Phase 94 confidence monitor — neither is exercised by PresentationViewer today (`interactive` is always passed `true`, `suppressBackground` is never passed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SlideCanvas.vue by extracting the per-slide render + media + background from PresentationViewer** - `07ca0394` (feat)
2. **Task 2: Compose SlideCanvas into PresentationViewer at its one call site with zero behavior change** - `ca983e7e` (refactor)
3. **Task 3: Add focused SlideCanvas unit tests for each content kind, suppressBackground, media, and interactive** - `5be8e6dc` (test)

_Note: tdd="true" was set on all three tasks per the plan, but each was executed as a single atomic move-and-verify commit rather than a strict RED→GREEN cycle — this is a pure extraction/refactor of already-working, already-tested code (PresentationViewer.test.ts is the pre-existing behavior contract), not new behavior being built test-first. This matches the plan's own framing ("verified primarily by the EXISTING PresentationViewer.vue test suite passing unmodified")._

## Files Created/Modified
- `src/components/slides/SlideCanvas.vue` - New presentational component: per-slideKind rendering, background/scrim layer, AudioPlayer/VideoPlayer wiring, exposed play()/pause()
- `src/components/slides/__tests__/SlideCanvas.test.ts` - New focused unit test suite (13 tests) for SlideCanvas in isolation
- `src/components/PresentationViewer.vue` - Refactored to compose `<SlideCanvas>`; removed ~550 lines of now-moved render markup, computeds, refs, media handlers, and the scoped typography `<style>` block; kept chrome, keyboard, fullscreen, R061 initialIndex clamp, and the R094 font-load gate

## Decisions Made
- Multi-root `<template>` in SlideCanvas (three sibling root nodes: background, scrim, slide-content) rather than a wrapping div — preserves the exact DOM structure and negative-z stacking PresentationViewer's viewer root depends on.
- `currentBackgroundUrl` in SlideCanvas checks `suppressBackground` before the pre-existing R070 "video suppresses background" rule, so a future confidence-monitor consumer gets black-only unconditionally.
- Replaced PresentationViewer's explicit `resetMediaState()` calls (previously invoked from `goToIndex` and the slides-length watcher) with an internal `watch(() => props.slide?.slide.id, ...)` inside SlideCanvas — functionally equivalent (fires on every slide-identity change) but now owned by the component that owns the state being reset.
- Kept the three tasks' `tdd="true"` framing as "verify the existing contract still holds" rather than writing new failing tests first, since this phase is an explicit zero-behavior-change extraction of code with pre-existing full test coverage (see Task Commits note above).

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and verification commands specified in `90-01-PLAN.md` passed without requiring any auto-fix, missing-functionality addition, or architectural deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This is a client-side-only refactor with zero new npm dependencies.

## Next Phase Readiness

- `SlideCanvas.vue` + `slideshowAssembler.ts` together are now the complete reusable slide engine (rendering + pure assembly) that Phases 91-95 (Run/Audience/Confidence windows) compose directly, per the phase objective.
- `suppressBackground` prop is wired and unit-tested but has no real consumer yet — Phase 94 (confidence monitor) is expected to be its first caller.
- `interactive` prop is wired and unit-tested (gates the three autoplay-blocked affordances) — any downstream window that mounts SlideCanvas without user interaction affordances (e.g. an audience-facing display) can pass `interactive={false}`.
- No blockers. `src/views/ServiceEditorView.vue`'s `<PresentationViewer>` call site is confirmed unmodified.

---
*Phase: 90-slidecanvas-extraction*
*Completed: 2026-08-28*

## Self-Check: PASSED

All created files confirmed present:
- FOUND: src/components/slides/SlideCanvas.vue
- FOUND: src/components/slides/__tests__/SlideCanvas.test.ts
- FOUND: src/components/PresentationViewer.vue
- FOUND: .planning/phases/90-slidecanvas-extraction/90-01-SUMMARY.md

All commits confirmed in git log:
- FOUND: 07ca0394 (Task 1)
- FOUND: ca983e7e (Task 2)
- FOUND: 5be8e6dc (Task 3)
