---
phase: 53-song-lyric-editing
plan: 02
subsystem: songs
tags: [vue, typescript, slideshow-assembler, song-lyrics, slideBreaks, dual-path, tdd, R117, R118]

# Dependency graph
requires:
  - phase: 53-song-lyric-editing
    provides: "sliceSectionIntoSlides(section): string[][] and LyricSection.slideBreaks? from Plan 01"
  - phase: 24-slide-group-materialization
    provides: "assembleSlideshow dual-path (stored-group + fallback) D-02 reference model, emitFromGroup/emitFallback"
provides:
  - "assembleSlideshow resolves a manually-split lyric section LIVE to N slides at BOTH lockstep call sites (R117)"
  - "Split slide id contract: `${entry.id}:${i}` (stored path) / advancing `${slot.id}:${localSeq}` (fallback); unsplit byte-identical (`entry.id` / current localSeq)"
  - "emitFromGroup idOverride param: slide id === groupSlideId === idOverride ?? entry.id (WR-02 media-keying preserved)"
  - "R118 duplicate-a-split proof: a repeated split section emits all N slides on both occurrences with distinct ids — proven by test, zero duplicateRow/group-model change"
affects: [53-03-song-lyric-editor-ui, slideshowAssembler, SlideGrid, PresentationViewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both lyric-emission call sites derive slides through the ONE sliceSectionIntoSlides helper — the split's meaning is defined once (D1 dual-path lockstep discipline)"
    - "Split resolved live at assembly; the stored slide-group model (deriveGroupEntries/rebuildSongGroup/sourceSignature) is never touched (R105 precedent)"

key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts

key-decisions:
  - "emitFromGroup gains a trailing optional idOverride; slide id AND groupSlideId both become `idOverride ?? entry.id` so unsplit behavior is byte-identical (WR-02 invariant)"
  - "The stored-group entry loop owns lyric slicing; resolveEntryContent's lyric case is left untouched and valid for any direct caller"
  - "Fallback path advances the existing localSeq per line-group so split ids stay distinct/stable; unsplit yields one group = today's single slide"
  - "R118 needs NO production change — a performanceOrder repeat already yields two stored lyric entries, each resolving live to N slides; proven by test only"

requirements-completed: [R117, R118]

coverage:
  - id: R117-stored
    description: "Stored-group path: a split section emits N slides ids `${entry.id}:${i}` with partitioned lines and the stored sectionLabel; an unsplit section emits ONE slide id `entry.id` byte-identical; split slides share the section group media (background + bed audio)"
    requirement: "R117"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#lyric split (R117/R118, Plan 53-02) > stored-group path (R117)"
        status: pass
    human_judgment: false
  - id: R117-fallback
    description: "Fallback path: a split section emits N fallback slides with distinct consecutive `${slot.id}:${localSeq}` ids between the copyright bracket; an unsplit section is byte-identical to today's single slide; the two paths agree slide-for-slide (same count and lines)"
    requirement: "R117"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#lyric split (R117/R118, Plan 53-02) > fallback path (R117)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#dual-path lockstep (D1) + duplicate proof (R118)"
        status: pass
    human_judgment: false
  - id: R118
    description: "A performanceOrder repeat / two stored lyric entries of a split section emit ALL N slides on BOTH occurrences with distinct ids (`${entryA.id}:i` vs `${entryB.id}:i` stored; distinct consecutive localSeq fallback); stored group document never mutated; deriveGroupEntries still emits exactly one lyric entry per occurrence"
    requirement: "R118"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#dual-path lockstep (D1) + duplicate proof (R118)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#deriveGroupEntries — SONG > R118: a split section referenced twice yields exactly one lyric entry per occurrence"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-08-11
status: complete
---

# Phase 53 Plan 02: Assembler Wiring Summary

**A manually-split lyric section (`slideBreaks` present) now resolves LIVE to N slides at BOTH in-lockstep lyric-emission call sites in `assembleSlideshow` — split ids `${entry.id}:${i}` (stored) / advancing `${slot.id}:${localSeq}` (fallback), unsplit byte-identical — and R118 (duplicate a split as one unit) falls out for free with zero `duplicateRow`/slide-group-model change.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-08-11T22:04:15Z
- **Completed:** 2026-08-11T22:16:56Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 3

## Accomplishments

- **R117 (stored-group path):** The stored-group entry loop now special-cases `entry.sourceRef.kind === 'lyric'` — it resolves the section from `inputs.songLyricsById` (the same lookup `resolveEntryContent`'s lyric case uses) and slices it through Plan 01's single `sliceSectionIntoSlides` helper, emitting one `LyricSlide` per line-group. `emitFromGroup` gained a trailing optional `idOverride`; the slide `id` and `AssembledSlide.groupSlideId` are now both `idOverride ?? entry.id`. A split passes `${entry.id}:${i}` per slice; an unsplit section passes no override and stays **byte-identical to today** (id === groupSlideId === `entry.id`), preserving the Phase 23 WR-02 media-keying invariant. Media is resolved once from the real `entry` (`resolveEntryMedia(group, entry, song)`), so all N split slides share the section's background and bed audio.
- **R117 (fallback path):** The no-materialized-group SONG case slices each `performanceOrder` section through the SAME `sliceSectionIntoSlides` and emits one `emitFallback` per line-group, advancing the existing `localSeq` per group so fallback ids (`${slot.id}:${localSeq}`) stay distinct and stable. An unsplit section yields exactly one group → one `emitFallback` at the current `localSeq` → byte-identical to today. Both call sites now derive slides through the one helper, so the two paths agree slide-for-slide (the D1 lockstep discipline).
- **R118 (proven by test only):** A `performanceOrder` repeat already produces two stored lyric entries, and the fallback order `[sectionId, sectionId]` already emits the section twice — each occurrence now resolves live to all N split slides with distinct ids (`entry-a:0/1` vs `entry-b:0/1` stored; distinct consecutive `localSeq` fallback). No `duplicateRow` change, no group-model change. A `slideGroupMaterializer.test.ts` assertion documents that `deriveGroupEntries` still emits exactly one lyric entry per occurrence of a split section, with no split payload on the entry.
- **Stored slide-group model unchanged:** No production edit to `slideGroupMaterializer.ts` — the split is resolved live at assembly (R105 precedent), never persisted.

## Task Commits

Each task executed TDD-first (RED test commit, then GREEN implementation commit):

1. **Task 1: stored-group slice + emitFromGroup idOverride (R117)** — `8c7dab2` (test), `f0c5783` (feat)
2. **Task 2: fallback slice + dual-path lockstep + R118 proof + materializer assertion (R117/R118)** — `7604bb5` (test), `7ce15b5` (feat)

## Files Created/Modified

- `src/utils/slideshowAssembler.ts` — imported `sliceSectionIntoSlides`; added the optional `idOverride` param to `emitFromGroup` (slide id + `groupSlideId` = `idOverride ?? entry.id`); special-cased lyric entries in the stored-group loop to slice and emit N slides; sliced the fallback SONG case per line-group advancing `localSeq`. No change to `resolveEntryContent`'s lyric case.
- `src/utils/__tests__/slideshowAssembler.test.ts` — new `describe('assembleSlideshow — lyric split (R117/R118, Plan 53-02)')` block: stored-group split (ids/lines/label), stored-group BWC unsplit, split-slide shared group media, fallback split (ids/lines/copyright bracket), fallback BWC unsplit, dual-path lockstep, R118 stored + fallback duplicate proofs.
- `src/utils/__tests__/slideGroupMaterializer.test.ts` — added an assertion in `deriveGroupEntries — SONG` that a split section referenced twice yields exactly one lyric entry per occurrence with no split payload on the entry (group model unchanged).

## Decisions Made

- `idOverride` threads through `emitFromGroup` and defaults to `entry.id` so the change is a pure superset — every non-lyric entry and every unsplit lyric section is byte-identical, guaranteeing no existing test or media key churns.
- The stored-group loop, not `resolveEntryContent`, owns lyric slicing. `resolveEntryContent`'s lyric case is left valid for any direct caller; the loop resolves the section itself before slicing.
- Fallback slicing reuses the existing `localSeq++` counter rather than introducing a `:i` suffix, keeping fallback ids in their established `${slot.id}:${localSeq}` shape and stable across recomputes.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes (Rules 1–3) were required; no architectural decisions (Rule 4) arose.

## Issues Encountered

None during planned work. The broad suite's only failing files are the documented CLAUDE.md 2-file baseline — `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation, firebase-js-sdk#6803) and `src/views/__tests__/RosterView.test.ts` (stale assertion) — pre-existing, unrelated, left untouched.

## Verification Gates (all passed)

- `npx vitest run --dir src src/utils/__tests__/slideshowAssembler.test.ts` — 102/102 pass.
- `npx vitest run --dir src src/utils/__tests__/slideshowAssembler.test.ts src/utils/__tests__/slideGroupMaterializer.test.ts` — 234/234 pass.
- `npm run type-check` (vue-tsc --build, typechecks tests too) — clean. The `emitFromGroup` signature change broke no consumer.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 3040 pass; the only failing files are exactly the documented 2-file baseline (13 failing assertions, all inside those 2 files). No regression introduced.

## Next Phase Readiness

- **Plan 03 (editor UI):** The assembler seam is complete — a section with `slideBreaks` projects as N slides on both the Slides-tab grid (`SlideGrid.vue` renders `assembleSlideshow`'s output) and the presenter with no separate grid change. The editor's job is now purely to author `slideBreaks` on `LyricSection`.
- Phase-level UAT (`53-VALIDATION.md`): "split an 8-line chorus → two slides" and "duplicate the split → both occurrences show both slides" are ready to verify once the editor affordance ships.
- No blockers.

## Self-Check: PASSED

- `.planning/phases/53-song-lyric-editing/53-02-SUMMARY.md`, `src/utils/slideshowAssembler.ts` — present on disk.
- Commits `8c7dab2`, `f0c5783`, `7604bb5`, `7ce15b5` — all present in git history.

---
*Phase: 53-song-lyric-editing*
*Completed: 2026-08-11*
