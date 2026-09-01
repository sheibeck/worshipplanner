---
phase: quick-260901-lua
plan: 01
subsystem: views
tags: [church-switch, org-scoped-stores, data-safety, regression-test]
dependency-graph:
  requires:
    - src/views/TeamView.vue (104-REVIEW CR-01 canonical watcher pattern)
    - src/stores/orgScopedStores.ts (resetOrgScopedStores, called by authStore.selectOrg)
  provides:
    - "In-place church switch re-subscribe for Services/Songs/Dashboard/Roster/Schedule"
    - "Fail-safe navigation out of /services/:id on a church switch"
  affects:
    - src/views/ServicesView.vue
    - src/views/SongsView.vue
    - src/views/DashboardView.vue
    - src/views/RosterView.vue
    - src/views/QuarterView.vue
    - src/views/ServiceEditorView.vue
tech-stack:
  added: []
  patterns:
    - "watch(() => authStore.orgId, (orgId) => { unsubscribeAll(); if (orgId) subscribe(orgId) }, { immediate: true })"
    - "watch(() => authStore.orgId, (orgId, oldOrgId) => { if (oldOrgId) router.push(...) }) — no immediate, fail-safe nav on genuine change only"
key-files:
  created: []
  modified:
    - src/views/ServicesView.vue
    - src/views/SongsView.vue
    - src/views/DashboardView.vue
    - src/views/RosterView.vue
    - src/views/QuarterView.vue
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServicesView.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
decisions:
  - "Mirrored TeamView.vue's 104-REVIEW CR-01 watcher pattern exactly across all five list/dashboard views — no deviation from the canonical template."
  - "DashboardView's onMounted `if (!store.orgId)` guards were removed (they defeated re-subscription on switch), replaced by unconditional unsubscribeAll()+subscribe() inside the watcher."
  - "ServiceEditorView fails safe by navigating to /services on a genuine org change rather than attempting to re-load the current serviceId under the new church."
metrics:
  duration: "~35 minutes"
  completed: 2026-09-01
status: complete
---

# Quick Task 260901-lua: Fix church-switch re-subscribe Summary

Six org-scoped views were migrated from onMounted-only store subscription to a reactive
`authStore.orgId` watcher (or, for the service editor, a fail-safe navigation watcher), fixing
the sidebar "Switch Church" quick-select's stuck "Loading services…" state and closing a
cross-church data-safety gap — no store code touched.

## What Was Built

**Task 1 — Five list/dashboard views migrated to an `authStore.orgId` watcher**
(`ServicesView.vue`, `SongsView.vue`, `DashboardView.vue`, `RosterView.vue`, `QuarterView.vue`):
each view's `initStore()`/`initStores()` helper was refactored to take a live `orgId: string`
parameter (dropping its internal `const orgId = authStore.orgId` capture + null-check), the
`onMounted(() => initStore())` call was removed, and a `watch(() => authStore.orgId, (orgId) => {
<unsubscribeAll>; if (orgId) initStore(orgId) }, { immediate: true })` was added — mirroring
`TeamView.vue`'s 104-REVIEW CR-01 block exactly. `{ immediate: true }` preserves first-mount
behavior, so the watcher fully replaces the onMounted subscribe (no double-subscribe).
`onUnmounted` teardown was left unchanged in each view.

Per-view notes:
- **ServicesView.vue** — the reported view. Its teams-store seed block (editor-gated) moved
  inside the refactored `initStore(orgId)` unchanged.
- **SongsView.vue** — `initStore()` call removed from `onMounted`, but the `?import=true` query
  handling and `resolveSongEditRequest()` stayed in `onMounted` (mount-once deep-link concerns,
  not org-scoped).
- **DashboardView.vue** — the special case. Its three `if (!store.orgId)` guards (which would
  have defeated re-subscription, since `resetOrgScopedStores()` nulls each store's `orgId`
  before the watcher fires) were removed; all three shared stores (songs, services, roster) are
  now unconditionally torn down and re-subscribed together. `onMounted` import replaced with
  `watch` (Dashboard has no `onUnmounted` — it shares stores with other views, and the
  teardown-then-resubscribe is idempotent/null-guarded).
- **RosterView.vue** — the watcher stops both `stopSeedWatch`/`stopTeamsSeedWatch` seed watches
  FIRST (before tearing down the stores) so a switch never leaks the old church's seed watchers,
  then unsubscribes and re-subscribes roster+teams. `applyEditQuery()` stayed in `onMounted`.
- **QuarterView.vue** — straightforward migration; `onMounted` import removed entirely (no
  other use remained in the file).

**Task 2 — ServiceEditorView fails safe on a church switch**
`/services/:id` is keyed to a serviceId from the OLD church; that id cannot exist in the newly
selected church. Added a `watch(() => authStore.orgId, (orgId, oldOrgId) => { if (oldOrgId)
router.push('/services') })` WITHOUT `{ immediate: true }`. Omitting `immediate` means it never
fires on first mount; the `if (oldOrgId)` guard also skips the initial null -> value org
resolution (WR-01 late auth — a user landing directly on the route before `authStore.orgId`
resolves), since `oldOrgId` is null/undefined on that first callback. It fires only on a genuine
already-established-church-to-another-value switch. `initStores()` and the existing `isEditor`
watcher were left untouched.

**Task 3 — Regression tests + full gates**
- `ServicesView.test.ts`: new `describe('church switch re-subscribe (260901-lua)')` proves a
  switch (`orgId: 'org-1'` -> `'org-2'`) calls `unsubscribeAll()` and re-subscribes with `'org-2'`
  (never re-running with `'org-1'`) — the core LIVE-new-org-id proof.
- `ServiceEditorView.test.ts`: new `describe('church switch fail-safe nav (260901-lua)')` proves
  (1) no navigation on first mount, (2) no navigation on the null -> value initial resolution
  (WR-01), (3) navigation to `/services` on a genuine `org-1` -> `org-2` switch.

## Deviations from Plan

None — plan executed exactly as written. All per-view specifics (teams block placement, seed-watch
ordering, DashboardView guard removal, ServiceEditorView watcher signature) matched the plan's
prescribed action text.

## Gate Results (per CLAUDE.md)

- **`npm run type-check`** (vue-tsc --build): **CLEAN** after every task (Task 1, Task 2, and
  Task 3 test additions).
- **Named test files** (Task 1 verify): `ServicesView.test.ts` + `SongsView.test.ts` +
  `RosterView.test.ts` — 30/30 passed.
- **Named test files** (Task 2 verify): `ServiceEditorView.test.ts` + `ServiceEditorView.stage.test.ts`
  — 353/353 passed.
- **Named test files** (Task 3, with new regression tests): `ServicesView.test.ts` (5 tests) +
  `ServiceEditorView.test.ts` (344 tests) — 349/349 passed.
- **Bare `npx vitest run`** (full suite, NOT `--dir src`): **2 failed files, 1 failed test** out of
  184 files / 4994 tests:
  1. `src/storage.rules.test.ts` — the KNOWN env-limited Storage-emulator cross-service
     `firestore.exists()` limitation documented in CLAUDE.md. Not a regression, not touched by
     this task.
  2. `src/stores/appConfig.test.ts` ("saveField calls setDoc exactly once with the dot-path
     payload...") — a **pre-existing failure NOT caused by this task**. Confirmed via
     `git log -- src/stores/appConfig.ts`: commit `b365a1b9` ("fix: appConfig saveField wrote a
     literal dotted key, never persisted") changed `saveField`'s runtime behavior to write a
     nested object instead of a dotted-key string, but its own test was never updated to match —
     the test still asserts the old dotted-key shape. This file is under `src/stores/`, which
     this task's data-safety constraint explicitly forbids modifying, and the failure is
     unrelated to org-scoped subscription/church-switch behavior. Per the executor's scope
     boundary rule (only auto-fix issues directly caused by the current task's changes), this
     was left as-is and is flagged here for a future task to fix the test assertion (or decide
     the dotted-key test was intentionally superseded). CLAUDE.md's documented single-file
     baseline (`storage.rules.test.ts` only) is therefore currently stale by one file — this
     summary is the record of that drift.
- **`git diff --name-only`** across all three task commits: **zero files under `src/stores/`**
  changed — confirmed via `git diff --name-only HEAD~2 HEAD | grep -c '^src/stores/'` = 0.

## Data-Safety Verification

- Every re-subscribe call in the six migrated/fixed views passes the LIVE `orgId` value the
  watcher callback receives — no `const orgId = authStore.orgId` capture remains outside a
  watcher callback in any of the six files.
- No file under `src/stores/` was modified; every store write action's `orgId.value` guard is
  unchanged.
- `ServiceEditorView` never attempts to read or write the old serviceId under the new church — it
  navigates away instead, relying on `ServicesView`'s own orgId watcher (Task 1) to subscribe the
  new church once mounted.

## Known Stubs

None.

## Threat Flags

None — this task closed threats T-lua-01 through T-lua-04 from the plan's own threat register
(all `mitigate`, all addressed by Tasks 1-2); no new surface was introduced.

## Self-Check: PASSED

Verified files exist:
- FOUND: src/views/ServicesView.vue (contains `watch(() => authStore.orgId` block)
- FOUND: src/views/SongsView.vue
- FOUND: src/views/DashboardView.vue
- FOUND: src/views/RosterView.vue
- FOUND: src/views/QuarterView.vue
- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServicesView.test.ts
- FOUND: src/views/__tests__/ServiceEditorView.test.ts

Verified commits exist (`git log --oneline --all | grep`):
- FOUND: 6e7bf4c5 (Task 1)
- FOUND: 8afc8288 (Task 2)
- FOUND: c23cf412 (Task 3)
