# 0199. PARTIAL (WR-02): EXACTLY ONE output window opened; the other was

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/RunControlView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

PARTIAL (WR-02): EXACTLY ONE output window opened; the other was refused.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/views/RunControlView.vue:118-119`:**

```

    <!-- PARTIAL (WR-02): EXACTLY ONE output window opened; the other was refused. -->
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/RunControlView.vue:118-119`
