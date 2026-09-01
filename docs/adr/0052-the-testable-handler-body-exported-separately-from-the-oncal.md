# 0052. The testable handler body, exported separately from the onCall

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `functions/src/orgProvisioning.ts`. Documented at the time in `76-RESEARCH.md, 76-REVIEW.md`.

The testable handler body, exported separately from the onCall wrapper below -- mirrors onboardOrganizationHandler/assignOrgAdminHandler's structure (caller gate, then input validation, then the org read, then the writes...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-02`):

**`functions/src/orgProvisioning.ts:509-524`:**

```
  /** Count of members whose `deactivatedOrgs[orgId]` claim PATCH rejected
   * (76-RESEARCH.md Pitfall 4) -- the org-doc write (the authoritative,
   * firestore.rules-enforced source of truth) always succeeds independently
   * of this. A nonzero count means Storage enforcement did NOT reach that
   * member; retrying `setOrgActive` is a safe, idempotent way to finish the
   * job (patchNestedClaimKey is itself idempotent per-key).
   *
   * WR-02 (76-REVIEW.md): this NEVER counts a `revokeRefreshTokens` failure
   * -- that outcome is tracked separately in `revokeFailures` below, since
   * the two are not equivalent: a claim-patch failure means the Storage-side
   * deny never took effect (needs a retry), while a revoke failure only
   * means the bounded-exposure token-revocation step didn't fire (the deny
   * IS in place; cosmetic, self-heals within the token's remaining
   * lifetime). Conflating them (as the pre-fix single `claimFailures` count
   * did) made a retry decision impossible to make correctly.
   */
```

**`functions/src/orgProvisioning.ts:532-557`:**

```
/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- mirrors onboardOrganizationHandler/assignOrgAdminHandler's
 * structure (caller gate, then input validation, then the org read, then the
 * writes).
 *
 * Write sequencing (76-RESEARCH.md Pitfall 4 / Code Examples):
 *   1. org-existence check (`not-found` if missing).
 *   2. the same-state-aware `organizations/{orgId}` merge write -- this is
 *      the AUTHORITATIVE write: firestore.rules' isOrgActive() reads it
 *      LIVE, so Firestore-side enforcement is already complete once this
 *      commits, regardless of the claim fan-out's outcome below.
 *   3. the SCOPED `organizations/{orgId}/members` query -- never
 *      `collectionGroup('members')` (T-40-05-class scope guard).
 *   4. a `Promise.allSettled` fan-out patching each member's
 *      `deactivatedOrgs[orgId]` claim key (Task 1 `patchNestedClaimKey`) --
 *      PLUS `revokeRefreshTokens` on the deactivate branch only (bounded
 *      exposure, not an instant cutoff -- 76-RESEARCH.md Pitfall 2). WR-02
 *      (76-REVIEW.md): the two steps are tracked as INDEPENDENT outcomes
 *      per member (`claimFailed`/`revokeFailed`) rather than one shared
 *      try/catch, so a revoke failure is never miscounted as a claim
 *      failure or vice versa. A claim-patch failure skips the revoke
 *      attempt entirely for that member (same as the original sequential
 *      await order: revoke was never reached past a thrown patch).
 *
 * Same-state short-circuit: when the org's CURRENT active status (default
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgProvisioning.ts:509-524`
- `functions/src/orgProvisioning.ts:532-557`
