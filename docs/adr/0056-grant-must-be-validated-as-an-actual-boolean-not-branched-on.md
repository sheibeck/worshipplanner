# 0056. Grant must be validated as an actual boolean, not branched on with

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/superAdminClaims.ts`. Documented at the time in `68-REVIEW.md`.

WR-01 (68-REVIEW.md): `grant` must be validated as an actual boolean, not branched on with bare truthiness.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/superAdminClaims.ts:134-142`:**

```
  // WR-01 (68-REVIEW.md): `grant` must be validated as an actual boolean, not
  // branched on with bare truthiness. `CallableRequest<SetSuperAdminClaimRequest>`
  // is a compile-time-only guarantee -- a raw httpsCallable invocation, a
  // curl/Postman call, or a future client bug can send `grant` missing/
  // undefined/null/0/"". Falling through to `if (grant)` would silently take
  // the REVOKE branch (deleting the target's superAdmins/{targetUid} doc and
  // revoking their refresh tokens) on any malformed call, even when intent was
  // to grant -- the more dangerous of the two failure directions. Reject
  // outright instead of guessing.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/superAdminClaims.ts:134-142`
