# 0209. R271 / Pitfall 6 — the ONE interactive element in this view, shown

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/AudienceOutputView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

R271 / Pitfall 6 — the ONE interactive element in this view, shown

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/AudienceOutputView.vue:38-39`:**

```

    <!-- R271 / Pitfall 6 — the ONE interactive element in this view, shown
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/AudienceOutputView.vue:38-39`
