# 0089. A display dot is a REOPEN affordance ONLY when it represents a

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/run/RunHeader.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01 (R283): a display dot is a REOPEN affordance ONLY when it represents a genuinely CLOSED output within a live session — i.e. `live && !open`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/run/RunHeader.vue:45-55`:**

```

/**
 * WR-01 (R283): a display dot is a REOPEN affordance ONLY when it represents a
 * genuinely CLOSED output within a live session — i.e. `live && !open`. Pre-live
 * (State A) the dot is a PASSIVE status indicator: it must NOT emit `reopen`,
 * because pre-live there is no held go-live session and reaching `reopenOutput`
 * would open an un-positioned output window OUTSIDE the go-live gesture (bypassing
 * the honest open state machine and violating "rehearse opens no windows"). An
 * already-open display needs no reopen either, so the affordance is live-and-closed
 * only. The parent's `reopenOutput` also no-ops defensively, but gating the button
 * here keeps the affordance honest (disabled = not actionable).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/run/RunHeader.vue:45-55`
