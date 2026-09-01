# 0057. TeamsStore.subscribe()'s onSnapshot is async, so if the dialog

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/NewServiceDialog.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-1: `teamsStore.subscribe()`'s `onSnapshot` is async, so if the dialog mounts/opens before the first snapshot lands, the calls above compute zero matches against an empty `teamsStore.teams`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-1`):

**`src/components/NewServiceDialog.vue:210-219`:**

```

// WR-1: `teamsStore.subscribe()`'s `onSnapshot` is async, so if the dialog
// mounts/opens before the first snapshot lands, the calls above compute zero
// matches against an empty `teamsStore.teams`. `onSnapshot` always REASSIGNS
// `teams.value` to a brand-new array on every emission (see teams.ts), so a
// plain (non-deep) watch on the array reference fires once the real snapshot
// arrives, recomputing auto-select for the CURRENT form date. Guarded to
// `props.open` so it can't fight a manual toggle before the dialog is even
// shown; `applyRecurrenceAutoSelect` itself already skips
// `manuallyTouchedTeams`, so a team the planner has already unchecked stays
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/NewServiceDialog.vue:210-219`
