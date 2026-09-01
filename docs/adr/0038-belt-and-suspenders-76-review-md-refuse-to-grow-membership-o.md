# 0038. Belt-and-suspenders (76-REVIEW.md): refuse to grow membership on a

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 2 files: `functions/src/orgMembershipClaims.ts`, `functions/src/orgProvisioning.ts`. Documented at the time in `76-REVIEW.md`.

CR-01 belt-and-suspenders (76-REVIEW.md): refuse to grow membership on a deactivated org at all.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`functions/src/orgMembershipClaims.ts:150-160`:**

```

/**
 * CR-01 fix (76-REVIEW.md): recomputes the FULL `deactivatedOrgs` claim map
 * for a set of surviving org memberships, reading each org's live `active`
 * field. This is the self-heal that closes the gap `setOrgActive`'s one-time
 * member fan-out (orgProvisioning.ts) cannot: a member who joins an
 * ALREADY-deactivated org AFTER that fan-out ran (via pending-invite
 * acceptance or assignOrgAdminHandler) never had `deactivatedOrgs[orgId]`
 * set for them. Calling this on EVERY `syncOrgMembershipClaim` write (any
 * members/{uid} create/update/delete) means the very write that adds the new
 * member also computes their deactivatedOrgs entry from the org's CURRENT
```

**`functions/src/orgMembershipClaims.ts:342-348`:**

```

/**
 * The `deactivatedOrgs`-map counterpart to orgsMapsEqual, same undefined-as-{}
 * treatment (CR-01, 76-REVIEW.md): a legacy token with no `deactivatedOrgs`
 * key at all compares equal to a freshly-computed empty map, so a member of
 * zero deactivated orgs never triggers a spurious claim write.
 */
```

**`functions/src/orgProvisioning.ts:375-384`:**

```

  // CR-01 belt-and-suspenders (76-REVIEW.md): refuse to grow membership on a
  // deactivated org at all. The PRIMARY fix (orgMembershipClaims.ts's
  // syncOrgMembershipClaim trigger self-heal) already ensures that IF this
  // write goes through, the new member's deactivatedOrgs claim is set
  // correctly -- but rejecting the assignment outright here is both simpler
  // to reason about for the super-admin (the org row's Deactivate/Reactivate
  // control is right there) and avoids creating a membership doc for an org
  // its own admin cannot use. Same default-true posture as isOrgActive()/
  // setOrgActiveHandler -- only an EXPLICIT active:false refuses.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgMembershipClaims.ts:150-160`
- `functions/src/orgMembershipClaims.ts:342-348`
- `functions/src/orgProvisioning.ts:375-384`
