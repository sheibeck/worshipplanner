# 0133. Church-level Vertical Worship 1-2-3 methodology toggle (D-15)

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `src/stores/auth.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON — missing field on legacy org docs means VW mode is enabled. Single source of truth every VW surface gates on (D-16).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/stores/auth.ts:106-110`:**

```

  // Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON —
  // missing field on legacy org docs means VW mode is enabled. Single source of
  // truth every VW surface gates on (D-16). Mirror-written from Settings; NOT
  // live-synced via onSnapshot (Pitfall 2).
```

**`src/stores/auth.ts:164-170`:**

```
  // via enterOrgAsSuperAdmin, with NO membership document of their own.
  // Null means no such visit is in effect. Purely client/UI-gating state —
  // never the security boundary; every Firestore/Storage op made while set
  // is independently re-checked by firestore.rules/storage.rules' own
  // super-admin arm (78-01-PLAN.md). Must be cleared alongside orgId/etc. in
  // ALL THREE places that reset org context inline: resetOrgContext, logout,
  // and the onAuthStateChanged null-user branch (Pitfall 4).
```

**`src/stores/auth.ts:340-346`:**

```

  // R177 (Pitfall 4) — forces a single getIdTokenResult(user, true) read and
  // updates isSuperAdmin from it. Used by the requiresSuperAdmin route guard
  // so a just-granted super-admin's next navigation picks up the fresh claim
  // instead of relying on the token's normal hourly refresh cadence. Never
  // throws: a failed refresh just leaves isSuperAdmin at its last known
  // value, and the guard's redirect-on-false still applies safely.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:106-110`
- `src/stores/auth.ts:164-170`
- `src/stores/auth.ts:340-346`
