# 0207. Mirror the bareInt branch's > 0 guard — "1-in-0" (and any other

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/volunteerCsv.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-03: mirror the bareInt branch's `> 0` guard — "1-in-0" (and any other non-positive N) must fall through to the same default-4 path as an invalid bare integer, never accepted as a literal 0 (which would produce an Infi...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/utils/volunteerCsv.ts:52-55`:**

```

  // WR-03: mirror the bareInt branch's `> 0` guard — "1-in-0" (and any other non-positive N)
  // must fall through to the same default-4 path as an invalid bare integer, never accepted
  // as a literal 0 (which would produce an Infinity deficit score in scheduler.ts).
```

**`src/utils/volunteerCsv.ts:111-113`:**

```
  // WR-03: a "1-in-N" cell only counts as a known/recognized label when N is actually a
  // positive integer — "1-in-0" must surface the same unrecognized/defaulted warning as an
  // invalid bare integer, not be silently accepted as N=0.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/volunteerCsv.ts:52-55`
- `src/utils/volunteerCsv.ts:111-113`
