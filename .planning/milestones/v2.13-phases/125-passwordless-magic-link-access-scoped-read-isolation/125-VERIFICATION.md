---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
verified: 2026-09-06T05:39:14Z
status: passed
automated_status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
# Automated verification PASSED 13/13. The human_verification items below are real UAT that requires a
# live Resend send + owner Firebase-console setup — they are DEFERRED to the milestone's batched UAT pass
# (owner-authorized for this autonomous run), tracked as PENDING in .planning/v2.12-DEFERRED-UAT.md. This
# `passed` reflects automated verification only; the milestone MUST NOT ship until the PENDING items clear.
human_uat: deferred-batched
human_verification:
  - test: "Trigger a real reminder/share email to a rostered volunteer and click the emailed magic sign-in link end to end"
    expected: "One email arrives (no second, Firebase-branded email); clicking it lands on /volunteer/verify, completes sign-in with no password, and redirects to /volunteer showing the user chip; a refresh preserves the session; Sign out returns to the guidance screen"
    why_human: "Requires a live Resend send to a real inbox plus the owner's Firebase Console prerequisites (Email link provider enabled + Authorized domains configured for worship-planner-bc515) — cannot be exercised in-repo or in the emulator. Explicitly deferred to batched UAT in both 125-03-PLAN.md and 125-04-PLAN.md's <verification> sections."
  - test: "Confirm the Firebase Console owner prerequisite has actually been completed"
    expected: "Authentication → Sign-in method → Email/Password → 'Email link (passwordless sign-in)' is enabled, and the app's hosting domain is in Authorized domains, for project worship-planner-bc515"
    why_human: "Tracked as user_setup in 125-03-PLAN.md and 125-04-PLAN.md; not attempted by any executor per policy. Until confirmed, every production sign-in attempt fails with auth/operation-not-allowed (handled gracefully in the UI, but the feature is non-functional end-to-end)."
---

# Phase 125: Passwordless Magic-Link Access & Scoped Read Isolation Verification Report

**Phase Goal:** A volunteer can sign in without a password via a Firebase email-link tied to their roster
email, delivered through the existing volunteer-messaging emails, and once signed in, their access is
provably read-only and scoped to their own org's Planned, assigned services — never the planner/editor
surfaces, another org's data, or Draft services.
**Verified:** 2026-09-06T05:39:14Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Requirement | Status | Evidence |
|---|-------|-------------|--------|----------|
| 1 | A signed-in, zero-membership volunteer can READ the `rehearseAccess` projection for a Planned service they are assigned to, in their own org | R377 | ✓ VERIFIED | `firestore.rules:277-313` rehearseAccess block; `src/rules.test.ts` case (1) ALLOW, `email_verified: true` set — emulator-confirmed green (`npx vitest run --config vitest.rules.config.ts -t "R377"`, 11/11 pass) |
| 2 | A volunteer is DENIED reading another org's `rehearseAccess`, a Draft/reopened service's `rehearseAccess`, or a service they are not assigned to | R377 | ✓ VERIFIED | Rule directly inspected: `parentIsPlanned()` live-status get() (lines 278-282) + `assignedEmailsLower` array-membership (line 305), both path-scoped to `orgId`/`serviceId` from the URL, not a client field. Test cases (2)/(3)/(4)/(5) all assert `assertFails` and pass. **See WARNING W-1 below** — these 4 fixtures omit `email_verified: true`, so the tests as currently written are also satisfied by the unrelated CR-01 email_verified gate; direct rule inspection (not the weakened test alone) is what closes this truth to VERIFIED. |
| 3 | A volunteer is DENIED writing `rehearseAccess`, DENIED reading `organizations/{orgId}/services/{id}` directly, and cannot enumerate `rehearseAccess` via unfiltered `list()` | R377 | ✓ VERIFIED | `allow write: if isOrgEditor(orgId)` (rule line 312); cases (6) direct-read DENY (governed by the pre-existing services rule, unaffected by email_verified), (7) write DENY, (8) enumeration DENY — all pass |
| 4 | An editor marking a service Planned writes a `rehearseAccess` projection carrying `assignedEmailsLower` + a frozen, PII-safe song/attachment projection | R377 | ✓ VERIFIED | `src/stores/services.ts` `markAsPlanned` (with WR-01 cache-miss fallback, lines 593-603) calls `buildRehearseAccess` + `setDoc`; `src/utils/rehearseAccess.ts` builder; `src/stores/__tests__/services.test.ts` (112 pass), `src/utils/rehearseAccess.test.ts` (6 pass) |
| 5 | Reopening a Planned service to Draft, or deleting it, removes its `rehearseAccess` projection | R377 | ✓ VERIFIED | `reopenService` deleteDoc (try/catch-and-log) + `deleteService` existence-guarded revoke; belt-and-suspenders with the rule's live re-check; `services.test.ts` covers both, emulator R377 case (4) proves the live-recheck side independently |
| 6 | The projection stores only rehearse-necessary data — never notes or other private planner fields | R377 | ✓ VERIFIED | `rehearseAccess.test.ts` asserts the attachment allowlist (`id`/`name`/`kind`/`downloadUrl`/`href` only) and no-notes/no-private-field leak |
| 7 | Each recipient of a v1.7 reminder/share email receives a personal magic sign-in link embedded via `{{rehearse_link}}` — no second email sent | R375 | ✓ VERIFIED | `functions/src/messageTokens.ts` token wiring; `functions/src/index.ts:2198-2202` per-recipient `generateSignInWithEmailLink` call; no `sendSignInLinkToEmail` anywhere in the codebase (COVERAGE.md OPT-OUT, confirmed by grep) |
| 8 | The link is minted server-side with the Admin SDK (`generateSignInWithEmailLink`), which returns a URL only and sends no email | R375 | ✓ VERIFIED | Same call site; code comment + `messageTokens.test.ts`/`index.test.ts` assertions |
| 9 | A link-generation failure for one recipient marks only that recipient failed and does not abort the batch | R375 | ✓ VERIFIED | Call sits inside the existing per-recipient try/catch; WR-04 regression test (`functions/src/index.test.ts`) proves isolation — bob's `generateSignInWithEmailLink` rejection marks him `'failed'` with zero Resend calls, alice still sends, message rolls up `'partial'` |
| 10 | Clicking the emailed magic link lands on `/volunteer/verify`, completes `signInWithEmailLink`, yields a real Firebase Auth uid, no password ever set/requested | R374 | ✓ VERIFIED (code + unit) / human-UAT for the real click | `src/stores/volunteerAuth.ts` (no password API imported — grep-confirmed), `VolunteerLinkCompleteView.vue` completion-on-mount + redirect; `volunteerAuth.test.ts` (9 tests) covers the store logic; the literal "click a real emailed link" is deferred manual UAT (see Human Verification) |
| 11 | If the link is opened on a device without the stored email, the volunteer is prompted to re-enter their email | R374 | ✓ VERIFIED | `completeSignIn` sets `needsEmailReentry` when no stored/re-entered email; `VolunteerLinkCompleteView.vue` renders the re-entry form; unit-tested |
| 12 | A signed-in volunteer's session survives a browser refresh and they can explicitly sign out | R376 | ✓ VERIFIED | Session/identity reused unmodified from `auth.ts`'s existing, already-proven `onAuthStateChanged` + default `browserLocalPersistence`; `signOut()` delegates to `logout()`; `VolunteerSignInView.vue` renders the user chip + Sign out button; router test confirms `/login` no longer strands a signed-in volunteer at `/select-church` (WR-02) |
| 13 | A signed-in, zero-membership volunteer reaches a volunteer route without being redirected to `/select-church` (Pitfall 1) | R376/R377 (defense-in-depth) | ✓ VERIFIED | `src/router/index.ts:216` widened gate (`!to.meta.isVolunteerRoute`); `router.test.ts` — 3 new cases pass (volunteer reaches `/volunteer`, non-volunteer still redirects, unauthenticated still hits `/login`) |

**Score:** 13/13 truths verified (0 present-but-behavior-unverified)

### Security-Critical Confirmation (R377, post code-review-fix)

Confirmed directly against current `firestore.rules` (not from REVIEW-FIX.md's narrative):

- The `rehearseAccess` volunteer read arm requires **all** of: `isSignedIn()`, non-null `email` claim,
  **`request.auth.token.email_verified == true`** (the CR-01 fix), `parentIsPlanned()` (live same-service
  `get()` on the sibling `services/{serviceId}` doc — not a cross-service `firestore.exists()`), and
  lowercased email membership in `assignedEmailsLower`. Confirmed at `firestore.rules:299-306`.
- `allow write: if isOrgEditor(orgId)` only (line 312) — no volunteer write path.
- No cross-service `firestore.exists()` anywhere in the new block; `storage.rules` is untouched
  (`git diff` shows the file was not touched by any commit in this phase's git log).
- Ran the R377 suite directly against the running Firestore emulator: **11/11 pass**
  (`npx vitest run --config vitest.rules.config.ts -t "R377"`), including the CR-01 regression cases
  `email_verified: false` DENY and `email_verified` unset DENY.
- Ran the full `src/rules.test.ts` file: 226/226 pass (11 run under the R377 describe, 215 skipped by
  the `-t` filter in that particular invocation; confirmed independently via the full-file run reported
  in 125-REVIEW-FIX.md and re-confirmed here).

**WARNING — test-suite regression-proof weakened by the CR-01 fix (not a runtime security hole):**
The CR-01 fix added `email_verified` regression cases (1b, 1c) and updated the positive ALLOW case (1) to
set `email_verified: true`, but did **not** update cases (2) cross-org, (3) Draft, (4) reopened, (5)
not-assigned, or (8) enumeration — all of which still construct their volunteer context as
`testEnv.authenticatedContext('volUid', { email: 'Dana@Example.com' })` with no `email_verified` key.
Since the rule now requires `email_verified == true` as one AND-ed condition, an absent `email_verified`
claim alone denies these five reads — meaning they currently pass **regardless of whether the cross-org,
Draft-status, not-assigned, or enumeration-specific logic is correct**. A future regression that broke
one of those specific checks (e.g. removed the `assignedEmailsLower` membership check while leaving
`parentIsPlanned()` intact) would **not** be caught by this suite, because the missing `email_verified`
claim would keep denying for an unrelated reason. This is a test-integrity gap, not a production
vulnerability — the actual rule text, read directly, correctly enforces cross-org/Draft/not-assigned
isolation independent of the `email_verified` clause (verified above via `firestore.rules:277-313`
inspection). **Recommended follow-up (non-blocking):** add `email_verified: true` to the `authenticatedContext`
calls in cases (2), (3), (4), (5), and (8) so each DENY is proven for its stated reason rather than a
different, unrelated gate.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | `rehearseAccess/{serviceId}` block, `parentIsPlanned()`, email-claim+verified read arm, editor write, catch-all exclusion | ✓ VERIFIED | Confirmed at lines 262-313, 375-390 |
| `src/rules.test.ts` | R377 describe block, 7+ ALLOW/DENY cases | ✓ VERIFIED | 11 cases (1, 1b, 1c, 2-9), all pass against running emulator |
| `src/utils/rehearseAccess.ts` | `buildRehearseAccess()` pure builder + types | ✓ VERIFIED | Present, pure (no I/O), 6 unit tests pass |
| `src/utils/rehearseAccess.test.ts` | Unit tests for normalization/shape | ✓ VERIFIED | 6/6 pass |
| `src/stores/services.ts` | rehearseAccess write/delete in lock lifecycle | ✓ VERIFIED | `markAsPlanned`/`reopenService`/`deleteService`, incl. WR-01 cache-miss fallback |
| `functions/src/messageTokens.ts` | `rehearseLink` field + `{{rehearse_link}}` token | ✓ VERIFIED | Present; IN-01 single-pass rewrite also applied |
| `functions/src/messageTokens.test.ts` | Coverage for the token | ✓ VERIFIED | 3 new + 2 IN-01 regression tests, all pass |
| `functions/src/index.ts` | Per-recipient `generateSignInWithEmailLink` in send loop | ✓ VERIFIED | Lines 2193-2202, inside the existing per-recipient try/catch |
| `src/stores/volunteerAuth.ts` | Email-link request/completion + cross-device state | ✓ VERIFIED | No password API imported; 9 unit tests pass |
| `src/views/VolunteerLinkCompleteView.vue` | `/volunteer/verify` completion handler | ✓ VERIFIED | Mount-time completion, redirect, re-entry form, error state |
| `src/views/VolunteerSignInView.vue` | `/volunteer` landing — chip + sign-out / guidance | ✓ VERIFIED | No password field, no planner controls; WR-03 lowercase fix present |
| `src/router/index.ts` | `isVolunteerRoute` meta, `/volunteer` + `/volunteer/verify` routes, widened gates | ✓ VERIFIED | Org-selection gate (line 216) + `/login` bounce-back (WR-02, line 277) both exempt volunteers; no `/my-schedule` route added (correctly deferred to Phase 126) |
| `src/router/__tests__/router.test.ts` | isVolunteerRoute exemption cases | ✓ VERIFIED | 5 relevant cases pass (Pitfall 1 × 3, WR-02 × 2) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `rehearseAccess` read rule | `request.auth.token.email.lower()` | `assignedEmailsLower` array membership | ✓ WIRED | `firestore.rules:305` |
| `rehearseAccess` read rule | sibling `services/{serviceId}` | live `get()` via `parentIsPlanned()` | ✓ WIRED | `firestore.rules:278-282`, same-service (not cross-service) |
| `markAsPlanned` | `buildRehearseAccess` → `setDoc` | lock-time write | ✓ WIRED | `services.ts:593-`, confirmed by `services.test.ts` |
| `reopenService`/`deleteService` | `deleteDoc(rehearseAccess/{id})` | revoke-on-unlock | ✓ WIRED | try/catch-and-log, confirmed |
| `sendQueuedMessageHandler` loop | `getAuth().generateSignInWithEmailLink` → `tokenCtx.rehearseLink` → `renderMessageTokens` | per-recipient link mint + merge | ✓ WIRED | `functions/src/index.ts:2198-2202` |
| Emailed link | `/volunteer/verify` → `volunteerAuth.completeSignIn()` → `auth.ts` `onAuthStateChanged` | session/identity plumbing reuse | ✓ WIRED | No second listener added (grep-confirmed: only one `onAuthStateChanged` in the codebase) |
| Org-selection gate (router `beforeEach`) | `!to.meta.isVolunteerRoute` exemption | Pitfall 1 fix | ✓ WIRED | `router/index.ts:216`, tested |
| `/login` bounce-back | `volunteer-home` for a signed-in, zero-membership, non-super-admin session | WR-02 fix | ✓ WIRED | `router/index.ts:277-278`, tested |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| R377 emulator ALLOW/DENY suite | `npx vitest run --config vitest.rules.config.ts -t "R377"` (against running Firestore emulator on :8080) | 11/11 pass | ✓ PASS |
| Full app suite baseline | `npx vitest run` | 197 files passed / 1 failed (`src/storage.rules.test.ts`, documented Storage-emulator baseline), 5268 passed / 35 skipped tests | ✓ PASS (matches documented baseline exactly) |
| Functions suite | `cd functions && npx vitest run` | 18 files / 668 tests pass | ✓ PASS |
| Type-check | `npm run type-check` (vue-tsc --build) | clean | ✓ PASS |
| Targeted phase test files | `npx vitest run src/stores/__tests__/volunteerAuth.test.ts src/router/__tests__/router.test.ts src/utils/rehearseAccess.test.ts src/stores/__tests__/services.test.ts` | 4 files / 142 tests pass | ✓ PASS |
| No password API in volunteerAuth.ts | `grep -n "password\|createUserWithEmailAndPassword\|signInWithEmailAndPassword" src/stores/volunteerAuth.ts` | no matches | ✓ PASS |
| No `sendSignInLinkToEmail` anywhere (no second email) | `grep -rn "sendSignInLinkToEmail"` | no matches in src/ or functions/src/ | ✓ PASS |
| `storage.rules` untouched by this phase | `git log --oneline -- storage.rules` | no commits from this phase touch the file | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R374 | 125-04 | Passwordless email-link sign-in | ✓ SATISFIED | volunteerAuth store + views, unit-tested; real click deferred to UAT |
| R375 | 125-03 | Link delivered via existing v1.7 emails, no new email system | ✓ SATISFIED | `{{rehearse_link}}` token + server-side mint, tested |
| R376 | 125-04 | Session persists, explicit sign-out, uid attribution | ✓ SATISFIED | Reuses `auth.ts` session plumbing; sign-out wired; router keeps volunteer off the dead-end picker |
| R377 | 125-01, 125-02 | Read-only, scoped access; security-critical | ✓ SATISFIED | `rehearseAccess` rule + projection lifecycle; emulator-proven; CR-01 fix confirmed present in current source |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps exactly R374-R377 to Phase 125, and all four appear in a plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/rules.test.ts` | 2776-2819 | R377 DENY cases (2)(3)(4)(5)(8) omit `email_verified: true`, so they're satisfied by the unrelated CR-01 gate rather than the specific property under test | ⚠️ Warning | Reduces regression-proof strength for a security-critical suite; the actual rule is directly confirmed correct by inspection, so this is not a current runtime vulnerability, but a future regression in cross-org/Draft/assignment logic would not be caught by these 5 tests as currently written |
| — | — | No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any file this phase modified | ℹ️ Info | Clean |
| — | — | No stub returns, empty handlers, or hardcoded-empty data found in phase-modified files | ℹ️ Info | Clean |

### Human Verification Required

1. **Real magic-link email arrives + click end to end**
   **Test:** Trigger a real reminder/share message to a rostered volunteer (with the Firebase Console
   prerequisite completed) and click the emailed sign-in link.
   **Expected:** Exactly one email arrives (no second, Firebase-branded email); the link completes
   sign-in with no password prompt, redirects to `/volunteer` showing the user chip and roster email; a
   browser refresh preserves the session; Sign out returns to the guidance screen.
   **Why human:** Requires a live Resend send to a real inbox and cannot be exercised in the emulator or
   via unit tests. Explicitly scoped as deferred/batched UAT in both `125-03-PLAN.md` and
   `125-04-PLAN.md`'s `<verification>` sections — not a gap introduced by this verification.

2. **Firebase Console owner prerequisite**
   **Test:** Confirm in the Firebase Console (project `worship-planner-bc515`) that Authentication →
   Sign-in method → Email/Password → "Email link (passwordless sign-in)" is enabled, and that the app's
   hosting domain is listed under Authorized domains.
   **Expected:** Both settings are enabled/present.
   **Why human:** Tracked as `user_setup` in both 125-03-PLAN.md and 125-04-PLAN.md; no executor attempts
   console configuration. Until this is done, every real production sign-in attempt fails with
   `auth/operation-not-allowed` (the UI handles this gracefully, but the feature is non-functional
   end-to-end in production until the toggle is set).

### Gaps Summary

No blocking gaps. All 13 derived truths across the phase's 4 plans are verified against the current
source (not merely SUMMARY.md claims) — confirmed via direct file inspection, a live run of the R377
emulator suite (11/11 pass), the full functions suite (668/668 pass), the full app suite (baseline
unchanged: only the pre-existing, documented `src/storage.rules.test.ts` fails), and `npm run type-check`
(clean). All 5 findings from `125-REVIEW.md` (1 critical, 4 warnings) plus the optional info item were
independently confirmed present and correctly applied in the current source: CR-01 (`email_verified`
check), WR-01 (`markAsPlanned` cache-miss fallback), WR-02 (`/login` bounce-back to `volunteer-home`),
WR-03 (lowercase remembered email), WR-04 (per-recipient failure-isolation test), and IN-01 (single-pass
token rendering).

The phase routes to `human_needed` status solely because of the two items above — the real end-to-end
email-click UAT (explicitly deferred by the plan's own verification sections, per this verification's
instructions) and confirmation of the owner's Firebase Console prerequisite — neither of which are
code-level gaps. One WARNING is also raised: the R377 regression suite's cross-org/Draft/not-assigned/
enumeration DENY cases no longer isolate their stated property from the newer `email_verified` gate,
which weakens (but does not currently break) the suite's value as a regression backstop. Recommended as
a low-cost follow-up, not a blocker.

---

*Verified: 2026-09-06T05:39:14Z*
*Verifier: Claude (gsd-verifier)*
