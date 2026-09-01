# 0196. Retained-but-unresolvable entries — kept relative to each other

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slideGroupMaterializer.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Retained-but-unresolvable entries — kept relative to each other, appended after the resolvable run and before the trailing copyright (Pitfall 4).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/slideGroupMaterializer.ts:735-737`:**

```

  // Retained-but-unresolvable entries — kept relative to each other, appended
  // after the resolvable run and before the trailing copyright (Pitfall 4).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slideGroupMaterializer.ts:735-737`
