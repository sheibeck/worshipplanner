# 0012. The ~1000-byte custom-claims cap throws auth/claims-too-large -- give

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 3 files: `functions/src/backfillOrgClaims.ts`, `functions/src/claimsHelpers.ts`, `functions/src/orgMembershipClaims.ts`. Documented at the time in `73-REVIEW.md`.

WR-02 (73-REVIEW.md): the ~1000-byte custom-claims cap throws auth/claims-too-large -- give it a distinguishable, greppable log line rather than letting it blend into the generic failure path below.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/backfillOrgClaims.ts:237-240`:**

```
      // WR-02 (73-REVIEW.md): give the ~1000-byte custom-claims cap's
      // auth/claims-too-large error a distinguishable, greppable log line --
      // mirrors syncOrgMembershipClaimHandler's identical carve-out. Still
      // recorded in `failed` exactly as before; only the logging changes.
```

**`functions/src/claimsHelpers.ts:136-143`:**

```

/**
 * Detects the Firebase Admin SDK's `auth/claims-too-large` error -- thrown by
 * `setCustomUserClaims` when the serialized custom-claims object exceeds the
 * ~1000-byte cap (73-REVIEW.md WR-02). Shared by every claim-write call site
 * so a claims-too-large failure logs a distinguishable, greppable line rather
 * than being indistinguishable from any other transient Auth API failure.
 */
```

**`functions/src/orgMembershipClaims.ts:487-491`:**

```
    // WR-02 (73-REVIEW.md): the ~1000-byte custom-claims cap throws
    // auth/claims-too-large -- give it a distinguishable, greppable log line
    // rather than letting it blend into the generic failure path below.
    // Still fail-closed (return { action: "failed" }) -- this only changes
    // logging, never success behavior.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/backfillOrgClaims.ts:237-240`
- `functions/src/claimsHelpers.ts:136-143`
- `functions/src/orgMembershipClaims.ts:487-491`
