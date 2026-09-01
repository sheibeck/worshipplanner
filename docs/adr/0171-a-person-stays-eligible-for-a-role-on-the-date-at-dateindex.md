# 0171. A person stays eligible for a role on the date at dateIndex ONLY

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/scheduler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

a person stays eligible for a role on the date at `dateIndex` ONLY while their per-role served count is still below the running even-spread target (dateIndex+1)/n — i.e. while they are behind their ideal pace.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/utils/scheduler.ts:117-127`:**

```
  // a person stays eligible for a role on the date at `dateIndex` ONLY while their per-role served
  // count is still below the running even-spread target (dateIndex+1)/n — i.e. while they are
  // behind their ideal pace. This is what spreads a monthly (n=4) person evenly across the WHOLE
  // quarter (weeks 1, 5, 9, 13…) instead of greedily booking them every week until a flat
  // whole-quarter budget runs out and then leaving the rest blank (the front-loading bug: the
  // sole guitarist getting every Sunday in June, then nothing). A simple count ceiling can't do
  // this — the target has to advance with the calendar. WR-02: n<=0 (the drawer's "As-needed
  // (fill-in)" preset writes n:0, and malformed/legacy entries could too) has no valid cadence,
  // so the person is NEVER proactively scheduled — no divide-by-zero into Infinity. Used by BOTH
  // the main assignment loop and propagatePairing so direct picks and pull-ins are spaced
  // identically (no front-loading on either path).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/scheduler.ts:117-127`
