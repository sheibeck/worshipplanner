# 0157. APP-ONLY / manual — NOT fetchable from Planning Center Services v2

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/types/roster.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

APP-ONLY / manual — NOT fetchable from Planning Center Services v2 (D-14, RESEARCH Pitfall 5)

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/types/roster.ts:22-22`:**

```
  /** APP-ONLY / manual — NOT fetchable from Planning Center Services v2 (D-14, RESEARCH Pitfall 5) */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/types/roster.ts:22-22`
