# 0132. Memorable share-URL slug (R-02/D-18) — used to build

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Memorable share-URL slug (R-02/D-18) — used to build /{slug}/quarterN-YYYY links.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `R-02`):

**`src/stores/auth.ts:92-92`:**

```
  // Memorable share-URL slug (R-02/D-18) — used to build /{slug}/quarterN-YYYY links.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:92-92`
