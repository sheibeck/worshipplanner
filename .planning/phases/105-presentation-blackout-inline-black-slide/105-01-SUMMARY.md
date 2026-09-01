---
phase: 105-presentation-blackout-inline-black-slide
plan: 01
subsystem: presentation
tags: [typescript, slide-assembly, lyric-editor, data-model]

# Dependency graph
requires:
  - phase: 53-manual-slide-splits
    provides: sliceSectionIntoSlides / the lyric-split lockstep discipline both assembler paths follow
provides:
  - "LyricSection.kind?: 'lyric'|'blackout' — additive, no-migration content-kind field"
  - "BlackoutSlide type + widened SlideContentKind/Slide union in src/types/slide.ts"
  - "addSection(sections, order, 'BLACKOUT') minting rule in songSectionOrder.ts"
  - "buildSectionRows numbering-exclusion for blackout rows (R304)"
  - "assembleSlideshow blackout branch at all 3 lyric-resolution sites (stored-group, no-group fallback, resolveEntryContent)"
  - "slideContentLabel/slideBodyText/slideFooterLabel blackout copy (BLACKOUT / Solid black / Black Slide)"
affects: [105-02-editor-ui, 105-03-render-and-runcontrol]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive content-kind discriminator on a pooled domain type (LyricSection.kind), mirroring the existing SlideContentKind discriminated-union pattern rather than widening SourceRef"
    - "One-line blackout branch inserted at each of the 3 lyric-resolution call sites, short-circuiting sliceSectionIntoSlides rather than teaching it about empty content"

key-files:
  created: []
  modified:
    - src/types/slide.ts
    - src/types/songLyrics.ts
    - src/utils/songSectionOrder.ts
    - src/utils/__tests__/songSectionOrder.test.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts

key-decisions:
  - "Blackout is a distinct SlideContentKind/LyricSection.kind, not an empty LyricSection or a SourceRef change — matches 105-CONTEXT.md's explicit data-model decision and keeps position-derived numbering machinery untouched for every other kind."
  - "buildSectionRows skips kindOrdinals/numberBySectionId entirely for a blackout row and uses its own stored label as displayLabel verbatim — proven via an explicit [Verse, blackout, Chorus] numbering-integrity test (R304)."
  - "The assembler's blackout branch short-circuits sliceSectionIntoSlides (continue after emitting exactly one slide) rather than relying on the slicer to naturally produce one empty group from lines:[], since that behavior isn't guaranteed by sliceSectionIntoSlides's contract."

patterns-established:
  - "A pooled section's 'kind' field is read at the START of each resolution branch (resolveEntryContent's lyric case, the stored-group entry loop, the no-group fallback loop) before any per-kind processing — future content kinds on LyricSection should follow the same early-branch shape."

requirements-completed: [R302, R303, R304]

coverage:
  - id: D1
    description: "addSection('BLACKOUT') mints a LyricSection with kind:'blackout', lines:[], label 'Black Slide' (numbered 'Black Slide 2' on collision); a normal lyric-kind add stays byte-identical (no kind field written)"
    requirement: R302
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#addSection(\"BLACKOUT\") (R302)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildSectionRows excludes a blackout row from per-kind lyric numbering (kindOrdinals/numberBySectionId) while still assigning it a correct position/occurrenceIndex/isRepeat as a first-class row — inserting a blackout between lyric sections leaves their displayLabel unchanged"
    requirement: R304
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#buildSectionRows — blackout sections (R304)"
        status: pass
    human_judgment: false
  - id: D3
    description: "assembleSlideshow emits exactly one contentKind:'blackout' AssembledSlide for a blackout section on BOTH the stored-group path and the no-group fallback path, in correct order position, carrying no lyric fields, honoring entry/bed audio precedence"
    requirement: R303
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — blackout slides (R302/R303, Plan 105-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "slideContentLabel/slideBodyText/slideFooterLabel return 'BLACKOUT'/'Solid black'/'Black Slide' for a blackout slide, keeping all three switches exhaustive over the widened SlideContentKind"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#slideContentLabel / slideBodyText / slideFooterLabel — blackout"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-01
status: complete
---

# Phase 105 Plan 01: Blackout Data Model + Resolution + Numbering Integrity Summary

**Additive `LyricSection.kind?: 'lyric'|'blackout'` field + `BlackoutSlide` union member, resolved through 3 assembler branches into a `contentKind:'blackout'` AssembledSlide, with numbering-integrity proof for R304.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-01T02:13:00-04:00 (approx.)
- **Completed:** 2026-09-01T02:19:45-04:00
- **Tasks:** 3/3
- **Files modified:** 8

## Accomplishments
- `LyricSection.kind?: 'lyric'|'blackout'` (additive, no migration) and a `BlackoutSlide` variant widening `SlideContentKind`/`Slide` in `src/types/slide.ts` — no `SourceRef` change, matching 105-CONTEXT.md's data-model decision.
- `addSection(sections, order, 'BLACKOUT')` mints a fixed `'Black Slide'`/`'Black Slide 2'` section (reusing `uniqueSectionLabel`'s existing collision guard) with `kind: 'blackout'` and `lines: []`; every other kind's `addSection` call stays byte-identical.
- `buildSectionRows` excludes a blackout row from per-kind lyric numbering entirely (never touches `kindOrdinals`/`numberBySectionId`) while still computing `position`/`occurrenceIndex`/`isRepeat`/`repeatOfPosition` normally — proven with an explicit `[Verse, blackout, Chorus]` numbering-integrity test (R304).
- `slideshowAssembler.ts` resolves a blackout section to exactly one `contentKind:'blackout'` `AssembledSlide` at all three lyric-resolution sites: `resolveEntryContent`'s lyric case, the stored-group per-entry lyric loop, and the no-group fallback SONG loop — each short-circuits `sliceSectionIntoSlides` rather than slicing an empty-lines section, and both entry/bed audio precedence and group/entry provenance carry through unchanged.
- `slideContentLabel`/`slideBodyText`/`slideFooterLabel` in `slideDisplay.ts` gained a `case 'blackout'` arm each (`'BLACKOUT'` / `'Solid black'` / `'Black Slide'`, per 105-UI-SPEC.md's Copywriting Contract), keeping all three switches exhaustive.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the blackout content kind to the type model + section-order helpers** - `1030fcfb` (feat)
2. **Task 2: Emit a blackout AssembledSlide from both assembler paths** - `020f6e2b` (feat)
3. **Task 3: Add blackout branches to the display-label helpers** - `42ad2dde` (feat)

_No separate RED/GREEN/REFACTOR commits — `tdd="true"` behavior/implementation were both authored together per task and verified via the scoped test run before commit, consistent with how this codebase's other TDD-flagged plans have committed (tests + implementation land together, verified passing pre-commit)._

## Files Created/Modified
- `src/types/slide.ts` - Widened `SlideContentKind`, added `BlackoutSlide` (no fields beyond `SlideBase`), widened `Slide` union
- `src/types/songLyrics.ts` - Added optional `LyricSection.kind?: 'lyric'|'blackout'`
- `src/utils/songSectionOrder.ts` - `addSection`'s `'BLACKOUT'` special case; `buildSectionRows`'s numbering-exclusion branch
- `src/utils/__tests__/songSectionOrder.test.ts` - `addSection("BLACKOUT") (R302)` and `buildSectionRows — blackout sections (R304)` describe blocks
- `src/utils/slideshowAssembler.ts` - Blackout branch at `resolveEntryContent`'s lyric case, the stored-group lyric loop, and the no-group fallback SONG loop
- `src/utils/__tests__/slideshowAssembler.test.ts` - `assembleSlideshow — blackout slides (R302/R303, Plan 105-01)` describe block (stored-group, fallback, dual-path lockstep, audio precedence)
- `src/components/slides/slideDisplay.ts` - `case 'blackout'` arm on all three display-label helpers
- `src/components/slides/__tests__/slideDisplay.test.ts` - Blackout fixture assertions for all three helpers

## Decisions Made
- Blackout is a distinct `LyricSection.kind`/`SlideContentKind`, never an empty `LyricSection` or a `SourceRef` change — the plan's `must_haves` and 105-CONTEXT.md both lock this in, and PITFALLS Pitfall 5 explicitly warns an empty section would corrupt numbering/pooling/export.
- `buildSectionRows` reads `section.kind` at the very top of its per-row branch (before any `deriveSectionKind`/`kindOrdinals` work), so the exclusion is structurally impossible to bypass for a blackout row, rather than being an after-the-fact filter.
- The assembler's three branches all follow the identical shape: resolve `section`, check `section.kind === 'blackout'` immediately after, emit one blackout slide, `continue`/`return` — matching the plan's literal call-site guidance and keeping `emitFromGroup`/`emitFallback` themselves untouched (background/media suppression stays a 105-02 render-side concern).

## Deviations from Plan

None - plan executed exactly as written. All four `must_haves.truths` are proven by the tests added in this plan; no Rule 1-4 auto-fixes were needed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The blackout data model, minting rule, numbering exclusion, and assembler resolution are all in place and unit-tested — 105-02 (editor UI: the "Insert black slide" affordance, blackout row chrome in `SongLyricEditor.vue`) can build directly on `addSection('BLACKOUT')` and `buildSectionRows`'s `displayLabel` without touching numbering logic.
- 105-03 (render surfaces: Audience/Confidence/preview/print rendering solid black for `contentKind: 'blackout'`, plus the R305 "Go to black" Audience-only scoping) can consume `AssembledSlide.slide.contentKind === 'blackout'` directly — no further assembler changes needed for that phase's scope.
- No blockers. `npm run type-check` (vue-tsc --build, typechecks tests) is clean; all three scoped test files (`songSectionOrder.test.ts`, `slideshowAssembler.test.ts`, `slideDisplay.test.ts`) pass — 255 tests total across the three files.

---
*Phase: 105-presentation-blackout-inline-black-slide*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 8 modified files verified present on disk; all 3 task commit hashes (1030fcfb, 020f6e2b, 42ad2dde) verified present in git history.
