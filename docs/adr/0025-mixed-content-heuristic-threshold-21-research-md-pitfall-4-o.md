# 0025. Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open

## Status

Accepted

## Context

This rationale is applied consistently at 4 call site(s) across 2 files: `functions/src/index.ts`, `functions/src/pptxParser.ts`. Documented at the time in `21-RESEARCH.md`.

Mixed-content heuristic threshold (21-RESEARCH.md Pitfall 4 / Open Question 1): a slide's flattened non-image text must exceed this many characters to be treated as "text-dominant" and win over any images on the same sli...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/index.ts:850-864`:**

```
 *   Firestore read (organizations/{orgId}/members/{uid}) -- the client-declared
 *   orgId is never trusted alone, matching firestore.rules' isOrgMember pattern.
 * - Returns Storage PATHS for extracted images (never signed URLs); the client
 *   resolves getDownloadURL() under storage.rules' org gate.
 * - On any parse failure, throws a friendly HttpsError and never deletes the
 *   source object at storagePath -- this function never issues a delete call
 *   at all, on any path (CONTEXT D004 / 21-RESEARCH.md Pitfall 5).
 * - ★ R062 additive write: on a successful parse, also queues a render by
 *   writing organizations/{orgId}/pptxRenders/{importId} (status "pending").
 *   This write is wrapped in its own nested try/catch and can NEVER fail this
 *   call -- a queue-write failure is swallowed and logged, not surfaced to
 *   the caller, because the parsed text layer above is already a complete,
 *   successful result and a render is only an enhancement over it. This
 *   handler never awaits or imports invokeRenderService; rendering happens
 *   asynchronously via a separate trigger (37-04), never on this onCall path.
```

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

**`functions/src/pptxParser.ts:216-218`:**

```
    // OCR is never enabled -- this phase only needs text/image extraction, and
    // officeparser's OCR path pulls in a heavy tesseract.js dependency for a
    // capability this phase does not use (21-RESEARCH.md Pitfall 3).
```

**`functions/src/pptxParser.ts:251-253`:**

```
          // Custom metadata (not the GCS-reserved top-level fields) -- Phase
          // 22's retention sweep reads this to age out old imports without a
          // follow-up migration (21-RESEARCH.md Pitfall 5).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:850-864`
- `functions/src/pptxParser.ts:44-54`
- `functions/src/pptxParser.ts:216-218`
- `functions/src/pptxParser.ts:251-253`
