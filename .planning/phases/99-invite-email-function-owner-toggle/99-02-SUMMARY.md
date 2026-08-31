---
phase: 99-invite-email-function-owner-toggle
plan: 02
subsystem: functions, email, auth-provisioning
tags: [cloud-function, resend, firebase-auth, R289, R290, R291, R293]
dependency-graph:
  requires:
    - "AppConfig.onboarding.emailsEnabled (server + client mirror, Plan 99-01)"
  provides:
    - "sendInviteOnboardingEmail callable (functions/src/inviteOnboarding.ts)"
    - "sendInviteOnboardingEmailHandler (testable handler body)"
  affects:
    - functions/src/inviteOnboarding.ts
    - functions/src/inviteOnboarding.test.ts
    - functions/src/index.ts
tech-stack:
  added: []
  patterns:
    - "Testable handler + onCall wrapper, re-exported from index.ts (mirrors onboardOrganizationHandler)"
    - "Inline org-editor caller gate (mirrors queueServiceMessageHandler, not a shared helper)"
    - "getUserByEmail/auth-user-not-found discrimination before createUser (mirrors resolveAdminTarget)"
    - "auth/email-already-exists race caught on createUser, falls through to reset-link path"
    - "Two-tier error handling: Auth provisioning failures throw HttpsError('internal'); Resend send is best-effort (emailSent:false)"
key-files:
  created:
    - functions/src/inviteOnboarding.ts
    - functions/src/inviteOnboarding.test.ts
  modified:
    - functions/src/index.ts
decisions:
  - "getUserByEmail failures other than auth/user-not-found are rethrown as-is (mirrors resolveAdminTarget); createUser/generatePasswordResetLink failures are wrapped in HttpsError('internal') since the invitee would otherwise have no usable path"
  - "checkAndConsumeOrgEmailQuota deferred this phase (documented in module header) to avoid the circular-import trap with index.ts, per CONTEXT.md's explicit allowance"
  - "'skipped-existing' kept in the response kind union per the plan's artifact spec but no code path currently returns it (re-inviting an existing address returns 'set-password'/'google-notify' with a fresh send, not a distinct skip) -- available for a future dedup decision"
metrics:
  duration: "~35 minutes"
  completed: 2026-08-31
status: complete
---

# Phase 99 Plan 02: inviteOnboarding.ts handler + tests Summary

Built the server-side `sendInviteOnboardingEmail` Cloud Function: an org-editor-gated callable that
sends a "sign in with Google" notice for gmail/googlemail invitees, or provisions a Firebase Auth
account (`createUser`) plus a `generatePasswordResetLink` set-password email (with a Google fallback
line) for every other invitee, short-circuiting to nothing when the owner's `onboarding.emailsEnabled`
toggle is off.

## What Was Built

**Task 1 -- `functions/src/inviteOnboarding.ts` + re-export:**
- `SendInviteOnboardingEmailRequest { orgId, email }` and `SendInviteOnboardingEmailResponse
  { emailSent, kind }` (`kind: 'google-notify' | 'set-password' | 'skipped-disabled' | 'skipped-existing'`).
- `sendInviteOnboardingEmailHandler(request)`: (1) `unauthenticated` if no `request.auth`; (2)
  validates `orgId`/`email` types and `assertValidEmailFormat` (fresh module-private copy, verbatim
  shape from `orgProvisioning.ts`); (3) inline org-editor caller gate reading
  `organizations/{orgId}/members/{callerUid}.role`, rejecting `permission-denied` if the doc is
  missing or `role !== 'editor'` (mirrors `queueServiceMessageHandler`, the only existing org-editor
  precedent); (4) reads `organizations/{orgId}` for its `name` (`not-found` if absent); (5)
  `getAppConfig(db)` and returns `{ emailSent:false, kind:'skipped-disabled' }` before any Auth or
  Resend call when `onboarding.emailsEnabled` is false; (6) branches on `isGoogleEmail` (gmail.com /
  googlemail.com suffix, case-insensitive on the normalized email) -- Google branch sends a notify-only
  email with zero Auth calls; non-Google branch runs `getUserByEmail` -> (on
  `auth/user-not-found`) `createUser` (catching `auth/email-already-exists` as a race, falling through)
  -> `generatePasswordResetLink` -> Resend send.
- Fresh module-private `resolveAppBaseUrl` (verbatim shape from `adminEmail.ts`) and content builders
  `buildGoogleNotifyContent`/`buildSetPasswordContent` (new -- `adminEmail.ts`'s builders are
  module-private and were not imported, per RESEARCH Pitfall 5). The set-password copy includes the
  reset link and an explicit "you can sign in with Google instead" fallback line (CONTEXT.md
  requirement, so a Google Workspace user on a custom domain is never stranded).
- Error tiers: a `createUser`/`generatePasswordResetLink` failure throws `HttpsError('internal', ...)`
  with a `[inviteOnboarding]` `console.error` (the invitee would otherwise have no usable path at all);
  a `getUserByEmail` failure that isn't `auth/user-not-found` is rethrown as-is (mirrors
  `resolveAdminTarget`); only the final Resend send is best-effort, caught and resolved as
  `{ emailSent:false, kind }`.
- `sendInviteOnboardingEmail = onCall({ secrets: [RESEND_API_KEY] }, sendInviteOnboardingEmailHandler)`.
- `functions/src/index.ts`: added `import { sendInviteOnboardingEmail } from "./inviteOnboarding"` and
  `export { sendInviteOnboardingEmail }` next to the existing `orgProvisioning` re-export block, with a
  comment documenting the "not re-exported -> firebase deploy fails" gotcha.

**Task 2 -- `functions/src/inviteOnboarding.test.ts`:**
- A path-addressable `FakeFirestore` (mirrors `orgProvisioning.test.ts`'s pattern) serving
  `organizations/{orgId}/members/{uid}`, `organizations/{orgId}`, and `appConfig/global`. Uses the
  REAL `getAppConfig` (not mocked) with `resetAppConfigCacheForTest()` in `beforeEach` so the 60s TTL
  cache never bleeds a prior test's `onboarding.emailsEnabled` value between cases.
- Mocked `getAuth()` returning fresh `getUserByEmail`/`createUser`/`generatePasswordResetLink`
  `vi.fn()`s (no prior mock precedent for the latter two -- added new) and mocked `resend`/
  `firebase-functions/params` (mirrors `adminEmail.test.ts`'s seams).
- 15 tests across 6 groups: "caller gate" (unauthenticated, non-member, viewer-role -- all rejected
  before any Resend call), "disabled" (`emailsEnabled=false` returns `skipped-disabled`, asserts
  `getUserByEmail`/`createUser`/`emails.send` never called), "google" (`Bob@GMAIL.com` and
  `x@googlemail.com`, `createUser` never called, `kind:'google-notify'`), "set-password / createUser"
  (new-user provisioning, existing-user skip-create, `auth/email-already-exists` race falls through
  with no throw, a non-race `createUser` error and a `generatePasswordResetLink` error both throw
  `HttpsError('internal')`, a non-`user-not-found` `getUserByEmail` error rethrows as-is, a Resend send
  failure after Auth succeeded resolves `emailSent:false` with no throw), and "email format" (empty /
  no-`@` -> `invalid-argument`). Asserts the set-password email text contains the generated reset link
  and mentions Google as a fallback.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `cd functions && npm run build` (tsc) -- clean, no errors
- Forbidden-import grep: no `buildInvitedContent`/`buildAddedContent`/`resolveAppBaseUrl`-from-adminEmail
  import, no `checkAndConsumeOrgEmailQuota` import from `./index` (only a documenting comment mentions
  the deferral) -- both trap imports confirmed absent
- `npx vitest run functions/src/inviteOnboarding.test.ts` -- 15/15 passed
- `npx vitest run functions/src/appConfig.test.ts` -- 32/32 passed (R293 fail-closed regression clean)
- `npm run type-check` (vue-tsc --build) -- clean, no new errors
- Wave-merge / phase gate: bare `npx vitest run` -- 173/174 files passed, 4710 tests passed, 26 skipped;
  the single failing file is the documented `src/storage.rules.test.ts` baseline
  (`ECONNREFUSED 127.0.0.1:8080` -- no Storage emulator running locally), exactly matching CLAUDE.md's
  documented baseline. No regression introduced.

## Known Stubs

None.

## Threat Flags

None -- this plan's threat model (T-99-01 through T-99-06, T-99-SC) covers exactly the surface built:
the org-editor caller gate (T-99-01), email-format validation (T-99-02), the reused `fromDisplayName`
header sanitizer (T-99-03), the existing `SERVICE_SHARE_BASE_URL` authorized-domain (T-99-04, accepted),
the deferred per-org quota (T-99-05, accepted, documented in the module header), and the
`auth/email-already-exists` race catch (T-99-06). No new packages installed (T-99-SC).

## Self-Check: PASSED

- FOUND: functions/src/inviteOnboarding.ts
- FOUND: functions/src/inviteOnboarding.test.ts
- FOUND: .planning/phases/99-invite-email-function-owner-toggle/99-02-SUMMARY.md
- FOUND commit: 89a32cc1 (Task 1)
- FOUND commit: c4409e8f (Task 2)
