# Phase 125 — Firebase Authentication (email-link) Capability Coverage

**Decision date:** 2026-09-05
**Integration:** Firebase Authentication passwordless email-link sign-in (`firebase` 12.0.0 client SDK,
`firebase-admin` 13.10.0 server SDK). No new packages.

INTEGRATE is the default. Every OPT-OUT carries a one-line reason.

| Capability | Tier | Disposition | Reason |
|------------|------|-------------|--------|
| `generateSignInWithEmailLink(email, actionCodeSettings)` (Admin SDK, server-side) | Cloud Function | INTEGRATE | Mints the per-recipient link server-side inside `sendQueuedMessageHandler` and returns a URL string only — lets the link ride the ONE existing Resend email (R375). Plan 125-03. |
| `sendSignInLinkToEmail(auth, email, actionCodeSettings)` (client SDK) | Browser | OPT-OUT | Would fire a SECOND, Firebase-branded email alongside the reminder — exactly the "new email system" R375 forbids. The link is minted server-side instead (see above). |
| `isSignInWithEmailLink(auth, url)` (client SDK) | Browser | INTEGRATE | Guards the `/volunteer/verify` completion route — only proceeds when the URL is a valid sign-in link. Plan 125-04. |
| `signInWithEmailLink(auth, email, url)` (client SDK) | Browser | INTEGRATE | Completes passwordless sign-in and returns a real Firebase uid; includes the documented cross-device email re-entry fallback (R374). Plan 125-04. |
| Session persistence (default `browserLocalPersistence`) | Browser | INTEGRATE | Reuses Firebase Auth's default local persistence + the existing `onAuthStateChanged` in `auth.ts`; the volunteer session survives refresh with no custom session token (R376). Plan 125-04. |
| Sign-out (`signOut` via `auth.ts` `logout()`) | Browser | INTEGRATE | Explicit sign-out from the volunteer surface delegates to the existing `logout()` (R376). Plan 125-04. |
| `ActionCodeSettings` (`url` continue-URL + `handleCodeInApp: true`) | Cloud Function + Browser | INTEGRATE | `url` is a server-constructed, app-controlled `/volunteer/verify` on an authorized domain (open-redirect mitigation, T-125-10); `handleCodeInApp: true` is mandatory for the web link flow. Plans 125-03 / 125-04. |
| Custom auth claims for volunteer identity | Cloud Function | OPT-OUT | Unnecessary — the ID token's `email` claim is present immediately with zero propagation delay; the R377 rule matches on `request.auth.token.email` (no custom-claim plumbing / refresh latency). |
| Firebase Dynamic Links for the continue-URL | — | OPT-OUT | Deprecated/shut down (2025); this web-only app always used a plain hosting continue-URL. Not reached for. |

## Owner prerequisites (tracked, non-code)

- Firebase Console: enable **Email/Password -> Email link (passwordless sign-in)** for `worship-planner-bc515`.
- Firebase Console: add the app hosting domain (the `SERVICE_SHARE_BASE_URL` host) to **Authorized domains**.
- Until both are set, production sign-in fails with `auth/operation-not-allowed` (handled in the UI); the local
  Auth emulator does not require the console toggle.
