# 0090. The element that had focus immediately before the dialog opened

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/CleanupEnableConfirmDialog.vue`. Documented at the time in `71-UI-SPEC.md`.

The element that had focus immediately before the dialog opened (almost always the row's Enable button that triggered it) -- captured on open, restored on close per 71-UI-SPEC.md Accessibility: "on close, focus returns t...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/admin/CleanupEnableConfirmDialog.vue:166-170`:**

```

// The element that had focus immediately before the dialog opened (almost
// always the row's Enable button that triggered it) -- captured on open,
// restored on close per 71-UI-SPEC.md Accessibility: "on close, focus
// returns to the row's Enable button that opened the dialog" (review WR-01).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/CleanupEnableConfirmDialog.vue:166-170`
