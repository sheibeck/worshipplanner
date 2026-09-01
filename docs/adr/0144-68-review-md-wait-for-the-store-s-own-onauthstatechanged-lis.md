# 0144. (68-REVIEW.md) — wait for the store's own onAuthStateChanged listener

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/router/index.ts`. Documented at the time in `68-REVIEW.md`.

WR-03 (68-REVIEW.md) — wait for the store's own onAuthStateChanged listener to have populated authStore.user, mirroring requiresEditor's waitForRole() wait above, BEFORE calling refreshSuperAdminClaim().

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-03`):

**`src/router/index.ts:229-240`:**

```
    // WR-03 (68-REVIEW.md) — wait for the store's own onAuthStateChanged
    // listener to have populated authStore.user, mirroring requiresEditor's
    // waitForRole() wait above, BEFORE calling refreshSuperAdminClaim(). Without
    // this, a fresh page-load/reload directly on /owner-console could read
    // authStore.user before it was populated, causing refreshSuperAdminClaim to
    // bail with isSuperAdmin = false and wrongly redirect a real super-admin.
    //
    // R177 (Pitfall 4) — then force a fresh claim read BEFORE deciding to
    // redirect, so a just-granted super-admin's very next navigation sees it
    // rather than waiting out the token's normal refresh cadence. Convenience
    // gate only — the real enforcement is firestore.rules' isSuperAdmin() +
    // the setSuperAdminClaim onCall's server-side caller re-check.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/router/index.ts:229-240`
