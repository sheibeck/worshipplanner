# Phase 99: Invite Email Function & Owner Toggle - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey-area answers auto-applied from owner's pre-decided milestone defaults + existing codebase patterns; owner deferred validation to milestone end).

<domain>
## Phase Boundary

Build the **server-side** half of non-Google onboarding: one Cloud Function that, for a given invited
email, sends the correct onboarding email — provisioning a Firebase Auth account and a `generatePasswordResetLink()`
"set your password" link for non-Google invitees, and a plain "sign in with Google" notice for
Google/Gmail invitees — reusing the existing Resend send path (`functions/src/adminEmail.ts`). Plus the
**Owner Console on/off toggle** that gates whether these emails send at all (a new `appConfig` boolean +
its `ConfigurationTab` control).

**In scope:** the callable function + its email-copy builders + Auth provisioning + the `appConfig`
onboarding-emails flag (server interface/default/coerce, client mirror + drift-guard, `ConfigurationTab`
checkbox) + unit tests.

**Out of scope (Phase 100):** wiring `TeamView.onInvite` to call this function, and the `LoginView`
password-path/`auth/operation-not-allowed` UX. This phase delivers a function that Phase 100 consumes.
</domain>

<decisions>
## Implementation Decisions

### Function contract & responsibility split
- **New `onCall` callable** (e.g. `sendInviteOnboardingEmail`), exported with a **separately-exported
  testable handler body** (`...Handler`) per this repo's convention (`onboardOrganizationHandler`,
  `setOrgAiEnabledHandler`), and **re-exported from `functions/src/index.ts`** (a new function not
  re-exported there fails `firebase deploy`). Bind `secrets: [RESEND_API_KEY]` like `onboardOrganization`.
- **Input:** `{ orgId: string, email: string }`. (Role is already carried by the invite doc the client
  writes; the email doesn't need it.)
- **Responsibility split (satisfies R294):** the **client keeps writing the authoritative invite docs**
  (`organizations/{orgId}/invites/{email}` + `inviteLookup/{email}`) exactly as `TeamView.onInvite` does
  today — that write is the source of truth for membership. This function is **provisioning + email
  ONLY, best-effort**: Phase 100 calls it *after* the invite batch commits, inside a try/catch, so an
  email/provisioning failure never blocks or reverts the invite. This is the smallest-blast-radius
  choice — no `firestore.rules` change, no disruption to the pending-invites realtime listener — and
  mirrors `onboardOrganizationHandler`'s "write first, best-effort email after" shape.
- **Return** `{ emailSent: boolean, kind: 'google-notify' | 'set-password' | 'skipped-disabled' | 'skipped-existing' }`
  so the caller/console can later surface delivery status (like `OnboardOrganizationResponse.emailSent`).

### Invitee-type detection (the flagged design question — owner's leaning default)
- **`gmail.com` / `googlemail.com`** (case-insensitive, on the normalized `.toLowerCase().trim()` email)
  → **Google notify-only**: send "you've been invited — sign in with Google using this address" (reuse/
  adapt `buildInvitedContent`). **No Auth account created, no password step** (R289) — this deliberately
  avoids the Google↔password `auth/account-exists-with-different-credential` linking conflict.
- **Every other domain** → **non-Google set-password**: `getUserByEmail`; if `auth/user-not-found`,
  `admin.auth().createUser({ email })`; then `generatePasswordResetLink(email, actionCodeSettings)` and
  email that link (R290, R291). The set-password email **also mentions Google sign-in as a fallback**, so
  a Google Workspace user on a custom domain (the fuzzy edge) is never stranded.
- **Already-registered address** (`getUserByEmail` succeeds) → do **not** re-create; for the non-Google
  branch send a password-reset/set link to the existing account; for the Google branch send the notify
  email. (Re-inviting is idempotent; also catch `auth/email-already-exists` from a create race and fall
  back to the reset-link path.)

### Owner toggle (`appConfig` — global, the flagged toggle-scope question's leaning default)
- Add a new **`onboarding: { emailsEnabled: boolean }`** group to `AppConfig` in **both**
  `functions/src/appConfig.ts` (interface + `DEFAULT_APP_CONFIG` + a `coerceOnboarding` using the
  fail-closed `coerceEnableFlag`, wired into `mergeAppConfig`) **and** the client mirror
  `src/config/appConfigDefaults.ts` (interface + `DEFAULT_APP_CONFIG` + `mergeAppConfig` line), keeping
  the two byte-identical (the `appConfigDefaults.test.ts` drift-guard snapshot will need updating).
- **Global, not per-org** — lives in the single `appConfig/global` doc the Owner Console already edits,
  consistent with every other operational switch here. (Per-org is recorded as a future requirement.)
- **Default: `false` (OFF)** — consistent with every sibling boolean in this config
  (`cleanup.*`, `messaging.scheduledCronEnabled` all default `false`) and fail-safe given the
  Resend-domain caveat below. ⚠ **FLAGGED for owner confirmation at validation:** this means invite
  emails do not send until the owner flips it ON (after verifying the Resend domain). If the owner
  prefers emails ON by default, it's a one-line default change in both mirrors.
- The function reads `getAppConfig(db)` and, when `onboarding.emailsEnabled` is false, **sends nothing**
  for either invitee type and returns `{ emailSent: false, kind: 'skipped-disabled' }` (R293). The invite
  doc the client wrote still stands.
- **`ConfigurationTab.vue`:** add a checkbox bound through the existing `src/stores/appConfig.ts`
  `saveField` path with the same `(default)` provenance badge pattern (`isExplicitlySet`) as the other
  fields.

### Authorization & abuse safety (this function creates Auth accounts — treat as sensitive)
- **Re-verify server-side** that `request.auth` is present and the caller is an **editor member of
  `orgId`** (read `organizations/{orgId}/members/{callerUid}` and require `role === 'editor'`) before any
  provisioning/send — do NOT let an arbitrary authenticated user trigger account creation for arbitrary
  emails (enumeration/spam vector). Mirror the `assert…Caller`-then-validate structure (but org-editor,
  not super-admin).
- Server-side email-format guard like `assertValidEmailFormat` (reject empty/`/`/no-`@`).
- Consider bounding abuse with the existing per-org email quota (`checkAndConsumeOrgEmailQuota`) — leave
  the exact policy to planning, but note it as the available lever.
- `generatePasswordResetLink` needs `actionCodeSettings.url` → point back to the app (reuse
  `SERVICE_SHARE_BASE_URL`); rely on Firebase's **default hosted action handler** (the debug trace
  confirmed no custom `__/auth/action` route exists and none is in scope here).

### Claude's Discretion
- Exact function name, response shape details, email subject/body wording, and whether to fold the org
  email-quota check in this phase or defer — all at the planner's discretion within the decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`functions/src/adminEmail.ts`** — `sendAdminOnboardingEmail`: the exact Resend send pattern to reuse
  (From-header via `params.ts` `bareEmailAddress`/`fromDisplayName`, `config.sender.fromAddress`,
  `buildInvitedContent`/`buildAddedContent` copy builders, best-effort try/catch caller contract).
- **`functions/src/orgProvisioning.ts`** — `resolveAdminTarget` (existing-vs-invite via `getUserByEmail`,
  discriminating `auth/user-not-found`), `assertSuperAdminCaller` (the caller-gate shape to adapt to
  org-editor), `assertValidEmailFormat`, and `onboardOrganizationHandler`'s "commit write, THEN
  best-effort email with `emailSent` flag" structure — the template for this whole function.
- **`functions/src/appConfig.ts`** — `AppConfig`/`DEFAULT_APP_CONFIG`/`coerceEnableFlag`/`mergeAppConfig`/
  `getAppConfig(db)` (60s TTL cache): where the `onboarding.emailsEnabled` flag is added + read.
- **`src/config/appConfigDefaults.ts`** — client mirror interface+default+`mergeAppConfig`+`isExplicitlySet`;
  must stay byte-identical (drift-guard test `src/config/__tests__/appConfigDefaults.test.ts`).
- **`functions/src/params.ts`** — `RESEND_API_KEY`, `SERVICE_SHARE_BASE_URL`, `bareEmailAddress`,
  `fromDisplayName` (re-exported from `index.ts`).

### Established Patterns
- Handler-body-exported-separately-from-`onCall`-wrapper, so unit tests call the handler with a fake
  `CallableRequest`; wrapper binds secrets. Tests live beside source (`*.test.ts`) and run under the
  `render-service`-excluded root vitest (`npx vitest run`).
- `onCall({ secrets: [RESEND_API_KEY] }, handler)` — Resend key confined to the send surface.
- Fail-closed boolean config (`coerceEnableFlag`: only literal `true` enables).
- New Cloud Functions MUST be re-exported from `functions/src/index.ts` or `firebase deploy` fails
  ("No function matches the filter"); no predeploy build hook — rebuild functions before deploy.

### Integration Points
- New function added to `functions/src/*.ts` + re-exported from `functions/src/index.ts`.
- `appConfig/global` Firestore doc gains an `onboarding.emailsEnabled` leaf; read server-side via
  `getAppConfig`, edited client-side via `ConfigurationTab.vue` → `src/stores/appConfig.ts` `saveField`.
- Phase 100 consumer: `TeamView.onInvite` will call this function (via `httpsCallable`) after its invite
  batch commit.
</code_context>

<specifics>
## Specific Ideas

- Root cause & the full decision record: `.planning/debug/resolved/non-gmail-password-setup.md`.
- Reuse Resend; do NOT introduce a new email vendor.
- Owner-run external prerequisites (NOT this phase's code, surface at milestone end): confirm Firebase
  Auth **Email/Password provider is enabled** for `worship-planner-bc515`; complete
  `functions/DEPLOY-EMAIL-DOMAIN.md` **Resend DNS domain verification** (until done, `onboarding@resend.dev`
  only delivers to the Resend account owner's inbox — real delivery to invitees depends on it).
- **Deploy posture:** this phase adds a Cloud Function + touches `appConfig` client — a Functions deploy
  (and a client build) is expected; per the 2026-08-25 standing policy, any deploy is confirm-then-deploy,
  handed to the owner at milestone end (autonomous does NOT deploy).
</specifics>

<deferred>
## Deferred Ideas

- Per-org onboarding-email toggle (this phase ships the global one) — recorded as a future requirement.
- Tightening `firestore.rules` to move invite-doc writes server-side (would let the function own the whole
  invite) — out of scope; the client write stays authoritative here.
- A custom `__/auth/action` password-reset handler page — not needed; Firebase's default hosted page is used.
</deferred>
