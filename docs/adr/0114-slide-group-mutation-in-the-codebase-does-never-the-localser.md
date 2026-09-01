# 0114. Slide-group mutation in the codebase does (never the localService

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/SlideGrid.vue`. Documented at the time in `25-RESEARCH.md`.

slide-group mutation in the codebase does (never the `localService` deep-watch autosave).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/slides/SlideGrid.vue:357-371`:**

```
 * slide-group mutation in the codebase does (never the `localService`
 * deep-watch autosave).
 *
 * Filters `assembledSlideshow` by the selected plan item's ARRAY index
 * (`slotArrayIndex`), never by `groupId` — `groupId` is only set on the
 * group-resolved emission path and is absent for the entire window before a
 * group's Firestore snapshot lands (25-RESEARCH.md Pitfall 2), even though
 * the fallback-path slides being shown are already real and correct.
 *
 * Ships no Grid/List toggle (D-09). The reconciliation confirm/review surface
 * (26-06) was removed entirely in Phase 30 (R048) — every group write is now
 * unconditional; only `replaceGroupSlides` (the concurrent-write transaction
 * merge) remains.
 *
 * 25-07 adds the drop tile (always the grid's last item, D-13), a whole-grid
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideGrid.vue:357-371`
