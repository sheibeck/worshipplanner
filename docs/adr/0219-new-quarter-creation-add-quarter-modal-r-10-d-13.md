# 0219. ── New quarter creation (Add-quarter modal, R-10/D-13)

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/views/QuarterView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

── New quarter creation (Add-quarter modal, R-10/D-13) ───────────────────── The quarter chronologically after (year, quarter). Q4 rolls over to Q1 next year.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `R-10`):

**`src/views/QuarterView.vue:313-314`:**

```

    <!-- Add-quarter modal (R-10/D-13) — secondary, separate from the quarter switcher -->
```

**`src/views/QuarterView.vue:610-612`:**

```

// ── New quarter creation (Add-quarter modal, R-10/D-13) ─────────────────────
// The quarter chronologically after (year, quarter). Q4 rolls over to Q1 next year.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/QuarterView.vue:313-314`
- `src/views/QuarterView.vue:610-612`
