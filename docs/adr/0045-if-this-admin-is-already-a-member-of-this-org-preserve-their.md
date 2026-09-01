# 0045. If this admin is already a member of this org, preserve their

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `functions/src/orgProvisioning.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: if this admin is already a member of this org, preserve their original joinedAt instead of letting writeAdminAssignment's fresh serverTimestamp silently reset it.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/orgProvisioning.ts:171-185`:**

```
 * orgId to users/{uid}.orgIds via FieldValue.arrayUnion in a merge-set --
 * NEVER a literal-array overwrite and NEVER `.update` (R206; do not
 * replicate src/stores/auth.ts:426,455's overwrite bug). arrayUnion is a
 * transform that needs no prior read, so this is transaction-safe with no
 * extra tx.get.
 *
 * `existingJoinedAt` (WR-01): when the caller already read a prior
 * members/{uid} doc and it exists, pass its `joinedAt` here so a
 * re-assignment (assignOrgAdmin on someone already a member of this org)
 * preserves the original join date instead of resetting it. Left
 * `undefined` for a brand-new member (onboardOrganization's target is
 * always new -- the org was just minted -- and assignOrgAdmin's caller
 * passes `undefined` when its pre-batch read found no existing doc), which
 * falls through to a fresh `FieldValue.serverTimestamp()`.
 *
```

**`functions/src/orgProvisioning.ts:391-396`:**

```

  // WR-01: if this admin is already a member of this org, preserve their
  // original joinedAt instead of letting writeAdminAssignment's fresh
  // serverTimestamp silently reset it. This read is pre-batch (same as the
  // org-existence check above) -- there is no transaction constraint here
  // since assignOrgAdmin uses a WriteBatch, not a Transaction.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgProvisioning.ts:171-185`
- `functions/src/orgProvisioning.ts:391-396`
