# 0075. Teams are consumed by NAME everywhere a service selects them (the

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/TeamSlideOver.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: teams are consumed by NAME everywhere a service selects them (the service checkboxes), so two teams sharing a name break checkbox independence.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/TeamSlideOver.vue:275-279`:**

```

// WR-01: teams are consumed by NAME everywhere a service selects them (the
// service checkboxes), so two teams sharing a name break checkbox
// independence. Compare trimmed + case-insensitive, excluding the row being
// edited (so saving a team without changing its name never collides with itself).
```

**`src/components/TeamSlideOver.vue:289-290`:**

```

  // WR-01: reject a save whose name collides with another existing team.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/TeamSlideOver.vue:275-279`
- `src/components/TeamSlideOver.vue:289-290`
