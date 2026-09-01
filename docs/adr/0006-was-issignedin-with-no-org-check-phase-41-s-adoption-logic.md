# 0006. Was isSignedIn() with no org check. Phase 41's adoption logic

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `firestore.rules`. Documented at the time in `41-REVIEW`.

41-REVIEW CR-01: was `isSignedIn()` with no org check. Phase 41's adoption logic (`pickAdoptableToken`/`ensureShareLink` in src/stores/services.ts) reads and TRUSTS the `orgId`/`createdAt` of arbitrary pre-existing share...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`firestore.rules:535-543`:**

```
      // 41-REVIEW CR-01: was `isSignedIn()` with no org check. Phase 41's
      // adoption logic (`pickAdoptableToken`/`ensureShareLink` in
      // src/stores/services.ts) reads and TRUSTS the `orgId`/`createdAt` of
      // arbitrary pre-existing shareTokens docs to decide a service's
      // permanent public link, so a signed-in non-editor (or non-member,
      // given a known serviceId) could plant a document that gets adopted as
      // the official token. Every legitimate create (writeSharePayload,
      // reached only via ensureShareLink/maybeRefreshShareLink from
      // editor-gated UI actions) always writes the real orgId, so this is not
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:535-543`
