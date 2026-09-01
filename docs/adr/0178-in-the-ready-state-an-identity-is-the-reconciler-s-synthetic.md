# 0178. In the ready state an identity is the reconciler's synthetic

## Status

Accepted

## Context

This rationale is applied consistently at 2 call site(s) across 2 files: `src/utils/importedRenderReconciler.ts`, `src/utils/slideGroupMaterializer.ts`. Documented at the time in `42-RESEARCH.md`.

In the ready state an identity is the reconciler's synthetic `rendered-page-N` string, page-scoped rather than a parsed inner slide id — never `deck.slides[i].id` (no positional pairing exists, 42-RESEARCH.md Pitfall 1)....

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/importedRenderReconciler.ts:14-38`:**

```
 * async `getDownloadURL()` work happens upstream in the composable layer
 * (`useSlideshowAssembly.ts`), never here.
 *
 * Three load-bearing facts a future editor must not lose:
 *
 * 1. **No positional pairing exists between `deck.slides[i]` and rendered
 *    page `i+1`** (42-RESEARCH.md Pitfall 1). `functions/src/index.ts`'s own
 *    "★ Trap 1" comment (lines ~294-303) is unambiguous: `mapAstToSlides`
 *    (pptxParser.ts) SKIPS slides with neither substantial text nor images,
 *    and emits ONE ENTRY PER IMAGE on a multi-image slide — the parsed
 *    array's length is structurally decoupled from the deck's real page
 *    count in BOTH directions. `deck.slides` is a COUNT source for the
 *    non-ready modes (parsed/pending/failed) and a CONTENT source only in
 *    `parsed` mode. Anything that indexes `deck.slides` by a rendered page
 *    number is a defect.
 * 2. **Gate on `render.status`, never on `render.renderedCount` truthiness**
 *    (42-RESEARCH.md Pitfall 3). `functions/src/index.ts:396-415`'s own
 *    three-conjunct ready gate (`actualCount > 0 && actualCount ===
 *    reportedCount && contiguous`) means `status` already encodes every
 *    failure mode. A `failed` document CAN carry a non-zero `renderedCount`
 *    (the `incomplete-render` outcome still writes the partial `actualCount`,
 *    `functions/src/index.ts:411-415`); a `pending` document legitimately
 *    carries none.
 * 3. **`renderedCount` wins in every ready case** (D-05), with ONE named
 *    carve-out: `status: 'ready'` with `renderedCount` absent or `< 1` is
```

**`src/utils/slideGroupMaterializer.ts:142-149`:**

```

      // In the ready state an identity is the reconciler's synthetic
      // `rendered-page-N` string, page-scoped rather than a parsed inner
      // slide id — never `deck.slides[i].id` (no positional pairing exists,
      // 42-RESEARCH.md Pitfall 1). In every other mode it IS a parsed inner
      // slide id, unchanged from before this phase. A deck with no
      // `renderImportId` resolves to `parsed` mode here, which is
      // byte-identical to the pre-Phase-42 behaviour (D-16).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/importedRenderReconciler.ts:14-38`
- `src/utils/slideGroupMaterializer.ts:142-149`
