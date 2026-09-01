# 0200. R055/R056/R057: slide → group → song, most specific wins. Computed

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideshowAssembler.ts`. Documented at the time in `33-RESEARCH.md, 33-UI-SPEC.md`.

R055/R056/R057: slide → group → song, most specific wins. Computed BEFORE the video early return below (★ Pitfall 1, 33-RESEARCH.md) — a video slide's own audio bed is deliberately suppressed (two audio sources would col...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/slideshowAssembler.ts:333-341`:**

```
  // R055/R056/R057: slide → group → song, most specific wins. Computed
  // BEFORE the video early return below (★ Pitfall 1, 33-RESEARCH.md) — a
  // video slide's own audio bed is deliberately suppressed (two audio
  // sources would collide audibly), but a video slide's background is NOT
  // suppressed the same way: a video's own picture already covers the
  // background, and there is no collision to avoid. See 33-UI-SPEC.md §9.
  // ★ Pitfall 3: `song` is legitimately `undefined` for non-SONG groups
  // (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) — optional-chain the song tier
  // so resolving a group with no owning song never throws.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideshowAssembler.ts:333-341`
