# 0186. Fetch the distinct people currently serving one of the caller's

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/planningCenterApi.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Fetch the distinct people currently serving one of the caller's selected team positions (D-08/D-09/D-10 — selective import scoped by team AND role/position).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

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

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/planningCenterApi.ts:1182-1193`
