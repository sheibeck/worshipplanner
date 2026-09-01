# 0119. Explicit, mirrors endServiceTeardown's defense-in-depth

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useRunControl.ts`. Documented at the time in `106-REVIEW`.

106-REVIEW WR-02: explicit, mirrors endServiceTeardown's defense-in-depth (useRunControl.ts:903-907).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/composables/useRunControl.ts:968-972`:**

```
    // 106-REVIEW WR-02: explicit, mirrors endServiceTeardown's defense-in-depth
    // (useRunControl.ts:903-907). This exit path does NOT unmount the component
    // (State A re-renders in place), so useLoopTimer's own onUnmounted(disarm)
    // safety net does not apply here — without this call, disarming depends
    // solely on the async watch(live, reconcileLoop) below.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:968-972`
