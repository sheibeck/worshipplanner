# 0230. LifecycleError is declared earlier (with the autosave watcher block)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ServiceEditorView.vue`. Documented at the time in `61-UI-SPEC`.

lifecycleError is declared earlier (with the autosave watcher block) — see CR-03's comment there for why.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-03`):

**`src/views/ServiceEditorView.vue:3146-3153`:**

```
// lifecycleError is declared earlier (with the autosave watcher block) —
// see CR-03's comment there for why.

// ── R144 (61-04): first-lock auto-notification state ────────────────────────────
//
// The subordinate confirmation line inside the lock banner reads this. `null`
// renders nothing (messaging off, default off, or a re-lock — the SC2 neutral
// no-op). Discriminated by `kind` (61-UI-SPEC § Component #0).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:3146-3153`
