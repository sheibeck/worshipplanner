---
quick_id: 260823-superadmin-nav-fix
slug: superadmin-nav-fix
date: 2026-08-23
status: complete
scope: client-only
deploy: firebase deploy --only hosting (owner-run, outstanding)
gates:
  type_check: pass
  app_suite: 2-file baseline (storage.rules.test.ts + RosterView.test.ts only)
  changed_area_tests: router.test.ts + auth.test.ts + AppShell.test.ts all pass (107)
---

# Summary — Super-admin nav & landing fix

Fixed the v2.1 Phase 78 UAT finding: exiting a super-admin church view left a broken partial nav
(only "Services" + "Owner Console"), a churchless super-admin was routed to the empty church picker,
and there was no clear indicator when a super-admin was outside their own church.

## What changed

- **src/stores/auth.ts**
  - `exitSuperAdminView` is now async: after `resetOrgContext()` it reloads the super-admin's own
    church via `loadOrgContext(uid, false)`, so exiting restores their real nav (own church + Owner
    Console) instead of a no-org partial state.
  - Added `isChurchlessSuperAdmin` (super-admin, 0 memberships) and `superAdminOutsideOwnChurch`
    (super-admin AND (viewing another church OR no active org)); both exported.
- **src/components/AppSidebar.vue**
  - "Services" is now gated on `authStore.orgId` (an active church), so it no longer shows at the
    Owner Console with no church — the root cause of the stray link.
  - Header shows "Super Admin · not in a church" when a super-admin has no active church, and tags
    the org name "viewing as super-admin" when inside another church.
- **src/router/index.ts**
  - A churchless super-admin is routed to `owner-console` (not the empty `select-church`) in the
    org-selection gate, the select-church redirect-away, and the post-login redirect.
- **src/components/AppShell.vue**
  - `onExitSuperAdminView` awaits the now-async `exitSuperAdminView` before navigating.

## Behavior now

- Super-admin who belongs to a church: full own-church nav + Owner Console; exiting a visited church
  returns them there.
- Churchless super-admin: lands on Owner Console at login; sidebar shows only Owner Console + a
  "not in a church" indicator.
- Entering another church: existing amber banner + a sidebar "viewing as super-admin" tag.

## Gates

- `npm run type-check` (vue-tsc --build): clean.
- Full app suite: only the documented 2-file baseline fails (storage.rules.test.ts needs the Storage
  emulator; RosterView.test.ts stale assertion). Router/auth/AppShell targeted run: 107/107 pass.

## Outstanding

- **Owner redeploy:** `firebase deploy --only hosting --project worship-planner-bc515` (client-only;
  no rules/functions changed).
