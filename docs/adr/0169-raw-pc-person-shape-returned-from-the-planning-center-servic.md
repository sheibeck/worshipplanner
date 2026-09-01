# 0169. Raw PC person shape returned from the Planning Center Services v2

## Status

Accepted

## Context

This rationale is applied at 4 call site(s) within `src/utils/planningCenterApi.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

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

**`src/utils/planningCenterApi.ts:1182-1193`:**

```

/**
 * Fetch the distinct people currently serving one of the caller's selected team positions
 * (D-08/D-09/D-10 — selective import scoped by team AND role/position). Uses the team-scoped
 * `/teams/{teamId}/person_team_position_assignments?include=person` endpoint (NOT the
 * service_type-scoped sibling — RESEARCH.md Pitfall 4) so the included Person resources are
 * returned inline, avoiding an N+1 per-person fetch. Mirrors fetchAllPeople's pagination +
 * 429-retry + proxy-URL-rewrite loop.
 *
 * Choir/orchestra positions are excluded simply by never being in `selectedPositionIds` (D-09).
 * Emails are NOT fetched here — that is Plan 04's concern if/when needed downstream.
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
- `src/utils/planningCenterApi.ts:1182-1193`
- `src/utils/planningCenterApi.ts:1271-1277`
