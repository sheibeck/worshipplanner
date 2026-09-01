# 0195. Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 /

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideGroupMaterializer.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 / Pitfall 4): diffs the fresh resolved section order against the stored entries by `sourceRef.sectionId` — the ONE content-stable key available for songs...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-01, Pitfall`):

**`src/utils/slideGroupMaterializer.ts:577-597`:**

```

/**
 * Additive-only song rebuild (D-02, RESEARCH.md Pattern 3 strategy 1 /
 * Pitfall 4): diffs the fresh resolved section order against the stored
 * entries by `sourceRef.sectionId` — the ONE content-stable key available for
 * songs, since `ccliParser.ts` mints ids by slugifying labels. A section
 * newly present in the source is INSERTED; a stored entry whose section
 * still resolves is KEPT BY VALUE (never rebuilt — only `order` may be
 * renumbered); a stored entry whose section no longer resolves is RETAINED,
 * never deleted. The leading/trailing `copyright` entries are matched by
 * kind and position, never by `sectionId`, and are never duplicated.
 *
 * A full song-IDENTITY swap (CR-01) is detected FIRST, before any of the
 * above additive logic runs: if the group's stored lyric/copyright entries
 * reference a `songId` different from the slot's CURRENT `songId`, the slot
 * was reassigned to a different song entirely — a source-identity change,
 * not a section-level edit within the same song. The additive by-sectionId
 * merge is only valid for edits WITHIN the same song; running it across a
 * song swap would blend the old song's copyright/lyric entries with the new
 * song's (every old entry's `sectionId` looks "unresolvable" against the new
 * song and gets retained forever). Phase 30 makes this branch UNCONDITIONAL —
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideGroupMaterializer.ts:577-597`
