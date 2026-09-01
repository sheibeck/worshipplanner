# 0122. Service subscription — key the service source off the SAME resolved

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/composables/useServiceAssembly.ts`. Documented at the time in `93-REVIEW`.

Service subscription — key the service source off the SAME resolved orgId useSlideshowAssembly subscribes content to, not off "is the store fresh?".

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/composables/useServiceAssembly.ts:65-76`:**

```
    // Service subscription — key the service source off the SAME resolved orgId
    // useSlideshowAssembly subscribes content to, not off "is the store fresh?".
    //
    // WR-02 (93-REVIEW): the old `!serviceStore.orgId` gate assumed a fresh Pinia
    // singleton (the standalone window.open path). But this is also a directly-
    // loadable SPA route: on a same-tab navigation where the store is ALREADY
    // subscribed to org X while this URL's `?org=` is Y, that gate skipped the
    // re-subscribe, leaving `services` sourced from X while the assembly reads Y —
    // a silent cross-org desync on the congregation surface (never-found service →
    // permanent black, or an X service assembled against Y's content maps). Gate on
    // an org MISMATCH instead: subscribe() is idempotent (it tears down the prior
    // listener first), so re-subscribing when the requested org differs re-keys the
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/composables/useServiceAssembly.ts:65-76`
