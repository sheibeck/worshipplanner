---
phase: 68-super-admin-access-gate
verified: 2026-08-20T16:10:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "R177 real-route redirect: sign in as a genuine super-admin and confirm the 'Owner Console' nav entry appears and /owner-console loads; sign in as an ordinary user and confirm the nav entry is absent and a direct visit to /owner-console redirects to the safe default (services)."
    expected: "Super-admin sees the nav entry and reaches the console; ordinary user sees neither."
    why_human: "No router-guard unit-test precedent exists in this repo (confirmed in 68-04-SUMMARY.md); requires a real signed-in browser session against a deployed/emulated backend. Undeployed per the v1.9 hand-over grant."
  - test: "R179 real grant/revoke end-to-end: from the deployed console, grant a test user by email and then revoke them; confirm the roster updates live, the target actually gains/loses superAdmin on their next token refresh, and the callable's permission-denied/not-found errors surface as readable messages."
    expected: "Roster reflects grant/revoke live; target's claim changes on next token refresh; errors are human-readable."
    why_human: "Requires the setSuperAdminClaim callable and isSuperAdmin() rules deployed/emulated end-to-end with a real second user account — not exercisable by unit/rules-emulator tests alone."
  - test: "R176 production --apply: this runbook's Step 3 (functions/DEPLOY-SUPER-ADMIN.md) actually executed against the production project (worship-planner-bc515), granting the real first owner account."
    expected: "The real owner account is bootstrapped as the first super-admin in production."
    why_human: "Nothing in the repo runs this — deploy/bootstrap is explicitly owner-run per the v1.9 hand-over grant. Only the dry-run/apply logic is proven by bootstrapSuperAdmin.test.ts's mocks."
  - test: "R179 real revoke session-cutoff timing: confirm, against a real signed-in session, that a revoked account's existing open tab actually loses access within the documented ≤1hr window (not instantly)."
    expected: "An already-issued ID token's baked-in superAdmin claim stops being honored server-side within its remaining ≤1hr lifetime after revokeRefreshTokens is called."
    why_human: "Live Firebase token-lifetime behavior; the unit test (superAdminClaims.test.ts) only proves revokeRefreshTokens(targetUid) is CALLED, not the real-world propagation timing."
---

# Phase 68: Super-Admin Access Gate & Claim-Merge Fix Verification Report

**Phase Goal:** A super-admin custom-claim gate exists end-to-end — grantable, claim-merge-safe, and enforced by both the client route and Firestore rules — establishing the security foundation every other v1.9 capability depends on.
**Verified:** 2026-08-20T16:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, R174–R179)

| # | Truth (Success Criterion) | Status | Evidence |
|---|------|--------|----------|
| 1 | A user granted via `superAdmins/{uid}` carries `superAdmin: true` on their ID token; an org-membership claim sync never strips it, nor does a super-admin grant/revoke ever strip `{orgId, role}` — both writers route through one shared merge-and-set helper (R174, R175). | ✓ VERIFIED | `functions/src/claimsHelpers.ts` (`mergeAndSetCustomClaims`/`clearClaimKeys`) is the sole writer in both `orgMembershipClaims.ts` (lines 193, 199) and `superAdminClaims.ts` (lines 57, 60) — read directly, no other `setCustomUserClaims` call site exists outside `claimsHelpers.ts` itself. Both-direction regressions genuinely assert the merge: `orgMembershipClaims.test.ts:352` ("preserves superAdmin... SC1 direction A") asserts `setCustomUserClaims` called with `{ superAdmin: true }` (not null) on an org-membership clear; `superAdminClaims.test.ts:115` ("R175-B... SC1 direction B") asserts `setCustomUserClaims` called with `{ orgId: "orgA", role: "editor" }` (superAdmin removed, org claim intact) on a revoke. All 397 functions tests pass (`cd functions && npm test`). |
| 2 | The owner can bootstrap the very first super-admin with a dry-run-by-default, `--apply`-gated, owner-run Node script requiring no pre-existing super-admin (R176). | ✓ VERIFIED | `functions/src/bootstrapSuperAdmin.ts`: `apply` defaults false in `runBootstrapCli` (only true when `--apply` is in `process.argv`); dry-run path only logs, `apply` path writes `superAdmins/{uid}` AND calls `mergeAndSetCustomClaims` directly (bypassing the trigger, so it works with zero pre-existing super-admin or even an undeployed trigger). Guarded by `require.main === module` — import-safe. Not exported from `index.ts` (confirmed by grep — only a comment references it). `bootstrapSuperAdmin.test.ts` (6 tests) passes. |
| 3 | Only a signed-in super-admin can reach `/owner-console` and its nav entry (distinctly named, not `/admins`); a non-super-admin is denied/redirected client-side (R177). | ✓ VERIFIED (code) / see human item #1 | `src/router/index.ts:81-84` defines `/owner-console` (name `owner-console`, meta `requiresSuperAdmin: true`); `beforeEach` guard (lines 135-147) forces `authStore.refreshSuperAdminClaim()` before redirecting non-super-admins to `services`. `src/components/AppSidebar.vue:165-171` gates the "Owner Console" nav entry on `authStore.isSuperAdmin`. `authStore.isSuperAdmin`/`refreshSuperAdminClaim` read from the existing `getIdTokenResult` call (`src/stores/auth.ts:146,165-176`) — no extra round-trip. Unit-proven: `src/stores/__tests__/auth.test.ts` "isSuperAdmin (R177)" (4 tests) + "refreshSuperAdminClaim (R177, Pitfall 4)" (3 tests), all pass. The real browser redirect/nav-visibility behavior is not exercisable by unit tests (no router-guard test precedent in this repo) — routed to human verification. |
| 4 | Firestore rules allow read/write of `appConfig/*` and `superAdmins/*` only to a super-admin via a claim-only `isSuperAdmin()` (no `get()`/`exists()`), proven by genuine emulator ALLOW and DENY tests (R178). | ✓ VERIFIED | `firestore.rules:38-40`: `isSuperAdmin() { return request.auth != null && request.auth.token.superAdmin == true; }` — confirmed claim-only, zero `get()`/`exists()`. `match /appConfig/{docId}` (line 473-475) and `match /superAdmins/{uid}` (line 484-486) both gate read+write on it, placed above the catch-all deny. Re-ran the live rules suite against a running Firestore emulator myself (not trusting the SUMMARY): `npx vitest run --config vitest.rules.config.ts -t "isSuperAdmin"` → **6/6 passed** (2 genuine ALLOW: super-admin writes `appConfig/global` + `superAdmins/{uid}`; 4 DENY: unauthenticated read, ordinary signed-in user read, unauthenticated write, and the naming-collision guard — an org-editor `{orgId, role:'editor'}` token denied write to `superAdmins/{uid}`). Full rules suite: 167 passed / 13 skipped, no regressions. |
| 5 | A super-admin can grant and revoke another user's super-admin access from the console; revocation takes effect on the target's next token refresh (R179). | ✓ VERIFIED (code) / see human items #2, #4 | `functions/src/superAdminClaims.ts` `setSuperAdminClaimHandler`: re-verifies caller BOTH via `request.auth.token.superAdmin` AND a fresh Firestore re-read of `superAdmins/{callerUid}` (lines 109-128); resolves target exclusively via `getAuth().getUserByEmail()` (never a client uid, lines 135-142); revoke deletes the doc then calls `getAuth().revokeRefreshTokens(targetUid)` (lines 158-159). `src/views/OwnerConsoleView.vue` performs grant/revoke exclusively via `httpsCallable(functions, 'setSuperAdminClaim')` (lines 177-183) — no direct client write to `superAdmins/*` anywhere in the file (confirmed by reading the full file). 9 `setSuperAdminClaimHandler` tests pass including explicit `permission-denied`/`unauthenticated`/`not-found` rejections and a `revokeRefreshTokens` call assertion (`superAdminClaims.test.ts:239-247`). Real end-to-end grant/revoke and real revoke-timing are not exercisable without a deployed backend and a second real account — routed to human verification. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified). All 5 code-verifiable ROADMAP success criteria hold; 4 items across truths #3 and #5 (plus R176's production apply) require a human with a live deployed/emulated backend and are properly deferred, not marked passed, per the v1.9 standing autonomy grant in `.planning/STATE.md`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/claimsHelpers.ts` | Shared read-merge-write helper | ✓ VERIFIED | `mergeAndSetCustomClaims`/`clearClaimKeys` present, no `initializeApp()` at module scope, null-only-when-empty behavior confirmed by reading the source and its 6-test suite. |
| `functions/src/orgMembershipClaims.ts` | Both write branches routed through the helper | ✓ VERIFIED | Lines 193/199: `mergeAndSetCustomClaims`/`clearClaimKeys` are the only claim writers in the switch; no direct `setCustomUserClaims` remains. |
| `functions/src/superAdminClaims.ts` | Sync trigger + privileged onCall | ✓ VERIFIED | `syncSuperAdminClaim` (`onDocumentWritten`) is the sole claim writer for grant/revoke; `setSuperAdminClaim` (`onCall`) only ever writes/deletes the source doc, never the claim directly — indirection confirmed by reading the file. |
| `functions/src/bootstrapSuperAdmin.ts` | Dry-run-default, `--apply`-gated first-grant script | ✓ VERIFIED | Confirmed via source read + `require.main === module` guard + not present in `index.ts` imports/exports. |
| `functions/src/index.ts` | Exports `syncSuperAdminClaim` + `setSuperAdminClaim` only | ✓ VERIFIED | Line 18 import, line 3123 export; grep confirms zero import/export reference to `bootstrapSuperAdmin`. |
| `firestore.rules` | Claim-only `isSuperAdmin()` + two gated match blocks | ✓ VERIFIED | Read directly; no `get()`/`exists()` in the helper; both collections gated above the catch-all deny. |
| `src/rules.test.ts` | Genuine ALLOW + DENY R178 coverage | ✓ VERIFIED | 6-test describe block confirmed by source read AND live re-run against a running Firestore emulator (6/6 pass). |
| `src/stores/auth.ts` | `isSuperAdmin` + `refreshSuperAdminClaim` from existing token read | ✓ VERIFIED | Confirmed via source read (lines 60, 146, 165-176) and `auth.test.ts` (7 tests, all pass). |
| `src/router/index.ts` | `/owner-console` route + `requiresSuperAdmin` guard with forced refresh | ✓ VERIFIED | Confirmed via source read (lines 81-84, 135-147). |
| `src/components/AppSidebar.vue` | `isSuperAdmin`-gated nav entry | ✓ VERIFIED | Confirmed via source read (lines 165-171). |
| `src/views/OwnerConsoleView.vue` | Roster shell (list/grant/revoke) via callable only | ✓ VERIFIED | Confirmed via full source read — `onSnapshot` list, `httpsCallable(functions, 'setSuperAdminClaim')` for both grant and revoke, no direct `setDoc`/`deleteDoc` against `superAdmins/*`. |
| `functions/DEPLOY-SUPER-ADMIN.md` | Owner hand-over runbook | ✓ VERIFIED | Confirmed via full read: banner, ordered rules→functions→bootstrap steps, ≤1hr residual-window disclosure, no hosting deploy, no env-file writes. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `orgMembershipClaims.ts` 'set'/'clear' branches | `claimsHelpers.ts` | direct function calls | WIRED | Lines 193, 199 — confirmed by source read. |
| `superAdminClaims.ts` trigger + onCall | `claimsHelpers.ts` | `mergeAndSetCustomClaims`/`clearClaimKeys` | WIRED | Lines 57, 60 — confirmed by source read; onCall never calls these directly (indirection preserved). |
| `bootstrapSuperAdmin.ts` | `claimsHelpers.ts` | direct call (bypasses trigger) | WIRED | Line 85 — confirmed by source read. |
| `isSuperAdmin()` (rules) ↔ `syncSuperAdminClaim` claim key ↔ `authStore.isSuperAdmin` | shared `superAdmin` claim key | byte-for-byte key agreement | WIRED | `request.auth.token.superAdmin` (rules) = `{ superAdmin: true }` (functions) = `result.claims.superAdmin` (auth.ts) — all three read/write the identical key, confirmed by reading all three files. |
| router `requiresSuperAdmin` guard | `authStore.refreshSuperAdminClaim()` | forced pre-redirect refresh | WIRED | Line 143 — confirmed by source read; closes the just-granted-refresh gap. |
| `OwnerConsoleView.vue` | `setSuperAdminClaim` callable | `httpsCallable(functions, 'setSuperAdminClaim')` | WIRED | Lines 178-182 — string matches `superAdminClaims.ts`'s onCall export name exactly. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Functions unit suite (incl. all Phase 68 regression tests) | `cd functions && npm test` | 397/397 passed (11 test files) | ✓ PASS |
| Functions standalone tsc build | `cd functions && npm run build` | exit 0, no errors | ✓ PASS |
| Root type-check (vue-tsc --build, tests included per CLAUDE.md) | `npm run type-check` | exit 0, no errors | ✓ PASS |
| App suite baseline | `npx vitest run` | 3759 passed / 1 failed / 13 skipped — the failed test is `RosterView.test.ts` (documented stale-assertion baseline); `storage.rules.test.ts` failed to even initialize (Storage emulator not running, port 9199 — documented environment limitation). No new failing file. | ✓ PASS (matches documented baseline exactly) |
| Rules suite — `isSuperAdmin` scoped, live emulator | `npx vitest run --config vitest.rules.config.ts -t "isSuperAdmin"` | 6/6 passed (2 ALLOW + 4 DENY) — **re-run live by the verifier**, not taken on SUMMARY's word; Firestore emulator confirmed listening on 127.0.0.1:8080 | ✓ PASS |
| Rules suite — full | `npx vitest run --config vitest.rules.config.ts` | `src/rules.test.ts`: 167 passed / 13 skipped (green, no regressions). `src/storage.rules.test.ts` failed — Storage emulator (port 9199) not running in this environment; documented, unrelated environment limitation (CLAUDE.md), not a Phase 68 regression. | ✓ PASS (Firestore rules) |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` convention and none were declared in the PLAN/SUMMARY files.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R174 | 68-02 | Grant via `superAdmins/{uid}` → `superAdmin: true` claim | ✓ SATISFIED | `syncSuperAdminClaimHandler` grant branch + tests. |
| R175 | 68-01, 68-02 | Claim merge-safety both directions | ✓ SATISFIED | Shared `claimsHelpers.ts`; both-direction regressions in `orgMembershipClaims.test.ts` and `superAdminClaims.test.ts`. |
| R176 | 68-02, 68-05 | Owner bootstrap script, dry-run-default, `--apply`-gated | ✓ SATISFIED (code); production run is human-only, see human item #3 | `bootstrapSuperAdmin.ts` + test; `DEPLOY-SUPER-ADMIN.md` Step 3. |
| R177 | 68-04 | Console route + nav reachable only by super-admin | ✓ SATISFIED (code); real-route redirect is human-only, see human item #1 | `router/index.ts`, `AppSidebar.vue`, `auth.ts` + tests. |
| R178 | 68-03 | Claim-only `isSuperAdmin()` rules, genuine ALLOW+DENY | ✓ SATISFIED | `firestore.rules` + `src/rules.test.ts`, re-confirmed live against emulator by this verification. |
| R179 | 68-02, 68-04 | Grant/revoke from console; revoke takes effect on next token refresh | ✓ SATISFIED (code); real end-to-end grant/revoke and real revoke-timing are human-only, see human items #2, #4 | `setSuperAdminClaimHandler` + `OwnerConsoleView.vue` + tests. |

No orphaned requirements — REQUIREMENTS.md maps R174-R179 to Phase 68 exclusively, and all six are claimed across the five plans.

### Anti-Patterns Found

None in any Phase 68 file. Scanned all created/modified files (`claimsHelpers.ts`/`.test.ts`, `orgMembershipClaims.ts`/`.test.ts`, `superAdminClaims.ts`/`.test.ts`, `bootstrapSuperAdmin.ts`/`.test.ts`, `index.ts`, `firestore.rules`, `src/rules.test.ts`, `auth.ts`, `router/index.ts`, `AppSidebar.vue`, `OwnerConsoleView.vue`, `DEPLOY-SUPER-ADMIN.md`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns. The only two `TODO` hits in `functions/src/index.ts` are pre-existing, unrelated content (a comment about a test-behavior clarification, and an email-sender-hardening TODO from an earlier phase) — neither is inside the Phase 68 `superAdminClaims` import/export block (lines 18, 3112-3123) and neither references formal follow-up incorrectly; both predate this phase and are out of scope.

### Human Verification Required

### 1. R177 real-route redirect

**Test:** Sign in as a genuine super-admin in the live app; confirm the "Owner Console" nav entry appears and `/owner-console` loads. Sign in as an ordinary user; confirm the nav entry is absent and a direct visit to `/owner-console` redirects to the safe default (`services`).
**Expected:** Super-admin reaches the console and sees the nav entry; ordinary user sees neither.
**Why human:** No router-guard unit-test precedent exists in this repo; requires a real signed-in browser session against a deployed/emulated backend, which is undeployed per the v1.9 hand-over grant.

### 2. R179 real grant/revoke end-to-end

**Test:** From the deployed console, grant a test user by email and then revoke them.
**Expected:** The roster updates live; the target actually gains/loses `superAdmin` on their next token refresh; the callable's `permission-denied`/`not-found` errors surface as readable messages.
**Why human:** Requires the `setSuperAdminClaim` callable and `isSuperAdmin()` rules deployed/emulated end-to-end with a real second user account.

### 3. R176 production `--apply`

**Test:** Run `functions/DEPLOY-SUPER-ADMIN.md`'s Step 3 for real against the production project (`worship-planner-bc515`).
**Expected:** The real first owner account is bootstrapped as super-admin.
**Why human:** Nothing in the repo runs this — deploy/bootstrap is explicitly owner-run per the v1.9 hand-over grant.

### 4. R179 real revoke session-cutoff timing

**Test:** Against a real signed-in session, revoke the account and confirm its already-open tab loses access within the documented ≤1hr window (not instantly).
**Expected:** Live Firebase token-lifetime behavior matches the documented bounded window.
**Why human:** The unit suite only proves `revokeRefreshTokens(targetUid)` is CALLED, not the real-world server-side propagation timing.

### Gaps Summary

No gaps. All five ROADMAP success criteria are code-verified with genuine, non-vacuous evidence (including a live re-run of the emulator-backed rules suite by this verifier, not a re-statement of SUMMARY claims). The four outstanding items are exactly the human-only, deploy-gated checks the v1.9 standing autonomy grant designates for owner hand-over (`.planning/STATE.md` § STANDING AUTONOMY GRANT — v1.9) — they are correctly NOT marked passed here and should be routed to `.planning/PENDING-VERIFICATION.md` as part of the `/gsd-verify-work 68` hand-over.

---

_Verified: 2026-08-20T16:10:00Z_
_Verifier: Claude (gsd-verifier)_
