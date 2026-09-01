# 0218. Org-level AI features toggle (WR-01, 39-REVIEW). Required (not

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/serviceEditorActionBar.ts`. Documented at the time in `39-REVIEW`.

Org-level AI features toggle (WR-01, 39-REVIEW). Required (not optional) so the compiler forces every call site to supply it — an `undefined` here would silently show "Suggest All Songs" with AI off, the one AI entry poi...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/serviceEditorActionBar.ts:72-78`:**

```
  /**
   * Org-level AI features toggle (WR-01, 39-REVIEW). Required (not
   * optional) so the compiler forces every call site to supply it — an
   * `undefined` here would silently show "Suggest All Songs" with AI off,
   * the one AI entry point that was missed by 39-05's hide-don't-disable
   * pass. Follows the same threading pattern as `pcEnabled` below.
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/serviceEditorActionBar.ts:72-78`
