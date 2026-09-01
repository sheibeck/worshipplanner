# 0205. An outstanding 'error' means a real, unsaved edit is still sitting in

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ServiceEditorView.vue`. Documented at the time in `31-UI-SPEC`.

CR-03: an outstanding 'error' means a real, unsaved edit is still sitting in localService — handleAutosaveFailure's "kept dirty" branch deliberately never reverts it, precisely so it can be retried.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-03`):

**`src/views/ServiceEditorView.vue:2851-2859`:**

```
      // CR-03: an outstanding 'error' means a real, unsaved edit is still
      // sitting in localService — handleAutosaveFailure's "kept dirty"
      // branch deliberately never reverts it, precisely so it can be
      // retried. Silently reporting 'idle' here would make that edit vanish
      // with zero on-screen trace the instant the service locks: the status
      // bar disappears along with `canEditService` regardless of what this
      // writes, so route the failure into `lifecycleError` instead — it is
      // NOT gated behind `canEditService` in the locked banner path
      // (31-UI-SPEC § 1) — rather than reporting a falsely-clean 'idle'.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:2851-2859`
