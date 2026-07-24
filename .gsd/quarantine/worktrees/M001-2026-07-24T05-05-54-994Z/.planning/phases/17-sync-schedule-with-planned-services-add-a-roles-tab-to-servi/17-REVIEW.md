---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - firestore.rules
  - src/router/index.ts
  - src/stores/services.ts
  - src/types/service.ts
  - src/utils/serviceRoles.ts
  - src/utils/slug.ts
  - src/views/ServiceEditorView.vue
  - src/views/ShareView.vue
  - src/rules.test.ts
  - src/stores/__tests__/services.test.ts
  - src/utils/__tests__/serviceRoles.test.ts
  - src/utils/__tests__/slug.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/views/__tests__/ShareView.test.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the memorable public-share exposure (`ShareView.vue` + `serviceShares` rules), the
`roleAssignmentOverrides` scoped-write path in `services.ts`, the new Roles tab in
`ServiceEditorView.vue`, and the slug/route plumbing.

The high-risk items called out in the task — public-read PII exposure, `serviceShares` rule
correctness (org-editor-scoped create/update, immutable `orgId`, cross-org overwrite denial),
and dot-path (never whole-map) override writes — are all implemented correctly and are backed
by emulator/unit tests that assert the right thing. No PII (email/phone/pcPersonId) leaks
through the share snapshot, and the `serviceShares` rule mirrors the already-hardened
`quarterShares` rule exactly.

However, tracing the new Roles-tab data flow end-to-end surfaced one real functional
correctness bug (BLOCKER) and two reactivity/race-condition gaps (WARNING) that are new to
this phase's diff, not pre-existing behavior. These are UX/data-correctness issues, not
security holes — the fail-safe direction (never subscribing PII-adjacent collections when in
doubt) is consistently the one taken, which is why nothing here rises to a security finding.

## Critical Issues

### CR-01: Viewer-generated share links silently drop "Who's Serving" (roster/quarters store is never subscribed for non-editors, but the Share button is not editor-gated)

**File:** `src/views/ServiceEditorView.vue:911-925` (Share button has no `v-if="authStore.isEditor"`), `src/views/ServiceEditorView.vue:1348-1369` (`initStores()` only subscribes `rosterStore`/`quartersStore` `if (authStore.isEditor)`), `src/stores/services.ts:196-205` (`createShareToken` now reads `useRosterStore().people`/`.roles` and `useQuartersStore().quarters` to build `roleAssignments`)

**Issue:** The "Share" button at the bottom of `ServiceEditorView.vue` is available to *any*
authenticated user who can view the page — it has no `authStore.isEditor` guard (unlike the
"Delete" button a few lines below it, which does). `/services/:id` itself only requires
`requiresAuth` (not `requiresEditor`), so viewers legitimately land here and can click Share.

Phase 17 added a new dependency inside `createShareToken` (`src/stores/services.ts`): it now
calls `useRosterStore()` and `useQuartersStore()` to resolve `roleAssignments` via
`resolveServiceRoleAssignments(service, quartersStore.quarters, rosterStore.roles)`. But
`ServiceEditorView.vue`'s `initStores()` only calls `rosterStore.subscribe(orgId)` /
`quartersStore.subscribe(orgId)` when `authStore.isEditor` is true (intentionally, per the
CR-05 comment, to avoid ever loading roster/quarters data into a viewer's client).

The result: when a **viewer** clicks Share, `rosterStore.roles` and `quartersStore.quarters`
are still their default empty arrays (`ref<Role[]>([])`, `ref<Quarter[]>([])` — never
populated because `subscribe()` was never called for this session). Since
`resolveServiceRoleAssignments` maps over the (empty) `roles` array, it returns `[]`, so
`roleAssignments: []` is written into both the `shareTokens/{token}` doc and the
`serviceShares/{slug}__service-{date}` doc. In `ShareView.vue`, the "Who's Serving" section is
gated by `v-if="serviceSnapshot.roleAssignments?.length"`, so it renders as if the org has no
roles configured at all — even though the quarter schedule has real assignments. This silently
produces an incorrect public artifact (congregation/volunteers see no "Who's Serving" info)
purely based on which role happened to click Share, with no error surfaced anywhere.

This is a regression introduced by this phase: before Phase 17, `createShareToken` had no
roster/quarters dependency, so a viewer clicking Share worked correctly for every other field.

**Fix:** Either (a) gate the Share button to editors only (`v-if="authStore.isEditor"`,
matching the Delete button precedent), or (b) if viewers must be able to generate share links,
subscribe `rosterStore`/`quartersStore` (or fetch a one-off read) regardless of role before
calling `createShareToken`, or (c) have `createShareToken` degrade explicitly (e.g. log/return
a flag) when `rosterStore.roles.length === 0 && quartersStore.quarters.length === 0` so this
doesn't fail silently. Option (a) is simplest and matches the rest of the file's pattern:
```vue
<button
  v-if="authStore.isEditor"
  type="button"
  @click="onShare"
  ...
>
```

## Warnings

### WR-01: Roles tab silently stays empty for a real editor who lands directly on `/services/:id` before `authStore.isEditor` resolves

**File:** `src/views/ServiceEditorView.vue:1348-1369` (`initStores()`), `src/views/ServiceEditorView.vue:1371-1373` (`onMounted(() => { initStores() ... })`)

**Issue:** `initStores()` is called exactly once, in `onMounted`, and its roster/quarters
subscription is gated by a one-time read of `authStore.isEditor`:
```js
if (authStore.isEditor) {
  if (!rosterStore.orgId) rosterStore.subscribe(orgId)
  if (!quartersStore.orgId) quartersStore.subscribe(orgId)
}
```
`authStore.isEditor` is a computed backed by `userRole`, which is populated asynchronously by
`loadOrgContext()` (triggered from the auth-state-changed flow, not synchronously available at
mount). The router guard for `/services/:id` only has `meta: { requiresAuth: true }` (not
`requiresEditor`), so — unlike routes that call `authStore.waitForRole()` in
`router/index.ts:117-124` — nothing forces `userRole` to have resolved before this component
mounts. If a genuine editor navigates directly to `/services/:id` (bookmark, page refresh, deep
link, or simply the first authenticated page they land on this session) before `userRole`
finishes loading, `initStores()` evaluates `authStore.isEditor` as `false` at that instant and
never calls `rosterStore.subscribe()` / `quartersStore.subscribe()`. There is no watcher to
retry once `isEditor` flips true, so for the rest of that session `resolvedRoleAssignments` and
`hasQuarterForServiceDate` (`ServiceEditorView.vue:2208-2216`) stay computed against empty
stores — the Roles tab button appears (it's reactively gated correctly) but its body
permanently shows "No schedule found for this date — assign roles manually below." even though
a quarter schedule exists.

**Fix:** Add a `watch(() => authStore.isEditor, (v) => { if (v) initStores() })` (or fold the
roster/quarters subscription into a `watchEffect` keyed on `authStore.isEditor`) so the
subscription re-evaluates once the role resolves, instead of being decided once at mount time.

### WR-02: Lost-update race in the Roles tab override checkbox handler — rapid toggles of two different people for the same role can clobber each other

**File:** `src/views/ServiceEditorView.vue:2229-2238` (`onToggleOverridePerson`), `src/stores/services.ts:149-159` (`setRoleOverride`)

**Issue:** `onToggleOverridePerson` derives its next-state array from the *currently rendered*
`assignment.effectivePersonIds`:
```js
async function onToggleOverridePerson(assignment: ResolvedRoleAssignment, personId: string) {
  const current = new Set(assignment.effectivePersonIds)
  current.has(personId) ? current.delete(personId) : current.add(personId)
  await serviceStore.setRoleOverride(localService.value.id, assignment.roleId, Array.from(current))
}
```
`assignment` (and thus `effectivePersonIds`) only updates once the write round-trips back
through `serviceStore.services` → the `watch(() => serviceStore.services, ...)` merge at
`ServiceEditorView.vue:1244-1277` (gated on `autosaveStatus` being `idle`/`saved`). There is no
optimistic local update of `localService.value.roleAssignmentOverrides` at click time. If a
user checks two different people's boxes for the *same* role in quick succession (a completely
normal interaction — e.g. selecting three vocalists), both clicks compute `current` from the
same stale `effectivePersonIds` baseline. The second `setRoleOverride` call overwrites the
scoped `roleAssignmentOverrides.{roleId}` dot-path key with only its own addition, silently
dropping the first click's selection. The per-write mechanism itself is correctly scoped
(dot-path, not whole-map — the primary "clobber-bug class" this phase was hardened against),
but the UI's read-then-write pattern reintroduces a lost-update race one level up, scoped to a
single role's checkbox group.

**Fix:** Apply an optimistic local update to `localService.value.roleAssignmentOverrides[roleId]`
immediately on click (before/alongside the `setRoleOverride` call), so subsequent clicks in the
same tick read the just-updated local state instead of waiting for the Firestore round-trip.
Alternatively, disable the checkbox group for a role while a write for that role is in flight.

## Info

### IN-01: `serviceSnapshot` is typed `any`, losing type safety across the whole component

**File:** `src/views/ShareView.vue:130`

**Issue:** `const serviceSnapshot = ref<any>(null)` means every downstream template
expression (`serviceSnapshot.value.roleAssignments`, `.slots`, `.sermonPassage`, etc.) is
unchecked by TypeScript. A typo or shape drift between the writer (`services.ts`) and reader
(`ShareView.vue`) would not be caught at compile time.

**Fix:** Define and export a `ServiceShareSnapshot` type (mirroring the object literal built in
`createShareToken`) and use `ref<ServiceShareSnapshot | null>(null)`.

### IN-02: Confusing (though not incorrect) optional-chaining comparison in the Who's Serving guard

**File:** `src/views/ShareView.vue:93`

**Issue:** `v-if="role.personNames?.length > 0"` — when `personNames` is `undefined`, this
evaluates `undefined > 0`, which is `false` in JS, so the `v-else` "[not assigned]" branch
correctly renders. Behavior is correct today (every writer always sets `personNames` to an
array), but the expression reads as if it could throw or behave unexpectedly, and is one
refactor away from becoming a real bug if `personNames` is ever normalized to `null` instead of
`undefined` in future.

**Fix:** `v-if="(role.personNames?.length ?? 0) > 0"` for clarity and defensiveness.

### IN-03: Dead code — `vwTypeLabels` lookup is declared and immediately voided, never actually used

**File:** `src/views/ShareView.vue:118-124`

**Issue:** 
```js
const vwTypeLabels: Record<number, string> = { 1: 'Call to Worship', 2: 'Intimate', 3: 'Ascription' }
// Used in template indirectly via slot data — keep for future use
void vwTypeLabels
```
The comment claims it's "used in template indirectly," but nothing in the template or script
references `vwTypeLabels` — the `void` statement exists purely to suppress an unused-variable
lint error. This is speculative dead code with a misleading comment.

**Fix:** Remove it until the VW-type display is actually implemented in `ShareView.vue`, or
wire it up if it was intended to label song slots (`SongBadge`-equivalent) on the public share
page.

### IN-04: Unused `ScriptureRef` type import

**File:** `src/views/ShareView.vue:115`

**Issue:** `import type { ScriptureRef } from '@/types/service'` is imported but never
referenced — `serviceSnapshot` is typed `any` (see IN-01), so nothing in this file uses
`ScriptureRef`.

**Fix:** Remove the unused import, or use it to type `serviceSnapshot.sermonPassage` once
IN-01 is addressed.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
