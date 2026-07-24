---
phase: quick-19
plan: 01
subsystem: settings
tags: [settings, org-name, sidebar, router, editor-only]
dependency_graph:
  requires: [auth-store, appshell, firestore-rules]
  provides: [settings-page, org-name-editing]
  affects: [AppSidebar, router]
tech_stack:
  added: []
  patterns: [appshell-wrapper, updateDoc-reactive-sync, isEditor-sidebar-guard]
key_files:
  created:
    - src/views/SettingsView.vue
  modified:
    - src/router/index.ts
    - src/components/AppSidebar.vue
decisions:
  - "authStore.orgName updated directly after save — no re-fetch needed, sidebar updates instantly via reactivity"
  - "Settings placed as a separate if(authStore.isEditor) block in navItems — visually last, consistent with Team pattern"
metrics:
  duration: 5
  completed_date: "2026-03-04"
---

# Quick-19: Add Settings Screen to Edit Org Name Summary

**One-liner:** Settings page with org name editor that updates Firestore and reflects in sidebar immediately via direct authStore.orgName mutation.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create SettingsView with org name editing | f94cb03 | src/views/SettingsView.vue |
| 2 | Add /settings route and sidebar nav item | b626044 | src/router/index.ts, src/components/AppSidebar.vue |

## What Was Built

- `src/views/SettingsView.vue`: New Settings page wrapped in AppShell. Contains an "Organization" section card with an editable org name input pre-filled from `authStore.orgName`. Save button calls `updateDoc` on `organizations/{orgId}` and then sets `authStore.orgName` directly for instant sidebar reactivity. Button is disabled when name is unchanged or empty. Shows "Saving..." during save, "Saved!" for 2 seconds on success. Error message shown on failure. A `watch` on `authStore.orgName` syncs `editName` if the org name changes externally.

- `src/router/index.ts`: `/settings` route registered with `requiresAuth: true, requiresEditor: true` meta, lazy-loaded via `() => import('../views/SettingsView.vue')`. Placed before the public `/share/:token` route.

- `src/components/AppSidebar.vue`: Settings gear icon nav item added as the last `if (authStore.isEditor)` block in `navItems` computed. Viewers do not see it; direct navigation to `/settings` redirects to `/services` via the existing router guard.

## Verification

- `npx vue-tsc --noEmit`: passed with no type errors
- `npx vite build`: succeeded (SettingsView-*.js chunk generated)
- Success criteria met: SettingsView renders org name in editable input, Save updates Firestore and authStore.orgName, Settings appears after Team in sidebar (editors only), /settings route guarded by requiresAuth + requiresEditor

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/views/SettingsView.vue`: FOUND
- `src/router/index.ts` contains "settings": FOUND
- `src/components/AppSidebar.vue` contains "Settings": FOUND
- Commit f94cb03: FOUND
- Commit b626044: FOUND
