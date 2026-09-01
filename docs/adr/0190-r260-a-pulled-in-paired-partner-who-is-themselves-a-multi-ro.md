# 0190. R260 — a pulled-in paired partner who is themselves a multi-role

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/scheduler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

R260 — a pulled-in paired partner who is themselves a multi-role holder also bundles their own other multi-roles onto this date (RESEARCH Open Question 1: implement the consistent version).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/scheduler.ts:236-241`:**

```
        // Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted):
        // this gate only constrains pull-ins via propagation. If the partner independently holds
        // a role the anchor does not, the main loop's spacing pass could in principle still pick
        // the partner directly on a date the anchor isn't serving at all, which a maximally strict
        // reading of containment would forbid. The canonical pairing shape (co-vocalists /
        // parent-child sharing the same role) does not hit this edge case, so it's shipped as-is.
```

**`src/utils/scheduler.ts:247-250`:**

```
        // R260 — a pulled-in paired partner who is themselves a multi-role holder also bundles
        // their own other multi-roles onto this date (RESEARCH Open Question 1: implement the
        // consistent version). Composes cleanly since propagateMultiRole is independent per
        // person (RESEARCH Pitfall 4).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/scheduler.ts:236-241`
- `src/utils/scheduler.ts:247-250`
