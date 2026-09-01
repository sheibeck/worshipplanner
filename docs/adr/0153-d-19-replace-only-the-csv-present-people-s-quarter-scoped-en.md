# 0153. D-19: replace ONLY the CSV-present people's quarter-scoped entries

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/quarters.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

D-19: replace ONLY the CSV-present people's quarter-scoped entries wholesale; standing fields are upserted through the roster store (Pitfall 3).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/stores/quarters.ts:170-174`:**

```

  // D-19: replace ONLY the CSV-present people's quarter-scoped entries wholesale; standing
  // fields are upserted through the roster store (Pitfall 3). People absent from `rows` keep
  // their existing personQuarterData entry untouched — except for a bidirectional pairing
  // merge below, which only ever adds a partner id to an existing (or fresh) entry.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/quarters.ts:170-174`
