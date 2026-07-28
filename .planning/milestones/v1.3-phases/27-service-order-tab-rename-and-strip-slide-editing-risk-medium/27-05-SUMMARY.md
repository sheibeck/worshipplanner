---
phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
plan: 05
subsystem: ui
tags: [vue, vitest, removal, service-editor, presentation, slides-tab, D-05]

# Dependency graph
requires:
  - phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
    provides: "27-01's recorded D-05 decision (Present Slideshow relocates to the Slides tab) and 27-02/27-03/27-04's prior strips, leaving SlideshowPreview as the last slide-editing surface on the Service Order tab"
provides:
  - "Service Order tab renders no slide content at all — the last surface (SlideshowPreview) is gone (R034)"
  - "A '> Present' CTA on the Slides tab (SlidesTab.vue), reusing the existing presenting flag and PresentationViewer mount (D-05)"
  - "Phase 27 closed: full unit suite failing FILE SET verified unchanged at the 10-file baseline"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Presentation trigger relocated to a child tab component via a plain emit ('present'), while the owning parent view keeps sole ownership of the `presenting` flag and the PresentationViewer mount — no second flag/mount introduced."]

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/slideDisplay.ts
  deleted:
    - src/components/SlideshowPreview.vue
    - src/components/__tests__/SlideshowPreview.test.ts

key-decisions:
  - "Implemented D-05 verbatim (recorded in 27-01-SUMMARY.md / 27-CONTEXT.md): 'Present Slideshow' moves to the Slides tab as a new '> Present' CTA; SlideshowPreview (and its preview list) is removed from the Service Order tab. This is NOT any of the plan's original option-a/b/c — the user's actual selection was recorded during 27-01's checkpoint and this plan implements that recorded decision, not the plan text's stale option menu."
  - "canPresent restated directly as `assembledSlideshow.length > 0` inside SlidesTab.vue rather than reintroducing the AssembledSection[] grouping SlideshowPreview used only to render its now-removed preview list — verified equivalent to the prior hasAnySlides/canPresent alias (Phase 23-04), not a new predicate."
  - "PresentationViewer's mount site moved from the Service Order tab panel to the Slides tab panel (both under ServiceEditorView.vue, which remains sole owner of the `presenting` ref and the assembly composable) — cosmetic relocation only, since PresentationViewer Teleports to <body> and its visibility never depended on tab v-show ancestry."
  - "SlidesTab.vue's template restructured (rail+grid wrapped in an inner flex row, present-CTA header row added above it) rather than mounting the CTA inside SlidePlanRail or SlideGrid — keeps the new affordance's markup and disabled-state logic entirely local to SlidesTab, with zero prop changes to its children."
  - "Deleted SlideshowPreview.vue and its test file after re-verifying (against the current tree, not the planning-time snapshot) that no importer remained beyond its own test file (D-02/D-19)."
  - "Corrected the one prose reference to SlideshowPreview.vue in slideDisplay.ts; left PresentationViewer.vue's own prose reference to SlideshowPreview.vue untouched, since the plan's prohibition against disturbing PresentationViewer's file was read as covering prose too, not only code/assertions."

patterns-established:
  - "Test probe re-seating: swap a component-identity probe (`findComponent(X)`) for a data-testid seam BEFORE removing X, verified green with X still mounted, so seam-vs-target equivalence is proven before the removal that would otherwise make the swap look like it 'fixed' something."

requirements-completed: [R034, R018]

coverage:
  - id: D1
    description: "The Service Order tab renders no slide content — SlideshowPreview (the last remaining slide-editing surface on that tab) is gone (R034)."
    requirement: R034
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (52/52 real tests pass; no SlideshowPreview import or usage remains in src/views/ServiceEditorView.vue)"
        status: pass
      - kind: other
        ref: "grep -rn 'import.*SlideshowPreview' src -> no matches; grep -rl SlideshowPreview src -> only prose comments (PresentationViewer.vue, slideDisplay.ts, SlidesTab.vue, ServiceEditorView.vue), zero code references"
        status: pass
    human_judgment: false
  - id: D2
    description: "27-01's recorded decision (D-05) is implemented exactly as written: a '> Present' CTA on the Slides tab, reusing the existing `presenting` flag and PresentationViewer mount, gated on the existing canPresent/hasAnySlides condition — no planner substitution, no new mechanism."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#'mounts PresentationViewer when the Slides tab emits present (D-05)...' and #'passes the same assembledSlideshow array instance to PresentationViewer across re-renders...' (both pass)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts (27/27 pass, incl. pre-existing coverage unaffected by the new CTA)"
        status: pass
      - kind: other
        ref: "PresentationViewer.vue and PresentationViewer.test.ts confirmed present on disk and their own suite (57/57) passes unmodified"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every panel-visibility assertion in ServiceEditorView.test.ts probes the Service Order tab's own seam (data-testid=service-order-panel) rather than a slide component."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (5 sites re-seated across the Slides-tab and Edit-in-scripture describe blocks; zero remaining findComponent(SlideshowPreview) visibility probes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 26's 'Edit in scripture' relay still switches to the Service Order tab and opens the requested passage editor."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts 'ServiceEditorView - Edit in scripture plumbing (Phase 26-03)' describe block (9/9 pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full unit suite's failing FILE SET is unchanged at the recorded ten-file baseline — no eleventh."
    verification:
      - kind: unit
        ref: "npx vitest run src/ -> 10 failed test files (8 .gsd/quarantine/worktrees/** stale duplicates across rules.test.ts/services.test.ts/RosterView.test.ts/ServiceEditorView.test.ts x2 dirs, src/storage.rules.test.ts needing the Storage emulator, src/views/__tests__/RosterView.test.ts's known stale 'Roles config' assertion); 155 passed / 3496 tests passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "type-check and production build both stay green through every source change in this plan."
    verification:
      - kind: other
        ref: "npm run type-check (0 errors); npm run build (succeeds)"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-07-27
status: complete
---

# Phase 27 Plan 05: Strip the Slideshow Preview and Relocate Present to the Slides Tab (D-05) Summary

**Re-seated five panel-visibility test probes off SlideshowPreview and onto the Service Order tab's own data-testid seam, then implemented 27-01's recorded D-05 decision verbatim: added a "> Present" CTA to the Slides tab (SlidesTab.vue) that reuses ServiceEditorView's existing `presenting` flag and PresentationViewer mount, removed SlideshowPreview from the Service Order tab, and deleted the now-orphaned component and its test file — closing Phase 27 with the full-suite failing file set unchanged at its ten-file baseline.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-27T08:44:00Z
- **Completed:** 2026-07-27T09:39:00Z
- **Tasks:** 3 completed
- **Files modified:** 6 (4 modified, 2 deleted)

## Accomplishments

- **Task 1:** Re-seated all five `isVShowHidden(wrapper.findComponent(SlideshowPreview))` panel-visibility probes in `ServiceEditorView.test.ts` onto `wrapper.find('[data-testid="service-order-panel"]')` — three in the `Slides tab (Phase 25-03)` describe block, two in the `Edit in scripture plumbing (Phase 26-03)` describe block. No expectation changed; the file stayed green with SlideshowPreview still mounted, confirming the seam and the preview share the same visibility ancestor before the removal that follows.
- **Task 2:** Read `27-01-SUMMARY.md` and `27-CONTEXT.md`'s D-05 section and implemented the recorded decision exactly as written (not any of the plan text's original option-a/b/c, since the actual user selection diverged from all three and was captured separately during the 27-01 checkpoint). Removed the `SlideshowPreview` usage and import from `ServiceEditorView.vue`, dropped the now-unused `assembledSections` destructure entry (the composable's own export and tests untouched), added a `> Present` button to `SlidesTab.vue` (gated on a locally-computed `canPresent = assembledSlideshow.length > 0`, matching the mockup's page-header ghost-button treatment), wired its new `present` emit to `ServiceEditorView`'s existing `presenting = true` handler, and moved the `PresentationViewer` mount alongside the Slides tab's own panel (a cosmetic relocation only — `PresentationViewer` Teleports to `<body>`, so its visibility never depended on tab `v-show` ancestry). Verified no importer remained for `SlideshowPreview.vue` beyond its own test file, then deleted both. Rewrote the three Phase 20-04 tests that exercised the preview's present affordance to instead emit `present` from `SlidesTab`, and deleted the now-meaningless "mounts the SlideshowPreview panel" test. Corrected the one prose reference to `SlideshowPreview.vue` in `slideDisplay.ts`. `ServiceEditorView.test.ts` (52/52 real tests), `useSlideshowAssembly.test.ts` (45/45), and `SlidesTab.test.ts` (27/27) all pass; `PresentationViewer.vue`/`PresentationViewer.test.ts` confirmed present and its 57/57 tests pass unmodified; `npm run type-check` (0 errors) and `npm run build` (succeeds).
- **Task 3:** Ran the full unit suite (`npx vitest run src/`) and confirmed the failing FILE SET is exactly the recorded ten-file baseline, no eleventh: the two `.gsd/quarantine/worktrees/**` copies each of `rules.test.ts`, `services.test.ts`, `RosterView.test.ts` and `ServiceEditorView.test.ts` (8 files, pre-existing stale debris/emulator-dependent/`crypto.randomUUID` environment gaps), `src/storage.rules.test.ts` (needs the Storage emulator, deliberately not started), and `src/views/__tests__/RosterView.test.ts`'s known stale `"Roles config"` assertion. 155 files / 3496 tests passed. The rules test script was never run and the emulator was never touched. Confirmed at the code level: the first tab reads "Service Order" with `data-testid="service-order-panel"`; no deck editor, deck import, media attachment, or slide preview surface remains anywhere on it (`grep` for each returns nothing but this plan's own removal-prose comments); `ScriptureSlideEditor` (D-01) and the section-assignment `<select>` (D-04) both still render on it; the group delete cascade + its warning, `expandScriptureEditor`/`handleNavigateToScriptureEditor`, the lazy `ServiceSlot.id` backfill, and the 800ms autosave debounce are all still present and exercised by the passing suite. `npm run type-check` (0 errors) and `npm run build` (succeeds) confirmed a second time against the final tree.

## Task Commits

Each task was committed atomically:

1. **Task 1: Probe the tab panel by its own seam, not by what is inside it** - `2739062` (test)
2. **Task 2: Apply 27-01's recorded decision** - `64b5aaa` (feat)
3. **Task 3: Phase-wide gate against the recorded baseline** - this SUMMARY + final metadata commit (no source changes; verification only)

**Plan metadata:** committed alongside this SUMMARY (see final metadata commit).

## Files Created/Modified

- `src/views/__tests__/ServiceEditorView.test.ts` - Re-seated 5 panel-visibility probes onto `[data-testid="service-order-panel"]`; rewrote 3 Phase 20-04 present/viewer tests to emit from `SlidesTab` instead of `SlideshowPreview`; deleted the "mounts the SlideshowPreview panel" test; removed the now-unused `SlideshowPreview` import
- `src/views/ServiceEditorView.vue` - Removed `SlideshowPreview` usage, its import, and the `assembledSections` destructure entry; moved the `PresentationViewer` mount + `presenting` flag wiring alongside the Slides tab, listening to `SlidesTab`'s new `present` emit
- `src/components/slides/SlidesTab.vue` - Added a `> Present` CTA (header row above the rail+grid), a `present` emit, and a local `canPresent` computed (`assembledSlideshow.length > 0`)
- `src/components/slides/slideDisplay.ts` - Corrected one prose reference naming the deleted `SlideshowPreview.vue`
- `src/components/SlideshowPreview.vue` - Deleted (orphaned by the removal, D-02/D-19; last remaining slide-editing surface on the Service Order tab)
- `src/components/__tests__/SlideshowPreview.test.ts` - Deleted alongside its component

## Decisions Made

- **D-05 implemented verbatim** (see `27-01-SUMMARY.md` / `27-CONTEXT.md`): Present Slideshow moves to the Slides tab; SlideshowPreview and its preview list are removed from the Service Order tab. This plan explicitly did NOT follow its own original option-a/b/c text — those were superseded by the actual recorded human decision from the 27-01 checkpoint, which the plan's own instructions required reading and implementing over the stale option menu.
- `canPresent` restated directly against `assembledSlideshow.length > 0` inside `SlidesTab.vue` rather than reintroducing the `AssembledSection[]` grouping — verified equivalent to the prior `hasAnySlides`/`canPresent` alias (Phase 23-04), not a new predicate, per D-05's binding constraint.
- `PresentationViewer`'s mount site relocated from the Service Order tab panel to the Slides tab panel — purely cosmetic since it Teleports to `<body>` and was never actually gated by tab `v-show` visibility; done to keep the trigger and the mount conceptually co-located now that presenting is a Slides-tab affordance.
- Left `PresentationViewer.vue`'s own prose comment naming `SlideshowPreview.vue` untouched — the plan's prohibition against disturbing `PresentationViewer.vue` beyond what the removal strictly forces was read to include its prose, not only its code and test assertions.

## Deviations from Plan

**1. [Rule 4 resolved by 27-01, not this plan] Task 2's option-a/b/c menu did not match the recorded decision**
- **Found during:** Task 2, reading `27-01-SUMMARY.md` before implementing
- **Issue:** The plan text's Task 2 action offered three options (a/b/c) and instructed "if it names none, or names more than one, stop and report." The user's actual selection — recorded during the 27-01 checkpoint as D-05 — differs from all three: it relocates the Present CTA to the Slides tab, which none of options a/b/c described.
- **Resolution:** This was not a deviation this plan introduced or resolved unilaterally — it was already resolved as a human decision in a prior plan (27-01), whose SUMMARY and the phase's own `27-CONTEXT.md` D-05 section this plan was instructed to read and implement exactly. No stopping/reporting was needed because the decision was already unambiguous and on record; implementing anything else (i.e., literally following the stale option-a/b/c text) would itself have been the planner-discipline violation this plan's prohibitions warn against.
- **Files modified:** See Task 2 above.
- **Commit:** `64b5aaa`

No other deviations — Rules 1-3 auto-fixes were not needed; the implementation matched D-05's binding constraints (reuse the existing flag/mount, reuse the existing canPresent condition, do not delete or disturb PresentationViewer's assertions) exactly.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Component Disposition (Phase 27 final ledger)

| Component | Fate | Verified |
|---|---|---|
| `PptxImportModal` | Stripped from this tab (27-03); component file survives — `SlideGrid.vue` still imports it | Confirmed 27-03 |
| `ScriptureSlideEditor` | STAYS (D-01) | Confirmed this plan — still mounted, `ScriptureSlideEditor` import present |
| `ImportedSlideEditor` | Removed and deleted (27-03/27-04 lineage) | Confirmed prior plans |
| `SlotMediaAttachment` | Removed and deleted (27-04) | Confirmed 27-04-SUMMARY.md |
| Section-assignment `<select>` | STAYS (D-04) | Confirmed this plan — `data-testid="section-select"` still renders |
| `SlideshowPreview` | Removed and deleted (this plan, D-02/D-19) | Confirmed this plan |
| `PresentationViewer` | **Forbidden from deletion under every option** — untouched, mount relocated to Slides tab, no assertions disturbed | Confirmed this plan (57/57 own tests pass) |

## Next Phase Readiness

- **Phase 27 is closed.** The Service Order tab now contains only genuine service-order content: the slot list, per-slot section assignment (D-04), scripture passage/reading-mode editing (D-01), the group delete cascade + warning, autosave, and the lazy `ServiceSlot.id` backfill. Every slide-editing surface named in the phase's fate table has either been removed (with its component deleted where orphaned) or relocated with a working replacement affordance (Presenting, via D-05).
- **v1.3 debt note:** none introduced by this plan — D-05 preserved the presenting capability end-to-end (unlike the plan's original option-c, which would have created v1.3 debt by removing presenting entirely). Phase 23's outstanding batch human-verify checkpoint for `PresentationViewer` remains exactly as it was; this plan adds one more manual check to that same batch — confirm the new "> Present" CTA on the Slides tab actually opens the presentation and that the button's location matches user expectation now that it lives beside the slide content it presents.
- Milestone-level next step: proceed to Phase 28 (per `.planning/ROADMAP.md`), or run the deferred batch human-verify covering Phases 20-23 + 25-27's outstanding checkpoints together.

---
*Phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND: src/components/slides/SlidesTab.vue
- FOUND: src/components/slides/slideDisplay.ts
- FOUND: src/components/PresentationViewer.vue
- FOUND: src/components/__tests__/PresentationViewer.test.ts
- CONFIRMED-DELETED: src/components/SlideshowPreview.vue
- CONFIRMED-DELETED: src/components/__tests__/SlideshowPreview.test.ts
- FOUND: 2739062 (Task 1 commit)
- FOUND: 64b5aaa (Task 2 commit)
- FOUND: .planning/phases/27-service-order-tab-rename-and-strip-slide-editing-risk-medium/27-05-SUMMARY.md
