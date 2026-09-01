# 0082. Resolve against visibleSongs so a cached suggestion for a

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/SongSlotPicker.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Resolve against visibleSongs so a cached suggestion for a since-hidden song never surfaces in the picker (WR-01).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/SongSlotPicker.vue:303-304`:**

```
      // Resolve against visibleSongs so a cached suggestion for a since-hidden song
      // never surfaces in the picker (WR-01).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/SongSlotPicker.vue:303-304`
