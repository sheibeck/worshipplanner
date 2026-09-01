# 0211. Optimistic local update. assignment.effectivePersonIds is derived

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: optimistic local update. `assignment.effectivePersonIds` is derived (via resolvedRoleAssignments) from localService.value, but without this it only reflects a write once it round-trips through serviceStore.service...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/views/ServiceEditorView.vue:4585-4593`:**

```

  // WR-02: optimistic local update. `assignment.effectivePersonIds` is derived
  // (via resolvedRoleAssignments) from localService.value, but without this it
  // only reflects a write once it round-trips through serviceStore.services.
  // Two rapid clicks on the same role's checkbox group (e.g. selecting two
  // different people) would otherwise both read the same stale
  // effectivePersonIds baseline, and the second write would silently clobber
  // the first. Mutating localService.value synchronously here means a
  // same-tick second click reads the just-applied state instead.
```

**`src/views/ServiceEditorView.vue:4686-4695`:**

```

/**
 * WR-02-style optimistic update, mirroring onToggleOverridePerson: mutate
 * localService.value.messaging synchronously (so a same-tick second change
 * reads the just-applied state), fire the scoped store write, and roll back
 * on failure. `onSave`'s payload is a fixed field allowlist that does not
 * include `messaging` (same as `roleAssignmentOverrides`), so this optimistic
 * mutation cannot leak into a generic autosave write — only
 * setServiceMessagingDefaults' own scoped updateDoc ever persists it.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:4585-4593`
- `src/views/ServiceEditorView.vue:4686-4695`
