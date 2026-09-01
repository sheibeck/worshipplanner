# 0231. READ BEFORE WRITE: the snapshot's prior existence is the first-lock

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ServiceEditorView.vue`. Documented at the time in `61-RESEARCH`.

READ BEFORE WRITE: the snapshot's prior existence is the first-lock signal. Reading AFTER the setDoc would make every lock look like a re-lock (61-RESEARCH Pitfall 4).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/ServiceEditorView.vue:3282-3284`:**

```
        // READ BEFORE WRITE: the snapshot's prior existence is the first-lock
        // signal. Reading AFTER the setDoc would make every lock look like a
        // re-lock (61-RESEARCH Pitfall 4).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:3282-3284`
