# 0039. Whether the member document exists AFTER this write. false only for a

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `functions/src/orgMembershipClaims.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Whether the member document exists AFTER this write. false only for a genuine delete -- this is the real create/update/delete signal, threaded explicitly rather than inferred from `role` (WR-01: `role === undefined` alon...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/orgMembershipClaims.ts:200-206`:**

```
  /**
   * Whether the member document exists AFTER this write. false only for a
   * genuine delete -- this is the real create/update/delete signal, threaded
   * explicitly rather than inferred from `role` (WR-01: `role === undefined`
   * alone is ambiguous between "document deleted" and "document exists but
   * has no role field").
   */
```

**`functions/src/orgMembershipClaims.ts:276-283`:**

```

  // Step 3b (WR-01): the document exists but has no `role` field -- e.g. a
  // manual Firestore Console edit, or a future write path that creates a
  // members/{uid} doc without setting role. This is NOT a delete, so it must
  // never take the clear branch above: clearing here would silently revoke a
  // still-valid membership's claim on ambiguous input. Skip defensively
  // instead -- a stale claim is the lesser harm; the delete path above
  // already handles genuine revocation explicitly.
```

**`functions/src/orgMembershipClaims.ts:409-413`:**

```

    // Fully-conservative skips: the write is too ambiguous to act on at
    // all (no user doc, or a create/update with no role field -- WR-01).
    // Never touch orgs/deactivatedOrgs here either -- identical to
    // pre-widening behaviour.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgMembershipClaims.ts:200-206`
- `functions/src/orgMembershipClaims.ts:276-283`
- `functions/src/orgMembershipClaims.ts:409-413`
