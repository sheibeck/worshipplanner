# 0204. Declared before the watcher below (rather than down with the rest of

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Declared before the watcher below (rather than down with the rest of the R037 transition state) because CR-03's `!editable` branch reads it — hoisting keeps that read after its own declaration rather than relying on the...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-03`):

**`src/views/ServiceEditorView.vue:2834-2839`:**

```

// Declared before the watcher below (rather than down with the rest of the
// R037 transition state) because CR-03's `!editable` branch reads it —
// hoisting keeps that read after its own declaration rather than relying on
// the (currently true, but fragile) fact that `status` can't be 'error' on
// the watcher's own `{ immediate: true }` first run.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:2834-2839`
