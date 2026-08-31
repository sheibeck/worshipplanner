# Phase 99 — API Coverage Matrix

**Policy:** Full API Coverage by Default — Opt Out, Never Opt In.
**Detector:** `api-coverage.cjs --json` over the phase scope reports `detected: true`
(signals: `integrates` + `sdk`; `Firebase Admin Auth SDK`).
**External APIs integrated this phase:**
1. **Firebase Admin Auth SDK** (`firebase-admin/auth` — `getAuth()`)
2. **Resend SDK** (`resend` — transactional email)

Every capability of each integrated surface is enumerated below. `INTEGRATE` is the
default; each `OPT-OUT` carries a one-line reason. No new packages are installed
(RESEARCH.md Package Legitimacy Audit: all three deps pre-exist, no version change).

| capability | decision | reason |
|------------|----------|--------|
| Firebase Admin Auth: getUserByEmail | INTEGRATE | Discriminate existing-vs-new invitee before provisioning (R291) |
| Firebase Admin Auth: createUser | INTEGRATE | Provision a sign-in account for a brand-new non-Google invitee (R291) |
| Firebase Admin Auth: generatePasswordResetLink | INTEGRATE | Produce the secure "set your password" link emailed to non-Google invitees (R290) |
| Firebase Admin Auth: generateEmailVerificationLink | OPT-OUT | No separate email-verify step in scope; the set-password reset link is the only action link this phase sends |
| Firebase Admin Auth: generateSignInWithEmailLink | OPT-OUT | Passwordless/magic-link flow explicitly rejected by owner (root-cause doc); set-password path is the chosen mechanism |
| Firebase Admin Auth: updateUser | OPT-OUT | Invite-time provisioning creates an account with only an email; no profile/password mutation of existing users needed |
| Firebase Admin Auth: deleteUser | OPT-OUT | Provisioning is additive; this function never removes accounts |
| Firebase Admin Auth: setCustomUserClaims | OPT-OUT | Org membership is Firestore-doc-backed here (`members/{uid}.role`), not custom-claim; claim-backed membership is a separate deferred requirement |
| Firebase Admin Auth: listUsers | OPT-OUT | Single-address lookup only; no bulk enumeration (and enumeration is an abuse vector this phase actively guards against) |
| Firebase Admin Auth: revokeRefreshTokens | OPT-OUT | No session/token invalidation in the invite-onboarding flow |
| Firebase Admin Auth: importUsers | OPT-OUT | One interactive invite per call; no bulk import |
| Firebase Admin Auth: verifyIdToken / createCustomToken | OPT-OUT | Caller identity arrives via the callable's `request.auth`; no manual token minting/verification needed |
| Resend: emails.send | INTEGRATE | Send the single onboarding email (notify-only or set-password) per invite (R289, R290) |
| Resend: emails.send (batch) / batch.send | OPT-OUT | Exactly one recipient per invite invocation; no batching |
| Resend: emails.get / emails.cancel / emails.update | OPT-OUT | Fire-and-forget best-effort send; no post-send lifecycle management in scope |
| Resend: domains.* | OPT-OUT | Resend DNS domain verification is owner-run ops (functions/DEPLOY-EMAIL-DOMAIN.md, backlog 999.6), not application code |
| Resend: apiKeys.* | OPT-OUT | The Resend key is managed via Google Secret Manager (`RESEND_API_KEY`), never programmatically |
| Resend: contacts.* / audiences.* | OPT-OUT | No marketing-list/contact management; this is transactional onboarding mail |
| Resend: broadcasts.* | OPT-OUT | No bulk campaign sending |

**Decided:** yes — every capability above has an explicit INTEGRATE/OPT-OUT disposition.
