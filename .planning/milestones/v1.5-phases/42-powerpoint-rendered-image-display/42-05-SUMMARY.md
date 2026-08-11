---
phase: 42-powerpoint-rendered-image-display
plan: 05
subsystem: slides
tags: [vitest, pure-functions, pptx-render, slideshow-assembler, reconciliation]

# Dependency graph
requires:
  - phase: 42-03
    provides: "src/utils/importedRenderReconciler.ts — resolveImportedRender, importedEntryIdentities, importedEntryContent, renderedPageNumberFromIdentity"
  - phase: 42-04
    provides: "slideGroupMaterializer.ts's two IMPORTED branches already consume the shared reconciler — the grid side of this pairing is correct and tested"
provides:
  - "slideshowAssembler.ts's two IMPORTED branches (resolveEntryContent's imported case, and the no-group fallback IMPORTED branch) now read from the shared reconciler instead of a direct deck.slides lookup"
  - "Proof (by test, not by reading) that the stored-group path and the no-group fallback path resolve identical content for every render state, that page 1 and the last page of a multi-page render resolve to their own URLs, and that a pending/failed entry is never omitted from the assembled slideshow"
affects: [42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The presenter engine (slideshowAssembler.ts, this plan) and the grid engine (slideGroupMaterializer.ts, 42-04) both consume the SAME reconciler rather than each deriving render state independently — closing the exact drift 42-CONTEXT.md names as the failure this phase exists to end"

key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts

key-decisions:
  - "resolveEntryContent's `imported` case keeps its existing `!deck` early return exactly as it was — only the content-resolution source changed, from a direct `deck.slides.find(...)` to `importedEntryContent(deck, resolveImportedRender(deck, render), ref.innerSlideId, urls)`. The render document and URL array lookups are keyed on `deck.renderImportId`, never `ref.importId`/`slot.importId` (T-42-07) — a deck missing `renderImportId` never touches either optional map, so a stale/mis-keyed render document present under some other id cannot leak under the wrong deck."
  - "The no-group fallback IMPORTED branch replaced its `deck.slides.forEach` entirely with `importedEntryIdentities(deck, resolution).forEach(...)` + `importedEntryContent` per identity, mirroring exactly what `slideGroupMaterializer.ts`'s `deriveGroupEntries` (42-04) already does with the same two calls — the fallback path and the stored-group path are now provably the same decision, not two hand-synchronized copies."
  - "The `if (!content) continue` omission guard in `assembleSlideshow` (line 411, `git diff` confirms zero touched lines) is left completely unmodified per the plan's hard constraint — it is made unreachable for a pending/failed entry because `importedEntryContent` never returns `undefined` in those modes, not by relaxing or removing the guard."
  - "Test fixtures (`makeRenderedImportedDeck`, `makeRenderDoc`, `makeRenderInputs`, `groupEntriesForRender`) stay local to the two new `describe` blocks appended at the end of the file, mirroring 42-04's `slideGroupMaterializer.test.ts` precedent — no existing shared fixture in the 1,817-line suite was touched, which is what proves D-16's byte-identical parsed-mode fallthrough for all 76 pre-existing tests."
  - "`groupEntriesForRender` builds stored-group test fixtures by calling the SAME `importedEntryIdentities` helper the materializer itself calls (imported into the test file for this purpose only) rather than hand-picking entry ids — so the stored-group tests exercise a group shaped exactly like 42-04's materializer would actually produce, not a shortcut that happens to pass."

requirements-completed: [R079, R080]

coverage:
  - id: D1
    description: "resolveEntryContent's imported case (stored-group path) routes through resolveImportedRender + importedEntryContent: page 1 and page 12 of a 12-page ready render resolve to their own distinct URLs (the phase's one indexing boundary); pending and failed renders resolve every entry to a defined, non-drawable object carrying no parsed body text, with the failed case carrying the failure reason straight off the render document; a ready render whose URL array has not resolved yet falls back to pending rather than a broken image or undefined."
    requirement: R080
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts describe('resolveEntryContent — imported with a render (stored-group path, R079/R080)'), first 4 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-05/D-07 count-disagreement matrix at the assembled level: a ready/3 render over a 5-parsed-slide deck assembles exactly 3 slides; a ready/8 render assembles 8, with the 3 slides beyond the parsed count present (not dropped) and each resolving through slideContentLabel to the generic 'IMAGE' value with no new vocabulary."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts describe('resolveEntryContent — imported with a render (stored-group path, R079/R080)'), 'D-07: a ready/3...' and 'D-07: a ready/8...' cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-06 absence assertion: for a ready render, no assembled slide's body, title, or altText equals any of the deck's parsed slide bodies — proving parsed text is never drawn once a render is ready, not merely that it is sometimes replaced."
    requirement: R080
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts describe('resolveEntryContent — imported with a render (stored-group path, R079/R080)'), 'D-06: for a ready render...' case"
        status: pass
    human_judgment: false
  - id: D4
    description: "The no-group fallback path resolves a ready render content-for-content the same as the stored-group path (ids differ only by construction, existing behaviour); a pending render on the fallback path assembles the full parsed-count number of slides with none omitted by the content guard (T-42-11); a deck with no renderImportId sharing a service with a rendered deck assembles exactly its own parsed slides, picking up nothing from the other deck's render (T-42-07)."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts describe('assembleSlideshow fallback — IMPORTED with a render (no-group path, R079/R080)'), 3 cases"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every pre-existing IMPORTED test in the 1,817+-line suite passes unchanged (no existing fixture sets renderImportId, D-16); grep confirms importedRenderReconciler appears exactly once (the import statement) and if (!content) continue appears exactly once, unmodified, in slideshowAssembler.ts; npm run type-check reports 0 errors; the bare npx vitest run wave-merge baseline is unchanged at 3 failing files."
    verification:
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/slideshowAssembler.test.ts (86 tests: 76 pre-existing unchanged + 10 new, 0 failures) + npm run type-check (0 errors) + grep -c importedRenderReconciler == 1 + grep -c 'if (!content) continue' == 1 + bare npx vitest run (3 failed files: storage.rules.test.ts, RosterView.test.ts, render-service/src/render.test.ts — documented baseline, no regression)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 05: The Presenter Consumes the Shared Reconciler Summary

**`slideshowAssembler.ts`'s two IMPORTED branches now read from the one shared reconciler instead of a direct `deck.slides` lookup — proven by 10 new tests that a pending/failed render is a present slide, page 1 and the last page of a multi-page render resolve to their own URLs, and the grid and presenter agree content-for-content.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-07T10:55:00Z
- **Completed:** 2026-08-07T11:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `resolveEntryContent`'s `imported` case now resolves render state through `resolveImportedRender` + `importedEntryContent` instead of a direct `deck.slides.find(...)` — for a pending or failed render it now returns a DEFINED, non-drawable object, so `assembleSlideshow`'s pre-existing `if (!content) continue` guard (byte-unchanged, `grep -c` confirms exactly 1 occurrence) can never omit it and silently shorten a live slideshow mid-service.
- The no-group fallback `IMPORTED` branch replaced its `deck.slides.forEach` entirely with `importedEntryIdentities(deck, resolution)` + `importedEntryContent` per identity — the fallback path now agrees slide-for-slide with the stored-group path by construction, the same guarantee the SCRIPTURE fallback's own comment already required for its kind.
- Both branches key render/URL lookups on `deck.renderImportId`, never `ref.importId`/`slot.importId` — the two identifiers stay deliberately distinct (T-42-07), matching 42-04's precedent in `slideGroupMaterializer.ts`.
- 10 new tests across two `describe` blocks prove, rather than assume: R080's one indexing boundary (page 1 and page 12 of a 12-page render resolve to distinct URLs), the pending/failed/URL-not-yet-resolved non-drawable-object guarantee, D-05/D-07's count-disagreement matrix (ready/3 → 3 slides, ready/8 → 8 slides with 3 surplus present and labeled `IMAGE`), D-06's absence assertion (no assembled slide carries parsed body text once a render is ready), the fallback-vs-stored-group content parity, T-42-11's pending-render no-omission guarantee, and T-42-07's cross-deck isolation.
- All 76 pre-existing tests in the suite pass byte-unchanged — no existing fixture sets `renderImportId`, so every one of them still exercises the `parsed`-mode fallthrough exactly as before (D-16).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire the stored-group and no-group IMPORTED paths onto the shared reconciler** - `361d4fc` (feat)
2. **Task 2: Prove the two paths agree, that parsed text is never drawn, and that page indexing is 1-based** - `f865b5f` (test)

**Plan metadata:** committed separately by the state-update step.

## Files Created/Modified
- `src/utils/slideshowAssembler.ts` - `resolveEntryContent`'s `imported` case and the no-group fallback `IMPORTED` branch rewired onto `importedRenderReconciler.ts`'s `resolveImportedRender`/`importedEntryIdentities`/`importedEntryContent`
- `src/utils/__tests__/slideshowAssembler.test.ts` - two new `describe` blocks (10 tests) plus local-only fixtures (`makeRenderedImportedDeck`, `makeRenderDoc`, `makeRenderInputs`, `groupEntriesForRender`)

## Decisions Made
- Render document and URL array lookups key on `deck.renderImportId`, never `ref.importId`/`slot.importId` — see `key-decisions` in frontmatter (T-42-07 defense in depth, matching 42-04's precedent).
- New test fixtures stay local to the two new `describe` blocks rather than widening any of the suite's 30+ shared fixtures — preserves D-16's proof for the 76 pre-existing tests.
- The stored-group test fixtures build their `GroupSlideEntry` lists through the same `importedEntryIdentities` helper the materializer calls, rather than hand-picking ids, so those tests exercise a group shaped exactly like 42-04's materializer would actually produce.

## Deviations from Plan

None - plan executed exactly as written. Both acceptance-criteria greps (`importedRenderReconciler` count == 1, `if (!content) continue` count == 1) passed on the first attempt, so no rephrasing was needed (unlike 42-04's Task 1, whose doc comments needed a wording adjustment to avoid tripping its own grep gates — this plan's doc comments were written with that lesson already applied).

## Issues Encountered

None. `npm run type-check` (`vue-tsc --build`) reported 0 errors after both tasks. The targeted suite ran at 86 tests (76 pre-existing + 10 new), 0 failures. A full wave-merge `npx vitest run` ran at 2809 passing / 13 failing across 2822 tests, with the 13 failures confined to the documented 3-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, `render-service/src/render.test.ts`) — no regression introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `slideshowAssembler.ts`'s IMPORTED branches are fully wired to the shared reconciler and proven by test; the grid (42-04) and the presenter (this plan) now provably resolve identical content for every render state.
- 42-06 (the failure-sentence lookup referenced by `SlideBase.renderFailureReason`'s doc comment) and later plans consuming `renderState`/`renderFailureReason` on `AssembledSlide.slide` can proceed with confidence that both resolution paths populate those fields identically.
- No blockers.

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

Both modified files (`src/utils/slideshowAssembler.ts`, `src/utils/__tests__/slideshowAssembler.test.ts`)
confirmed present on disk; both task commit hashes (`361d4fc`, `f865b5f`) confirmed in git history.
Wave-merge bare `npx vitest run` confirmed the documented 3-failed-file baseline
(`render-service/src/render.test.ts`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`)
exactly — no regression.
