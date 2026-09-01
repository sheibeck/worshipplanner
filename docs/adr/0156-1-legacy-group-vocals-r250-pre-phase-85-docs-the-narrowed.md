# 0156. 1. Legacy group 'vocals' (R250, pre-Phase-85 docs) — the narrowed

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/roster.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

1. Legacy group 'vocals' (R250, pre-Phase-85 docs) — the narrowed RoleGroup dropped 'vocals' as a team identity; existing docs may still carry it and are coerced to group 'band' here. 2.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/stores/roster.ts:70-82`:**

```
      //   1. Legacy group 'vocals' (R250, pre-Phase-85 docs) — the narrowed RoleGroup dropped
      //      'vocals' as a team identity; existing docs may still carry it and are coerced to
      //      group 'band' here.
      //   2. Legacy field name `vocal` (Phase-85/88 docs persisted before the R259 rename) —
      //      docs on disk still carry `vocal`, not `multiRole`, since there is no data
      //      migration; every role (not just the vocals-group branch) must map it or a live
      //      pre-Phase-89 role would silently lose its flag (RESEARCH Pitfall R1).
      // Branch-specific defaulting (R259 — the plan-checker BLOCKER fix):
      //   - vocals-group branch: (data.multiRole ?? data.vocal ?? true) === true — the `?? true`
      //     preserves the pre-existing `vocal: data.vocal ?? true` default so a pre-Phase-85
      //     legacy vocals doc with NEITHER field still surfaces as multiRole:true.
      //   - default branch: (data.multiRole ?? data.vocal) === true — NO `?? true`; a
      //     non-vocals role with neither field is multiRole:false.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/roster.ts:70-82`
