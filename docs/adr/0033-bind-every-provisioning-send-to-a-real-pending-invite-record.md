# 0033. Bind every provisioning + send to a REAL pending invite record

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/inviteOnboarding.ts`. Documented at the time in `99-REVIEW`.

CR-01 (99-REVIEW): bind every provisioning + send to a REAL pending invite record.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`functions/src/inviteOnboarding.ts:202-211`:**

```

  // CR-01 (99-REVIEW): bind every provisioning + send to a REAL pending invite
  // record. This callable creates Firebase Auth accounts and emails
  // caller-supplied addresses; without this gate an org editor could invoke it
  // directly with attacker-chosen emails to send convincing "invited to {org}"
  // messages -- carrying genuine password-reset links -- to arbitrary third
  // parties from our own Resend sending domain. TeamView.onInvite writes the
  // authoritative invite doc (same trim().toLowerCase() normalization) BEFORE
  // calling this function, so the doc's absence means this is not a legitimate
  // invite send. Ties the blast radius to invites the org actually created.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/inviteOnboarding.ts:202-211`
