# 0016. Two call sites this module was extracted to fix. No try/catch here

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/claimsHelpers.ts`. Documented at the time in `68-REVIEW.md`.

two call sites this module was extracted to fix. No try/catch here -- these helpers throw through.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/claimsHelpers.ts:17-31`:**

```
// two call sites this module was extracted to fix.
//
// No try/catch here -- these helpers throw through. Callers (the trigger
// handlers) wrap the call and convert a failure into a { action: "failed" }
// outcome rather than rethrowing out of a Firestore trigger.
//
// KNOWN LIMITATION -- residual concurrent-write race (WR-02, 68-REVIEW.md):
// both helpers are read-then-write (getUser -> setCustomUserClaims) with no
// compare-and-swap or transaction. This phase's fix closes the *sequential*
// replace-clobbers-unrelated-key hazard described above, but it does NOT
// close a *concurrent* race: if syncOrgMembershipClaim and syncSuperAdminClaim
// both fire for the SAME uid within the same short window (e.g. an owner
// grants super-admin to a user at nearly the same moment that user's org role
// changes), both handlers read claims independently and whichever
// setCustomUserClaims call lands second overwrites the first with a claims
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/claimsHelpers.ts:17-31`
