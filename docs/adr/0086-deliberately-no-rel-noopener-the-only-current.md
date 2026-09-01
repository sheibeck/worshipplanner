# 0086. Deliberately NO rel="noopener". The only current

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/ToastHost.vue`. Documented at the time in `104-REVIEW`.

104-REVIEW WR-01: deliberately NO rel="noopener". The only current

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/ToastHost.vue:45-45`:**

```
          <!-- 104-REVIEW WR-01: deliberately NO rel="noopener". The only current
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/ToastHost.vue:45-45`
