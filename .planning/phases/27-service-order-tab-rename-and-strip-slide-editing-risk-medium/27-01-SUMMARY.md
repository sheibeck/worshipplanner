---
phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
plan: 01
subsystem: ui
tags: [vue, decision, presentation, slides-tab]

# Dependency graph
requires:
  - phase: 23-presentation-view-and-projector-mode
    provides: "PresentationViewer.vue, the presenting flag mount, and the original Present Slideshow CTA on the Service Order (then Music) tab"
  - phase: 25-slides-tab-shell-plan-rail-and-slide-grid
    provides: "The Slides tab shell (SlidesTab.vue) that will host the relocated CTA — confirmed to have no present affordance yet"
provides:
  - "A recorded, human-approved decision (D-05) that Present Slideshow moves to the Slides tab, for 27-05 to implement verbatim"
affects: [27-05-strip-slideshow-preview, slides-tab, presentation-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "D-05 (recorded in 27-CONTEXT.md, resolved 2026-07-27): 'Present Slideshow' MOVES to the Slides tab. Add a ▶ Present CTA matching the mockup's page-header treatment; remove SlideshowPreview (and its preview list) from the Service Order tab."
  - "Selection did NOT match the checkpoint's recommended option (option-a: keep a bare Present button on the Service Order tab). The user chose to relocate the CTA to the Slides tab instead, with reason: presenting belongs alongside the slide content it presents, now that the Slides tab is the canonical home for all slide surfaces."
  - "Constraints on the move (binding on 27-05): PresentationViewer.vue and PresentationViewer.test.ts are NOT deleted or altered; the existing `presenting` flag and viewer mount are reused (no second mechanism); the CTA's enabled/disabled state follows the existing canPresent/hasAnySlides logic (Phase 23-04), not a new predicate."

patterns-established: []

requirements-completed: [R034]

coverage:
  - id: D1
    description: "Human decision recorded: Present Slideshow relocates to the Slides tab (D-05), unblocking 27-05's strip of SlideshowPreview from the Service Order tab without a capability regression."
    verification:
      - kind: manual_procedural
        ref: "27-CONTEXT.md D-05 section, dated 2026-07-27, cites the user's verbatim decision and rationale"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-27
status: complete
---

# Phase 27 Plan 01: Present Slideshow Checkpoint Decision Summary

**Recorded the human decision that "Present Slideshow" relocates to the Slides tab (D-05) rather than staying on the Service Order tab — resolving the checkpoint before any strip work begins, with zero source changes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-27T11:50:00Z
- **Completed:** 2026-07-27T11:55:00Z
- **Tasks:** 1 completed (checkpoint:decision)
- **Files modified:** 0

## Accomplishments
- Re-verified both facts the checkpoint's options rested on, against the current tree (not the planning-time snapshot): `PresentationViewer` is still imported by exactly one file (`src/views/ServiceEditorView.vue:1194`), and `src/components/slides/` still contains no present/play trigger anywhere (a grep of "present" across that directory returns only prose comments — including an unrelated Phase 25 "D-05" naming collision in `SlidesTab.vue` that is NOT a presentation trigger).
- Presented the decision, context, and all three options (option-a/b/c) to the developer per the plan's `<action>`.
- Recorded the resolved decision as **D-05** in `27-CONTEXT.md`: "Present Slideshow" MOVES to the Slides tab — a `▶ Present` CTA is added there (matching the mockup's page-header treatment) and `SlideshowPreview` (plus its preview list) is removed from the Service Order tab.
- This selection differs from the plan's recommended option (option-a, "keep a bare Present button on the Service Order tab"). The user's own reasoning is captured in D-05: presenting belongs with the slide content it presents now that the Slides tab is the canonical home for all slide surfaces, not left behind on the order-of-service tab.
- Confirmed the three binding constraints on 27-05's implementation: `PresentationViewer.vue`/`PresentationViewer.test.ts` are untouched; the existing `presenting` flag and viewer mount are reused (no second mechanism); the CTA's enabled/disabled state follows the existing `canPresent`/`hasAnySlides` logic (Phase 23-04), not a new predicate.

## Task Commits

This plan makes no source changes; its deliverable is the decision itself, already recorded in `27-CONTEXT.md` (commit `bddabf9`, "docs(27): record D-05 present CTA moves to Slides tab") prior to this SUMMARY.

1. **Task 1: Where does "Present Slideshow" live after the strip?** — checkpoint presented, human decided D-05 (relocate to Slides tab). No task-level commit (no files under `<files>` scope other than the SUMMARY itself, per `files_modified: []`).

**Plan metadata:** committed alongside this SUMMARY (see final metadata commit).

## Files Created/Modified
None — `git status --porcelain src/` is empty; this plan authors only its own SUMMARY, and the decision text lives in `27-CONTEXT.md` (already committed in a prior session at `bddabf9`).

## Decisions Made
- **D-05** (see `27-CONTEXT.md`): "Present Slideshow" MOVES to the Slides tab. A `▶ Present` CTA is added to the Slides tab (mockup page-header treatment); `SlideshowPreview` and its preview list are removed from the Service Order tab. This makes Phase 27 no longer a pure removal phase — a deliberate, user-approved exception to the "do not build anything new" rule, and that exception does not license building anything else.
- Selection did not match the plan's RECOMMENDED option (option-a). Recorded explicitly per the plan's instruction to "note explicitly whether the selection matched the recommended option."

## Deviations from Plan

None - plan executed exactly as written. The checkpoint was presented, not auto-approved (the plan's `autonomous: false` and `gate="blocking"` were honored), and no source file was touched.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 27-02 (this session, next) can proceed independently — it is a pure rename with no dependency on D-05.
- 27-05 (later, not in this session) has an unambiguous, written decision to implement: add the `▶ Present` CTA to the Slides tab reusing the existing `presenting` flag/viewer mount and `canPresent`/`hasAnySlides` logic, then remove `SlideshowPreview` from the Service Order tab. No re-asking required.
- Phase 23's outstanding batch human-verify checkpoint for the presentation viewer remains unaffected — D-05 explicitly preserves `PresentationViewer.vue` and its test file untouched.

---
*Phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium*
*Completed: 2026-07-27*
