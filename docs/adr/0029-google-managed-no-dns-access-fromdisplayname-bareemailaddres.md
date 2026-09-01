# 0029. (Google-managed, no DNS access). fromDisplayName + bareEmailAddress

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. Documented at the time in `59-RESEARCH.md`.

(Google-managed, no DNS access). fromDisplayName + bareEmailAddress (the pure From-header helpers) now live in ./params -- imported and re-exported at the top of this file (moved so adminEmail.ts can reuse them without a...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/index.ts:2810-2814`:**

```
// (Google-managed, no DNS access).

// fromDisplayName + bareEmailAddress (the pure From-header helpers) now live in
// ./params -- imported and re-exported at the top of this file (moved so
// adminEmail.ts can reuse them without a circular import).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:2810-2814`
