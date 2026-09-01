# 0125. 5 — only a synchronous in-window gesture can re-enter; the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useOutputWindow.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Pitfall 5 — only a synchronous in-window gesture can re-enter; the requestFullscreen() call MUST be the handler's first statement, no await.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/composables/useOutputWindow.ts:129-130`:**

```
    // Pitfall 5 — only a synchronous in-window gesture can re-enter; the
    // requestFullscreen() call MUST be the handler's first statement, no await.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useOutputWindow.ts:129-130`
