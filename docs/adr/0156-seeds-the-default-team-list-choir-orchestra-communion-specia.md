# 0156. Seeds the default team list (Choir/Orchestra/Communion/Special) only

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/teams.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Seeds the default team list (Choir/Orchestra/Communion/Special) only when the org has no teams yet.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/stores/teams.ts:51-55`:**

```

  // Seeds the default team list (Choir/Orchestra/Communion/Special) only when
  // the org has no teams yet. Calling this again once teams exist writes
  // nothing — first-writer-wins, never clobbers an org that already edited
  // its list (RESEARCH Pitfall 4).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/teams.ts:51-55`
