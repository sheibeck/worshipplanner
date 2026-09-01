# 0158. Equals the stored GroupSlideEntry.id this slide was resolved from

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/types/slide.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Equals the stored `GroupSlideEntry.id` this slide was resolved from. Never recomputed from slot index or emission order — Phase 23's WR-02 keys `PresentationViewer`'s media children on this id.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/types/slide.ts:244-249`:**

```
  /**
   * Equals the stored `GroupSlideEntry.id` this slide was resolved from.
   * Never recomputed from slot index or emission order — Phase 23's WR-02
   * keys `PresentationViewer`'s media children on this id. Absent on the
   * fallback path.
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/types/slide.ts:244-249`
