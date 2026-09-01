# 0050. Push() only arms its auto-dismiss timer when opts is omitted entirely

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/AppSidebar.vue`. Documented at the time in `104-REVIEW`.

104-REVIEW WR-02: `push()` only arms its auto-dismiss timer when `opts` is omitted entirely OR `opts.autoDismissMs` is set — passing `{ variant: 'error' }` alone falls into neither branch and stays sticky forever.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/AppSidebar.vue:286-289`:**

```
    // 104-REVIEW WR-02: `push()` only arms its auto-dismiss timer when `opts`
    // is omitted entirely OR `opts.autoDismissMs` is set — passing
    // `{ variant: 'error' }` alone falls into neither branch and stays sticky
    // forever. 'error' is already push()'s default variant, so omit opts.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/AppSidebar.vue:286-289`
