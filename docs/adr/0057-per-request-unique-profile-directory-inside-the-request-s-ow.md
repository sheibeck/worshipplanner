# 0057. Per-request-unique profile directory INSIDE the request's own working

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `render-service/src/render.ts`. Documented at the time in `37-RESEARCH.md`.

Per-request-unique profile directory INSIDE the request's own working directory.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`render-service/src/render.ts:110-113`:**

```
  // Per-request-unique profile directory INSIDE the request's own working directory.
  // LibreOffice's own lock file makes a shared/reused UserInstallation profile unreliable
  // under concurrency (37-RESEARCH.md Pitfall 3) -- a fresh mkdtemp per request sidesteps
  // that class of failure entirely, independent of Cloud Run's own --concurrency setting.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `render-service/src/render.ts:110-113`
