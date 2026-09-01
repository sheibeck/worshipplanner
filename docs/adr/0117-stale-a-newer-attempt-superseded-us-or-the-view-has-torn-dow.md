# 0117. Stale (a newer attempt superseded us) or the view has torn down — do

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useRunControl.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Stale (a newer attempt superseded us) or the view has torn down — do NOT open windows that would be orphaned (Pitfall 6 / WR-01).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-01`):

**`src/composables/useRunControl.ts:809-810`:**

```
        // Stale (a newer attempt superseded us) or the view has torn down — do
        // NOT open windows that would be orphaned (Pitfall 6 / WR-01).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:809-810`
