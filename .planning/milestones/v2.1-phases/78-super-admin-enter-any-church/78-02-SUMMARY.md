---
phase: 78-super-admin-enter-any-church
plan: 02
subsystem: auth
tags: [pinia, vue-router, vue, super-admin, client-state]

# Dependency graph
requires:
  - phase: 78-super-admin-enter-any-church (78-01)
    provides: "isOrgMember()/isOrgEditor()/isOrgMemberByClaim()'s super-admin OR-arm in firestore.rules/storage.rules — the rules-layer authorization enterOrgAsSuperAdmin's Firestore reads and every subsequent read/write while viewing depend on"
provides:
  - "authStore.enterOrgAsSuperAdmin(orgId)/exitSuperAdminView() + viewingAsSuperAdmin ref — switches active org context for a non-member super-admin with editor-equivalent access, writing NOTHING to Firestore"
  - "hasNoOrg fix excluding a super-admin currently viewing a church, so the router's org-selection guard no longer strands them on /select-church right after entering"
  - "OrganizationsTab.vue's per-row 'Enter church' action (not gated on org.active)"
  - "AppShell.vue's persistent 'Viewing X as super-admin' banner with a one-click exit to /owner-console"
affects: [any future phase touching auth.ts's org-context reset sites, AppShell.vue, or OrganizationsTab.vue's row actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "applyOrgSnapshot(orgData) extraction — the org-snapshot -> store-state hydration (name/slug/pcCredentials/settings-merge/font eager-load) factored out of loadOrgContext so enterOrgAsSuperAdmin can reuse it verbatim without duplicating the settings-merge logic"
    - "Client-side org-context reset has exactly THREE inline sites (resetOrgContext, logout, onAuthStateChanged null-user branch) that must all stay in sync — viewingAsSuperAdmin was added to all three in this plan, matching the existing pattern other org-context fields already follow"

key-files:
  created:
    - src/components/__tests__/AppShell.test.ts
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts
    - src/components/AppShell.vue

key-decisions:
  - "enterOrgAsSuperAdmin performs NO isOrgActive/deactivation check (unlike loadOrgContext) — the rules layer already grants a super-admin unconditional access to a deactivated org's doc, and entering one for support is intended, not a bug to guard against"
  - "hasNoOrg gained '&& viewingAsSuperAdmin.value === null' rather than pushing the viewed org into memberships — memberships is what the church-picker renders, and R226 requires the super-admin's own picker to stay empty"
  - "enterOrgAsSuperAdmin does NOT start the members/{uid} onSnapshot subscription loadOrgContext normally starts — there is no member doc for it to find, and if it ran its first callback would immediately null userRole back out"

requirements-completed: [R224, R226, R227]

coverage:
  - id: D1
    description: "A super-admin can enter any organization (including a deactivated one) with editor-equivalent access and zero membership document via enterOrgAsSuperAdmin, while memberships stays empty (R226 — picker never grows)"
    requirement: "R224"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78) > sets orgId/orgName/userRole/viewingAsSuperAdmin while leaving memberships empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "hasNoOrg/requiresOrgSelection no longer strand a super-admin back on /select-church immediately after entering a church (Pitfall 1 router-strand fix)"
    requirement: "R224"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78) > hasNoOrg is false and requiresOrgSelection is false after entering"
        status: pass
    human_judgment: false
  - id: D3
    description: "enterOrgAsSuperAdmin never calls setDoc/writeBatch — no member document is created for the super-admin (R226)"
    requirement: "R226"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78) > never calls setDoc/writeBatch"
        status: pass
    human_judgment: false
  - id: D4
    description: "enterOrgAsSuperAdmin leaves state unchanged (no partial state) when the target org doc does not exist, and viewingAsSuperAdmin is cleared on exitSuperAdminView and on logout (Pitfall 4)"
    requirement: "R226"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78) > leaves orgId/viewingAsSuperAdmin at null when the target org doc does not exist"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78) > exitSuperAdminView clears orgId/userRole/viewingAsSuperAdmin back to null"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78) > viewingAsSuperAdmin is cleared to null after logout"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every Organizations row has an 'Enter church' action calling enterOrgAsSuperAdmin(org.orgId), enabled regardless of org.active"
    requirement: "R224"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- enter church (R224, Phase 78) > clicking \"Enter church\" calls authStore.enterOrgAsSuperAdmin with that row's orgId"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- enter church (R224, Phase 78) > the \"Enter church\" button is present and NOT disabled for a deactivated row"
        status: pass
    human_judgment: false
  - id: D6
    description: "AppShell.vue shows a persistent 'Viewing X as super-admin' banner while viewingAsSuperAdmin is set, with a one-click exit that clears the view state and navigates to /owner-console"
    requirement: "R227"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppShell.test.ts#AppShell -- viewing-as-super-admin banner (R227, Phase 78) > renders \"Viewing <name> as super-admin\" when viewingAsSuperAdmin is set and orgName is populated"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppShell.test.ts#AppShell -- viewing-as-super-admin banner (R227, Phase 78) > clicking \"Exit to owner console\" calls exitSuperAdminView() and router.push('/owner-console')"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppShell.test.ts#AppShell -- viewing-as-super-admin banner (R227, Phase 78) > renders no banner when viewingAsSuperAdmin is null"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-23
status: complete
---

# Phase 78 Plan 02: Super-Admin Enter-Any-Church — Client Enter/Exit + Banner + Row Action Summary

**A one-click `enterOrgAsSuperAdmin`/`exitSuperAdminView` pair in `auth.ts` that switches active org context to any church with editor-equivalent access and zero membership document, wired to an "Enter church" row action on the Organizations tab and a persistent amber "Viewing X as super-admin" banner with a one-click exit in AppShell.vue.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-23T05:06:17Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (auth.ts, OrganizationsTab.vue, AppShell.vue + their test files), 1 created (AppShell.test.ts)

## Accomplishments

- Extracted `loadOrgContext`'s org-snapshot -> store-state hydration (name/slug/pcCredentials, the settings/vwModeEnabled dual-read merge, the eager slide-font-CSS load) into a private `applyOrgSnapshot(orgData)` helper, called from both `loadOrgContext` (unchanged behavior) and the new `enterOrgAsSuperAdmin` (no duplicated settings-merge logic).
- Added `viewingAsSuperAdmin` ref + `enterOrgAsSuperAdmin(targetOrgId)`/`exitSuperAdminView()` to `auth.ts`. Entering: guards on `user.value`/`isSuperAdmin.value` (local convenience only — the real boundary is `firestore.rules`' super-admin arm from 78-01), resets prior context, reads the target org doc, sets `orgId`/`viewingAsSuperAdmin`/`userRole = 'editor'` directly, and applies the org snapshot — with NO `members/{uid}` onSnapshot subscription started (there's no member doc for it to find) and NO Firestore writes at all (R226).
- Fixed `hasNoOrg` to add `&& viewingAsSuperAdmin.value === null`, closing the T-78-05 router-strand hazard: without this, the very next navigation after entering a church bounced a super-admin with zero real memberships straight back to `/select-church`, undoing the whole feature.
- Added `viewingAsSuperAdmin.value = null` to all three org-context reset sites (`resetOrgContext`, `logout`, the `onAuthStateChanged` null-user branch) so a mid-visit sign-out never leaves a stale banner/role for the next sign-in in the same tab.
- Added a per-row "Enter church" action to `OrganizationsTab.vue` calling `enterOrgAsSuperAdmin(org.orgId)` then navigating to `/services` (not `/dashboard`, which has a `requiresEditor` gate the forced `'editor'` role would still pass, but `/services` is the plan's specified safer universal landing route). Not gated on `org.active` — entering a deactivated org is an explicit, intended support scenario.
- Added a persistent amber "Viewing `<church>` as super-admin" banner to `AppShell.vue`, visible above `<main>` regardless of sidebar state, with a one-click "Exit to owner console" button calling `exitSuperAdminView()` then navigating to `/owner-console`.

## Task Commits

Each task was committed atomically:

1. **Task 1: auth.ts — enterOrgAsSuperAdmin/exitSuperAdminView + hasNoOrg fix** - `79fed148` (feat)
2. **Task 2: OrganizationsTab.vue — per-row "Enter church" action** - `23eb5e07` (feat)
3. **Task 3: AppShell.vue — persistent banner + exit** - `6a28362b` (feat)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

## Files Created/Modified

- `src/stores/auth.ts` — `applyOrgSnapshot` extraction, `viewingAsSuperAdmin` ref, `enterOrgAsSuperAdmin`/`exitSuperAdminView`, `hasNoOrg` fix, three reset-site updates, new exports
- `src/stores/__tests__/auth.test.ts` — new `describe('enterOrgAsSuperAdmin / exitSuperAdminView (R224/R226/R227, Phase 78)', ...)` block (6 tests)
- `src/components/admin/OrganizationsTab.vue` — `useRouter`/`useAuthStore` imports, `onEnterChurch`, new "Enter church" row button
- `src/components/admin/__tests__/OrganizationsTab.test.ts` — `mockEnterOrgAsSuperAdmin` moved into `vi.hoisted`, wired into the `@/stores/auth` mock, new `describe('OrganizationsTab -- enter church (R224, Phase 78)', ...)` block (2 tests)
- `src/components/AppShell.vue` — `useRouter`/`useAuthStore` imports, `onExitSuperAdminView`, new amber banner
- `src/components/__tests__/AppShell.test.ts` — new file (no prior file existed), 5 tests

## Decisions Made

- `applyOrgSnapshot` is a pure extraction with no behavior change — verified by the full pre-existing `auth.test.ts` suite (OrgSettings/vwModeEnabled/slideTypography/messaging/bibleVersion describe blocks) passing unmodified.
- `enterOrgAsSuperAdmin` deliberately skips the `isOrgActive`/deactivation check `loadOrgContext` performs — the rules layer (78-01) already grants unconditional access to a deactivated org for a super-admin, and viewing one is an intended support scenario, not something to defend against client-side.
- The AppShell.test.ts harness mocks `vue-router` with BOTH `useRoute` and `useRouter` (not just `useRouter` as a literal reading of the plan's action text might suggest) — `AppSidebar.vue` is mounted for real as AppShell's child (not stubbed) and itself calls `useRoute()`; omitting it would throw `useRoute is not a function` during mount. Confirmed necessary by running the test — see Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AppShell.test.ts's vue-router mock needed useRoute in addition to useRouter**
- **Found during:** Task 3 (writing/running AppShell.test.ts)
- **Issue:** The plan's harness description says "a spy-able push, no useRoute needed here" for AppShell.vue's own script. But `AppSidebar.vue` is mounted for real as AppShell's child (not stubbed, matching the plan's "AppSidebar/ToastHost need no additional mocking" instruction) and its own `<script setup>` calls `useRoute()`. A `vi.mock('vue-router', ...)` factory that only exports `useRouter` leaves `useRoute` `undefined`, which throws `TypeError: useRoute is not a function` the instant AppSidebar's setup runs.
- **Fix:** Added `useRoute: vi.fn(() => ({ path: '/services' }))` to the same mock factory alongside `useRouter`. No test assertions depend on the route value; it exists only so AppSidebar's `isActive()` helper has something to read.
- **Files modified:** `src/components/__tests__/AppShell.test.ts` (written directly with the fix — no separate broken-then-fixed commit; this is what got committed in `6a28362b`)
- **Verification:** All 5 AppShell.test.ts tests pass; the only console output is a benign `Failed to resolve component: router-link` warning (RouterLink isn't globally registered in this router-less mock — same class of harmless warning as OrganizationsTab.test.ts's pre-existing `injection "Symbol(router)" not found`).
- **Committed in:** `6a28362b` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking-issue fix, Rule 3)
**Impact on plan:** Necessary to make the plan's own specified test harness (AppSidebar mounted for real, not stubbed) actually mount without throwing. No scope creep — the fix is confined to the new test file's router mock.

## Issues Encountered

None beyond the deviation above.

## Gate Results

1. **`npm run type-check`** (`vue-tsc --build`) — clean, no errors, run after each of the three tasks.
2. **`npx vitest run src/stores/__tests__/auth.test.ts src/components/admin/__tests__/OrganizationsTab.test.ts src/components/__tests__/AppShell.test.ts`** — **134/134 passed** (91 + 38 + 5).
3. **`npx vitest run`** (full app suite, bare command per CLAUDE.md) — **2 failing files, exactly the documented baseline, no new regressions**: `src/storage.rules.test.ts` (connection-timeout failures — no live Storage emulator in this bare run) and `src/views/__tests__/RosterView.test.ts` (pre-existing stale assertion). 4105/4131 tests passed; every new/modified test file in this plan (auth.test.ts, OrganizationsTab.test.ts, AppShell.test.ts) is green.
4. No `functions/` changes made this plan — the `cd functions && npm run build`/`npx vitest run` gate was not applicable. No rules/emulator suite required — this plan's tests use mocked Firestore, not the emulator.

## User Setup Required

None — no external service configuration required. This plan makes no rules/deploy changes; the outstanding `firebase deploy --only firestore:rules,storage` hand-over from 78-01-SUMMARY.md remains the owner's action before this client flow's `enterOrgAsSuperAdmin` calls actually gain cross-tenant Firestore/Storage access in production.

## Next Phase Readiness

- R224/R226/R227 are complete and tested. Combined with 78-01's R225 rules arm, Phase 78's full scope (enter-any-church support flow) is code-complete pending the owner's rules deploy.
- No blockers for any future phase. `viewingAsSuperAdmin`/`enterOrgAsSuperAdmin`/`exitSuperAdminView` are exported from the auth store and available to any future surface that needs to read or drive the super-admin visit state.
- T-78-03 (client-code-only "no member doc" guarantee, since `members/{uid}`'s `allow write` legally permits `create`) remains an accepted, documented residual risk per 78-01/78-02's threat models — no action taken here.

---
*Phase: 78-super-admin-enter-any-church*
*Completed: 2026-08-23*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`,
`src/components/admin/OrganizationsTab.vue`, `src/components/admin/__tests__/OrganizationsTab.test.ts`,
`src/components/AppShell.vue`, `src/components/__tests__/AppShell.test.ts`, this SUMMARY.md); all three task
commit hashes (`79fed148`, `23eb5e07`, `6a28362b`) confirmed present in `git log`.
