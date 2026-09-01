# 0037. Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/inviteOnboarding.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2 -- generatePasswordResetLink requires the user to already exist).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/inviteOnboarding.ts:257-259`:**

```

  // Non-Google branch: resolve-or-create the Auth user FIRST (Pitfall 2 --
  // generatePasswordResetLink requires the user to already exist).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/inviteOnboarding.ts:257-259`
