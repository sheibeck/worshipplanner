# 0225. Non-editor: no roster/quarters data was ever subscribed to (Pitfall

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/views/ServiceEditorView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Non-editor: no roster/quarters data was ever subscribed to (Pitfall 4) — read-only note only

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/ServiceEditorView.vue:1422-1422`:**

```
          <!-- Non-editor: no roster/quarters data was ever subscribed to (Pitfall 4) — read-only note only -->
```

**`src/views/ServiceEditorView.vue:1668-1668`:**

```
             row now does that job directly (Anti-Patterns / Pitfall 4). -->
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ServiceEditorView.vue:1422-1422`
- `src/views/ServiceEditorView.vue:1668-1668`
