# Phase 100: Invite & Login Onboarding Wiring - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (decisions auto-applied from owner's milestone defaults + existing codebase patterns; owner deferred validation to milestone end).

<domain>
## Phase Boundary

Wire Phase 99's `sendInviteOnboardingEmail` Cloud Function into the app so inviting a teammate actually
sends the right onboarding email, and make the login screen usable for an invited person. Three pieces:
1. **TeamView.onInvite** calls the function (best-effort) after writing the authoritative invite docs, and
   shows honest copy based on the result.
2. **LoginView** gets a discoverable set/reset-password affordance + a real `auth/operation-not-allowed`
   error message (instead of the generic "Sign-in failed").
3. **Non-regression:** Google sign-in and the existing invite-acceptance path (`ensureUserDocument`) keep
   working, and an email-send failure never blocks/reverts the invite.

**In scope:** `src/views/TeamView.vue` (onInvite call + copy), `src/views/LoginView.vue` (discoverability +
error mapping), tests. **Out of scope:** the function itself (Phase 99, done); ripping out
`loginWithEmail`'s existing auto-create-on-sign-in behavior (R294 keeps existing flows unchanged).
</domain>

<decisions>
## Implementation Decisions

### TeamView invite wiring (R288, R294)
- After the existing `writeBatch(db)` commit (which writes `organizations/{orgId}/invites/{email}` +
  `inviteLookup/{email}` — the AUTHORITATIVE membership record, unchanged), call the function:
  `httpsCallable<{orgId,email},{emailSent,kind}>(functions, 'sendInviteOnboardingEmail')({ orgId, email: normalized })`
  — mirroring `OrganizationsTab.vue`'s `httpsCallable(functions, 'onboardOrganization')` pattern
  (`functions` imported from `@/firebase`).
- **R294 — email is best-effort, membership is authoritative:** wrap the call in its OWN try/catch. A
  rejected/failed function call is logged and swallowed — it must NEVER surface as an invite failure or
  revert the already-committed invite docs. `isInviting` cleared in `finally`.
- **Honest, result-driven success copy** (replaces the interim "no email is sent" stopgap): branch on the
  function's returned `{ emailSent, kind }` (and on a call error):
  - `emailSent === true` (`set-password` or `google-notify`) → "Invite email sent to {email}."
  - `kind === 'skipped-disabled'` → "{email} added — onboarding emails are turned off, so let them know to
    sign in with this address." (owner toggle from Phase 99 is OFF by default)
  - call threw → "{email} added — we couldn't send the invite email, so let them know to sign in with this
    address." (invite still recorded)
- The invite must still succeed end-to-end even if the function is undeployed/unreachable (same resilience
  posture as `OrganizationsTab`'s comment about undeployed targets).

### LoginView discoverability + error handling (R292)
- **`auth/operation-not-allowed`:** add a case to `mapFirebaseError` returning an actionable message, e.g.
  "Email/password sign-in isn't enabled for this app yet — ask your administrator to enable it." (This is
  the compounding secondary cause the debug flagged when the Firebase Email/Password provider is OFF.)
- **Discoverability:** the "Forgot password?" reset flow already exists (`showForgotPassword` →
  `handleForgotPassword` → `authStore.resetPassword` → `sendPasswordResetEmail`). Make it serve the
  first-time invitee too: add a short helper line near the email/password form or the Forgot-password
  affordance, e.g. "Invited by email? Open the link we sent to set your password — or reset it here."
  Minimal copy; no new flow. Exact wording is Claude's discretion.
- **Do NOT remove** `loginWithEmail`'s auto-create-on-`user-not-found`/`invalid-credential` behavior — R294
  keeps existing flows unchanged; Phase 99's emailed set-password link is now the primary discoverable path,
  but the legacy behavior stays as a harmless fallback.

### Non-regression & safety (R294)
- Google sign-in (`loginWithGoogle`) and `ensureUserDocument` (invite acceptance on first authenticated
  sign-in) are UNTOUCHED — the invite docs TeamView writes are exactly what `ensureUserDocument` reads.
- Membership write precedes and is independent of the best-effort email call.

### Claude's Discretion
- Exact copy wording; whether the LoginView hint is a helper line vs a relabel; the precise TypeScript
  types for the callable; test structure. All within the decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/admin/OrganizationsTab.vue:199-200,469-485`** — the canonical client `httpsCallable`
  pattern: `import { httpsCallable } from 'firebase/functions'`, `import { functions } from '@/firebase'`,
  `const fn = httpsCallable<Req,Resp>(functions, 'name'); const r = await fn(args)`, wrapped in try/catch;
  includes the "undeployed target does not block this plan" resilience note.
- **`src/views/TeamView.vue:238-301`** — `onInvite`: validates + dedups, `writeBatch` writes invite +
  lookup docs, `batch.commit()`, sets `invitedFeedback`, `isInviting` in finally. The call site to extend.
- **`src/views/LoginView.vue`** — `mapFirebaseError(code)` switch (~line 180), the sign-in form,
  `showForgotPassword`/`handleForgotPassword` reset flow (~line 230), `loginWithEmail`/`loginWithGoogle`.
- **`src/stores/auth.ts:813-841`** — `loginWithEmail` (auto-creates on user-not-found/invalid-credential),
  `resetPassword` (`sendPasswordResetEmail`). Leave unchanged.
- **`functions/src/inviteOnboarding.ts`** — Phase 99's `sendInviteOnboardingEmail` returns
  `{ emailSent: boolean, kind: 'google-notify'|'set-password'|'skipped-disabled' }`; requires a real
  invite doc to exist first (CR-01) — which TeamView writes before calling, so ordering is correct.

### Established Patterns
- Component tests live in `src/views/__tests__/` and `src/components/admin/__tests__/`; the app suite is
  bare `npx vitest run`; type-check gate is `npm run type-check` (vue-tsc --build, covers tests).
- `TeamView.test.ts` already exists (the interim copy fix updated it) — extend it for the call + copy branches.

### Integration Points
- TeamView → new callable (Firebase Functions). LoginView → `mapFirebaseError` + template copy.
- No Firestore rules change, no new function (consumes Phase 99's).
</code_context>

<specifics>
## Specific Ideas
- Root cause & decisions: `.planning/debug/resolved/non-gmail-password-setup.md`.
- Owner-run prereqs (surface at milestone end, not code): Firebase Auth Email/Password provider enabled;
  Resend DNS domain verification; and the Phase 99 onboarding-emails toggle must be flipped ON for emails to
  actually send (default OFF).
- No deploy in autonomous mode — hand the Functions + hosting deploy to the owner at milestone end.
</specifics>

<deferred>
## Deferred Ideas
- Removing/replacing `loginWithEmail`'s auto-create trick — out of scope (R294 unchanged behavior).
- A dedicated "accept invite / set password" landing route — Firebase's default action handler + the
  emailed link cover it; a custom page is a future enhancement.
- Per-org onboarding-email toggle — future requirement (global toggle shipped in Phase 99).
</deferred>
