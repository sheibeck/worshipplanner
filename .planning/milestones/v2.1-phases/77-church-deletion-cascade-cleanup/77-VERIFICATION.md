---
phase: 77-church-deletion-cascade-cleanup
verified: 2026-08-23T04:10:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Owner deploys `firebase deploy --only functions:deleteOrganization,firestore:rules --project worship-planner-bc515`, then as a super-admin in a real browser: deactivate a real test church, click Delete, type its exact name, confirm."
    expected: "The org doc, every subcollection under organizations/{orgId}, orgNames/{normalizedName}, every inviteLookup doc for that org, each affected member's users/{uid}.orgIds entry (via arrayRemove, other orgs' entries intact), all 5 orgId-keyed top-level collections' matching docs, and every Storage object under orgs/{orgId}/ are gone in production Firestore/Storage; no OTHER org's data is touched."
    why_human: "deleteOrganization has never been deployed or invoked against real/emulator data — orgDeletion.test.ts uses an entirely mocked Admin SDK. Production Firestore/Storage state after a real cascade cannot be observed by static analysis or the mocked unit suite."
  - test: "As a real logged-in super-admin, attempt to delete a still-ACTIVE org (Delete control should be disabled); as a non-super-admin, attempt to call deleteOrganization directly."
    expected: "The Delete control is visually disabled for an active org; a non-super-admin's call is rejected with permission-denied/unauthenticated before any data is touched."
    why_human: "Requires a real authenticated session against deployed Cloud Functions; the caller-gate and active-gate logic is unit-tested against mocks (verified below) but not exercised end-to-end against the live deployment."
  - test: "Visual/UX check of DeleteOrgConfirmDialog in a real browser: destruction-echo copy legibility, focus trap, Escape/backdrop/Cancel behavior, and the Delete control's enabled-only-when-deactivated state on the actual Organizations table styling."
    expected: "Dialog reads clearly, focus lands on Cancel on open, typing the exact org name (and only the exact name) enables Delete, and the row-level Delete button is visibly disabled for an active org."
    why_human: "Visual rendering, focus behavior under real browser event timing, and CSS-driven enabled/disabled affordance are not verifiable via jsdom unit tests alone."
---

# Phase 77: Church Deletion — Cascade Cleanup Verification Report

**Phase Goal:** A super-admin can permanently and completely remove a deactivated church — every
Firestore document, every cross-reference, and every Storage object gone, with no orphan left behind,
guarded by extra confirmation and a STRIDE threat model proving the destructive path is safe.
**Verified:** 2026-08-23T04:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Deleting an ACTIVE org is refused with a clear message before any cascade read (R215) | ✓ VERIFIED | `functions/src/orgDeletion.ts:112-120` reads `active` fresh at call start (`?? true`), throws `failed-precondition` immediately after; `orgDeletion.test.ts` "eligibility gates" tests (absent-active and explicit-true cases) assert this happens *before* any cascade read via the fakes' spies. Live run: 544/544 functions tests pass. |
| 2 | Super-admin-gated callable re-verifies the caller; client cannot bulk-delete `organizations/*`/subcollections/`orgNames/*`/`inviteLookup/*` directly; `firestore.rules` DENY on org-doc delete (R216) | ✓ VERIFIED | `assertSuperAdminCaller(request)` is literally line 1 of `deleteOrganizationHandler` (`orgDeletion.ts:95`), imported (not forked) from `orgProvisioning.ts:95`. `firestore.rules`: `allow write` narrowed to `allow update` (line ~124) + unconditional `allow delete: if false;` added after `allow create` — confirmed by direct read of the rules file. `src/rules.test.ts:487-501` ("Org deletion DENY") asserts `assertFails` on `deleteDoc(organizations/orgA)` for BOTH an ordinary editor and a super-admin client context. Live run against the running emulator: 203/203 rules tests pass, including both new DENY tests. |
| 3 | After deletion, no document remains under `organizations/{orgId}` (R217) | ✓ VERIFIED | `getFirestore().recursiveDelete(orgRef)` is the last cascade step (`orgDeletion.ts:202`), after every cross-reference read/write and Storage sweep. `orgDeletion.test.ts` "cascade call order" test proves via a shared call-order array that reads (members/inviteLookup/orgNames/5-extras) precede `getFiles`/`deleteFiles`/`recursiveDelete`, and the "recursiveDelete" describe block asserts it is called with the org's own ref, last. `recursiveDelete` itself is a trusted, well-established Firebase Admin SDK primitive (not this codebase's implementation) — its own guarantee of removing every doc under the path is out of scope to re-verify, only correct ordering/invocation is. |
| 4 | Cross-references gone (`orgNames`, all `inviteLookup`, each member's `users/{uid}.orgIds` via `arrayRemove` preserving other orgs) + the 5 orgId-keyed top-level collections + all Storage under `orgs/{orgId}/` (R218, R219) | ✓ VERIFIED | Code: `orgDeletion.ts:142-196` reads/deletes exactly this scope; `EXTRA_ORG_KEYED_COLLECTIONS` (line 38-44) lists `shareTokens`/`serviceShareLinks`/`orgSlugs`/`quarterShares`/`serviceShares`; member unlink uses `FieldValue.arrayRemove(orgId)` (merge-set, never overwrite, line 81/164); Storage uses `bucket.deleteFiles({prefix: 'orgs/${orgId}/', force: true})` (line 193-196). Tests: "member unlinking" (arrayRemove-not-overwrite, other members untouched), "inviteLookup cleanup" (cross-org isolation), "orgNames guard" (3 tests: match/different-org/nonexistent), "extra orgId-keyed collections" (cross-org isolation, sums all 5), "Storage cleanup" (prefix + force:true + count) all pass in the live 544/544 run. |
| 5 | Type-to-confirm UI echoes destruction scope + irreversible label; interrupted deletion retries safely (idempotent) with a summary (R220, R221) | ✓ VERIFIED | `DeleteOrgConfirmDialog.vue` renders `orgName`/`memberCount`/`pendingCount` and "This cannot be undone" (lines 44-55); Delete button `:disabled` is `confirming || typedName.trim() !== props.orgName.trim()` (line 148-150), structurally not just visually. `OrganizationsTab.vue` Delete button `:disabled="org.active !== false"` (line 162). `orgDeletion.test.ts` "idempotent retry" describe block (2 tests) proves a second call against an already-clean state completes without throwing, returns zeroed counts, and never touches another org's data. All confirmed passing in the live 544/544 (functions) and app-suite runs. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/orgDeletion.ts` | `deleteOrganizationHandler` + `deleteOrganization` callable + `EXTRA_ORG_KEYED_COLLECTIONS` | ✓ VERIFIED | Exists, substantive (230 lines, full cascade logic), wired (imported by `index.ts`) |
| `functions/src/orgDeletion.test.ts` | Full behavior coverage | ✓ VERIFIED | 26 tests across 10 describe blocks, all passing |
| `firestore.rules` (`organizations/{orgId}` block) | `write`→`update` narrowing + unconditional `allow delete: if false;` | ✓ VERIFIED | Confirmed present at the expected location with the documented load-bearing comment |
| `src/rules.test.ts` | Two new delete-DENY emulator tests | ✓ VERIFIED | Lines 487-501, both passing against the live emulator |
| `src/components/admin/DeleteOrgConfirmDialog.vue` | Type-to-confirm destructive dialog | ✓ VERIFIED | New standalone component, props-in/events-out, no Firestore imports |
| `src/components/admin/__tests__/DeleteOrgConfirmDialog.test.ts` | Full behavior coverage | ✓ VERIFIED | 15 tests, all passing |
| `src/components/admin/OrganizationsTab.vue` | Delete control + dialog wiring | ✓ VERIFIED | Delete button gated `org.active !== false`, dialog rendered once at root, `onConfirmDelete` wired to `deleteOrganization` callable |
| `src/components/admin/__tests__/OrganizationsTab.test.ts` | `mockDeleteOrganization` coverage | ✓ VERIFIED | 6 new tests (disabled-for-active, dialog-opens-with-props, success path, failure path, no-direct-writes), all passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `deleteOrganizationHandler` | `orgProvisioning.ts` | `assertSuperAdminCaller`/`normalizeOrgName` imports (not forked) | ✓ WIRED | `orgDeletion.ts:4` imports both; both widened to `export function` in `orgProvisioning.ts` (bodies unchanged, confirmed by grep) |
| `functions/src/index.ts` | `orgDeletion.ts` | re-export | ✓ WIRED | `import { deleteOrganization } from "./orgDeletion";` (line 20) + `export { deleteOrganization };` (line 3344) in its own labeled block |
| `DeleteOrgConfirmDialog.vue` | `OrganizationsTab.vue` | `@confirm(typedName)` → `onConfirmDelete` → `httpsCallable('deleteOrganization', {orgId, confirmName})` | ✓ WIRED | Confirmed in template (lines 188-197) and script (`onConfirmDelete`, lines 569-598) |
| `firestore.rules organizations/{orgId}` | client `deleteDoc` | unconditional `allow delete: if false;` | ✓ WIRED | Confirmed textually present; proven by live emulator DENY tests for both editor and super-admin client contexts |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R215 | 77-01 | Delete refused unless deactivated | ✓ SATISFIED | `orgDeletion.ts:112-120`, eligibility-gate tests |
| R216 | 77-01, 77-02 | Super-admin-gated + re-verified, client can't bulk-delete | ✓ SATISFIED | `assertSuperAdminCaller` first-line gate, rules DENY tests |
| R217 | 77-01 | No document remains under `organizations/{orgId}` | ✓ SATISFIED | `recursiveDelete` invoked last, call-order test |
| R218 | 77-01 | Cross-collection references removed | ✓ SATISFIED | `orgNames`/`inviteLookup`/`users.orgIds` cleanup tests |
| R219 | 77-01 | Storage objects removed | ✓ SATISFIED | `bucket.deleteFiles` prefix + force:true test |
| R220 | 77-02 | Type-to-confirm, echoes destruction, irreversible label | ✓ SATISFIED | `DeleteOrgConfirmDialog.vue` structural disable + copy, component tests |
| R221 | 77-01, 77-02 | Safe retry of an interrupted deletion, clear summary | ✓ SATISFIED | Idempotent-retry unit tests; `deleteFeedback` summary banner in `OrganizationsTab.vue` |

No orphaned requirements found for this phase (R215-R221 all mapped and satisfied by 77-01/77-02).

### Anti-Patterns Found

None. `grep` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` across
`functions/src/orgDeletion.ts`, `src/components/admin/DeleteOrgConfirmDialog.vue`, and
`src/components/admin/OrganizationsTab.vue` returned zero matches.

### Behavioral Spot-Checks / Gate Runs (live, this session)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Functions build | `cd functions && npm run build` | exit 0, clean | ✓ PASS |
| Functions unit suite | `cd functions && npx vitest run` | 544/544 passed (15 files) | ✓ PASS |
| Rules suite (live emulator, already running) | `npx vitest run --config vitest.rules.config.ts` | 203/203 passed, incl. both new `organizations/{orgId}` delete-DENY tests | ✓ PASS |
| Type-check | `npm run type-check` (`vue-tsc --build`) | clean, no errors | ✓ PASS |
| App suite | `npx vitest run` | 2 failed files / 22 failed tests / 4092 passed — exactly the documented known-failing baseline (`src/storage.rules.test.ts` timeouts, `RosterView.test.ts` stale assertion), no new failures | ✓ PASS (baseline) |

All gates were run directly in this verification session (not taken from SUMMARY.md claims) and match
the documented baselines exactly, with no regressions introduced by this phase.

### Security Cross-Check

`77-SECURITY.md` reports verdict SECURED, 11/11 threats closed, 0 open, independently re-running the same
suites. Cross-checked against current code: the one residual non-blocking finding noted there (WR-02
client-side trim mirror) is confirmed present in the current `DeleteOrgConfirmDialog.vue` (commit
`0b5d3cef`, "+1 test") — fully closed, not just claimed.

### Gaps Summary

No code-level gaps found. All 5 ROADMAP success criteria are backed by passing tests run live in this
session (not SUMMARY.md claims), full wiring is confirmed by direct source inspection, and the security
audit's one residual finding is confirmed closed in current code.

The only remaining items are explicitly deferred by this milestone's standing autonomy grant and cannot
be verified by static analysis or the mocked unit suite:

1. **Deploy hand-over**: `deleteOrganization` and the `firestore.rules` change are built + tested but
   UNDEPLOYED. `firebase deploy --only functions:deleteOrganization,firestore:rules --project
   worship-planner-bc515` is owner-gated and has not been run.
2. **Real-cascade confirmation**: `deleteOrganizationHandler` has never been invoked against real or
   emulator Firestore/Storage data — its own test file uses an entirely mocked Admin SDK. Production
   verification (org + subcollections + cross-refs + Storage actually gone, no other org affected) requires
   a real super-admin session after deploy.
3. **Visual/UX confirmation**: the dialog's real-browser rendering, focus behavior, and the Delete
   control's disabled/enabled affordance on the live Organizations table have not been eyeballed.

These are routed to `human_verification` below per the deferred-verification policy, not treated as
code-level failures.

---

*Verified: 2026-08-23T04:10:00Z*
*Verifier: Claude (gsd-verifier)*
