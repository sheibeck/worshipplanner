---
phase: quick-260901-lua
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServicesView.vue
  - src/views/SongsView.vue
  - src/views/DashboardView.vue
  - src/views/RosterView.vue
  - src/views/QuarterView.vue
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServicesView.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
autonomous: true
requirements:
  - QUICK-260901-lua

must_haves:
  truths:
    - "On /services, using the sidebar Switch Church quick-select replaces the stuck 'Loading services…' state with the newly-selected church's services, with NO hard refresh."
    - "Every affected in-place org-scoped view (Services, Songs, Dashboard, Roster/Volunteers, Schedule) re-subscribes its store(s) to the LIVE new authStore.orgId when the org changes without a route change or remount."
    - "Each re-subscribe passes the new org id the orgId watcher hands in (or authStore.orgId read live), never a mount-time captured constant."
    - "The service editor at /services/:id fails safe on a church switch: it navigates to /services rather than reading or writing the old, now-cross-org serviceId under the new church."
    - "The service editor does NOT navigate away on the initial org resolution (null -> value, WR-01 late auth) or on first mount."
    - "No store write can target the previous church during or after the switch gap — every store write action still guards on orgId.value (stores are untouched)."
  artifacts:
    - src/views/ServicesView.vue
    - src/views/SongsView.vue
    - src/views/DashboardView.vue
    - src/views/RosterView.vue
    - src/views/QuarterView.vue
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServicesView.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
  key_links:
    - "authStore.orgId (changed in place by AppSidebar.handleSwitch -> authStore.selectOrg -> loadOrgContext) -> each view's watch(() => authStore.orgId, cb, { immediate: true }) -> store.subscribe(newOrgId)."
    - "store.subscribe(orgId) sets orgId.value, which every write action guards on (services.ts / songs.ts / roster.ts / teams.ts / quarters.ts)."
    - "ServiceEditorView watch(() => authStore.orgId) WITHOUT immediate, guarded by if (oldOrgId) -> router.push('/services')."
---

<objective>
Fix the sidebar "Switch Church" quick-select so that switching churches (an in-place
authStore.orgId change with NO route change and NO component remount) stops leaving the
Services screen stuck on "Loading services…", fully clears the previous church's data, and
re-points every org-scoped view at the newly-selected church — with certainty that no write
can land on the wrong church.

Root cause (LOCKED, confirmed in 260901-lua-CONTEXT.md): the Phase 104 sidebar switcher
changes the active org in place, but the affected views subscribe to their stores only in
onMounted(). Because the view never remounts, subscribe(newOrg) is never called after a
switch, so isLoading stays true forever (the reported symptom). Phase 104's own review
(CR-01) already fixed this class for TeamView.vue (521-544) and SettingsView.vue — this plan
applies the SAME canonical pattern to the six views that were missed.

Purpose: restore correct multi-church switching and guarantee cross-church data safety
(no stale-org read, no cross-church write).
Output: six views migrated from onMounted-only subscribe to an authStore.orgId watcher
(mirroring TeamView exactly), plus regression tests proving re-subscribe + fail-safe nav.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260901-lua-fix-church-quick-select-menu-switching-c/260901-lua-CONTEXT.md
@CLAUDE.md

# Canonical fix template — copy this pattern EXACTLY:
@src/views/TeamView.vue

# Views to fix + store contracts:
@src/views/ServicesView.vue
@src/views/ServiceEditorView.vue
@src/stores/orgScopedStores.ts
@src/stores/services.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate the five list/dashboard views to an authStore.orgId watcher</name>
  <files>src/views/ServicesView.vue, src/views/SongsView.vue, src/views/DashboardView.vue, src/views/RosterView.vue, src/views/QuarterView.vue</files>
  <action>
In each of the five views below, REPLACE the onMounted-only store subscribe with a
`watch(() => authStore.orgId, (orgId) => { <teardown>; if (orgId) <resubscribe with the
live orgId the watcher hands in> }, { immediate: true })` — mirroring TeamView.vue's
104-REVIEW CR-01 block (lines 521-544) EXACTLY. `{ immediate: true }` preserves first-mount
behavior, so the reactive watcher fully replaces the onMounted subscribe — do NOT keep both
(that double-subscribes). Keep each view's existing onUnmounted teardown. CRITICAL data-safety
rule (per CONTEXT decisions): the re-subscribe MUST use the `orgId` value the watcher hands the
callback (the LIVE new org id), NEVER a `const orgId = authStore.orgId` captured at mount.
Refactor each view's subscribe helper to take an `orgId: string` parameter and use it, moving
the null-check up into the watcher's `if (orgId)` guard.

Per-view specifics:

- ServicesView.vue (~363-390): change `initStore()` to `initStore(orgId: string)` — drop its
  internal `const orgId = authStore.orgId; if (!orgId) return`, keep the rest (serviceStore.subscribe(orgId)
  and the existing `if (authStore.isEditor && !teamsStore.orgId) { teamsStore.subscribe(orgId); ... }`
  teams block, which correctly re-points teams because resetOrgScopedStores() nulls teamsStore.orgId
  before this watcher fires). Delete `onMounted(() => { initStore() })`. Add a watcher that calls
  `serviceStore.unsubscribeAll()` then `if (orgId) initStore(orgId)`. Leave onUnmounted as-is.

- SongsView.vue (~349-418): change `initStore()` to `initStore(orgId: string)` (drop the internal
  capture + null-check; body stays `songStore.subscribe(orgId)`). REMOVE the `initStore()` call from
  `onMounted(async () => { ... })` but KEEP the rest of that onMounted (the `?import=true` handling and
  `resolveSongEditRequest()` — those are mount-once deep-link concerns, not org-scoped). Add a watcher:
  `songStore.unsubscribeAll()` then `if (orgId) initStore(orgId)`. Leave onUnmounted as-is.

- DashboardView.vue (~276-288): this is the special-cased view. REMOVE the three `if (!store.orgId)`
  guards (they defeat re-subscription on switch — CONTEXT decision). Replace the whole
  `onMounted(() => { ... })` with a watcher that, on change, tears down and re-points all three shared
  stores: `songStore.unsubscribeAll(); serviceStore.unsubscribeAll(); rosterStore.unsubscribeAll();`
  then `if (orgId) { songStore.subscribe(orgId); serviceStore.subscribe(orgId); rosterStore.subscribe(orgId) }`.
  Update the vue import at line 154 from `{ computed, onMounted }` to `{ computed, watch }` (onMounted is
  no longer used). Do NOT add an onUnmounted (Dashboard never had one — it shares stores; the watcher's
  unsubscribe-then-resubscribe is idempotent and null-guarded).

- RosterView.vue (~730-778): change `initStore()` to `initStore(orgId: string)` (drop the internal
  capture + null-check; keep rosterStore.subscribe(orgId), teamsStore.subscribe(orgId), and the two
  seed-watch assignments to stopSeedWatch / stopTeamsSeedWatch). REMOVE the `initStore()` call from
  onMounted but KEEP `applyEditQuery()` there. Add a watcher that FIRST stops any prior seed watches
  (`stopSeedWatch?.(); stopSeedWatch = null; stopTeamsSeedWatch?.(); stopTeamsSeedWatch = null`) so a
  switch never leaks the old church's seed watchers, THEN `rosterStore.unsubscribeAll(); teamsStore.unsubscribeAll();`
  then `if (orgId) initStore(orgId)`. Leave onUnmounted as-is.

- QuarterView.vue (~840-854): change `initStores()` to `initStores(orgId: string)` (drop the internal
  capture + null-check; body stays quartersStore.subscribe(orgId); rosterStore.subscribe(orgId)). Delete
  `onMounted(() => { initStores() })`. Add a watcher: `quartersStore.unsubscribeAll(); rosterStore.unsubscribeAll();`
  then `if (orgId) initStores(orgId)`. Leave onUnmounted as-is.

Data-safety intent (must hold for all five): during a real switch, selectOrg() calls
resetOrgScopedStores() (nulling every store's orgId.value and clearing its arrays) BEFORE loadOrgContext
sets authStore.orgId to the new value — so by the time these watchers fire, stores are already torn down;
the unconditional unsubscribeAll() at the top of each watcher is the belt-and-suspenders that also handles
same-tab re-mounts and is safe/idempotent (each store's subscribe() calls its own unsubscribeFn() first,
and unsubscribeAll() is null-guarded). Do NOT touch any file under src/stores/ in this task.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run src/views/__tests__/ServicesView.test.ts src/views/__tests__/SongsView.test.ts src/views/__tests__/RosterView.test.ts</automated>
  </verify>
  <done>
`npm run type-check` (vue-tsc --build) is clean. Each of the five views contains a
`watch(() => authStore.orgId, ..., { immediate: true })` block and NO longer subscribes its
store(s) from onMounted. No `const orgId = authStore.orgId` capture remains outside a watcher
callback in these files. DashboardView no longer has the `if (!store.orgId)` guards. Named
view tests still pass. `git diff --name-only` shows NO file under src/stores/ changed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Make ServiceEditorView fail safe on a church switch</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
`/services/:id` is keyed to a serviceId that belongs to the CURRENT (old) church. On a church
switch the same serviceId cannot exist in the new church, and staying would attempt a cross-org
read/write. Per the CONTEXT edge-case decision, this view must FAIL SAFE by navigating to
`/services` on an org-id CHANGE — but must NOT navigate on the initial mount or on the initial
null -> value org resolution (WR-01 late auth, when a user lands directly on the route before
authStore.orgId resolves).

Add ONE watcher near the existing init block (around lines 3062-3083, alongside the isEditor
watcher and onMounted). Watch `() => authStore.orgId` WITHOUT `{ immediate: true }`, with a
callback signature `(orgId, oldOrgId)` that navigates only when `oldOrgId` is truthy:
`if (oldOrgId) router.push('/services')`. Rationale to encode in an inline comment: omitting
`immediate` means it never fires on first mount; the `if (oldOrgId)` guard skips the null -> value
initial resolution (oldOrgId is null/undefined then) and fires ONLY when an already-established
church changes to another value (or to null) — i.e. a genuine switch away. `router` is already
available (useRouter is used elsewhere in this file, e.g. the /run push and delete-then-push).

Do NOT add `{ immediate: true }`. Do NOT modify `initStores()` or the existing isEditor watcher —
those handle legitimate first-mount / late-role subscription and must keep their idempotent
`if (!store.orgId)` guards. Do NOT attempt to re-load the same serviceId under the new org.
Because we navigate away, ServiceEditorView unmounts (its onUnmounted runs) and ServicesView's
new orgId watcher (Task 1) subscribes the new church — this view needs no store re-point of its
own. The existing `serviceStore.services` watcher already returns early when the serviceId is not
found in the (now-empty, post-reset) list, so no cross-org document is read during the gap.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts</automated>
  </verify>
  <done>
`npm run type-check` clean. ServiceEditorView contains a `watch(() => authStore.orgId, (orgId, oldOrgId) => { if (oldOrgId) router.push('/services') })` block with NO `{ immediate: true }`.
`initStores()` and the isEditor watcher are unchanged. Existing ServiceEditorView tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Regression tests (re-subscribe with live new org + fail-safe nav) and full gates</name>
  <files>src/views/__tests__/ServicesView.test.ts, src/views/__tests__/ServiceEditorView.test.ts</files>
  <action>
Add regression tests proving the two data-safety guarantees, using the EXISTING reactive auth
mocks in each file (both already use Vue `reactive()` for the auth store, so mutating orgId after
mount fires the component's `watch(() => authStore.orgId, ...)`).

In src/views/__tests__/ServicesView.test.ts (the REPORTED view; `mockAuthState` is reactive with
`orgId`, and `@/stores/services` is mocked with the `mockSubscribe` / `mockUnsubscribeAll` spies):
add a `describe('church switch re-subscribe (260901-lua)')` block that (1) mounts ServicesView with
`mockAuthState.orgId = 'org-1'`, awaits `flushPromises()`, and asserts `mockSubscribe` was called
with `'org-1'` (immediate first-mount subscribe still works); (2) resets the subscribe spy history,
sets `mockAuthState.orgId = 'org-2'`, awaits a tick / `flushPromises()`, then asserts BOTH
`mockUnsubscribeAll` was called (prior church torn down / data cleared) AND `mockSubscribe` was
called with `'org-2'` — the LIVE NEW org id — and NOT with `'org-1'` again. This is the core
proof: the switch re-subscribes with the new org id, never a mount-time captured value.

In src/views/__tests__/ServiceEditorView.test.ts (`mockAuthState` is reactive with `orgId`; the
router push spy is `mockRouterPush`, and `mockRoute` is reactive with `params.id`): add a
`describe('church switch fail-safe nav (260901-lua)')` block that (1) mounts with
`mockAuthState.orgId = 'org-1'`, awaits `flushPromises()`, and asserts `mockRouterPush` was NOT
called with `'/services'` (no navigation on first mount); (2) to cover the WR-01 initial-resolution
case, mounts a fresh instance with `mockAuthState.orgId = null`, then sets it to `'org-1'`, awaits a
tick, and asserts `mockRouterPush` was still NOT called with `'/services'` (null -> value is initial
resolution, not a switch); (3) with an instance mounted at `orgId = 'org-1'`, sets
`mockAuthState.orgId = 'org-2'`, awaits a tick, and asserts `mockRouterPush` WAS called with
`'/services'` (fail-safe navigation on a genuine switch). Reset `mockRouterPush` between the sub-cases
(the file's beforeEach already resets auth state to `orgId: 'org-1'`; clear the push spy in your block
so counts are clean). Follow the file's existing mount helper and `flushPromises` conventions; keep
the new tests additive (do not alter existing tests).

Finally run the FULL gates per CLAUDE.md. Do NOT use `npx vitest run --dir src` (it bypasses
vite.config.ts excludes and runs rules.test.ts). Confirm the ONLY failing file is the known
env-limited `src/storage.rules.test.ts` (Storage-emulator cross-service limitation — NOT a
regression); any other failing file is a real regression to fix. Also confirm the fix is view-only:
`git diff --name-only` must show NO file under src/stores/, and every store write action still
guards on `orgId.value` (unchanged).
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run</automated>
    <automated>git diff --name-only | grep -c '^src/stores/' | grep -qx 0 && echo STORES_UNCHANGED</automated>
  </verify>
  <done>
New regression tests exist in both named test files and pass. `npm run type-check` clean. Bare
`npx vitest run` shows no NEW failing file beyond the known `src/storage.rules.test.ts` env
limitation. The ServicesView test proves a switch re-subscribes with `'org-2'` (never a re-run
with `'org-1'`) and tears down the prior subscription. The ServiceEditorView test proves it
navigates to `/services` only on a genuine org change, not on first mount or null -> value. The
`STORES_UNCHANGED` check confirms zero store files were modified.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| church A context -> church B context (in-place org switch) | The active org id changes with no route change/remount; every org-scoped read subscription and every write target must move atomically from A to B or the wrong church's data is read/written. |
| client view -> Firestore org-scoped collections | Writes carry an org id derived from store state (orgId.value), never user input; the org path is the isolation boundary between churches. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-lua-01 | Information Disclosure | Affected views read stale church A data / stay stuck loading after switching to B | high | mitigate | orgId watcher tears down A's listener and re-subscribes to B with the LIVE new org id (Task 1); store unsubscribeAll() clears A's cached arrays before B's snapshot arrives. |
| T-lua-02 | Tampering | A write (e.g. autosave) lands on church A while the user has switched to B (cross-church overwrite) | critical | mitigate | Re-subscribe always passes the live new org id, never a mount-time capture (Task 1); store write actions remain guarded on orgId.value (verified unchanged, Task 3); ServiceEditorView fails safe to /services so no old serviceId is written under B (Task 2). |
| T-lua-03 | Information Disclosure | ServiceEditorView loads/writes the old church's serviceId under the new church | high | mitigate | orgId-change watcher (no immediate, if(oldOrgId)) navigates to /services on a genuine switch; serviceStore.services watcher returns early when the id is absent from the post-reset list (Task 2). |
| T-lua-04 | Denial of Service | Leaked seed watchers / double subscriptions accumulate across repeated switches | low | mitigate | Watchers stop prior seed watches and call idempotent, null-guarded unsubscribeAll() before re-subscribing (Task 1); { immediate: true } replaces onMounted so no double-subscribe. |

No package-manager installs in this task — no supply-chain (T-*-SC) checkpoint required.
</threat_model>

<verification>
- `npm run type-check` (vue-tsc --build, per CLAUDE.md — the narrower `-p tsconfig.app.json`
  form is insufficient) is clean across all changes.
- Bare `npx vitest run` (NOT `--dir src`) shows only the known env-limited
  `src/storage.rules.test.ts` failure; every other file passes.
- Each of the six views reacts to an in-place authStore.orgId change: teardown + clear stale
  state + re-subscribe with the LIVE new org id; ServiceEditorView instead fails safe to /services.
- Data-safety confirmed: no file under src/stores/ changed; every store write action still guards
  on orgId.value; no re-subscribe uses a mount-time captured org id.
</verification>

<success_criteria>
- Switching churches on /services immediately shows the new church's services with NO hard refresh
  (the "Loading services…" stall is gone).
- Services, Songs, Dashboard, Roster/Volunteers, and Schedule all re-point to the newly-selected
  church on an in-place switch.
- The service editor navigates to /services on a switch instead of touching the old serviceId under
  the new church, and does not navigate on first mount or initial org resolution.
- Regression tests prove re-subscribe-with-new-org and fail-safe-nav; full gates pass at the known
  baseline.
</success_criteria>

<output>
Create `.planning/quick/260901-lua-fix-church-quick-select-menu-switching-c/260901-lua-SUMMARY.md` when done.
</output>
