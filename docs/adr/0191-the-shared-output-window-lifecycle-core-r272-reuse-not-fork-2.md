# 0191. The shared output-window lifecycle-core (R272 reuse-not-fork)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/ConfidenceOutputView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel, font gate, rootStyle cursor coupling, non-teardown fullscreen re...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/views/ConfidenceOutputView.vue:136-144`:**

```

// The shared output-window lifecycle-core (R272 reuse-not-fork): ?org=/serviceId
// scoping, WR-02 subscribe gate, read-only assembly, receive-only run channel,
// font gate, rootStyle cursor coupling, non-teardown fullscreen recovery, and the
// Screen Wake Lock — all inherited identically from the audience window. The
// per-canvas media plumbing stays view-local below (current pane only).
// `blackout` is intentionally NOT destructured here (R305): the confidence
// monitor no longer consumes it. useOutputWindow keeps returning it unchanged
// for AudienceOutputView.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/ConfidenceOutputView.vue:136-144`
