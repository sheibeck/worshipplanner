# 0083. Renaming orphans the name-keyed reference on every service that

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/TeamSlideOver.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: renaming orphans the name-keyed reference on every service that already selected the old name (same practical consequence as delete) — require a soft-warn confirm step before committing the rename.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/TeamSlideOver.vue:78-79`:**

```

          <!-- Rename soft-warn (WR-02) -->
```

**`src/components/TeamSlideOver.vue:295-299`:**

```

  // WR-02: renaming orphans the name-keyed reference on every service that
  // already selected the old name (same practical consequence as delete) —
  // require a soft-warn confirm step before committing the rename. Not
  // triggered on create, on an unchanged name, or on a recurrence-only edit.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/TeamSlideOver.vue:78-79`
- `src/components/TeamSlideOver.vue:295-299`
