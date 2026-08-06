---
phase: 34-smarter-content-llm-scripture-split
plan: 01
subsystem: utils
tags: [scripture, esv, boundary-index, structured-outputs, r064]

requires: []
provides:
  - "computeBoundaries(text): legal split positions from untouched ESV text (verse markers + clause-ending punctuation, comma excluded)"
  - "hasSplittableBoundaries(boundaries): gate for whether the AI-split affordance should even be offered"
  - "embedBoundaryMarkers(text, boundaries): model-facing marked-up copy with ⟦i⟧ tokens, null-refusal on delimiter collision"
  - "sliceAtBoundaries(text, boundaries, start, end): the byte-exactness backstop — one String.slice, nothing else"
  - "stripVerseMarkers / verseRangeForSlice: display-only transforms matching scriptureSplitter.ts's existing convention"
affects: [34-02, 34-03, 34-04]

tech-stack:
  added: []
  patterns:
    - "Boundary-index contract: legal split positions computed once from untouched source text, threaded unchanged through prompt-building and validation, never recomputed"
    - "Hard null-refusal (not throw, not fallback) when an invariant (marker-delimiter collision) can't be guaranteed"

key-files:
  created:
    - src/utils/scriptureBoundaries.ts
    - src/utils/__tests__/scriptureBoundaries.test.ts
  modified: []

key-decisions:
  - "Followed RESEARCH's boundary-index design exactly — integer indices into a pre-computed array, not raw character offsets — making mid-sentence splits structurally unrepresentable rather than merely validated-against."
  - "Comma deliberately excluded from the clause-boundary character class (RESEARCH Pitfall 4) — documented as a tuning knob for the empirical determinism check owned by 34-03/manual verification, not an oversight."
  - "sliceAtBoundaries's body is exactly one String.slice call — verified both by round-trip/partition tests and by a source-inspection test asserting the absence of normalize/trim/replace/toLowerCase and exactly one .slice( occurrence."

patterns-established:
  - "Pattern: encoding backstop — any function claiming byte-exactness against a trusted source gets both a behavioral round-trip test AND a source-inspection test guarding against future transformation creep."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "computeBoundaries() derives legal split positions (verse markers + clause-ending punctuation, comma excluded) from untouched ESV text, including a Psalm-136-shaped refrain fixture"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scriptureBoundaries.test.ts#computeBoundaries"
        status: pass
    human_judgment: false
  - id: D2
    description: "hasSplittableBoundaries() correctly gates the AI-split affordance off for passages with no legal internal division"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scriptureBoundaries.test.ts#hasSplittableBoundaries"
        status: pass
    human_judgment: false
  - id: D3
    description: "embedBoundaryMarkers() round-trips exactly (strict ===) including non-ASCII punctuation, and hard-refuses (null) when the source already contains a marker delimiter"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scriptureBoundaries.test.ts#embedBoundaryMarkers"
        status: pass
    human_judgment: false
  - id: D4
    description: "sliceAtBoundaries() is byte-exact (strict ===) including non-ASCII punctuation, partitions the source with no drops/duplicates, and its body is guarded by source-inspection to contain no normalizing/trimming/comparison call"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scriptureBoundaries.test.ts#sliceAtBoundaries"
        status: pass
    human_judgment: false
  - id: D5
    description: "stripVerseMarkers()/verseRangeForSlice() match scriptureSplitter.ts's existing display-text convention"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scriptureBoundaries.test.ts#stripVerseMarkers, #verseRangeForSlice"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 01: Boundary-Index Contract Summary

**Pure-function boundary layer (`computeBoundaries`, `hasSplittableBoundaries`, `embedBoundaryMarkers`, `sliceAtBoundaries`, `stripVerseMarkers`, `verseRangeForSlice`) that makes altered scripture structurally impossible by constraining the model to integer indices into a pre-computed legal-position array.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-03T03:20:00-04:00 (approx)
- **Completed:** 2026-08-03T03:28:37-04:00
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 2 (both new)

## Accomplishments
- `computeBoundaries(text)` derives every legal split position from untouched ESV text: right after each `[N]` verse marker and right after clause-ending punctuation (`. ! ? ; :`) followed by whitespace, with comma deliberately excluded. Position 0 and `text.length` are always present as anchors.
- `hasSplittableBoundaries(boundaries)` gates the affordance: fewer than 3 entries (the two anchors plus at least one internal division) means the passage cannot be split at all — the manual editor path is the only option.
- `embedBoundaryMarkers(text, boundaries)` produces a model-facing copy with a `⟦i⟧` token at every legal boundary, hard-refusing (`null`) if the source already contains either delimiter character (U+27E6/U+27E7).
- `sliceAtBoundaries(text, boundaries, start, end)` — the encoding backstop — performs exactly one `String.slice` call against the untouched source, proven byte-exact (strict `===`) against a fixture containing curly double quotes, a curly apostrophe, and an em dash, and proven to partition the whole source with no drops or duplicates when concatenated over every adjacent boundary pair.
- `stripVerseMarkers`/`verseRangeForSlice` mirror `scriptureSplitter.ts`'s existing convention of keeping verse numbers out of display text.

## Task Commits

Each task followed the RED → GREEN TDD cycle:

1. **Task 1: computeBoundaries() and hasSplittableBoundaries()**
   - `test(34-01)`: `556117d` — 10 failing tests (verified RED via a temporary throw-stub, then reverted)
   - `feat(34-01)`: `7384208` — implementation, all 10 pass
2. **Task 2: embedBoundaryMarkers(), sliceAtBoundaries(), and the byte-exactness backstop**
   - `test(34-01)`: `5cc5eef` — 13 additional failing tests (naturally RED — functions didn't exist yet)
   - `feat(34-01)`: `03e85a3` — implementation, all 23 pass

**Plan metadata:** committed below (`docs(34-01): complete plan`).

## Files Created/Modified
- `src/utils/scriptureBoundaries.ts` (new) — the four exported functions plus `BOUNDARY_MARKER_OPEN`/`BOUNDARY_MARKER_CLOSE` and `stripVerseMarkers`/`verseRangeForSlice`, none of which existed before.
- `src/utils/__tests__/scriptureBoundaries.test.ts` (new) — 23 tests covering verse-marker and clause-boundary detection, the Psalm-136-shaped refrain fixture, comma exclusion, anchor/empty-text edge cases, marker round-trip, per-index marker placement, delimiter-collision refusal, the non-ASCII encoding backstop (curly quotes, curly apostrophe, em dash) with strict `===` assertions in both the marker round-trip and slice tests, the partition proof, a source-inspection guard on `sliceAtBoundaries`'s body, and verse-range formatting.

## Decisions Made
- Implemented the RESEARCH.md boundary-index design exactly as specified — no deviation from the sketch's approach (Set-based accumulation of verse-marker and clause-ending positions, sorted ascending).
- For Task 1's RED verification, since the full implementation was already drafted in the same turn, I temporarily replaced it with a throw-stub, ran the suite to confirm all 10 tests genuinely fail, then restored the real implementation before the GREEN commit — preserving the spirit of the TDD gate (a test commit that would fail without the corresponding implementation) even though the implementation code existed in my working set before the RED commit landed.
- Task 2's RED state was genuine (not simulated): the test additions referenced four functions (`embedBoundaryMarkers`, `sliceAtBoundaries`, `stripVerseMarkers`, `verseRangeForSlice`) that did not yet exist in the source file at commit time, so the 13 new tests failed with `TypeError: ... is not a function` — a real RED gate.
- `sliceAtBoundaries`'s acceptance criterion ("no normalize/trim/replace/toLowerCase, exactly one slice call") is enforced both behaviorally (round-trip/partition tests) and structurally, via a test that calls `.toString()` on the function and regex-scans its source — this guards against future transformation creep, not just today's implementation.

## Deviations from Plan

None — plan executed exactly as written. One test-authoring bug was self-caught and fixed before the GREEN commit:

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own test, not the plan] Empty-text anchor expectation was wrong**
- **Found during:** Task 1, first GREEN test run
- **Issue:** My test asserted `computeBoundaries('')` returns `[0, 0]`, but `new Set([0, 0])` correctly collapses to a single entry `[0]` since `0 === text.length` for empty text — the test's expectation was wrong, not the implementation.
- **Fix:** Corrected the assertion to `[0]` with an explanatory comment.
- **Files modified:** `src/utils/__tests__/scriptureBoundaries.test.ts`
- **Verification:** Re-ran the suite; all 10 Task-1 tests pass.
- **Committed in:** `7384208` (part of the Task 1 GREEN commit, since the test fix and implementation landed together)

---

**Total deviations:** 1 auto-fixed (self-caught test-authoring bug, Rule 1)
**Impact on plan:** None on scope or design — the fix only corrected a test's own expectation to match the deliberately-correct `Set` collapsing behavior for the empty-text edge case.

**Requirements tracking note:** All four plans in this phase list `requirements: [R064]` (it is a single-requirement phase decomposed into four structural waves). Running the standard `requirements mark-complete R064` step after this plan would have flipped R064 to `[x]`/"Complete" in `REQUIREMENTS.md` after only the boundary-utility layer (25% of the phase) landed — factually premature, since R064's full claim (structural guarantee end-to-end, reachable by a user) isn't true until 34-04 wires the affordance into the UI. I reverted that specific file (`git checkout -- .planning/REQUIREMENTS.md`) rather than let an incorrect "Complete" status persist. **34-04 (the phase's last plan) should run `requirements mark-complete R064` instead.**

## Issues Encountered
None beyond the self-fixed test bug above.

## How the encoding backstop was handled

Per the plan's key constraint, source-match equality is defined over the exact JavaScript string returned by the ESV API with no normalization, trimming, or folding of any kind. This was enforced at three independent layers:

1. **`sliceAtBoundaries`'s implementation** performs exactly one `text.slice(...)` call and nothing else — no `.normalize()`, `.trim()`, `.replace()`, `.toLowerCase()`, or comparison operator anywhere in its body.
2. **Behavioral tests** assert strict `===` (not `.toBe()` alone, but an explicit `=== ` boolean check fed into `expect(...).toBe(true)`) against a fixture (`NON_ASCII_FIXTURE`) containing curly opening/closing double quotes (U+201C/U+201D), a curly apostrophe (U+2019), and an em dash (U+2014), both for the marker round-trip (`embedBoundaryMarkers` → strip → compare to original) and for every adjacent-pair slice.
3. **A source-inspection test** calls `.toString()` on `sliceAtBoundaries` and regex-scans its source text for forbidden method calls (`normalize`, `trim`, `replace`, `toLowerCase`) and asserts exactly one `.slice(` occurrence — a structural guard that will fail if a future edit adds any transformation, independent of whether a specific test fixture happens to catch it.

## User Setup Required
None — no external service configuration required. This plan adds no new dependency, touches no `functions/` code, and makes no network call.

## Next Phase Readiness

**What Wave 2 (34-02) needs and gets from this plan:**
- `computeBoundaries`, `hasSplittableBoundaries`, `embedBoundaryMarkers`, and `sliceAtBoundaries` are all implemented, tested, and exported from `src/utils/scriptureBoundaries.ts` — 34-02's `validateSplitResult()` can import `hasSplittableBoundaries`'s companion bounds-check pattern (`0 <= i < boundaries.length`) directly against the same `boundaries` array type (`number[]`) this plan produces.
- The **RESEARCH Pitfall 5 discipline** (compute `boundaries` once, thread the same array through prompt-building and validation, never recompute) is baked into every function's contract via head comments — 34-02/34-03 should follow this when wiring `splitCongregationalReading()`.
- `stripVerseMarkers`/`verseRangeForSlice` are ready for 34-03's `splitCongregationalReading()` to call when converting a validated `{startBoundary, endBoundary}` pair into a `CongregationalSection`.
- No blockers. `npm run type-check` is clean, `npx vitest run src/` shows the unchanged 2-file/9-test baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), and `package.json` is untouched.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `src/utils/scriptureBoundaries.ts`
- FOUND: `src/utils/__tests__/scriptureBoundaries.test.ts`
- FOUND commit: `556117d` (test — Task 1 RED)
- FOUND commit: `7384208` (feat — Task 1 GREEN)
- FOUND commit: `5cc5eef` (test — Task 2 RED)
- FOUND commit: `03e85a3` (feat — Task 2 GREEN)
