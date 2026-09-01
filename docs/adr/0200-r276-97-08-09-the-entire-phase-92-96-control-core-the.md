# 0200. R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/RunControlView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the single-writer channel, navigation model, rail derivations, honest open state machine, WR-01 stale guard, 96-01 recovery, exit/teardown ordering, the timers, blac...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/RunControlView.vue:307-313`:**

```

// R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the single-writer
// channel, navigation model, rail derivations, honest open state machine, WR-01
// stale guard, 96-01 recovery, exit/teardown ordering, the timers, blackout,
// rehearse, pre-flight readiness, filmstrip/rail expansion, and the document
// keyboard handler — lives in useRunControl. This view is template + this
// destructure; the composable registers its own onMounted/onUnmounted lifecycle.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/RunControlView.vue:307-313`
