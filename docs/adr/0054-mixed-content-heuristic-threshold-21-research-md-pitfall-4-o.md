# 0054. Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/pptxParser.ts`. Documented at the time in `21-RESEARCH.md`.

Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open Question 1): a slide's flattened non-image text must exceed this many characters to be treated as "text-dominant" and win over any images on the same sli...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/pptxParser.ts:44-54`:**

```

/**
 * Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open Question 1):
 * a slide's flattened non-image text must exceed this many characters to be
 * treated as "text-dominant" and win over any images on the same slide. Chosen
 * against the real mixed.pptx fixture deck (21-03): short image captions/alt
 * text and single-line titles observed there run well under 40 characters,
 * while genuine body/bullet content reliably exceeds it. Below this threshold,
 * a slide with image children maps to image slide(s) instead; the import
 * preview (21-05) is the user's manual escape hatch for any mis-mapped slide.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/pptxParser.ts:44-54`
