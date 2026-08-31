---
phase: 100-invite-login-onboarding-wiring
plan: 01
subsystem: auth
tags: [firebase-functions, httpsCallable, vue, vitest]

requires:
  - phase: 99-invite-email-function-owner-toggle
    provides: the sendInviteOnboardingEmail Cloud Function returning { emailSent, kind }
provides:
  - TeamView.onInvite calls sendInviteOnboardingEmail (best-effort) after the authoritative invite batch commits
  - Honest, result-driven invitedFeedback copy across three states (sent / emails-disabled / send-failed)
  - LoginView actionable auth/operation-not-allowed error message
  - LoginView discoverability hint for invitees on the sign-in form
affects: []

tech-stack:
  added: []
  patterns:
    - "Best-effort side-call after an authoritative write: primary Firestore batch.commit() completes first, then a SEPARATE nested try/catch calls the Cloud Function; the catch only logs, never rethrows, never reverts the primary write."
    - "Locally-declared callable Req/Resp types in the calling component (not imported from functions/, a separate build target) — mirrors OrganizationsTab.vue's convention."

key-files:
  created:
    - src/views/__tests__/LoginView.test.ts
  modified:
    - src/views/TeamView.vue
    - src/views/LoginView.vue
    - src/views/__tests__/TeamView.test.ts

key-decisions:
  - "Callable invocation placed strictly AFTER writeBatch(db).commit() succeeds, in its own nested try/catch, so the invite is R294-authoritative and the email send can never block or revert it."
  - "invitedFeedback now holds the FULL sentence (was a bare email string); the template renders only {{ invitedFeedback }} with no hardcoded trailing copy."
  - "SendInviteOnboardingEmailResponse.kind is the real four-member union from functions/src/inviteOnboarding.ts (including 'skipped-existing'), confirmed by reading the source rather than trusting 100-PATTERNS.md's three-member draft."

patterns-established:
  - "Best-effort side-effect after an authoritative write (see tech-stack.patterns above) — first instance of this shape in the codebase; future best-effort side-calls should follow the same nested try/catch discipline."

requirements-completed: [R288, R292, R294]

coverage:
  - id: D1
    description: "Inviting a team member calls sendInviteOnboardingEmail after the invite batch commits, and invitedFeedback shows the correct copy for all three result states (sent, emails-disabled, callable-failed)."
    requirement: "R288"
    verification:
      - kind: unit
        ref: "src/views/__tests__/TeamView.test.ts#onInvite → sendInviteOnboardingEmail (mounted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rejected/unreachable callable never reverts the invite or surfaces inviteError; isInviting clears regardless."
    requirement: "R294"
    verification:
      - kind: unit
        ref: "src/views/__tests__/TeamView.test.ts#shows the send-failed copy and does NOT surface inviteError when the callable rejects (R294)"
        status: pass
    human_judgment: false
  - id: D3
    description: "LoginView maps auth/operation-not-allowed to an actionable admin-enable message and shows a discoverability hint on the sign-in form (hidden on the reset form)."
    requirement: "R292"
    verification:
      - kind: unit
        ref: "src/views/__tests__/LoginView.test.ts#maps auth/operation-not-allowed to the actionable admin-enable message"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/LoginView.test.ts#shows a discoverability hint on the sign-in form (showForgotPassword false)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/LoginView.test.ts#hides the discoverability hint once the reset form is shown"
        status: pass
    human_judgment: false
  - id: D4
    description: "Google sign-in, loginWithEmail's auto-create behavior, and ensureUserDocument are unchanged; existing LoginView error mappings still return their original strings."
    requirement: "R294"
    verification:
      - kind: unit
        ref: "src/views/__tests__/LoginView.test.ts#leaves existing error mappings unchanged (regression guard)"
        status: pass
      - kind: other
        ref: "npx vitest run (full baseline) -- 174/175 files pass, 4719 tests pass, only known src/storage.rules.test.ts failure"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-31
status: complete
---

# Phase 100 Plan 01: Invite & Login Onboarding Wiring Summary

**TeamView.onInvite now calls Phase 99's sendInviteOnboardingEmail callable (best-effort, after the authoritative Firestore batch commit) with honest three-state copy, and LoginView gains an actionable auth/operation-not-allowed message plus an invitee discoverability hint.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-31T04:16:00Z
- **Completed:** 2026-08-31T04:29:00Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `TeamView.onInvite` calls `httpsCallable(functions, 'sendInviteOnboardingEmail')` immediately after `batch.commit()` succeeds, inside its own nested try/catch that only logs — the authoritative invite/inviteLookup docs are never reverted by an email failure.
- `invitedFeedback` now branches on the callable's `{ emailSent, kind }` result (or its absence, on error) into the exact three UI-SPEC strings: "Invite email sent to {email}.", the emails-off message, and the send-failed message.
- `LoginView.mapFirebaseError` gained a `case 'auth/operation-not-allowed'` returning the actionable admin-enable message, and the sign-in form now shows a one-line hint directing invitees to the emailed link or the reset flow.
- New mounted TeamView test block (name-keyed `httpsCallable` mock + inert `firebase/firestore` stubs) proves the three copy states and the R294 resilience guarantee (rejected callable → no `inviteError`, batch still committed).
- New `LoginView.test.ts` (didn't exist before) covers the new error mapping, a regression guard on an existing mapping, and hint presence/absence tied to `showForgotPassword`.

## Task Commits

1. **Task 1: Wire TeamView.onInvite to sendInviteOnboardingEmail (best-effort) with honest copy** - `30588a75` (feat)
2. **Task 2: LoginView — add auth/operation-not-allowed error + discoverability hint** - `ae360577` (feat)
3. **Task 3: Tests — mounted TeamView copy/resilience block + new LoginView.test.ts** - `3327c296` (test)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/views/TeamView.vue` - `onInvite` calls the callable after batch.commit(), local Req/Resp types, three-state invitedFeedback copy; template renders only `{{ invitedFeedback }}`
- `src/views/LoginView.vue` - new `auth/operation-not-allowed` case in `mapFirebaseError`; new discoverability `<p>` hint inside the sign-in (`!showForgotPassword`) branch
- `src/views/__tests__/TeamView.test.ts` - new mounted `describe` block (harness: name-keyed `httpsCallable` mock, inert `firebase/firestore` mock, `@/stores/auth` mock) with 3 tests
- `src/views/__tests__/LoginView.test.ts` - new file, 4 tests (error mapping, regression guard, hint present, hint absent on reset form)

## Decisions Made
- Confirmed `SendInviteOnboardingEmailResponse.kind` is the real 4-member union (`'google-notify' | 'set-password' | 'skipped-disabled' | 'skipped-existing'`) by reading `functions/src/inviteOnboarding.ts:49-52` directly, since 100-PATTERNS.md's draft only listed 3 members — the plan's own task instructions flagged this and the code matches the plan, not the pattern doc's shorthand.
- Kept the nested try/catch's failure branch collapsed to a single "else" (covers both a thrown error AND any non-`emailSent` kind other than `skipped-disabled`, e.g. `skipped-existing`) per the plan's explicit instruction, rather than adding a 4th UI branch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (Owner prerequisites — Email/Password provider, Resend DNS, onboarding-emails toggle — are deferred to milestone end per 100-CONTEXT.md, not required for this plan's code or tests.)

## Next Phase Readiness
- Phase 100 was the only remaining phase in milestone v2.5; both requirements-bearing plans (99, 100) are now implemented and tested.
- `npm run type-check` clean; `npx vitest run src/views` 15/15 passing; full baseline `npx vitest run` shows only the known `src/storage.rules.test.ts` failure (174/175 files, 4719/4745 tests passing, 26 skipped) — no regressions introduced.
- No deploy performed in this plan (autonomous mode); Functions/hosting deploy remains an owner-confirmed action per the standing 2026-08-25 deploy policy.

---
*Phase: 100-invite-login-onboarding-wiring*
*Completed: 2026-08-31*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit hashes (30588a75, ae360577, 3327c296) verified present in git log.
