# 0022. Reject a streamed request outright rather than forward it

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-03: reject a streamed request outright rather than forward it.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`functions/src/index.ts:299-307`:**

```
  // WR-03: reject a streamed request outright rather than forward it. The
  // aiUsage ledger write below parses the upstream response body as a single
  // JSON object (`JSON.parse(body) as { usage?: AnthropicUsage }`) -- an SSE
  // stream's raw text is not valid JSON, so a `stream: true` request would
  // still be billed/rate-limited but silently never recorded in the ledger
  // (the `catch (ledgerErr)` swallows the JSON.parse throw). The server
  // dictates non-streaming so every proxied request records a usage entry
  // (R163), matching the "reject, don't silently trust" posture already used
  // for `model` above.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:299-307`
