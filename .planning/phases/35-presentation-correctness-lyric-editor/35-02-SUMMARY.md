---
phase: 35-presentation-correctness-lyric-editor
plan: 02
subsystem: testing
tags: [vitest, slideshow-assembler, slide-group-materializer, regression-test, ccli-copyright]

# Dependency graph
requires:
  - phase: 24-slide-group-materialization
    provides: slideGroupMaterializer.ts (deriveGroupEntries, rebuildSongGroup) and slideshowAssembler.ts's fallback path, both already emitting the copyright bracket unconditionally
provides:
  - "Regression coverage pinning R060's copyright bracket on all three group-construction paths"
  - "17 new tests (9 fallback-path, 8 materialized-path) proving the bracket holds for empty/one/many-section orders, empty copyright objects, symmetric omission, and 0/1/3-stored-entry rebuild self-healing"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copyright-vs-lyric slide discrimination by structural marker, not contentKind — CopyrightSlide and LyricSlide both declare contentKind: 'lyric', so tests must check for the ccliSongNumber property (assembled-slide path) or sourceRef.kind === 'copyright' (entry path)"

key-files:
  created: []
  modified:
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts

key-decisions:
  - "R060 was closed by regression test only — zero production code was added or modified. Research (35-RESEARCH.md) traced all three group-construction paths and found the leading/trailing copyright bracket already unconditional everywhere."
  - "First-and-last copyright placement is framed exclusively as a deliberate safety margin beyond the documented convention (at least once per song), never as a CCLI licensing requirement, per P-01. CCLI's primary license text failed retrieval a second time this session (2026-08-03); nothing in this plan depends on it."

patterns-established: []

requirements-completed: [R060]

coverage:
  - id: D1
    description: "Fallback (not-yet-materialized) path: empty performanceOrder, one-section adjacency, boundary/ordering across orders of length 0/1/2/5, structural bracket positions [0, length-1], empty-copyright-object handling with no literal 'undefined', and symmetric omission when songId is unresolvable"
    requirement: "R060"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — R060 copyright bracket (fallback path)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Materialized paths: fresh derivation (deriveGroupEntries) brackets empty/one/five-section orders; rebuild (rebuildSongGroup) self-heals 0, 1, and 3 stored copyright entries to exactly 2, keeping first-as-leading and last-as-trailing and dropping any middle entry, including with an emptied performanceOrder"
    requirement: "R060"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#R060 — copyright bracket (materialized paths)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-03
status: complete
---

# Phase 35 Plan 02: R060 Copyright Bracket Regression Tests Summary

**Pinned the already-shipped leading-and-trailing copyright bracket with 17 new unit tests across both group-construction paths — zero production code touched.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-03T09:40:00-04:00 (approx.)
- **Completed:** 2026-08-03T09:51:00-04:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `assembleSlideshow — R060 copyright bracket (fallback path)` (9 tests) to `slideshowAssembler.test.ts`, covering empty order, one-section adjacency, boundary/ordering for orders of length 0/1/2/5, structural index-position assertion, an empty `copyright` object producing no literal `undefined`, and symmetric zero-slide omission.
- Added `R060 — copyright bracket (materialized paths)` (8 tests, two nested describes) to `slideGroupMaterializer.test.ts`, covering fresh `deriveGroupEntries` derivation (empty/one/five-section orders) and `rebuildSongGroup`'s self-healing merge from 0, 1, and 3 stored copyright entries — all converging to exactly 2, keeping the first entry as leading and the last as trailing, silently dropping any middle entry — plus the empty-`performanceOrder` rebuild case.
- **Confirmed both utility source files are byte-identical to how this plan found them.** `git diff --name-only HEAD -- src/utils/slideshowAssembler.ts src/utils/slideGroupMaterializer.ts src/composables/useSlideshowAssembly.ts` returns **empty** — the single most important acceptance criterion in the plan.
- Recorded a dependency-hazard comment atop the new materialized-path describe block naming `ensureGroupMaterialized`'s zero-slide bypass (currently unreachable for SONG slots because every call site sits behind `canMutateGroup`, which excludes song groups per R054) — flagged for whichever future phase relaxes R054.

## Task Commits

Each task was committed atomically:

1. **Task 1: R060 — pin the copyright bracket on the fallback (not-yet-materialized) path** - `e84c8f5` (test)
2. **Task 2: R060 — pin the copyright bracket on both materialized paths, including self-healing** - `f21e1ed` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/utils/__tests__/slideshowAssembler.test.ts` - +129 lines, one new describe block, additions only
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - +179 lines, one new describe block (two nested describes), additions only

## Decisions Made
- **R060 required zero implementation.** 35-RESEARCH.md's exhaustive trace of every group-construction path (fallback in `slideshowAssembler.ts`, fresh derivation and rebuild self-healing in `slideGroupMaterializer.ts`) found the leading-and-trailing copyright bracket already unconditional on all three, for empty orders, empty copyright objects, and corrupted stored data. This plan's only job was to pin that behavior in tests before a future refactor could quietly drop it.
- **Discriminator choice per path is deliberate, not incidental.** On the assembled-slide path, `CopyrightSlide.contentKind` and `LyricSlide.contentKind` are both `'lyric'` (`src/types/slide.ts:55-70`), so the fallback-path tests classify by the presence of the `ccliSongNumber` property instead — a `contentKind` check would have classified every lyric slide as copyright and passed vacuously. On the entry path, `sourceRef.kind === 'copyright'` is a clean discriminator with no such trap.
- **Framing (P-01):** every test name and comment describes first-and-last placement as a "safety margin" beyond the documented convention (at least once per song), never as something CCLI "requires" or "mandates." CCLI's primary license text has now failed retrieval twice (most recently 2026-08-03); this plan's tests and comments do not depend on it.

## Deviations from Plan

None — plan executed exactly as written. One test-local fix was needed and is documented below as it was caught by the project's own type gate, not a plan deviation in the Rule 1-4 sense (no behavior changed, only a syntax choice inside the new test file).

**Note on `npm run type-check`:** the first draft of one new test used `entries.at(-1)` on a `GroupSlideEntry[]`, which `vue-tsc --build` (the mandatory gate per CLAUDE.md) rejected as `TS2550` under this project's configured `lib` target. Replaced with `entries[entries.length - 1]` — same assertion, no `lib` target change, no behavior difference. This is a test-syntax correction within the task under active edit, not a deviation from the plan's scope.

## Issues Encountered

None. Both new describe blocks passed on their first run:
- `slideshowAssembler.test.ts`: 68/68 tests passed (9 new R060 tests, 59 pre-existing unmodified).
- `slideGroupMaterializer.test.ts`: 85/85 tests passed (8 new R060 tests, 77 pre-existing unmodified).

No test assertion needed adjustment against the source — research's trace held exactly as documented, which is itself confirmation that R060 was already satisfied.

## User Setup Required

None - no external service configuration required.

## Verification Evidence

- `git diff --name-only HEAD -- src/utils/slideshowAssembler.ts src/utils/slideGroupMaterializer.ts src/composables/useSlideshowAssembly.ts` → **empty**.
- `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts src/utils/__tests__/slideGroupMaterializer.test.ts -t "R060"` → **17 passed** (plan required ≥14).
- `npm run type-check` (`vue-tsc --build`) → exits 0.
- `npx vitest run src/` → 78 files passed, 2 failed (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 2241 passed / 9 failed — matches the documented non-defect baseline exactly (9 tests / 2 files per CLAUDE.md and the plan's project gates).
- `grep -rEin 'ccli (requires|mandates|requirement)|licen[cs]e requires' src/` → 0 matches (P-01 clean).
- `git diff --name-only HEAD -- src/utils/__tests__/ccliParser.test.ts src/utils/__tests__/songSectionOrder.test.ts` → empty (P-03 respected).
- `git diff --stat` on both edited test files shows insertions only, no pre-existing line touched.

## Next Phase Readiness
- R060 is closed with regression coverage on every construction path; no follow-up work needed for this requirement.
- Wave 1 sibling 35-01 (R059/R061) has already landed with no file overlap with this plan.
- Wave 2 (R065/R066) can proceed independently — this plan touched no files it depends on.

---
*Phase: 35-presentation-correctness-lyric-editor*
*Completed: 2026-08-03*

## Self-Check: PASSED
- Both modified test files exist on disk.
- This SUMMARY.md exists on disk.
- Both task commit hashes (`e84c8f5`, `f21e1ed`) exist in `git log --all`.
