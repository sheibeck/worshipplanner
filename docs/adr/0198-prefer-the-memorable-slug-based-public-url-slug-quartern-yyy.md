# 0198. Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/QuarterView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY) that finalizeAndShare also writes (R-02/D-18). Fall back to the opaque token URL only when the org has no configured slug yet.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `R-02`):

**`src/views/QuarterView.vue:784-787`:**

```

// Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY) that
// finalizeAndShare also writes (R-02/D-18). Fall back to the opaque token URL
// only when the org has no configured slug yet.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/QuarterView.vue:784-787`
