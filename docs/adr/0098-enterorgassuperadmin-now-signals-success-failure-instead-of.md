# 0098. EnterOrgAsSuperAdmin now signals success/failure instead of silently

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 2 files: `src/components/admin/OrganizationsTab.vue`, `src/stores/auth.ts`. Documented at the time in `78-REVIEW.md`.

WR-03 (78-REVIEW.md): enterOrgAsSuperAdmin now signals success/failure instead of silently no-oping (not a super-admin, denied/errored read, or a stale/missing org doc).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/admin/OrganizationsTab.vue:791-792`:**

```
// WR-03 (78-REVIEW.md), keyed per orgId to match this file's other
// per-row error state (assignError/toggleError).
```

**`src/components/admin/OrganizationsTab.vue:802-806`:**

```
    // WR-03 (78-REVIEW.md): enterOrgAsSuperAdmin now signals success/failure
    // instead of silently no-oping (not a super-admin, denied/errored read,
    // or a stale/missing org doc). Only navigate on a genuine entry --
    // otherwise the super-admin was previously bounced to /select-church by
    // the router's org-selection gate with zero explanation.
```

**`src/stores/auth.ts:710-720`:**

```
  // to find — if started, its first callback would immediately null userRole
  // back out). Deliberately performs NO isOrgActive/deactivation check,
  // unlike loadOrgContext — the rules layer already grants a super-admin
  // unconditional access to a deactivated org's doc, and entering one for
  // support is intended, not a bug to guard against.
  //
  // WR-03 (78-REVIEW.md): returns a boolean so the caller (OrganizationsTab's
  // onEnterChurch) can tell a genuine entry apart from a silent no-op (not a
  // super-admin / no user, a denied or errored read, or a missing/stale org
  // doc) instead of navigating unconditionally and stranding the super-admin
  // at the router's org-selection gate with zero explanation.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/OrganizationsTab.vue:791-792`
- `src/components/admin/OrganizationsTab.vue:802-806`
- `src/stores/auth.ts:710-720`
