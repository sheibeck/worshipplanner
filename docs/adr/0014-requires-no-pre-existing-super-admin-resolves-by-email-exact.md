# 0014. Requires no pre-existing super-admin. RESOLVES BY EMAIL: exactly like

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/bootstrapSuperAdmin.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

requires no pre-existing super-admin. RESOLVES BY EMAIL: exactly like backfillOrgClaims.ts and setSuperAdminClaimHandler, the target is resolved email -> uid via getAuth().getUserByEmail(), never a hand-typed uid.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/bootstrapSuperAdmin.ts:16-30`:**

```
// requires no pre-existing super-admin.
//
// RESOLVES BY EMAIL: exactly like backfillOrgClaims.ts and setSuperAdminClaimHandler,
// the target is resolved email -> uid via getAuth().getUserByEmail(), never a
// hand-typed uid.
//
// WRITES BOTH THE DOC AND THE CLAIM DIRECTLY (T-68-06, Pitfall 6): unlike the
// in-console grant path (which only ever writes the superAdmins/{uid} document
// and relies on the syncSuperAdminClaim trigger to react), this script calls
// mergeAndSetCustomClaims directly in addition to writing the document. The
// very first grant must not depend on the trigger being deployed yet -- if the
// owner runs this bootstrap before `firebase deploy --only functions` has ever
// shipped syncSuperAdminClaim, the doc-only path would leave the claim unset
// forever (no trigger exists yet to react to the write). Writing both here
// means the claim lands regardless of deploy ordering; if the trigger IS
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/bootstrapSuperAdmin.ts:16-30`
