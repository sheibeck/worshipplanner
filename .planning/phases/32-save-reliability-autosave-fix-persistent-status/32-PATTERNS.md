# Phase 32: Save Reliability — Autosave Fix & Persistent Status - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 14 (5 new source, 4 new test, 5 modified)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/stores/services.ts` (modify: `subscribe()`) | store (Firestore subscription) | event-driven (onSnapshot) | itself — current shape is the baseline to diff from | n/a (self) |
| `src/composables/useAutoSave.ts` (modify) | composable | event-driven (watch + debounce) | itself — extend in place | n/a (self) |
| `src/stores/saveStatus.ts` (new) | store, keyed map + derived rollup, no Firestore | CRUD (in-memory set/get) | `src/stores/roster.ts` (setup-store shape, `orgId`-scoped subscribe) for conventions; **no existing store is purely client-state** — closest structural shape (map + derived getter) is actually absent, so this is the first of its kind | role-match (store convention only) |
| `src/stores/toasts.ts` (new) | store, array-backed with per-item timers | event-driven (push/dismiss) | none — first array-backed transient store in the app | no analog (see below) |
| `src/components/SaveStatusIndicator.vue` (new) | component, pure presentation | request-response (reads one store entry) | the retired dot/title status markup in `CongregationalEditor.vue`/`SongLyricEditor.vue`/`ScriptureSlideEditor.vue` (same 4-state span pattern, now consolidated) | exact (markup already given verbatim in 32-UI-SPEC.md §2) |
| `src/components/ToastHost.vue` (new) | component, fixed-position app-level overlay | event-driven (renders array store) | `AppShell.vue`'s backdrop (`fixed inset-0 z-20`) for the "app-level fixed overlay mounted once" pattern; `LoginView.vue:77`'s red-950/red-800/red-400 error box for the visual triple | role-match (layout) + exact (color triple, per UI-SPEC) |
| `src/views/ServiceEditorView.vue` (modify: delete ~150 lines, add sticky status bar, migrate onto `useAutoSave`) | view | request-response + event-driven | itself — the three already-migrated editors (`CongregationalEditor.vue`, `SongLyricEditor.vue`) are the target shape to converge toward | exact (target shape) |
| `src/components/CongregationalEditor.vue` (modify: swap status markup) | component | event-driven | itself — mechanical swap | exact |
| `src/components/ScriptureSlideEditor.vue` (modify: swap status markup) | component | event-driven | `CongregationalEditor.vue` (near-identical header) | exact |
| `src/components/SongLyricEditor.vue` (modify: swap status markup) | component | event-driven | `CongregationalEditor.vue` (same span pattern, different container) | exact |
| `src/components/AppShell.vue` (modify: mount `<ToastHost />`) | provider/shell | n/a | itself | exact |
| `src/stores/__tests__/saveStatus.test.ts` (new) | test | n/a | `src/stores/__tests__/roster.test.ts` or nearest Pinia-store test for setup-store testing convention (see below) | role-match |
| `src/stores/__tests__/toasts.test.ts` (new) | test | n/a | same as above, using `vi.useFakeTimers()` | role-match |
| `src/components/__tests__/SaveStatusIndicator.test.ts` (new) | test | n/a | `src/composables/__tests__/useAutoSave.test.ts` (fake timers + status transitions) | role-match |
| `src/components/__tests__/ToastHost.test.ts` (new) | test | n/a | `src/composables/__tests__/useAutoSave.test.ts` (fake timers) | role-match |
| `src/views/__tests__/ServiceEditorView.test.ts` (modify: add R039 repro describe block) | test | n/a | itself — the file's own `BL-02` describe block (~3221-3379) and `R028 remote-merge stability` test (~1063-1111) | exact |
| `src/composables/__tests__/useAutoSave.test.ts` (modify: update 2 fade tests, add error-path tests) | test | n/a | itself | exact |

## Pattern Assignments

### `src/stores/services.ts` — `subscribe()` (store, event-driven)

**Current shape (lines 74-90), exact code to modify:**
```typescript
function subscribe(orgIdValue: string) {
  if (unsubscribeFn) {
    unsubscribeFn()
  }
  orgId.value = orgIdValue
  const q = query(
    collection(db, 'organizations', orgIdValue, 'services'),
    orderBy('date', 'desc'),
  )
  unsubscribeFn = onSnapshot(q, (snap) => {
    services.value = snap.docs.map((d) => {
      const data = d.data()
      return { id: d.id, name: '', notes: '', ...data } as Service
    })
    isLoading.value = false
  })
}
```
**Fix shape recommended by RESEARCH.md (Pattern 1):** add `{ includeMetadataChanges: true }` as the
second argument to `onSnapshot`, and surface `d.metadata.hasPendingWrites` (or filter on it) so the
remote-merge watcher in `ServiceEditorView.vue` can distinguish its own write settling from a genuinely
external change. `services.value` is a plain `ref<Service[]>` populated by `.map()` — whatever shape
carries the pending-write signal (a sibling `pendingWritesByServiceId` ref, or a field on `Service`
itself) must follow this store's existing convention: everything the subscription callback produces is
assigned synchronously inside the `onSnapshot` callback, nothing async.

**No `try/catch` exists in this subscription today** — errors are not currently handled at this layer
anywhere in the file; do not invent a new error-handling convention here unless RESEARCH.md's Pattern 1
requires it.

### `src/composables/useAutoSave.ts` (composable, event-driven, self-analog)

**Full current file already read — 164 lines total, single `Read` sufficient.** Two required edits,
both are deletions/additions to the existing structure, not a rewrite:

**Delete both fade-timer blocks** (lines 87-93 inside `scheduleSave`'s timeout, and lines 143-148 inside
`flush()`):
```typescript
// DELETE — both occurrences, identical body:
clearSavedFadeTimer()
savedFadeTimer = setTimeout(() => {
  if (status.value === 'saved') {
    status.value = 'idle'
  }
}, 3000)
```
Also delete `savedFadeTimer` (line 48), `clearSavedFadeTimer()` (lines 59-64), and its call inside
`cleanup()` (line 157) — all become dead code per 32-UI-SPEC.md §1.

**Add error handling** — today's `try { await saveFn(); status.value = 'saved' } finally { saving = false }`
(lines 84-96 and 140-151, both call sites) has no `catch`. Required new shape:
```typescript
try {
  await saveFn()
  status.value = 'saved'
} catch {
  status.value = 'error'
} finally {
  saving = false
}
```
Extend the type union at line 3: `export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'`.

**Existing coverage that must survive:** `src/composables/__tests__/useAutoSave.test.ts` — see its own
entry below for the two tests that need updating (not deleting).

### `src/stores/saveStatus.ts` (new store — Pinia setup-store convention)

**Analog:** `src/stores/roster.ts` for the `defineStore('name', () => {...})` setup-store shape, `ref`
for state, `computed` for derived values, and the `return { ...everything }` object-literal export
convention (roster.ts lines 1-2, 26-30, 277-298). **This store diverges from every existing store in one
structural way**: it has no `orgId`/`subscribe`/`unsubscribeAll` Firestore lifecycle at all — it is pure
client state. RESEARCH.md's own Pattern 2 code example is the concrete target shape (already vetted
against this codebase's conventions) — implement it as given:

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { AutoSaveStatus } from '@/composables/useAutoSave'

export interface SaveStatusEntry {
  status: AutoSaveStatus
  savedAt?: Date
  errorText?: string
}

export const useSaveStatus = defineStore('saveStatus', () => {
  const entries = ref<Record<string, SaveStatusEntry>>({})
  function set(surfaceId: string, entry: SaveStatusEntry) { entries.value[surfaceId] = entry }
  function clear(surfaceId: string) { delete entries.value[surfaceId] }
  function entryFor(surfaceId: string): SaveStatusEntry {
    return entries.value[surfaceId] ?? { status: 'idle' }
  }
  const mostUrgent = computed<SaveStatusEntry | null>(() => { /* URGENCY-ranked reduce, see RESEARCH.md Pattern 2 */ })
  return { entries, set, clear, entryFor, mostUrgent }
})
```

**Naming convention to follow (import path):** every other store imports Firestore helpers from
`firebase/firestore` and `@/firebase` at the top (roster.ts lines 3-18); `saveStatus.ts` needs none of
that — its only import beyond `vue`/`pinia` is the `AutoSaveStatus` type from `@/composables/useAutoSave`.

**Unmount lifecycle:** call `clear(surfaceId)` from each host component's existing `onUnmounted`, next to
its existing `cleanupAutoSave()` call (see `CongregationalEditor.vue` entry below for that call site).

### `src/stores/toasts.ts` (new store — array-backed, no existing analog)

**No existing store in this codebase is array-backed with per-item timers.** All nine existing stores
hold either a flat array synced from Firestore (`services.ts:68`, `roster.ts:27-28`) or scalar/`orgId`
refs — none manages ephemeral, timer-driven, client-only entries. Build from RESEARCH.md's own design
(no upstream code to copy beyond the general `defineStore` setup-store shape already shown above):

```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Toast { id: string; message: string }

export const useToasts = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])
  function push(message: string): string {
    const id = crypto.randomUUID()
    toasts.value.push({ id, message })
    setTimeout(() => dismiss(id), 6000) // 32-UI-SPEC.md §4: 6000ms auto-dismiss
    return id
  }
  function dismiss(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return { toasts, push, dismiss }
})
```
**Timer-leak caution (32-UI-SPEC.md E3 `partial` backstop):** a toast raised by a surface that unmounts
before 6000ms elapses must still self-dismiss cleanly — the timer lives inside the store, not the
component, so this is structurally satisfied as long as `dismiss()` is idempotent (filtering an
already-absent id is a no-op, not an error) — confirm the test in `toasts.test.ts` asserts exactly that.

### `src/components/SaveStatusIndicator.vue` (new component)

**Exact markup already specified — copy verbatim from 32-UI-SPEC.md §2**, reproduced here for direct
reference (this is the authoritative source, not an inferred pattern):
```html
<div class="text-xs" aria-live="polite" aria-atomic="true" data-testid="save-status">
  <span v-if="entry.status === 'pending'" class="italic text-gray-400">Saving soon…</span>
  <span v-else-if="entry.status === 'saving'" class="italic text-gray-400">Saving…</span>
  <span v-else-if="entry.status === 'saved'" class="text-green-400">Saved {{ formattedSavedAt }}</span>
  <span v-else-if="entry.status === 'error'" class="text-red-400" data-testid="save-status-error">{{ entry.errorText }}</span>
</div>
```
Props: `surfaceId: string`. Reads `useSaveStatus().entryFor(surfaceId)` reactively via a `computed`.
`formattedSavedAt` = `entry.savedAt?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })`
— same `'en-US'` locale convention already used elsewhere in `ServiceEditorView.vue`'s `formattedDate`.

**Analog for the 4-state span idiom this replaces (do not copy structurally, only note what's retired):**
`CongregationalEditor.vue:6-21` and `SongLyricEditor.vue:12-27` (read above) — both use the same
`v-if`/`v-else-if` chain over `autoSaveStatus`, with per-status `data-testid`s (`status-pending`,
`status-saving`, `status-saved`) that this component's single `data-testid="save-status"` replaces.

### `src/components/ToastHost.vue` (new component)

**Exact markup already specified — copy verbatim from 32-UI-SPEC.md §4.** Structural analog for "an
app-level fixed-position element mounted once in `AppShell.vue`, rendered conditionally on store state":
`AppShell.vue`'s own mobile sidebar backdrop —
```html
<!-- AppShell.vue:4-8, the closest existing "fixed overlay driven by reactive state" precedent -->
<div v-if="sidebarOpen" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="sidebarOpen = false"></div>
```
`ToastHost.vue` follows the same shape (a `v-for` over a store array instead of a single `v-if`, `fixed`
positioning, its own z-index layer — `z-[60]`, deliberately above `AppShell.vue`'s `z-20` backdrop and
every existing `z-50` Teleport dialog). Color triple (`bg-red-950 border-red-800 text-red-400`) is
copied from `LoginView.vue:77`'s existing fixed error box, per 32-UI-SPEC.md's own citation — not
reinvented.

### `src/views/ServiceEditorView.vue` — sticky status bar + inline block deletion

**Placement — exact markup given in 32-UI-SPEC.md §3**, inserted as a new sibling immediately before the
existing lock banner (`ServiceEditorView.vue:304-306`):
```html
<!-- ServiceEditorView.vue:304-306 — the lock banner, exact structural analog for the new status bar -->
<div
  v-if="authStore.isEditor && isLocked"
  class="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-800 bg-amber-950 px-4 py-3"
  data-testid="service-lock-banner"
>
```
New status bar mirrors this shape exactly (same `sticky top-0 z-10 mb-3`, mutually exclusive on
`canEditService`), with the routine `bg-gray-900 border-gray-800` pairing instead of the banner's amber:
```html
<div
  v-if="canEditService"
  class="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-4 py-2"
  data-testid="service-save-status-bar"
>
  <SaveStatusIndicator :surface-id="`service:${serviceId}`" />
</div>
```

**Delete from the existing "Save area"** (lines 96-136 read above): only the
`<template v-if="canEditService">...</template>` status block at lines 103-136 (including the `isDirty`
→ "Unsaved changes" fallback at 130-135, which becomes provably dead once `useAutoSave`'s watcher sets
`'pending'` synchronously). **Keep** Undo / Suggest All Songs / Mark as Planned / Export in place
(lines 138+) — this file's own header row is otherwise untouched.

**Migration source lines to consult (do not copy verbatim — these are the ~150 lines being deleted and
replaced by wiring onto `useAutoSave`, per RESEARCH.md Pattern 3):** `autosaveStatus`/`autosaveErrorSource`
refs at 1429-1437; the remote-merge watcher at ~1982-2037 (esp. the `autosaveInitialized = false` reset
at 2030, tied to the R039 fix); the hand-rolled debounce/save block at ~2104-2188; `onSave()` at 3467+.
**Target shape to converge toward:** see `CongregationalEditor.vue`/`SongLyricEditor.vue` entries below.

### `src/components/CongregationalEditor.vue` (mechanical swap — shared header layout)

**Current status markup to remove** (lines 6-21, read above):
```html
<span v-if="autoSaveStatus === 'pending'" data-testid="status-pending" class="inline-block w-2 h-2 rounded-full bg-yellow-400" title="Unsaved changes"></span>
<span v-else-if="autoSaveStatus === 'saving'" data-testid="status-saving" class="text-xs text-gray-400">Saving...</span>
<span v-else-if="autoSaveStatus === 'saved'" data-testid="status-saved" class="text-xs text-green-400">Saved &#10003;</span>
```
**Replace with:** `<SaveStatusIndicator :surface-id="`congregational:${currentReadingId}`" />` inside the
same header `<div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 shrink-0">`
(line 4). **`useAutoSave` call site to leave untouched** (per CONTEXT.md — `useAutoSave` itself is not
rewritten, only its status reporting changes): the existing composable call around
`sections`/`doAutoSave` stays; the new work is a `watch()` (or equivalent) that forwards
`autoSaveStatus.value` into `useSaveStatus().set(surfaceId, {...})`.

**★ Correctness risk flagged by RESEARCH.md Pattern 4:** `currentReadingId` starts `null` and is
populated inside `onFetchPassage()` AFTER `sections.value` is set (which is what arms `useAutoSave`'s
watcher) — a save can be reported into the store under a stale `congregational:null` key. Handle by
computing `surfaceId` from the first non-null id, or deferring registration — flag this as a real design
decision in the plan, not a copy-paste detail.

### `src/components/ScriptureSlideEditor.vue` (mechanical swap)

Same shape as `CongregationalEditor.vue` — same header line range convention (near-identical file,
confirmed by 32-UI-SPEC.md §5 table: "inside `:4`'s header row, replacing `:6-21`"). `surfaceId`:
`` `scripture:${currentReadingId}` ``. Same stale-id risk as `CongregationalEditor.vue` applies here too
(both editors share the exact id-population-order bug per RESEARCH.md Pattern 4).

### `src/components/SongLyricEditor.vue` (mechanical swap)

**Current status markup to remove** (lines 12-27, read above), nested one level deeper (inside
`<div class="flex items-center gap-2">` at line 8, itself inside the `shrink-0` header at lines 4-7):
```html
<span v-if="autoSaveStatus === 'pending'" data-testid="status-pending" class="inline-block h-2 w-2 rounded-full bg-yellow-400" title="Unsaved changes"></span>
<span v-else-if="autoSaveStatus === 'saving'" data-testid="status-saving" class="text-xs text-gray-400">Saving...</span>
<span v-else-if="autoSaveStatus === 'saved'" data-testid="status-saved" class="text-xs text-green-400">Saved &#10003;</span>
```
**Replace with:** `<SaveStatusIndicator :surface-id="`song-lyrics:${props.songId}`" />` in the same
`flex items-center gap-2` group (32-UI-SPEC.md §5 table: "inside `:8`'s ... group, replacing `:11-27`").
**Lower risk than the other two editors** — `props.songId` is set only while the parent `SongSlideOver`
is `v-if="open"` with a click-blocking backdrop, so no mid-save id-swap is currently reachable (still
worth a defensive test per 32-UI-SPEC.md E4 `partial`).

### `src/components/AppShell.vue` (mount `<ToastHost />`)

**Exact insertion point given by 32-UI-SPEC.md §4** — new sibling immediately after the existing
`<main>` (line 34-36 read above), still inside the outer `flex flex-col` so it stays fixed regardless of
scroll:
```html
<main class="flex-1 overflow-y-auto">
  <slot />
</main>
<ToastHost />
```
Import alongside the existing `AppSidebar` import (line 43): `import ToastHost from '@/components/ToastHost.vue'`.

### `src/views/__tests__/ServiceEditorView.test.ts` — R039 repro block

**Existing mocking conventions to reuse verbatim (already located, no new infrastructure needed):**

- `reactive()` reassignment idiom for `mockServicesList` (line 1064-1065):
```typescript
const reactiveServices = reactive([buildLegacyService()])
mockServicesList = reactiveServices as unknown as Service[]
```
- The `@/stores/services` mock declaration (lines 293-304) — `mockUpdateService` is already a hoisted
  `vi.fn()` shared across the whole file, and `services: mockServicesList` is read live by
  `useServiceStore()` inside the mock factory, so reassigning `mockServicesList` before `mountView()`
  is sufficient; no new mock wiring required.
- The `@/stores/importedSlides` reactive-stub pattern (lines 136-143) — a static object literal with
  `vi.fn()` methods, the template to follow for any NEW store mock this phase's tests might need (e.g.
  if `saveStatus`/`toasts` stores need mocking inside `ServiceEditorView.test.ts` rather than being
  allowed to run for real — confirm at plan time whether Pinia is installed in this test file's harness
  or everything is fully mocked).
- `mockTimestamp` (line 193) is **NOT reusable for the repro** — it has no enumerable fields and
  `JSON.stringify` drops it entirely (Pitfall 2 in RESEARCH.md). The repro needs a NEW
  `stampedService(seconds)` helper with `{ seconds, nanoseconds: 0 }` shaped `updatedAt`, exact recipe
  given in RESEARCH.md's "Code Examples → Repro Test" section — copy that helper and the full test body
  from there; it composes entirely from patterns already in this file (`mockService` base fixture,
  `reactive()`, `mockUpdateService` call-count assertions).
- Nearest existing test to model the new `describe` block's shape on: the `BL-02` describe block
  (~3221-3379) and the `R028 remote-merge stability` test (~1063-1111) — both already exercise the
  `reactiveServices` reassignment + `wrapper.vm.$nextTick()` + `await new Promise((r) => setTimeout(r, 900))`
  timing idiom the repro test needs (real timers, not fake — confirm which this file uses elsewhere
  before choosing for the new test).

### `src/composables/__tests__/useAutoSave.test.ts` — tests needing update, not deletion

Two existing tests assert the fade behavior being removed (per RESEARCH.md Pitfall 5 and
32-UI-SPEC.md §1):
- `'transitions through idle -> pending -> saving -> saved -> idle'` (lines 65-100 in that file) — only
  its final 3 lines (97-99, `vi.advanceTimersByTime(3000); expect(status.value).toBe('idle')`) assert the
  fade; keep the rest, change the tail to assert `status.value` stays `'saved'`.
- `'saved status fades to idle after 3 seconds'` (lines 271-293) — replace entirely with a test asserting
  `'saved'` persists (e.g. advance 60s, assert still `'saved'`).
- **New tests to add (additive):** a `catch`-path test asserting a rejected `saveFn()` sets
  `status.value === 'error'` (never stranded at `'saving'`), for both the debounced path and `flush()`.
**Total test count should stay flat or grow — a drop of 2 with no replacement is the warning sign
RESEARCH.md explicitly calls out.**

## Shared Patterns

### Pinia setup-store convention (all new stores)
**Source:** `src/stores/roster.ts:1-2, 26-30, 277-298`
**Apply to:** `src/stores/saveStatus.ts`, `src/stores/toasts.ts`
```typescript
export const useXStore = defineStore('x', () => {
  const someState = ref(...)
  function someAction() { ... }
  return { someState, someAction }
})
```
Every existing store uses the setup-store (function) form, never the options-object form — match this
exactly for both new stores, even though neither has Firestore state.

### `aria-live` / `role="alert"` split (accessibility, cross-cutting)
**Source:** 32-UI-SPEC.md §2 and §4 (authoritative, not inferred from existing code — this codebase has
no prior `aria-live` region to copy from)
**Apply to:** `SaveStatusIndicator.vue` (`aria-live="polite" aria-atomic="true"`, one region covering all
four states including error), `ToastHost.vue` (`role="alert"` only, no redundant `aria-live="assertive"`)

### `data-testid` convention
**Source:** used throughout (`ServiceEditorView.vue:83,124,187,202,209`, `CongregationalEditor.vue:8,14,19`)
**Apply to:** every new component — `data-testid="save-status"` / `"save-status-error"` on
`SaveStatusIndicator.vue`, `data-testid="toast-host"` / `` `toast-${toast.id}` `` on `ToastHost.vue`,
`data-testid="service-save-status-bar"` on the new sticky bar in `ServiceEditorView.vue`. Retiring
`status-pending`/`status-saving`/`status-saved` in the three editors is a deliberate breaking rename —
call it out in the plan.

### Sticky top-of-content bar, mutually exclusive with the lock banner
**Source:** `src/views/ServiceEditorView.vue:304-306` (the existing 31-UI-SPEC lock banner)
**Apply to:** the new status bar in `ServiceEditorView.vue` §3 — same `sticky top-0 z-10 mb-3` shell,
never rendered simultaneously with the banner (`canEditService` vs. `isLocked` are complementary), so no
offset math is needed between them.

### 800ms debounce, one constant everywhere
**Source:** `useAutoSave.ts:43` (`debounceMs = options?.debounceMs ?? 800`), already the default every
existing caller relies on (`CongregationalEditor.vue`, `SongLyricEditor.vue` both omit the third arg)
**Apply to:** the migrated `ServiceEditorView.vue` call to `useAutoSave` — do not pass a `debounceMs`
override; 32-UI-SPEC.md §6 settles this explicitly.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/stores/toasts.ts` | store | event-driven (array + per-item timers) | First array-backed, timer-driven, purely-client Pinia store in the app — every existing store either mirrors a Firestore collection (array synced via `onSnapshot`) or holds scalar `orgId`/`isLoading` refs. Build from RESEARCH.md's own design (given in full above), not from an existing file. |
| `src/stores/saveStatus.ts` | store | CRUD (in-memory map + derived getter) | Same reasoning — first store with zero Firestore involvement. The `defineStore` shell is copied from `roster.ts`; the map-keyed-by-id + derived-rollup body has no precedent to copy, only RESEARCH.md's own worked example. |

## Metadata

**Analog search scope:** `src/stores/`, `src/composables/`, `src/components/` (top-level, three editors),
`src/views/ServiceEditorView.vue`, `src/components/AppShell.vue`, `src/views/LoginView.vue` (color triple
only), corresponding `__tests__/` directories.
**Files scanned:** `src/stores/roster.ts`, `src/stores/services.ts`, `src/composables/useAutoSave.ts`,
`src/components/AppShell.vue`, `src/components/CongregationalEditor.vue`,
`src/components/SongLyricEditor.vue`, `src/views/ServiceEditorView.vue` (lines 1-210 + grep-located
sections), `src/views/__tests__/ServiceEditorView.test.ts` (mocking-convention sections).
**Pattern extraction date:** 2026-08-02
