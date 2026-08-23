---
quick_id: 260823-switch-church-cache
slug: switch-church-cache
date: 2026-08-23
status: complete
scope: client-only (no rules/functions)
deploy: firebase deploy --only hosting (owner-run)
---

# Quick Task: Clear stale store data when switching churches

## Problem (owner, 2026-08-23)

Switching churches (own church → Enter another church as super-admin) briefly shows the previous
church's data. Each org-scoped Pinia store's `subscribe(orgId)` re-points its Firestore listener
but keeps the previous org's `.value` array until the new snapshot's first emission. Vue Router
mounts the destination view before the source unmounts, so the stale array flashes.

## Fix

- **New `src/stores/orgScopedStores.ts`** — `resetOrgScopedStores()` tears down (unsubscribe +
  clear state) every org-scoped store: services, songs, roster, quarters, slideGroups,
  scriptureSlides, importedSlides, pptxRenders, serviceMessages, songLyrics.
- **src/stores/auth.ts** — call `resetOrgScopedStores()` at every org-switch point, BEFORE the new
  church loads / new view mounts: `enterOrgAsSuperAdmin`, `selectOrg`, `exitSuperAdminView`.
  Imported dynamically to avoid the auth ↔ store import cycle.

## Gate

- `npm run type-check` clean; auth store 93/93; production build exit 0.
- Owner redeploys `firebase deploy --only hosting`.
