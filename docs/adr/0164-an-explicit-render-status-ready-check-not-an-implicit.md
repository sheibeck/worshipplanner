# 0164. An EXPLICIT render.status === 'ready' check, not an implicit

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/importedRenderReconciler.ts`. Documented at the time in `42-REVIEW.md`.

WR-04 (42-REVIEW.md): an EXPLICIT `render.status === 'ready'` check, not an implicit fall-through by elimination.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/utils/importedRenderReconciler.ts:114-123`:**

```

  // WR-04 (42-REVIEW.md): an EXPLICIT `render.status === 'ready'` check, not
  // an implicit fall-through by elimination. `PptxRenderDoc` is cast from
  // `snap.data()` with no runtime validation (`pptxRenders.ts`), so a future
  // status value the client hasn't deployed for yet (`functions/src/index.ts`
  // can add one without a client deploy — the sibling `failureReason` slug
  // space already works this way) or a malformed document must degrade
  // safely to `failed`, never be silently treated as `ready` merely because
  // it fell through the `pending`/`failed` checks above and happened to
  // carry a truthy `renderedCount`.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/importedRenderReconciler.ts:114-123`
