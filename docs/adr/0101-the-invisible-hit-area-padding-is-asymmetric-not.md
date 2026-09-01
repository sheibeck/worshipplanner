# 0101. The invisible hit-area padding is asymmetric, not

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/SlideCard.vue`. Documented at the time in `48-REVIEW`.

WR-03 (48-REVIEW): the invisible hit-area padding is asymmetric, not

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/slides/SlideCard.vue:104-105`:**

```
      <!--
        WR-03 (48-REVIEW): the invisible hit-area padding is asymmetric, not
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideCard.vue:104-105`
