# 0214. Monotonic token guarding against a stale getScreenDetails()

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/views/MonitorSetupView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Monotonic token guarding against a stale getScreenDetails() resolution overriding a newer detection attempt (REVIEW-FIX WR-03).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/views/MonitorSetupView.vue:199-203`:**

```

// Monotonic token guarding against a stale getScreenDetails() resolution
// overriding a newer detection attempt (REVIEW-FIX WR-03). Bumped by every
// new detection attempt, so a resolution/rejection that arrives after a newer
// attempt started is a no-op.
```

**`src/views/MonitorSetupView.vue:429-430`:**

```
      // Stale-resolution guard (REVIEW-FIX WR-03): ignore if a newer
      // detection attempt started while this was still pending.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/MonitorSetupView.vue:199-203`
- `src/views/MonitorSetupView.vue:429-430`
