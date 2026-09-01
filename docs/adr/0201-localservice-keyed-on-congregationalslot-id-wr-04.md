# 0201. LocalService. Keyed on congregationalSlot.id (WR-04

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

`localService`. Keyed on `congregationalSlot.id` (WR-04,

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/views/ServiceEditorView.vue:587-587`:**

```
             `localService`. Keyed on `congregationalSlot.id` (WR-04,
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:587-587`
