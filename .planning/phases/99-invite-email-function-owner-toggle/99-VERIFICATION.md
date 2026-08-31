---
phase: 99-invite-email-function-owner-toggle
verified: 2026-08-31T00:00:00Z
status: passed
score: 9/9 must-haves verified (1 additional code-level defect found and CLOSED, see gap_closure below)
behavior_unverified: 0
overrides_applied: 0
gap_closure:
  - resolved: "org-editor caller gate now accepts the legacy 'admin' role (editor-equivalent), matching queueServiceMessageHandler exactly."
    commit: b1ba560f
    fix: >
      functions/src/inviteOnboarding.ts caller gate changed from `role !== "editor"` to
      `role !== "editor" && role !== "admin"`, mirroring the documented precedent. Added a
      caller-gate test asserting a legacy 'admin' member is accepted (resolves emailSent:true,
      send called once). Verified: npx vitest run functions/src/inviteOnboarding.test.ts (16/16);
      cd functions && npm run build clean.
gaps_closed:
  - truth: "org-editor caller gate mirrors queueServiceMessageHandler (99-02-PLAN.md key_link)"
    status: resolved
    reason: >
      functions/src/inviteOnboarding.ts's caller gate only accepts role === "editor" and rejects
      everything else with permission-denied. The precedent it is explicitly documented to mirror
      (queueServiceMessageHandler, functions/src/index.ts ~line 2663) accepts
      `role === "editor" || role === "admin"`. "admin" is a real, still-supported legacy member
      role in this codebase (see functions/src/orgMembershipClaims.ts:43-44,66-69,85-88 and
      src/stores/auth.ts:605,615, both of which explicitly normalize a stored `admin` role to
      `editor`-equivalent permissions) — new orgs are provisioned with role "editor" directly
      (functions/src/orgProvisioning.ts:201/213/218), so `admin` only ever appears on older,
      pre-existing member docs, but no code migrates/backfills those stored docs to "editor". A
      legacy-admin org owner, who the client already treats and displays as an editor (auth.ts's
      read-time normalization), would receive a silent permission-denied from this callable once
      Phase 100 wires TeamView to call it — contradicting the milestone goal that "every invited
      user gets an invite email" for such an org's invites.
    artifacts:
      - path: "functions/src/inviteOnboarding.ts"
        issue: "Caller gate at line 169 checks `role !== \"editor\"` only; missing the `|| role === \"admin\"` legacy-equivalence branch present in the precedent it is documented to mirror."
    missing:
      - "Add `role !== \"editor\" && role !== \"admin\"` (or equivalent normalization) to the org-editor caller gate in functions/src/inviteOnboarding.ts, matching queueServiceMessageHandler exactly."
      - "Add a test case covering a caller whose member doc has role: \"admin\" and asserting the call proceeds (not permission-denied)."
---

# Phase 99: Invite Email Function & Owner Toggle Verification Report

**Phase Goal:** A Cloud Function reliably sends the correct onboarding email for any invited address —
provisioning a Firebase Auth account and a secure set-password link for non-Google invitees, and a
sign-in-with-Google notice for Google/Gmail invitees — governed by an owner-controlled on/off switch in
the Owner Console, reusing the existing Resend send pattern (`functions/src/adminEmail.ts`).
**Verified:** 2026-08-31
**Status:** passed (1 gap found at initial verification, CLOSED in commit b1ba560f — see gap_closure in frontmatter)
**Re-verification:** Gap directly fixed + retested (16/16), functions build clean

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Non-Google invitee: Auth account created (if none) + `generatePasswordResetLink` set-password email w/ Google fallback line (R290, R291) | ✓ VERIFIED | `functions/src/inviteOnboarding.ts:207-258`; `functions/src/inviteOnboarding.test.ts` "set-password / createUser" group (7 passing tests), asserts reset link + "google" fallback text present in body |
| 2 | Google/Gmail invitee: notify-only "sign in with Google" email, NO Auth account, no password step (R289) | ✓ VERIFIED | `inviteOnboarding.ts:191-203` (`isGoogleEmail` branch); tests "google" group — `createUser` asserted never called for both `gmail.com` and `googlemail.com` |
| 3 | Already-registered non-Google address is NOT re-created; `auth/email-already-exists` race falls through cleanly (R291) | ✓ VERIFIED | `inviteOnboarding.ts:207-234`; tests "existing user" and "createUser races auth/email-already-exists" cases pass |
| 4 | `appConfig.onboarding.emailsEnabled === false` → no email for either type, `{emailSent:false, kind:'skipped-disabled'}` (R293) | ✓ VERIFIED | `inviteOnboarding.ts:179-182`; "disabled" test asserts `getUserByEmail`/`createUser`/`emails.send` never called |
| 5 | A caller that is not an authenticated org-editor of orgId is rejected before any Auth/Resend call | ✓ VERIFIED (as literally worded) — see Gap 1 for a narrower defect in this same gate | `inviteOnboarding.ts:145-171`; "caller gate" tests: unauthenticated, non-member, and role="viewer" all rejected with no `mockSend` call |
| 6 | Absent/malformed `appConfig/global` doc resolves `onboarding.emailsEnabled` to `false` (fail-closed) | ✓ VERIFIED | `functions/src/appConfig.ts:251-256` (`coerceOnboarding` uses `coerceEnableFlag`); `appConfig.test.ts` R293 cases for `"true"`, `1`, `null`, `{}`, absent group all resolve `false`, literal `true` resolves `true` — 32/32 tests pass |
| 7 | Owner Console Configuration tab shows an "Onboarding Emails" card reflecting live `onboarding.emailsEnabled`, saves immediately | ✓ VERIFIED | `src/components/admin/OnboardingConfigCard.vue`; mounted in `ConfigurationTab.vue:119/145`; `OnboardingConfigCard.test.ts` 4/4 pass |
| 8 | Toggling the checkbox calls `store.saveField('onboarding.emailsEnabled', <bool>)`; a save failure reverts + shows error | ✓ VERIFIED | `OnboardingConfigCard.vue:46-60`; test asserts revert + "Failed to save. Please try again." on rejected `saveField` |
| 9 | Server and client AppConfig mirrors carry the identical `onboarding.emailsEnabled` leaf (drift-guard) | ✓ VERIFIED | `functions/src/appConfig.ts:49-51,99-101` vs `src/config/appConfigDefaults.ts:41-43,99-101` — both `{ emailsEnabled: boolean }` / `{ emailsEnabled: false }`; `appConfigDefaults.test.ts` cross-file `toEqual` + explicit onboarding-shape assertion, 12/12 pass |

**Score:** 9/9 declared must-have truths verified. One additional defect found via independent code
inspection during Level-3 wiring verification (Gap 1 below) — a real, narrow, but demonstrable
correctness gap in a plan-declared key_link, not covered by any must-have as literally worded.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/appConfig.ts` | `onboarding.emailsEnabled` interface/default/coerce/merge | ✓ VERIFIED | All four present, fail-closed via `coerceEnableFlag` |
| `src/config/appConfigDefaults.ts` | byte-identical client mirror | ✓ VERIFIED | Value-identical; drift-guard test green |
| `src/components/admin/OnboardingConfigCard.vue` | immediate-save toggle card | ✓ VERIFIED | Exists, substantive (checkbox + save/revert logic), wired |
| `src/components/admin/ConfigurationTab.vue` | mounts `<OnboardingConfigCard />` | ✓ VERIFIED | Imported + mounted once in the Platform-configuration card list |
| `functions/src/inviteOnboarding.ts` | callable + testable handler | ✓ VERIFIED | Both exported; gmail/non-Google branching, createUser, generatePasswordResetLink, org-editor gate, toggle short-circuit all present |
| `functions/src/index.ts` | re-exports `sendInviteOnboardingEmail` | ✓ VERIFIED | `import`/`export` lines present at 21 and 3415 |
| `functions/src/inviteOnboarding.test.ts` | unit tests for all branches | ✓ VERIFIED | 15/15 passing, covers caller gate / disabled / google / set-password-createUser / email-format |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `OnboardingConfigCard.onToggleEmailsEnabled` | `store.saveField('onboarding.emailsEnabled', value)` | direct call | ✓ WIRED | `OnboardingConfigCard.vue:50` |
| `coerceOnboarding` | `mergeAppConfig`'s returned object | `functions/src/appConfig.ts` | ✓ WIRED | `appConfig.ts:272` |
| `ConfigurationTab.vue` | `<OnboardingConfigCard />` | import + mount | ✓ WIRED | `ConfigurationTab.vue:119,145` |
| `sendInviteOnboardingEmail` | `functions/src/index.ts` re-export | `import`/`export` | ✓ WIRED | Confirmed at lines 21, 3415 |
| handler | `getAppConfig(db).onboarding.emailsEnabled` short-circuit | direct call before branching | ✓ WIRED | `inviteOnboarding.ts:179-182`, precedes all Auth/Resend calls |
| non-Google branch order | `getUserByEmail` → `createUser` → `generatePasswordResetLink` → Resend | sequential awaits | ✓ WIRED | `inviteOnboarding.ts:207-258`, exact order confirmed |
| org-editor caller gate | `organizations/{orgId}/members/{callerUid}.role === 'editor'` | inline read | ⚠️ PARTIAL | Present and wired, but does **not** fully mirror `queueServiceMessageHandler` as documented — see Gap 1. It rejects a real, still-valid legacy `role: "admin"` caller that the rest of the codebase treats as editor-equivalent. |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Handler unit tests (all requirement branches) | `npx vitest run functions/src/inviteOnboarding.test.ts` | 15/15 passed | ✓ PASS |
| Server appConfig fail-closed tests | `cd functions && npx vitest run src/appConfig.test.ts` | 32/32 passed | ✓ PASS |
| Client drift-guard tests | `npx vitest run src/config/__tests__/appConfigDefaults.test.ts` | 12/12 passed | ✓ PASS |
| OnboardingConfigCard component tests | `npx vitest run src/components/admin/__tests__/OnboardingConfigCard.test.ts src/components/admin/__tests__/ConfigurationTab.test.ts` | 7/7 passed | ✓ PASS |
| Functions build (tsc) | `cd functions && npm run build` | clean, no errors | ✓ PASS |
| Full type-check | `npm run type-check` (vue-tsc --build) | clean, no errors | ✓ PASS |
| Full bare test suite (regression gate) | `npx vitest run` | 173/174 files passed, 4710 tests passed, 26 skipped; only `src/storage.rules.test.ts` fails (documented Storage-emulator baseline, `ECONNREFUSED 127.0.0.1:8080`) | ✓ PASS (matches documented baseline exactly) |
| Forbidden-import check | grep for `buildInvitedContent`/`buildAddedContent`/`resolveAppBaseUrl`-import / `checkAndConsumeOrgEmailQuota`-from-index | none found (only a documenting comment mentions the deferral) | ✓ PASS |
| Debt-marker scan | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across all 6 phase files | none found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R289 | 99-02 | Google/Gmail invitee gets sign-in-with-Google notice, no Auth account | ✓ SATISFIED | `isGoogleEmail` branch + "google" test group |
| R290 | 99-02 | Non-Google invitee gets a secure set-password link email | ✓ SATISFIED | `buildSetPasswordContent` + `generatePasswordResetLink` + "set-password" tests. Real delivery to non-owner inboxes requires owner-run Resend DNS verification — out of code scope per instructions, not re-checked here. |
| R291 | 99-02 | Server-side provisions the Firebase Auth account for non-Google invitees | ✓ SATISFIED | `createUser` call gated on `auth/user-not-found`; race handled |
| R293 | 99-01 + 99-02 | Owner on/off switch in Owner Console, honored by the function | ✓ SATISFIED | `OnboardingConfigCard.vue` + `appConfig.onboarding.emailsEnabled` + handler short-circuit, all confirmed |

No orphaned requirements — R288, R292, R294 are correctly mapped to Phase 100 in REQUIREMENTS.md's
traceability table, not this phase's declared requirement IDs (R289, R290, R291, R293), which match
exactly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `functions/src/inviteOnboarding.ts` | 169 | Caller gate narrower than its documented precedent (`role !== "editor"` only, missing legacy `"admin"` equivalence) | ⚠️ Warning | A real class of legitimate callers (legacy-admin-role org owners) would be incorrectly rejected once Phase 100 wires this function to TeamView's invite UI — see Gap 1 |

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER), no stub returns, no hardcoded-empty data, and no
disconnected props found in any of the 9 files this phase created or modified.

### Human Verification Required

None. All declared must-haves are mechanically verifiable and were verified against real test runs (not
SUMMARY claims). Real-email-delivery-to-external-inboxes (Resend DNS dependent) and Firebase Auth
Email/Password provider enablement are explicitly out of code scope per REQUIREMENTS.md and this phase's
own CONTEXT.md, and were excluded from this verification as instructed.

### Gaps Summary

All 9 of the plan's declared must-have truths (4 from 99-01, 5 from 99-02) are verified against real,
passing, behavioral tests — not SUMMARY narrative. The three roadmap Success Criteria (non-Google
provisioning + set-password email, Google notify email, owner toggle) are all demonstrably true in the
codebase, with both AppConfig mirrors byte/value-identical and the full 173-of-174-file baseline holding
with zero new failures.

One gap was found through independent Level-3 wiring inspection, not from a failed must-have as literally
worded: `functions/src/inviteOnboarding.ts`'s org-editor caller gate checks `role === "editor"` only,
while the precedent it is explicitly documented (in both 99-CONTEXT.md and 99-02-PLAN.md) to mirror —
`queueServiceMessageHandler` — accepts `role === "editor" || role === "admin"`. `"admin"` is a genuine,
still-live legacy member-role value elsewhere normalized to editor-equivalent permissions throughout the
codebase (client-side display, custom-claims building), with no data migration ever converting stored
member docs away from it. This means a legacy-admin org owner — indistinguishable to themselves in the
UI from an editor — would receive a silent `permission-denied` from this callable once Phase 100 wires
TeamView to call it, undermining the milestone's stated goal that no invitee is left without a
notification email. This is a small, well-scoped, single-line fix (add the `admin` equivalence to the
gate, exactly matching the cited precedent) plus one missing test case.

This gap does not block the phase's three literal roadmap Success Criteria, all of which are satisfied
for the primary (editor-role) caller path. It is flagged because it is an objectively demonstrable
deviation from a documented design contract (the key_link's own "mirrors X" claim) with a real,
non-hypothetical production impact, and should be closed before or alongside Phase 100's client wiring.

---

_Verified: 2026-08-31_
_Verifier: Claude (gsd-verifier)_
