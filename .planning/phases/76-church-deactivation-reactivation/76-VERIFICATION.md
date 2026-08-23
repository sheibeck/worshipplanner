---
phase: 76-church-deactivation-reactivation
verified: 2026-08-23T02:20:00Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Owner-gated deploy: `firebase deploy --only firestore:rules,storage,functions:setOrgActive --project worship-planner-bc515`"
    expected: "Deploy succeeds with no errors; setOrgActive is callable in production; firestore.rules/storage.rules are live."
    why_human: "Deploy is explicitly owner-gated per the standing v2.1 deploy policy — no plan/summary claims this ran, and it must not run as part of automated verification."
  - test: "Real-browser: a super-admin deactivates a real church from the Organizations tab; that church's real member is blocked at their next sign-in/load and sees the 'This church is deactivated' message (never a blank app)."
    expected: "The deactivated member lands on the church picker with the amber deactivation message; org-scoped data is inaccessible."
    why_human: "Requires a deployed environment, a real second user account, and visual confirmation of the message/redirect — not observable from static code or emulator unit/integration tests alone."
  - test: "Real-browser: the deactivated member's Storage access (e.g. an org media/PPTX asset) is actually denied against production Storage."
    expected: "A direct Storage read/write for the deactivated member's org fails with a permission error."
    why_human: "Depends on the deployed storage.rules and a live `deactivatedOrgs` claim on a real ID token — the emulator rules suite proves the rule logic, not the live claim-propagation/deploy path."
  - test: "Real-browser: a super-admin (with a genuine membership doc in that church) can still enter the deactivated church normally."
    expected: "The super-admin's session is unaffected — full read/write access continues."
    why_human: "Same class of live-environment/claim-propagation confirmation as above."
  - test: "Real-browser: reactivating the church restores the member's access on their next load, with no manual per-member fix-up."
    expected: "The previously-blocked member can sign in normally and see org data again, without any admin action beyond clicking Reactivate."
    why_human: "Requires observing real claim propagation / token refresh timing in a live environment."
  - test: "Real-browser visual: the Deactivate/Reactivate button and 'Deactivated' badge on the Organizations tab, and the greyed-out/disabled/labeled '(deactivated)' row in the church picker."
    expected: "Both controls render as intended, are visually clear, and match the rest of the owner-console/picker styling."
    why_human: "Visual/UX quality judgment — component tests prove the DOM attributes (disabled, label text, badge presence) but not visual appearance."
---

# Phase 76: Church Deactivation & Reactivation Verification Report

**Phase Goal:** A super-admin can take a church offline and bring it back — a reversible,
rules-enforced off-switch that blocks every member of a deactivated org while remaining fully
accessible to a super-admin.
**Verified:** 2026-08-23T02:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

This phase produced two plans (76-01 server, 76-02 client) plus a follow-up security pass
(76-SECURITY.md, verdict SECURED, fixing a critical T-76-10 privilege-escalation and its T-76-06
twin found after the initial code review closed). This report verifies the CURRENT code state —
post code-review-fix and post security-fix — against the codebase directly, not against SUMMARY.md
narrative.

## Goal Achievement

### Observable Truths (mapped to ROADMAP.md's 4 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 (R212): A super-admin-gated `setOrgActive` callable persists `active`/`deactivatedAt`/`deactivatedBy` (or `reactivatedAt`/`reactivatedBy`) on `organizations/{orgId}`; the client never flips status directly, and `firestore.rules` now blocks an ordinary editor from writing the 5 lifecycle fields directly (T-76-10 closed) | ✓ VERIFIED | `functions/src/orgProvisioning.ts:507-581` (`setOrgActiveHandler`) gated by `assertSuperAdminCaller`, writes exactly these fields via `orgRef.set(..., {merge:true})`. `firestore.rules:93-117` (`preservesLifecycleFields()`) is ANDed into both `allow write` and `allow create` on `organizations/{orgId}`, denying any editor create/update that introduces/changes any of the 5 lifecycle fields, exempting only `isSuperAdmin()`. `src/rules.test.ts:407-464` ("Org lifecycle field guard (T-76-10/T-76-06)") proves the DENY for an ordinary editor forging `active`/`deactivatedBy`/`deactivatedAt`/`reactivatedAt`/`reactivatedBy`, and a regression ALLOW for a legitimate non-lifecycle field update. `OrganizationsTab.vue` calls `httpsCallable(functions,'setOrgActive')` only — no direct Firestore write (grepped, none present). |
| 2 | SC2 (R213 client): A member of a deactivated org sees a clear "this church is deactivated" message, never a blank app | ✓ VERIFIED | `src/stores/auth.ts:361-369` wraps the primary-org `getDoc` in try/catch; a caught rejection calls `resetOrgContext()` and sets `deactivatedOrgMessage.value = DEACTIVATED_ORG_MESSAGE`, then `return`s (never leaves `isReady` unset — `isReady.value = true` still fires at `onAuthStateChanged`'s bottom, line 525). `requiresOrgSelection` (line 155-157) is widened with `hasDeactivatedOrg` so a single-org-deactivated user is routed to `/select-church`. `SelectChurchView.vue:13-21` renders `authStore.deactivatedOrgMessage` as a distinct amber block. `src/stores/__tests__/auth.test.ts` and `src/views/__tests__/SelectChurchView.test.ts` both pass (confirmed by direct run below). |
| 3 | SC3 (R213 rules): `firestore.rules` (`isOrgActive`) AND `storage.rules` (`isOrgDeactivatedForCaller` + trigger-computed `deactivatedOrgs` claim, incl. CR-01 new-member self-heal) independently deny a deactivated org's members; a super-admin-who-is-a-member is exempt | ✓ VERIFIED | `firestore.rules:31-53`: `isOrgActive(orgId)` (exists()-guarded, default-true) composed into `isOrgMember`/`isOrgEditor` via `(isOrgActive(orgId) \|\| isSuperAdmin())`. `storage.rules:44-61`: `isOrgDeactivatedForCaller(orgId)` uses the safe `.get(key,default)` accessor chain, ANDed onto the WHOLE `isOrgMemberByClaim` OR-result (not either arm individually), exempting `superAdmin==true`. `functions/src/orgMembershipClaims.ts:152-195,381-396` (`computeDeactivatedOrgsClaimForUid`, wired into `syncOrgMembershipClaimHandler`'s `set`/`clear`/`skip` branches) is the CR-01 self-heal: every membership-doc write recomputes `deactivatedOrgs` from the surviving orgs' LIVE `active` field, so a member who joins an already-deactivated org after `setOrgActive`'s one-time fan-out still gets denied. `assignOrgAdminHandler` (`orgProvisioning.ts:337-349`) additionally refuses to grow membership on a deactivated org outright (belt-and-suspenders). Emulator suite: `src/rules.test.ts` 179 tests incl. the "isOrgActive — deactivation gate" describe block (7 tests) and the T-76-10/T-76-06 lifecycle-field-guard describe block (per SECURITY.md, 5 tests); `src/storage.rules.test.ts` 22 tests incl. "storage.rules — deactivatedOrgs claim" (5 tests) and the CR-01 self-heal regression test. Both files pass 100% against the running emulator (201/201, verified directly below). |
| 4 | SC4 (R214): Reactivation fully restores access with no manual per-user fix-up — `setOrgActive` clears `deactivatedOrgs` + the trigger recomputes; no stale state | ✓ VERIFIED | `orgProvisioning.ts:527-535`: reactivate branch merges `{active:true, reactivatedAt, reactivatedBy}`; fan-out at line 544 calls `patchNestedClaimKey(uid, DEACTIVATED_ORGS_CLAIM_KEY, orgId, undefined)` for every member — deletes the org's entry, no `revokeRefreshTokens` on reactivate (never forces re-login on restore). `claimsHelpers.ts:119-135` (`patchNestedClaimKey`) is a single read-mutate-write preserving every sibling key. The trigger's `computeDeactivatedOrgsClaimForUid` recomputes on every subsequent membership write too, so no stale `deactivatedOrgs` entry can persist once the org's `active` field flips back to true. `functions/src/claimsHelpers.test.ts` and `functions/src/orgProvisioning.test.ts#setOrgActiveHandler` (reactivate cases, incl. `revokeFailures`/`claimFailures` independent tracking, WR-02) all pass. `OrganizationsTab.vue`'s `onToggleActive` calls `refreshOrgs()` on success only, matching the response contract exactly. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/orgProvisioning.ts` | `setOrgActive`/`setOrgActiveHandler`, `active` on `OrgSummary` | ✓ VERIFIED | Present, substantive, exported from `index.ts`, wired to `httpsCallable` client call |
| `functions/src/claimsHelpers.ts` | `patchNestedClaimKey` | ✓ VERIFIED | Present, TOCTOU-safe read-mutate-write, used by `setOrgActiveHandler` |
| `functions/src/orgMembershipClaims.ts` | `DEACTIVATED_ORGS_CLAIM_KEY`, `computeDeactivatedOrgsClaimForUid`, `deactivatedOrgsMapsEqual` | ✓ VERIFIED | Present, wired into `syncOrgMembershipClaimHandler`'s set/clear/skip branches (CR-01 self-heal) |
| `firestore.rules` | `isOrgActive()`, `preservesLifecycleFields()`, composed into `isOrgMember`/`isOrgEditor`/`organizations/{orgId}` writes | ✓ VERIFIED | Present and composed exactly as documented |
| `storage.rules` | `isOrgDeactivatedForCaller()`, composed into `isOrgMemberByClaim` | ✓ VERIFIED | Present, wraps the whole OR-expression (not either arm) |
| `src/stores/auth.ts` | `deactivatedOrgMessage`, `hasDeactivatedOrg`, `memberships[].active`, `resetOrgContext()` | ✓ VERIFIED | Present and wired into `loadOrgContext`/`requiresOrgSelection`/`logout`/sign-out branch |
| `src/views/SelectChurchView.vue` | disabled+labeled deactivated rows, `deactivatedOrgMessage` display | ✓ VERIFIED | Present, `:disabled="isSelecting \|\| m.active === false"`, `(deactivated)` label, amber message block |
| `src/components/admin/OrganizationsTab.vue` | Deactivate/Reactivate control | ✓ VERIFIED | Present, calls `setOrgActive` exclusively, WR-03 double-submit guard, badge, per-row error/feedback state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `setOrgActive`'s member claim fan-out | `storage.rules`' `isOrgDeactivatedForCaller` | Same `deactivatedOrgs` claim key (`DEACTIVATED_ORGS_CLAIM_KEY = "deactivatedOrgs"`) | WIRED | Verified identical string constant used on both the write side (`orgMembershipClaims.ts`) and read side (`storage.rules:45`) |
| `organizations/{orgId}.active` write | `firestore.rules`' `isOrgActive()` | Live `get()`, no claim indirection | WIRED | `firestore.rules:32-33` reads the doc directly; no propagation lag on the Firestore side, as designed |
| `setOrgActive`'s response shape | `OrganizationsTab.vue`'s `onToggleActive` | `{orgId, active, memberCount, claimFailures, revokeFailures}` | WIRED | Both sides' TypeScript interfaces match field-for-field (client interface superset-safe; `revokeFailures` present on both, added by the WR-02 code-review fix on both server and client) |
| A denied `getDoc` on `organizations/{orgId}` | `auth.ts`'s `deactivatedOrgMessage` | try/catch around the primary-org read | WIRED | `auth.ts:361-369` — catch branch sets the message and fully resets org context |
| `syncOrgMembershipClaim` trigger | `computeDeactivatedOrgsClaimForUid` | Called on every `set`/`clear`/`skip`-with-change branch | WIRED | `orgMembershipClaims.ts:418-484` — closes the CR-01 new-member-into-deactivated-org gap |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| R212 | 76-01, 76-02 | Super-admin deactivates via gated callable; client never flips status directly | ✓ SATISFIED | `setOrgActive` + `preservesLifecycleFields()` guard (T-76-10 closed) |
| R213 | 76-01, 76-02 | Deactivated org's members blocked client-side AND by rules; clear message, never blank app | ✓ SATISFIED | `isOrgActive`/`isOrgDeactivatedForCaller` + `auth.ts`/`SelectChurchView.vue` |
| R214 | 76-01, 76-02 | Reactivation restores access with no manual per-user step | ✓ SATISFIED | `setOrgActive` reactivate branch + CR-01 trigger self-heal |

REQUIREMENTS.md's tracking table independently lists all three as "Complete" for Phase 76 — no orphans, no discrepancy.

### Anti-Patterns Found

None. Scanned all 8 modified/created source files (`orgProvisioning.ts`, `claimsHelpers.ts`, `orgMembershipClaims.ts`, `firestore.rules`, `storage.rules`, `auth.ts`, `SelectChurchView.vue`, `OrganizationsTab.vue`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub-language patterns. Zero hits (one false-positive grep match on HTML `placeholder="..."` form attributes in `OrganizationsTab.vue`, not a stub marker).

### Gate Results (run directly by this verifier, not sourced from SUMMARY/SECURITY claims)

| Gate | Command | Result | Status |
|------|---------|--------|--------|
| Functions unit suite | `cd functions && npx vitest run` | 520/520 passed (14 files) | ✓ PASS — matches SUMMARY/SECURITY claim exactly |
| Rules-emulator suite (against running emulator, per CLAUDE.md) | `npx vitest run --config vitest.rules.config.ts` | 201/201 passed (179 firestore.rules + 22 storage.rules) | ✓ PASS — matches SECURITY.md's post-fix count exactly |
| Type-check | `npm run type-check` (`vue-tsc --build`) | Clean, no output/errors | ✓ PASS |
| App suite, targeted deactivation files | `npx vitest run src/stores/__tests__/auth.test.ts src/views/__tests__/SelectChurchView.test.ts src/components/admin/__tests__/OrganizationsTab.test.ts` | 123/123 passed (3 files) | ✓ PASS |
| App suite, full run | `npx vitest run` | 4046/4068 passed; 133/135 files passed. Failures: `src/storage.rules.test.ts` (3 tests, 5s-timeout under root jsdom config — needs the dedicated Storage-emulator `vitest.rules.config.ts` wiring) and `src/views/__tests__/RosterView.test.ts` (1 test, pre-existing stale "Roles config" assertion) | ✓ PASS — exactly the documented known-failing baseline (CLAUDE.md), no new regression introduced by Phase 76 |
| Git commit verification | `git log --oneline --all \| grep <hashes>` | All 6 commits found (`21ad9d90`, `d6d73ec3`, `a302a5ae`, `edb54a7b`, `c1dfeaa6`, `c906fdd9`) | ✓ PASS |

### Human Verification Required

See `human_verification` frontmatter above — 6 items, all deploy-dependent or visual/UX judgment, per the phase's stated "HAND-OVER" deploy posture (76-01-PLAN.md) and the v2.1 milestone's standing deferred-human-verification grant. None of these represent a code defect; all code-level truths for this phase are VERIFIED.

### Gaps Summary

No gaps found. All 4 ROADMAP success criteria are backed by present, substantive, and wired
code, confirmed by passing tests run directly against the current codebase (not SUMMARY
narrative): 520/520 functions unit tests, 201/201 rules-emulator tests (including the T-76-10/
T-76-06 privilege-escalation-fix regression tests and the CR-01 new-member self-heal regression
test), a clean type-check, and the app suite at its documented 2-file/22-test known-failing
baseline with zero new regressions. The only outstanding items are the owner-gated production
deploy and real-browser/visual confirmation, both explicitly out of this phase's automatable
scope per its own stated deploy posture — routed to human verification rather than treated as
gaps.

---

*Verified: 2026-08-23T02:20:00Z*
*Verifier: Claude (gsd-verifier)*
