# 0116. The Go-live gesture entry — bound to the run-go-live-btn click, run

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useRunControl.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

The Go-live gesture entry — bound to the run-go-live-btn click, run SYNCHRONOUSLY.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/composables/useRunControl.ts:773-781`:**

```
  /**
   * The Go-live gesture entry — bound to the run-go-live-btn click, run
   * SYNCHRONOUSLY. getScreenDetails() is the FIRST statement after the plain
   * feature-detect (the only line before it is a synchronous ref set), with NO
   * await/store/router before it, so its .then runs while the click's transient
   * activation is still live and window.open + requestFullscreen({ screen })
   * inside openPlaced act within the sanctioned one-gesture window (Pitfall 1/5).
   * Mirrors MonitorSetupView.onDetectClick.
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:773-781`
