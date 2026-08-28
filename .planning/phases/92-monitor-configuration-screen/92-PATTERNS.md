# Phase 92: Monitor Configuration Screen - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 5 new/modified artifacts
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/router/index.ts` (add route entry) | route | request-response | existing `/services` route entry, same file | exact |
| `src/views/MonitorSetupView.vue` | component (view) | request-response + device-local persistence | `src/views/SettingsView.vue` | role-match (card layout, toggle/select conventions, mirror-write style) |
| `src/components/AppSidebar.vue` (add nav item) | component | event-driven (nav click) | existing `Settings`/`Admins` nav item block, same file | exact |
| `src/views/__tests__/MonitorSetupView.test.ts` | test | request-response | `src/views/__tests__/SettingsView.test.ts` | exact (mount + store-mock harness conventions) |
| Role-selector / monitor cards | component (inline in view) | CRUD-like (assign/persist) | SettingsView.vue's toggle/radio/select cards | role-match |

## Pattern Assignments

### `src/router/index.ts` — new `/monitor-setup` route

**Analog:** same file, the `/services` and `/settings` route objects (lines 54-59, 72-77).

**Core pattern** (lines 54-59):
```typescript
{
  path: '/services',
  name: 'services',
  component: () => import('../views/ServicesView.vue'),
  meta: { requiresAuth: true },
},
```
Note this route uses ONLY `requiresAuth: true` (no `requiresEditor`) — matches R275/CONTEXT.md's
"any authenticated org member" requirement for `/monitor-setup`. Do NOT copy `/settings`'s
`requiresEditor: true` (lines 72-77) — that would wrongly restrict a viewer.

**Insertion point:** add as its own top-level route object, e.g. immediately after `/settings`
(line 77) and before `/owner-console` (line 81), using the same lazy `() => import(...)` shape:
```typescript
{
  path: '/monitor-setup',
  name: 'monitor-setup',
  component: () => import('../views/MonitorSetupView.vue'),
  meta: { requiresAuth: true },
},
```
No new `RouteMeta` flags are needed — `requiresAuth` already exists (lines 5-11). Because this is a
static path segment, ordering relative to the dynamic `/:slug/...` share routes at the bottom (lines
101-123) does not matter, but keep it grouped with the other static authed routes for readability.

The `router.beforeEach` guard (lines 127-212) needs no changes: `requiresAuth` alone triggers the
existing org-selection gate (lines 138-147) — same behavior as `/services`.

---

### `src/views/MonitorSetupView.vue` (new view)

**Analog:** `src/views/SettingsView.vue` (full file, 1312 lines) — page shell, per-section card
layout, dark-mode classes, and the toggle/radio "load state → mutate local ref → persist →
saved/error feedback" pattern for the role assignment + save flow.

**Page shell / imports pattern** (lines 1-8, 592-604):
```vue
<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Settings</h1>
        <p v-if="authStore.orgName" class="text-sm text-gray-400 mt-1">{{ authStore.orgName }}</p>
      </div>
```
```typescript
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
```
MonitorSetupView needs no Firestore/`db` import (device-scoped, not org-scoped) — instead import
`computeFingerprint`, `saveMapping`, `loadMapping`, `matchMapping` from `@/utils/monitorConfig`
(Phase 91, read in full above).

**Card container pattern** (lines 11-12, 68-69, 201-202, repeated per section):
```vue
<div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
  <h2 class="text-sm font-semibold text-gray-300 mb-3">Organization</h2>
  ...
</div>
```
Use one card per detected monitor (per CONTEXT.md's "a card per detected monitor showing its label +
resolution + a primary badge"), and a separate, clearly-separated card for the fallback panel (D-06
"first-class, not error state") — mirror the `v-if`-gated card pattern used for the AI Features card
(lines 259-308, gated on `authStore.aiMasterEnabled`) for switching between the granted-state card
list and the fallback card.

**Radio/select role-assignment pattern** (Bible Translation card, lines 310-358; Slide Typography
`<select>`, lines 371-396) — closest existing analog for "assign one of two mutually-exclusive roles
(Audience/Confidence) per monitor":
```vue
<label
  class="flex items-center gap-3"
  :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
>
  <input
    v-model="bibleVersionInput"
    type="radio"
    value="ESV"
    name="bibleVersion"
    data-testid="bible-version-esv"
    class="h-4 w-4 border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
  />
  <span class="text-sm text-gray-200">ESV (English Standard Version)</span>
</label>
```
Adapt: drop the `authStore.isEditor` gate (monitor setup is open to any authed member, R275 — do not
copy the editor-only disable pattern), use `data-testid="monitor-role-{screenFingerprint}-audience"`
etc. per monitor card, and `name="monitorRole-{fingerprint}"` so each monitor's pair is its own radio
group.

**Save/feedback pattern** (`onChangeBibleVersion`, lines 1102-1124) — adapt for localStorage instead
of Firestore:
```typescript
async function onChangeBibleVersion() {
  if (!authStore.orgId || !authStore.isEditor) return
  const newValue = bibleVersionInput.value
  bibleVersionSaveError.value = null
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.bibleVersion': newValue })
    authStore.settings.bibleVersion = newValue
    bibleVersionSavedFeedback.value = true
    setTimeout(() => { bibleVersionSavedFeedback.value = false }, 2000)
  } catch (err) {
    bibleVersionSaveError.value = 'Failed to save. Please try again.'
    bibleVersionInput.value = newValue === 'ESV' ? 'NLT' : 'ESV'
  }
}
```
`saveMapping`/`loadMapping` (per `monitorConfig.ts`, lines 108-135) never throw and are synchronous —
so MonitorSetupView's save handler is simpler than this analog: no `try/catch` needed around the
persistence call itself (the module swallows storage errors), but keep the "Saved!" transient
feedback UX (`ref` + `setTimeout(...,2000)`) for consistency with the rest of the app.

**Window Management API call — NEW pattern, no existing analog in this codebase.** Per CONTEXT.md,
`getScreenDetails()` MUST be called synchronously inside a click handler with no `await` before it.
None of SettingsView's or RosterView's handlers do anything like this (they're all async Firestore
calls) — this is a genuinely new interaction pattern for the codebase. Structure it as:
```typescript
function onRequestScreens() {
  // Synchronous call — NO await before this line (loses user-activation, PITFALLS 1/2).
  if (!('getScreenDetails' in window)) {
    permissionState.value = 'unavailable'
    return
  }
  ;(window as any).getScreenDetails().then((details: any) => {
    permissionState.value = 'granted'
    liveScreens.value = details.screens
  }).catch(() => {
    permissionState.value = 'denied'
  })
}
```

**On-load reuse-silently pattern** — new, but follows SettingsView's `watch(..., { immediate: true })`
/ mount-time load convention (lines 790-796, `loadOrgSlug` via `watch(orgId, ..., { immediate: true })`):
call `loadMapping()` + (once live screens are known) `matchMapping(saved, live)` and branch UI on
`'matched'` vs `'needs-reprompt'`.

---

### `src/components/AppSidebar.vue` — nav entry point

**Analog:** same file, the `Settings` nav item (lines 170-179), directly adjacent to `Admins`
(lines 159-168) in "Group C".

**Pattern** (lines 170-179):
```typescript
if (authStore.isEditor) {
  items.push({
    label: 'Settings',
    to: '/settings',
    icon: `<svg ...>...</svg>`,
  })
}
```
Adapt: gate on `authStore.orgId` only (not `authStore.isEditor` — R275 says any authenticated org
member, editor or viewer, per CONTEXT.md's routing decision), matching the `Services` item's gate
(lines 115-123, `if (authStore.orgId) { ... }`) rather than the editor-only items. Add as a new
`items.push({ label: 'Monitor Setup', to: '/monitor-setup', icon: ... })` entry, likely grouped near
`Services` (Group A, orgId-gated) rather than Group C (editor-only) since this is deliberately not
editor-restricted.

---

### `src/views/__tests__/MonitorSetupView.test.ts` (new test)

**Analog:** `src/views/__tests__/SettingsView.test.ts` (232+ lines) — mount harness, store-mock
shape, and `vi.mock` conventions for a standalone view test.

**Mount/import pattern** (lines 11-14, 21):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'
enableAutoUnmount(afterEach)
```

**Auth-store mock shape** (lines 135-160-ish) — module-scope mutable `let` vars exposed as getters
inside `vi.mock('@/stores/auth', ...)`, so a test can flip state between assertions:
```typescript
let mockOrgId: string | null = 'org-1'
let mockIsEditor = true
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get orgId() { return mockOrgId },
    get isEditor() { return mockIsEditor },
    // ...
  }),
}))
```
MonitorSetupView's test needs a much smaller mock (no Firestore doc updates) — omit the
`firebase/firestore` mock block (lines 44-60) entirely since `monitorConfig.ts` is pure/localStorage
only. Instead:
- Mock/stub `window.getScreenDetails` per CONTEXT.md's Verification section: a granted case
  returning fake `ScreenDetailed[]`, a denied case rejecting, and an unavailable case where the
  property is simply absent from `window` (`delete (window as any).getScreenDetails` or don't
  define it).
- Use a real (or `Storage`-shaped in-memory) `localStorage`/pass a `storageOverride` directly to
  `saveMapping`/`loadMapping` if the view exposes that seam, otherwise stub `window.localStorage`
  the way vitest/jsdom already provides it (no mock needed — jsdom's localStorage works out of the
  box; just `localStorage.clear()` in `beforeEach`).
- Assert the "no `await` before the synchronous call" contract indirectly: trigger the click handler
  and assert `getScreenDetails` was called synchronously (i.e., before any awaited microtask
  resolves) — e.g. by checking the mock was invoked before `await flushPromises()`.

---

## Shared Patterns

### Dark-mode card shell
**Source:** `src/views/SettingsView.vue` lines 3-8, 11-12 (repeated per section, e.g. 68-69, 201-202,
259-262, 312-313, 362-363, 471-472)
**Apply to:** MonitorSetupView's page wrapper (`<AppShell><div class="px-6 py-8 max-w-4xl">`) and
every monitor card / fallback panel (`rounded-lg bg-gray-900 border border-gray-800 p-4[ mt-6]`).

### Section heading
**Source:** `src/views/SettingsView.vue` line 12, `<h2 class="text-sm font-semibold text-gray-300 mb-3">`
**Apply to:** each monitor card's label + each of "Detected Monitors" / "Manual Setup" (fallback)
section headers.

### Buttons (primary / secondary / danger)
**Source:** `src/views/SettingsView.vue` lines 26-33 (primary indigo), 117-123 (secondary gray),
124-131 (danger red) — reuse the exact class strings:
```
bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors
bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors
```
**Apply to:** MonitorSetupView's "Detect Monitors" / "Re-check" primary button and any secondary
actions in the fallback panel.

### Saved/error feedback micro-pattern
**Source:** `src/views/SettingsView.vue` — repeated `<p v-if="xSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>` / `<p v-if="xSaveError" class="text-red-400 text-sm mt-2">{{ xSaveError }}</p>`
plus the `ref(false)` + `setTimeout(...,2000)` reset (e.g. lines 880-883).
**Apply to:** "Saved for this device" confirmation after a role assignment, and any localStorage
write failure messaging (though `monitorConfig.ts` never throws, so an explicit error path may be
unnecessary — only a positive "Saved" confirmation is needed).

### Test-mount + store-mock harness
**Source:** `src/views/__tests__/SettingsView.test.ts` lines 11-21, 93-160
**Apply to:** `MonitorSetupView.test.ts`'s harness (minus the Firestore mocks, per above).

### AppShell wrapper
**Source:** `src/components/AppShell.vue` (wraps every top-level view; used identically by
SettingsView.vue line 2 and RosterView.vue line 2 — `<AppShell><div class="px-6 py-8">...`)
**Apply to:** MonitorSetupView.vue's root template.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Window Management API call (`getScreenDetails()` sync-in-click-handler) | utility/inline handler | event-driven (user-gesture-gated permission prompt) | No existing code in the app calls a permission-gated browser API synchronously from a click handler — this is a genuinely new interaction pattern introduced by Phase 91/92; follow CONTEXT.md's explicit sequencing rule instead of an app analog. |
| `screens`/`currentscreenchange` listener wiring | event-driven | pub-sub (native event listener) | No existing `addEventListener`-based live-list-refresh pattern in a view; implement per CONTEXT.md's guidance (keep setup-screen list live while open) using standard `onMounted`/`onUnmounted` add/removeEventListener, mirroring Vue's own lifecycle-hook conventions used elsewhere for cleanup (e.g. `onSnapshot` unsubscribe patterns in stores) but with a native DOM/API listener instead of Firestore. |

## Metadata

**Analog search scope:** `src/router/index.ts`, `src/views/SettingsView.vue`, `src/views/RosterView.vue`,
`src/components/AppSidebar.vue`, `src/views/__tests__/SettingsView.test.ts`, `src/utils/monitorConfig.ts`
**Files scanned:** 6 read in full/targeted excerpts, 13 view-test files enumerated for harness convention confirmation
**Pattern extraction date:** 2026-08-28
