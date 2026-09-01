# 0040. T-77-02: the client's echoed confirmName proves nothing on its own

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/orgDeletion.ts`. Documented at the time in `77-RESEARCH.md, 77-REVIEW.md`.

T-77-02: the client's echoed confirmName proves nothing on its own -- compare against the SERVER's own stored name, case-sensitive (77-RESEARCH.md Assumption A1).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/orgDeletion.ts:121-128`:**

```

  // T-77-02: the client's echoed confirmName proves nothing on its own --
  // compare against the SERVER's own stored name, case-sensitive (77-RESEARCH.md
  // Assumption A1). WR-02 (77-REVIEW.md): trim BOTH sides -- onboardOrganizationHandler
  // stores `name` verbatim, untrimmed, so a stray leading/trailing space on a
  // legacy/foreign-written org must not permanently strand it: the dialog's
  // own `.trim()` on typed input makes it structurally impossible to type a
  // trailing/leading space back in.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/orgDeletion.ts:121-128`
