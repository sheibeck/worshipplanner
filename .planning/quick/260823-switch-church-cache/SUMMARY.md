---
quick_id: 260823-switch-church-cache
slug: switch-church-cache
date: 2026-08-23
status: complete
scope: client-only
deploy: firebase deploy --only hosting (owner-run)
gates:
  type_check: pass
  auth_tests: 93/93
  build: exit 0
---

# Summary — Clear stale store data when switching churches

Fixed the brief flash of the previous church's data when switching churches (own church → Enter
another church as super-admin, and the multi-church picker).

## Root cause

Each org-scoped store's `subscribe(orgId)` re-points its Firestore listener but keeps the old
`.value` until the new snapshot arrives. With Vue Router mounting the destination view before the
source unmounts, that stale array renders for a moment.

## Change

- **New `src/stores/orgScopedStores.ts`** — `resetOrgScopedStores()` unsubscribes + clears state for
  all 10 org-scoped stores (services, songs, roster, quarters, slideGroups, scriptureSlides,
  importedSlides, pptxRenders, serviceMessages, songLyrics). Each teardown is null-guarded, so a
  double call (this + a view's own onUnmounted) is harmless.
- **src/stores/auth.ts** — invoked (dynamic import, to avoid the auth ↔ store cycle) at every
  org-switch point before the new church loads: `enterOrgAsSuperAdmin`, `selectOrg`,
  `exitSuperAdminView`. No view can render the prior church's data during the switch window.

## Gates

- `npm run type-check` (vue-tsc --build): clean.
- Auth store suite: 93/93 (incl. the `selectOrg` switch path exercising the new dynamic import).
- Production build: exit 0.

## Outstanding

- **Owner redeploy:** `firebase deploy --only hosting --project worship-planner-bc515` (client-only).
