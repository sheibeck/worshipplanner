# 0184. Routed through the scriptureApi.ts dispatcher — the phase's single

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/planningCenterApi.ts`. Documented at the time in `102-REVIEW`.

CR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher — the phase's single choke point — rather than calling fetchPassageText/fetchNltPassageText directly.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, WR-02`):

**`src/utils/planningCenterApi.ts:993-1002`:**

```
      // CR-01 (102-REVIEW): routed through the scriptureApi.ts dispatcher —
      // the phase's single choke point — rather than calling
      // fetchPassageText/fetchNltPassageText directly. That kept this "push
      // to Planning Center" flow ungated even after the server-side R297 gate
      // deployed, silently 403ing on every SCRIPTURE slot for a disabled org.
      // Kept wrapped in try/catch (the pre-existing shape) as a defensive
      // safety net: the dispatcher's gate check runs BEFORE its own internal
      // try/catch, so a throw from useAuthStore() there would otherwise
      // propagate here uncaught (same edge case WR-02, 102-REVIEW, restored
      // a catch for in the two Vue components).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/planningCenterApi.ts:993-1002`
