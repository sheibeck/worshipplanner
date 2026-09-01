# 0062. Raw/unfiltered service-date count for the quarter, independent of any

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/QuarterShareMatrix.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-05: raw/unfiltered service-date count for the quarter, independent of any active name filter narrowing `dates` — lets this component tell "genuinely empty quarter" apart from "filter matched zero dates" instead of col...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-05`):

**`src/components/QuarterShareMatrix.vue:29-29`:**

```
    <!-- WR-05: distinguish "quarter genuinely has no service dates" from "a name filter
```

**`src/components/QuarterShareMatrix.vue:53-55`:**

```
  // WR-05: raw/unfiltered service-date count for the quarter, independent of any active name
  // filter narrowing `dates` — lets this component tell "genuinely empty quarter" apart from
  // "filter matched zero dates" instead of collapsing both into "No service dates".
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/QuarterShareMatrix.vue:29-29`
- `src/components/QuarterShareMatrix.vue:53-55`
