# 0048. A genuine primary-membership delete. Clearing the primary keys and

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgMembershipClaims.ts`. Documented at the time in `73-RESEARCH.md, 73-REVIEW.md`.

A genuine primary-membership delete. Clearing the primary keys and recomputing `orgs` are INDEPENDENT effects (73-RESEARCH.md Pitfall 2) -- NEVER blanket-clear orgs here; a still-valid second-org membership must survive....

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, Pitfall, WR-01`):

**`functions/src/orgMembershipClaims.ts:440-456`:**

```
        // A genuine primary-membership delete. Clearing the primary keys and
        // recomputing `orgs` are INDEPENDENT effects (73-RESEARCH.md Pitfall
        // 2) -- NEVER blanket-clear orgs here; a still-valid second-org
        // membership must survive. WR-01 (73-REVIEW.md): this used to be TWO
        // sequential Admin SDK writes (clearClaimKeys then
        // mergeAndSetCustomClaims), which opened a brief TOCTOU window --
        // a token minted between the two writes could carry no orgId/role
        // but a STALE orgs map still listing the org just removed, retaining
        // Storage access via storage.rules' orgs[orgId] arm. Collapsed into
        // ONE atomic setCustomUserClaims call via mergeSetAndClearCustomClaims
        // (claimsHelpers.ts), which reads current claims once and applies the
        // clear+set in memory before the single write -- preserving
        // everything it doesn't explicitly touch (e.g. superAdmin).
        // CR-01: deactivatedOrgs is recomputed from the survivors here too,
        // so a primary-org delete that leaves the user still a member of a
        // deactivated second org keeps that entry, and drops the deleted
        // org's entry (if any) since it's no longer in desiredOrgs' keys.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgMembershipClaims.ts:440-456`
