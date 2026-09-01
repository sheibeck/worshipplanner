# 0029. R171: per-org daily Resend send quota -- a fixed-window Admin-SDK

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. Documented at the time in `67-REVIEW.md`.

R171: per-org daily Resend send quota -- a fixed-window Admin-SDK counter backstopping a loop/cron fan-out. Also checked BEFORE `new Resend(...)` / the send loop, so an over-quota message sends zero emails.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/index.ts:3093-3106`:**

```
  // R171: per-org daily Resend send quota -- a fixed-window Admin-SDK
  // counter backstopping a loop/cron fan-out. Also checked BEFORE `new
  // Resend(...)` / the send loop, so an over-quota message sends zero
  // emails. Skipped entirely for a zero-recipient send -- nothing to
  // consume, and an org already at quota should not block an empty send.
  //
  // WR-02 (67-REVIEW.md): wrapped in try/catch and failed OPEN on a thrown
  // Firestore error, matching this file's own documented cost-guardrail
  // fail-open precedent for checkAndConsumeRateLimit (`// Fail OPEN: the
  // limiter is a cost guardrail, not a security control`, locked decision,
  // 65-CONTEXT.md). By this point the message doc has already been claimed
  // `queued` -> `sending`, so a fail-CLOSED error here would leave the
  // message stuck with no terminal status and no retry -- worse than
  // letting one send through uncounted against the quota.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:3093-3106`
