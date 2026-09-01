# 0011. Decision.action is "skip" (reason "not-primary-org" or

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/backfillOrgClaims.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

decision.action is "skip" (reason "not-primary-org" or "already-current") or "clear" (not reachable from this call site: decideMembershipClaim only ever returns 'clear' when documentExists is false (WR-01), and decidePri...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/backfillOrgClaims.ts:211-219`:**

```

      // decision.action is "skip" (reason "not-primary-org" or "already-current")
      // or "clear" (not reachable from this call site: decideMembershipClaim only
      // ever returns 'clear' when documentExists is false (WR-01), and
      // decidePrimaryClaim always passes documentExists: true). Either way the
      // primary keys are unaffected, but `orgs` still needs its own
      // skip-if-matching check -- this is what lets a non-primary-org membership
      // (or a primary membership whose claim is already current) still pick up a
      // changed orgs map.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/backfillOrgClaims.ts:211-219`
