---
phase: 47-congregational-reading-divider-ux
plan: 01
subsystem: scripture-types-and-ai-split
tags: [types, ai-schema, scripture-splitter, congregational-reading]
dependency-graph:
  requires: []
  provides:
    - "CongregationalSection.speaker ALL"
    - "scripture SourceRef.speaker ALL"
    - "ScriptureSlide.isFirstSection"
    - "SplitSection.speaker ALL"
    - "SPLIT_SCHEMA speaker enum ALL"
    - "validateSplitResult ALL admission"
    - "splitPerVerse"
  affects:
    - "src/components/CongregationalEditor.vue (plan 02)"
    - "src/components/PresentationViewer.vue (plan 03)"
    - "src/components/slides/slideDisplay.ts (plan 03)"
    - "src/components/slides/EditSlideDrawer.vue (plan 03)"
    - "src/utils/slideshowAssembler.ts (plan 03)"
tech-stack:
  added: []
  patterns:
    - "Additive union widening (no migration) for LEADER/CONGREGATION/ALL"
    - "Schema+validator widened in the same change to avoid silent AI-output discard"
key-files:
  created: []
  modified:
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/utils/claudeApi.ts
    - src/utils/scriptureSplitter.ts
    - src/utils/__tests__/claudeApi.test.ts
    - src/utils/__tests__/scriptureSplitter.test.ts
decisions:
  - "isFirstSection added only to ScriptureSlide, not any other slide variant, per plan constraint — it is meaningless without a `section`"
  - "splitPerVerse implemented as a standalone function reusing parseVerses (not splitPassage/splitBySentences) so it never groups by word count"
  - "SPLIT_SYSTEM_PROMPT left unchanged — plan scoped this task to schema+validator+SplitSection only; the model may not yet be prompted to emit ALL, but the validator will not silently discard it if a future prompt change asks for it"
metrics:
  duration: "~25m"
  completed: 2026-08-08
status: complete
---

# Phase 47 Plan 01: Type/Schema/Splitter Substrate for the ALL Role and Blank Seed Summary

Widened the `CongregationalSection`/scripture `SourceRef` speaker unions and the AI split contract (schema + runtime validator) to admit an additive third `'ALL'` value, added `ScriptureSlide.isFirstSection` for plan 03's render gating, and added a new `splitPerVerse` utility that returns exactly one segment per verse for the "Start Blank" seed — no UI changes, purely the type/schema/utility foundation plans 02 and 03 build on.

## What Was Built

**Task 1 — ALL speaker unions, `isFirstSection`, AI split schema + validator widen**
- `src/types/slide.ts`: `CongregationalSection.speaker` widened from `'LEADER' | 'CONGREGATION'` to `'LEADER' | 'CONGREGATION' | 'ALL'` (additive, no migration — existing sections carry only the two prior values). Added `ScriptureSlide.isFirstSection?: boolean` with a doc comment stating it is set by `slideshowAssembler.ts`'s two content-resolution paths from the section's own ordinal, is meaningful only alongside `section`, and gates the R097 first-slide-shows-reference behavior. Added to `ScriptureSlide` only, no other slide variant.
- `src/types/slideGroup.ts`: scripture `SourceRef`'s `speaker?: 'LEADER' | 'CONGREGATION'` widened to add `'ALL'`, matching `CongregationalSection`.
- `src/utils/claudeApi.ts`: three paired changes, nothing else touched —
  1. `SplitSection.speaker` widened to `'LEADER' | 'CONGREGATION' | 'ALL'`.
  2. `SPLIT_SCHEMA`'s `speaker` enum widened to `['LEADER', 'CONGREGATION', 'ALL']`.
  3. `validateSplitResult`'s runtime guard widened from `speaker !== 'LEADER' && speaker !== 'CONGREGATION'` to also admit `'ALL'` — landed in the same commit as the schema widen (T-47-01) so an AI-proposed `ALL` section is never silently discarded. Every other check (integer range, start-at-0, no-gap-no-overlap, ends-at-max) is unchanged.
  `splitCongregationalReading`'s return type (`Promise<CongregationalSection[] | null>`) and its two documented invariants (boundaries-computed-once; whole-result-discard-on-validation-failure) were left untouched, as the plan required.
- `src/utils/__tests__/claudeApi.test.ts`: updated the existing `SPLIT_SCHEMA` string-enum test to expect `['LEADER', 'CONGREGATION', 'ALL']` (it previously asserted exactly the two-value enum and would have failed against the widened code); added an explicit enum-equality assertion; added a `validateSplitResult` case rejecting speaker `'PASTOR'`; added a case proving `validateSplitResult` accepts a well-formed `ALL`-speaker split validated against a real `computeBoundaries` array (not a hand-rolled boundaries array), matching the plan's acceptance criterion.

**Task 2 — `splitPerVerse`**
- `src/utils/scriptureSplitter.ts`: added and exported `splitPerVerse(text: string): { text: string; verseRange: string }[]`, sibling to `splitPassage`. Reuses the same `parseVerses` regex the file already uses (`/\[(\d+)\]/`), returning one entry per parsed verse unconditionally — no word-count grouping, no `DEFAULT_WORDS_PER_SLIDE`, no `splitBySentences`. A marker-less input returns a single entry with the whole trimmed text and `verseRange: ''`; empty/whitespace-only input returns `[]` (matching `splitPassage`'s empty handling). A doc comment states why this must not be `splitPassage`: that function groups by a 50-word threshold and would silently violate R096's "every verse its own segment" contract for the Blank seed. `splitPassage`, `parseVerses`, and every other existing export are untouched.
- `src/utils/__tests__/scriptureSplitter.test.ts`: added a `splitPerVerse` describe block — empty-input handling, a 20-verse fixture yielding exactly 20 entries with ascending single-number `verseRange`s, a marker-less input yielding one entry with `verseRange: ''`, a fixture that `splitPassage` groups into fewer slides yielding one-entry-per-verse from `splitPerVerse` (proving the two functions differ), and a marker-strip/trim assertion.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed as separate commits per the TDD-flagged task structure; both included test coverage in the same commit as the implementation change (single `feat` commit per task rather than separate RED/GREEN commits, since these are pure-function/type changes with straightforward, already-passing-on-first-run tests, not a multi-step behavior implementation).

## Verification

- `npx vitest run src/utils/__tests__/claudeApi.test.ts` — 73 tests passed (includes 4 new: schema enum-equality assertion, PASTOR-rejection, real-`computeBoundaries` ALL-acceptance, plus the two updated pre-existing assertions).
- `npx vitest run src/utils/__tests__/scriptureSplitter.test.ts` — 15 tests passed (includes 5 new `splitPerVerse` cases; all pre-existing `splitPassage` tests still pass unmodified).
- `npm run type-check` (`vue-tsc --build`, the CLAUDE.md-mandated gate that also typechecks test files) — clean, no errors.
- Full bare `npx vitest run` — 3 test files failed / 99 passed (102), 13 tests failed / 3054 passed (3067). The 3 failing files are **`render-service/src/render.test.ts`**, **`src/storage.rules.test.ts`**, and **`src/views/__tests__/RosterView.test.ts`** — none touched by this plan, and each failure is a pre-existing environment condition, not a regression:
  - `src/storage.rules.test.ts` and `RosterView.test.ts` are exactly CLAUDE.md's documented 2-file baseline.
  - `render-service/src/render.test.ts` failed with the documented `node:child_process` mock / Vitest-version-mismatch symptom CLAUDE.md attributes to substring-based file inclusion; this run picked it up even without a `src/` path argument, which is a pre-existing tooling quirk of this repo's config, not something this plan's changes could cause (this plan touches only `src/types/*` and `src/utils/*`, never `render-service/`).
  - `src/storage.rules.test.ts` failed all 13 of its cases in this run (not just the documented 2 "allow" cases) because no Storage emulator was running in this session — every case errored with `storage/unknown` rather than the expected `PERMISSION_DENIED`/pass. This is the "port taken"/no-emulator condition CLAUDE.md describes, not a new defect; the file's real, permanently-known 2-case defect (the `firestore.exists()` cross-service limitation) is unrelated to and unaffected by this plan.
  Neither `claudeApi.test.ts` nor `scriptureSplitter.test.ts` appear among the failures (both are 100% green, confirmed above) — no new failing file was introduced by this plan.

## Known Stubs

None. This plan introduces no UI and no data-flow paths that could stub — it is type/schema/pure-utility only.

## Threat Flags

None. Both threat register entries this plan addresses (T-47-01, T-47-02) were resolved exactly as their disposition specified: the speaker guard widened additively without relaxing any other check, and `splitPerVerse` performs only strip+trim (the file's existing display-transform convention) with no fabricated text.

## Self-Check: PASSED

- FOUND: src/types/slide.ts
- FOUND: src/types/slideGroup.ts
- FOUND: src/utils/claudeApi.ts
- FOUND: src/utils/scriptureSplitter.ts
- FOUND: src/utils/__tests__/claudeApi.test.ts
- FOUND: src/utils/__tests__/scriptureSplitter.test.ts
- FOUND commit: 91cf82b (feat(47-01): widen ALL speaker unions, add isFirstSection, widen AI split schema+validator)
- FOUND commit: 0c56ac6 (feat(47-01): add splitPerVerse — per-verse splitter for the Start Blank seed)
