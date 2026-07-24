---
id: T01
parent: S02
milestone: M001
key_files:
  - src/types/slide.ts
  - src/types/scriptureReading.ts
  - src/utils/scriptureSplitter.ts
  - src/utils/__tests__/scriptureSplitter.test.ts
key_decisions:
  - CongregationalSection extracted as a shared interface in slide.ts, reused by both ScriptureSlide and ScriptureReading
  - splitPassage generates deterministic IDs as scripture-{position} for slide identification
  - Sentence-boundary fallback uses regex splitting on .!? punctuation when no [N] verse markers are present
duration: 
verification_result: passed
completed_at: 2026-07-24T13:50:50.566Z
blocker_discovered: false
---

# T01: Added ScriptureSlide type, ScriptureReading type, and splitPassage utility with 10 passing tests

**Added ScriptureSlide type, ScriptureReading type, and splitPassage utility with 10 passing tests**

## What Happened

Implemented the foundational types and splitting algorithm for scripture slides:

1. **ScriptureSlide type** (`src/types/slide.ts`): Added `CongregationalSection` interface and `ScriptureSlide` interface extending `SlideBase` with `contentKind: 'scripture'`, structured `bookRef`, display `reference`, `text`, `verseRange`, `readingMode`, and optional `sections`. Updated the `Slide` union to include `ScriptureSlide`.

2. **ScriptureReading type** (`src/types/scriptureReading.ts`): Created Firestore document interface with `id`, `reference`, `displayReference`, `rawText`, `readingMode`, `slides`, optional `congregationalSections`, and timestamps. Imports `ScriptureRef` from service.ts and slide types from slide.ts.

3. **splitPassage utility** (`src/utils/scriptureSplitter.ts`): Pure function that parses `[N]` verse markers from ESV API output, accumulates verses until word count exceeds threshold (default 50), splits at verse boundaries, and generates verse range labels (`v. 1` / `vv. 28-32`). Falls back to sentence-boundary splitting when no verse markers are present. Returns empty array for empty input.

4. **Tests** (`src/utils/__tests__/scriptureSplitter.test.ts`): 10 tests covering empty input, single verse, short passage, medium multi-slide split, long psalm-length passage, sentence-boundary fallback, custom wordsPerSlide, verse range label formatting, sequential position assignment, and reference string formatting for various ref shapes.

## Failure Modes

This task produces pure types and a pure synchronous function with no external dependencies (no API calls, no filesystem, no network). The `splitPassage` function operates entirely on in-memory strings. No failure modes from external dependencies apply.

## Load Profile

The `splitPassage` function processes a single passage string in O(n) time where n is word count. At 10x load (10x longer passages), it produces proportionally more slides with no resource saturation risk — it's a simple loop over an in-memory array with no allocations beyond the output slides. No runtime load dimension applies.

## Negative Tests

- **Empty text**: `splitPassage('', ref)` and `splitPassage('   ', ref)` both return `[]`
- **No verse markers**: Falls back to sentence-boundary splitting instead of crashing — tested with prose text
- **Single verse boundary**: Produces correct `v. N` label instead of `vv. N-N`
- **Below-threshold passages**: Returns single slide instead of splitting — tested explicitly
- **Various ref shapes**: Handles missing `verseStart`, missing `verseEnd`, and full range correctly in reference formatting

## Verification

Ran `npx vitest run src/utils/__tests__/scriptureSplitter.test.ts` — all 10 tests passed in 3.31s. ScriptureSlide is exported from slide.ts and included in the Slide union. ScriptureReading type is exported from scriptureReading.ts.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/utils/__tests__/scriptureSplitter.test.ts` | 0 | pass | 7046ms |

## Deviations

None.

## Known Issues

None

## Files Created/Modified

- `src/types/slide.ts`
- `src/types/scriptureReading.ts`
- `src/utils/scriptureSplitter.ts`
- `src/utils/__tests__/scriptureSplitter.test.ts`
