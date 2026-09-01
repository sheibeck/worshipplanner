# 0135. R213 (Phase 76) — the SAME full org-context reset the pre-existing

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. Documented at the time in `78-REVIEW.md`.

R213 (Phase 76) — the SAME full org-context reset the pre-existing `activeId === null` branch performs, factored out so the two new deactivation-detection branches below share it exactly rather than drifting from that br...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/stores/auth.ts:360-374`:**

```

  // R213 (Phase 76) — the SAME full org-context reset the pre-existing
  // `activeId === null` branch performs, factored out so the two new
  // deactivation-detection branches below share it exactly rather than
  // drifting from that branch's field list over time.
  //
  // WR-01 (78-REVIEW.md): `deactivatedOrgMessage` is cleared HERE, not just
  // by loadOrgContext's own unconditional clear at its top. Before this,
  // `enterOrgAsSuperAdmin`/`exitSuperAdminView` were the first callers of
  // resetOrgContext() that bypass loadOrgContext entirely, so a stale
  // non-null deactivatedOrgMessage from an earlier deactivated-org bounce
  // survived a super-admin's enter/exit and kept `hasDeactivatedOrg` (and
  // therefore `requiresOrgSelection`) true — stranding them at
  // /select-church on the very next navigation, the same router-strand
  // class `hasNoOrg`'s viewingAsSuperAdmin guard was written to close.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:360-374`
