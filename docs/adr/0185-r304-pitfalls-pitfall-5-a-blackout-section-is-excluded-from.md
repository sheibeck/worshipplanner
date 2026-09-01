# 0185. R304 / PITFALLS Pitfall 5: a blackout section is excluded from

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/songSectionOrder.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

R304 / PITFALLS Pitfall 5: a blackout section is excluded from per-kind lyric numbering ENTIRELY — it never consumes a kindOrdinals slot or a numberBySectionId entry, so inserting/duplicating/removing a blackout can neve...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/songSectionOrder.ts:120-129`:**

```

    // R304 / PITFALLS Pitfall 5: a blackout section is excluded from
    // per-kind lyric numbering ENTIRELY — it never consumes a kindOrdinals
    // slot or a numberBySectionId entry, so inserting/duplicating/removing a
    // blackout can never renumber a Verse/Chorus row. Its displayLabel is
    // its own stored label (already unique — minted via addSection's
    // uniqueSectionLabel collision guard), not a derived "Kind N" number.
    // Everything else below (position, occurrenceIndex, isRepeat,
    // repeatOfPosition, rowKey/stableKey) is computed identically to a
    // lyric row — a blackout is a first-class row in the order.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/songSectionOrder.ts:120-129`
