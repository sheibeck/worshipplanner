# 0086. ClaimFailures is the resilience signal 76-RESEARCH.md's Pitfall 4

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/OrganizationsTab.vue`. Documented at the time in `76-RESEARCH.md, 76-REVIEW.md`.

WR-01 (76-REVIEW.md): claimFailures is the resilience signal 76-RESEARCH.md's Pitfall 4 designs around ("calling setOrgActive again is a safe, idempotent retry") -- previously dropped on the floor, so an operator had no...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-01`):

**`src/components/admin/OrganizationsTab.vue:606-610`:**

```
    // WR-01 (76-REVIEW.md): claimFailures is the resilience signal
    // 76-RESEARCH.md's Pitfall 4 designs around ("calling setOrgActive again
    // is a safe, idempotent retry") -- previously dropped on the floor, so an
    // operator had no way to know Storage enforcement never reached anyone.
    // Surface it as a non-blocking warning instead of an unqualified success.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/OrganizationsTab.vue:606-610`
