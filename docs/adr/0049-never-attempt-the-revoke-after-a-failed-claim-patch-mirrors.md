# 0049. Never attempt the revoke after a failed claim patch -- mirrors the

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `functions/src/orgProvisioning.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: never attempt the revoke after a failed claim patch -- mirrors the original sequential-await behavior (a thrown patch never reached the revoke call either), and a claim-patch retry is the correct next step regardl...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/orgProvisioning.ts:68-78`:**

```

/**
 * Cheap server-side email-format guard (WR-02). Both callables use the
 * admin email as a Firestore doc id (`invites/{email}` and
 * `inviteLookup/{email}` inside `writeAdminAssignment`) -- an email
 * containing `/` (or an otherwise malformed/empty value slipping past a
 * naive client check) would otherwise throw an opaque internal error
 * mid-transaction/batch instead of a clean, actionable one. Mirrors the
 * client's `isValidEmailFormat` (src/components/admin/OrganizationsTab.vue)
 * plus an explicit `/` rejection for the doc-id-safety concern -- not
 * RFC-perfect, just rejects empty/`/`-containing/obviously-invalid values.
```

**`functions/src/orgProvisioning.ts:526-528`:**

```
  /** Count of members whose `revokeRefreshTokens` call rejected on the
   * deactivate branch (never populated on reactivate, which never revokes).
   * See `claimFailures`'s doc for why this is tracked separately (WR-02). */
```

**`functions/src/orgProvisioning.ts:606-609`:**

```
      // WR-02: never attempt the revoke after a failed claim patch -- mirrors
      // the original sequential-await behavior (a thrown patch never reached
      // the revoke call either), and a claim-patch retry is the correct next
      // step regardless of what revoke would have done.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgProvisioning.ts:68-78`
- `functions/src/orgProvisioning.ts:526-528`
- `functions/src/orgProvisioning.ts:606-609`
