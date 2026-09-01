# 0202. A blackout slide never carries a background, matching

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideshowAssembler.ts`. Documented at the time in `105-UI-SPEC.md`.

CR-01 (105 code review): a blackout slide never carries a background, matching src/types/slide.ts's BlackoutSlide doc comment and 105-UI-SPEC.md's R303 content contract.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/utils/slideshowAssembler.ts:456-460`:**

```
      // CR-01 (105 code review): a blackout slide never carries a background,
      // matching src/types/slide.ts's BlackoutSlide doc comment and 105-UI-SPEC.md's
      // R303 content contract. `resolveEntryMedia` only special-cases 'video' for
      // suppression — it has no view of `content.contentKind` — so blackout must be
      // suppressed here, the one place both are in scope.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideshowAssembler.ts:456-460`
