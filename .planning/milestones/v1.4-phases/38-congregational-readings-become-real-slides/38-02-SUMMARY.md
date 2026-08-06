---
phase: 38-congregational-readings-become-real-slides
plan: 02
subsystem: slides
tags: [vue, scripture, congregational-reading, presentation-viewer, typescript]

# Dependency graph
requires:
  - phase: 38-01
    provides: SourceRef's scripture section payload, congregationalSectionFromRef/congregationalSectionsFromSlot predicates, the two-state rebuild machine, and one assembled ScriptureSlide per congregational section on both materialization paths
provides:
  - "ScriptureSlide.section — a singular field replacing sections?: CongregationalSection[], making 'several sections stacked on one slide' unrepresentable in the type system"
  - "PresentationViewer.vue's projected congregational layout: speaker on its own line above that section's words, both at the reference's unified body treatment, testids presentation-speaker/presentation-congregational-section (index suffix dropped — anchors for 38-03/38-04)"
  - "isCongregational computed testing the singular field, with a doc comment stating the actual degrade-to-plain-rendering rule"
affects: [38-03, 38-04, CongregationalEditor.vue, SlideGrid.vue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compiler-as-migration-tool: remove the old field first, let vue-tsc --build enumerate every read site as a compile error, then fix each at its own semantics rather than grepping for consumers"

key-files:
  created: []
  modified:
    - src/types/slide.ts
    - src/utils/slideshowAssembler.ts
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/congregationalReadingPipeline.test.ts

key-decisions:
  - "Task 1 also touched PresentationViewer.vue (not in Task 1's declared file list) with a minimal type-level fix — wrapping the singular field into a one-element array for the existing v-for — because Task 1's done criteria required npm run type-check to pass with zero errors, and the compiler-as-migration-tool instruction surfaces every read site including the component. The structural rework (dropping the loop entirely, dropping index suffixes, rewriting the doc comment) stayed Task 2's own commit, as the plan specified."
  - "Final testid anchors for 38-03/38-04: presentation-speaker and presentation-congregational-section (both singular, no index suffix — there is exactly one of each per slide now)."
  - "Both speaker and section-text elements render as sibling <p> tags at the reference's exact class treatment (text-gray-100 text-5xl font-normal leading-[1.4]), with no accent color, weight step, or indent — the per-speaker color/indent binding that told stacked sections apart was deleted outright, since one section per slide leaves nothing to tell apart."

requirements-completed: [R072]

coverage:
  - id: D1
    description: "ScriptureSlide carries at most one congregational section and the compiler enforces it — no consumer anywhere reads a sections list"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — zero errors"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/congregationalReadingPipeline.test.ts#backward compatibility, absent — no section key on a Reference-state slide"
        status: pass
    human_judgment: false
  - id: D2
    description: "A projected section slide shows its speaker on its own line above that section's words, both at the reference's unified body treatment"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D1: a congregational ScriptureSlide renders its reference in the unified body treatment too, and its speaker tag carries no accent, in a LEADER section slide showing that section's words"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#unified text-5xl size across every projected kind (D1/D2/D3) > a congregational scripture slide renders its reference, its speaker and its section text all at text-5xl"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two sections produce two slides, each showing only its own speaker and words — no stacking, no leakage"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#two consecutive sections produce two slides, each showing only its own speaker and words, in document order speaker-then-words"
        status: pass
    human_judgment: false
  - id: D4
    description: "A congregational slide with no section degrades to normal plain-text rendering rather than a blank/broken slide"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#readingMode congregational with no section falls back to normal-mode rendering"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both binding gates pass with no failures outside the documented two-file baseline"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' (2466 tests, 2457 passed, 9 failed — all in src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-05
status: complete
---

# Phase 38 Plan 02: Singular ScriptureSlide.section and the Speaker-Above-Passage Layout Summary

**`ScriptureSlide.sections?: CongregationalSection[]` is now the singular `section?: CongregationalSection`, and the projected slide renders the speaker on its own line above that section's words at the reference's unified body treatment — the stacked multi-section rendering branch is deleted, not left standing.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-05
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `ScriptureSlide.section?: CongregationalSection` replaces the array field, with a doc comment explaining WHY it's singular (D1: one slide per section, so a list here is unrepresentable state this phase removes).
- Both scripture emit sites in `slideshowAssembler.ts` (`resolveEntryContent`'s stored-group path and the SCRIPTURE fallback branch) set the singular field; the comment naming 38-02 as the follow-up plan was removed since it has happened.
- `PresentationViewer.vue`'s congregational template block no longer loops — it renders exactly the one section the slide owns as two sibling block-level `<p>` elements: `presentation-speaker` (`Leader:`/`Congregation:`) then `presentation-congregational-section` (the words), both index-suffix-free.
- The per-speaker colour/indent class binding (`text-gray-100 font-semibold` vs `text-gray-300 font-normal pl-8`) that told stacked sections apart is deleted — both elements now carry the identical unified treatment the reference uses.
- `isCongregational` tests `scripture.section !== undefined`; its doc comment states the actual rule (renders the speaker block only when a section is present; degrades to plain rendering otherwise) instead of the old array-emptiness description.
- Viewer test suite rewritten to the singular shape: the fixture builder takes one `CongregationalSection | undefined`; the former "one slide, two stacked sections" case is replaced by a genuine two-slide case asserting each slide shows only its own speaker/words in document order (speaker precedes words); the two array-fallback cases (`undefined`/`[]`) collapse into the one case the singular field admits (`undefined`); sizing and background cases updated to assert the single-section shape without weakening into existence checks.

## Task Commits

Each task was committed atomically:

1. **Task 1: ScriptureSlide carries one section, not a list** - `b0fde81` (feat)
2. **Task 2: Speaker above the passage on the projected slide** - `c7f1827` (feat)
3. **Task 3: Viewer tests assert the single-section slide** - `cf26a5b` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/types/slide.ts` - `ScriptureSlide.section?: CongregationalSection` replaces the array field, with an updated doc comment
- `src/utils/slideshowAssembler.ts` - Both scripture emit sites set the singular `section` field; the 38-01 follow-up comment removed
- `src/components/PresentationViewer.vue` - Congregational template block reworked to a single speaker-then-words block (no loop, no index suffixes, unified class treatment); `isCongregational` tests the singular field with a rewritten doc comment
- `src/components/__tests__/PresentationViewer.test.ts` - Fixture builder and all congregational cases rewritten to the singular-section shape
- `src/utils/__tests__/slideshowAssembler.test.ts` - Field-for-field assertion updates (`.sections` → `.section`)
- `src/utils/__tests__/congregationalReadingPipeline.test.ts` - Field-for-field assertion updates; `presentationPredicate` helper restated against the singular field

## Decisions Made

- **Task 1 touched `PresentationViewer.vue` for a minimal type-level fix**, even though the file is not in Task 1's declared `<files>` list. Task 1's done criteria required `npm run type-check` to pass with zero errors, and removing the array field is a compile error at every read site including the component — the plan's own "let the compiler enumerate consumers" instruction surfaces this. The fix was strictly type-level (wrap the singular field into a one-element array for the existing loop); the actual structural rework — deleting the loop, dropping index suffixes, rewriting the doc comment — stayed in Task 2's own commit exactly as the plan specified, so the two tasks' intended boundaries are preserved even though both commits touch the same file.
- **Testid anchors finalized for 38-03/38-04:** `presentation-speaker` and `presentation-congregational-section`, both singular with no index suffix.
- **Speaker/section-text body treatment:** both elements are plain `<p>` tags carrying exactly `text-gray-100 text-5xl font-normal leading-[1.4]` (speaker gets `mb-2` for line separation) — identical to the reference's own treatment, with zero accent colour, weight step, or indent difference between the two elements or against the reference.

## Deviations from Plan

None — plan executed exactly as written, including the one file-list nuance noted above under Decisions Made (Task 1 necessarily touching `PresentationViewer.vue` to satisfy its own stated done criteria).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The type system and the projector both now express "one slide, one section" — `ScriptureSlide.section` is singular and the compiler enforces it; `PresentationViewer.vue` renders speaker-above-words with no stacked-sections code path left anywhere. `presentation-speaker` and `presentation-congregational-section` are the stable testid anchors 38-03 (per-slide editing surface) and 38-04 (the "make it congregational" affordance) can build against.

No blockers. `npm run type-check` (vue-tsc --build) is clean; the full app suite
(`npx vitest run --dir src --exclude '**/rules.test.ts'`) shows 2457/2466 passing, with the 9 failures
confined to the documented two-file baseline (`src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`) — unchanged from before this plan.

---
*Phase: 38-congregational-readings-become-real-slides*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 6 modified source and test files confirmed present on disk; all 3 task commits
(`b0fde81`, `c7f1827`, `cf26a5b`) confirmed present in `git log`.
