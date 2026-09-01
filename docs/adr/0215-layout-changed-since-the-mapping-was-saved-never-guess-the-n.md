# 0215. Layout changed since the mapping was saved — never guess the new

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/MonitorSetupView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Layout changed since the mapping was saved — never guess the new mapping from the stale one (PITFALLS Pitfall 2).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/MonitorSetupView.vue:341-342`:**

```
    // Layout changed since the mapping was saved — never guess the new
    // mapping from the stale one (PITFALLS Pitfall 2).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/MonitorSetupView.vue:341-342`
