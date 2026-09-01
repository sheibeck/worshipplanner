# 0139. Only the CURRENT count's entry is ever read again

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useSlideshowAssembly.ts`. Documented at the time in `42-REVIEW.md`.

WR-01 (42-REVIEW.md): only the CURRENT count's entry is ever read again (`renderedImageUrlsByImportId` above looks up exactly one key per id), so every other `(id, count)` pair for this SAME id is now unreachable — evict...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/composables/useSlideshowAssembly.ts:339-343`:**

```
          // WR-01 (42-REVIEW.md): only the CURRENT count's entry is ever read again
          // (`renderedImageUrlsByImportId` above looks up exactly one key per id), so
          // every other `(id, count)` pair for this SAME id is now unreachable — evict
          // it rather than let it stay resident forever across re-renders/retries
          // within one composable instance's lifetime.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useSlideshowAssembly.ts:339-343`
