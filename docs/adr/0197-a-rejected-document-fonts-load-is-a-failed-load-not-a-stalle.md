# 0197. A rejected document.fonts.load() is a FAILED load, not a stalled one

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideTypography.ts`. Documented at the time in `46-REVIEW.md`.

WR-02 (46-REVIEW.md): a rejected document.fonts.load() is a FAILED load, not a stalled one — resolve `false` (same as a timeout) instead of letting the rejection propagate through Promise.race below, which would break th...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/utils/slideTypography.ts:123-127`:**

```
    // WR-02 (46-REVIEW.md): a rejected document.fonts.load() is a FAILED
    // load, not a stalled one — resolve `false` (same as a timeout)
    // instead of letting the rejection propagate through Promise.race
    // below, which would break this function's documented "never hangs
    // the caller" contract for the reject case.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideTypography.ts:123-127`
