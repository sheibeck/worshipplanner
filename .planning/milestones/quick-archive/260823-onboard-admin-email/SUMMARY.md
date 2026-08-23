---
status: complete
type: feature
deploy: hand-over
date: 2026-08-23
subsystem: functions/orgProvisioning
---

# Quick Task 260823: Onboard-Admin Notification Email

When a super-admin onboards a new church (`onboardOrganization`), the assigned
admin now receives a best-effort notification email via the existing Resend
system. Functions-only change — the client sees nothing new.

## What changed

**New `functions/src/adminEmail.ts`** — a reusable helper
`sendAdminOnboardingEmail({ db, to, orgName, kind })` where `kind` is
`'added' | 'invited'`:
- Reads the From address live via `getAppConfig(db)` -> `config.sender.fromAddress`,
  and builds `from` as `"<orgName>" <bareEmailAddress(fromAddress)>` — reusing the
  exact `bareEmailAddress` (peels a legacy `Name <email>` so brackets never nest)
  and `fromDisplayName` (strips CR/LF + quotes -> header-injection-safe) helpers.
- `new Resend(RESEND_API_KEY.value())` -> `resend.emails.send({ from, to, subject, text })`.
- Copy: **added** -> subject `You've been added as an admin to {orgName}`, body invites
  them to sign in; **invited** -> subject `You've been invited to {orgName} on Worship
  Planner`, body tells them to sign in WITH THIS EMAIL. The app link is drawn from
  `SERVICE_SHARE_BASE_URL`; a blank base is omitted gracefully (no broken URL / no
  `undefined`).
- Resolves on success; **throws** on send failure so the caller can record `emailSent: false`.

**New `functions/src/params.ts`** — a dependency-free shared module (imports only
`firebase-functions/params`). To avoid a circular import (`index.ts` imports
`orgProvisioning.ts`, which now needs the secret), `RESEND_API_KEY`,
`SERVICE_SHARE_BASE_URL`, and the pure `bareEmailAddress` / `fromDisplayName` helpers
**moved here verbatim** from `index.ts`. `index.ts` now imports and re-exports all four,
so its public surface is unchanged and its single `secrets: [RESEND_API_KEY]` binding
(on `sendQueuedMessage`) is preserved.

**`functions/src/orgProvisioning.ts`:**
- `onboardOrganization`'s `onCall(...)` gained `{ secrets: [RESEND_API_KEY] }` (it had none).
- After `runTransaction` commits (never inside it), `sendAdminOnboardingEmail(...)` is
  called in a try/catch — **email failure never fails onboarding** (the org already
  exists); the error is logged and swallowed. `target.kind` maps `'existing'->'added'`,
  otherwise `'invited'`.
- `OnboardOrganizationResponse` gained `emailSent: boolean` (true iff the send resolved).
  The existing `{ status, orgId, name }` shape is unchanged — the field is additive.

**Tests:**
- `functions/src/orgProvisioning.test.ts` — mocks `./adminEmail` at the module seam;
  asserts onboarding fires the email with the right `to`/`orgName`/`kind` for BOTH the
  existing-account (`added`) and no-account (`invited`) paths, and that a send rejection
  does NOT throw out of onboarding (org still created, `emailSent:false`).
- `functions/src/adminEmail.test.ts` (new) — unit-tests the REAL From/subject/body
  construction (mirrors `index.test.ts`'s Resend + `firebase-functions/params` mocking):
  from-header, subject per kind, sign-in-with-this-email copy, blank-base-URL graceful
  omission, legacy decorated-address peeling, CR/LF/quote header-injection sanitization,
  and send-rejection propagation.

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| Functions build (tsc) | `cd functions && npm run build` | PASS (exit 0) |
| Functions suite | `cd functions && npx vitest run` | PASS — 553 tests, 16 files |
| Root type-check | `npm run type-check` (vue-tsc --build) | PASS |
| App suite | `npx vitest run` | At baseline — only the 2 documented known-failing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`); no new failures. 4118 passed. |

## Deploy — HAND-OVER (do NOT deploy from here)

`onboardOrganization` now carries the `RESEND_API_KEY` secret binding, so it must be
redeployed for the email to send:

    firebase deploy --only functions:onboardOrganization

No secret writes were made — `RESEND_API_KEY` stays a server-side `defineSecret` (now
in `params.ts`); it was never moved into a client-readable doc or `.env`.

## Known delivery caveat (backlog 999.6)

`DEFAULT_APP_CONFIG.sender.fromAddress` is `onboarding@resend.dev` (Resend's test
sender), which only delivers to the Resend account owner until a real domain is verified
and set as the no-reply sender (v1.9 R191/R192). This task builds the SEND PATH; real
delivery to arbitrary admins still awaits that domain verification.

## Notes

- `assignOrgAdmin` was deliberately NOT changed (owner scoped this to onboarding). The
  helper is generic (`kind: 'added' | 'invited'`), so wiring it into `assignOrgAdmin`
  later is a trivial one-line, post-commit best-effort call — a future add.

## Self-Check: PASSED
- Created: `functions/src/adminEmail.ts`, `functions/src/adminEmail.test.ts`, `functions/src/params.ts` — all present.
- Modified: `functions/src/index.ts`, `functions/src/orgProvisioning.ts`, `functions/src/orgProvisioning.test.ts`.
- Pre-existing unrelated `functions/package.json` / `functions/package-lock.json` changes left OUT of the commit.
