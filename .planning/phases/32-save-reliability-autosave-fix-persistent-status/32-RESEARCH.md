# Phase 32: Save Reliability — Autosave Fix & Persistent Status - Research

**Researched:** 2026-08-02
**Domain:** Vue 3 / Pinia autosave reliability (Firestore echo race), shared save-status UI, minimal toast host
**Confidence:** HIGH

## Summary

The root-cause hypothesis in R039/STATE.md is **confirmed, not merely plausible** — verified by reading
`ServiceEditorView.vue`'s live source line-by-line and cross-checking the mechanism against
`src/stores/services.ts` and the Firestore JS SDK's documented `serverTimestamp()` semantics. Every save
this view makes — `onSave()` at line 3467 **and** the D-15 immediate reorder-save at line 1817 — writes
through `serviceStore.updateService`, which unconditionally appends `updatedAt: serverTimestamp()`
(`src/stores/services.ts:171`) regardless of what the caller sent. `onSave()` destructures `updatedAt`
out of its own payload (line 3482) and never re-assigns it onto `localService.value` after a successful
save (line 3523 clones `localService` into `originalService`, but `localService.updatedAt` itself is never
refreshed). So the client's copy of `updatedAt` goes stale the instant any save succeeds, while the
document's real `updatedAt` keeps advancing. When that write's own snapshot echoes back through
`serviceStore.services` (`src/views/ServiceEditorView.vue:1982-2037`), the JSON-diff guard that exists
specifically to "avoid spurious re-renders after our own save completes" (its own comment, line 2015)
fails on exactly the field this bug is about: `remoteJson !== localJson` purely because `updatedAt`
differs, so the watcher treats its own echo as a genuine remote change, applies it, and unconditionally
resets `autosaveInitialized = false` (line 2030). The very next `watch(localService, …)` trigger — a
discrete one-shot mutation like picking a song is exactly this — hits the `if (!autosaveInitialized) {
autosaveInitialized = true; return }` guard at lines 2134-2136 and is swallowed with no debounce armed,
no status change, and no console signal. Continuous typing self-heals because the *second* keystroke's
watch trigger finds `autosaveInitialized` already `true`; a one-shot action has no second trigger.

There is a second, previously undocumented layer that makes this worse than a single race window:
Firestore's JS SDK resolves a pending `serverTimestamp()` field as `null` in the **first** (optimistic,
pre-ack) snapshot delivered to `onSnapshot`, then delivers a **second** snapshot with the real
`Timestamp` once the server acknowledges — confirmed via Firebase's own docs on `DocumentSnapshot`
`serverTimestamps` behavior. `serviceStore.subscribe()` calls `onSnapshot(q, callback)` with no
`includeMetadataChanges` option and `d.data()` with no `serverTimestamps` option, so it receives **both**
emissions as ordinary data changes. That means one save can open the swallow window **twice** in quick
succession (once for the optimistic local echo, once again for the server-ack echo) — which matches why
this bug is hard to pin down empirically: the exact width and count of the dead window depends on network
latency and Firestore's local-cache timing, not just component code.

This is not the only path into the same failure: the D-15 reorder-save (`ServiceEditorView.vue:1817-1863`)
calls the identical `serviceStore.updateService`, so a **drag** followed immediately by a **discrete pick**
reproduces the same swallow through the same mechanism — R039 must not be scoped as "fix `onSave()`," it
is "fix the remote-merge watcher's echo-detection," because every write path shares one `updatedAt`-based
guard.

**Primary recommendation:** Fix the remote-merge watcher's echo-detection, not `onSave()`'s payload shape.
The idiomatic Firestore fix is `onSnapshot(q, { includeMetadataChanges: true }, callback)` combined with
checking `snap.metadata.hasPendingWrites` (or per-doc `d.metadata.hasPendingWrites`) to distinguish "this
snapshot is my own write settling" from "this is a genuinely different writer's change" — rather than
trying to diff-match `updatedAt` at all. This is a store-layer change (`src/stores/services.ts`), not a
view-layer change, and composes cleanly with keeping `useAutoSave` unmodified in scope (per CONTEXT.md,
`useAutoSave` gains only `'error'` and loses only the fade timer — it never touches Firestore directly, so
this fix lives entirely below it). Write the failing repro test FIRST as R039 and 32-CONTEXT.md mandate;
the mechanism below gives exact line numbers and exact state transitions to assert against.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **A failing repro test is the first commit of this phase.** It must reproduce "pick a song
  immediately after a prior save's echo lands → no save fires." R039 mandates repro-before-fix, and
  the echo/`autosaveInitialized` hypothesis is MEDIUM confidence and has never been reproduced
  against the live app.
- **If the repro test passes (hypothesis disproved), STOP and widen.** The plan converts from a fix
  plan to a diagnostic plan; record the disproof in the SUMMARY. Do not ship a speculative rewrite
  onto a root cause that was never demonstrated.
- **The `ServiceEditorView` → `useAutoSave` migration happens only after the repro is green and the
  root cause is confirmed.** R040 names the de-duplication explicitly, so it is in scope — but
  migrating first would destroy the evidence the repro test is standing on.
- **Keep Phase 31's `autosaveErrorSource` reorder-vs-edit split.** Two producers genuinely need two
  recovery instructions ("try dragging again" — the order was reverted; "try again" — your text is
  still here). Carry the discriminator into the shared layer; do not flatten it to one message.
- **`useSaveStatus` lives as a Pinia store at `src/stores/saveStatus.ts`** — consistent with the nine
  existing stores.
- **`useSaveStatus` sits strictly ABOVE `useAutoSave`, which is not rewritten.** `useAutoSave` keeps
  owning the debounce, the inflight guard, `flush()` and `cleanup()`; it *reports into* the store.
  The composable is already tested (`src/composables/__tests__/useAutoSave.test.ts`) and that
  coverage must survive the phase.
- **Status is keyed by surface id, with a derived "most urgent" rollup.** Several autosaving surfaces
  can be mounted simultaneously; a single global ref would let one surface's `saved` visually erase
  another's `saving`.
- **Extend `AutoSaveStatus` to `'idle' | 'pending' | 'saving' | 'saved' | 'error'`** and carry an
  optional error source.
- **"Above the fold" in R040 is read as "parked in the global app header, far from the content."**
  The status therefore goes in a **sticky sub-header of the editing surface itself**. Flag this
  reading in the plan as the one decision most worth a second look.
- **Label text is `Saving…` / `Saved HH:MM` / the failure text** — wall-clock time, not relative.
- **`Saved HH:MM` persists; it does NOT fade to idle after 3s.** The timestamp stays until the next
  change.
- **All four autosaving surfaces get it via one shared component**: `ServiceEditorView.vue`,
  `CongregationalEditor.vue`, `ScriptureSlideEditor.vue`, `SongLyricEditor.vue`.
- **Build a minimal app-level toast host in `AppShell.vue`, driven by a small store.** No toast
  primitive exists today. Keep the host small and hand-written; do not add a toast library.
- **Failure only — no success toast.**
- **The inline error text stays even when a toast fires.**
- **`aria-live="polite"` on the inline status region; the failure toast is `role="alert"` (assertive).**

### Claude's Discretion

- Exact debounce value for the Service Order surface. R041's text references 500ms while
  `useAutoSave` defaults to 800ms — pick one deliberately and state it, rather than letting the two
  numbers coexist unexplained. **32-UI-SPEC.md already resolved this: 800ms everywhere** (§ 6) —
  treat as settled unless the plan finds a reason to reopen it.
- Component naming, file placement within `src/components/`, and Tailwind class choices.
- Whether the shared status component is one component with a variant prop or a component plus a
  thin per-surface wrapper. **32-UI-SPEC.md already resolved this: one component, no wrapper**
  (`SaveStatusIndicator.vue` takes a `surfaceId` prop) — treat as settled.
- Toast dismissal timing and stacking behaviour. **32-UI-SPEC.md already resolved this: 6000ms
  auto-dismiss + manual `×`, array-backed stack with independent timers, no hover-to-pause.**

### Deferred Ideas (OUT OF SCOPE)

- **Offline / queued saves** — retrying a failed save automatically, or queueing mutations while
  disconnected. R041 asks only that a failure be announced, not that it be recovered.
- **A general-purpose notification/toast system** beyond the single failure case (success toasts,
  info toasts, undo-in-toast). Build only what R041 needs.
- **Migrating the inline `pcExported` export banner onto the new toast host.** A Planning Center
  export concern; changing it here would be an unrequested behaviour change.
- **Header / tab chrome redesign** — Phase 36 owns the Service Order rebuild and the contextual
  action bars.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R039 | Every mutation on the Service Order fires autosave, including discrete one-shot actions; a failing repro test must precede any fix | Root-cause mechanism confirmed against live source (§ Architecture Patterns → "Root Cause: Confirmed"); exact repro-test recipe given (§ Code Examples → "Repro Test"); the reorder-save path is identified as a second entry point into the same failure (§ Common Pitfalls → Pitfall 3) |
| R040 | One persistent inline status, backed by one `useSaveStatus` aggregator; `ServiceEditorView` stops hand-duplicating `useAutoSave` | `useSaveStatus` Pinia store shape and rollup logic (§ Architecture Patterns → Pattern 2); the safe migration sequence off the inline ~150-line block onto `useAutoSave`, enumerating everything that must be preserved (§ Architecture Patterns → Pattern 3); how the three already-migrated editors currently call `useAutoSave` (§ Architecture Patterns → Pattern 4) |
| R041 | Save failure raises a toast, success does not, status region is `aria-live` | Toast host architecture and edge-triggering rule (§ Architecture Patterns → Pattern 5); which existing `useAutoSave.test.ts` tests assert the fade behaviour being removed and must be updated (§ Common Pitfalls → Pitfall 5) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firestore echo detection (the R039 fix) | Database / Storage (`src/stores/services.ts` subscription layer) | — | The bug is a snapshot-vs-local-write race; the fix belongs where the snapshot listener is configured, not in the component that merely reacts to the store's state |
| Autosave debounce, inflight guard, error catch | Frontend composable (`src/composables/useAutoSave.ts`) | — | Already owns this responsibility for three of four surfaces; R040 extends rather than replaces it |
| Save-status aggregation across surfaces | Pinia store (`src/stores/saveStatus.ts`, new) | Frontend composable (each `useAutoSave` instance reports into it) | Cross-component state (multiple surfaces mounted, one rollup) is exactly what Pinia stores exist for in this codebase; a composable alone can't share state across sibling instances without one being created |
| Save-status rendering | Component (`SaveStatusIndicator.vue`, new) | — | Pure presentation reading one store entry; no logic beyond formatting |
| Failure toast | Component (`ToastHost.vue`, new) + Pinia store (`src/stores/toasts.ts`, new) | AppShell (mount point) | Global, cross-route UI element; needs to survive whichever route/surface raised it, matching how `AppShell.vue` already hosts the sidebar and backdrop |
| `ServiceEditorView`'s inline autosave (~150 lines) | Frontend view → migrates to composable | — | R040 explicitly de-duplicates this into the shared composable; stays a view-level concern (owns `localService`/`originalService`/`isDirty`) but delegates the debounce/status machinery |

## Standard Stack

### Core

No new runtime dependencies. This phase is entirely built on what's already installed and already
governs the four autosaving surfaces:

| Library | Version (verified via `npm view`) | Purpose | Why Standard |
|---------|------|---------|--------------|
| `vue` | 3.5.29 (project pin `^3.5.29`) | `<script setup>`, `watch`, `ref`, `computed` | Already the whole app's framework |
| `pinia` | 3.0.4 (project pin `^3.0.4`) | `useSaveStatus`, `useToasts` stores | Already the app's only cross-component state pattern (nine existing stores) |
| `firebase` (firestore) | already installed, `services.ts` uses `onSnapshot`/`updateDoc`/`serverTimestamp` | The R039 fix's `includeMetadataChanges` option and `metadata.hasPendingWrites` read | Already the app's only persistence layer; no alternative sync mechanism exists or should be introduced |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.0.18 | `vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()` for the repro test and the `useAutoSave.test.ts` updates | Already the app's test runner |
| `@vue/test-utils` | 2.4.6 | `shallowMount`, `flushPromises`, `enableAutoUnmount` — the exact toolkit `ServiceEditorView.test.ts` already uses | Already the app's component-test toolkit |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `ToastHost.vue` | `vue-toastification` or similar | REQUIREMENTS.md's own Out of Scope table already rejects this: "unmaintained since 2022"; one failure toast + a status chip doesn't justify a dependency |
| `includeMetadataChanges` + `hasPendingWrites` fix | Client-side "remember the write I just made" sentinel comparison (compare `serverTimestamp()`'s *eventual* value against a locally-stashed expected value) | The sentinel approach requires threading a promise/callback through `updateService` back into the view to learn the resolved timestamp — more surface area, more places to get wrong, and duplicates state Firestore's SDK already tracks natively via `metadata.hasPendingWrites`. Prefer the SDK-native signal. |

**Installation:** none — no `npm install` needed for this phase.

## Package Legitimacy Audit

**Not applicable — this phase introduces zero new packages.** Every dependency used (`vue`, `pinia`,
`firebase`, `vitest`, `@vue/test-utils`) is already installed, already imported by the exact files this
phase touches, and REQUIREMENTS.md's Out of Scope table explicitly rejects adding a toast library. No
`gsd-tools query package-legitimacy check` run was needed because there is no package name to check.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Firestore doc write (onSave / D-15 reorder-save)
        │
        ▼
serviceStore.updateService()  ── appends updatedAt: serverTimestamp() unconditionally
        │
        ▼
Firestore onSnapshot() listener (subscribe(), src/stores/services.ts)
        │  ★ FIX POINT: pass { includeMetadataChanges: true }, read
        │    snap.docs[i].metadata.hasPendingWrites to recognize "this
        │    snapshot is settling MY OWN write" vs "a different writer"
        ▼
serviceStore.services (Pinia ref array) — reactive
        │
        ▼
ServiceEditorView.vue: watch(() => serviceStore.services, …, {deep:true})  [line 1982]
        │  today: compares JSON(local) vs JSON(remote-backfilled); differs
        │  on updatedAt ALONE → treated as remote change → resets
        │  autosaveInitialized = false [line 2030]
        │  ★ AFTER FIX: skip this branch entirely when the snapshot is our
        │    own pending/just-acked write (hasPendingWrites, or the doc's
        │    prior write was ours and nothing else changed)
        ▼
ServiceEditorView.vue: watch(localService, …, {deep:true})  [line 2110]
        │  if (!autosaveInitialized) { autosaveInitialized = true; return }
        │  ★ SWALLOW POINT: a discrete one-shot mutation (song pick, via
        │    onSelectSong → localService.slots[i] = updated) that lands here
        │  while autosaveInitialized is false is silently dropped — no
        │  'pending' status, no debounce armed, nothing in the console.
        ▼
(only reached if NOT swallowed) 800ms debounce → onSave() → back to top
```

### Root Cause: Confirmed (HIGH confidence — verified against live `src/` source, not reproduced live yet)

The hypothesis in STATE.md and R039 is accurate. Verified mechanism, with real line numbers from the
current `src/views/ServiceEditorView.vue`:

1. **`serviceStore.updateService` always stamps `updatedAt` server-side**, regardless of the caller's
   payload (`src/stores/services.ts:166-173`):
   ```typescript
   async function updateService(id: string, data: Record<string, unknown>) {
     if (!orgId.value) return
     assertWritable(id, data)
     await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
       ...data,
       updatedAt: serverTimestamp(),
     })
   }
   ```
2. **`onSave()` destructures `updatedAt` out of its write payload and never re-syncs it locally**
   (`ServiceEditorView.vue:3482, 3522-3523`):
   ```typescript
   const { id, createdAt, updatedAt, ...data } = localService.value
   // ... await serviceStore.updateService(id, { name: data.name, ..., slots: normalizedSlots })
   // Mark current local state as clean (don't overwrite localService — user may still be typing)
   originalService.value = JSON.parse(JSON.stringify(localService.value))
   ```
   `localService.value.updatedAt` (and therefore `originalService.value.updatedAt`) is never touched —
   it keeps whatever value it held from the last remote snapshot, which is now stale the instant this
   write's server-side `updatedAt` lands.
3. **The store's `subscribe()` receives BOTH the optimistic and the server-ack snapshot as ordinary data
   changes** (`src/stores/services.ts:74-90`), because it calls `onSnapshot(q, callback)` with no
   `includeMetadataChanges` option and `d.data()` with no `serverTimestamps` option. Per Firebase's own
   documented default, a pending `serverTimestamp()` resolves as `null` until the server acknowledges,
   then a second snapshot delivers the real `Timestamp` — two distinct, genuinely different `updatedAt`
   values arrive as two separate store updates for the SAME logical write.
4. **The remote-merge watcher's own "avoid spurious re-renders after our own save" guard
   (`ServiceEditorView.vue:2001-2037`) is defeated by exactly this field**:
   ```typescript
   const backfilled = backfillSlotIds(found, localService.value)
   const remoteJson = JSON.stringify(backfilled)
   const localJson = JSON.stringify(localService.value)
   if (remoteJson !== localJson) {
     localService.value = JSON.parse(remoteJson)
     originalService.value = JSON.parse(remoteJson)
     // Reset autosaveInitialized so the watcher's first local mutation
     // after a remote merge is NOT mistakenly treated as user-initiated.
     autosaveInitialized = false
   }
   ```
   Every field the write touched is already identical between `found` and `localService` (that's the
   whole point of a successful echo) — except `updatedAt`, which local never updated. That single-field
   mismatch is sufficient to make `remoteJson !== localJson`, so the branch runs and resets
   `autosaveInitialized = false`, even though nothing the user would recognize as "a remote change"
   actually happened.
5. **The very next `watch(localService, …)` trigger is swallowed** (`ServiceEditorView.vue:2133-2137`):
   ```typescript
   // Suppress the trigger that fires when service first loads from the store
   if (!autosaveInitialized) {
     autosaveInitialized = true
     return
   }
   ```
   If that trigger is a discrete one-shot mutation — `onSelectSong` (`ServiceEditorView.vue:2602-2614`)
   reassigns `localService.value.slots[index] = updated` directly, with no intervening store call — the
   guard consumes it silently: no `'pending'` status, no debounce timer armed, `mockUpdateService`
   equivalent never called. A **second** mutation (the next keystroke, in the typing case) finds
   `autosaveInitialized` already `true` and proceeds normally — this is exactly why continuous typing
   self-heals and a one-shot action does not.

**A second entry point exists into the identical failure**: the D-15 immediate reorder-save
(`ServiceEditorView.vue:1817-1863`, inside the Sortable `onEnd` handler) calls the SAME
`serviceStore.updateService`, producing the SAME echo, resetting the SAME `autosaveInitialized` flag. A
drag reorder immediately followed by a discrete one-shot pick reproduces the identical symptom through a
different trigger. Any fix that only touches `onSave()` (rather than the shared remote-merge watcher or
the store's echo detection) leaves this path unfixed.

**What does NOT need to change:** `useAutoSave.ts` itself has no Firestore knowledge and no
`updatedAt`/echo concept at all — it just watches a source and calls `saveFn()`. The bug is entirely in
(a) how `serviceStore.services` gets populated from `onSnapshot`, and (b) how
`ServiceEditorView.vue`'s bespoke remote-merge watcher decides "is this my own echo." Migrating
`ServiceEditorView` onto `useAutoSave` (R040) does **not** by itself fix R039 — the composable has no
opinion about Firestore echoes; it would inherit the exact same swallow if the store-layer fix isn't
applied first, because `autosaveInitialized`'s equivalent (`useAutoSave`'s own `initialized` flag,
`useAutoSave.ts:49,104-107`) has the identical "suppress first trigger" shape and would be reset by the
same remote-merge logic wherever that logic ends up living post-migration.

### Pattern 1: Firestore echo detection via `metadata.hasPendingWrites` (the recommended fix shape)

**What:** Configure the subscription to receive metadata-only changes, and use the per-document
`metadata.hasPendingWrites` flag to recognize a snapshot that is this client's own write settling, rather
than diffing field values.
**When to use:** Any Firestore subscription where the subscriber also writes to the same document and
must not treat its own echo as an external change. This applies to `services.ts`'s `subscribe()` today;
the same latent bug shape likely exists (unverified, out of this phase's scope) in any other store using
the same `onSnapshot(q, callback)` pattern without metadata awareness — flagged as an Open Question below.
**Example:**
```typescript
// Source: Firebase JS SDK docs (SnapshotListenOptions, DocumentSnapshot.metadata) — [CITED: firebase.google.com/docs/reference/js/firestore_.snapshotlistenoptions]
unsubscribeFn = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
  services.value = snap.docs.map((d) => {
    const data = d.data()
    // d.metadata.hasPendingWrites === true means THIS client wrote this
    // document and the server hasn't acknowledged yet; a subsequent
    // metadata-only emission with hasPendingWrites === false is the same
    // logical write settling, not a new external change.
    return { id: d.id, name: '', notes: '', ...data } as Service
  })
  isLoading.value = false
})
```
The exact wiring of "which snapshots the view's remote-merge watcher should skip" (expose
`hasPendingWrites` per-service via the store, vs. filter it out inside `subscribe()` entirely so
`services.value` never even updates for a self-echo) is the plan's decision — both are viable; the
research finding is that the SDK already carries the signal needed, so no home-rolled `updatedAt`
comparison should be the primary mechanism. **Caution:** `includeMetadataChanges: true` also delivers
metadata-only snapshots for OTHER clients' pending writes reaching this listener (via the "acknowledged
server-side, not yet visible to this listener's isolation level" edge — rare in single-writer-at-a-time
usage but real in the two-simultaneous-viewers case this same watcher already supports, per its own
comment "This is what makes two simultaneous viewers see each other's changes" at `ServiceEditorView.vue`).
Filter specifically on `hasPendingWrites` tied to *this* client's own write, not merely "any pending
metadata event."

### Pattern 2: `useSaveStatus` Pinia store shape

**What:** A client-only (no Firestore) Pinia setup store keyed by `surfaceId`, holding
`{ status: AutoSaveStatus, savedAt?: Date, errorText?: string }` per key, with a computed "most urgent"
rollup.
**When to use:** Whenever a surface's `useAutoSave` instance needs to report status somewhere shared
components (the header, or a future global indicator) can read without prop-drilling.
**Example:**
```typescript
// src/stores/saveStatus.ts — new file, first PURELY client-state store in this
// codebase (the other nine all wrap a Firestore subscription); still follows
// the same `defineStore(id, () => {...})` setup-store convention as the rest
// (modeled loosely on src/stores/roster.ts's shape, minus anything Firestore).
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { AutoSaveStatus } from '@/composables/useAutoSave'

export interface SaveStatusEntry {
  status: AutoSaveStatus
  savedAt?: Date
  errorText?: string
}

const URGENCY: Record<AutoSaveStatus, number> = {
  error: 4, saving: 3, pending: 2, saved: 1, idle: 0,
}

export const useSaveStatus = defineStore('saveStatus', () => {
  const entries = ref<Record<string, SaveStatusEntry>>({})

  function set(surfaceId: string, entry: SaveStatusEntry) {
    entries.value[surfaceId] = entry
  }
  function clear(surfaceId: string) {
    delete entries.value[surfaceId]
  }
  function entryFor(surfaceId: string): SaveStatusEntry {
    return entries.value[surfaceId] ?? { status: 'idle' }
  }
  const mostUrgent = computed<SaveStatusEntry | null>(() => {
    const all = Object.values(entries.value)
    if (all.length === 0) return null
    return all.reduce((a, b) => (URGENCY[b.status] > URGENCY[a.status] ? b : a))
  })

  return { entries, set, clear, entryFor, mostUrgent }
})
```
**Unmount lifecycle (E2/E4 `partial` backstops from 32-UI-SPEC.md):** call `clear(surfaceId)` from the
component's `onUnmounted`, alongside the existing `cleanupAutoSave()` call the three editors already make
(`CongregationalEditor.vue:253-254` pattern). Without this, a surface's last-known entry outlives its
component and a later mount under a DIFFERENT id (or the same id, on remount) briefly shows stale state
before its own watcher fires — exactly the backstop 32-UI-SPEC.md flags as needing a real test.

### Pattern 3: Safe migration sequence — `ServiceEditorView.vue` inline autosave → `useAutoSave`

Enumerated from reading the inline block end-to-end (`ServiceEditorView.vue:2052-2188` plus
`onSave`/`onUndo`/`onMarkAsPlanned`). Everything below is behavior `useAutoSave` does not currently have
and must gain, or a call site that must be rewired, before the inline ~150 lines can be deleted:

1. **Do the R039 store-layer fix FIRST, and confirm it via the repro test, before touching this
   migration at all.** (CONTEXT.md's own ordering — repeated here because it's the load-bearing
   sequencing constraint.)
2. **`useAutoSave` needs the `'error'` status and a `catch`** (already scoped in 32-UI-SPEC.md § 1) —
   land this on the composable first, confirm `useAutoSave.test.ts` still passes plus new error-path
   tests, independent of `ServiceEditorView`.
3. **Preserve the `autosaveErrorSource` reorder/edit discriminator.** `useAutoSave`'s `saveFn` is a
   single callback with no concept of "which kind of save this was" — `ServiceEditorView` has TWO save
   paths (`onSave()` via the debounce, and the D-15 immediate reorder-save which does NOT go through
   `useAutoSave`'s debounce at all today, and per the 32-CONTEXT.md scope should likely keep NOT going
   through it, since it's an intentionally-immediate, non-debounced write). The migration should wire
   `useAutoSave` for the debounced `onSave()` path only, and have the reorder path continue writing to
   the SAME `useSaveStatus` entry directly (bypassing `useAutoSave` for that one write, the way it
   already bypasses the inline debounce timer today) — preserving `autosaveErrorSource: 'reorder'` vs
   `'autosave'` by simply setting it explicitly at each of the two call sites, same as today.
4. **Preserve the pre-change snapshot for undo** (`ServiceEditorView.vue:2168`,
   `previousService.value = JSON.parse(JSON.stringify(originalService.value))`, taken immediately before
   the debounced save fires). `useAutoSave` has no hook that runs "just before `saveFn()` is invoked" —
   the closest available integration point is inside the `saveFn` callback passed to `useAutoSave` itself
   (snapshot `previousService` as the FIRST line of the wrapper function passed as `saveFn`, before
   calling the real `onSave()`). Confirm this preserves `onUndo`'s existing contract
   (`ServiceEditorView.vue:3531-3539`), which reads `previousService.value` and does not care how it was
   populated.
5. **Preserve interaction with `isDirty`.** `useAutoSave`'s third parameter is exactly
   `isDirty?: ComputedRef<boolean>` — `ServiceEditorView`'s existing `isDirty` computed
   (`ServiceEditorView.vue:1933-1936`) can be passed directly; no adaptation needed. Confirm the
   `canEditService` gate (today's early-return inside the deep watcher, `ServiceEditorView.vue:2125-2132`,
   which also actively CANCELS an armed timer when the lock engages) has an equivalent: `useAutoSave`
   has no lock concept at all. The safest approach is folding `canEditService.value` into the `isDirty`
   computed passed to `useAutoSave` (`isDirty.value && canEditService.value`), since `useAutoSave`
   already treats `isDirty === false` as "skip the save, drop to idle" (`useAutoSave.ts:70-74,
   109-110, 129-133`) — but this does NOT reproduce the existing behavior of actively clearing an
   already-armed timer the instant the lock engages (today's belt-and-braces fix for the
   `onMarkAsPlanned`-while-typing race, `ServiceEditorView.vue:2118-2124`). `useAutoSave` has no public
   API to force-cancel a pending debounce short of `cleanup()` (which also clears the fade timer, now
   dead code) — verify whether `cleanup()` alone is sufficient to replicate today's guarantee, or whether
   `flush()`/`cleanup()` needs to be called explicitly from a `watch(canEditService, …)` the view adds
   itself. This is a genuine gap the plan must design, not read off existing code — flag as its own task.
6. **Preserve interaction with the remote-merge watcher.** Once the R039 fix lands, the remote-merge
   watcher's `autosaveInitialized` reset needs an equivalent hook into `useAutoSave`'s internal
   `initialized` flag — but `useAutoSave` does not expose `initialized` today (it's a closure-local
   `let`). Two options: (a) `useAutoSave` gains an exported `reset()` that sets `initialized = false`
   (a real API addition, small and testable in isolation), or (b) the fixed remote-merge watcher no
   longer needs to force a reset at all, because with the R039 fix in place, a genuine self-echo no
   longer reaches the "treat as remote change" branch in the first place — making this concern
   potentially moot. **This is the crux of why R039 must be fixed and confirmed before this migration
   starts**: if the store-layer fix correctly filters self-echoes, the `autosaveInitialized`-reset
   problem this migration would otherwise have to solve mostly disappears, because remote merges become
   rare (only genuinely-external changes) rather than routine (every own-save).
7. **Preserve `onMarkAsPlanned`'s `flush` behavior.** `onMarkAsPlanned` (`ServiceEditorView.vue:2332-2368`)
   explicitly clears the armed inline timer then calls `await onSave()` directly (bypassing the debounce
   entirely) before transitioning status. `useAutoSave`'s `flush()` is built for exactly this — call
   `await flush()` instead of `await onSave()` directly, but only if `flush()`'s existing "only flush if
   `status === 'pending'`" guard (`useAutoSave.ts:126-127`) doesn't strand a genuinely-dirty-but-not-yet-
   `pending` edit (a case that per today's inline code can't currently happen because
   `ServiceEditorView.vue:2141` sets `'pending'` synchronously on every dirty mutation — confirm
   `useAutoSave`'s watcher, `useAutoSave.ts:100-117`, has the same synchronous guarantee; it does, per
   line 112).
8. **Never leave `autosaveStatus` stranded at `'saving'`** (BL-02, `ServiceEditorView.vue:2054-2092`'s
   own extensively-commented lesson). `useAutoSave`'s new `catch` (32-UI-SPEC.md § 1) must replicate the
   TWO-way branch `handleAutosaveFailure` implements today — `ServiceLockedError` reverts to
   `originalService` and returns to `'idle'`; anything else keeps the dirty edit and sets `'error'`. This
   is `saveFn`-specific business logic (knows about `ServiceLockedError`), so it belongs in the
   `saveFn` wrapper passed to `useAutoSave`, not inside the composable itself — the composable's own
   `catch` only needs to set `status.value = 'error'` generically; the reversion-on-lock behavior stays
   in `ServiceEditorView`'s own wrapper around `onSave()`.

### Pattern 4: How the three already-migrated editors call `useAutoSave` today

Confirmed via source read — this IS the mechanical template R040's ServiceEditorView migration should
converge toward, once Pattern 3's gaps are resolved:

```typescript
// CongregationalEditor.vue:220-231 and SongLyricEditor.vue:355-370 — same shape
async function doAutoSave() {
  if (!currentReadingId.value) return   // (or the SongLyricEditor-equivalent guard)
  await store.updateReading(props.orgId, currentReadingId.value, { /* fields */ })
}

const { status: autoSaveStatus, cleanup: cleanupAutoSave } = useAutoSave(
  sections,       // or () => editableState for SongLyricEditor
  doAutoSave,
  isDirty,        // SongLyricEditor only — Congregational/Scripture editors omit this param entirely
)
```
Both call `cleanupAutoSave()` inside their existing `onUnmounted` hook. **Rendering** today uses three
separate status spans with per-status `data-testid`s (`status-pending`/`status-saving`/`status-saved`) —
32-UI-SPEC.md § 5 already specifies these are retired in favor of `SaveStatusIndicator`'s single
`data-testid="save-status"` (`save-status-error` for the error branch); call out the retired ids as a
deliberate breaking rename in the plan, per the UI-SPEC's own explicit instruction.

**★ Correctness risk confirmed real for `CongregationalEditor.vue` / `ScriptureSlideEditor.vue` (E4
`partial` backstop, 32-UI-SPEC.md § UI Considerations):** `currentReadingId`
(`CongregationalEditor.vue:149`) starts as `ref<string | null>(props.readingId ?? null)` and is assigned
a real id ONLY inside `onFetchPassage()` (`CongregationalEditor.vue:163-198`), which sets
`sections.value` (line 175, triggering `useAutoSave`'s watcher) **before** `currentReadingId.value` is
populated (line 186, after an `await store.createReading(...)`). If `useSaveStatus`'s key is
`` `congregational:${currentReadingId.value}` `` and this is read reactively at render time, the
component can genuinely observe `surfaceId` transition from `congregational:null` to
`congregational:<realId>` WHILE a save triggered by the SAME `sections.value` mutation is in flight —
because the debounce that mutation arms won't fire for ~800ms, well after `currentReadingId` has already
resolved, but the STATUS reported into the store during the brief pre-resolution window would have been
recorded under the (now-stale) `congregational:null` key. Confirm at plan time whether `useSaveStatus`'s
key should instead be computed once (e.g., captured at the first non-null id) or whether the store write
should defer registering ANY entry until `surfaceId` is stable. This is unreachable in production TODAY
only because `CongregationalEditor.vue` and `ScriptureSlideEditor.vue` are currently unmounted (per
STATE.md, dead code pending Phase 34), but the shared component and store must still handle it correctly
since Phase 34 will mount them.

**Correctness risk NOT currently reachable for `SongLyricEditor.vue`:** `props.songId` is set from
`SongSlideOver.vue:279` (`:song-id="props.song!.id"`), and `SongSlideOver`'s own root content is
`v-if="open"` (`SongSlideOver.vue:13,29`) with a full-viewport click-blocking backdrop
(`SongSlideOver.vue:12-16`) — `SongsView.vue`'s row-click handler always sets `selectedSong` and
`slideOverOpen = true` together (`SongsView.vue:300-302, 359-361`), and the backdrop prevents clicking a
different table row while the panel is open. So `songId` cannot change without an intervening unmount
today. Still worth a defensive test (per 32-UI-SPEC.md E4 `partial`), since this is a UI-reachability
argument, not a structural guarantee the store enforces itself.

### Pattern 5: Toast host — edge-triggered, mirrored copy, minimal store

**What:** A `useToasts` Pinia store (array of `{id, message}`) plus a `ToastHost.vue` mounted once in
`AppShell.vue`, pushed to ONLY on the `!== 'error' → === 'error'` transition of any surface's status.
**When to use:** Exactly the R041 failure-toast requirement; fully specified in 32-UI-SPEC.md § 4 — no
open design questions remain there. The one thing this research adds: the edge-detection watch must be
driven from wherever `useSaveStatus`'s entries actually change (i.e., a `watch()` over
`saveStatusStore.entries`, or individual per-surface watches set up by whichever code calls `set()`) —
since `useSaveStatus` itself has no built-in "notify on transition" hook (it's a plain reactive map), the
edge-trigger logic belongs either in a watcher inside `useSaveStatus` itself (watching its own `entries`
ref, comparing previous vs. new per key) or in `ToastHost.vue`'s setup. Centralizing it inside
`useSaveStatus.set()` (compare `entries.value[surfaceId]?.status` before overwriting, before calling
`useToasts().push(...)` if the transition is `!== 'error' → === 'error'`) is simplest — it makes `set()`
itself responsible for edge-triggering, so no caller of `set()` needs to know about toasts at all.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting "is this Firestore snapshot my own write echoing back" | A field-by-field diff heuristic (what exists today, and what's broken) | `onSnapshot(q, { includeMetadataChanges: true }, ...)` + `metadata.hasPendingWrites` | The SDK already tracks exactly this; a hand-rolled diff will always be one field away from the next false-positive (today it was `updatedAt`; tomorrow it could be any other server-stamped field) |
| A generic notification/toast system | A queue with priorities, categories, positions, pause-on-hover | The single-purpose `ToastHost.vue` + `useToasts` array specified in 32-UI-SPEC.md § 4 | REQUIREMENTS.md explicitly rejects a toast library for this exact reason; this phase needs exactly one failure case |
| Cross-surface "most urgent" status logic | Ad hoc `v-if` chains comparing multiple refs in a template | The `mostUrgent` computed inside `useSaveStatus` (Pattern 2) | Keeps the urgency ordering (error > saving > pending > saved > idle) in one place instead of re-derived per consumer |

**Key insight:** the entire R039 defect exists because a previous implementation hand-rolled exactly the
kind of "is this my own write" detection Firestore's SDK already solves via `hasPendingWrites`. The
don't-hand-roll lesson for THIS phase is the fix itself, not just an aside.

## Common Pitfalls

### Pitfall 1: Fixing `onSave()`'s payload instead of the remote-merge watcher
**What goes wrong:** Re-including `updatedAt` in the write payload, or manually setting
`localService.value.updatedAt` after a successful save, patches the ONE call site (`onSave()`) but leaves
the D-15 reorder-save path (`ServiceEditorView.vue:1817-1863`) with the identical unpatched race, and
still leaves the store's `subscribe()` delivering the optimistic-then-ack double-echo as two separate
"remote changes."
**Why it happens:** `onSave()` is the most visible, most-recently-touched code (per STATE.md's own
framing of the hypothesis), making it the obvious place to look — but the actual defect is structural
(the watcher's echo-detection strategy), not local to one function.
**How to avoid:** Fix at the store subscription layer (Pattern 1) so BOTH write paths benefit
automatically, since both flow through the same `serviceStore.services` → remote-merge-watcher pipeline.
**Warning signs:** A fix that only touches `ServiceEditorView.vue:3467-3527` (onSave) without touching
`src/stores/services.ts` or the watcher at `ServiceEditorView.vue:1982-2037` has not addressed the
reorder path.

### Pitfall 2: Trusting `JSON.stringify` timestamp equality in tests
**What goes wrong:** The existing test fixture's `mockTimestamp = { toDate: () => new Date(...) }`
(`ServiceEditorView.test.ts:193`) has NO enumerable data fields — `JSON.stringify` drops the `toDate`
function entirely, so `JSON.stringify(mockTimestamp)` is always `{}` regardless of what date it
represents. A repro test that reassigns `mockServicesList[0]!.updatedAt` to a NEW object shaped this way
will not reproduce the bug, because the JSON-diff the real code performs will see no difference at all —
false negative.
**Why it happens:** The existing fixture was built for OTHER tests that don't care about `updatedAt`'s
actual value, only its presence.
**How to avoid:** The repro test needs an `updatedAt` fixture shaped like a real Firestore `Timestamp`'s
JSON-serializable form — enumerable `seconds`/`nanoseconds` fields (real Firestore `Timestamp` instances
expose these as public class fields, which DO survive `JSON.stringify`), e.g.
`{ seconds: 1, nanoseconds: 0 } as unknown as Timestamp`, then a DIFFERENT `{ seconds: 2, nanoseconds: 0 }`
for the simulated echo.
**Warning signs:** A repro test that mutates `updatedAt` but the assertion never flips (bug looks
"already fixed") — check the fixture's enumerable shape first before concluding the hypothesis is
disproven.

### Pitfall 3: Assuming the swallow only affects `onSelectSong`
**What goes wrong:** R039's phase description names "changing a song" as the example, which could lead a
plan to scope the repro test and the fix narrowly around `SongSlotPicker`/`onSelectSong` specifically.
**Why it happens:** It's the concrete example given, and it IS a clean, minimal repro case (a single
synchronous reassignment with no side effects of its own).
**How to avoid:** The swallow mechanism operates on ANY mutation reaching `watch(localService, …)` while
`autosaveInitialized` is false — clearing a song (`onClearSong`), editing sermon notes, toggling a
section, or any other single discrete field write is equally affected. The fix belongs at the watcher/
store layer (Pattern 1), which resolves ALL of these simultaneously; the repro test should use
`onSelectSong` as the concrete example (matching the phase description) but the plan's acceptance
criteria should not read as "songs specifically fixed."
**Warning signs:** A fix that special-cases `onSelectSong` (e.g., forcing it to call `flush()`
immediately rather than relying on the debounce) papers over the symptom for one call site without
touching the actual defect.

### Pitfall 4: Reordering `useAutoSave.test.ts` and `ServiceEditorView.test.ts` migration work before R039 is confirmed
**What goes wrong:** 32-CONTEXT.md is explicit that the migration destroys the evidence the repro test
stands on if done first — concretely, if `ServiceEditorView` moves onto `useAutoSave` before the repro
test is green against TODAY's inline code, a later "fix" might accidentally make the NEW composable-based
code pass the repro test for an unrelated reason (e.g., a timing change from the migration itself masks
the bug rather than the actual Firestore-echo fix addressing it), and the root cause is never actually
confirmed.
**Why it happens:** Both changes touch the same file and the same watchers, making it tempting to do them
in one pass.
**How to avoid:** Sequence exactly as CONTEXT.md states — repro test red, root-cause fix (Pattern 1, in
`services.ts`) green, THEN start the `useAutoSave` migration (Pattern 3) as a separate, later commit.
**Warning signs:** A single commit or plan wave that both changes `services.ts`'s subscription AND
deletes the inline autosave block.

### Pitfall 5: Deleting the `useAutoSave.test.ts` fade-timer test wholesale loses real coverage
**What goes wrong:** Two existing tests assert the 3-second fade R040 explicitly removes:
- `'transitions through idle -> pending -> saving -> saved -> idle'` (`useAutoSave.test.ts:65-100`) — only
  its FINAL three lines (97-99, `vi.advanceTimersByTime(3000); expect(status.value).toBe('idle')`) assert
  the fade; the rest of the test (the idle→pending→saving→saved transitions) is still valid coverage and
  should be KEPT, with only the tail changed to assert `status.value` stays `'saved'`.
- `'saved status fades to idle after 3 seconds'` (`useAutoSave.test.ts:271-293`) — this entire test's
  PURPOSE is the fade; it should be replaced (not merely deleted) with a test asserting `'saved'`
  persists indefinitely (e.g., advance a much longer window, like 60s, and assert still `'saved'`), so the
  "persistent, does not fade" behavior R040 requires has explicit regression coverage of its own.
**Why it happens:** Deleting is faster than rewriting, and both tests currently reference the exact
behavior being removed.
**How to avoid:** Treat "the fade is removed" as needing its OWN positive assertion (status stays
`'saved'`), not just the absence of the old assertion.
**Warning signs:** `useAutoSave.test.ts`'s total test count drops by 2 rather than staying flat with
updated assertions.

## Code Examples

### Repro Test — exact recipe for `ServiceEditorView.test.ts`

Built directly on the existing `mockServicesList` / `reactive()` / `mockUpdateService` conventions already
proven working in this file's `BL-02` describe block (`ServiceEditorView.test.ts:3221-3379`) and its
`R028 remote-merge stability` test (`ServiceEditorView.test.ts:1063-1111`). No new mocking infrastructure
is needed — this test slots into the EXISTING `@/stores/services`, `@/stores/importedSlides`, `sortablejs`
mocks already declared at the top of the file (lines 27-176), and reuses the file's established
`warmAutosaveWatcher` idiom for consuming the first-trigger guard deliberately, rather than accidentally.

```typescript
// Source: pattern verified against ServiceEditorView.test.ts's existing
// BL-02 describe block and its `mockServicesList = reactive([...])` idiom.
// NEW fixture needed — the existing mockTimestamp has no enumerable fields
// and cannot exercise the JSON-diff this bug depends on (see Pitfall 2).
function stampedService(seconds: number) {
  return {
    ...mockService,
    updatedAt: { seconds, nanoseconds: 0 } as unknown as Timestamp,
  }
}

describe('ServiceEditorView - R039: a save\'s own Firestore echo must not swallow the next discrete mutation', () => {
  async function mountView() { /* same shape as the BL-02 block's mountView() */ }

  it('picking a song immediately after a prior save\'s own echo lands still fires a save', async () => {
    const reactiveServices = reactive([stampedService(1)])
    mockServicesList = reactiveServices as unknown as Service[]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown = {
      localService: { slots: Array<{ songId: string | null }> }
      onSelectSong: (i: number, song: { id: string; title: string; key: string }) => void
    }

    // ── Absorb the FIRST watch(localService) trigger (the load event itself
    //    in this synchronous-mock harness) — same idiom the file already uses.
    vm.localService.slots[2]!.songId = null // slot-2 already has songId: null; a
    // genuinely inert touch isn't available, so use the file's own
    // warmAutosaveWatcher() pattern (a `notes` touch) instead if slot state
    // makes a truly no-op mutation impossible here.
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))

    // A REAL prior save landed (this is "a prior save", not the throwaway).
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    // ── Simulate that save's own echo: same content, NEW updatedAt (mirrors
    //    what serviceStore.updateService's serverTimestamp() would produce).
    reactiveServices[0] = stampedService(2)
    await wrapper.vm.$nextTick()
    await flushPromises()

    // ── THE REPRO: a discrete one-shot mutation, immediately after the echo,
    //    via the real onSelectSong path (not a raw property assignment) —
    //    matching the phase's own "picking a song" example exactly.
    vm.onSelectSong(0, { id: 'song-9', title: 'New Song', key: 'C' })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    // If the hypothesis holds, this call count is STILL 1 (the mutation was
    // swallowed) — the test should assert it becomes 2, i.e. FAIL against
    // today's code (red), and PASS once the store-layer fix lands (green).
    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    expect(vm.localService.slots[0]!.songId).toBe('song-9') // the local edit itself is never lost — only the SAVE is
  })
})
```

**What this needs from the mocking setup that isn't already there:** nothing structural — `Timestamp` is
already imported as a type (`ServiceEditorView.test.ts:8`); `reactive` is already imported
(`ServiceEditorView.test.ts:3`); `mockServicesList` reassignment to a `reactive([...])` array is an
established idiom. The only genuinely new piece is the `stampedService()` helper (enumerable timestamp
fixture, per Pitfall 2) — everything else is composition of patterns already proven in this file.

**Before writing the fix, run this test and confirm it is RED for the reason expected** (call count stuck
at 1, not some unrelated mount failure) — this is the "reproduced against the live app" step STATE.md
says has never happened. If it is unexpectedly GREEN, CONTEXT.md's disproof protocol applies: stop, do
not implement Pattern 1, and record the disproof.

### Toast edge-trigger inside `useSaveStatus.set()`

```typescript
// Source: this phase's own design, composing 32-UI-SPEC.md § 4's edge-trigger
// rule with the store shape in Pattern 2 above.
function set(surfaceId: string, entry: SaveStatusEntry) {
  const previous = entries.value[surfaceId]
  if (entry.status === 'error' && previous?.status !== 'error') {
    useToasts().push(entry.errorText ?? "Couldn't save your changes — they're still here. Try again.")
  }
  entries.value[surfaceId] = entry
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `includeMetadataChanges: true` + `metadata.hasPendingWrites` is the best-fit remediation, rather than a client-side "expected updatedAt" sentinel | Architecture Patterns → Pattern 1 | If the plan discovers `includeMetadataChanges` introduces unwanted extra re-renders elsewhere in `services.ts`'s consumers (e.g., other views/computeds that watch `serviceStore.services` and don't expect metadata-only churn), a sentinel-based approach may be safer despite more code — this needs validating against the OTHER consumers of `serviceStore.services`, which this research did not enumerate exhaustively (see Open Questions) |
| A2 | `useAutoSave`'s `initialized` flag needs an exported `reset()`, OR becomes unnecessary once R039 is fixed | Architecture Patterns → Pattern 3, item 6 | If R039's fix does not fully eliminate spurious remote-merge resets (e.g., a genuine two-editor collaboration scenario still needs to reset `autosaveInitialized`), the migration will need the `reset()` API after all — this is a real design decision, not just an implementation detail, and should be confirmed once Pattern 1's fix is live and the repro test is green, before finalizing Pattern 3's plan |
| A3 | Folding `canEditService` into `useAutoSave`'s `isDirty` param reproduces the existing "actively cancel an armed timer the instant the lock engages" guarantee closely enough | Architecture Patterns → Pattern 3, item 5 | If it doesn't, a debounced write armed a moment before a lock engages could still fire into the locked service post-migration — this is the exact defect class `ServiceEditorView.vue:2118-2124`'s comment describes fixing once already; a regression here reopens the same bug class R036/BL-02 already closed |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Does `useAutoSave`'s watcher (or `useSaveStatus`) need to distinguish "the store's own echo reset
   autosaveInitialized as an unavoidable side effect" from "a genuine external editor's change" AFTER the
   R039 store-layer fix lands?**
   - What we know: today, EVERY own-save triggers a reset (confirmed). The Pattern 1 fix should make
     genuine self-echoes stop reaching the "treat as remote" branch at all.
   - What's unclear: whether `hasPendingWrites`-based filtering is airtight for BOTH the optimistic AND
     the ack snapshot in every network condition (e.g., a slow connection where the ack for this write
     arrives interleaved with an unrelated external change from another editor).
   - Recommendation: the repro test (once green) plus the EXISTING `R028 remote-merge stability` test and
     the EXISTING `BL-02` "a later remote change still applies" test (`ServiceEditorView.test.ts:3269-3307`)
     together already form a decent regression net for this — confirm all three stay green after the fix,
     rather than trying to enumerate every network interleaving up front.

2. **Are there other Firestore-subscribing stores in this codebase with the same latent
   "own-echo-treated-as-remote" defect shape, beyond `services.ts`?**
   - What we know: `songs.ts`, `roster.ts`, `slideGroups.ts`, `scriptureSlides.ts` all likely use the same
     `onSnapshot(q, callback)` pattern (confirmed for `roster.ts`, not exhaustively checked for the
     others in this research pass).
   - What's unclear: whether any OTHER view has a comparable "reset a first-trigger-suppression guard on
     every remote snapshot" pattern that would exhibit the same symptom. `ServiceEditorView.vue` is the
     only file with a hand-rolled `autosaveInitialized`-style guard reset from a remote-merge watcher —
     the three already-`useAutoSave`-migrated editors don't have an equivalent remote-merge watcher at
     all (they only load once per mount via `onMounted`, not a live subscription watcher), so they are
     structurally NOT exposed to this bug class today.
   - Recommendation: out of this phase's explicit scope (R039 is Service Order specific) — flag for a
     future audit rather than expanding this phase's surface area.

3. **Should the reorder-save path (D-15, `ServiceEditorView.vue:1817-1863`) route its status reporting
   through `useSaveStatus` directly, or continue writing `autosaveStatus`-equivalent state some other
   way once the migration lands?**
   - What we know: it must NOT go through `useAutoSave`'s debounce (it's intentionally immediate).
   - What's unclear: the exact call shape for a "write status directly, bypassing the debounce" path once
     `useSaveStatus` is the single source of truth for the indicator.
   - Recommendation: the plan should design this explicitly as part of Pattern 3, item 3 above — it's a
     genuine open design point, not a research gap.

## Environment Availability

Skipped — this phase has no new external dependencies. Firebase, Vue, Pinia, Vitest, and
`@vue/test-utils` are already installed and already exercised by every file this phase touches; `npm run
test:rules` / the Firestore emulator are not needed (this phase's tests are unit/component tests against
mocked Firestore, per the existing `ServiceEditorView.test.ts` convention — no `firestore.rules` change is
in scope).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @vue/test-utils 2.4.6 |
| Config file | `vite.config.ts` (app suite, excludes `src/rules.test.ts`) |
| Quick run command | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/composables/__tests__/useAutoSave.test.ts` |
| Full suite command | `npx vitest run src/` — per CLAUDE.md, this excludes `src/rules.test.ts`; not needed for this phase since no `firestore.rules` change is in scope |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R039 | Repro: discrete mutation after a save's own echo is swallowed (red, then green after fix) | unit/component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "R039"` | ❌ Wave 0 (new describe block, see § Code Examples) |
| R039 | Reorder-save path shares the same fix (regression, not just the named example) | unit/component | same file, new `it()` in the R039 describe block | ❌ Wave 0 |
| R039 | Existing remote-merge tests stay green after the fix | unit/component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "remote-merge"` and `-t "BL-02"` | ✅ already exist (`ServiceEditorView.test.ts:1063`, `:3221`) |
| R040 | `useAutoSave` gains `'error'` status + no fade | unit | `npx vitest run src/composables/__tests__/useAutoSave.test.ts` | ✅ exists, needs the two updated tests (Pitfall 5) + new error-path test — Wave 0 for the new/updated assertions |
| R040 | `useSaveStatus` store: set/clear/mostUrgent, unmount clears entry | unit | new `src/stores/__tests__/saveStatus.test.ts` | ❌ Wave 0 |
| R040 | `SaveStatusIndicator.vue` renders per-state, `aria-live`/`aria-atomic` present | component | new `src/components/__tests__/SaveStatusIndicator.test.ts` | ❌ Wave 0 |
| R040 | ServiceEditorView migration preserves undo/isDirty/lock-cancel behavior (Pattern 3 items) | component | existing `ServiceEditorView.test.ts` describe blocks (BL-02, R028, R044/D-15 reorder) re-run post-migration | ✅ exist, re-verify post-migration |
| R041 | Toast fires on `error` edge only, not on every tick while error persists | unit | new `src/stores/__tests__/toasts.test.ts` or folded into `saveStatus.test.ts` | ❌ Wave 0 |
| R041 | `ToastHost.vue` renders `role="alert"`, dismiss button, 6000ms auto-dismiss | component | new `src/components/__tests__/ToastHost.test.ts` | ❌ Wave 0 |
| R041 | Toast mirrors inline error text exactly (both variants) | component | same file as above, or a cross-component assertion in the `ServiceEditorView.test.ts` error describe block | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed-test-file>`
- **Per wave merge:** `npx vitest run src/` (excludes `rules.test.ts` per CLAUDE.md — acceptable, no rules
  change in this phase) + `npm run type-check` (the `vue-tsc --build` form, per CLAUDE.md — NOT the
  `-p tsconfig.app.json` form, which silently skips test files)
- **Phase gate:** Full suite green (against the documented pre-existing baseline: 8 `.gsd/quarantine`
  duplicates no longer exist per the 2026-07-29 deletion — confirm current baseline count fresh at
  phase-gate time, since STATE.md's "10-file baseline" predates that deletion) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] The R039 repro test itself (`ServiceEditorView.test.ts`, new describe block) — the phase's
      mandated first commit
- [ ] `src/stores/__tests__/saveStatus.test.ts` — new store, no existing coverage
- [ ] `src/stores/__tests__/toasts.test.ts` — new store, no existing coverage
- [ ] `src/components/__tests__/SaveStatusIndicator.test.ts` — new component
- [ ] `src/components/__tests__/ToastHost.test.ts` — new component
- [ ] `useAutoSave.test.ts` updates (Pitfall 5) — modify, don't just delete, the two fade-timer tests

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled, per protocol. This
phase's actual security surface is minimal — no new auth, no new user-supplied text fields, no new
crypto — but the mapping below is included for completeness and to document why each category is largely
not-applicable here.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — this phase touches no auth flow |
| V3 Session Management | no | Unchanged |
| V4 Access Control | indirectly | The R039 fix must not weaken `assertWritable`/`ServiceLockedError` (`src/stores/services.ts:158-164`) — the echo-detection fix reads `metadata.hasPendingWrites`, it does not bypass or duplicate the existing draft-only write guard. Confirm the fix touches only the READ side of the subscription, never the write-guard logic. |
| V5 Input Validation | yes, minimally | All status/toast text is a fixed enum (32-UI-SPEC.md § Copywriting Contract confirms: "no user-supplied text ever reaches this component" for both the indicator and the toast) — no new free-text rendering surface, so no new XSS vector |
| V6 Cryptography | no | Unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A toast/status component rendering user-supplied text unsanitized (not applicable here, but worth stating why) | Tampering (stored XSS) | N/A this phase — both `SaveStatusIndicator.vue` and `ToastHost.vue` render only fixed enum strings and a formatted timestamp per 32-UI-SPEC.md; if a future phase adds free-text error messages to either component, Vue's default template interpolation (`{{ }}`) already escapes, so no `v-html` should ever be introduced here |
| A client-side write-guard (`assertWritable`) being weakened by an echo-detection change that accidentally short-circuits writes | Tampering / Elevation of Privilege | The R039 fix (Pattern 1) is scoped to the READ path (`subscribe()`'s `onSnapshot` callback) — it must not touch `updateService`, `assertWritable`, or `ServiceLockedError` at all. The plan should keep these as two clearly separate, independently-testable changes. |

## Sources

### Primary (HIGH confidence)
- `src/views/ServiceEditorView.vue` (live source, read directly) — lines 96-136, 1780-1863, 1900-2188,
  2600-2634, 3465-3539
- `src/stores/services.ts` (live source, read directly) — lines 1-220
- `src/composables/useAutoSave.ts` (live source, read directly) — full file
- `src/composables/__tests__/useAutoSave.test.ts` (live source, read directly) — full file
- `src/views/__tests__/ServiceEditorView.test.ts` (live source, read directly) — lines 1-330, 1000-1140,
  3255-3385
- `src/components/CongregationalEditor.vue`, `src/components/ScriptureSlideEditor.vue`,
  `src/components/SongLyricEditor.vue`, `src/components/SongSlideOver.vue`, `src/views/SongsView.vue`
  (live source, read directly) — `useAutoSave` call sites, `currentReadingId`/`songId` lifecycle
- `.planning/phases/32-.../32-CONTEXT.md`, `.planning/phases/32-.../32-UI-SPEC.md`,
  `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — provided phase context, read in full

### Secondary (MEDIUM confidence)
- [CITED: firebase.google.com/docs/reference/js/firestore_.snapshotlistenoptions] —
  `includeMetadataChanges` option semantics
- [CITED: firebase.google.com] — `DocumentSnapshot`/`SnapshotOptions.serverTimestamps` default (`null`
  until server ack) behavior, cross-checked via WebSearch against Firebase's own reference docs

### Tertiary (LOW confidence)
- None — every claim above was either verified against this project's live source or cross-checked
  against Firebase's own documentation. No claim in this document rests on training-data-only memory of
  package versions or API shapes without a corresponding source-read or doc citation.

## Metadata

**Confidence breakdown:**
- Root cause (R039 mechanism): HIGH — verified against live source line-by-line, cross-checked the
  Firestore SDK behavior claim against official docs; NOT yet reproduced against the live running app
  (that is the phase's own first task)
- Standard stack: HIGH — no new packages, every library version confirmed against `package.json`
- Architecture (useSaveStatus / SaveStatusIndicator / ToastHost shapes): HIGH — fully specified in
  32-UI-SPEC.md, this research adds only the store-internals and migration-sequencing detail UI-SPEC
  deliberately left open
- Migration sequencing (Pattern 3): MEDIUM — the preservation checklist is grounded in source, but two
  items (canEditService-cancel-timer equivalence, `autosaveInitialized`/`reset()` necessity) are flagged
  as open design decisions rather than settled facts, honestly reflected in the Assumptions Log
- Pitfalls: HIGH — each grounded in a specific, cited line range in this codebase, not generic advice

**Research date:** 2026-08-02
**Valid until:** 30 days (stable domain — no fast-moving external dependency; the codebase itself could
drift faster if other phases touch `ServiceEditorView.vue` or `services.ts` before this phase executes,
in which case re-verify line numbers before planning)
