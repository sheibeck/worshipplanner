# 0041. --- READ phase (Pattern 2 / Pitfall 1): everything below MUST

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgDeletion.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

--- READ phase (Pattern 2 / Pitfall 1): everything below MUST complete before any delete/recursiveDelete/deleteFiles fires. -----------------

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/orgDeletion.ts:138-141`:**

```

  // --- READ phase (Pattern 2 / Pitfall 1): everything below MUST complete
  // before any delete/recursiveDelete/deleteFiles fires. -----------------
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgDeletion.ts:138-141`
