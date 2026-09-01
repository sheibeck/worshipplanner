# 0082. V-model.number on a native type="number" input leaves inputValue as

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/ConfigNumberField.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: `v-model.number` on a native `type="number"` input leaves `inputValue` as the raw string `''` (not `NaN`) when the user backspaces the field to empty — Vue's `looseToNumber` only converts on a successful `parseFlo...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/admin/ConfigNumberField.vue:94-102`:**

```
  // WR-02: `v-model.number` on a native `type="number"` input leaves
  // `inputValue` as the raw string `''` (not `NaN`) when the user backspaces
  // the field to empty — Vue's `looseToNumber` only converts on a
  // successful `parseFloat`; on failure it returns the original string
  // unchanged. Detect that empty-string case explicitly, independent of
  // `min`, so a required field correctly reports "This field is required."
  // instead of silently passing the required guard and falling through to a
  // misleading min/integer message (or, if `min` were absent/<=0, saving an
  // empty string where Firestore/the functions coerce* layer expect a
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/ConfigNumberField.vue:94-102`
