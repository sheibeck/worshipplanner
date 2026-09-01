# 0116. No on-demand materialization step is needed here, unlike every

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/slides/SlideGrid.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

No on-demand materialization step is needed here, unlike every slide-appending path above: `setGroupBedMedia` already creates a skeleton group document when none exists, and it does so with a merging write (`{ merge: tru...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/slides/SlideGrid.vue:661-668`:**

```
//
// No on-demand materialization step is needed here, unlike every
// slide-appending path above: `setGroupBedMedia` already creates a skeleton
// group document when none exists, and it does so with a merging write
// (`{ merge: true }`) specifically so a concurrently-landing
// `ensureGroupMaterialized`/`materializeGroupIfMissing` call cannot be
// clobbered (WR-01). Adding a redundant materialization call here would only
// reintroduce that race, not prevent it.
```

**`src/components/slides/SlideGrid.vue:699-705`:**

```
// --- Task 2: group background control — the caller-does-the-write idiom,
// mirroring `onAttachGroupMusic`/`onRemoveGroupMusic` exactly. Background is
// group MEDIA, so writes go through `canWriteGroupMedia`, never
// `canMutateGroup` (same reasoning as the music control above). No
// on-demand materialization step is needed for the same reason the music
// handlers need none — `setGroupBackground`'s own merging skeleton-create
// already covers a plan item with no group document yet (WR-01). ---
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideGrid.vue:661-668`
- `src/components/slides/SlideGrid.vue:699-705`
