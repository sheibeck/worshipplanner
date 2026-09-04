---
phase: 115-live-output-readability-layout
plan: 03
subsystem: frontend
tags: [auto-fit, css-custom-properties, slide-rendering, resize-observer, vue, r329]

# Dependency graph
requires:
  - phase: 115-live-output-readability-layout
    provides: "115-01's auto-fit engine — computeFitScale/computeContainScale, useSlideAutoFit/useContainScale, REFERENCE_WIDTH/HEIGHT, DEFAULT_FIT_SCALE — consumed here for the first time"
provides:
  - "SlideCanvas.vue driven by useSlideAutoFit — scoped font rules read a measured --slide-fit-scale, no longer --slide-font-scale"
  - "AudienceOutputView.vue and ConfidenceOutputView.vue rendering SlideCanvas inside a canonical 1280x720 stage via useContainScale (WYSIWYG with Run previews/thumbnails)"
  - "ConfidenceOutputView's next-pane fixed transform: scale(0.8) hack removed, replaced by a canonical-stage contain-scale"
  - "Updated ARCHITECTURE.md behavioral note describing per-slide auto-fit on the canonical stage as the text-size source"
affects: [115-05-remove-slide-font-scale]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-ref auto-fit wiring: SlideCanvas's presentation-slide testid/content stays the measured contentRef; a NEW outer frameRef wrapper (sized by the consumer's stage) surrounds it — the composable measures contentRef's scrollWidth/Height against frameRef's clientWidth/Height."
    - "Merged function-ref pattern for combining two composables on one DOM node: AudienceOutputView's root needs BOTH useOutputWindow's rootRef (fullscreen target) and useContainScale's containerRef (stage sizing) on the same element — Vue templates allow only one `ref` attribute per element, so a `setRootRefs(el)` function assigns both refs from a single `:ref` binding."
    - "Per-region contain-scale: ConfidenceOutputView gives its current and next panes their OWN independent useContainScale instances (containerRef on each region div), so each pane's canonical stage scales to fit its own (differently-sized) column."

key-files:
  created: []
  modified:
    - src/components/slides/SlideCanvas.vue
    - src/components/slides/__tests__/SlideCanvas.test.ts
    - src/views/AudienceOutputView.vue
    - src/views/__tests__/AudienceOutputView.test.ts
    - src/views/ConfidenceOutputView.vue
    - src/views/__tests__/ConfidenceOutputView.test.ts
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "SlideCanvas's existing presentation-slide testid/wrapper is kept as contentRef (unchanged element, unchanged testid — PresentationViewer.test.ts and others query it by that id); a NEW outer div gets frameRef and w-full h-full, nesting the old content wrapper one level deeper. Scoped attribute-selector CSS rules are unaffected by the extra nesting level."
  - "SlideCanvas stops reading var(--slide-font-scale) entirely in this plan's scope, but its EMISSION is left untouched everywhere else (cssVarsFor, typographyStyle plumbing) — Plan 05 owns removing the variable after every reader (this plan + 115-04's SlideCard/EditSlideDrawer) has migrated off it."
  - "AudienceOutputView merges useOutputWindow's rootRef and useContainScale's containerRef onto the SAME root DOM node via a setRootRefs(el) function ref, since a template element can carry only one `ref` binding — avoids introducing a second wrapping div just to host a second ref."
  - "ConfidenceOutputView gives current and next panes their OWN useContainScale instances (not one shared instance) so each region's canonical stage independently fits that region's own box size — the two panes are differently sized (flex-[3_1_0%] vs flex-[2_1_0%])."
  - "The removed scale(0.8) test assertion was rewritten to check element `style` attributes only (via wrapper.findAll('[style]')), not a raw wrapper.html() substring scan — a template comment documenting the removal ('...replaced by the same... the old fixed transform: scale(0.8) hack...') itself renders into the DOM as an HTML comment and would false-positive a plain substring check."

requirements-completed: [R329]

coverage:
  - id: D1
    description: "SlideCanvas's scoped font-size rules read var(--slide-fit-scale) (not var(--slide-font-scale)); the content wrapper binds --slide-fit-scale from useSlideAutoFit's measured scale, degrading to DEFAULT_FIT_SCALE (1) in jsdom"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#auto-fit --slide-fit-scale (exposes a --slide-fit-scale inline custom property on the content wrapper, identity default under jsdom)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts — all 16 tests (every existing per-kind render assertion unaffected by the frameRef/contentRef restructure)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AudienceOutputView renders SlideCanvas inside a fixed 1280x720 canonical stage (audience-stage) scaled via useContainScale to CONTAIN the fullscreen root; blackout overlay and re-enter affordance preserved"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts#R329 canonical stage (wraps SlideCanvas in the canonical audience-stage around the live slide)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts — all 24 tests, including the updated blackout DOM-order assertion (stage position, not SlideCanvas's own position)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ConfidenceOutputView wraps both current and next panes' SlideCanvas in their own 1280x720 canonical stage via useContainScale; the fixed transform: scale(0.8) next-pane hack is removed; media/static/seam contracts preserved"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ConfidenceOutputView.test.ts#left/right split layout (R279) + next-scale (R276) (each pane wraps SlideCanvas in confidence-current-stage/confidence-next-stage; no styled element carries scale(0.8))"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ConfidenceOutputView.test.ts — all 30 tests (two-pane render, suppressBackground wiring, real-SlideCanvas black suppression, last-slide safety, next-pane-never-autoplays, lifecycle suite)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ARCHITECTURE.md's SlideCanvas behavioral note describes per-slide canonical-frame auto-fit (not the old --slide-font-scale multiplier) as the text-size source shared by output, previews, and thumbnails"
    requirement: "R329"
    verification:
      - kind: other
        ref: ".planning/codebase/ARCHITECTURE.md § Component & Composable Behavioral Notes -> src/components/slides/SlideCanvas.vue — new bullet added, reviewed against the plan's artifact spec"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-hardware WYSIWYG check: the Audience/Confidence output text matches the Run-screen previews/thumbnails for the same slide at projection distance on the owner's real Mac + projector"
    verification: []
    human_judgment: true
    rationale: "Requires a physical projector and the owner's church hardware — cannot be automated in jsdom. Batched per the v2.9 deferred-verification policy (owner's 2026-09-03 'run autonomously, defer UAT to the end' instruction); tracked in .planning/v2.9-DEFERRED-VERIFICATION.md."

# Metrics
duration: 10min
completed: 2026-09-04
status: complete
---

# Phase 115 Plan 03: SlideCanvas + Output-View Auto-Fit Integration Summary

**Wired 115-01's measure-and-fit engine into SlideCanvas and both output windows: per-slide text now auto-scales against a canonical 1280x720 frame (grow-to-fill, shrink-to-avoid-overflow, capped), and Audience/Confidence render on that same canonical stage via useContainScale — so the fit computed once is pixel-identical across the projector, the band monitor, and the Run-screen previews (WYSIWYG). The Confidence next-pane's fixed `scale(0.8)` hack is gone, replaced by a properly contain-scaled mini stage.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-04T01:29:00-04:00 (approx)
- **Completed:** 2026-09-04T01:41:47-04:00
- **Tasks:** 3 completed
- **Files modified:** 7 (3 source components, 3 test files, 1 map doc)

## Accomplishments
- `SlideCanvas.vue` now consumes `useSlideAutoFit`: a new `frameRef` wrapper (sized by whatever consumer stage renders it) surrounds the existing `presentation-slide` content wrapper (now `contentRef`), which binds an inline `--slide-fit-scale` custom property from the composable's measured scale. Every scoped font-size rule (`presentation-body`, `presentation-scripture-reference`, `presentation-speaker`, `presentation-congregational-section`, copyright fine-print/authors) reads `var(--slide-fit-scale)` instead of `var(--slide-font-scale)`. The fit re-measures on every slide-identity change via `retrigger()`; jsdom/no-layout degrades to `DEFAULT_FIT_SCALE` (1), matching the previous `md` identity default exactly.
- `AudienceOutputView.vue` wraps `SlideCanvas` in a fixed `1280x720` `audience-stage`, transform-scaled via `useContainScale` to CONTAIN the fullscreen black root (letterboxed, centered, never stretched). `SlideCanvas` fills the stage, so its auto-fit measures against the SAME canonical frame the Run previews/thumbnails already use. `useContainScale`'s `containerRef` shares the root DOM node with `useOutputWindow`'s existing `rootRef` (the fullscreen target) via a `setRootRefs` function ref, since a template element can carry only one `ref` binding.
- `ConfidenceOutputView.vue` gives the current and next panes each their OWN `useContainScale` instance (containerRef on the region element) and wraps each pane's `SlideCanvas` in its own `1280x720` canonical stage — REPLACING the old fixed `transform: scale(0.8)` next-pane wrapper. `suppressBackground`, the current-pane media wiring (`currentCanvasRef`), the static ref-less next pane, the `border-l-[6px]` seam, the "Next" label, and the re-enter-fullscreen affordance are all unchanged.
- `.planning/codebase/ARCHITECTURE.md`'s SlideCanvas behavioral note now describes per-slide canonical-frame auto-fit (measured by `useSlideAutoFit` against the 1280x720 frame, shared identically by the output windows via `useContainScale` and the Run previews via `RunPreviewPair`'s existing 1280x720 reference stage) as the source of text size, replacing the old discrete `--slide-font-scale` multiplier description.
- Full app suite verified at the documented one-file baseline: `npx vitest run` → 185/186 test files pass, 5039/5039 tests pass, only `src/storage.rules.test.ts` fails (Storage-emulator environment limitation, pre-existing and documented in CLAUDE.md — unrelated to this plan). `npm run type-check` (`vue-tsc --build`) is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: SlideCanvas — per-slide auto-fit drives text size (replace --slide-font-scale with measured --slide-fit-scale)** - `3464dfc7` (feat)
2. **Task 2: AudienceOutputView — canonical 1280x720 stage scaled to fill the projector** - `2159638d` (feat)
3. **Task 3: ConfidenceOutputView — canonical stage for current + next panes (drop the scale(0.8) hack)** - `561300af` (feat)

## Files Created/Modified
- `src/components/slides/SlideCanvas.vue` - added `frameRef`/`contentRef`/`fitScale`/`retriggerFit` from `useSlideAutoFit`; inline `--slide-fit-scale` style on the content wrapper; all scoped font rules migrated off `--slide-font-scale`; slide-id watch now also calls `retriggerFit()`.
- `src/components/slides/__tests__/SlideCanvas.test.ts` - added an `auto-fit --slide-fit-scale` test asserting the identity-default inline custom property under jsdom; all 15 pre-existing tests unmodified and still passing.
- `src/views/AudienceOutputView.vue` - added the `audience-stage` canonical 1280x720 wrapper, `useContainScale`, `stageStyle` computed, and the `setRootRefs` merged function ref.
- `src/views/__tests__/AudienceOutputView.test.ts` - added a canonical-stage existence test; updated the blackout DOM-order assertion to key off `audience-stage` position (SlideCanvas is no longer a direct root child).
- `src/views/ConfidenceOutputView.vue` - added `confidence-current-stage`/`confidence-next-stage` canonical wrappers, two independent `useContainScale` instances, `currentStageStyle`/`nextStageStyle` computeds; removed the `transform: scale(0.8)` next-pane wrapper.
- `src/views/__tests__/ConfidenceOutputView.test.ts` - rewrote the R276 next-scale test to assert both canonical stage wrappers exist and that no styled element carries `scale(0.8)` any longer.
- `.planning/codebase/ARCHITECTURE.md` - new SlideCanvas behavioral-note bullet on the R329 auto-fit mechanism and its WYSIWYG guarantee.

## Decisions Made
- SlideCanvas's `presentation-slide` testid/wrapper stays exactly as-is (contentRef) so every existing consumer test (PresentationViewer.test.ts, this plan's own suite) keeps finding it unchanged; a new outer div (frameRef, `w-full h-full`) wraps it rather than repurposing it, avoiding any testid churn.
- SlideCanvas stops READING `--slide-font-scale` entirely, but its emission is left untouched (Plan 05's job, after all readers — this plan and 115-04 — have migrated).
- AudienceOutputView merges `rootRef` (useOutputWindow, fullscreen target) and `containerRef` (useContainScale, stage sizing) onto the same DOM node via a `setRootRefs` function ref rather than adding a second wrapping div, since Vue templates only allow one `ref` binding per element.
- ConfidenceOutputView's two panes each get an independent `useContainScale` instance (not a shared one) since the current (`flex-[3_1_0%]`) and next (`flex-[2_1_0%]`) regions are differently sized and must each compute their own contain-scale.
- The removed-`scale(0.8)` test assertion checks `style` attributes on `wrapper.findAll('[style]')` rather than scanning `wrapper.html()` for the literal substring — a template comment documenting the removal itself renders as an HTML comment containing the text "scale(0.8)", which would otherwise false-positive a naive `.not.toContain` check on the full HTML.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' behavior bullets, acceptance criteria, and the plan-level verification command all pass as specified.

## Issues Encountered

While writing the ConfidenceOutputView.test.ts assertion proving the `scale(0.8)` hack was removed, an initial `expect(wrapper.html()).not.toContain('scale(0.8)')` false-failed — not because the style was still present, but because the plan's own action text (and this plan's rewritten Vue template comment describing the removal) contains the literal string "scale(0.8)" inside an HTML `<!-- comment -->`, which `wrapper.html()` includes verbatim. Fixed by scoping the assertion to `style` attributes only (see Decisions Made).

## User Setup Required

None — pure client-side rendering/layout change over already-trusted slide content. No new dependencies, no network/storage surface, no external service configuration.

## Next Phase Readiness

- SlideCanvas, AudienceOutputView, and ConfidenceOutputView are the three of five R329 render sites planned; the remaining two (SlideCard, EditSlideDrawer) were already migrated to a fixed-base font-size by 115-04 (deliberately NOT adopting auto-fit — see 115-04-SUMMARY.md). Every non-Plan-05 reader of `--slide-font-scale` is now migrated.
- `--slide-font-scale`'s EMISSION (cssVarsFor, typographyStyle plumbing, SettingsView's Size radios, SCALE_MAP) is untouched and still live — Plan 05 is unblocked to remove it now that no source in the codebase reads it.
- WYSIWYG real-hardware verification (owner's Mac + projector, Audience/Confidence output vs. Run previews/thumbnails at projection distance) is deferred to the batched v2.9 milestone-end UAT per the owner's autonomous-run instruction (`.planning/v2.9-DEFERRED-VERIFICATION.md`).
- Full suite verified green at the documented one-file baseline (`src/storage.rules.test.ts` only); `npm run type-check` clean.

---
*Phase: 115-live-output-readability-layout*
*Completed: 2026-09-04*

## Self-Check: PASSED

All files listed under "Files Created/Modified" and this SUMMARY.md exist on disk; all four task/plan-metadata commit hashes (`3464dfc7`, `2159638d`, `561300af`, `ab527be5`) are present in `git log`.
