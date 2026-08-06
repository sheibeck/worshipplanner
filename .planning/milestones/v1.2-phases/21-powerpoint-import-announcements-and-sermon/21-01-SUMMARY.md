---
phase: 21-powerpoint-import-announcements-and-sermon
plan: 01
subsystem: slide-model
tags: [vue, pinia, firestore, typescript, discriminated-union, slideshow-assembly]

# Dependency graph
requires:
  - phase: 20-service-sections-and-slide-auto-assembly
    provides: assembleSlideshow pure engine, useSlideshowAssembly reactive wrapper, SlideshowPreview cardKind rendering, SCRIPTURE slot precedent
provides:
  - ImageSlide slide variant (contentKind 'image') added to the Slide union
  - 'IMPORTED' SlotKind, ImportedSlot interface added to ServiceSlot union
  - ImportedDeck type (imported-PPTX analogue of ScriptureReading)
  - importedSlides Pinia store (subscribeDecks/unsubscribeDecks/createDeck/updateDeck/getDeck)
  - assembleSlideshow IMPORTED case + AssemblyInputs.importedDecksById
  - useSlideshowAssembly wiring (subscribes importedSlides store, builds importedDecksById)
  - SlideshowPreview 'image' card render branch (<img> bound to imageUrl/altText)
affects: [21-04-pptx-parser, 21-05-pptx-upload-and-modal, 21-06-imported-slide-editor-and-service-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union extension: new content/slot kinds always extend Slide/SlotKind/ServiceSlot and their two switch statements (slotTypes.ts, slideshowAssembler.ts) rather than introducing a parallel model (D001)."
    - "IMPORTED slot expansion mirrors SCRIPTURE exactly: one slot references one persisted deck by id; assembleSlideshow looks up the deck in a pre-loaded Map and forEach-emits its slides in stored order, tolerating a null/unresolved id by emitting nothing."

key-files:
  created:
    - src/types/importedDeck.ts
    - src/stores/importedSlides.ts
  modified:
    - src/types/slide.ts
    - src/types/service.ts
    - src/utils/slotTypes.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/components/SlideshowPreview.vue
    - src/components/__tests__/SlideshowPreview.test.ts

key-decisions:
  - "ImportedDeck's slides field is typed (TextSlide | ImageSlide)[] — the deck itself carries no discriminator beyond its slide contents, matching ScriptureReading's shape exactly."
  - "assembleSlideshow's IMPORTED case reuses the identical destructure-and-emit shape as the SCRIPTURE case (strip id/position, pass the rest through, sourceId = the referenced id) rather than a bespoke mapping."

patterns-established:
  - "New content kinds extend the Slide/SlotKind unions and their switch statements; never a parallel model."

requirements-completed: [R010, R011, R012]

coverage:
  - id: D1
    description: "ImageSlide added to slide.ts and included in the Slide union; ImportedDeck type mirrors ScriptureReading"
    requirement: "R010"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — imported deck resolution"
        status: pass
    human_judgment: false
  - id: D2
    description: "'IMPORTED' added to SlotKind, ImportedSlot added to ServiceSlot union, createSlot/slotLabel handle IMPORTED"
    requirement: "R010"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot / slotLabel — IMPORTED"
        status: pass
    human_judgment: false
  - id: D3
    description: "importedSlides Pinia store created, mirroring scriptureSlides.ts's subscribe/create/update/get lifecycle"
    requirement: "R010"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#derives importedDecksById from the importedSlides store and expands an IMPORTED slot"
        status: pass
    human_judgment: false
  - id: D4
    description: "assembleSlideshow IMPORTED case expands a populated deck into N AssembledSlides in deck order, sourceId=importId, and tolerates a null/unresolved importId with zero slides"
    requirement: "R011"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — imported deck resolution"
        status: pass
    human_judgment: false
  - id: D5
    description: "SlideshowPreview renders an <img> for image-kind assembled slides while existing text/scripture/lyric cards continue to render"
    requirement: "R012"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlideshowPreview.test.ts#renders an img element with the correct src for an image slide"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-24
status: complete
---

# Phase 21 Plan 01: Slide/slot type model Summary

**ImageSlide + IMPORTED SlotKind + ImportedDeck + importedSlides store, with assembleSlideshow's IMPORTED case and SlideshowPreview's image branch — establishing the full READ path for imported PPTX/image decks by extending the existing unified slide model exactly the way SCRIPTURE was added in Phase 19/20.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-24T23:07:00-04:00
- **Completed:** 2026-07-24T23:36:18-04:00
- **Tasks:** 3 completed
- **Files modified:** 10 (2 created, 8 modified — 1 additional pre-existing test file fixed as an in-scope regression from Task 3)

## Accomplishments
- `ImageSlide` interface added to `src/types/slide.ts` (contentKind `'image'`, `imageUrl`, optional `altText`) and included in the `Slide` union.
- `'IMPORTED'` added to `SlotKind`; `ImportedSlot` (kind, position, importId, optional section) added to the `ServiceSlot` union.
- `src/types/importedDeck.ts` created — `ImportedDeck` mirrors `ScriptureReading`'s shape (id, sourceFileName, section, slides, createdAt/updatedAt Timestamps).
- `slotLabel`/`createSlot` in `slotTypes.ts` extended with an `'IMPORTED'` case (`'Imported Slides'` label; factory returns `{ kind: 'IMPORTED', position: 0, importId: null }` with section omission preserved).
- `src/stores/importedSlides.ts` created — Pinia store mirroring `useScriptureSlides` against `organizations/{orgId}/importedSlides` (subscribeDecks/unsubscribeDecks/createDeck/updateDeck/getDeck, serverTimestamp on create/update).
- `assembleSlideshow` extended with an `IMPORTED` case identical in shape to the `SCRIPTURE` case: resolves `slot.importId` against `inputs.importedDecksById`, forEach-emits the deck's slides in stored order with `sourceId = importId`; null or unresolved `importId` contributes zero slides.
- `useSlideshowAssembly` subscribes the `importedSlides` store per org (alongside `scriptureSlides`) and feeds a computed `importedDecksById` map into `assembleSlideshow`.
- `SlideshowPreview.vue` gained an `'image'` `CardKind` branch rendering an `<img>` bound to the slide's `imageUrl`/`altText`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ImageSlide, IMPORTED SlotKind, ImportedSlot, ImportedDeck, and the IMPORTED slot factory/label** - `3968bdd` (feat)
2. **Task 2: Add the importedSlides Pinia store** - `4d60591` (feat)
3. **Task 3: Extend the assembly engine, composable, and preview for IMPORTED / image slides (TDD)**
   - RED - `ec7befc` (test) — added failing assertions to `slideshowAssembler.test.ts` and `SlideshowPreview.test.ts`; confirmed 3 failures against the pre-Task-3 implementation
   - GREEN - `926fe0f` (feat) — implemented the `IMPORTED` case, composable wiring, and preview branch; all previously-failing tests now pass; also updated the pre-existing `useSlideshowAssembly.test.ts` with an `importedSlides` store stub (Rule 1 — this file directly exercises `useSlideshowAssembly.ts`, which the task modified, and would otherwise fail under Pinia's "no active Pinia" error once the composable called the new unmocked store)
   - No REFACTOR commit — implementation required no cleanup pass.

**Plan metadata:** (this commit, to follow)

## Files Created/Modified
- `src/types/slide.ts` - `ImageSlide` interface + `Slide` union extension
- `src/types/service.ts` - `'IMPORTED'` `SlotKind` + `ImportedSlot` + `ServiceSlot` union extension
- `src/types/importedDeck.ts` - `ImportedDeck` type (new file)
- `src/utils/slotTypes.ts` - `slotLabel`/`createSlot` `'IMPORTED'` cases
- `src/utils/__tests__/slotTypes.test.ts` - `createSlot`/`slotLabel` IMPORTED coverage
- `src/stores/importedSlides.ts` - Pinia store mirroring `scriptureSlides.ts` (new file)
- `src/utils/slideshowAssembler.ts` - `IMPORTED` case + `AssemblyInputs.importedDecksById`
- `src/utils/__tests__/slideshowAssembler.test.ts` - IMPORTED deck resolution test suite
- `src/composables/useSlideshowAssembly.ts` - subscribes `importedSlides` store, builds `importedDecksById`
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - `importedSlides` store stub + new IMPORTED-expansion test (regression fix + new coverage)
- `src/components/SlideshowPreview.vue` - `'image'` `CardKind` + `<img>` render branch
- `src/components/__tests__/SlideshowPreview.test.ts` - image-slide render assertion

## Decisions Made
- `ImportedDeck.slides` is typed `(TextSlide | ImageSlide)[]` with no per-deck discriminator — the deck's identity comes entirely from its slide contents, exactly matching `ScriptureReading`'s precedent.
- The `IMPORTED` assembler case reuses the identical destructure-and-emit shape as `SCRIPTURE` (strip `id`/`position`, spread the rest, `sourceId` = the referenced id) rather than inventing a bespoke mapping — keeps the two content-reference kinds mechanically identical, as the research recommended.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a Pinia-store regression in the pre-existing `useSlideshowAssembly.test.ts` suite**
- **Found during:** Task 3 GREEN-phase verification (`npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts`)
- **Issue:** `useSlideshowAssembly.ts` (a file this task modifies) now calls `useImportedSlides()` unconditionally. The existing test file only mocked `@/stores/scriptureSlides` and `@/stores/songs`, so the real `importedSlides` Pinia store attempted to initialize without an active Pinia instance, failing 6 of 7 pre-existing tests with `"getActivePinia() was called but there was no active Pinia"`.
- **Fix:** Added a `vi.mock('@/stores/importedSlides', ...)` stub mirroring the existing `scriptureSlides` stub pattern (reactive `decks`/`isLoading` + `vi.fn()` methods), reset `importedState.decks = []` in `beforeEach`, and added assertions that `subscribeDecks` is called once per org (mirroring the existing `subscribeReadings` assertion) plus a new test asserting an `IMPORTED` slot expands via the live store subscription.
- **Files modified:** `src/composables/__tests__/useSlideshowAssembly.test.ts`
- **Verification:** All 7 tests in the file pass (`npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts`).
- **Committed in:** `926fe0f` (Task 3 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug directly caused by this task's change to a file in the task's own `files` list)
**Impact on plan:** Necessary to keep the existing test suite green; no scope creep — the fix only touches the test file whose subject-under-test this plan's Task 3 modified.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The complete READ path (subscribe deck → map → assemble → preview) is in place and green. Plans 21-02 through 21-06 (Storage bootstrap, functions test infra, `parsePptx` Cloud Function, upload/modal, editor + service wiring) can build on `ImageSlide`, `ImportedSlot`, `ImportedDeck`, the `importedSlides` store, the `IMPORTED` assembly case, and the preview's image branch without further type/model changes.
- No blockers. Pre-existing, out-of-scope `vue-tsc --build` errors in `ccliParser.ts`/`scriptureSplitter.ts` (and a handful of unrelated test files) remain unchanged from the Phase 20 baseline — confirmed via a filtered diff before/after each task showed zero new errors introduced by any file this plan touched.

## Self-Check: PASSED

- FOUND: src/types/slide.ts, src/types/service.ts, src/types/importedDeck.ts, src/utils/slotTypes.ts, src/stores/importedSlides.ts, src/utils/slideshowAssembler.ts, src/composables/useSlideshowAssembly.ts, src/components/SlideshowPreview.vue (all exist)
- FOUND: 3968bdd, 4d60591, ec7befc, 926fe0f (all present in `git log --oneline`)

---
*Phase: 21-powerpoint-import-announcements-and-sermon*
*Completed: 2026-07-24*
