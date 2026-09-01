# 0008. Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/appConfig.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's documented WR-01 fix: `Number(x) || fallback` silently discards a genuine `0`), adapted for a Firestore field typed `unknown` instead of always-a-string env...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/appConfig.ts:111-122`:**

```

/**
 * Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's documented
 * WR-01 fix: `Number(x) || fallback` silently discards a genuine `0`),
 * adapted for a Firestore field typed `unknown` instead of always-a-string
 * env var. A real, in-range value -- including 0 -- is honored; only an
 * absent/blank/non-numeric/wrong-type/negative value falls back. Every knob
 * this guards (rate limits, retention windows, caps) is fail-OPEN-but-CAPPED
 * (R184): a negative number is nonsensical for all of them (no such thing as
 * -1 requests/min or -1 days of retention), so it is treated as malformed
 * input rather than honored, the same as NaN/Infinity.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/appConfig.ts:111-122`
