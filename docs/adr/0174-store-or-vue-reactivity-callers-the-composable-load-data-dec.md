# 0174. Store or Vue reactivity — callers (the composable) load data, decide

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideGroupMaterializer.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

store or Vue reactivity — callers (the composable) load data, decide, and write. Mirrors `slideshowAssembler.ts`'s stated purity contract.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/utils/slideGroupMaterializer.ts:7-21`:**

```
 * store or Vue reactivity — callers (the composable) load data, decide, and
 * write. Mirrors `slideshowAssembler.ts`'s stated purity contract.
 *
 * The load-bearing id invariant is that an entry id is minted ONCE and never
 * REgenerated for an existing entry — `PresentationViewer.vue` keys its
 * per-slide `AudioPlayer`/`VideoPlayer` child components on this id (Phase 23's
 * WR-02 contract), so regenerating one leaks stale muted/blocked media state
 * from one slide onto another. Every carry/merge path below therefore spreads
 * the stored entry (`{ ...stored }`) rather than rebuilding it, and the
 * assembler (24-04) never mints at all.
 *
 * This is NOT the same as "only `deriveGroupEntries` mints", which this comment
 * used to claim and which has been false for several phases (LO-04):
 * `rebuildSongGroup` mints for a newly-resolved section and for absent
 * leading/trailing copyright entries, and `SlideGrid.vue` and
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideGroupMaterializer.ts:7-21`
