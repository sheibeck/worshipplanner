# 0181. Song lookup keyed on the GROUP's owning song (via the slot), not the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideshowAssembler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-01: song lookup keyed on the GROUP's owning song (via the slot), not the individual entry's own `sourceRef.kind`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-01`):

**`src/utils/slideshowAssembler.ts:429-438`:**

```
    // WR-01: song lookup keyed on the GROUP's owning song (via the slot),
    // not the individual entry's own `sourceRef.kind`. A SONG group's
    // `slides` array can legitimately contain `text`/`video` entries
    // (slideGroupMaterializer.ts's reconciler carries them through by value,
    // preserved from before R054's Phase-30 lockdown) — keying on
    // `entry.sourceRef.kind` alone left those entries unable to resolve the
    // song background tier even though every sibling lyric/copyright slide
    // in the SAME group correctly fell through to it. Every other slot kind
    // (PRAYER/SCRIPTURE/MESSAGE/HYMN/IMPORTED) has no owning song document,
    // so `song` stays `undefined` for them (★ Pitfall 3).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideshowAssembler.ts:429-438`
