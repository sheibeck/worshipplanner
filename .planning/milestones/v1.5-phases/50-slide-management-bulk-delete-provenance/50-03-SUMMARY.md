---
phase: 50-slide-management-bulk-delete-provenance
plan: 03
subsystem: slides
tags: [pptx, provenance, firestore, vue, cloud-functions, officeparser]

# Dependency graph
requires:
  - phase: 42-pptx-render-pipeline
    provides: the server-side render pipeline (page N = source slide N) this plan's contract relies on
  - phase: 50-01/50-02
    provides: this phase's earlier plans (bulk delete, regeneration provenance) — no direct code dependency, same phase
provides:
  - "MappedTextSlide/MappedImageSlide.sourcePage (functions) — 1-based source PPTX slide index, set at parse time"
  - "ImageSlide/TextSlide.sourcePage (client) — mirrors the parser's field, optional/backward-compatible"
  - "SourceRef imported variant renderedPage?: number — recorded on a hand-added imported entry at add-time"
affects: [50-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-stable page reference threaded end-to-end: parser index -> callable payload -> stored deck slide -> imported sourceRef, all optional so every layer stays backward-compatible with pre-phase data"

key-files:
  created: []
  modified:
    - functions/src/pptxParser.ts
    - functions/src/pptxParser.test.ts
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/components/PptxImportModal.vue
    - src/components/__tests__/PptxImportModal.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "R108 requirement left UNCHECKED in REQUIREMENTS.md — this plan is explicitly part 1 of 2 (RECORD). The multi-image resolution behavior R108 promises only lands with plan 50-05 (CONSUME), which also declares requirements: [R108]. Marking it complete here would misrepresent a still-hanging 'Rendering' state for multi-image decks as done."
  - "renderedPage deliberately excluded from derivedIdentityKey — documented in slideGroup.ts as provenance, not identity, so existing carry/survival matching in slideGroupMaterializer.ts is untouched."

patterns-established:
  - "Optional-field backward compatibility for provenance data: every new field (sourcePage, renderedPage) is optional end-to-end so pre-phase decks/entries stay valid with no migration."

requirements-completed: []  # R108 intentionally NOT marked complete here — see key-decisions. Will be marked by 50-05.

coverage:
  - id: D1
    description: "mapAstToSlides records a correct 1-based sourcePage on every emitted slide, including multi-image slides (shared page) and slides following skipped/empty slides (position still advances)"
    requirement: "R108"
    verification:
      - kind: unit
        ref: "functions/src/pptxParser.test.ts#mapAstToSlides > gives every image on a multi-image slide the SAME sourcePage"
        status: pass
      - kind: unit
        ref: "functions/src/pptxParser.test.ts#mapAstToSlides > advances sourcePage across skipped (empty) slides"
        status: pass
    human_judgment: false
  - id: D2
    description: "PptxImportModal threads sourcePage from the parsePptx callable result onto stored deck slides (PPTX path) and sets 1-based sourcePage on image-only imports"
    requirement: "R108"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts#PPTX happy path: idle -> uploading -> parsing -> preview, then confirm persists and emits"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts#image-only path builds a preview and confirms without invoking parsePptx"
        status: pass
    human_judgment: false
  - id: D3
    description: "SlideGrid.onImportConfirmed records renderedPage on a new imported entry's sourceRef from the deck slide's sourcePage, omitting the key entirely (never renderedPage: undefined) when sourcePage is absent"
    requirement: "R108"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#appends one entry per deck slide, after the existing entries, at the end of the selected group — no new plan item or service-store write"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-10
status: complete
---

# Phase 50 Plan 03: PPTX render-stable page provenance (RECORD) Summary

**Threads a 1-based source-slide page reference from `officeparser`'s AST through the `parsePptx` callable, `PptxImportModal`, and `SlideGrid.onImportConfirmed` onto a hand-added imported entry's `sourceRef.renderedPage`, entirely optional and backward-compatible with every pre-phase deck.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-10T21:09:56Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `mapAstToSlides` (functions) now stamps every `MappedTextSlide`/`MappedImageSlide` with `sourcePage`, the 1-based index of the source PPTX slide it came from — incremented before any skip so an empty slide still consumes a page number, and shared identically across all images on one multi-image slide.
- `ImageSlide`/`TextSlide` (client) gain an optional `sourcePage` mirroring the parser's field; `SourceRef`'s `imported` variant gains an optional `renderedPage`, explicitly documented as provenance excluded from `derivedIdentityKey` so existing carry/survival reconciliation is untouched.
- `PptxImportModal.importPptx` copies `rawSlide.sourcePage` onto each stored deck slide from the parsed PPTX result; `importImages` sets a 1-based `sourcePage` on image-only imports for shape uniformity (no render record exists for that path to resolve against).
- `SlideGrid.onImportConfirmed` spreads `renderedPage` from a deck slide's `sourcePage` onto each new imported entry's `sourceRef`, only when present — never writes `renderedPage: undefined` (Firestore rejects it).

## Task Commits

1. **Task 1: mapAstToSlides records the 1-based source page** - `9f57c5a` (feat, tdd)
2. **Task 2: Client types carry sourcePage; modal threads it; SourceRef gains renderedPage** - `b1973aa` (feat, tdd)
3. **Task 3: SlideGrid records renderedPage on hand-added imported entries** - `32de029` (feat, tdd)

**Plan metadata:** (this commit, docs: complete plan)

_Each task's implementation and its updated/added tests landed in the same commit per task — no separate RED/GREEN split was needed since these are additive optional-field changes on existing, already-tested code paths; every commit's tests were verified green before committing._

## Files Created/Modified
- `functions/src/pptxParser.ts` - `MappedTextSlide`/`MappedImageSlide` gain `sourcePage: number`; `mapAstToSlides` tracks and stamps it; doc comment records the source-slide-index = rendered-page-number contract
- `functions/src/pptxParser.test.ts` - Updated all existing assertions for the new field; added multi-image-shares-sourcePage and post-skip-advances-sourcePage tests
- `src/types/slide.ts` - `ImageSlide`/`TextSlide` gain optional `sourcePage?: number`
- `src/types/slideGroup.ts` - `SourceRef`'s `imported` variant gains optional `renderedPage?: number`; doc comment explains it is provenance, excluded from `derivedIdentityKey`
- `src/components/PptxImportModal.vue` - `importPptx` copies `sourcePage` from the parse result onto stored deck slides; `importImages` sets 1-based `sourcePage`
- `src/components/__tests__/PptxImportModal.test.ts` - Mock `parsePptx` returns `sourcePage`; asserts stored slides carry it on both import paths
- `src/components/slides/SlideGrid.vue` - `onImportConfirmed` spreads `renderedPage` onto the imported `sourceRef` when the deck slide's `sourcePage` is present
- `src/components/slides/__tests__/SlideGrid.test.ts` - Asserts `renderedPage` is recorded when `sourcePage` is present and omitted (not `undefined`) when absent

## Decisions Made
- **R108 not marked complete in REQUIREMENTS.md.** This plan is explicitly "part 1 of 2 (RECORD)" per its own objective — the data is produced and is type-clean/test-green, but a multi-image hand-added imported slide still shows "Rendering" until plan 50-05 (part 2, CONSUME) actually resolves it using this field. Plan 50-05's frontmatter also declares `requirements: [R108]`, so leaving it unchecked here and letting 50-05's completion mark it avoids representing a still-broken user-facing behavior as done.
- Followed the plan's explicit scope boundary: Task 3 touched only `onImportConfirmed` in `SlideGrid.vue` — no reorder/media changes, no R106 remove control (that is plan 50-04, a separate wave/file region).

## Deviations from Plan

None - plan executed exactly as written. All optional-field additions matched the plan's `<action>` specs; no bugs, missing critical functionality, or blocking issues were found that required auto-fixing beyond what the plan itself specified.

## Issues Encountered
None specific to this plan's code. Observed but unrelated: the full app suite (`npx vitest run`) shows 3 failing files / 13 failing tests, all pre-existing and untouched by this plan:
- `src/storage.rules.test.ts` (12 failures) — no Storage emulator was running in this execution session, so every rules assertion fails on a connection-level `storage/unknown` error rather than the documented 2-known-allow-case defect (CLAUDE.md). Environment condition, not a regression.
- `src/views/__tests__/RosterView.test.ts` (1 failure) — the documented stale "Roles config" assertion (CLAUDE.md's known 2-file baseline).
- `render-service/src/render.test.ts` (0 tests, fails to load) — a third, previously-undocumented instance of CLAUDE.md's noted Vitest-version-mismatch artifact (root 4.0.18 vs render-service's 4.1.10), triggered here by the bare `npx vitest run` rather than the `src/`-argument form CLAUDE.md calls out. `render-service/src/server.test.ts` and `render-service/src/dockerfile.test.ts` both pass cleanly, confirming this is a module-load-time tooling quirk isolated to that one file, not a code defect — and this plan never touched `render-service/`.

None of these three files are among this plan's `files_modified`, and the three target suites for this plan are fully green: `functions/src/pptxParser.test.ts` (17/17), `src/components/__tests__/PptxImportModal.test.ts` (13/13), `src/components/slides/__tests__/SlideGrid.test.ts` (126/126).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 50-05 (depends_on: ["50-03"]) can proceed: it consumes `sourceRef.renderedPage` in `importedRenderReconciler.ts::importedEntryContent` and `slideshowAssembler.ts::resolveEntryContent` to resolve a hand-added imported entry directly for multi-image decks, superseding the ec217aa 1:1 positional fallback (kept for legacy entries with no `renderedPage`).
- No blockers. `npm run type-check` (vue-tsc --build) clean; `cd functions && npm run build` clean; `cd functions && npm test` 117/117.

---
*Phase: 50-slide-management-bulk-delete-provenance*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 8 modified files confirmed present on disk; all 4 commits (9f57c5a, b1973aa, 32de029, d4e029d) confirmed in `git log`.
