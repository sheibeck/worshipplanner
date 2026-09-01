# 0173. Fix (47-REVIEW): the verse range that actually belongs to a segment

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/scriptureBoundaries.ts`. Documented at the time in `47-REVIEW`.

WR-01 fix (47-REVIEW): the verse range that actually belongs to a segment spanning `boundaries[startBoundary]..boundaries[endBoundary]`, computed from WHERE each verse marker's own boundary sits — never by re-scanning th...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/utils/scriptureBoundaries.ts:131-145`:**

```

/**
 * Reads the bracketed verse numbers present in `slice` and returns a single
 * number as a string, a hyphenated first-last range when several are
 * present, or `undefined` when the slice carries no verse marker at all.
 *
 * CAUTION (47-REVIEW WR-01): this scans `slice` for every `[N]` occurrence,
 * with no awareness of WHERE the slice's boundary was cut. When a verse runs
 * on into the next without terminal clause punctuation, there is no legal
 * boundary at "end of this verse's words" — only at the START of the next
 * verse's own marker — so a segment's raw slice can legitimately extend
 * through the next verse's `[N]` marker even though none of that verse's
 * words are included. Calling this on such a slice reports the next verse
 * as part of the range even though it isn't. Callers that have boundary
 * indices available (not just raw slice text) should prefer
```

**`src/utils/scriptureBoundaries.ts:154-169`:**

```

/**
 * WR-01 fix (47-REVIEW): the verse range that actually belongs to a segment
 * spanning `boundaries[startBoundary]..boundaries[endBoundary]`, computed
 * from WHERE each verse marker's own boundary sits — never by re-scanning
 * the raw slice text for every `[N]` occurrence it happens to contain (see
 * the caution on `verseRangeForSlice` above).
 *
 * A verse belongs to this segment only if the boundary its own `[N]` marker
 * created lies in `[startBoundary, endBoundary)` — i.e. strictly BEFORE
 * `endBoundary`. This is what excludes a verse whose marker only appears
 * because the segment's raw span had nowhere legal to end except at that
 * verse's own start (the exact WR-01 scenario): that verse's marker
 * boundary equals `endBoundary` itself, which fails the strict `<` and is
 * correctly attributed to the NEXT segment instead.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/scriptureBoundaries.ts:131-145`
- `src/utils/scriptureBoundaries.ts:154-169`
