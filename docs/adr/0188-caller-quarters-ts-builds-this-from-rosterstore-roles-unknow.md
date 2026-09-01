# 0188. Caller (quarters.ts) builds this from rosterStore.roles. Unknown

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/scheduler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other' (safe default) so existing call-sites that omit this param keep compiling and behave as "everything combines" (RESEARCH Pitfall...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/scheduler.ts:96-98`:**

```
  // Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other'
  // (safe default) so existing call-sites that omit this param keep compiling and behave as
  // "everything combines" (RESEARCH Pitfall 1).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/scheduler.ts:96-98`
