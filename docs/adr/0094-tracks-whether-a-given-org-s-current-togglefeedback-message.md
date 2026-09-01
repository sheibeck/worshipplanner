# 0094. Tracks whether a given org's current toggleFeedback message is a

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/OrganizationsTab.vue`. Documented at the time in `76-REVIEW.md`.

WR-01 (76-REVIEW.md): tracks whether a given org's current toggleFeedback message is a partial-failure warning (claimFailures > 0) rather than a clean success, so the template can style it distinctly (amber, not green).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/admin/OrganizationsTab.vue:362-364`:**

```
// WR-01 (76-REVIEW.md): tracks whether a given org's current toggleFeedback
// message is a partial-failure warning (claimFailures > 0) rather than a
// clean success, so the template can style it distinctly (amber, not green).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/OrganizationsTab.vue:362-364`
