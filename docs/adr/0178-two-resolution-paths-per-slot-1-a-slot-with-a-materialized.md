# 0178. Two resolution paths, per slot: 1. A slot with a materialized

## Status

Accepted

## Context

This rationale is applied at 5 call site(s) within `src/utils/slideshowAssembler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Two resolution paths, per slot: 1. A slot with a materialized `SlideGroup` (`inputs.groupsBySlotId`) joins that group's stored structure against LIVE canonical content resolved through each entry's `sourceRef` (D-02) — e...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/utils/slideshowAssembler.ts:12-26`:**

```
 *
 * Two resolution paths, per slot:
 * 1. A slot with a materialized `SlideGroup` (`inputs.groupsBySlotId`) joins
 *    that group's stored structure against LIVE canonical content resolved
 *    through each entry's `sourceRef` (D-02) — editing a song's lyrics
 *    changes the assembled text with no group write. Slide ids equal the
 *    stored `GroupSlideEntry.id`, never recomputed (Phase 23 WR-02). Audio
 *    resolves via D-04's two-level precedence (`resolveEntryMedia`); video
 *    has no bed layer (D-18) and resolves only from a video slide's own
 *    `sourceRef` in `resolveEntryContent`.
 * 2. A slot with NO materialized group yet falls back to deriving the
 *    slideshow directly from the slot's own source (today's pre-Phase-24
 *    behaviour), so the app stays coherent before 24-05/24-06 wire up
 *    reactive group subscription and lazy materialization. Fallback slide
 *    ids are derived from the slot's stable `id` (not slot array index), so
```

**`src/utils/slideshowAssembler.ts:421-426`:**

```
    // R117 (Phase 53): a manually-split lyric section resolves LIVE to N
    // slides that all share ONE stored entry; each needs a distinct, stable
    // slide id. The caller passes `${entry.id}:${i}` for a split's i-th slice.
    // When absent (every non-lyric entry AND every unsplit lyric section) the
    // slide keeps `entry.id` verbatim — byte-identical to today, preserving the
    // Phase 23 WR-02 media-keying invariant (id === groupSlideId === entry.id).
```

**`src/utils/slideshowAssembler.ts:446-448`:**

```
    // Never recompute the base id — the stored GroupSlideEntry.id IS the slide
    // id (Phase 23 WR-02 keys media children on it). A split's positional
    // `${entry.id}:${i}` override is likewise stable across recomputes.
```

**`src/utils/slideshowAssembler.ts:486-494`:**

```
   * from the GROUP tier (`backgroundSource: 'group'`), bed audio from
   * `group.bedAudioUrl` with `audioFromBed: true` and `groupId: group.id` set,
   * so the presenter's `AudioPlayer` key `group:{groupId}:{url}` stays
   * continuous across the reference->section transition (AC7). NO
   * `groupSlideId` is set — there is no entry, and media never keys on a
   * fabricated entry id (background reads `slide.backgroundImageUrl`, audio
   * keys on `groupId`); omitting it is what preserves the Phase 23 WR-02
   * invariant rather than inventing an id to violate it.
   */
```

**`src/utils/slideshowAssembler.ts:519-519`:**

```
      // No groupSlideId — there is no entry (WR-02 boundary, see above).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideshowAssembler.ts:12-26`
- `src/utils/slideshowAssembler.ts:421-426`
- `src/utils/slideshowAssembler.ts:446-448`
- `src/utils/slideshowAssembler.ts:486-494`
- `src/utils/slideshowAssembler.ts:519-519`
