# 0179. Prefix for the synthetic ready-state entry identity this module mints

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/importedRenderReconciler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Prefix for the synthetic ready-state entry identity this module mints — `rendered-page-N`, never `deck.slides[N-1].id` (Pitfall 1).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/importedRenderReconciler.ts:49-51`:**

```

/** Prefix for the synthetic ready-state entry identity this module mints —
 * `rendered-page-N`, never `deck.slides[N-1].id` (Pitfall 1). */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/importedRenderReconciler.ts:49-51`
