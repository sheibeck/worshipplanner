# 0138. --- Phase 42 (R079/R080): resolve and cache rendered-page download

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useSlideshowAssembly.ts`. Documented at the time in `42-RESEARCH.md`.

--- Phase 42 (R079/R080): resolve and cache rendered-page download URLs --- Keyed `${renderImportId}:${renderedCount}` — the count is load-bearing TWICE (42-RESEARCH.md Pitfall 4 / T-42-07): it invalidates the cache the...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/composables/useSlideshowAssembly.ts:289-296`:**

```

  // --- Phase 42 (R079/R080): resolve and cache rendered-page download URLs ---
  //
  // Keyed `${renderImportId}:${renderedCount}` — the count is load-bearing TWICE
  // (42-RESEARCH.md Pitfall 4 / T-42-07): it invalidates the cache the instant a
  // re-render changes the page count, AND it makes serving a previous render's
  // URL array structurally impossible, since a differently-counted re-render can
  // never collide with the old key.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useSlideshowAssembly.ts:289-296`
