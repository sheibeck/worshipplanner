# 0242. R101 (48-03): Print, relocated verbatim from the page-bottom button

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/serviceEditorActionBar.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

R101 (48-03): Print, relocated verbatim from the page-bottom button (ServiceEditorView.vue:1303-1314) — unconditional, same as the button it replaces (no editor gate on Print today).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/serviceEditorActionBar.ts:187-194`:**

```

/**
 * R101 (48-03): Print, relocated verbatim from the page-bottom button
 * (ServiceEditorView.vue:1303-1314) — unconditional, same as the button it
 * replaces (no editor gate on Print today). testId is preserved so the
 * `print-btn` selector keeps working once the bottom button is deleted
 * (Pitfall 3 / Anti-Patterns: exactly one print-btn must exist).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/serviceEditorActionBar.ts:187-194`
