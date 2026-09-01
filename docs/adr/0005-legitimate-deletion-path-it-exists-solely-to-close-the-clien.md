# 0005. Legitimate deletion path. It exists solely to close the client-side

## Status

Accepted

## Context

This rationale is applied consistently at 3 call site(s) across 2 files: `firestore.rules`, `functions/src/orgDeletion.ts`. Documented at the time in `77-RESEARCH.md`.

legitimate deletion path. It exists solely to close the client-side gap the `write`->`update` narrowing above just opened up: before that narrowing, `preservesLifecycleFields()`'s `request.resource == null -> true` branc...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`firestore.rules:219-230`:**

```
      // legitimate deletion path. It exists solely to close the client-side
      // gap the `write`->`update` narrowing above just opened up: before
      // that narrowing, `preservesLifecycleFields()`'s `request.resource ==
      // null -> true` branch meant the old `allow write` rule granted an
      // ordinary editor unconditional delete access to the org doc.
      // Deliberately UNCONDITIONAL -- NO `isSuperAdmin()` exemption
      // (77-RESEARCH.md Pitfall 5): writing this as `allow delete: if
      // isSuperAdmin()` would re-open a client-side deletion path for any
      // super-admin using the client SDK directly, which conflicts with the
      // design intent that deletion is Admin-SDK-only. Proven by an emulator
      // DENY for both an ordinary editor and a super-admin client context
      // (src/rules.test.ts).
```

**`functions/src/orgDeletion.ts:14-37`:**

```
// operation in this codebase. It is gated by the SAME assertSuperAdminCaller
// dual re-verification every other owner-console callable uses (T-77-01),
// plus two independent server-side re-checks the client cannot bypass:
//   - the org must already be deactivated (active === false) -- T-77-06
//   - confirmName must match the org's SERVER-STORED name, exactly -- T-77-02
//
// Cascade order (77-RESEARCH.md Cascade Order / Pattern 2 / Pitfall 1):
// every cross-reference this handler needs (member uids, inviteLookup docs,
// the orgNames guard read, and the 5 extra orgId-keyed collections) is READ
// and held in memory BEFORE any delete fires -- recursiveDelete/deleteFiles
// remove the very data those reads depend on, so reversing this order would
// silently orphan every affected user's `orgIds` claim (T-77-03/T-77-08).
//
// Deliberately OUT OF SCOPE (documented, not an oversight): `aiUsage` and
// `aiRateLimits` are a platform cost-observability ledger, not tenant
// content -- 77-RESEARCH.md Open Question 2 recommends leaving them alone.

/**
 * The 5 top-level collections that store `orgId` as a plain document field
 * (NOT nested under `organizations/{orgId}`, so `recursiveDelete` cannot see
 * them -- 77-RESEARCH.md Pitfall 2 / T-77-07). Exported as a single source of
 * truth so `orgDeletion.test.ts` can iterate this exact list rather than
 * duplicating the literal.
 */
```

**`functions/src/orgDeletion.ts:187-192`:**

```

  // --- Storage: every object under orgs/{orgId}/ (media, backgrounds,
  // pptx-imports, rendered, ...) -- a single prefix covers all of them
  // (77-RESEARCH.md Standard Stack). force:true so a transient per-object
  // failure never aborts the whole sweep (Pitfall 4). ---------------------
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:219-230`
- `functions/src/orgDeletion.ts:14-37`
- `functions/src/orgDeletion.ts:187-192`
