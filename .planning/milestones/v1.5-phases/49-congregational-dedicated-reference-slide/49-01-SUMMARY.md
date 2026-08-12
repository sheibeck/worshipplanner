---
phase: 49-congregational-dedicated-reference-slide
plan: 01
subsystem: ui
tags: [slide-assembly, scripture, congregational-reading, vue, presentation]

# Dependency graph
requires:
  - phase: 47-congregational-reading-divider-ux
    provides: "R097 reference-eyebrow-on-first-section model (isFirstSection) that this phase replaces"
  - phase: 38-congregational-reading
    provides: "one-slide-per-section congregational assembly (D1), congregationalSectionsFromSlot predicate"
  - phase: 24-slide-groups
    provides: "dual-path (fallback + stored-group) slideshow assembler, resolveEntryMedia cascade"
provides:
  - "Congregational reading assembles to N+1 slides: a dedicated leading scripture-reference slide + one text slide per section"
  - "buildScriptureReferenceContent — the single producer of reference-only scripture slide content (byte-identical reference slide by construction)"
  - "Section slides are text-only: the reference eyebrow is suppressed in both the slide-body preview and the projected view"
  - "ScriptureSlide.isFirstSection removed (fully retired)"
affects: [congregational-reading, scripture-slides, presentation-viewer, slide-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Approach B: assembly-time synthetic leading slide emitted on BOTH assembler paths, gated on the SAME slot-side predicate — never a stored GroupSlideEntry (keeps the group carry/signature machinery untouched)"
    - "Entry-less synthetic slide resolves group media from the GROUP tier (background 'group', bed audioFromBed/groupId) with NO groupSlideId — preserves the Phase 23 WR-02 invariant"

key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/types/slide.ts
    - src/components/slides/slideDisplay.ts
    - src/components/PresentationViewer.vue
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/__tests__/PresentationViewer.test.ts
    - src/utils/__tests__/congregationalReadingPipeline.test.ts
    - src/utils/__tests__/congregationalDetachment.test.ts

key-decisions:
  - "Removed ScriptureSlide.isFirstSection entirely (not kept-as-dead) — after this phase both readers and both writers are gone, so keeping it would be a written-never-read dead field"
  - "Synthetic reference slide id = `slot.id + ':ref'` on both paths — deterministic and collision-free against numeric section ids (`slot.id + ':N'`) and stored entry ids (crypto.randomUUID)"
  - "Stored-path reference slide carries group background + bed (audioFromBed/groupId) so the AudioPlayer key group:{groupId}:{url} stays continuous across reference->section; fallback path carries no media (D-19)"

patterns-established:
  - "Both assembler paths call the SAME buildScriptureReferenceContent helper AND gate on the SAME congregationalSectionsFromSlot predicate — the dual-path-parity invariant"

requirements-completed: [R105]

coverage:
  - id: D1
    description: "A congregational reading (N sections) assembles to N+1 slides: index 0 the dedicated reference slide (readingMode 'normal', empty text, no section), indices 1..N the sections in order, on both paths (AC1/AC5)"
    requirement: "R105"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#dual-path parity (N+1)"
        status: pass
      - kind: integration
        ref: "src/utils/__tests__/congregationalReadingPipeline.test.ts#fallback path / stored-group path N+1"
        status: pass
    human_judgment: false
  - id: D2
    description: "The dedicated reference slide is byte-identical to a plain scripture reference slide via the shared helper (AC3), and a plain scripture slot is unchanged — exactly one reference slide (AC2)"
    requirement: "R105"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#R105/AC3 field-for-field identical + emits exactly ONE reference-only slide"
        status: pass
    human_judgment: false
  - id: D3
    description: "No congregational section slide renders the reference — projected view (presentation-scripture-reference) and slide-body preview — only the dedicated reference slide does (AC4)"
    requirement: "R105"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#section slide shows NO reference / dedicated reference slide shows it"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#section slide returns only words + attribution, never the reference prefix"
        status: pass
    human_judgment: false
  - id: D4
    description: "Synthetic reference id `slot.id + ':ref'` is distinct/collision-free on both paths (AC6); stored-path reference slide carries group background + bed with audioFromBed/groupId and NO groupSlideId, fallback carries no media (AC7)"
    requirement: "R105"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#AC6 ids (stored/fallback) + AC7 media (stored/fallback)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run type-check clean; full app suite at the documented 2-file baseline with no new failures (AC8)"
    requirement: "R105"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' — 2 failed files = documented baseline (storage.rules.test.ts, RosterView.test.ts)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-10
status: complete
---

# Phase 49 Plan 01: Congregational Reading — Dedicated Reference Slide Summary

**A congregational scripture reading now assembles to N+1 slides — a dedicated leading reference slide (byte-identical to a plain scripture reference slide) plus one text-only slide per section — emitted at assembly time on both assembler paths (approach B), with the reference eyebrow removed from every section slide.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-10
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added `buildScriptureReferenceContent(ref)` — the single producer of reference-only scripture slide content — and routed all reference-slide sites through it, making the dedicated reference slide byte-identical to a plain one by construction (AC3).
- Emit a synthetic leading reference slide (id `slot.id + ':ref'`) on BOTH the stored-group and fallback paths for a congregational reading, gated on the shared `congregationalSectionsFromSlot` predicate; a plain scripture slot is unchanged.
- Stored-path reference slide resolves group background (`backgroundSource: 'group'`) and bed audio (`audioFromBed: true`, `groupId` set, NO `groupSlideId`) so the bed stays one continuous AudioPlayer instance across reference->sections (AC7, WR-02 preserved); fallback path carries no media (D-19).
- Suppressed the reference eyebrow on section slides (`slideDisplay.ts::showReference` now `!slide.section`; `PresentationViewer.vue`'s reference `v-if` now `!isCongregational`) and deleted the dead `isFirstSection` computed.
- Fully retired `ScriptureSlide.isFirstSection` (type field + all readers/writers).

## Task Commits

1. **Task 1: Emit the synthetic leading reference slide on BOTH assembly paths** - `4f13356` (feat)
2. **Task 2: Suppress the reference eyebrow on section slides and retire isFirstSection** - `61b501c` (feat)
3. **Deviation: update composed pipeline/detachment integration tests to the N+1 model** - `90a0a31` (test)

## Files Created/Modified
- `src/utils/slideshowAssembler.ts` - Added `buildScriptureReferenceContent`; synthetic leading reference-slide emission on both paths (`emitSyntheticReferenceFromGroup` for the stored path, `':ref'`-suffixed `emitFallback` for the fallback path); removed both `isFirstSection` writes; widened `emitFallback`'s sequence param to `number | string`.
- `src/types/slide.ts` - Removed `ScriptureSlide.isFirstSection` field + doc comment.
- `src/components/slides/slideDisplay.ts` - `showReference` gate is now `!slide.section` (no section slide prefixes the reference); `slideContentLabel`/`slideFooterLabel` unchanged.
- `src/components/PresentationViewer.vue` - Reference `v-if` drops the `isFirstSection` clause; deleted the dead `isFirstSection` computed; comments updated to the dedicated-reference-slide model.
- `src/utils/__tests__/slideshowAssembler.test.ts` - N+1 parity, AC3 byte-identical, AC6 id, AC7 media tests; translationSource tests re-indexed past the reference slide.
- `src/components/slides/__tests__/slideDisplay.test.ts` - Section slides return only words + attribution (no reference prefix); footer unchanged; `isFirstSection` removed from fixtures.
- `src/components/__tests__/PresentationViewer.test.ts` - `congregationalScriptureSlide` helper drops the `isFirstSection` param; added `referenceScriptureSlide` fixture; section slides render no reference, the dedicated reference slide does.
- `src/utils/__tests__/congregationalReadingPipeline.test.ts` - Composed pipeline updated to the N+1 shape (reference at index 0, sections 1..N; presentation predicate false for the reference slide).
- `src/utils/__tests__/congregationalDetachment.test.ts` - MIGRATION and PROJECTED-OUTPUT cases expect N+1 assembled slides; stored-group entry counts unchanged (approach B).

## Decisions Made
- **Remove `isFirstSection` entirely** (not keep-as-dead): after this phase both readers (slideDisplay, PresentationViewer) and both writers (the two assembler paths) are gone, so keeping the field would be written-never-read dead weight. Removal ripple was small and co-located with edits already being made.
- **Synthetic reference id `slot.id + ':ref'`**: deterministic and provably collision-free against the fallback's numeric section ids (`slot.id + ':N'`) and the stored entries' `crypto.randomUUID()` ids.
- **Entry-less media resolution**: reference slide keys media on `slide.id`/`groupId` and omits `groupSlideId` — preserving the WR-02 invariant rather than fabricating an entry id.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two pre-existing integration suites broken by the intended N+1 change**
- **Found during:** Phase-level full app-suite gate (after Task 2)
- **Issue:** `congregationalReadingPipeline.test.ts` and `congregationalDetachment.test.ts` (not listed in the plan's `files_modified`) assert the pre-R105 N-slide contract — they assemble a congregational reading and assert exactly N slides / a per-slide predicate. The intended N+1 assembly shape made 9 of their tests fail. These are legitimate assertions of the exact behavior R105 changes, so they had to be brought to the new model.
- **Fix:** Updated both suites to the N+1 shape — reference slide at index 0, sections at indices 1..N; the presentation predicate is now false for the dedicated reference slide and true for section slides; stored-group entry counts left unchanged (approach B adds the reference slide only at assembly time).
- **Files modified:** src/utils/__tests__/congregationalReadingPipeline.test.ts, src/utils/__tests__/congregationalDetachment.test.ts
- **Verification:** Both suites pass (12 + 16 tests); type-check clean; full suite back at the documented 2-file baseline.
- **Committed in:** `90a0a31`

---

**Total deviations:** 1 auto-fixed (1 test-contract update for the intended behavior change)
**Impact on plan:** Necessary to keep the suite green under the intended N+1 shape. No production-source scope creep — only test files touched, and only assertions of the behavior R105 deliberately changes. The group rebuild/carry/signature machinery and `slideGroupMaterializer.ts` remain untouched (approach B).

## Issues Encountered
- The first full-suite run reported 4 failing files. Two were the documented baseline (`src/storage.rules.test.ts` env limitation, `src/views/__tests__/RosterView.test.ts` stale assertion); the other two were the integration suites above, resolved as the deviation. Final full-suite run: 2 failed files (both documented baseline), 2962 passed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R105 complete: congregational readings project a dedicated reference slide followed by text-only section slides on both assembly paths.
- Congregational readings remain deploy-gated (Phase 47); this phase adds no new deploy surface.
- Known repo baseline unchanged: `src/storage.rules.test.ts` (Storage emulator cross-service limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion) still fail as documented in CLAUDE.md.

## Self-Check: PASSED

- Files verified present: 49-01-SUMMARY.md, src/utils/slideshowAssembler.ts, src/types/slide.ts
- Commits verified in history: 4f13356 (Task 1), 61b501c (Task 2), 90a0a31 (deviation test fix)

---
*Phase: 49-congregational-dedicated-reference-slide*
*Completed: 2026-08-10*
