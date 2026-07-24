---
phase: 20-service-sections-and-slide-auto-assembly
plan: 02
subsystem: service-planning
tags: [typescript, vitest, tdd, slide-assembly, pure-function]

requires:
  - phase: 20-service-sections-and-slide-auto-assembly (plan 01)
    provides: ServiceSection type, optional per-slot section field, TextSlide/AssembledSlide/AssembledSection wrapper types
provides:
  - "assembleSlideshow(service, inputs): AssembledSlide[] — pure slideshow auto-assembly engine (R005)"
  - "AssemblyInputs interface (songLyricsById, performanceOrderById, scriptureReadingsById maps)"
  - "Position-sort-driven reorder contract proven at the pure-function layer (R006)"
affects: [20-03-reactive-assembly-composable, 20-04-section-ui]

tech-stack:
  added: []
  patterns:
    - "Pure function assembly: no Firestore import, no Pinia store import — all inputs pre-loaded by the caller (verified by grep, not just type-check)"
    - "Slot index captured by pairing {slot, index} before sorting by position, so AssembledSlide.slotIndex reflects true array provenance in service.slots even if position values are ever inconsistent with array order"
    - "Content built as Omit<Variant, 'id'|'position'> then id/position assigned once at emit time via a DistributiveOmit-typed union, giving every emitted slide a stable '{slotIndex}:{localSeq}' id and a running global 0-based position"

key-files:
  created:
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
  modified: []

key-decisions:
  - "Song order precedence chain: performanceOrderById.get(songId) (if non-empty) -> lyrics.performanceOrder (if non-empty) -> lyrics.sections in stored order — implements the research-identified fallback for missing Song.performanceOrder"
  - "Scripture slides are re-wrapped with a fresh id/position (via the same emit() path as all other content) rather than literally reusing the source ScriptureSlide's id/position — 'unchanged' in the plan's behavior spec refers to content fields (reference, text, bookRef, verseRange, readingMode, sections), which are passed through byte-identical"
  - "PRAYER/MESSAGE/HYMN handling was implemented as part of Task 1's single switch statement (not deferred to a separate Task 2 code change) because splitting SONG/SCRIPTURE resolution from the sibling PRAYER/MESSAGE/HYMN cases mid-function would have produced an artificially fragmented, less readable implementation — see Deviations"

patterns-established:
  - "DistributiveOmit<T, K> = T extends unknown ? Omit<T, K> : never — required because plain Omit<Slide, 'id'|'position'> collapses a discriminated union to only its common keys; this pattern will be reusable wherever future code needs a 'variant minus common fields' type over the Slide union"

requirements-completed: [R005, R006]

coverage:
  - id: D1
    description: "assembleSlideshow resolves SONG slots into leading/trailing CopyrightSlide + ordered LyricSlide-per-section, using the performanceOrderById -> lyrics.performanceOrder -> stored lyrics.sections fallback chain; unknown section ids skipped without throwing; null/unloaded songId contributes zero slides"
    requirement: "R005"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — song resolution (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "assembleSlideshow passes through SCRIPTURE slot reading.slides in stored order, one AssembledSlide per entry, content fields unchanged; null/absent/unloaded scriptureReadingId contributes zero slides"
    requirement: "R005"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — scripture resolution (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PRAYER/MESSAGE/HYMN slots each emit exactly one TextSlide-backed AssembledSlide with sourceId === null; HYMN body reflects hymnName (+ verses when present)"
    requirement: "R005"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — text/hymn slots (4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reordering input slots (swapping two positions) reorders the assembled output correspondingly with no other change — the R006 auto-reorder contract proven at the pure-function layer"
    requirement: "R006"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — reorder ordering (R006) (1 test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "slot.section (including undefined for legacy section-less services) is copied onto every emitted AssembledSlide; a mixed worship/message/sending service produces correct per-slide section metadata in a single flat ordered array"
    requirement: "R005"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — section metadata pass-through (2 tests)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-24
status: complete
---

# Phase 20 Plan 02: Slideshow Auto-Assembly Engine Summary

**Pure TypeScript `assembleSlideshow(service, inputs)` mapping ordered service slots to a flat `AssembledSlide[]`, covering SONG (copyright + ordered lyric sections with a 3-level performanceOrder fallback), SCRIPTURE (passthrough), and PRAYER/MESSAGE/HYMN (TextSlide stubs), with the R006 reorder contract proven as a pure ordering assertion — 19 tests, zero I/O.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-24T22:34:00Z
- **Completed:** 2026-07-24T22:37:30Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `src/utils/slideshowAssembler.ts` created: `AssemblyInputs` interface (`songLyricsById`, `performanceOrderById`, `scriptureReadingsById` maps) and `assembleSlideshow(service, inputs): AssembledSlide[]`, a fully pure function (no `firebase/firestore` import, no Pinia store import — verified by grep) that walks `service.slots` paired with their original array index, sorts by `position`, and resolves each slot kind.
- SONG resolution: one leading `CopyrightSlide`, one `LyricSlide` per section id in the resolved order, one trailing `CopyrightSlide`. Order resolved via `performanceOrderById.get(songId)` (if non-empty) → `lyrics.performanceOrder` (if non-empty) → `lyrics.sections` in stored order (the research-identified fallback for songs missing `Song.performanceOrder`). Unknown section ids in the order are skipped without throwing. `songId === null` or a `songId` absent from `songLyricsById` contributes zero slides.
- SCRIPTURE resolution: one `AssembledSlide` per `reading.slides` entry in stored order, content fields (reference, text, bookRef, verseRange, readingMode, sections) passed through unchanged; `scriptureReadingId` null/absent/unloaded contributes zero slides.
- PRAYER/MESSAGE/HYMN resolution: exactly one `TextSlide`-backed `AssembledSlide` each, `sourceId: null`. PRAYER/MESSAGE title+body use `slotLabel()`; HYMN body reflects `hymnName` (+ `verses` when present, blank when absent).
- Reorder ordering proof (R006): because output order derives solely from `[...slots].sort((a,b) => a.position - b.position)`, swapping two slots' positions in the input deterministically reorders the assembled output with no other change — proven directly as a unit test, not inferred.
- Section metadata pass-through: every `AssembledSlide.section` is copied from `slot.section` (including `undefined` for legacy section-less services); a 4-slot mixed worship/message/sending fixture (song + scripture + prayer + song) asserts the exact per-slide section sequence across all 10 emitted slides.
- Every emitted `AssembledSlide` carries `slotIndex` (the source slot's true index in `service.slots`, captured before sorting — robust even if `position` values were ever inconsistent with array order), `slotKind`, `section`, and `sourceId` (`songId`/`readingId`/`null`).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — song and scripture slot resolution tests** - `4721e68` (test)
1. **Task 1: GREEN — implement pure slideshow assembly engine** - `98fbdb9` (feat)
2. **Task 2: RED+verify — text/hymn slots, reorder ordering, section metadata tests** - `b82b125` (test; no separate GREEN commit needed — see Deviations)

**Plan metadata:** committed separately (see final commit below)

_Note: Task 1 followed the standard RED/GREEN TDD cycle. Task 2's tests passed immediately on addition (see Deviations) — verified via `npx vitest run` (19/19 green) and a file-scoped type-check diff (zero new errors) before committing the test file, so no separate implementation commit was created for Task 2._

## Files Created/Modified
- `src/utils/slideshowAssembler.ts` (new) - `AssemblyInputs` interface + `assembleSlideshow()` pure function; SONG/SCRIPTURE/PRAYER/MESSAGE/HYMN resolution, `resolveSongOrder()` and `buildCopyrightSlideContent()` helpers, `DistributiveOmit<T,K>` utility type
- `src/utils/__tests__/slideshowAssembler.test.ts` (new) - 19 tests across 6 `describe` blocks: song resolution (7), scripture resolution (5), text/hymn slots (4), reorder ordering / R006 (1), section metadata pass-through (2)

## Decisions Made
- Song order precedence chain implemented exactly per 20-RESEARCH.md's fallback mitigation: `performanceOrderById` (per-song override map, keyed by songId, sourced from the Song doc) takes priority over `lyrics.performanceOrder`, which takes priority over `lyrics.sections` stored order.
- `AssembledSlide.slotIndex` is captured as the slot's index within `service.slots` *before* sorting by position (via `service.slots.map((slot, index) => ({slot, index}))` then sorting the pairs) rather than the post-sort loop index — this decouples slot provenance from position-value correctness, which matters for legacy/malformed data per the plan's DoS threat mitigation (T-20-02).
- Every emitted inner `Slide` gets a freshly assigned `id` (`${slotIndex}:${localSeq}`) and a running global 0-based `position`, even for scripture passthrough — "unchanged" in the plan's behavior spec is interpreted as content-field-unchanged (reference/text/bookRef/verseRange/readingMode/sections), not literal id/position reuse, since the assembled array's own position numbering must be a single sequential run across the whole output.
- `DistributiveOmit<T, K> = T extends unknown ? Omit<T, K> : never` introduced because a plain `Omit<Slide, 'id'|'position'>` collapses the four-member discriminated union down to only the keys common to all variants (`id`, `position`, `contentKind`), silently discarding every content-specific field from the emit-time parameter type.

## Deviations from Plan

### Process note: Task 2 required no separate GREEN commit

**What happened:** Task 1's implementation (`98fbdb9`) was written as a single `switch (slot.kind)` statement covering `SONG`, `SCRIPTURE`, `PRAYER`, `MESSAGE`, and `HYMN` together, rather than stubbing the `PRAYER`/`MESSAGE`/`HYMN` cases and deferring their logic to Task 2. When Task 2's RED tests (text/hymn slots, reorder ordering, section metadata pass-through) were added in `b82b125`, all 19 tests (12 existing + 7 new — note: Task 2 actually added 7 net new test cases across 4 new `describe` blocks) passed immediately with zero implementation changes.

**Why:** Splitting one cohesive slot-resolution switch statement across two commits — stubbing three of its five cases in Task 1 only to fill them in during Task 2 — would have produced a less coherent, harder-to-review intermediate state for no behavioral benefit. The position-sort-driven reorder contract (R006) and the section-passthrough (`section: slot.section`) are structural properties of the `emit()` helper shared by every slot kind, so they were also already correct once any slot kind was wired through.

**Verification that this was not premature/incorrect implementation:** Before committing Task 2's test additions, the full test file was run (`npx vitest run` — 19/19 passed) and a file-scoped `npm run type-check` diff was taken (zero new errors), confirming the tests genuinely exercise real behavior rather than passing vacuously. This is documented rather than hidden per the deviation-tracking requirement; it is a plan-execution sequencing note, not a bug or scope change — both tasks' `<acceptance_criteria>` are fully satisfied.

**Impact:** None on correctness or scope. All `<acceptance_criteria>` and `<verification>` items from both tasks pass.

---

**Total deviations:** 1 process note (TDD commit sequencing), 0 auto-fixed bugs, 0 architectural changes.
**Impact on plan:** No scope creep, no functional deviation. Documented for transparency per the executor's TDD Gate Compliance obligation.

## TDD Gate Compliance

- Task 1: RED (`4721e68`, `test(20-02): ...`) confirmed failing (module did not exist) via `npx vitest run` before GREEN (`98fbdb9`, `feat(20-02): ...`) made all 12 tests pass. Full RED→GREEN gate sequence present.
- Task 2: test commit (`b82b125`, `test(20-02): ...`) present; no separate GREEN commit exists because the tests passed against the existing Task 1 implementation with no code changes (see Deviations above). This is flagged here per the TDD Gate Compliance instruction, since a literal fail→pass transition was not captured for Task 2's specific test additions — the underlying behavior was nonetheless independently re-verified (full suite green, file-scoped type-check clean) at the moment the tests were added.

## Issues Encountered
- The full project test suite (`npx vitest run`, 2902 tests) surfaced 3 pre-existing failures, all confined to a stale worktree copy at `.gsd/quarantine/worktrees/M001-2026-07-24T21-17-32-997Z/src/views/__tests__/RosterView.test.ts`. This is untracked GSD housekeeping debris (already present in `git status` before this plan started) unrelated to `src/` and out of scope per the SCOPE BOUNDARY rule — not fixed. All 2785 non-skipped, non-quarantine tests passed, including the new `slideshowAssembler.test.ts` (19/19) and the pre-existing `slotTypes.test.ts` (36/36, unaffected by this plan).
- `npm run type-check` (whole-project `vue-tsc --build`) continues to exit non-zero solely due to the pre-existing `ccliParser.ts`/`scriptureSplitter.ts` errors logged in `20-01`'s `deferred-items.md` (verified unchanged — none in `slideshowAssembler.ts` or its test file, confirmed by grepping the type-check output for `slideshowAssembler`: zero matches).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `assembleSlideshow(service, inputs): AssembledSlide[]` and `AssemblyInputs` are exported from `src/utils/slideshowAssembler.ts` and fully unit-tested in isolation — Plan 20-03 (reactive assembly composable) can wrap this pure function in a Vue `computed()` that supplies live `songLyricsById`/`performanceOrderById`/`scriptureReadingsById` maps from the Phase 18/19 stores, with no changes needed to the pure function itself.
- The R006 reorder contract is proven at this layer: any composable built on top only needs to re-invoke `assembleSlideshow` when `service.slots` or the content maps change — reactivity, not reordering logic, is the only remaining concern for 20-03.
- `AssembledSlide.section` (including `undefined` for legacy slots) flows straight through — Plan 20-04 (section UI) can group by `section ?? 'ungrouped'` (or similar) without any additional data-shaping step.
- Blocker/concern carried forward (unchanged from 20-01): the pre-existing `ccliParser.ts`/`scriptureSplitter.ts` type-check failures mean `npm run type-check` cannot be used as a hard whole-project pass/fail gate — subsequent Phase 20 plans should keep using file-scoped diffing, as this plan did.

---
*Phase: 20-service-sections-and-slide-auto-assembly*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: src/utils/slideshowAssembler.ts
- FOUND: src/utils/__tests__/slideshowAssembler.test.ts
- FOUND commit: 4721e68
- FOUND commit: 98fbdb9
- FOUND commit: b82b125
