# 0028. The send half of the queue-then-trigger path: an onDocumentCreated

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. Documented at the time in `59-RESEARCH.md`.

The send half of the queue-then-trigger path: an onDocumentCreated trigger on .../messages/{messageId}, the ONLY Function bound to RESEND_API_KEY.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/index.ts:2777-2791`:**

```
// The send half of the queue-then-trigger path: an onDocumentCreated trigger
// on .../messages/{messageId}, the ONLY Function bound to RESEND_API_KEY. Its
// handler body (sendQueuedMessageHandler) is exported separately from the
// wrapper (requestPptxRenderHandler precedent) so the idempotency + send logic
// is directly unit-tested with Resend mocked. It runs a transactional
// queued->sending claim (GENUINELY NEW code — the PPTX precedent has NO status
// claim, 59-RESEARCH.md Pitfall 1), re-resolves recipients server-side (never
// the client's stored list — Anti-Pattern 1), renders per-recipient tokens
// (R139), sends once per recipient (per-recipient try/catch so one bad address
// is a failed recipient, not an aborted batch), writes one recipients/{id} doc
// per recipient, rolls up deliveryCounts, and flips the message status.

// SERVICE_SHARE_BASE_URL (the app's public share-link base origin) now lives in
// ./params -- imported and re-exported at the top of this file (moved so
// adminEmail.ts can reuse it without a circular import).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:2777-2791`
