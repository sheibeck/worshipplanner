# 0172. Matches a clause-ending mark followed by whitespace. Deliberately

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/scriptureBoundaries.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Matches a clause-ending mark followed by whitespace. Deliberately excludes the comma: including it fragments nearly every line of scripture into unreadably tiny pieces (RESEARCH § Common Pitfalls, Pitfall 4) and defeats...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/scriptureBoundaries.ts:17-25`:**

```

/**
 * Matches a clause-ending mark followed by whitespace. Deliberately excludes
 * the comma: including it fragments nearly every line of scripture into
 * unreadably tiny pieces (RESEARCH § Common Pitfalls, Pitfall 4) and defeats
 * the point of "clause, not sentence, granularity." This is a tuning knob
 * owned by the empirical determinism check (RESEARCH Assumption A2/A3), not
 * an oversight — revisit if real Haiku output on Psalm 136/24 looks wrong.
 */
```

**`src/utils/scriptureBoundaries.ts:33-40`:**

```
 * always included as the passage's own start/end anchors, even when the
 * passage has no internal boundary at all.
 *
 * Pure and synchronous — reads no global state, fetches nothing, mutates
 * nothing. Callers must compute this once and thread the SAME array through
 * both prompt-building and validation; recomputing between the two silently
 * desyncs indices from meaning (RESEARCH § Common Pitfalls, Pitfall 5).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/scriptureBoundaries.ts:17-25`
- `src/utils/scriptureBoundaries.ts:33-40`
