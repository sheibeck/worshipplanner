# 0035. Collapse any CR/LF out of a header-bound value (the email subject)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/inviteOnboarding.ts`. Documented at the time in `99-REVIEW`.

WR-01 (99-REVIEW): collapse any CR/LF out of a header-bound value (the email subject) before it reaches the Resend send.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/inviteOnboarding.ts:78-85`:**

```

/**
 * WR-01 (99-REVIEW): collapse any CR/LF out of a header-bound value (the email
 * subject) before it reaches the Resend send. `orgName` is org-doc-sourced
 * (super-admin controlled) so the risk is low, but this applies the SAME
 * header-injection defense the codebase already documents for the From display
 * name (params.ts's fromDisplayName) consistently to the subject line.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/inviteOnboarding.ts:78-85`
