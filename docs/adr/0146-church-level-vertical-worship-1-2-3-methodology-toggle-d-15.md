# 0146. Church-level Vertical Worship 1-2-3 methodology toggle (D-15)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/auth.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON — missing field on legacy org docs means VW mode is enabled. Single source of truth every VW surface gates on (D-16).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/stores/auth.ts:106-110`:**

```

  // Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON —
  // missing field on legacy org docs means VW mode is enabled. Single source of
  // truth every VW surface gates on (D-16). Mirror-written from Settings; NOT
  // live-synced via onSnapshot (Pitfall 2).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/auth.ts:106-110`
