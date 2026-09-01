# 0149. (68-REVIEW.md) — the requiresSuperAdmin router guard read

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. Documented at the time in `68-REVIEW.md`.

WR-03 (68-REVIEW.md) — the requiresSuperAdmin router guard read authStore.user without waiting for the store's own onAuthStateChanged listener to have populated it, unlike requiresEditor's waitForRole() above.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/stores/auth.ts:268-277`:**

```

  // WR-03 (68-REVIEW.md) — the requiresSuperAdmin router guard read
  // authStore.user without waiting for the store's own onAuthStateChanged
  // listener to have populated it, unlike requiresEditor's waitForRole()
  // above. That listener is only registered on the FIRST useAuthStore() call
  // anywhere in the app (Pinia stores are lazy), so a fresh page-load/reload
  // directly on a super-admin-only route had an implicit, untested ordering
  // dependency on when that first call happened to occur. waitForReady()
  // gives requiresSuperAdmin the same explicit wait shape as waitForRole():
  // it resolves immediately once isReady is already true, otherwise it waits
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:268-277`
