---
phase: 53-song-lyric-editing
plan: 01
subsystem: songs
tags: [vue, typescript, song-lyrics, pure-model, tdd, slideBreaks, section-numbering]

# Dependency graph
requires:
  - phase: 28-song-lyrics-editor-rework
    provides: "songSectionOrder.ts pure pool/order model (buildSectionRows, addSection, mintSectionId) and the LyricSection type"
provides:
  - "LyricSection.slideBreaks?: number[] — additive, optional, read-tolerant split metadata (R117)"
  - "sliceSectionIntoSlides(section): string[][] — the single pure definition of what a slide split means (R117)"
  - "deriveSectionKind(label): string — render-time kind parse, no stored kind field (R120)"
  - "SectionRow.displayLabel — per-kind position ordinal, render-only, stored label never rewritten (R120)"
  - "'Pre-Chorus' in ADD_SECTION_KINDS, slugs to 'pre-chorus' (R119)"
affects: [53-02-assembler-seam, 53-03-song-lyric-editor-ui, slideshowAssembler, SongLyricEditor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split resolved live from additive metadata over `lines`, never a second text copy (mirrors scripture char-offset model with whole-line indices)"
    - "Position numbering derived at render time in buildSectionRows; stored label is immutable (BWC)"

key-files:
  created: []
  modified:
    - src/types/songLyrics.ts
    - src/utils/songSectionOrder.ts
    - src/utils/__tests__/songSectionOrder.test.ts
    - src/components/__tests__/SongLyricEditor.test.ts

key-decisions:
  - "slideBreaks are LINE indices (1 <= k < lines.length), not a slides array — keeps `lines` the single canonical text source"
  - "deriveSectionKind is regex-only (strip trailing \\s+\\d+), no hard-coded kind list, so Pre-Chorus works for free"
  - "'Pre-Chorus' placed after 'Chorus' in ADD_SECTION_KINDS per plan (palette order), not before"

patterns-established:
  - "sliceSectionIntoSlides is the ONLY definition of a split — both assembler paths (Plan 02) and the editor (Plan 03) consume it"
  - "displayLabel per-kind ordinal: kindOrdinals + numberBySectionId maps; repeats and split slides share the section's single number"

requirements-completed: [R117, R119, R120]

coverage:
  - id: D1
    description: "LyricSection.slideBreaks?: number[] additive optional field; sliceSectionIntoSlides returns one group when absent/empty, N groups for N-1 in-range breaks, clamps out-of-range/unsorted/duplicate/non-integer input without throwing, never mutates input"
    requirement: "R117"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#sliceSectionIntoSlides (R117)"
        status: pass
    human_judgment: false
  - id: D2
    description: "deriveSectionKind strips a trailing arabic number for every real label shape; buildSectionRows exposes per-kind position displayLabel (bare-Verse bug -> Verse 3; a Chorus between verses does not bump verse numbering; repeats share number; lone kind -> Kind 1; stored label never mutated)"
    requirement: "R120"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#deriveSectionKind (R120)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#buildSectionRows displayLabel (R120)"
        status: pass
    human_judgment: false
  - id: D3
    description: "'Pre-Chorus' is a member of ADD_SECTION_KINDS (after Chorus); addSection labels it 'Pre-Chorus' and mints id 'pre-chorus'; deriveSectionKind('Pre-Chorus 2') is 'Pre-Chorus'"
    requirement: "R119"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#Pre-Chorus (R119)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/songSectionOrder.test.ts#ADD_SECTION_KINDS"
        status: pass
    human_judgment: false
  - id: D4
    description: "Editor renders the derived displayLabel and the six-chip add palette in place; end-to-end split/numbering feel with a real multi-repeat song"
    verification: []
    human_judgment: true
    rationale: "Plan 01 is the pure model core only; the editor wiring (render displayLabel, split affordance, Pre-Chorus chip behavior) lands in Plan 03 and needs a human UAT pass on real song data. Deferred per v1.6 standing autonomy grant."

# Metrics
duration: 15min
completed: 2026-08-11
status: complete
---

# Phase 53 Plan 01: Pure Model Core Summary

**Additive `slideBreaks` split metadata + pure `sliceSectionIntoSlides`, render-time per-kind `displayLabel` numbering via `deriveSectionKind`, and `'Pre-Chorus'` in the add palette — all in the two pure modules, stored labels never rewritten.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-11T21:28:26Z
- **Completed:** 2026-08-11T21:43:24Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 4

## Accomplishments
- **R117:** Added the additive, optional, read-tolerant `slideBreaks?: number[]` field to `LyricSection` and the pure `sliceSectionIntoSlides(section): string[][]` helper — the single definition of what a split means. Absent/empty ⇒ one group identical to `section.lines` (byte-identical to today, backward compatible); N-1 in-range breaks ⇒ N consecutive line-groups; out-of-range/unsorted/duplicate/non-integer indices are filtered, sorted and de-duped without ever throwing or mutating the input.
- **R120:** Added the pure `deriveSectionKind(label)` (strips a single trailing `\s+\d+`, no hard-coded kind list) and wired a per-kind position ordinal into `buildSectionRows` as the new additive `SectionRow.displayLabel`. Fixes the bare-"Verse" bug (a Verse after pasted "Verse 1"/"Verse 2" now shows "Verse 3"), numbers per KIND not global row position, reuses a section's number across repeats/splits, and leaves every section's stored `label` byte-identical (render-time only — BWC).
- **R119:** Added `'Pre-Chorus'` to `ADD_SECTION_KINDS` (after `'Chorus'`); the `AddSectionKind` union widened automatically and it slugs cleanly to `pre-chorus` via the existing `mintSectionId`.

## Task Commits

Each task was executed TDD-first (RED test commit, then GREEN implementation commit):

1. **Task 1: slideBreaks field + sliceSectionIntoSlides (R117)** — `d8ca873` (test), `019cd22` (feat)
2. **Task 2: deriveSectionKind + per-kind displayLabel (R120)** — `facc07b` (test), `065cea4` (feat)
3. **Task 3: 'Pre-Chorus' in ADD_SECTION_KINDS (R119)** — `3a350ea` (test), `badd8a0` (feat), `e8a748d` (deviation fix)

## Files Created/Modified
- `src/types/songLyrics.ts` — added `slideBreaks?: number[]` to `LyricSection` with BWC JSDoc.
- `src/utils/songSectionOrder.ts` — added `sliceSectionIntoSlides` and `deriveSectionKind`; extended `SectionRow` with `displayLabel` and the per-kind ordinal bookkeeping in `buildSectionRows`; widened `ADD_SECTION_KINDS` with `'Pre-Chorus'`; JSDoc count "five" → "six".
- `src/utils/__tests__/songSectionOrder.test.ts` — new RED-first coverage for all three helpers (slicing/clamp/no-mutation, kind derivation, per-kind numbering incl. the "Verse 3" bug and stored-label-immutability, Pre-Chorus slug/add-section).
- `src/components/__tests__/SongLyricEditor.test.ts` — updated the stale five-chip palette assertion to six chips including Pre-Chorus (deviation, see below).

## Decisions Made
- Break indices over a slides array (keeps `lines` the single canonical text source; no reconciliation on textarea edits).
- Parse kind from label at render time rather than adding a stored `kind` field (existing production data has no such field; parse works for all real labels; no migration, no new write surface).
- `'Pre-Chorus'` placed after `'Chorus'` in the palette tuple per the plan's action step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale palette assertion in SongLyricEditor.test.ts broke on the ADD_SECTION_KINDS change**
- **Found during:** Task 3 (add 'Pre-Chorus' to ADD_SECTION_KINDS)
- **Issue:** `SongLyricEditor.vue` renders the add-section chips with `v-for="kind in ADD_SECTION_KINDS"`, so widening the tuple made the editor render six chips. The existing test `the add row renders the five quick-add chips in mockup order` asserted exactly `['Verse','Chorus','Bridge','Tag','Ending']` and failed — a regression directly caused by this task's in-scope change (not a pre-existing failure).
- **Fix:** Updated the assertion (and its title) to the new six-chip order `['Verse','Chorus','Pre-Chorus','Bridge','Tag','Ending']`. No component/source change — the component already iterates the tuple; only the test's expected value was stale.
- **Files modified:** src/components/__tests__/SongLyricEditor.test.ts
- **Verification:** `npx vitest run --dir src src/components/__tests__/SongLyricEditor.test.ts` → 69/69 pass.
- **Committed in:** `e8a748d`

---

**Total deviations:** 1 auto-fixed (1 bug — stale test assertion directly caused by the in-scope enumeration change)
**Impact on plan:** No scope creep. The change was confined to correcting an expected value for a tuple this plan deliberately widened; no production behavior or additional files touched beyond restoring the suite to its documented baseline.

## Issues Encountered
None during planned work. The broad suite's other two failing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) are the documented CLAUDE.md 2-file baseline (Storage-emulator cross-service limitation and a stale RosterView assertion) — pre-existing, unrelated, and left untouched.

## Verification Gates (all passed)
- `npx vitest run --dir src src/utils/__tests__/songSectionOrder.test.ts` — 57/57 pass.
- `npm run type-check` (vue-tsc --build, typechecks tests too) — clean. The `SectionRow.displayLabel` addition and widened `AddSectionKind` union broke no consumer.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 3026 pass; the only failing files are exactly the documented 2-file baseline. No regression introduced.

## Next Phase Readiness
- **Plan 02 (assembler seam):** `sliceSectionIntoSlides` is ready to consume at both lyric-emission sites in `slideshowAssembler.ts`; split slide ids `${entry.id}:${i}` per the R117 contract.
- **Plan 03 (editor UI):** `SectionRow.displayLabel` is ready to render in place of `section.label`; the Pre-Chorus chip already appears via `ADD_SECTION_KINDS`. A human UAT pass on real multi-repeat song data (coverage D4) is deferred per the v1.6 standing autonomy grant.
- No blockers.

## Self-Check: PASSED

- SUMMARY.md, `src/types/songLyrics.ts`, `src/utils/songSectionOrder.ts` — all present on disk.
- Implementation commits `019cd22`, `065cea4`, `badd8a0`, `e8a748d` — all present in git history.

---
*Phase: 53-song-lyric-editing*
*Completed: 2026-08-11*
