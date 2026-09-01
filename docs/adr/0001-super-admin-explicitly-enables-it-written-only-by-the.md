# 0001. Super-admin explicitly enables it. Written ONLY by the

## Status

Accepted

## Context

This rationale is applied consistently at 2 call site(s) across 2 files: `firestore.rules`, `src/types/organization.ts`. Documented at the time in `82-RESEARCH.md`.

super-admin explicitly enables it. Written ONLY by the `setOrgAiEnabled` Cloud Function (Admin SDK, `functions/src/orgProvisioning.ts`, Plan 01); `firestore.rules`'s `lifecycleFields()` guard denies every client write pa...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`firestore.rules:112-126`:**

```
      // specifically an ORDINARY editor forging these fields.
      // Phase 82 (R242/R243): `aiMasterEnabled` -- the super-admin-only master
      // AI gate -- is appended to this SAME allow-list, not given its own
      // guard function. It is a DISTINCT top-level field from the pre-existing
      // `settings.aiEnabled` (the church's own AI preference, editor-writable
      // via the settings map) -- never a bare `aiEnabled` at this depth, to
      // avoid the exact name collision 82-RESEARCH.md's Pitfall 1 warns
      // against. Written ONLY by the setOrgAiEnabled Cloud Function via the
      // Admin SDK (functions/src/orgProvisioning.ts), which bypasses these
      // rules entirely -- mirrors `active`'s posture verbatim, INCLUDING the
      // "no exemption for a super-admin's own client SDK" posture (see the
      // CRITICAL test at src/rules.test.ts:682 and its aiMasterEnabled twin):
      // a super-admin client write here would skip setOrgAiEnabled's R243
      // forced-off side effect on `settings.aiEnabled`, reopening the same
      // partial-state hole Phase 78 closed for `active`.
```

**`src/types/organization.ts:187-195`:**

```
   * super-admin explicitly enables it. Written ONLY by the `setOrgAiEnabled`
   * Cloud Function (Admin SDK, `functions/src/orgProvisioning.ts`, Plan 01);
   * `firestore.rules`'s `lifecycleFields()` guard denies every client write
   * path, including a super-admin's own client SDK — mirrors `active`'s
   * write-authority shape exactly. Deliberately a distinct top-level name
   * (never a bare `aiEnabled`) so it can never be confused with or
   * accidentally overwritten via `settings.aiEnabled` (Pitfall 1,
   * 82-RESEARCH.md).
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:112-126`
- `src/types/organization.ts:187-195`
