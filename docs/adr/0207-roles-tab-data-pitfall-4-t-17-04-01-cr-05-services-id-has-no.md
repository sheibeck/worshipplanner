# 0207. Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no requiresEditor route guard, so a non-editor viewer can land here — the editor-only roles/quarters/people collections must never be subscribed to for a...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-05, Pitfall`):

**`src/views/ServiceEditorView.vue:3031-3034`:**

```
  // Roles tab data (Pitfall 4 / T-17-04-01 / CR-05): /services/:id has no
  // requiresEditor route guard, so a non-editor viewer can land here — the
  // editor-only roles/quarters/people collections must never be subscribed to
  // for a viewer (Phase 16.2 removal decision: no expanded viewer read access).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:3031-3034`
