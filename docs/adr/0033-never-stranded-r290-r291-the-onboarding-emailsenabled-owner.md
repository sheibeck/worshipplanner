# 0033. Never stranded (R290, R291). The onboarding.emailsEnabled owner

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/inviteOnboarding.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

never stranded (R290, R291). The onboarding.emailsEnabled owner toggle (Plan 99-01) is read via the existing TTL-cached getAppConfig(db) and gates BOTH branches before any Auth or Resend call (R293).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/inviteOnboarding.ts:32-43`:**

```
//    never stranded (R290, R291).
//
// The onboarding.emailsEnabled owner toggle (Plan 99-01) is read via the
// existing TTL-cached getAppConfig(db) and gates BOTH branches before any
// Auth or Resend call (R293).
//
// DEFERRED (RESEARCH Pitfall 1): the per-org email quota
// (checkAndConsumeOrgEmailQuota) is NOT folded in here -- it lives in
// index.ts, which already imports this module for its re-export, so
// importing it back would be a circular import. Left as a documented future
// lever (see the threat register's T-99-05, disposition "accept").
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/inviteOnboarding.ts:32-43`
