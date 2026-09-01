# 0058. Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `render-service/src/render.ts`. Documented at the time in `37-RESEARCH.md`.

Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of an adversarial or pathological .pptx (zip bomb, deeply nested embeds -- 37-RESEARCH.md Pitfall 5).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`render-service/src/render.ts:119-121`:**

```

    // Step 1: PPTX -> PDF. Explicit timeout bounds the DoS blast radius of an adversarial
    // or pathological .pptx (zip bomb, deeply nested embeds -- 37-RESEARCH.md Pitfall 5).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `render-service/src/render.ts:119-121`
