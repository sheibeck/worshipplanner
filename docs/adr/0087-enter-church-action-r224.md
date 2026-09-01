# 0087. ── Enter-church action (R224)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/OrganizationsTab.vue`. Documented at the time in `78-REVIEW.md`.

── Enter-church action (R224) ──────────────────────────────────────────── Pure authStore consumer -- no direct Firestore reads/writes here; all authorization lives in enterOrgAsSuperAdmin (auth.ts) + firestore.rules' su...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/admin/OrganizationsTab.vue:779-789`:**

```
// ── Enter-church action (R224) ────────────────────────────────────────────
// Pure authStore consumer -- no direct Firestore reads/writes here; all
// authorization lives in enterOrgAsSuperAdmin (auth.ts) + firestore.rules'
// super-admin arm (78-01-PLAN.md). Not gated on org.active -- entering a
// deactivated org is an explicit, intended support scenario.

// WR-02 (78-REVIEW.md): mirrors this file's other row-action in-flight
// guards (isOnboarding/isAssigning/togglingOrgId/isDeleting) -- previously
// this button had no double-submit guard at all, so a rapid double-click
// (or two different rows in quick succession) could fire two overlapping
// enterOrgAsSuperAdmin calls that interleave.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/OrganizationsTab.vue:779-789`
