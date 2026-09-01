# 0023. PROJECTED check, not a check against the pre-send count

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `functions/src/index.ts`. Documented at the time in `67-REVIEW.md`.

WR-01 (67-REVIEW.md): PROJECTED check, not a check against the pre-send count.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/index.ts:483-497`:**

```
 * check-then-increment, no double-count on a rejected send) but on ONE
 * top-level `orgEmailCounters` doc keyed `${orgId}__day__${dayWindow}`, and
 * increments by an arbitrary `count` -- the number of emails THIS send is
 * about to attempt -- rather than always by 1 (a single 50-recipient send
 * costs 50 against the quota, not 1). Rejects when the PROJECTED total
 * (`dayCount + count`) would EXCEED the limit, not merely when `dayCount`
 * already meets it (WR-01, 67-REVIEW.md) -- because `count` can be well
 * above 1, a check against only the pre-send count could let one accepted
 * send push the day's total past `limit` by up to `count - 1`. On rejection,
 * returns not-allowed WITHOUT incrementing -- the org's quota is not
 * consumed by a send that never happens. Kept TOP-LEVEL (not nested under
 * organizations/{orgId}) for the same T-37-15 reason as aiRateLimits/aiUsage: the firestore.rules
 * catch-all deny already blocks client reads, so no rules change is needed.
 *
 * Deliberately does NOT catch its own Firestore errors -- the caller
```

**`functions/src/index.ts:514-523`:**

```

    // WR-01 (67-REVIEW.md): PROJECTED check, not a check against the
    // pre-send count. `count` (this send's recipient count, up to
    // MESSAGE_MAX_RECIPIENTS) can be far more than 1, so comparing only
    // `dayCount` to `limit` (the checkAndConsumeRateLimit shape, correct
    // there because it always increments by exactly 1) let an accepted send
    // push the day total past `limit` by up to `count - 1`. Rejecting when
    // the PROJECTED total would exceed the limit keeps the daily total from
    // ever exceeding `limit`, at the cost of possibly rejecting a send that
    // would fit under a smaller one -- the correct tradeoff for a hard cap.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:483-497`
- `functions/src/index.ts:514-523`
