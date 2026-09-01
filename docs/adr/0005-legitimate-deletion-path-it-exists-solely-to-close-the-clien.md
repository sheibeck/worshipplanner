# 0005. Legitimate deletion path. It exists solely to close the client-side

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `firestore.rules`. Documented at the time in `77-RESEARCH.md`.

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

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:219-230`
