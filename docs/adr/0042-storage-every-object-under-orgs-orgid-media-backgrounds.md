# 0042. --- Storage: every object under orgs/{orgId}/ (media, backgrounds

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgDeletion.ts`. Documented at the time in `77-RESEARCH.md`.

--- Storage: every object under orgs/{orgId}/ (media, backgrounds, pptx-imports, rendered, ...) -- a single prefix covers all of them (77-RESEARCH.md Standard Stack).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/orgDeletion.ts:187-192`:**

```

  // --- Storage: every object under orgs/{orgId}/ (media, backgrounds,
  // pptx-imports, rendered, ...) -- a single prefix covers all of them
  // (77-RESEARCH.md Standard Stack). force:true so a transient per-object
  // failure never aborts the whole sweep (Pitfall 4). ---------------------
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgDeletion.ts:187-192`
