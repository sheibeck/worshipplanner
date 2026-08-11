---
phase: 42-powerpoint-rendered-image-display
plan: 03
subsystem: slides
tags: [vitest, tdd, pure-functions, pptx-render, slide-types]

# Dependency graph
requires:
  - phase: 42-02
    provides: PptxRenderDoc client type, renderedPagePaths.ts (1-based/4-padded path convention), usePptxRenders store
provides:
  - "src/utils/importedRenderReconciler.ts — the ONE shared, pure render-status decision table (resolveImportedRender, importedEntryIdentities, renderedPageNumberFromIdentity, importedEntryContent, importedSourceSignature) both slideGroupMaterializer.ts and slideshowAssembler.ts will call in 42-04/42-05"
  - "SlideBase.renderState/renderFailureReason optional fields for the two UI surfaces (SlideCard.vue/PresentationViewer.vue) to branch on in 42-06/42-07"
  - "AssemblyInputs.pptxRendersByImportId/renderedImageUrlsByImportId optional maps, keyed by renderImportId (not ImportedDeck.id)"
  - "Fixed the pre-existing IMPORTED sourceSignature pipe-delimiter collision hazard (not yet consumed until 42-04 rewires slideGroupMaterializer.ts to call importedSourceSignature)"
affects: [42-04, 42-05, 42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared pure reconciliation helper consumed by two independent engines, rather than duplicating a decision table — the pattern 42-CONTEXT.md named as the entire reason this phase exists"
    - "renderedCount wins unconditionally in the ready state, with one named self-contradictory carve-out (ready + renderedCount absent/<1 -> failed), rather than any max()/min() reconciliation against the parsed count"
    - "\\x1e/\\x1f ASCII control-character field separators for a change-detection signature, reused from the SCRIPTURE branch's existing precedent, replacing an unsafe '|'/':' delimiter scheme"

key-files:
  created:
    - src/utils/importedRenderReconciler.ts
    - src/utils/__tests__/importedRenderReconciler.test.ts
  modified:
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/utils/slideshowAssembler.ts

key-decisions:
  - "resolveImportedRender checks `!deck.renderImportId` FIRST, unconditionally, before even looking at `render` — a deck with no renderImportId is `parsed` mode no matter what a stale/mis-keyed render map might otherwise contain (D-16, T-42-07 defense in depth)."
  - "The `status: 'ready'` + `renderedCount` absent-or-`< 1` carve-out resolves to `{ mode: 'failed', entryCount: deck.slides.length }` with explicitly NO `failureReason` — so the generic fallback sentence 42-06 introduces applies, per the plan's must_have."
  - "importedSourceSignature is not yet wired into slideGroupMaterializer.ts's existing (unsafe, pipe-delimited) sourceSignature IMPORTED branch — that rewire is 42-04's file per the plan's file list. This plan only produces the fixed, shared implementation; the pipe hazard in slideGroupMaterializer.ts:196-197 is fixed at the point 42-04 replaces that branch with a call into this module."
  - "AssemblyInputs' two new maps are OPTIONAL, verified against the existing ~4,200-line engine test suite with zero fixture changes needed (grep confirmed no existing fixture sets renderImportId)."

patterns-established:
  - "A slide's renderState field is documented as the discriminator every consumer must check FIRST, ahead of contentKind — established here on SlideBase for 42-06/42-07's SlideCard.vue/PresentationViewer.vue branches to follow."

requirements-completed: [R079, R080]

coverage:
  - id: D1
    description: "resolveImportedRender implements the full render decision table: no-renderImportId -> parsed, no/pending render -> pending, failed render (with or without a stale renderedCount) -> failed, ready with renderedCount >= 1 -> ready at that exact count (under/at/over parsed length), and the self-contradictory ready+renderedCount<1 carve-out -> failed with no failureReason."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/importedRenderReconciler.test.ts (describe('resolveImportedRender'), 13 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "importedEntryIdentities mints synthetic rendered-page-N identities in ready mode (never deck.slides[i].id pairing) and reuses deck.slides ids elsewhere; renderedPageNumberFromIdentity parses that identity back, rejecting page 0 and non-numeric suffixes."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/importedRenderReconciler.test.ts (describe('importedEntryIdentities') + describe('renderedPageNumberFromIdentity'), 9 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "importedEntryContent resolves parsed/pending/failed/ready content, with the deck's parsed body text absent from pending and failed placeholders, and a ready entry with a missing/short URL falling back to pending rather than a broken image."
    requirement: R080
    verification:
      - kind: unit
        ref: "src/utils/__tests__/importedRenderReconciler.test.ts (describe('importedEntryContent'), 9 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "importedSourceSignature replaces the pipe-delimited encoding with \\x1e/\\x1f separators so two decks whose parsed text differs only by a literal pipe character no longer collide; mode+renderedCount participate so pending/failed/ready are always distinguishable."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/importedRenderReconciler.test.ts (describe('importedSourceSignature'), 3 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "SlideBase gains renderState/renderFailureReason optional fields and AssemblyInputs gains the two renderImportId-keyed maps, with zero existing behavior changed (925 pre-existing tests unaffected, type-check clean)."
    requirement: R079
    verification:
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/ src/composables/__tests__/ (958 tests, 925 pre-existing + 33 new, 0 failures) + npm run type-check (0 errors)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 03: The One Shared Pure Reconciler Summary

**`src/utils/importedRenderReconciler.ts` — the single render-decision-table helper (resolveImportedRender/importedEntryIdentities/renderedPageNumberFromIdentity/importedEntryContent/importedSourceSignature) both assembly engines will consume, plus the two `SlideBase` render-state fields and two `AssemblyInputs` maps it needs.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-07T06:20:00-04:00
- **Completed:** 2026-08-07T06:36:00-04:00
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `src/types/slide.ts`: `SlideBase.renderState`/`renderFailureReason` optional fields, documented as the discriminator every consumer must branch on first.
- `src/utils/slideshowAssembler.ts`: `AssemblyInputs.pptxRendersByImportId`/`renderedImageUrlsByImportId`, both keyed by `renderImportId` (not `ImportedDeck.id`) with the T-42-07 conflation warning documented in-place; both optional so all ~4,200 lines of existing engine tests pass unedited.
- `src/types/slideGroup.ts`: comment-only note on `SourceRef`'s `imported.innerSlideId` accepting either a parsed id or the reconciler's synthetic `rendered-page-N` identity — no shape widening needed.
- `src/utils/importedRenderReconciler.ts`: the full render decision table as one pure module (no Firestore/Storage/Vue imports, no `deck.slides[` index access outside comments) — `renderedCount` wins unconditionally in the ready state; the `ready` + `renderedCount` absent/`<1` case is a named carve-out resolving to `failed` rather than zero entries; and the IMPORTED `sourceSignature` delimiter hazard is fixed via `\x1e`/`\x1f` separators.
- `src/utils/__tests__/importedRenderReconciler.test.ts`: 33 tests covering every bullet in the plan's behavior block, including the explicit pipe-collision case and the pending/failed "no deck text leaks" assertions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Render-state slide fields and the two AssemblyInputs maps** - `3f281a0` (feat)
2. **Task 2: The one shared pure reconciler** - `84f4d23` (test, RED) then `836df88` (feat, GREEN)

**Plan metadata:** committed separately by the state-update step.

## Files Created/Modified
- `src/types/slide.ts` - `SlideBase.renderState`/`renderFailureReason` optional fields
- `src/types/slideGroup.ts` - comment-only `SourceRef` doc note (no shape change)
- `src/utils/slideshowAssembler.ts` - `AssemblyInputs.pptxRendersByImportId`/`renderedImageUrlsByImportId`
- `src/utils/importedRenderReconciler.ts` - the new shared pure reconciler (5 exported functions, 1 exported const, 2 exported types)
- `src/utils/__tests__/importedRenderReconciler.test.ts` - 33-test full decision-table coverage

## Decisions Made
- `resolveImportedRender` checks the absent-`renderImportId` case unconditionally first — see `key-decisions` in frontmatter.
- The self-contradictory `ready`/`renderedCount<1` carve-out resolves to `failed` with no `failureReason` — see `key-decisions`.
- `importedSourceSignature` is a standalone fixed implementation in this plan; wiring `slideGroupMaterializer.ts`'s existing IMPORTED branch to call it (replacing the still-unsafe pipe-delimited form there) is 42-04's job per the plan's file list — see `key-decisions`.
- The two new `AssemblyInputs` fields are optional, verified against the existing engine-test corpus with zero fixture edits — see `key-decisions`.

## Deviations from Plan

None — plan executed exactly as written. One test-authoring self-correction during Task 2's GREEN step: the first draft of the `importedEntryContent` "parsed mode" test picked slide id `is-2` (which the alternating text/image fixture makes a `TextSlide`) while asserting an `ImageSlide` shape; corrected to `is-1` before the GREEN commit. This was a test-fixture bug caught and fixed inside the same TDD cycle, not a deviation from the plan's behavior contract — the corrected assertion is what the plan's behavior block actually specifies (`mode: 'parsed'` strips `id`/`position` and returns the rest, whatever slide kind it is).

## Issues Encountered

None. `npm run type-check` (`vue-tsc --build`) reported 0 errors after both tasks. The regression guard (`npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/ src/composables/__tests__/`) ran at 958 passing tests (925 pre-existing + 33 new), 0 failures, 0 regressions. The full bare `npx vitest run` reproduced the documented 3-file baseline exactly (`render-service/src/render.test.ts`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) with no new failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shared reconciler (`importedRenderReconciler.ts`) is fully implemented and unit-tested; 42-04 can now rewire `slideGroupMaterializer.ts`'s `deriveGroupEntries`/`sourceSignature` IMPORTED branches to call it (which is also where the pipe-delimiter fix actually takes effect for stored data).
- 42-05 can rewire `slideshowAssembler.ts`'s `resolveEntryContent`/fallback IMPORTED branches to call it.
- 42-06/42-07 have `SlideBase.renderState`/`renderFailureReason` to branch `SlideCard.vue`/`PresentationViewer.vue` on, plus the `'IMAGE'` generic label decision already settled (no `slideDisplay.ts` change needed for labeling per this plan's Planner Decision 3).
- No blockers.

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed the full RED/GREEN cycle: `test(42-03)` commit `84f4d23` (33 tests, confirmed failing — module did not exist — before any implementation) followed by `feat(42-03)` commit `836df88` (implementation, all 33 tests passing). No REFACTOR commit was needed — the GREEN implementation required no post-hoc cleanup.

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 5 created/modified source files confirmed present on disk; all 3 task commit hashes
(`3f281a0`, `84f4d23`, `836df88`) confirmed in git history.
