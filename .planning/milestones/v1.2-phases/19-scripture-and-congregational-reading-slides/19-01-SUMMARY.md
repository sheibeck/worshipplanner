---
phase: 19-scripture-and-congregational-reading-slides
plan: 01
subsystem: scripture-types-and-splitter
tags: [types, utils, tdd, pure-function, scripture]
dependency-graph:
  requires: []
  provides:
    - "ScriptureSlide type on the Slide union + CongregationalSection type"
    - "ScriptureReading Firestore document type"
    - "src/utils/scriptureSplitter.ts (splitPassage)"
  affects:
    - "19-02 (store persists ScriptureReading)"
    - "19-03 (ScriptureSlideEditor consumes splitPassage + ScriptureSlide)"
    - "19-04 (CongregationalEditor consumes splitPassage)"
tech-stack:
  added: []
  patterns:
    - "Pure function in utils/ (splitPassage) — no store/Firebase imports"
    - "Discriminated union extension by contentKind"
key-files:
  created:
    - src/types/scriptureReading.ts
    - src/utils/scriptureSplitter.ts
    - src/utils/__tests__/scriptureSplitter.test.ts
  modified:
    - src/types/slide.ts
metrics:
  completed: 2026-07-24
status: complete
---

# Phase 19 Plan 01: Scripture types + passage splitter Summary

**Status: COMPLETE** — built and committed in `b2df23f`.

Added the `ScriptureSlide` type to the `Slide` discriminated union, defined the `ScriptureReading` Firestore document type, and implemented the pure `splitPassage` utility that breaks ESV passage text into slide-sized chunks at verse boundaries.

## What Was Built

**Types** (`src/types/slide.ts`): a `CongregationalSection` interface (`speaker: 'LEADER' | 'CONGREGATION'`, `text`, optional `verseRange`) and a `ScriptureSlide` interface (`contentKind: 'scripture'`, `reference: string`, `bookRef: ScriptureRef`, `text`, `verseRange`, `readingMode: 'normal' | 'congregational'`, optional `sections`), added to the `Slide` union (`LyricSlide | CopyrightSlide | ScriptureSlide`).

**Document type** (`src/types/scriptureReading.ts`): `ScriptureReading` — `id`, `reference: ScriptureRef`, `displayReference`, `rawText`, `readingMode: 'normal' | 'congregational'`, `slides: ScriptureSlide[]`, optional `congregationalSections`, and `createdAt`/`updatedAt` Firestore `Timestamp`s.

**Splitter** (`src/utils/scriptureSplitter.ts`): `splitPassage(text, ref, opts?)` with `DEFAULT_WORDS_PER_SLIDE = 50`. Parses ESV bracketed verse markers (`\[(\d+)\]`) into `{number, text}` verses, accumulates verses until the words-per-slide threshold is exceeded, and emits a `ScriptureSlide` per chunk with a `verseRange` label (`v. n` / `vv. n-m`). Falls back to sentence-boundary splitting when no verse numbers are present, and returns a single slide for short passages.

## Test Coverage

`src/utils/__tests__/scriptureSplitter.test.ts` — 10 unit tests covering short (single-slide), long (multi-slide), verse-boundary detection, no-verse-number sentence fallback, very long chapter, and verse-range labeling. Green at UAT (part of the 71/71 suite).

## Referencing Commit

- `b2df23f` — "Added ScriptureSlide type, ScriptureReading type, and splitPassage utility" (`src/types/slide.ts`, `src/types/scriptureReading.ts`, `src/utils/scriptureSplitter.ts`, `src/utils/__tests__/scriptureSplitter.test.ts`).

## Self-Check: PASSED

- FOUND: src/types/slide.ts (ScriptureSlide in the Slide union)
- FOUND: src/types/scriptureReading.ts
- FOUND: src/utils/scriptureSplitter.ts (splitPassage, DEFAULT_WORDS_PER_SLIDE=50)
- FOUND: src/utils/__tests__/scriptureSplitter.test.ts
- FOUND commit: b2df23f
