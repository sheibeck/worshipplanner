# 0123. PptxRendersStore is a Pinia singleton, but this composable's

## Status

Accepted

## Context

This rationale is applied at 1 call site within `src/composables/useSlideshowAssembly.ts`. Documented at the time in `42-REVIEW.md`.

WR-02 (42-REVIEW.md): `pptxRendersStore` is a Pinia singleton, but this composable's `cleanup()` calls its `unsubscribeAll()`, which tears down EVERY outstanding listener in the store, not just the ones this particular instance opened.

## Decision

The rationale below is preserved verbatim from the source comment it was extracted from (tag: `WR-02`):

**`src/composables/useSlideshowAssembly.ts:82-90`:**

```

// WR-02 (42-REVIEW.md): `pptxRendersStore` is a Pinia singleton, but this composable's
// `cleanup()` calls its `unsubscribeAll()`, which tears down EVERY outstanding listener
// in the store, not just the ones this particular instance opened. That is safe only
// under the "single call site" assumption documented on `pptxRenders.ts` and below — an
// assumption nothing in the store enforces. This module-level counter is a dev-mode
// tripwire for exactly that assumption: it does not change teardown behavior (still a
// full `unsubscribeAll()`, since scoping it per-instance is a real design change no plan
// here authorizes), it only makes a violation loud instead of silent.
```

**Note:** `src/composables/useSlideshowAssembly.ts:870` also names `WR-02, 42-REVIEW.md`, but
that occurrence is inside a `console.warn()` string literal (the dev-mode tripwire message
itself), not a comment — it is executable code, out of scope for the comment-only shrink in
Task 2, and is intentionally left unedited.

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useSlideshowAssembly.ts:82-90`
