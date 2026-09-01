# Quick Task 260901-lua: Fix "Switch Church" sticking on "Loading services…" + cross-church data safety — Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Severity:** MAJOR (data / availability). Owner report.

<domain>
## Task Boundary

The sidebar "Switch Church" quick-select (multi-org members) leaves the Services
screen stuck on "Loading services…" after switching churches. Requirement: switching
churches must fully clear the previous church's data and re-point every org-scoped
view at the newly selected church, with certainty that no write can land on the wrong
church (no cross-church overwrite). Hard refresh must not be required.
</domain>

<root_cause>
## Root Cause (CONFIRMED by code read — locked)

The Phase 104 sidebar church switcher changes the active org **in place**:

`AppSidebar.handleSwitch(id)` → `authStore.selectOrg(id)` (src/stores/auth.ts:689):
  1. `rememberOrg(uid, id)`
  2. `resetOrgScopedStores()` (src/stores/orgScopedStores.ts) → calls
     `useServiceStore().unsubscribeAll()` et al, which tears down the Firestore
     listener AND sets `isLoading = true`, `services = []`, `orgId = null`
     (src/stores/services.ts:279-292).
  3. `await loadOrgContext(uid)` → sets `authStore.orgId` to the NEW church.

There is **no route change and no component remount** during this switch (the user
stays on `/services`).

`ServicesView` subscribes to the service store **only in `onMounted()`**
(src/views/ServicesView.vue:363-390) via `initStore()`. Because the view never
remounts, `serviceStore.subscribe(newOrg)` is never called after the switch, so
`isLoading` stays `true` forever → **stuck on "Loading services…"**. This is the exact
reported symptom.

### This is an incompletely-applied Phase 104 fix
Phase 104's own review (104-REVIEW CR-01) identified this precise class and fixed it
for TWO views only:
  - `src/views/TeamView.vue:521-544` — the CANONICAL TEMPLATE to mirror.
  - `src/views/SettingsView.vue:799-805`.
Both use `watch(() => authStore.orgId, (orgId) => { teardown(); clear stale local
state; if (orgId) subscribe(orgId) }, { immediate: true })` REPLACING the onMounted-only
subscribe.

### Affected views that were MISSED (subscribe only in onMounted, no orgId watcher)
- `src/views/ServicesView.vue` (REPORTED — sticks on "Loading services…")
- `src/views/SongsView.vue`
- `src/views/DashboardView.vue`
- `src/views/RosterView.vue` (Volunteers)
- `src/views/QuarterView.vue` (Schedule)
- `src/views/ServiceEditorView.vue` (edge case — see decisions)

Note: DashboardView additionally guards each subscribe with `if (!store.orgId)`, which
would also block re-subscription — the guard must not defeat the re-subscribe.
</root_cause>

<decisions>
## Implementation Decisions (locked)

### Fix pattern — mirror TeamView exactly
For each affected list/dashboard view, REPLACE the `onMounted(() => initStore())` call
with a `watch(() => authStore.orgId, (orgId) => { <unsubscribeAll / teardown>; <clear
stale local view state if any>; if (orgId) <subscribe(orgId)> }, { immediate: true })`.
Keep the existing `onUnmounted` teardown. `{ immediate: true }` preserves first-mount
behavior, so the reactive watcher fully replaces the onMounted subscribe (do not run
both, or you double-subscribe). Each store's `subscribe()` already calls its own
`unsubscribeFn()` first, and `unsubscribeAll()` is null-guarded, so teardown-then-
subscribe is safe and idempotent.

### Read the LIVE org id, never a captured variable (data-safety core)
The watcher callback must subscribe with the NEW `orgId` value the watcher hands it (or
`authStore.orgId` read live inside the callback) — NEVER a `const orgId = authStore.orgId`
captured at mount. The store write target (`orgId.value` in each store) is set only
inside `subscribe(orgId)`; passing the live new value is what guarantees subsequent
writes hit the new church, not the old one.

### DashboardView `if (!store.orgId)` guards
Remove/rework the `if (!store.orgId)` guards so the orgId watcher always re-points the
subscription on switch. (Dashboard shares stores with other views; use unsubscribeAll +
resubscribe on change, matching the others.)

### ServiceEditorView (edge case)
`/services/:id` is keyed to a service that belongs to the OLD org. On an org-id CHANGE
(not the initial immediate run), navigate to `/services` — the current serviceId cannot
exist in the new church, and staying would try to load a cross-org document. Do NOT
attempt to re-load the same serviceId under the new org. Guard so the initial mount is
unaffected. If this proves to add risk/scope, it MAY be split to its own task, but at
minimum it must fail safe (never read/write the old serviceId under the new org).

### Data-safety invariant to preserve & verify
No write action may target a stale org. Confirm every store write guards on `orgId.value`
(services.ts already does: `if (!orgId.value) return` / throws). The fix must not
introduce any path where a view calls `subscribe()` with an old org id or a write runs
between reset and re-subscribe against the wrong church.

### No hard refresh
The fix must make switching work with zero manual refresh.
</decisions>

<specifics>
## Specific References
- Template to copy: src/views/TeamView.vue:521-544 (and SettingsView.vue:799-805).
- Store reset entry point: src/stores/orgScopedStores.ts `resetOrgScopedStores()`.
- Services store loading/reset: src/stores/services.ts:226-292 (`isLoading`,
  `subscribe`, `unsubscribeAll`).
- Switcher entry: src/components/AppSidebar.vue `handleSwitch` (278-294) → auth.ts
  `selectOrg` (689-700).
- Existing regression test surfaces: src/components/__tests__/AppSidebar.test.ts,
  src/views/__tests__/SelectChurchView.test.ts.
</specifics>

<canonical_refs>
## Canonical References
- .planning/phases/104-notification-multi-church-foundations/104-REVIEW.md (CR-01 —
  the original diagnosis that was only partially applied).
- CLAUDE.md testing rules: gate on `npm run type-check` (vue-tsc --build) and
  `npx vitest run` (2-file baseline; storage.rules.test.ts is the known env-limited
  failure). Do NOT use `--dir src`.
</canonical_refs>
