# 0043. This cascade is comparably or more expensive than parsePptx

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgDeletion.ts`. Documented at the time in `77-REVIEW.md`.

WR-01 (77-REVIEW.md): this cascade is comparably or more expensive than parsePptx (functions/src/index.ts's { memory: "1GiB", timeoutSeconds: 120 }) -- 5 concurrent READ queries, N sequential batch commits, a full Storag...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/orgDeletion.ts:214-229`:**

```

// WR-01 (77-REVIEW.md): this cascade is comparably or more expensive than
// parsePptx (functions/src/index.ts's { memory: "1GiB", timeoutSeconds: 120 })
// -- 5 concurrent READ queries, N sequential batch commits, a full Storage
// prefix sweep, and a recursiveDelete over every subcollection at every
// depth. timeoutSeconds: 540 is the v2 callable maximum, giving the sweep
// generous headroom to complete well within budget for a single church.
//
// Resumability boundary (documented, not solved here -- WR-01 scope):
// the cross-ref batch deletes + Storage sweep are each idempotent, so a
// retry against that same state re-runs cleanly WHILE the org doc still
// exists (see "idempotent retry" in orgDeletion.test.ts). A timeout that
// fires mid-recursiveDelete, AFTER the org doc itself is gone, is NOT
// resumable -- there is no code path to resume a cascade once the parent
// doc no longer exists. A generous timeout is the mitigation; building a
// not-found-parent resume path is out of scope for this phase.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgDeletion.ts:214-229`
