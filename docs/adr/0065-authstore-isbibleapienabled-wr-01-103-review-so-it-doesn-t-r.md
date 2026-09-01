# 0065. AuthStore.isBibleApiEnabled (WR-01, 103-REVIEW) so it doesn't render

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/ScriptureInput.vue`. Documented at the time in `103-REVIEW`.

authStore.isBibleApiEnabled (WR-01, 103-REVIEW) so it doesn't render

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/ScriptureInput.vue:136-136`:**

```
         authStore.isBibleApiEnabled (WR-01, 103-REVIEW) so it doesn't render
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/ScriptureInput.vue:136-136`
