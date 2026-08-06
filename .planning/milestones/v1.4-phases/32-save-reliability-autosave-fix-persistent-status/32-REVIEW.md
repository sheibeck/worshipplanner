---
phase: 32-save-reliability-autosave-fix-persistent-status
reviewed: 2026-08-02T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/stores/services.ts
  - src/stores/saveStatus.ts
  - src/stores/toasts.ts
  - src/composables/useAutoSave.ts
  - src/components/SaveStatusIndicator.vue
  - src/components/ToastHost.vue
  - src/components/AppShell.vue
  - src/views/ServiceEditorView.vue
  - src/components/CongregationalEditor.vue
  - src/components/ScriptureSlideEditor.vue
  - src/components/SongLyricEditor.vue
  - src/stores/__tests__/services.test.ts
  - src/stores/__tests__/saveStatus.test.ts
  - src/stores/__tests__/toasts.test.ts
  - src/composables/__tests__/useAutoSave.test.ts
  - src/components/__tests__/SaveStatusIndicator.test.ts
  - src/components/__tests__/ToastHost.test.ts
  - src/components/__tests__/CongregationalEditor.test.ts
  - src/components/__tests__/ScriptureSlideEditor.test.ts
  - src/components/__tests__/SongLyricEditor.test.ts
  - src/components/__tests__/SongLyricsTab.r035.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: findings
---

# Phase 32: Code Review Report

**Reviewed:** 2026-08-02
**Depth:** standard
**Files Reviewed:** 22
**Status:** findings

## Summary

Phase 32's own goal is "make the save status trustworthy" — R039 (fix the swallowed-save bug),
R040 (persistent, accurate status), R041 (a failure toast). The R039 fix in `services.ts`
(`includeMetadataChanges` + `ownWriteEchoIds`) is sound: I traced the pending/settle-edge logic
by hand for single- and multi-document interleavings and it correctly discriminates an own-write
echo from a genuinely external change in every case I could construct, and I confirmed (by grep)
that no other consumer of `serviceStore.services` takes an identity-keyed side effect the fix
could have doubled. The new `useSaveStatus`/`useToasts` stores and the `SaveStatusIndicator`/
`ToastHost` components are clean, small, and match 32-UI-SPEC.md's markup and contract closely —
timers are store-owned (not component-owned) so unmounting a raising surface cannot orphan one,
and the three editors' "capture-once surfaceId" pattern is genuinely tested against the id-swap
race it targets.

The real problem is upstream of all of that: `useAutoSave.ts`'s own status transition, on the
success path, does not check whether the status it is about to overwrite is still the one it
started with. Combined with how `ServiceEditorView.vue`'s `onSave()` marks the document "clean,"
this reintroduces — through a different mechanism — exactly the class of bug R039 fixed (a save
silently discarding a legitimate, distinct edit that happened during a nearby save's flight), and
it does so **specifically because R040 made `'saved'` persistent**: before this phase, the false
`'saved'` a user could momentarily see self-corrected within 3 seconds; now it is
indistinguishable from a real save until the user makes another edit, or closes the tab and never
finds out. Three Critical findings below trace this precisely, with a fourth angle (the lock
transition silently erasing an outstanding `'error'`) that compounds it. None of the four
Critical/high findings are covered by the phase's own (otherwise careful) test suite.

## Structural Findings (fallow)

None provided for this review — no `<structural_findings>` block was supplied.

## Narrative Findings (AI reviewer)

### CR-01: A newer edit's "saved" status can be a lie, and for ServiceEditorView the underlying edit is permanently lost

**File:** `src/composables/useAutoSave.ts:82-91` (debounced path) and `:133-142` (`flush()`); compounded by `src/views/ServiceEditorView.vue:3396-3437` (`onSave()`)

**Issue:** In both save call sites, the code that runs after `await saveFn()` unconditionally
writes `status.value = 'saved'` (or `'error'` in the `catch`), with no check that `status.value`
is still `'saving'`:

```ts
saving = true
status.value = 'saving'
try {
  await saveFn()
  status.value = 'saved'      // ← clobbers whatever the mutation watcher set in the meantime
} catch {
  status.value = 'error'
} finally {
  saving = false
}
```

If a *second*, distinct mutation happens while the *first* save's `saveFn()` is still awaiting
(a normal thing to happen — the debounce is 800ms, but a slow write or a flaky connection can
easily outlast a user's next keystroke), the mutation watcher runs and sets
`status.value = 'pending'`, arming its own follow-up debounce timer. When the first save then
resolves, the line above stomps that `'pending'` back to `'saved'` — for up to a full debounce
interval, the UI shows `Saved h:mm` while a distinct, un-persisted edit is silently waiting. This
is directly reproducible from the existing test file itself:
`useAutoSave.test.ts`'s own `'a mutation dispatched while a save is in flight is not lost'` test
(lines 175-217) sets `status.value` to `'pending'` at line 202-203, then calls `resolveFirst()` at
line 210 — the test simply never asserts `status.value` in the ~1 line gap between that resolution
and the rescheduled timer firing, which is exactly the window where the lie is visible.

For the generic composable alone this is "only" a cosmetic, self-correcting lie (the rescheduled
timer still eventually calls `saveFn()` with the latest value, confirmed by the same test's
`observedValues[1] === 3` assertion) — **unless the debounce timer's own eventual re-check treats
the edit as already clean, in which case the correcting save never happens and the edit is
permanently lost.** That is exactly what `ServiceEditorView.vue` does. Trace with concrete times:

1. `t=0`: edit A → `status='pending'`, timer armed for `t=800`.
2. `t=800`: timer fires → `saving=true`, `status='saving'` → `saveFn()` → `onSave()` destructures
   `data` from `localService.value` **synchronously, at this instant** (`:3396`) and starts
   `await serviceStore.updateService(id, {...data-as-of-t=800...})`.
3. `t=850`: edit B happens (a *different* field) → `localService.value` mutates → the deep watch
   fires → `status.value='pending'` (overwriting `'saving'`) → a fresh timer T2 arms for `t=1650`.
4. `t=1100`: the `updateService` call from step 2 resolves. `onSave()` then runs
   `originalService.value = JSON.parse(JSON.stringify(localService.value))` (`:3437`) — but
   `localService.value` **at this instant already contains edit B** (mutated directly and
   synchronously at `t=850`, independent of the in-flight write). Edit B was never part of the
   payload sent in step 2, yet `originalService` — the "what's already persisted" baseline — is
   now stamped as if it were. `useAutoSave`'s own `status.value = 'saved'` line then overwrites
   the `'pending'` set in step 3.
5. `t=1650`: T2 fires. Its very first check, `if (isDirty && !isDirty.value) { status.value =
   'idle'; return }`, now reads `isDirty.value === false` (`localService` and `originalService`
   are byte-identical, both including B, thanks to step 4) — so **the scheduled save that would
   have persisted B never runs.** Status flips to `'idle'`. Edit B is never written to Firestore;
   nothing is ever shown to the user; the "Save" button is disabled (`isDirty` gates it) as if
   there were nothing left to save.

Notably, the code a few lines above the bug (`:3423-3432`) already shows the author was aware of
exactly this class of race — it guards the `slots` sync-back with a reference-equality check
against a concurrent reorder — but that same care was not extended to the
`originalService.value = clone(localService.value)` line that follows immediately after, which is
the actual root cause here.

**Fix:**
1. In `useAutoSave.ts`, don't clobber a status a newer mutation has already advanced past:
```ts
try {
  await saveFn()
  if (status.value !== 'pending') status.value = 'saved'
} catch {
  if (status.value !== 'pending') status.value = 'error'
} finally {
  saving = false
}
```
(mirror this in `flush()` too). This alone fixes the *cosmetic* lie and lets the already-armed
follow-up timer see `'pending'` and behave correctly.
2. In `ServiceEditorView.vue`'s `onSave()`, only mark the document clean against what was actually
   sent, not against whatever `localService` holds by the time the write resolves — e.g. snapshot
   before the write and compare, the same way `:3423-3432` already does for `slots` alone, but for
   the whole document:
```ts
const beforeWriteSnapshot = JSON.stringify(localService.value)
// ...await serviceStore.updateService(...)...
if (localService.value && JSON.stringify(localService.value) === beforeWriteSnapshot) {
  originalService.value = JSON.parse(JSON.stringify(localService.value))
}
```
   Without fix 2, fix 1 alone still leaves the permanent-loss path in ServiceEditorView open,
   because it is `isDirty`/`originalService`, not `useAutoSave`'s internal `status`, that T2's
   early-return actually keys off.

---

### CR-02: `useAutoSave.flush()` can cancel a pending edit's only timer and then no-op, dropping the edit

**File:** `src/composables/useAutoSave.ts:118-143`; reachable via `src/views/ServiceEditorView.vue:2260-2281` (`onMarkAsPlanned`)

**Issue:** `flush()` unconditionally clears the debounce timer as its very first action, before it
knows whether it is actually going to perform a save:

```ts
async function flush(): Promise<void> {
  clearDebounceTimer()
  if (status.value !== 'pending') return
  if (isDirty && !isDirty.value) { status.value = 'idle'; return }
  if (saving) return          // ← comment above says "wait for inflight save" — it does not wait, it just gives up
  ...
}
```

If `flush()` is called while a *previous* save is already in flight (`saving === true`) **and** a
newer mutation has, in the meantime, set `status.value` back to `'pending'` and armed its own
timer (the same sequence as CR-01 steps 1-3), then `flush()`: (a) destroys that just-armed timer
via `clearDebounceTimer()` — the only thing that would ever have retried the edit — and then
(b) hits `if (saving) return` and exits without performing any save at all. The edit is now
unreachable by any mechanism: no timer is armed, and `flush()` already returned.

`ServiceEditorView.vue`'s `onMarkAsPlanned` calls exactly this: `await autoSave.flush()`, then
immediately proceeds to `serviceStore.markAsPlanned(...)` and `applyTransitionLocally('planned')`,
locking the service. A user who edits a second field while an earlier autosave write is still in
flight, then immediately clicks "Mark as Planned," loses that second edit with no error, no toast,
and (once locked) no way to re-enter edit mode without an explicit Reopen.

This is **not** the same window the existing regression test
(`ServiceEditorView.test.ts`'s `'typing during Mark as Planned does not leave a debounced write to
land on the locked service'`, lines 3637-3674) covers — that test edits *after* `flush()` has
already run as a no-op (nothing was pending at click time), during `markAsPlanned`'s own await,
and relies on the separate cancel-on-lock watcher to clean up the newly-armed timer. It does not
exercise `flush()` being called while a *previous* save is mid-flight.

**Fix:** `flush()` needs to distinguish "nothing to do" from "something is in flight that this
call must not silently discard." At minimum, don't destroy an armed timer until `flush()` has
confirmed it is not about to be dropped:
```ts
async function flush(): Promise<void> {
  if (saving) return          // do NOT clear the timer here — let it fire on its own schedule
  clearDebounceTimer()
  if (status.value !== 'pending') return
  if (isDirty && !isDirty.value) { status.value = 'idle'; return }
  saving = true
  status.value = 'saving'
  try { await saveFn(); if (status.value !== 'pending') status.value = 'saved' }
  catch { if (status.value !== 'pending') status.value = 'error' }
  finally { saving = false }
}
```
A caller like `onMarkAsPlanned` that truly needs "definitely nothing pending before I proceed"
still needs a way to wait out an in-flight save — that requires exposing the in-flight promise
(or an `await`-able "settled" signal) from the composable, which this shape does not yet provide;
flag that as a follow-up if callers rely on `flush()` for that guarantee.

---

### CR-03: An unresolved, still-dirty autosave `'error'` is silently erased — not surfaced anywhere — the instant a service locks

**File:** `src/views/ServiceEditorView.vue:1980-1996` (the status-reporting/cancel-on-lock watcher) and `:2260-2281` (`onMarkAsPlanned`)

**Issue:** The "Mark as Planned" button is gated only on `isTransitioning` (`:148`) — it is never
disabled or blocked by an outstanding autosave `'error'`. If a transport failure has already left
an edit un-persisted (the `handleAutosaveFailure` "kept dirty" branch — `:2107-2114` — is
deliberately designed to *keep* the edit rather than revert it, precisely so the user can retry),
the user can still click "Mark as Planned" with that failure on screen. `onMarkAsPlanned` doesn't
check for it; `autoSave.flush()` no-ops when `status.value === 'error'` (not `'pending'`), so the
failed edit is never retried before the lock lands.

Once the service locks, `canEditService` flips to `false`, which triggers the reporting watcher's
early branch:
```ts
if (!editable) {
  autoSave.cleanup()
  saveStatus.set(surfaceId.value, { status: 'idle' })   // ← overwrites 'error' with no trace
  return
}
```
This unconditionally reports `'idle'`, discarding the `'error'` entry — and simultaneously, the
sticky status bar (`v-if="canEditService"`, `:236`) and the `lifecycleError` span
(`v-if="canEditService && lifecycleError"`, `:160`) both disappear from the template, because both
are gated on the same now-false `canEditService`. The net effect: a real, unsaved edit that failed
to save is now on a locked, read-only service, with **zero on-screen indication that anything was
ever wrong** — the exact "it didn't save, and nobody could tell" failure class this whole
milestone exists to close.

**Fix:** Either (a) block `onMarkAsPlanned` (and Export) from proceeding while
`autoSave.status.value === 'error'`, surfacing a message telling the user to resolve the save
failure first, or (b) if a lock transition is allowed to proceed anyway, don't let the
cancel-on-lock branch discard an `'error'` silently — route it into `lifecycleError` (which is not
gated behind `canEditService` in the *locked* banner path per 31-UI-SPEC § 1) so the failure
remains visible after the lock engages, instead of vanishing along with the bar that used to show
it.

---

## Warnings

### WR-01: `SaveStatusEntry.errorText` has no fallback where it's rendered, unlike the toast

**File:** `src/components/SaveStatusIndicator.vue:11-15`; `src/stores/saveStatus.ts:6-10, 41-55`

**Issue:** `SaveStatusEntry.errorText` is optional (`errorText?: string`), and the toast path
falls back to `GENERIC_ERROR_TEXT` when it's missing (`saveStatus.ts:52`), but
`SaveStatusIndicator.vue`'s error span renders `entry.errorText` directly with no such fallback.
If any future caller does `saveStatus.set(id, { status: 'error' })` without `errorText` (nothing
in the type system stops this), the toast would show the correct generic sentence while the
inline `aria-live` region renders blank text — silently breaking 32-UI-SPEC's "toast body always
mirrors the inline text, word for word" contract (§ 4). No current call site does this (all four
surfaces always pass `errorText` explicitly), so this is latent, not live.

**Fix:** Apply the same `?? GENERIC_ERROR_TEXT` fallback inside `entryFor()` (or in the
component), or make the type honest by discriminating on `status`:
`{ status: 'error'; errorText: string } | { status: Exclude<AutoSaveStatus, 'error'> }`.

---

### WR-02: No regression test locks in the multi-document own-write-echo interleaving the review was asked to verify

**File:** `src/stores/services.ts:96-118`; `src/stores/__tests__/services.test.ts:244-300`

**Issue:** I traced `ownWriteEchoIds`'s pending/settle-edge computation by hand for two documents
whose own-writes overlap and settle on different snapshots, and for a snapshot that mixes one
document's settle edge with a second, genuinely-external document's change — the logic is correct
in both cases (each document's echo status is derived independently from `nowPending`/
`pendingWriteIds` membership, never cross-contaminated). However, every test in the `subscribe /
onSnapshot` describe block (`services.test.ts:244-300`) exercises exactly one document
(`'service-1'`). There is no test proving the multi-document case, which is precisely what this
phase's own review focus flagged as needing verification. A future refactor of the pending/settled
computation could silently reintroduce cross-document leakage with nothing to catch it.

**Fix:** Add a test with two service ids where one settles while the other is still pending (or a
snapshot where one settles and an unrelated one changes externally in the same batch), asserting
`ownWriteEchoIds` reflects only the correct subset each time.

---

### WR-03: `useSaveStatus.mostUrgent` is fully built and tested but has no production consumer

**File:** `src/stores/saveStatus.ts:67-83`

**Issue:** `mostUrgent` is a nontrivial derived computed (deterministic tie-break, urgency
ranking) with its own dedicated test coverage (`saveStatus.test.ts`), but grepping `src/` for
`mostUrgent` outside of `saveStatus.ts` and its own test file returns nothing — no component in
any of this phase's four surfaces (or elsewhere) reads it. It's dead code as shipped: real,
tested, but unreferenced.

**Fix:** Either wire it into a consumer (e.g., a future cross-surface indicator) or remove it
until one exists, per the codebase's own "don't build more than is needed" convention already
cited elsewhere in this phase's own commentary (32-UI-SPEC § 4's toast-stacking note).

---

### WR-04: The two readings editors' `surfaceId` is pinned to whichever `readingId` the component happens to mount with, with no reactive path to update it if the prop changes post-mount

**File:** `src/components/CongregationalEditor.vue:125-161`; `src/components/ScriptureSlideEditor.vue:94-125`

**Issue:** `currentReadingId` is seeded once from `props.readingId` at declaration
(`ref(props.readingId ?? null)`) and is otherwise only reassigned internally, inside
`onFetchPassage`. There is no `watch(() => props.readingId, ...)`. Combined with this phase's
(correct, well-tested) "capture surfaceId once" design, if a future caller ever reuses one of
these component instances across different `readingId` values without remounting (e.g., a parent
that swaps the prop in place instead of using a `:key` to force remount), the surface id would
stay permanently pinned to the *first* reading the instance ever saw — silently misattributing
every later save's status to the wrong record. This is currently inert because, per 32-06's own
notes, both components are unmounted dead weight pending Phase 34 — but it means the "capture
once" correctness property this phase just hardened (E4 `partial`) implicitly depends on an
external contract (remount-on-record-change) that isn't enforced anywhere in these two files
themselves.

**Fix:** Not a Phase 32 blocker given the components are currently unreachable, but worth a note
for whoever wires these into Phase 34: either add the missing `watch(() => props.readingId, ...)`
that resets `currentReadingId`/`surfaceId` on a genuine prop change, or document/enforce (e.g. via
a lint rule or a comment at the call site) that the parent must always mount these with a `:key`
tied to the reading id.

---

## Info

### IN-01: `SongLyricEditor.vue`'s load-time "repair" write bypasses `useAutoSave` and swallows its own failure

**File:** `src/components/SongLyricEditor.vue:397-436`

**Issue:** The `currentLyrics` watcher's repair branch (`if (isDirty.value) { await doAutoSave()
}`, lines 431-433) calls `doAutoSave()` directly, outside of `useAutoSave`'s try/catch. If this
write rejects, the async `watch` callback's rejection is not caught anywhere — Vue logs a runtime
warning, but `useSaveStatus` never learns about it (the composable's own `status` ref is
untouched by this out-of-band call), so no error/toast ever surfaces for a failed repair write.
This predates Phase 32 (the surrounding repair logic is Phase 28/WR-01 machinery this phase didn't
touch) but it is still live in a file this phase modified, and it's the same "error path must not
lie" class the rest of the phase was built to close.

**Fix:** Wrap the repair call in the same try/catch shape `handleAutosaveFailure`/`useAutoSave`
use elsewhere, or route it through `useAutoSave().flush()`-equivalent machinery so a failure is at
least visible.

### IN-02: `serviceStore.assignSongToSlot` remains dead production code, unchanged by this phase

**File:** `src/stores/services.ts:264-289`

**Issue:** `assignSongToSlot` is only referenced from tests and from a comment in
`ServiceEditorView.vue`; no production call site invokes it (confirmed by grep across `src/`).
This was already flagged in a prior phase's review (per the repository's own recent commit
history) and isn't newly introduced by Phase 32 — noting it here only because `services.ts` is
squarely in this phase's file set and a reviewer scanning it fresh would otherwise re-flag it as
new. No action needed from this phase; restating for completeness/non-duplication.

---

_Reviewed: 2026-08-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
