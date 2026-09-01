# 0041. Recomputed from the SAME surviving-org list orgs was just built from

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `functions/src/orgMembershipClaims.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-01: recomputed from the SAME surviving-org list `orgs` was just built from -- every org this uid currently has a resolved role in.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`functions/src/orgMembershipClaims.ts:419-420`:**

```
    // CR-01: recomputed from the SAME surviving-org list `orgs` was just
    // built from -- every org this uid currently has a resolved role in.
```

**`functions/src/orgMembershipClaims.ts:425-432`:**

```
        // R175: ONE merge call carries the primary keys AND the recomputed
        // orgs map, preserving superAdmin (or any other unrelated claim).
        // Spread decision.claims into a fresh object literal: OrgMembershipClaim
        // has no index signature, so passing it directly fails TS2345
        // against Record<string, unknown>. CR-01: deactivatedOrgs rides along
        // in this SAME write -- the write that creates/updates this member's
        // primary claim is exactly the moment their deactivated-org status
        // (if any) must also be established.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgMembershipClaims.ts:419-420`
- `functions/src/orgMembershipClaims.ts:425-432`
