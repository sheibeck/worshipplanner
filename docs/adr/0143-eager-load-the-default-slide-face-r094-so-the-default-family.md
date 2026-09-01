# 0143. Eager-load the DEFAULT slide face (R094) so the default family+weight

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/main.ts`. Documented at the time in `46-RESEARCH.md`.

Eager-load the DEFAULT slide face (R094) so the default family+weight is resident before the very first paint.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/main.ts:2-7`:**

```
// Eager-load the DEFAULT slide face (R094) so the default family+weight is
// resident before the very first paint. This is a static import evaluated
// at module load, before app.mount() — the eager path Pitfall 4
// (46-RESEARCH.md) warns against skipping. Non-default org faces are loaded
// on demand by the presenter gate (46-04) and the Settings preview (46-03)
// via src/utils/slideTypography.ts::loadFontCss.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/main.ts:2-7`
