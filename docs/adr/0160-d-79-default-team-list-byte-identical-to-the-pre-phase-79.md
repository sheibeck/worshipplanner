# 0160. D-79 default team list — byte-identical to the pre-Phase-79

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/types/team.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

D-79 default team list — byte-identical to the pre-Phase-79 hard-coded `['Choir', 'Orchestra', 'Communion', 'Special']` so existing orgs (Berean) see the same team names in the checkboxes on first load post-deploy (RESEA...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/types/team.ts:20-25`:**

```

// D-79 default team list — byte-identical to the pre-Phase-79 hard-coded
// `['Choir', 'Orchestra', 'Communion', 'Special']` so existing orgs (Berean)
// see the same team names in the checkboxes on first load post-deploy
// (RESEARCH Pitfall 4). DEFAULT_TEAMS omits `id` (assigned by Firestore on
// seed).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/types/team.ts:20-25`
