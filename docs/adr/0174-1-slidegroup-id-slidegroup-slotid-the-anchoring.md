# 0174. 1. SlideGroup.id === SlideGroup.slotId === the anchoring

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/types/slideGroup.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

1. `SlideGroup.id === SlideGroup.slotId === the anchoring ServiceSlot.id`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/types/slideGroup.ts:11-25`:**

```
 * 1. `SlideGroup.id === SlideGroup.slotId === the anchoring ServiceSlot.id`.
 *    This is the deterministic Firestore doc id every later plan in this
 *    phase relies on — groups anchor to `slot.id`, never to array index or
 *    `position`, so a drag-reorder on the Service Order tab can never
 *    re-point a group at the wrong plan item (D-01).
 * 2. `GroupSlideEntry.id` is minted ONCE (`crypto.randomUUID()`) at
 *    materialization and is NEVER regenerated afterward. Phase 23's WR-02
 *    contract keys `PresentationViewer`'s per-slide `AudioPlayer`/
 *    `VideoPlayer` child component instances on this id specifically so a
 *    reorder or reconciliation never leaks stale muted/blocked media state
 *    from one slide onto another.
 * 3. Slide TEXT is never stored on this document — it resolves LIVE from
 *    the canonical song / scripture / imported-deck record via `sourceRef`
 *    (D-02). Editing a song's lyrics updates every service referencing it;
 *    there is no per-service text override and no "Generate missing slides"
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/types/slideGroup.ts:11-25`
