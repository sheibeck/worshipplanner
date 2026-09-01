# 0039. Operation in this codebase. It is gated by the SAME

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgDeletion.ts`. Documented at the time in `77-RESEARCH.md`.

operation in this codebase. It is gated by the SAME assertSuperAdminCaller dual re-verification every other owner-console callable uses (T-77-01), plus two independent server-side re-checks the client cannot bypass: - th...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/orgDeletion.ts:14-29`:**

```
// operation in this codebase. It is gated by the SAME assertSuperAdminCaller
// dual re-verification every other owner-console callable uses (T-77-01),
// plus two independent server-side re-checks the client cannot bypass:
//   - the org must already be deactivated (active === false) -- T-77-06
//   - confirmName must match the org's SERVER-STORED name, exactly -- T-77-02
//
// Cascade order (77-RESEARCH.md Cascade Order / Pattern 2 / Pitfall 1):
// every cross-reference this handler needs (member uids, inviteLookup docs,
// the orgNames guard read, and the 5 extra orgId-keyed collections) is READ
// and held in memory BEFORE any delete fires -- recursiveDelete/deleteFiles
// remove the very data those reads depend on, so reversing this order would
// silently orphan every affected user's `orgIds` claim (T-77-03/T-77-08).
//
// Deliberately OUT OF SCOPE (documented, not an oversight): `aiUsage` and
// `aiRateLimits` are a platform cost-observability ledger, not tenant
// content -- 77-RESEARCH.md Open Question 2 recommends leaving them alone.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgDeletion.ts:14-29`
