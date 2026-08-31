---
phase: 99-invite-email-function-owner-toggle
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - functions/src/inviteOnboarding.ts
  - functions/src/inviteOnboarding.test.ts
  - functions/src/appConfig.ts
  - functions/src/index.ts
  - src/config/appConfigDefaults.ts
  - src/components/admin/OnboardingConfigCard.vue
  - src/components/admin/ConfigurationTab.vue
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: resolved
fix_dispositions:
  - id: CR-01
    disposition: FIXED
    commit: 1ca3f730
    note: >
      Handler now requires a real organizations/{orgId}/invites/{email} record
      (written by TeamView.onInvite) before any Auth/provisioning/send — ties the
      blast radius to invites the org actually created. +CR-01 rejection test.
  - id: WR-01
    disposition: FIXED
    commit: 1ca3f730
    note: "Email subject CR/LF-sanitized via sanitizeHeader() at both send sites."
  - id: WR-02
    disposition: FIXED
    commit: 1ca3f730
    note: "Non-user-not-found getUserByEmail failure wrapped in HttpsError('internal', ...) instead of raw re-throw; test updated."
  - id: WR-03
    disposition: DEFERRED
    note: >
      Per-org email quota (checkAndConsumeOrgEmailQuota) still not wired — it
      lives in index.ts (circular-import trap). CR-01's invite-existence gate now
      caps abuse to addresses with real invite docs, so the quota is a
      defense-in-depth follow-up, not a milestone blocker. Tracked for a future phase.
  - id: IN-01
    disposition: ACCEPTED
    note: "Minor orgId trim inconsistency — cosmetic; validation already rejects empty."
  - id: IN-02
    disposition: ACCEPTED
    note: "Client mergeAppConfig intentionally lacks the server's coerce discipline — documented by-design in appConfigDefaults.ts (field components validate before save)."
  - id: IN-03
    disposition: PARTIALLY_ADDRESSED
    note: "Error-path coverage improved by the CR-01/WR-02 test additions."
---

# Phase 99: Code Review Report

**Reviewed:** 2026-08-30
**Depth:** standard
**Files Reviewed:** 7
**Status:** resolved (CR-01 + WR-01 + WR-02 fixed in 1ca3f730; WR-03 deferred, Infos accepted — see fix_dispositions)

## Summary

Reviewed the new `sendInviteOnboardingEmail` callable (Auth provisioning + Resend send), its
appConfig-based owner toggle (server + client mirror), and the Owner Console UI card that flips
it. The org-editor caller gate, the `emailsEnabled` fail-closed default, the createUser →
generatePasswordResetLink ordering, the `auth/email-already-exists` race fallback, the
gmail/googlemail domain classifier, and the best-effort-vs-throw error tiering are all correctly
implemented and match their doc comments. The re-export from `index.ts` is present, and
`appConfig.ts`/`appConfigDefaults.ts` stay value-identical for the `onboarding` group.

The main gap is architectural rather than a logic bug: the callable never verifies that the
target `(orgId, email)` pair corresponds to an actual pending invite record before provisioning
an Auth account and sending a branded email. Combined with the callable's own documented decision
to *not* enforce the per-org daily email quota, any authenticated org-editor account (the same
low privilege bar the rest of the app already grants to team members) can invoke this function
directly — independent of the TeamView UI flow that is supposed to gate it — to create orphaned
Auth accounts and email arbitrary third-party addresses under the app's own sending domain.

## Critical Issues

### CR-01: No verification that an invite record exists before provisioning an Auth account and emailing an arbitrary address

**File:** `functions/src/inviteOnboarding.ts:142-265`
**Issue:** `sendInviteOnboardingEmailHandler` only checks that the caller is an editor/admin
*member of `orgId`* (lines 164-177). It never checks that `organizations/{orgId}/invites/{email}`
(or `inviteLookup/{email}`) actually exists for the target email before:
1. creating a new Firebase Auth account for that email (`createUser({ email: normalizedEmail })`,
   line 219), or
2. generating a real password-reset/sign-in link for it and emailing it out via Resend (lines
   242-263), or
3. sending a Google-branded "you've been invited" notify email (lines 197-209).

Because this is a Cloud Functions **callable**, it is directly invokable from any authenticated
client via the Firebase SDK — not only from the intended TeamView "after the invite batch
commits" code path the module-level comment describes (lines 16-22). Any org-editor-role account
(a role granted to ordinary team leads, not just owners) can therefore call this function
repeatedly with attacker-chosen email addresses that have no relationship to a real invite, to:
- create dangling Firebase Auth accounts (uid-only, no org membership) for arbitrary third-party
  emails, at Firebase Auth's per-MAU cost, and
- send a plausible "You've been invited to {orgName} on Worship Planner" email — containing a
  genuine, working Firebase password-reset link — to any address, using the application's own
  Resend account and sending-domain reputation, with **no server-side link back to an actual
  invite**.

There is no per-call or per-org rate limit on this path (see WR-03), so the above is repeatable
at will by a single compromised or malicious editor account.

**Fix:** Before the `emailsEnabled` gate, re-verify the invite is real, e.g.:
```ts
const inviteSnap = await orgRef.collection("invites").doc(normalizedEmail).get();
if (!inviteSnap.exists) {
  throw new HttpsError("failed-precondition", "No pending invite found for this address.");
}
```
(Note `email` must be normalized to lowercase *before* this check, since `normalizedEmail` is
currently computed after the config gate — reorder so normalization happens before both the
invite check and the config gate.) At minimum, wire in `checkAndConsumeOrgEmailQuota` (see
WR-03) so a single editor cannot use this endpoint as an unbounded email/account-creation
primitive even if the invite-linkage check above is deferred.

## Warnings

### WR-01: Email subject/body interpolate `orgName` without the same CRLF stripping applied to the From header

**File:** `functions/src/inviteOnboarding.ts:93-123, 193-194`
**Issue:** `fromDisplayName(orgName)` (functions/src/params.ts:40-42) explicitly strips
`\r\n` and quote/backslash characters from the org name before it is placed in the `from`
header, with a comment noting this is specifically to close a header-injection vector. The same
`orgName` is also interpolated **unsanitized** into the email `subject` (line 98/115) and `text`
body (line 103/118) via `buildGoogleNotifyContent`/`buildSetPasswordContent`. `subject` is also a
header value; if an org's display name is set (by any org editor, in Settings) to contain CR/LF
sequences, and the Resend API does not itself re-encode/strip the `subject` field before
constructing the outbound SMTP message, this reopens the same class of header-injection risk the
`from`-field fix was written to close — e.g. injecting extra headers (`Bcc:`, `Reply-To:`) into
mail sent to arbitrary invitee addresses.
**Fix:** Reuse `fromDisplayName` (or a dedicated `sanitizeHeaderText` helper) on `orgName` before
it is interpolated into `subject`, for defense in depth:
```ts
const safeOrgName = fromDisplayName(orgName) || orgName; // or a subject-specific sanitizer
const subject = `You've been invited to ${safeOrgName} on Worship Planner`;
```

### WR-02: Loose email-format validation lets malformed addresses reach Auth APIs and surface as raw, unwrapped errors

**File:** `functions/src/inviteOnboarding.ts:60-65, 233-239`
**Issue:** `assertValidEmailFormat` only requires a non-empty string containing `@` and `.` and no
`/` — it accepts strings Firebase Auth itself will reject (e.g. `a@b@c.com`, `a@.com`,
`a@b..com`). When such a value reaches `getAuth().getUserByEmail(normalizedEmail)`, Firebase
throws with a code other than `auth/user-not-found` (e.g. `auth/invalid-email`), which hits the
`else` branch at line 233-239 and is **rethrown as-is** (`throw err;`, line 238) rather than
wrapped in a friendly `HttpsError`. This produces an opaque failure for the caller instead of the
clear `invalid-argument` message the earlier format guard is meant to provide, and depends on the
Functions runtime's default error-scrubbing behavior to avoid leaking the raw FirebaseError
message/stack to the client.
**Fix:** Either tighten `assertValidEmailFormat` (e.g. a real single-`@`/domain-has-dot regex), or
catch `auth/invalid-email` explicitly alongside `auth/user-not-found` and translate it to
`HttpsError("invalid-argument", "Enter a valid email address.")`.

### WR-03: Per-org daily email quota is not enforced on this account-creating, email-sending endpoint

**File:** `functions/src/inviteOnboarding.ts:38-42`
**Issue:** The module comment documents that `checkAndConsumeOrgEmailQuota` (already implemented
in `functions/src/index.ts:462-495` and used by `sendQueuedMessage`) is deliberately **not**
wired into this handler, citing a circular-import concern, with disposition "accept" in the
threat register. Given CR-01 above (no invite-linkage check), the absence of any quota here means
there is currently no ceiling at all on how many Auth accounts/emails a single org-editor account
can generate through this one function.
**Fix:** Move `checkAndConsumeOrgEmailQuota` (and/or `RESEND_API_KEY`/quota helpers) into
`./params.ts` or a new dependency-free module so both `index.ts` and `inviteOnboarding.ts` can
import it without a circular dependency, and consume the org's daily quota here the same way
`sendQueuedMessageHandler` does.

## Info

### IN-01: `orgId` is validated trimmed but used untrimmed for the Firestore lookup

**File:** `functions/src/inviteOnboarding.ts:150, 159, 164`
**Issue:** `orgId` is validated via `typeof orgId !== "string" || orgId.trim() === ""`, but the
raw (potentially whitespace-padded) `orgId` value is then used directly in
`db.collection("organizations").doc(orgId)` and the member-doc path, unlike `email`, which is
normalized (`.trim().toLowerCase()`) before every downstream use. A caller passing
`" org1 "` would pass validation but fail the member lookup with a generic "not a member" error
instead of resolving to the intended org.
**Fix:** `const trimmedOrgId = orgId.trim();` and use it consistently, mirroring the `email`
normalization discipline already applied elsewhere in this file.

### IN-02: Client-side `mergeAppConfig` has no type-coercion discipline, unlike the server's fail-closed coercers

**File:** `src/config/appConfigDefaults.ts:120-133`
**Issue:** The server's `mergeAppConfig` (functions/src/appConfig.ts:264-277) runs every group
through fail-closed/fail-open coercers (`coerceEnableFlag`, `coerceConfigNumber`, etc.). The
client mirror does a plain object spread (`{ ...DEFAULT_APP_CONFIG.onboarding, ...p.onboarding }`)
with no type guarding at all. A malformed `appConfig/global.onboarding.emailsEnabled` value (e.g.
written as the string `"true"` by a future bug or manual edit) would flow straight into the
`<input type="checkbox">` binding in `OnboardingConfigCard.vue` without being coerced to a real
boolean, unlike the server, which would correctly resolve it to `false` (only literal `true`
enables). Low risk today since `appConfig/global` writes are rules-gated to super-admins, but the
two mergers are asymmetric in trust discipline for what is documented as a mirrored contract.
**Fix:** At minimum coerce the `onboarding.emailsEnabled` (and other boolean) leaves with
`=== true` in the client merge, or accept the drift explicitly in the file's own doc comment.

### IN-03: Missing regression coverage for two exercised error paths

**File:** `functions/src/inviteOnboarding.test.ts`
**Issue:** The suite is otherwise thorough (caller gate, disabled toggle, both invitee branches,
the createUser race, Resend best-effort failure) but has no test for:
1. `orgId` valid/member exists but `organizations/{orgId}` itself does not exist
   (`orgSnap.exists === false` → `not-found`, inviteOnboarding.ts:180-182), and
2. an email that passes `assertValidEmailFormat` but is rejected by `getUserByEmail` with a
   non-`auth/user-not-found` code (the raw-rethrow path at line 238, related to WR-02).
**Fix:** Add both cases to `describe("caller gate", …)` / `describe("email format", …)` to lock in
the current (and any future fixed) behavior.

---

_Reviewed: 2026-08-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
