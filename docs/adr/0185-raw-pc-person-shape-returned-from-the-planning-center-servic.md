# 0185. Raw PC person shape returned from the Planning Center Services v2

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `src/utils/planningCenterApi.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Raw PC person shape returned from the Planning Center Services v2 People API. NOTE: Services v2 has no phone-number vertex (RESEARCH.md Pitfall 5 / Assumption A1) — only name fields are read from this endpoint.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/planningCenterApi.ts:1105-1110`:**

```

/**
 * Raw PC person shape returned from the Planning Center Services v2 People API.
 * NOTE: Services v2 has no phone-number vertex (RESEARCH.md Pitfall 5 / Assumption A1) —
 * only name fields are read from this endpoint.
 */
```

**`src/utils/planningCenterApi.ts:1116-1124`:**

```
/**
 * Fetch all people from Planning Center Services v2, following pagination via links.next.
 * Mirrors fetchAllPcSongs's pagination + 429-retry + proxy-URL-rewrite pattern
 * (src/utils/pcSongImport.ts).
 *
 * Do NOT add any phone-number related include or nested resource fetch here — Services v2
 * has no such vertex and it would 404 (RESEARCH.md Pitfall 5 / Assumption A1). Phone is an
 * app-only field (D-14), always set to '' by mapPcPersonToUpsert.
 */
```

**`src/utils/planningCenterApi.ts:1271-1277`:**

```

/**
 * Pure: PC person + its resolved emails → UpsertPersonInput.
 * `phone` is ALWAYS '' — PC Services v2 has no phone vertex (D-14 app-only field,
 * RESEARCH.md Pitfall 5). Standing fields (active/roles) are left to the
 * store's upsert defaults and intentionally omitted here.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/planningCenterApi.ts:1105-1110`
- `src/utils/planningCenterApi.ts:1116-1124`
- `src/utils/planningCenterApi.ts:1271-1277`
