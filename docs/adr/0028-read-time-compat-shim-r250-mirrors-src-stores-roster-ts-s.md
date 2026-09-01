# 0028. Read-time compat shim (R250, mirrors src/stores/roster.ts's

## Status

Accepted

## Context

This rationale is applied consistently at 2 call site(s) across 2 files: `functions/src/index.ts`, `functions/src/serviceRoles.ts`. Documented at the time in `85-REVIEW.md`.

Read-time compat shim (R250, mirrors src/stores/roster.ts's onSnapshot shim): the narrowed RoleGroup drops 'vocals' as a team identity, but existing per-org roles may still be stored with group 'vocals' from before Phase...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`functions/src/index.ts:3012-3016`:**

```
  // Read-time compat shim (R250, mirrors src/stores/roster.ts's onSnapshot shim): the
  // narrowed RoleGroup drops 'vocals' as a team identity, but existing per-org roles may
  // still be stored with group 'vocals' from before Phase 85. Coerce those to
  // { group: 'band', vocal: true } on read ONLY — no Firestore write migration — so the
  // server send list agrees with the client's "Reaches N" estimate (CR-01, 85-REVIEW.md).
```

**`functions/src/serviceRoles.ts:52-59`:**

```
 * "no data migration" decision as the client). Exported (rather than inlined at the
 * call site) so the server's one role-load boundary
 * (functions/src/index.ts, sendQueuedMessageHandler) and this file's own tests share
 * exactly one coercion implementation — the drift this function exists to close was
 * that a raw, un-shimmed Admin SDK read let a legacy vocalist silently drop out of a
 * "Band" team send while the client's "Reaches N" estimate still counted them
 * (CR-01, 85-REVIEW.md).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:3012-3016`
- `functions/src/serviceRoles.ts:52-59`
