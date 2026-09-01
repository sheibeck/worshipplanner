# 0055. OCR is never enabled -- this phase only needs text/image extraction

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/pptxParser.ts`. Documented at the time in `21-RESEARCH.md`.

OCR is never enabled -- this phase only needs text/image extraction, and officeparser's OCR path pulls in a heavy tesseract.js dependency for a capability this phase does not use (21-RESEARCH.md Pitfall 3).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/pptxParser.ts:216-218`:**

```
    // OCR is never enabled -- this phase only needs text/image extraction, and
    // officeparser's OCR path pulls in a heavy tesseract.js dependency for a
    // capability this phase does not use (21-RESEARCH.md Pitfall 3).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/pptxParser.ts:216-218`
