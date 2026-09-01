# 0091. Gated on confirming so EVERY dismissal path (backdrop click, panel

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/CleanupEnableConfirmDialog.vue`. Documented at the time in `71-UI-SPEC.md`.

Gated on `confirming` so EVERY dismissal path (backdrop click, panel @click.self, Escape, and the Cancel button itself) is a genuine no-op while the enable write is in flight -- matches 71-UI-SPEC.md's "Cancel also disab...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/components/admin/CleanupEnableConfirmDialog.vue:190-196`:**

```

// Gated on `confirming` so EVERY dismissal path (backdrop click, panel
// @click.self, Escape, and the Cancel button itself) is a genuine no-op
// while the enable write is in flight -- matches 71-UI-SPEC.md's "Cancel
// also disabled during the enabling state (prevents closing mid-write)"
// requirement, which previously only the Cancel <button>'s :disabled
// attribute honored (review CR-01).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/CleanupEnableConfirmDialog.vue:190-196`
