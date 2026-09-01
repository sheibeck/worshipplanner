# 0177. Because the structured-outputs JSON Schema subset supports no

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/claudeApi.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

because the structured-outputs JSON Schema subset supports no numerical constraint and no cross-field relationship: shape conformance says nothing about range, ordering, adjacency, or coverage.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/claudeApi.ts:487-495`:**

```
 * because the structured-outputs JSON Schema subset supports no numerical
 * constraint and no cross-field relationship: shape conformance says nothing
 * about range, ordering, adjacency, or coverage.
 *
 * A single violation discards the ENTIRE result — never a partial array,
 * never a repair, never a re-sort. `boundaries` MUST be the exact same array
 * used to build the prompt (scriptureBoundaries.ts's Pitfall 5 discipline —
 * never recompute it here).
 */
```

**`src/utils/claudeApi.ts:580-594`:**

```
 *
 * Two invariants a future editor is most likely to break:
 * 1. `boundaries` is computed exactly once here and threaded unchanged
 *    through prompt-building, validation, and slicing. Recomputing it
 *    anywhere in this function (even by calling `computeBoundaries` again on
 *    the same `rawText`) risks desyncing the indices the model saw from the
 *    indices used to validate/slice its answer (RESEARCH Pitfall 5). This is
 *    not an optional discipline — do not "simplify" it away.
 * 2. A `validateSplitResult` failure discards the ENTIRE result. There is no
 *    partial-application path here, and none should ever be added — a
 *    result that fails validation must never leak a single section to the
 *    caller.
 *
 * Returns `null` on any failure — no internal boundary to split on, a source
 * already containing a marker delimiter, a network/API error, an unparseable
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/claudeApi.ts:487-495`
- `src/utils/claudeApi.ts:580-594`
