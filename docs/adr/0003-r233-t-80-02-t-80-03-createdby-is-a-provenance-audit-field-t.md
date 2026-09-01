# 0003. R233/T-80-02/T-80-03: createdBy is a provenance/audit field that must

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `firestore.rules`. Documented at the time in `80-RESEARCH.md`.

R233/T-80-02/T-80-03: `createdBy` is a provenance/audit field that must be settable exactly once (at create) and frozen forever after -- an editor rewriting it is authorship tampering (Tampering) and destroys the audit t...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`firestore.rules:156-170`:**

```

      // R233/T-80-02/T-80-03: `createdBy` is a provenance/audit field that must
      // be settable exactly once (at create) and frozen forever after -- an
      // editor rewriting it is authorship tampering (Tampering) and destroys
      // the audit trail of who actually provisioned the org (Repudiation).
      // Deliberately a SIBLING helper, not folded into lifecycleFields()'s
      // array (80-RESEARCH.md Pitfall 2): that array is also consulted on
      // CREATE to assert those keys are ABSENT from the incoming doc, but
      // createdBy is REQUIRED on create (see the `allow create` clause below,
      // `request.resource.data.createdBy == request.auth.uid`) -- widening the
      // shared list would deny every legitimate org-create. This helper is
      // scoped to update only: the only call site below is `allow update`,
      // which is reached only when `resource` (the stored doc) already exists,
      // so no `resource == null` branch is needed here (unlike
      // preservesLifecycleFields(), which is also reachable from create).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:156-170`
