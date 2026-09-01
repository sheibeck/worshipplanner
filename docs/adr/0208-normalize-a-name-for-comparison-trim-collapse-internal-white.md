# 0208. Normalize a name for comparison: trim, collapse internal whitespace

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/volunteerCsv.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Normalize a name for comparison: trim, collapse internal whitespace, lowercase. Used to match CSV names against roster people (D-16, Pitfall 4).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/volunteerCsv.ts:139-143`:**

```

/**
 * Normalize a name for comparison: trim, collapse internal whitespace,
 * lowercase. Used to match CSV names against roster people (D-16, Pitfall 4).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/volunteerCsv.ts:139-143`
