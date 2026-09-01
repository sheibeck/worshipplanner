# 0044. Resolves an admin-assignment target by email -- the ONLY network/Auth

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgProvisioning.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Resolves an admin-assignment target by email -- the ONLY network/Auth step in either onboarding or admin-assignment, deliberately run BEFORE any Firestore write (R202): a rethrown transient Auth error here creates NOTHIN...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/orgProvisioning.ts:117-127`:**

```
 * Resolves an admin-assignment target by email -- the ONLY network/Auth step
 * in either onboarding or admin-assignment, deliberately run BEFORE any
 * Firestore write (R202): a rethrown transient Auth error here creates
 * NOTHING, so a same-input retry after the transient failure clears is
 * naturally clean.
 *
 * Discriminates `err.code === 'auth/user-not-found'` specifically (Pitfall 5)
 * -- ONLY that code takes the invite branch; any other code (network outage,
 * malformed email, etc.) is RETHROWN so a real Auth failure surfaces instead
 * of silently masquerading as a successful "invited" outcome.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgProvisioning.ts:117-127`
