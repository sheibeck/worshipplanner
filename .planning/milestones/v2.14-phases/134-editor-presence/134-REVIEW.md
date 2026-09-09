---
phase: 134-editor-presence
reviewed: 2026-09-07T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/composables/useServicePresence.ts
  - src/utils/presence.ts
  - src/views/ServiceEditorView.vue
  - firestore.rules
  - functions/src/cleanupSweeps.ts
  - functions/src/index.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 134: Code Review Report

**Reviewed:** 2026-09-07
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 134 editor-presence feature: the `firestore.rules` presence
match block, the `useServicePresence` composable, its `presence.ts` schema
module, the `ServiceEditorView.vue` wiring, and the `cleanupStalePresence`
backstop sweep (`cleanupSweeps.ts` + `index.ts` re-export/preview wiring).

**Security posture is sound.** The `firestore.rules` presence block correctly
splits `get`/`list` (both org-scoped via `isOrgMember(orgId)`, never `if
true`/unscoped `isSignedIn()` — the SEC-S-01 guard holds), gates
`create`/`update` to own-doc-only (`presenceId == request.auth.uid` +
`request.resource.data.uid == request.auth.uid`) with a tight
`hasOnly(['uid', 'displayName', 'lastSeen'])` field allowlist, and gates
`delete` to own-doc-only. All 12 ALLOW/DENY rules tests (verified by reading
`src/rules.test.ts`'s presence describe block, not just trusting the "263
green" claim) exercise exactly the right matrix, including the cross-org
get/list/write DENY cases and the forged-uid/extra-field DENY cases. The
`ServiceEditorView.vue` indicator renders `displayName` via `{{ }}` text
interpolation only (never `v-html`), so a malicious display name cannot
inject markup. `cleanupStalePresenceHandler` is dry-run-by-default
(`cleanup.presenceEnabled` defaults `false`, fail-closed) and its
iterate-then-filter-by-age discipline matches its sibling sweeps.

The one substantive gap is in `useServicePresence.ts`: the composable's only
reactive trigger is a `watch(serviceId, { immediate: true })` — it does not
also watch `orgId`/`currentUser`, unlike the pre-existing
`subscribeConfirmations` pattern immediately above it in the same file
(`watch([() => authStore.orgId, () => localService.value?.id], ...)`). See
WR-01 below for the concrete race this opens up. A second, smaller gap is the
missing `.catch()` on the fire-and-forget `setDoc`/`deleteDoc` calls, which
breaks from an established codebase-wide convention (WR-02).

## Warnings

### WR-01: `useServicePresence` never re-activates if `orgId`/`currentUser` resolve after mount

**File:** `src/composables/useServicePresence.ts:129-136`
**Issue:** The only reactive source that re-triggers `start()`/`stop()` is
`serviceId`:
```ts
watch(
  () => toValue(serviceId),
  (_newId, oldId) => {
    if (oldId) stop(oldId)
    start()
  },
  { immediate: true },
)
```
`serviceId` in `ServiceEditorView.vue` is `computed(() => route.params.id as
string)` — available synchronously from the route, independent of auth
state. `authStore.orgId`, by contrast, is populated asynchronously
(`src/stores/auth.ts:540`, inside an async org-resolution flow that runs
after `onAuthStateChanged` fires), and the router's `beforeEach` guard
(`src/router/index.ts:254-259`) only awaits `getCurrentUser()` — i.e. the
Firebase Auth user — before allowing navigation into a `requiresAuth` route.
It does **not** wait for `authStore.orgId` to be populated.

Concretely: on a hard refresh landing directly on
`/services/:id` (or any route re-entry where the auth user resolves but
`authStore.orgId` is still mid-flight), the composable's `immediate` watch
callback fires once with `org` still falsy. `start()` hits the
`if (!org || !svc || !user?.uid)` guard, sets `presenceDocs.value = []`, and
returns — **no heartbeat is scheduled and no `onSnapshot` listener is ever
attached.** Since the watch's only dependency is `serviceId`, and the user
will typically stay on the same service after `orgId` resolves, presence
never activates for that mount: the current user never appears to others,
and the current user never sees who else is present, until they navigate to
a *different* service (which changes `serviceId` and re-triggers the watch).

This is the exact class of race the codebase already has a named fix for
(`church-switch-resubscribe-fix`, and the `subscribeConfirmations` watch
immediately above this code in `ServiceEditorView.vue` deliberately includes
`() => authStore.orgId` as a dependency for this reason).

**Fix:** Include `orgId` (and ideally `currentUser`) in the watch source so
a late-resolving auth/org state re-triggers `start()`:
```ts
watch(
  () => [toValue(orgId), toValue(serviceId), toValue(currentUser)?.uid] as const,
  ([_newOrg, newSvc], prev) => {
    const oldSvc = prev?.[1] ?? null
    if (oldSvc && oldSvc !== newSvc) stop(oldSvc)
    start()
  },
  { immediate: true },
)
```
(Adjust `stop`'s previous-service tracking accordingly — the key requirement
is that a transition from "org/user not ready" to "ready" with the same
`serviceId` must re-run `start()`.)

### WR-02: Fire-and-forget `setDoc`/`deleteDoc` calls have no `.catch()`, unlike the rest of the codebase

**File:** `src/composables/useServicePresence.ts:56, 88`
**Issue:** Both write paths are un-awaited and uncaught:
```ts
void setDoc(presenceDocRef(org, svc, user.uid), { ... })   // line 56
void deleteDoc(presenceDocRef(org, previousServiceId, user.uid))  // line 88
```
If either promise rejects — e.g. a `permission-denied` during a token
refresh/org-switch race, or a transient offline error — this surfaces as an
unhandled promise rejection (logged by the browser/test runner as
"Uncaught (in promise)"), not a silently-swallowed best-effort failure. The
heartbeat fires every `PRESENCE_HEARTBEAT_MS` (30s), so a persistent
permission/network issue would produce a recurring unhandled-rejection
warning rather than a clean no-op. Every other fire-and-forget write in this
codebase follows a `.catch(() => {})` (or equivalent) convention — e.g.
`useRunControl.ts:874,920,931,1010`, `useOutputWindow.ts:90,106,122`,
`useSlideshowAssembly.ts:498`, `stores/auth.ts:405`.

**Fix:**
```ts
void setDoc(presenceDocRef(org, svc, user.uid), {
  uid: user.uid,
  displayName: user.displayName || 'Someone',
  lastSeen: serverTimestamp(),
}).catch(() => {})
```
and
```ts
if (org && previousServiceId && user?.uid) {
  void deleteDoc(presenceDocRef(org, previousServiceId, user.uid)).catch(() => {})
}
```

## Info

### IN-01: `hasOnly` allowlist does not also require the fields to be present

**File:** `firestore.rules` (presence `create, update` rule)
**Issue:** `request.resource.data.keys().hasOnly(['uid', 'displayName',
'lastSeen'])` proves no *extra* field can ride onto the doc, but does not
require all three fields to be present — a write containing only `uid`
would pass. In practice the client always writes the full triple (see
`useServicePresence.ts:56-60`) and a doc missing `lastSeen` simply reads as
permanently stale client-side (`isPresenceStale` treats `null` as stale) and
is invisible in the UI, so this has no exploitable effect today. Worth
tightening if the doc shape ever needs a stronger write-time guarantee.
**Fix:** `request.resource.data.keys().hasOnly([...]) && request.resource.data.keys().hasAll(['uid', 'displayName', 'lastSeen'])` if a stronger guarantee is later desired.

---

_Reviewed: 2026-09-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
