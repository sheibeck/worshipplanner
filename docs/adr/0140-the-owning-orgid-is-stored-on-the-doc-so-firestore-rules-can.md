# 0140. The owning orgId is stored on the doc so firestore.rules can scope

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/quarters.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-01: the owning orgId is stored on the doc so firestore.rules can scope create/update to editors of the org that actually owns this share (the shareId itself is a guessable, deterministic string, so this field is what...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/stores/quarters.ts:437-440`:**

```
        // CR-01: the owning orgId is stored on the doc so firestore.rules can scope
        // create/update to editors of the org that actually owns this share (the shareId
        // itself is a guessable, deterministic string, so this field is what closes the
        // cross-tenant write gap).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/quarters.ts:437-440`
