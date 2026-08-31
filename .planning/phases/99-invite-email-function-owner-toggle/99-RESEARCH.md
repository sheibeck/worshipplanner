# Phase 99: Invite Email Function & Owner Toggle - Research

**Researched:** 2026-08-30
**Domain:** Firebase Admin Auth account provisioning + transactional email (Resend) + Firestore-backed feature flag
**Confidence:** HIGH (implementation is a close structural mirror of existing, tested code in this repo; the two genuinely new Admin SDK calls are CITED against official Firebase docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Function contract & responsibility split**
- New `onCall` callable (e.g. `sendInviteOnboardingEmail`), exported with a separately-exported testable handler body (`...Handler`) per this repo's convention (`onboardOrganizationHandler`, `setOrgAiEnabledHandler`), and re-exported from `functions/src/index.ts` (a new function not re-exported there fails `firebase deploy`). Bind `secrets: [RESEND_API_KEY]` like `onboardOrganization`.
- Input: `{ orgId: string, email: string }`. (Role is already carried by the invite doc the client writes; the email doesn't need it.)
- Responsibility split (satisfies R294): the client keeps writing the authoritative invite docs (`organizations/{orgId}/invites/{email}` + `inviteLookup/{email}`) exactly as `TeamView.onInvite` does today — that write is the source of truth for membership. This function is provisioning + email ONLY, best-effort: Phase 100 calls it after the invite batch commits, inside a try/catch, so an email/provisioning failure never blocks or reverts the invite. Mirrors `onboardOrganizationHandler`'s "write first, best-effort email after" shape.
- Return `{ emailSent: boolean, kind: 'google-notify' | 'set-password' | 'skipped-disabled' | 'skipped-existing' }` so the caller/console can later surface delivery status (like `OnboardOrganizationResponse.emailSent`).

**Invitee-type detection**
- `gmail.com` / `googlemail.com` (case-insensitive, on the normalized `.toLowerCase().trim()` email) → Google notify-only: send "you've been invited — sign in with Google using this address" (reuse/adapt `buildInvitedContent`). No Auth account created, no password step (R289) — avoids the Google↔password `auth/account-exists-with-different-credential` linking conflict.
- Every other domain → non-Google set-password: `getUserByEmail`; if `auth/user-not-found`, `admin.auth().createUser({ email })`; then `generatePasswordResetLink(email, actionCodeSettings)` and email that link (R290, R291). The set-password email also mentions Google sign-in as a fallback, so a Google Workspace user on a custom domain is never stranded.
- Already-registered address (`getUserByEmail` succeeds) → do not re-create; for the non-Google branch send a password-reset/set link to the existing account; for the Google branch send the notify email. Re-inviting is idempotent; also catch `auth/email-already-exists` from a create race and fall back to the reset-link path.

**Owner toggle (`appConfig` — global)**
- Add `onboarding: { emailsEnabled: boolean }` to `AppConfig` in both `functions/src/appConfig.ts` (interface + `DEFAULT_APP_CONFIG` + a `coerceOnboarding` using the fail-closed `coerceEnableFlag`, wired into `mergeAppConfig`) and the client mirror `src/config/appConfigDefaults.ts` (interface + `DEFAULT_APP_CONFIG` + `mergeAppConfig` line), keeping the two byte-identical (the `appConfigDefaults.test.ts` drift-guard snapshot will need updating).
- Global, not per-org — lives in the single `appConfig/global` doc the Owner Console already edits. (Per-org is a future requirement.)
- Default: `false` (OFF) — consistent with every sibling boolean in this config (`cleanup.*`, `messaging.scheduledCronEnabled` all default `false`) and fail-safe given the Resend-domain caveat. FLAGGED for owner confirmation at validation.
- The function reads `getAppConfig(db)` and, when `onboarding.emailsEnabled` is false, sends nothing for either invitee type and returns `{ emailSent: false, kind: 'skipped-disabled' }` (R293). The invite doc the client wrote still stands.
- `ConfigurationTab.vue`: add a checkbox bound through the existing `src/stores/appConfig.ts` `saveField` path with the same `(default)` provenance badge pattern (`isExplicitlySet`) as the other fields.

**Authorization & abuse safety**
- Re-verify server-side that `request.auth` is present and the caller is an editor member of `orgId` (read `organizations/{orgId}/members/{callerUid}` and require `role === 'editor'`) before any provisioning/send — do NOT let an arbitrary authenticated user trigger account creation for arbitrary emails. Mirror the `assert…Caller`-then-validate structure (but org-editor, not super-admin).
- Server-side email-format guard like `assertValidEmailFormat` (reject empty/`/`/no-`@`).
- Consider bounding abuse with the existing per-org email quota (`checkAndConsumeOrgEmailQuota`) — leave the exact policy to planning, but note it as the available lever.
- `generatePasswordResetLink` needs `actionCodeSettings.url` → point back to the app (reuse `SERVICE_SHARE_BASE_URL`); rely on Firebase's default hosted action handler (no custom `__/auth/action` route exists and none is in scope here).

### Claude's Discretion
Exact function name, response shape details, email subject/body wording, and whether to fold the org email-quota check in this phase or defer — all at the planner's discretion within the decisions above.

### Deferred Ideas (OUT OF SCOPE)
- Per-org onboarding-email toggle (this phase ships the global one) — recorded as a future requirement.
- Tightening `firestore.rules` to move invite-doc writes server-side (would let the function own the whole invite) — out of scope; the client write stays authoritative here.
- A custom `__/auth/action` password-reset handler page — not needed; Firebase's default hosted page is used.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R289 | Google/Gmail invitee gets a "sign in with Google" notify-only email — no Auth account pre-created, no password step | `gmail.com`/`googlemail.com` domain-suffix heuristic (see Architecture Patterns, Pattern 2); `buildInvitedContent`-style copy builder in the new module; response `kind: 'google-notify'` |
| R290 | Non-Google invitee gets an email with a secure "set your password" link | `getAuth().generatePasswordResetLink(email, actionCodeSettings)` (CITED, Code Examples); Resend send via the `adminEmail.ts` pattern |
| R291 | Inviting a non-Google user provisions their sign-in account server-side (`createUser` + `generatePasswordResetLink`) | `resolveAdminTarget`-style `getUserByEmail`/`auth/user-not-found` discrimination (verified pattern, `orgProvisioning.ts:128-145`) + `admin.auth().createUser({ email })` (CITED); race handling for `auth/email-already-exists` (Common Pitfalls) |
| R293 | Owner can turn onboarding/invite emails on/off from the Owner Console; off ⇒ invite still records membership, no email sent | `appConfig.onboarding.emailsEnabled` (Don't Hand-Roll / Standard Stack — extend existing `appConfig.ts` + `appConfigDefaults.ts` + `ConfigurationTab.vue` card pattern, verified against `MessagingConfigCard.vue`) |
</phase_requirements>

## Summary

This phase is almost entirely a "compose from existing, proven parts" task, not new-technology research. Every structural piece the function needs already exists in this codebase as a working, tested pattern: `resolveAdminTarget`'s `getUserByEmail`/`auth/user-not-found` discrimination, `assertSuperAdminCaller`'s caller-gate shape (adapted here to an org-editor check that already exists verbatim in `queueServiceMessageHandler`), `sendAdminOnboardingEmail`'s Resend send path, `appConfig.ts`'s coerce/merge/cache layer, and `ConfigurationTab.vue`'s per-card boolean-toggle UI (`MessagingConfigCard.vue` is the closest analog — same immediate-save-on-change, same `isExplicitlySet` provenance badge). The two genuinely new pieces are `admin.auth().createUser({ email })` and `getAuth().generatePasswordResetLink(email, actionCodeSettings)` — **neither is called anywhere in this codebase today** (verified by grep); everything before this phase only ever *reads* Auth (`getUserByEmail`). Both are stable, long-established Admin SDK methods (available since early v9 of `firebase-admin`; this repo pins `^13.10.0`, current registry latest is `14.3.0` — no upgrade needed), and their signatures/error codes are confirmed against Firebase's official docs below.

The one real architectural trap is a **circular-import risk**: `checkAndConsumeOrgEmailQuota` (the existing per-org email quota helper CONTEXT.md flags as an available lever) lives inside `functions/src/index.ts`, which already imports the new module (to re-export the new callable). If the new module imports `checkAndConsumeOrgEmailQuota` back from `index.ts`, that is a circular import — the exact class of problem `params.ts` was carved out to solve for `RESEND_API_KEY`. This phase's planner should either defer the quota check (CONTEXT.md explicitly allows this) or extract `checkAndConsumeOrgEmailQuota` into a dependency-free module first.

**Primary recommendation:** Create `functions/src/inviteOnboarding.ts` (new module) mirroring `orgProvisioning.ts`'s shape — a testable `sendInviteOnboardingEmailHandler(request)` plus an `onCall({ secrets: [RESEND_API_KEY] }, ...)` wrapper — that (1) re-verifies caller is an org editor, (2) validates `orgId`/`email`, (3) reads `getAppConfig(db)` and short-circuits to `{ emailSent: false, kind: 'skipped-disabled' }` if the toggle is off, (4) branches on the gmail/googlemail domain suffix, (5) for the non-Google branch calls `getUserByEmail` → `createUser` (catching `auth/email-already-exists`) → `generatePasswordResetLink`, (6) sends via a `Resend` client constructed exactly like `sendAdminOnboardingEmail` (reusing `bareEmailAddress`/`fromDisplayName`/`config.sender.fromAddress` from `params.ts`/`appConfig.ts`), and (7) is best-effort — never throws in a way that looks like invite failure once the appConfig read has succeeded (errors from the Auth/Resend calls should still surface to the caller as a thrown `HttpsError` or a resolved `{ emailSent: false, ... }`, matching `OnboardOrganizationResponse.emailSent`'s "false never means the invite failed" contract — the actual "never blocks the invite" guarantee is enforced by Phase 100's caller wrapping this callable in try/catch, not by this function swallowing its own errors).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Invite-doc write (membership source of truth) | API / Backend (client-authored, Firestore-rules-enforced) | — | Unchanged this phase — `TeamView.onInvite`'s existing Firestore batch write stays authoritative (locked decision) |
| Org-editor caller authorization | API / Backend (Cloud Function) | — | Must be re-verified server-side inside the callable; a client-side role check is not a security boundary |
| Auth account provisioning (createUser) | API / Backend (Cloud Function, Admin SDK) | Database / Storage (Firebase Auth's own user store) | Only the Admin SDK, running server-side with elevated privileges, can create a user without that user's own credentials |
| Password-reset link generation | API / Backend (Cloud Function, Admin SDK) | — | `generatePasswordResetLink` is an Admin-only API; no client SDK equivalent for pre-provisioning |
| Email dispatch (Resend) | API / Backend (Cloud Function) | — | Existing `RESEND_API_KEY` secret is confined to Cloud Functions; never shipped to the browser |
| Owner on/off toggle read | API / Backend (Cloud Function reads `appConfig/global`) | Database / Storage (`appConfig/global` Firestore doc) | Server enforces the gate; the doc is the single source of truth, TTL-cached per `getAppConfig` |
| Owner on/off toggle write (UI) | Browser / Client (`ConfigurationTab.vue` → Pinia store `saveField`) | — | Existing established pattern — direct `setDoc(..., {merge:true})` from an already-rules-gated super-admin-only surface |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | `^13.10.0` (installed; registry latest `14.3.0`, no upgrade needed) [VERIFIED: npm registry, `npm view firebase-admin version` run against `functions/package.json`] | `getAuth().getUserByEmail`, `getAuth().createUser`, `getAuth().generatePasswordResetLink` | Already the sole Auth-admin surface in this repo (`resolveAdminTarget`, `assertSuperAdminCaller`, `setOrgActiveHandler`'s `revokeRefreshTokens`) |
| `firebase-functions` | `^7.3.2` [VERIFIED: npm registry] | `onCall`, `HttpsError`, `CallableRequest`, `defineSecret` | Already used for every callable in this repo |
| `resend` | `6.19.0` (installed, pinned exact — CONTEXT.md: "reuse Resend; do NOT introduce a new email vendor") | Transactional email send | Already the only email vendor wired in (`adminEmail.ts`, `sendQueuedMessage`) |

No new packages are installed this phase — every dependency above is already present in `functions/package.json`. The Package Legitimacy Audit below is a formality confirming that.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | This phase adds zero new dependencies |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `generatePasswordResetLink` + Resend email | `sendSignInLinkToEmail` (passwordless) | Explicitly rejected by the owner (root-cause doc, `.planning/debug/resolved/non-gmail-password-setup.md`) — out of scope |
| Global `appConfig.onboarding.emailsEnabled` | Per-org toggle (`organizations/{orgId}/settings.onboarding.emailsEnabled`) | Deferred to a future requirement per CONTEXT.md; global is simpler and matches every other operational switch in `appConfig` |

**Installation:** None required — reuses existing `functions/package.json` dependencies.

**Version verification:** Ran `npm view firebase-admin version` and `npm view firebase-functions version` against the live npm registry from `functions/`. Registry reports `firebase-admin@14.3.0` and `firebase-functions@7.3.2` as latest; this repo pins `firebase-admin@^13.10.0` (one major behind current, but `createUser`/`generatePasswordResetLink`/`getUserByEmail` have been stable Admin Auth APIs since early v9 — no known breaking changes affect this phase) and `firebase-functions@^7.3.2` (current). No version bump needed for this phase.

## Package Legitimacy Audit

No external packages are installed by this phase — `firebase-admin`, `firebase-functions`, and `resend` are all pre-existing dependencies already in production use elsewhere in `functions/src/` (`orgProvisioning.ts`, `index.ts`, `adminEmail.ts`). The audit below is recorded for completeness only.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| firebase-admin | npm | 10+ yrs, actively maintained by Google | very high (>1M/wk class) | github.com/firebase/firebase-admin-node | OK | Approved (already installed, no version change) |
| firebase-functions | npm | 9+ yrs, actively maintained by Google | very high | github.com/firebase/firebase-functions | OK | Approved (already installed, no version change) |
| resend | npm | actively maintained, official SDK for Resend.com | moderate-high, growing | github.com/resend/resend-node | OK | Approved (already installed at pinned `6.19.0`, no version change) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
TeamView.onInvite (Phase 100, not this phase)
        │
        │ 1. writes invites/{email} + inviteLookup/{email}   (Firestore batch — unchanged, authoritative)
        │ 2. calls httpsCallable('sendInviteOnboardingEmail') inside try/catch (best-effort)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  sendInviteOnboardingEmailHandler  (functions/src/inviteOnboarding.ts, NEW)
│                                                                   │
│  a. assertOrgEditorCaller(request, orgId)                        │
│       → HttpsError('unauthenticated'|'permission-denied') if not │
│  b. assertValidEmailFormat(email)                                │
│  c. getAppConfig(db)                                             │
│       └─ onboarding.emailsEnabled === false?                     │
│            → return { emailSent:false, kind:'skipped-disabled' } │
│  d. isGoogleEmail(email)?  (gmail.com / googlemail.com suffix)   │
│       │                                                           │
│  YES ─┤                                              NO ─┐        │
│       ▼                                                   ▼        │
│  buildGoogleNotifyContent()               getAuth().getUserByEmail(email)
│  (no Auth call, no createUser)                    │                │
│       │                                    user-not-found?         │
│       │                                       │        │            │
│       │                                     YES        NO           │
│       │                                       ▼        │            │
│       │                        getAuth().createUser({email})       │
│       │                          (catch auth/email-already-exists  │
│       │                           → fall through to existing path) │
│       │                                       │        │            │
│       │                                       └────┬───┘            │
│       │                                            ▼                │
│       │                         getAuth().generatePasswordResetLink(
│       │                             email, { url: SERVICE_SHARE_BASE_URL })
│       │                                            │                │
│       │                         buildSetPasswordContent(link)       │
│       └───────────────────────┬────────────────────┘                │
│                                ▼                                    │
│              new Resend(RESEND_API_KEY.value()).emails.send(...)    │
│              (From: org display name <config.sender.fromAddress>,   │
│               mirrors sendAdminOnboardingEmail exactly)             │
│                                ▼                                    │
│              return { emailSent, kind }                             │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
  re-exported from functions/src/index.ts  (deploy requires this)
```

### Recommended Project Structure
```
functions/src/
├── inviteOnboarding.ts       # NEW — sendInviteOnboardingEmailHandler + onCall wrapper + isGoogleEmail + content builders
├── inviteOnboarding.test.ts  # NEW — unit tests, mirrors orgProvisioning.test.ts's FakeFirestore + mocked getAuth() pattern
├── adminEmail.ts             # UNCHANGED — reused only as a structural template (its builders are not exported, see Pitfall below)
├── appConfig.ts              # EDIT — add onboarding.emailsEnabled (interface, DEFAULT, coerceOnboarding, mergeAppConfig)
├── appConfig.test.ts         # EDIT — extend DEFAULT_APP_CONFIG shape assertion + add coerceOnboarding cases
├── params.ts                 # UNCHANGED — RESEND_API_KEY, SERVICE_SHARE_BASE_URL, bareEmailAddress, fromDisplayName all reused as-is
└── index.ts                  # EDIT — import + re-export the new callable

src/
├── config/appConfigDefaults.ts              # EDIT — mirror the same onboarding.emailsEnabled addition
├── config/__tests__/appConfigDefaults.test.ts  # EDIT — drift-guard snapshot will fail until updated
├── components/admin/
│   ├── ConfigurationTab.vue                 # EDIT — one new <OnboardingConfigCard /> line
│   └── OnboardingConfigCard.vue              # NEW — mirrors MessagingConfigCard.vue's boolean-toggle card exactly
```

### Pattern 1: Testable handler + onCall wrapper, re-exported from index.ts
**What:** Export the handler body separately (`sendInviteOnboardingEmailHandler`) from the `onCall(...)` wrapper (`sendInviteOnboardingEmail`), then re-export the wrapper from `functions/src/index.ts`.
**When to use:** Every new Cloud Function in this repo, no exceptions — a function not re-exported from `index.ts` deploys nothing and `firebase deploy --only functions:sendInviteOnboardingEmail` fails with "No function matches the filter."
**Example:**
```typescript
// Source: functions/src/orgProvisioning.ts:255-328 (onboardOrganizationHandler/onboardOrganization),
// functions/src/index.ts:3393-3404 (re-export)
export async function sendInviteOnboardingEmailHandler(
  request: CallableRequest<SendInviteOnboardingEmailRequest>,
): Promise<SendInviteOnboardingEmailResponse> {
  // ... caller gate, validation, appConfig read, branch, Auth calls, send
}

export const sendInviteOnboardingEmail = onCall(
  { secrets: [RESEND_API_KEY] },
  sendInviteOnboardingEmailHandler,
);

// functions/src/index.ts:
import { sendInviteOnboardingEmail } from "./inviteOnboarding";
export { sendInviteOnboardingEmail };
```

### Pattern 2: gmail/googlemail domain-suffix detection
**What:** A pure, testable classifier run on the normalized email.
**When to use:** Once, at the top of the handler, before any Auth network call.
**Example:**
```typescript
// New code — no existing precedent in this repo (verified: no gmail/googlemail
// string appears anywhere in src/ or functions/src/ today). Gotchas:
// - Normalize FIRST: .trim().toLowerCase() (mirrors resolveAdminTarget's
//   normalizedEmail exactly) — an email is case-insensitive on the domain
//   part per RFC, and a raw comparison would miss "Bob@GMAIL.com".
// - Do NOT strip plus-addressing (bob+invite@gmail.com) before this check —
//   plus-addressing only affects the local part, never the domain, so it is
//   irrelevant to domain-suffix detection and stripping it would be dead code
//   here (it WOULD matter if this value were later used as an Auth uid key,
//   which it is not).
// - googlemail.com is a real, still-valid alias domain for older Google
//   Workspace/Gmail accounts (esp. UK-registered) — must be checked alongside
//   gmail.com, not assumed equivalent by substring match.
// - A custom Google Workspace domain (e.g. bob@somechurch.org, even if it
//   happens to route through Google) is NOT detected here and takes the
//   non-Google branch — this is why CONTEXT.md requires the set-password
//   email to ALSO mention "or sign in with Google" as a fallback.
function isGoogleEmail(normalizedEmail: string): boolean {
  return normalizedEmail.endsWith("@gmail.com") || normalizedEmail.endsWith("@googlemail.com");
}
```

### Pattern 3: Org-editor caller gate (adapt from an existing INLINE check, not a shared helper)
**What:** Re-read `organizations/{orgId}/members/{callerUid}` server-side and require `role === 'editor'`.
**When to use:** As the first thing the handler does, before any Firestore write or Auth call.
**Example:**
```typescript
// Source: functions/src/index.ts:2609-2668 (queueServiceMessageHandler) — the
// ONLY existing precedent for an org-editor (not super-admin) caller gate in
// this codebase. It is INLINED there, not factored into a shared helper like
// assertSuperAdminCaller — there is no assertOrgEditorCaller to import.
// Two note-worthy differences from CONTEXT.md's literal wording:
//  1. This repo's actual org-member role model is 'editor' | 'viewer' ONLY
//     (verified: src/views/TeamView.vue:180,188 — no 'admin' role exists at
//     the org-member tier; TeamView's role toggle only ever sets 'editor' or
//     'viewer'). CONTEXT.md's "role === 'editor'" is therefore precisely
//     correct for this codebase's actual data, even though the ONE existing
//     precedent (queueServiceMessageHandler) defensively also accepts
//     'admin' (role !== "editor" && role !== "admin") for forward-compat.
//     Either check is safe; `role === 'editor'` alone matches locked CONTEXT.
//  2. queueServiceMessageHandler does not double-check request.auth — it
//     relies on request.auth.uid being present implicitly after its own
//     `if (!request.auth) throw ...` guard. Mirror that ordering.
if (!request.auth) {
  throw new HttpsError("unauthenticated", "Sign in required.");
}
const memberDoc = await db.collection("organizations").doc(orgId)
  .collection("members").doc(request.auth.uid).get();
if (!memberDoc.exists) {
  throw new HttpsError("permission-denied", "You are not a member of this organization.");
}
const role = (memberDoc.data() as { role?: string } | undefined)?.role;
if (role !== "editor") {
  throw new HttpsError("permission-denied", "You must be an editor to invite members.");
}
```

### Anti-Patterns to Avoid
- **Importing `buildInvitedContent`/`buildAddedContent` from `adminEmail.ts`:** Neither is exported (`adminEmail.ts` only exports `sendAdminOnboardingEmail`, `AdminOnboardingKind`, `SendAdminOnboardingEmailArgs`). "Reuse `buildInvitedContent`" (CONTEXT.md) means reuse the *pattern* (subject/text builder returning `{subject, text}`, using `resolveAppBaseUrl`-style base-URL guarding) in the new module's own builders — not a literal import. If genuine code reuse is wanted, export `buildInvitedContent`/`resolveAppBaseUrl` from `adminEmail.ts` first (small, safe, additive change) rather than duplicating the base-URL-blank-guard logic.
- **Importing `checkAndConsumeOrgEmailQuota` from `index.ts` into the new module:** creates a circular import (`index.ts` → new module for re-export; new module → `index.ts` for the quota helper). See Common Pitfalls below.
- **Treating a `generatePasswordResetLink` failure as fatal to the whole invite:** CONTEXT.md's "email is best-effort" guarantee is enforced by Phase 100's *caller* wrapping this callable in try/catch, not by this function silently swallowing every internal error — but errors from the Auth/Resend calls inside this handler should still resolve to a clear `HttpsError` (or a well-defined `{emailSent:false,...}`) so Phase 100's caller can log something actionable, mirroring `onboardOrganizationHandler`'s `console.error` + `emailSent:false` shape for its own best-effort email step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password-reset/set-password link generation | A custom token + Firestore-stored reset flow | `getAuth().generatePasswordResetLink(email, actionCodeSettings)` | Firebase's action-link mechanism already handles expiry, single-use invalidation, and the hosted action page — hand-rolling this is a security liability (see ASVS V2/V6 in Security Domain below) |
| Email-already-exists race handling | A pre-check `getUserByEmail` immediately before `createUser` and assuming no race | Catch `err.code === 'auth/email-already-exists'` from `createUser` itself and fall through to the reset-link path | TOCTOU race is real under concurrent invites (e.g. double-click, or two admins inviting the same address) — `resolveAdminTarget`'s existing precedent already discriminates on the thrown code rather than trusting a prior read |
| Config feature-flag storage | A new Firestore collection/doc just for this toggle | Extend the existing `appConfig/global` doc + `appConfig.ts`/`appConfigDefaults.ts` mirror pair | One canonical config surface, one TTL cache, one Owner Console tab — adding a second config location fragments both the read path and the UI |

**Key insight:** Every "don't hand-roll" item here has an existing, working analog already in this codebase (`resolveAdminTarget`'s race handling, `appConfig.ts`'s merge/coerce layer) — the risk in this phase is not inventing something novel, it's failing to reuse what's already proven.

## Common Pitfalls

### Pitfall 1: Circular import if `checkAndConsumeOrgEmailQuota` is reused from `index.ts`
**What goes wrong:** `functions/src/index.ts` must import the new module to re-export the new callable (`import { sendInviteOnboardingEmail } from "./inviteOnboarding"`). If `inviteOnboarding.ts` also does `import { checkAndConsumeOrgEmailQuota } from "./index"` to fold in the per-org quota check CONTEXT.md mentions as an available lever, that is a circular import between the two modules.
**Why it happens:** `checkAndConsumeOrgEmailQuota` (verified: `functions/src/index.ts:461`, exported) was written for `sendQueuedMessage` and has never needed to be imported *into* `index.ts` from elsewhere — it has always been the other direction (`orgProvisioning.ts`/`adminEmail.ts` importing shared bits *out of* `params.ts`, a deliberately dependency-free module created for exactly this reason, per its own header comment).
**How to avoid:** Either (a) defer the quota check for this phase (CONTEXT.md explicitly permits this — "leave the exact policy to planning"), or (b) extract `checkAndConsumeOrgEmailQuota` out of `index.ts` into a small dependency-free module (following the `params.ts` precedent) before both `index.ts` and the new module import it from there.
**Warning signs:** TypeScript build (`cd functions && npm run build`, i.e. `tsc`) succeeds but the compiled output has undefined imports at runtime, or `tsc`/bundler emits a module-resolution warning; more reliably, a circular import here would likely surface as `orgProvisioning`/`inviteOnboarding`'s module-scope code (if any exists) running in an unexpected order at Cloud Functions cold start.

### Pitfall 2: `generatePasswordResetLink` on a genuinely nonexistent email throws `auth/internal-error`, not a clean error
**What goes wrong:** If the handler somehow calls `generatePasswordResetLink` for an email that has no Auth user (e.g. a logic bug where `createUser` was skipped), the SDK does not throw a clean `auth/user-not-found` — community reports (see Sources) show it can surface as an opaque `auth/internal-error`.
**Why it happens:** `generatePasswordResetLink` requires the user to already exist; it is not itself a provisioning call. This is exactly why the handler must call `createUser` (or confirm via `getUserByEmail`) *before* calling `generatePasswordResetLink`, never skip straight to the link.
**How to avoid:** Structure the non-Google branch as a strict sequence — resolve-or-create the user FIRST (mirroring `resolveAdminTarget`'s shape), and only call `generatePasswordResetLink` once the branch is certain a user document exists (either just-created, or found via `getUserByEmail`).
**Warning signs:** An `auth/internal-error` in logs on the set-password path almost always means the create/lookup step was skipped or its result was not actually awaited before the link call.

### Pitfall 3: `SERVICE_SHARE_BASE_URL`'s default domain must be a Firebase "authorized domain" for `actionCodeSettings.url`
**What goes wrong:** If `actionCodeSettings.url` points at a domain not on Firebase Auth's authorized-domains allowlist, users can see a "domain not authorized" failure when the action link is opened (surfaced client-side, on link click, not at `generatePasswordResetLink()` call time).
**Why it happens:** Firebase Auth restricts which domains an action link's continue-URL may point back to, for phishing/redirect-abuse prevention.
**How to avoid:** `SERVICE_SHARE_BASE_URL`'s default (`https://worship-planner-bc515.web.app`) is the project's own default Firebase Hosting domain, which Firebase auto-authorizes for every project — no owner action needed for the default value. This only becomes a live risk if/when a custom domain is configured as `SERVICE_SHARE_BASE_URL` without also adding it under Firebase Console → Authentication → Settings → Authorized domains. Note this as a deploy-time check, not a code change.
**Warning signs:** Password-reset/set-password links that generate successfully (no error from `generatePasswordResetLink` itself) but fail when clicked.

### Pitfall 4: `onboarding.emailsEnabled` toggle is read via the TTL-cached `getAppConfig(db)` — up to ~60s stale
**What goes wrong:** An owner flips the toggle ON in the Owner Console, then immediately tests an invite from a *different* warm Cloud Functions instance — that instance may still have the old (OFF) value cached for up to `TTL_MS` (60s).
**Why it happens:** `getAppConfig`'s TTL cache (`functions/src/appConfig.ts:267-303`) is a documented, deliberate per-instance design (a `onDocumentWritten` cache-bust cannot reach every warm instance) — this is existing, accepted behavior across every other `appConfig` consumer (`sendQueuedMessage`, the cleanup handlers), not something to "fix" in this phase.
**How to avoid:** Do not pass `{ fresh: true }` unless this handler needs cron-level freshness guarantees (it does not — it's a request-path callable, same tier as `sendAdminOnboardingEmail`'s caller). Document the up-to-60s propagation delay in the owner-facing UAT notes so a same-second toggle-then-test isn't mistaken for a bug.
**Warning signs:** An owner reports "I turned it on but the email still didn't send" within the first minute of flipping the toggle.

### Pitfall 5: `buildInvitedContent`/`buildAddedContent` are not exported from `adminEmail.ts`
**What goes wrong:** A planner reading CONTEXT.md's "reuse/adapt `buildInvitedContent`" literally and writing `import { buildInvitedContent } from "./adminEmail"` will hit a TypeScript compile error — that function is module-private.
**Why it happens:** `adminEmail.ts` was scoped narrowly (quick task 260823) around one email kind (`admin-onboarding`), with its builders kept private since nothing outside the module needed them at the time.
**How to avoid:** Write new, purpose-built content builders in the new module (`buildGoogleNotifyContent`, `buildSetPasswordContent`) following the exact same shape (`{subject, text}` return, base-URL-blank guard via a `resolveAppBaseUrl`-equivalent) — OR, if literal code reuse is preferred, export `buildInvitedContent` and `resolveAppBaseUrl` from `adminEmail.ts` as a small additive change first.
**Warning signs:** `tsc`/`vue-tsc` compile failure citing "has no exported member 'buildInvitedContent'".

## Code Examples

### `createUser` + `auth/email-already-exists` race handling
```typescript
// Source: Firebase Admin Auth docs (CITED: firebase.google.com/docs/auth/admin/errors)
// + this repo's existing resolveAdminTarget error-discrimination pattern
// (functions/src/orgProvisioning.ts:128-145)
try {
  await getAuth().createUser({ email: normalizedEmail });
} catch (err) {
  if ((err as { code?: string })?.code === "auth/email-already-exists") {
    // Race: another invite/sign-in created the user between our
    // getUserByEmail check and this createUser call. Fall through to the
    // reset-link path exactly as if getUserByEmail had found them.
  } else {
    console.error("[inviteOnboarding] createUser failed:", err);
    throw err;
  }
}
```

### `generatePasswordResetLink` with `actionCodeSettings`
```typescript
// Source: Firebase Admin Auth docs (CITED: firebase.google.com/docs/auth/admin/email-action-links)
// url is optional per the docs but CONTEXT.md requires it (reuse
// SERVICE_SHARE_BASE_URL) so the post-reset "continue" experience lands the
// user back in the app rather than Firebase's bare default confirmation page.
const baseUrl = resolveAppBaseUrl(); // '' guard, mirrors adminEmail.ts:50-54
const actionCodeSettings = baseUrl ? { url: baseUrl } : undefined;
const link = await getAuth().generatePasswordResetLink(normalizedEmail, actionCodeSettings);
```

### appConfig.ts additions (interface + default + coerce + merge)
```typescript
// Source: functions/src/appConfig.ts's existing coerceEnableFlag-based groups
// (cleanup, messaging.scheduledCronEnabled) — this is the EXACT pattern to
// replicate, not a new one.
export interface AppConfig {
  // ...existing groups...
  onboarding: {
    emailsEnabled: boolean;
  };
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  // ...existing groups...
  onboarding: {
    emailsEnabled: false, // fail-safe default — see CONTEXT.md's FLAGGED note
  },
};

function coerceOnboarding(raw: unknown): AppConfig["onboarding"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    emailsEnabled: coerceEnableFlag(r.emailsEnabled),
  };
}

export function mergeAppConfig(partial: Partial<AppConfig> | undefined): AppConfig {
  const p = partial ?? {};
  return {
    // ...existing groups...
    onboarding: coerceOnboarding(p.onboarding),
    // ...
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Invited non-Google users bootstrap their own Auth account by typing any password into "Sign in" (undocumented `createUserWithEmailAndPassword` auto-fallback in `loginWithEmail`) | Server-side `createUser` + `generatePasswordResetLink` provisioning at invite time | This phase (v2.5) | Invited users get a discoverable, working password-set path instead of relying on an undocumented client-side trick |
| `TeamView.onInvite` sends no email at all (deliberate Phase 07 design, 2026-03-04) | A real Resend-delivered onboarding email per invite, gated by an owner toggle | This phase (v2.5, function only) + Phase 100 (wiring) | Matches the UI's existing (and previously false) "Invite sent!" copy with actual behavior |

**Deprecated/outdated:**
- The Phase 07 "no email is sent, the editor tells the person verbally" design is being superseded this milestone, per explicit owner decision recorded in `.planning/debug/resolved/non-gmail-password-setup.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `generatePasswordResetLink`'s `actionCodeSettings.url` is safe to omit `handleCodeInApp`/`iOS`/`android` fields entirely (web-only flow) | Code Examples, Pitfall 3 | Low — these fields are documented optional and this app has no mobile client; omission is the correct default, not a guess needing confirmation |
| A2 | The project's default Firebase Hosting domain (`worship-planner-bc515.web.app`) is already on the Authorized Domains list without any owner action | Pitfall 3 | Low-Medium — this is standard, well-documented Firebase behavior (default hosting domains are auto-authorized), but was not independently verified via a live Firebase Console check in this session (blocked the same way the root-cause debug session's Email/Password provider check was blocked — see below) |
| A3 | Firebase Auth's **Email/Password sign-in provider** is enabled for `worship-planner-bc515` | User Constraints (owner prereq) | High if wrong — `createUser`/`generatePasswordResetLink` calls will succeed at the Admin SDK level regardless (they don't require the provider to be toggled on to *create* the account or *generate* the link), but the invitee's actual sign-in attempt with the resulting password would throw `auth/operation-not-allowed`. This is explicitly called out in CONTEXT.md and the root-cause doc as an owner-run, unverified prerequisite — not something this phase's code can check or fix. |

**If this table is empty:** N/A — see rows above. All three are LOW-to-MEDIUM risk and none blocks writing correct code this phase; A3 blocks *real-world delivery success*, not correctness of what gets built.

## Open Questions

1. **Should `createUser`/`generatePasswordResetLink` failures during the non-Google branch return `emailSent:false` (soft) or throw an `HttpsError` (hard)?**
   - What we know: `onboardOrganizationHandler`'s admin-notification email step is soft-fail (`emailSent:false`, logged, no throw) because the org is already durably created by that point. This function's own "durable write" (the invite Firestore docs) is NOT written by this function at all — it's written by `TeamView.onInvite` before this callable is even invoked (per the locked responsibility split).
   - What's unclear: Whether a genuine Auth provisioning failure (e.g. `createUser` throws a non-`email-already-exists` error) should be reported back to Phase 100's caller as a thrown error (so the UI can show "invite created, but the email/account setup failed — you may need to retry") versus silently resolved as `{emailSent:false}` (so Phase 100's blanket try/catch treats it identically to a Resend send failure).
   - Recommendation: Throw `HttpsError` for anything upstream of the Resend send (a `createUser`/`generatePasswordResetLink` failure means the invitee has NO usable path at all, which is worse than "email didn't send but account exists"); reserve `{emailSent:false}` for a Resend-send-specific failure after the Auth side succeeded. This distinction is a planner decision within CONTEXT.md's stated discretion ("response shape details").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Admin SDK Auth API (`createUser`, `generatePasswordResetLink`, `getUserByEmail`) | R290, R291 | Yes — Cloud Functions Admin SDK, no additional setup | `firebase-admin@^13.10.0` | — |
| Resend API (`RESEND_API_KEY` secret) | R289, R290 | Yes — already bound via Google Secret Manager for `onboardOrganization` | `resend@6.19.0` | — |
| Firebase Auth "Email/Password" sign-in provider (Console toggle) | Real-world delivery of R290's set-password flow | UNVERIFIED (owner-run, blocked from automated check both in the root-cause debug session and this research session) | — | None — this is a hard owner prerequisite; the code path works regardless, but an invitee cannot actually sign in with the resulting password until this is confirmed ON |
| Resend DNS domain verification (`functions/DEPLOY-EMAIL-DOMAIN.md`) | Real-world delivery to non-owner invitee addresses | UNVERIFIED (owner-run ops, tracked as backlog 999.6) | — | Until complete, `onboarding@resend.dev` (the current `DEFAULT_APP_CONFIG.sender.fromAddress`) only delivers to the Resend account owner's own inbox — code path is independent and correct regardless |

**Missing dependencies with no fallback:**
- Firebase Auth Email/Password provider toggle — owner-run, blocks real-world sign-in success only (not code correctness or this phase's build/test gates).

**Missing dependencies with fallback:**
- Resend DNS domain verification — has a documented "only reaches the account owner" fallback state that does not block building or testing this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (functions/`package.json` devDependency) / Vitest `4.0.x` at the repo root — see the two-suite note below |
| Config file | `functions/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`, `testTimeout: 30000`); root `vite.config.ts` (`environment: 'jsdom'`, excludes `functions/lib/**` and `render-service/**` but NOT `functions/src/**`) |
| Quick run command | `cd functions && npx vitest run src/inviteOnboarding.test.ts` (or, from repo root: `npx vitest run functions/src/inviteOnboarding.test.ts` — VERIFIED empirically this session: `functions/src/orgProvisioning.test.ts` collects and passes cleanly under the root config too, since it is fully mocked and environment-agnostic) |
| Full suite command | `npx vitest run` from repo root — VERIFIED this session that `functions/src/*.test.ts` files ARE included in the bare root run (not excluded by `vite.config.ts`), consistent with CLAUDE.md's documented single-known-failure baseline (`src/storage.rules.test.ts`) covering the WHOLE repo, not just `src/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R289 | Google/gmail-suffix email → notify-only content, no `createUser` call | unit | `npx vitest run functions/src/inviteOnboarding.test.ts -t "google"` | ❌ Wave 0 |
| R290 | Non-Google email → set-password link email sent via Resend | unit | `npx vitest run functions/src/inviteOnboarding.test.ts -t "set-password"` | ❌ Wave 0 |
| R291 | `getUserByEmail` → `auth/user-not-found` → `createUser` called; existing user → `createUser` NOT called; `auth/email-already-exists` race → falls through cleanly | unit | `npx vitest run functions/src/inviteOnboarding.test.ts -t "createUser"` | ❌ Wave 0 |
| R293 | `onboarding.emailsEnabled=false` → `{emailSent:false, kind:'skipped-disabled'}`, no Resend call; `true` → normal flow; `appConfig.ts` coerce/merge unit cases; `appConfigDefaults.test.ts` drift-guard updated | unit | `npx vitest run functions/src/inviteOnboarding.test.ts -t "disabled"` and `npx vitest run functions/src/appConfig.test.ts src/config/__tests__/appConfigDefaults.test.ts` | ❌ Wave 0 (new handler test) / ✅ (existing appConfig.test.ts + appConfigDefaults.test.ts files exist, need new cases) |
| — (caller-gate, not-a-member, non-editor) | Unauthenticated → `unauthenticated`; authenticated non-member → `permission-denied`; viewer role → `permission-denied` | unit | `npx vitest run functions/src/inviteOnboarding.test.ts -t "caller"` | ❌ Wave 0 |
| — (ConfigurationTab toggle UI) | Owner Console checkbox saves `onboarding.emailsEnabled` via `saveField`, shows `(default)` badge when unset | component/unit | `npx vitest run src/components/admin/__tests__/OnboardingConfigCard.test.ts` (mirror `MessagingConfigCard`'s existing test if one exists — verify at plan time) | ❌ Wave 0 (new component + likely-new test file) |

### Sampling Rate
- **Per task commit:** `cd functions && npx vitest run src/inviteOnboarding.test.ts src/appConfig.test.ts` (fast, node env, ~seconds)
- **Per wave merge:** `npx vitest run` from repo root (full suite; expect exactly the one documented baseline failure, `src/storage.rules.test.ts`)
- **Phase gate:** Full suite green (modulo the documented baseline) before `/gsd-verify-work`; additionally `cd functions && npm run build` (tsc) AND root `npm run type-check` (vue-tsc --build) — the latter matters because `src/config/__tests__/appConfigDefaults.test.ts` imports `functions/src/appConfig.ts` directly (type-only import per its own header comment), so a shape mismatch between the two mirrors is a type-check-time failure, not just a snapshot-test failure.

### Wave 0 Gaps
- [ ] `functions/src/inviteOnboarding.test.ts` — covers R289, R290, R291, R293 (new file, mirrors `orgProvisioning.test.ts`'s `FakeFirestore` + mocked `getAuth()` pattern, extended with `createUser`/`generatePasswordResetLink` mock fns; mirrors `adminEmail.test.ts`'s mocked `resend`/`firebase-functions/params` seams for the send-path assertions)
- [ ] `functions/src/appConfig.test.ts` — extend existing describe blocks with `onboarding.emailsEnabled` shape + `coerceOnboarding` cases (file exists, needs new cases, not a new file)
- [ ] `src/config/__tests__/appConfigDefaults.test.ts` — extend the drift-guard snapshot to include `onboarding.emailsEnabled` (file exists, needs updated expectations — will fail immediately after the `appConfig.ts`/`appConfigDefaults.ts` edits until updated, by design)
- [ ] `src/components/admin/__tests__/OnboardingConfigCard.test.ts` (or equivalent) — new component test for the toggle UI; check at plan time whether `MessagingConfigCard.vue` has a sibling test file to mirror (a targeted grep during planning, not resolved in this research pass — no `*ConfigCard.test.ts` files were found under `src/components/admin/` in this session's exploration, suggesting these cards may currently be covered only via `ConfigurationTab`-level or `SettingsView`-level integration tests rather than per-card unit tests; verify this at plan time before assuming a new isolated test file is the norm)
- [ ] Framework install: none — Vitest is already configured in both suites

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes | Firebase Auth `createUser`/`generatePasswordResetLink` (never hand-roll password/token logic); action links are single-use and time-limited by Firebase itself |
| V3 Session Management | No | This function does not touch sessions/tokens directly — it only provisions accounts and generates a link the invitee later uses through the normal Firebase Auth SDK flow |
| V4 Access Control | Yes | Server-side org-editor re-check (`organizations/{orgId}/members/{callerUid}.role === 'editor'`) before any provisioning — never trust a client-declared authorization flag, mirrors `assertSuperAdminCaller`'s dual-verification discipline (claim + independent Firestore re-read is NOT needed here since org-editor is not a custom-claim-backed role in this app, only a Firestore doc field — but the doc re-read itself IS the independent check) |
| V5 Input Validation | Yes | `assertValidEmailFormat`-style guard (reject empty/`/`/no-`@`) before using the email as a Firestore doc-id-adjacent value or an Auth API argument; `orgId` presence/type validated before any Firestore read |
| V6 Cryptography | Yes (delegated) | Password-reset link generation and token handling are entirely delegated to Firebase Auth's own cryptographic action-link mechanism — this phase must never construct, store, or validate its own reset tokens |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Email enumeration / mass account-creation abuse — an authenticated-but-unauthorized caller invokes this callable repeatedly with arbitrary emails to probe which addresses have accounts, or to spam-create Auth accounts | Information Disclosure / Denial of Service | Org-editor caller gate (V4 above) is the primary control — an attacker must first be an editor member of SOME org. Consider the per-org email quota (`checkAndConsumeOrgEmailQuota`, see Pitfall 1 for the import-order caveat) as a secondary rate-limit if the planner chooses to fold it in this phase. |
| Header injection via a malicious org name in the email's From display name | Tampering | Already solved by the existing `fromDisplayName` helper (`params.ts:40-42`), which strips CR/LF and quote/backslash chars — reuse it verbatim, do not hand-roll a new sanitizer |
| Open-redirect via an unauthorized `actionCodeSettings.url` domain | Spoofing | Firebase Auth's own authorized-domains allowlist enforces this at the platform level (see Pitfall 3) — no application-level mitigation needed beyond using the existing `SERVICE_SHARE_BASE_URL` param |
| Race condition on concurrent invites of the same address (double-invite, or invite racing a self-signup) | Tampering (data integrity) | `auth/email-already-exists` catch-and-fall-through on `createUser` (see Don't Hand-Roll / Code Examples) |

## Sources

### Primary (HIGH confidence)
- `functions/src/orgProvisioning.ts` (full file, read this session) — `resolveAdminTarget`, `assertSuperAdminCaller`, `assertValidEmailFormat`, `onboardOrganizationHandler`, the handler/wrapper re-export pattern
- `functions/src/adminEmail.ts` (full file, read this session) — the exact Resend send pattern, From-header construction, base-URL blank guard
- `functions/src/appConfig.ts` (full file, read this session) — `AppConfig`, `DEFAULT_APP_CONFIG`, `coerceEnableFlag`, `mergeAppConfig`, `getAppConfig`'s TTL cache
- `functions/src/params.ts` (full file, read this session) — `RESEND_API_KEY`, `SERVICE_SHARE_BASE_URL`, `fromDisplayName`, `bareEmailAddress`
- `functions/src/index.ts:2609-2668` (`queueServiceMessageHandler`, read this session) — the only existing org-editor caller-gate precedent; `functions/src/index.ts:461` (`checkAndConsumeOrgEmailQuota`, exported from `index.ts`)
- `src/config/appConfigDefaults.ts`, `src/stores/appConfig.ts`, `src/components/admin/ConfigurationTab.vue`, `src/components/admin/MessagingConfigCard.vue` (all read this session) — client mirror + `saveField` + boolean-toggle card pattern
- `functions/src/orgProvisioning.test.ts`, `functions/src/appConfig.test.ts`, `functions/src/adminEmail.test.ts` (read this session) — testing patterns (FakeFirestore, mocked `getAuth()`/`resend`/`firebase-functions/params`)
- `.planning/phases/99-invite-email-function-owner-toggle/99-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/debug/resolved/non-gmail-password-setup.md` (all read this session)
- Empirical verification this session: `npm view firebase-admin version` (14.3.0 latest, repo pins ^13.10.0), `npm view firebase-functions version` (7.3.2, matches repo pin), `cd C:/projects/worshipplanner && npx vitest run functions/src/orgProvisioning.test.ts` (62/62 pass, confirms functions/src tests run correctly under root vitest), grep confirming `createUser`/`generatePasswordResetLink` are not called anywhere in the current codebase, grep confirming `gmail.com`/`googlemail.com` heuristic is entirely new

### Secondary (MEDIUM confidence — CITED official docs)
- [Generating Email Action Links (Firebase Admin Auth)](https://firebase.google.com/docs/auth/admin/email-action-links) — `generatePasswordResetLink(email, actionCodeSettings)` signature, `actionCodeSettings.url` optionality, "email must belong to an existing user"
- [Admin Auth SDK Errors](https://firebase.google.com/docs/auth/admin/errors) — exact `auth/email-already-exists`, `auth/user-not-found`, `auth/operation-not-allowed`, `auth/invalid-email` code strings and descriptions
- [Firebase Authorized Domains behavior](https://www.rapidevelopers.com/firebase-tutorial/how-to-reset-password-in-firebase-auth) — the domain-in-`actionCodeSettings.url`-must-be-authorized requirement

### Tertiary (LOW confidence — flagged for validation, not authoritative)
- [firebase-admin-node issue #1202](https://github.com/firebase/firebase-admin-node/issues/1202) — community report of `auth/internal-error` from `generatePasswordResetLink` on certain inputs; informed Pitfall 2 but is a GitHub issue, not official documentation — treat as a "be careful, sequence your calls correctly" signal, not a guaranteed reproduction

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all reused verbatim from working code in this repo
- Architecture: HIGH — every structural piece (caller gate, best-effort email, appConfig extension, handler/wrapper split) is a direct mirror of an existing, tested pattern in this exact codebase
- Pitfalls: MEDIUM-HIGH — the circular-import risk (Pitfall 1) and the unexported-builders gotcha (Pitfall 5) are both verified directly against the current source; the `generatePasswordResetLink` `auth/internal-error` behavior (Pitfall 2) is CITED from a community report, not official docs, so treat that specific error-code detail as advisory rather than guaranteed

**Research date:** 2026-08-30
**Valid until:** 2026-09-29 (30 days — stable Firebase Admin SDK APIs and an internal codebase pattern match, not a fast-moving dependency)
