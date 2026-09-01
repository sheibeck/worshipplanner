# 0159. ShareLinkCache is subscription-scoped state exactly like everything

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/stores/services.ts`. Documented at the time in `41-REVIEW`.

WR-03 (41-REVIEW): shareLinkCache is subscription-scoped state exactly like everything else reset above, but was missed — clear it on org switch too, so a cached token/false from the previous org's services can never lea...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/stores/services.ts:287-290`:**

```
    // WR-03 (41-REVIEW): shareLinkCache is subscription-scoped state exactly
    // like everything else reset above, but was missed — clear it on org
    // switch too, so a cached token/false from the previous org's services
    // can never leak into the newly-subscribed org's resolution.
```

**`src/stores/services.ts:670-674`:**

```
    // WR-03 (41-REVIEW): drop the deleted service's shareLinkCache entry so
    // it cannot accumulate as a dead entry, and so a same-session, same-org
    // serviceId reuse (however unlikely with Firestore's random doc ids)
    // never resolves against a stale cached token/false for a service that
    // no longer exists.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:287-290`
- `src/stores/services.ts:670-674`
