# 0078. Consumer-owned row/list markup — receives the shared tag-filtered

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/SongBrowser.vue`. Documented at the time in `81-REVIEW`.

Consumer-owned row/list markup — receives the shared tag-filtered pool. WR-03 (81-REVIEW): neither current production consumer destructures

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/SongBrowser.vue:74-76`:**

```

  <!-- Consumer-owned row/list markup — receives the shared tag-filtered pool.
       WR-03 (81-REVIEW): neither current production consumer destructures
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/SongBrowser.vue:74-76`
