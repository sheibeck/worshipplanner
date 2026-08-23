---
quick_id: 260823-superadmin-nav-fix
slug: superadmin-nav-fix
date: 2026-08-23
status: in-progress
scope: client-only (no rules/functions)
deploy: firebase deploy --only hosting (owner-run)
---

# Quick Task: Super-admin nav & landing fix (v2.1 Phase 78 UAT finding)

## Problem (owner UAT, 2026-08-23)

After a super-admin enters a church via `enterOrgAsSuperAdmin` and then exits back to the
Owner Console (`exitSuperAdminView`), the left nav is left in a broken partial state showing
only **Services + Owner Console** — because `resetOrgContext()` nulls `userRole` (hiding every
`isEditor`-gated item) while **"Services" is pushed unconditionally** for all roles, and the
super-admin's own church context is never reloaded. Also: a churchless super-admin is routed to
the empty `/select-church` picker (dead-end), and there is no clear indicator when a super-admin
is not inside their own church.

## Decisions (owner)

1. A super-admin who **belongs to a church** keeps their own church's full nav + Owner Console.
2. A super-admin who **belongs to no church** sees **only** Owner Console and lands there at login.
3. Exiting a super-admin church view restores the super-admin's **own** church context (not a
   partial no-org state).
4. Make it **clear** when a super-admin is not currently in their own church.

## Changes

- **src/stores/auth.ts**
  - `exitSuperAdminView` → async: after `resetOrgContext()`, reload the super-admin's own org via
    `loadOrgContext(uid, false)` so exit restores their real church nav (or resolves to no-org for
    a churchless super-admin).
  - Add `isChurchlessSuperAdmin` computed (super-admin, 0 memberships) — router landing target.
  - Add `superAdminOutsideOwnChurch` computed (super-admin AND (viewing another church OR no active
    org)) — drives the sidebar clarity indicator. Export both.
- **src/components/AppSidebar.vue**
  - Gate the "Services" nav item on an active org (`authStore.orgId`) so it never shows at the
    Owner Console with no church.
  - Header area: show a "Super Admin · not in a church" indicator when a super-admin has no active
    church; tag the org name with "viewing as super-admin" when in another church.
- **src/router/index.ts**
  - Route a churchless super-admin to `owner-console` instead of `select-church` in the
    org-selection gate, the select-church redirect-away, and the post-login redirect.
- **src/components/AppShell.vue**
  - `onExitSuperAdminView` awaits the now-async `exitSuperAdminView` before navigating.

## Gate

- `npm run type-check` clean; app suite at documented 2-file baseline.
- Owner redeploys with `firebase deploy --only hosting` (client-only; no rules/functions changed).
