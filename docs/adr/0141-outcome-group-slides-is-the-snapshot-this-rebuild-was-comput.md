# 0141. Outcome.group.slides is the snapshot this rebuild was computed FROM

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useSlideshowAssembly.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-02: `outcome.group.slides` is the snapshot this rebuild was computed FROM — passed through as `baseSlides` so a concurrent SlideGrid.vue write (add-slide/import/video-append/reorder) that lands between this computatio...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-02`):

**`src/composables/useSlideshowAssembly.ts:784-792`:**

```

      // CR-02: `outcome.group.slides` is the snapshot this rebuild was
      // computed FROM — passed through as `baseSlides` so a concurrent
      // SlideGrid.vue write (add-slide/import/video-append/reorder) that
      // lands between this computation and this write is detected and merged
      // rather than silently overwritten. See `replaceGroupSlides`'s doc
      // comment in `src/stores/slideGroups.ts`. This matters MORE now than
      // pre-Phase-30, since every rebuild outcome writes unconditionally —
      // there is no confirm step left to catch a lost concurrent edit.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useSlideshowAssembly.ts:784-792`
