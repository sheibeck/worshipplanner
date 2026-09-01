# 0084. Dedupe on read (see TeamRecurrenceSlideOver.vue) — a duplicate

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/TeamSlideOver.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-2: dedupe on read (see TeamRecurrenceSlideOver.vue) — a duplicate entering via a direct console edit/migration/future writer would otherwise leave toggleOrdinal splicing only one copy per click.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-2`):

**`src/components/TeamSlideOver.vue:238-240`:**

```
      // WR-2: dedupe on read (see TeamRecurrenceSlideOver.vue) — a duplicate
      // entering via a direct console edit/migration/future writer would
      // otherwise leave toggleOrdinal splicing only one copy per click.
```

**`src/components/TeamSlideOver.vue:308-311`:**

```

  // WR-2: dedupe on write too, in case a duplicate slipped past the read-side
  // seed (e.g. this component instance stayed open across a direct Firestore
  // edit landing mid-session).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/TeamSlideOver.vue:238-240`
- `src/components/TeamSlideOver.vue:308-311`
