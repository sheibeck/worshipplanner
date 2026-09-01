# 0118. MonitorChanged is RunDisplaysPanel's own source of truth for the

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/composables/useRunControl.ts`. Documented at the time in `104-REVIEW`.

104-REVIEW WR-04: monitorChanged is RunDisplaysPanel's own source of truth for the per-output "reassigning" chip (:reassigning="monitorChanged" in RunControlView.vue) and must be reset in lockstep with the sticky above,...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/composables/useRunControl.ts:937-942`:**

```
    // 104-REVIEW WR-04: monitorChanged is RunDisplaysPanel's own source of
    // truth for the per-output "reassigning" chip (:reassigning="monitorChanged"
    // in RunControlView.vue) and must be reset in lockstep with the sticky
    // above, or a later go-live in the SAME mounted instance (no unmount, so
    // onMounted never re-initializes it) renders a stale "reassigning" chip
    // before anything has actually changed in the new session.
```

**`src/composables/useRunControl.ts:1296-1297`:**

```
    // 104-REVIEW WR-04: keep monitorChanged in lockstep with the sticky clear
    // above — see the matching comment in endServiceTeardown().
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useRunControl.ts:937-942`
- `src/composables/useRunControl.ts:1296-1297`
