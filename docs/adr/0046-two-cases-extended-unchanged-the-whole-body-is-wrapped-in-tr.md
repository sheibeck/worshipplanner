# 0046. Two cases, extended unchanged. The whole body is wrapped in try/catch

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgMembershipClaims.ts`. Documented at the time in `76-REVIEW.md`.

two cases, extended unchanged. The whole body is wrapped in try/catch and resolves with a failure outcome rather than rethrowing -- a throw out of a Firestore trigger causes Cloud Functions retries that would hammer the...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, WR-03`):

**`functions/src/orgMembershipClaims.ts:375-396`:**

```
 * two cases, extended unchanged.
 *
 * The whole body is wrapped in try/catch and resolves with a failure
 * outcome rather than rethrowing -- a throw out of a Firestore trigger
 * causes Cloud Functions retries that would hammer the Auth API (T-40-08).
 *
 * CR-01 fix (76-REVIEW.md): ALSO recomputes the `deactivatedOrgs` claim on
 * every write that reaches computeOrgsClaimForUid (i.e. every write except
 * the two fully-conservative skips below), from the SAME surviving-orgs list
 * `orgs` is built from. This is the self-heal that closes the gap in
 * `setOrgActive`'s one-time member fan-out (orgProvisioning.ts): a member who
 * joins an ALREADY-deactivated org (pending-invite acceptance, or
 * assignOrgAdminHandler) fires THIS trigger, which now independently reads
 * that org's live `active` field and sets `deactivatedOrgs[orgId]`
 * accordingly -- no dependency on `setOrgActive` running again after they
 * join. It is also the WR-03 fix: a member removed then re-added mid-
 * deactivation recomputes fresh on rejoin rather than keeping a stale
 * fan-out-time value. `computeDeactivatedOrgsClaimForUid` reads ONLY the
 * orgs the recomputed `orgs` map actually lists (never a stale prior claim),
 * so a genuinely-active org always yields NO entry -- deactivatedOrgs never
 * grows a phantom key for a normal/reactivated membership.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgMembershipClaims.ts:375-396`
