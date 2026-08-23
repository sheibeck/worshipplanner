---
phase: 78-super-admin-enter-any-church
verified: 2026-08-23T06:20:00Z
status: human_needed
score: 4/4 must-haves verified (code-level); deploy + real-browser confirmation outstanding
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Owner deploys `firebase deploy --only firestore:rules,storage --project worship-planner-bc515`, then a super-admin clicks \"Enter church\" on an org they don't belong to."
    expected: "The super-admin lands inside that church (services route) with editor-equivalent access and can view/edit its data."
    why_human: "Requires the rules deploy (owner-gated, currently UNDEPLOYED per 78-01-SUMMARY.md hand-over) and a real Firebase project session — the emulator suite proves the rules logic but not the deployed/production behavior."
  - test: "After entering as super-admin, open the church's Team page and confirm the super-admin does not appear in the member list or member count."
    expected: "TeamView's member list/count is unchanged from before the visit — the super-admin is invisible to the church."
    why_human: "Requires a live, deployed session; the unit-test proof (enterOrgAsSuperAdmin never calls setDoc/writeBatch) and TeamView's read-only-members-subcollection code are the code-level evidence, but end-to-end confirmation needs a real browser."
  - test: "While viewing, confirm the amber \"Viewing X as super-admin\" banner is visible and legible, and clicking \"Exit to owner console\" returns to the owner console and clears the view."
    expected: "Banner shows the church name, is visually distinct, and the exit works in one click."
    why_human: "Visual/UX confirmation — component tests prove the banner's conditional render and click handler wiring, not its real-browser appearance."
  - test: "Confirm a non-super-admin, non-member of that org still cannot access it (Firestore/Storage) after deploy."
    expected: "Access denied, unchanged from pre-Phase-78 behavior."
    why_human: "Deploy-gated production confirmation; the DENY case is proven live against the emulator (rules.test.ts/storage.rules.test.ts) but not yet against deployed rules."
---

# Phase 78: Super-Admin Enter-Any-Church Verification Report

**Phase Goal:** A super-admin can step into any church to help — visibly to them, invisibly to that
church's member list, without a membership document — proven by a STRIDE threat model and genuine
emulator rules tests that a super-admin gets in and an ordinary non-member does not.
**Verified:** 2026-08-23T06:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/R224 — Each Organizations row has an "Enter church"/"Sign in" action that switches the super-admin's active org context | ✓ VERIFIED | `src/components/admin/OrganizationsTab.vue:169-184` renders a per-row "Enter church" button (not gated on `org.active`), calling `onEnterChurch` → `authStore.enterOrgAsSuperAdmin(org.orgId)` (line 654) then `router?.push({ name: 'services' })` on success. `src/stores/auth.ts:606-622` implements `enterOrgAsSuperAdmin`, setting `orgId`/`viewingAsSuperAdmin`/`userRole='editor'`. Confirmed by 40 passing `OrganizationsTab.test.ts` tests incl. the "enter church" describe block. |
| 2 | SC2/R225 — A super-admin can read/write ANY org's Firestore + Storage without a membership doc; a non-member non-super-admin is denied | ✓ VERIFIED | `firestore.rules:33-73` (`isOrgMember`/`isOrgEditor`) and `storage.rules:48-75` (`isOrgMemberByClaim`) OR `isSuperAdmin()`/`token.superAdmin==true` outermost, before any membership lookup. Live emulator run (this verification, not taken from SUMMARY): `npx vitest run --config vitest.rules.config.ts` → **213/213 passed** (187 `rules.test.ts` + 26 `storage.rules.test.ts`), including the new R225 ALLOW (super-admin, no membership doc/claim, incl. deactivated org) and DENY (non-member/non-super-admin) matrix. |
| 3 | SC3/R226 — Entering creates NO member doc; the super-admin never appears in the church's member/team list or count | ✓ VERIFIED | `src/stores/auth.ts:606-622` `enterOrgAsSuperAdmin` calls only `getDoc` — no `setDoc`/`writeBatch`/`updateDoc`. `src/views/TeamView.vue:378-390` reads only the `members`/`invites` subcollections via `onSnapshot`, unmodified by this phase — nothing populates a doc for the super-admin to appear in. `auth.test.ts`'s "never calls setDoc/writeBatch" test passes (part of the 91 auth.test.ts tests, all green). |
| 4 | SC4/R227 — A persistent "viewing as super-admin" indicator with a one-click exit while viewing a non-member church | ✓ VERIFIED | `src/components/AppShell.vue:38-53` renders an amber banner `v-if="authStore.viewingAsSuperAdmin"` naming the church, with an "Exit to owner console" button calling `onExitSuperAdminView` → `authStore.exitSuperAdminView()` + `router?.push('/owner-console')`. `src/components/__tests__/AppShell.test.ts` (5 tests) passes, covering banner-absent, banner-content, and exit-click assertions. |

**Score:** 4/4 truths verified at the code level (0 present-but-behavior-unverified). Deploy + real-browser confirmation is deliberately routed to human verification per this phase's UNDEPLOYED grant (below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | `isOrgMember`/`isOrgEditor` super-admin arm; org-doc `allow update` lifecycle guard has no `isSuperAdmin()` | ✓ VERIFIED | Lines 33-73, 161. Grep for `isSuperAdmin()` surfaces exactly 4 call sites (isOrgMember, isOrgEditor, appConfig, superAdmins) — org-doc `allow update` line 161 has none. |
| `storage.rules` | `isOrgMemberByClaim` super-admin arm | ✓ VERIFIED | Lines 48-75, outer OR on `token.superAdmin == true`. |
| `src/rules.test.ts` | R225 describe block | ✓ VERIFIED | Present; part of the 187-test file, all passing live. |
| `src/storage.rules.test.ts` | R225 describe block | ✓ VERIFIED | Present; part of the 26-test file, all passing live. |
| `src/stores/auth.ts` | `enterOrgAsSuperAdmin`, `exitSuperAdminView`, `viewingAsSuperAdmin`, `hasNoOrg` fix, `applyOrgSnapshot` extraction | ✓ VERIFIED | Lines 143 (ref), 321-334 (`resetOrgContext` incl. `viewingAsSuperAdmin`/`deactivatedOrgMessage` clears — WR-01), 342-426 (`applyOrgSnapshot`), 606-631 (enter/exit). `hasNoOrg` (line 165-171) includes `&& viewingAsSuperAdmin.value === null`. |
| `src/components/admin/OrganizationsTab.vue` | Enter-church row action | ✓ VERIFIED | Lines 169-184, 637-669; includes WR-02 (`enteringOrgId` in-flight guard) and WR-03 (navigate only when `enterOrgAsSuperAdmin` resolves `true`). |
| `src/components/AppShell.vue` | Persistent banner + exit | ✓ VERIFIED | Lines 38-53, 77-80. |
| `src/stores/__tests__/auth.test.ts`, `OrganizationsTab.test.ts`, `AppShell.test.ts` | New/extended test coverage | ✓ VERIFIED | Combined run: 138/138 passed (this verification's own run). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `OrganizationsTab.vue`'s Enter-church button | `authStore.enterOrgAsSuperAdmin(orgId)` | `onEnterChurch` handler | ✓ WIRED | Confirmed by code read + passing "clicking Enter church calls authStore.enterOrgAsSuperAdmin with that row's orgId" test. |
| `enterOrgAsSuperAdmin` | `firestore.rules`' super-admin arm | `getDoc(organizations/{targetOrgId})` | ✓ WIRED (logic); ⏳ deploy-pending | Rules logic proven live against the emulator; production enforcement depends on the outstanding owner-run deploy. |
| `authStore.viewingAsSuperAdmin` | `AppShell.vue`'s banner `v-if` | direct ref read | ✓ WIRED | Confirmed by code + passing banner-render/absent tests. |
| `authStore.viewingAsSuperAdmin` | `hasNoOrg`'s router-guard exclusion | `&& viewingAsSuperAdmin.value === null` | ✓ WIRED | Confirmed by code + passing "hasNoOrg is false ... after entering" test. |

### Behavioral Spot-Checks / Gate Runs (this verification, live)

| Command | Result | Status |
|---------|--------|--------|
| `npm run type-check` (`vue-tsc --build`) | Clean, no errors | ✓ PASS |
| `npx vitest run --config vitest.rules.config.ts` (against running emulator) | 213/213 passed (187 + 26) | ✓ PASS |
| `npx vitest run src/stores/__tests__/auth.test.ts src/components/admin/__tests__/OrganizationsTab.test.ts src/components/__tests__/AppShell.test.ts` | 138/138 passed | ✓ PASS |
| `npx vitest run` (bare app suite) | 4109/4135 passed; 2 failing files exactly matching the documented CLAUDE.md baseline (`src/storage.rules.test.ts` — no live Storage emulator in this bare run; `src/views/__tests__/RosterView.test.ts` — pre-existing stale assertion). No new regressions. | ✓ PASS (baseline) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R224 | 78-02 | Enter-church row action switches active org context | ✓ SATISFIED | OrganizationsTab.vue + auth.ts, tests passing |
| R225 | 78-01 | Super-admin cross-tenant Firestore/Storage access without membership doc | ✓ SATISFIED | firestore.rules/storage.rules, 213/213 live emulator tests |
| R226 | 78-02 | No member doc created; invisible to member list/count | ✓ SATISFIED | enterOrgAsSuperAdmin writes nothing; TeamView reads only members/invites |
| R227 | 78-02 | Persistent viewing-as-super-admin indicator + one-click exit | ✓ SATISFIED | AppShell.vue banner + exit, tests passing |

No orphaned requirements — REQUIREMENTS.md maps exactly R224-R227 to Phase 78, all four claimed and satisfied.

### Anti-Patterns Found

None. Scanned `firestore.rules`, `storage.rules`, `src/stores/auth.ts`, `src/components/admin/OrganizationsTab.vue`, `src/components/AppShell.vue` for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/stub patterns — none found. All review-fix commits (WR-01, WR-02, WR-03, IN-01, IN-02) are present in `git log` and reflected in the current source (confirmed by direct code read, not just SUMMARY/SECURITY.md claims).

### Deferred / Accepted Residuals (not gaps)

- **T-78-03** (low, accepted): `members/{uid}`'s `allow write` legally permits a super-admin's client SDK to `create` a membership doc — R226's "no member doc" guarantee is a client-code contract (`enterOrgAsSuperAdmin` never calls `setDoc`/`writeBatch`), not a rules invariant. Documented inline in `firestore.rules:188-201` (IN-02) and in 78-SECURITY.md. Explicitly flagged as a candidate future hardening phase, not a Phase 78 gap.
- **T-78-07** (low, accepted): no audit log of super-admin enter-church sessions — explicitly scoped out by the owner (78-CONTEXT.md).
- **Rules deploy**: `firestore.rules`/`storage.rules` changes are committed but UNDEPLOYED — an explicit, owner-gated hand-over (`firebase deploy --only firestore:rules,storage --project worship-planner-bc515`), not an implementation gap. This is why status is `human_needed` rather than `passed`.

### Human Verification Required

See `human_verification` in frontmatter — all four items require the owner-gated production deploy and/or real-browser/visual confirmation, per this phase's explicit deferred-verification grant. None of them reflect a failed code-level truth.

### Gaps Summary

No code-level gaps. All four ROADMAP success criteria (R224-R227) are backed by real, wired, non-stub
implementation, confirmed by live rule-emulator execution (213/213) and unit/component tests (138/138) run
independently in this verification — not taken from SUMMARY.md or SECURITY.md claims. The app suite stays
at the documented 2-file baseline with no new regressions, and `npm run type-check` is clean. The sole
reason this phase is not `passed` is the intentionally deferred owner-gated rules deploy and its
downstream real-browser confirmation steps, which cannot be verified from the repository alone.

---

*Verified: 2026-08-23T06:20:00Z*
*Verifier: Claude (gsd-verifier)*
