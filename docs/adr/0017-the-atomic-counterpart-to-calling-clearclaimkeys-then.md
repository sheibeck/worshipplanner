# 0017. The atomic counterpart to calling clearClaimKeys then

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/claimsHelpers.ts`. Documented at the time in `73-REVIEW.md`.

The atomic counterpart to calling clearClaimKeys then mergeAndSetCustomClaims as two SEPARATE writes (73-REVIEW.md WR-01).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/claimsHelpers.ts:74-85`:**

```

/**
 * The atomic counterpart to calling clearClaimKeys then mergeAndSetCustomClaims
 * as two SEPARATE writes (73-REVIEW.md WR-01). Reads current claims ONCE,
 * removes `opts.clear` keys and applies `opts.set` on top -- all in memory --
 * then issues a SINGLE setCustomUserClaims call. This closes the TOCTOU window
 * a two-write clear+set sequence opens: a token minted between the two writes
 * could carry a claim state that was never a deliberate end-state (e.g.
 * cleared primary `orgId`/`role` keys but a still-stale `orgs` map that lists
 * the org whose membership was just removed).
 *
 * Same null-vs-{} handling as clearClaimKeys: the Admin SDK requires `null`
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/claimsHelpers.ts:74-85`
