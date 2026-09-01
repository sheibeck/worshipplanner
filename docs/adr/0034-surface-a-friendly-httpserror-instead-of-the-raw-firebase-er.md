# 0034. Surface a friendly HttpsError instead of the raw Firebase error

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/inviteOnboarding.ts`. Documented at the time in `99-REVIEW`.

WR-02 (99-REVIEW): surface a friendly HttpsError instead of the raw Firebase error object (which would reach the client as an opaque 'internal' with leaked provider detail) for any non-user-not-found lookup failure.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/inviteOnboarding.ts:285-288`:**

```
      // WR-02 (99-REVIEW): surface a friendly HttpsError instead of the raw
      // Firebase error object (which would reach the client as an opaque
      // 'internal' with leaked provider detail) for any non-user-not-found
      // lookup failure.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/inviteOnboarding.ts:285-288`
