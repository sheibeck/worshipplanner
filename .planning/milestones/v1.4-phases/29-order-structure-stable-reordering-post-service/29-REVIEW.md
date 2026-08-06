---
phase: 29-order-structure-stable-reordering-post-service
reviewed: 2026-07-28T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/views/ServiceEditorView.vue
  - src/components/slides/SlideGrid.vue
  - src/utils/slotTypes.ts
  - src/types/service.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/components/slides/__tests__/SlideGrid.test.ts
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** deep (cross-file tracing, plus empirical reproduction of the one BLOCKER via a throwaway, fully-reverted test harness)
**Files Reviewed:** 5 source + 2 test files touched by commits `42b5586`, `91c4502`, `2ab736e`, `0030c2c`, `8883822`, `23d36aa`, `a05a338`
**Status:** issues_found

## Summary

This phase's headline claims hold up well under adversarial review. I verified, by reading (not
trusting the SUMMARY files) and in several cases by direct grep/empirical test:

- Zero live `insertBefore` (D-16 revert genuinely removed from both files), zero occurrences of the
  false "index arithmetic" comment, and `onEnd`/`onSlotSortEnd` in both `ServiceEditorView.vue` and
  `SlideGrid.vue` read only `oldDraggableIndex`/`newDraggableIndex` — never the un-prefixed pair.
- `reindexSlots(orderSlotsBySection(...))` is genuinely composed at every documented mutation site in
  `ServiceEditorView.vue` (`addSlot`, `performRemoveSlot`, `onSectionChange`, the reorder handler) and
  section assignment is never silently rewritten for a legacy/out-of-union `slot.section` value
  (`groupBySection`/`flattenBySection` in `slotTypes.ts` are total and permutation-preserving, verified
  by reading).
- `ServicePrintLayout.vue` and `planningCenterExport.ts` genuinely iterate `service.slots` in raw array
  order with zero section awareness (confirmed no source diff exists for either file in this phase),
  so Post-Service placement is correctly inherited "for free" as claimed.
- The multi-instance Sortable lifecycle in `ServiceEditorView.vue` is well-designed: because the
  per-section container's `:key` is the stable `group.key` (never bumped), the container DOM node is
  never discarded on a save-failure revert, so — unlike `SlideGrid.vue`, which correctly needs and has
  a `destroySortable()` before its `gridRenderNonce` `:key` bump — `ServiceEditorView.vue` has no
  equivalent stranding risk to guard against. This is a real design difference, not an oversight.
- `SongLyricEditor.vue`, Phase 32's save-status component/toast, and Phase 35's copyright/CCLI
  placement are all untouched — confirmed via `git diff --name-only` and targeted grep.

One BLOCKER was found and empirically confirmed (not just reasoned about) in the one piece of genuinely
new-to-this-codebase logic the phase added: the save-failure revert path in
`ServiceEditorView.vue#onSlotSortEnd`. I built a throwaway test (using this file's own existing
`captureForSection`/fire-and-forget `onEnd` invocation pattern, matching how real SortableJS actually
calls the handler) to reproduce two overlapping drags, ran it, confirmed the failure mode with console
tracing, and then fully reverted both the source and test files (`git status` / `git diff --stat` show
zero residual changes) before writing this report.

## Critical Issues

### CR-01: Save-failure revert uses a stale pre-drag snapshot and can silently discard (and then re-persist over) a later successful edit

**File:** `src/views/ServiceEditorView.vue:1558-1593` (revert path), interacting with the general
autosave debounce watcher at `src/views/ServiceEditorView.vue:1768-1818`

**Issue:** `onSlotSortEnd` captures `preDragSlots = localService.value.slots` (a reference to whatever
was in place immediately before *this* drag's own optimistic mutation) and, on a rejected write,
unconditionally restores it:

```ts
const preDragSlots = localService.value.slots
const reindexed = reindexSlots(flattenBySection(grouped))
localService.value.slots = reindexed
...
} catch (err) {
  if (localService.value) {
    localService.value.slots = preDragSlots   // <-- stale snapshot, not a merge
  }
  autosaveStatus.value = 'error'
  ...
}
```

There is no compare-and-swap / merge against the *current* `localService.value.slots` at the moment
the catch runs. If **any** other slot-array mutation happens after this drag's optimistic mutation but
before its write settles — most plausibly a second, faster drag that succeeds first (also very
plausible: an `onSectionChange`, `addSlot`, or `performRemoveSlot` in between) — the revert throws that
later, already-persisted change away from local state, reverting all the way back to the state before
*this* drag even started.

Worse, this doesn't just display a stale order — it gets **re-persisted**. After the revert,
`localService.value.slots` (now stale) differs from `originalService.value.slots` (which reflects the
later, successful write), so `isDirty` becomes `true` again. The general 800ms debounce watcher
(`watch(localService, ..., { deep: true })`) legitimately sees this as a new unsaved change, arms its
own timer, and — once it fires — calls `onSave()`, which writes the **stale, reverted array back to
Firestore**, silently overwriting the user's already-successful second edit. The `'error'` status set
by the catch block is itself overwritten by the watcher's `'pending'` transition almost immediately, so
the user never even sees a persistent error message — the reorder just silently reverts, with no
retry prompt, no error banner, and (once the orphaned timer fires) the server-side data is
overwritten too.

**Empirical confirmation:** built and ran a throwaway test reproducing this exact sequence — Drag 1
(worship `s2→pos2`, write takes 300ms and rejects) fired fire-and-forget (matching real SortableJS,
which never awaits `onEnd`'s return value), followed 50ms later by Drag 2 (worship reorder, fast
default-resolving write). Console tracing showed:

1. Drag 2's write succeeds and is confirmed persisted (`mockUpdateService` call #2 payload:
   `[s1,s4,s3,s2,s5,s6,s7,s8]`).
2. Drag 1's write then rejects; the catch reverts `localService.value.slots` to `preDragSlots`
   (`[s1,s2,s3,s4,...]` — the state from *before either drag*), discarding Drag 2's result from local
   state.
3. The general debounce watcher fires (`isDirty` is now `true` because `originalService` reflects
   Drag 2's committed state while `localService` was just reverted past it), arms an 800ms timer.
4. At 800ms, that timer's callback fires with `isDirty === true`, calls `onSave()`, and issues a
   **third** `updateService` call whose payload is `[s1,s2,s3,s4,s5,s6,s7,s8]` — the pre-either-drag
   order — silently overwriting Firestore's actual (correct, Drag-2-committed) state.
5. `wrapper.find('[data-testid="autosave-error"]').exists()` is `false` at the end — the error message
   never persists long enough for the user to see or act on it.

(Test and source files were both fully reverted after this verification; `git status`/`git diff`
confirm zero residual changes from this investigation.)

This directly undermines the requirement this phase exists to satisfy (R044: a reorder must land
exactly where dropped, and a save failure must never be silent) — under a plausible real-world
condition (two rapid corrections, or a drag racing an unrelated edit, combined with one transient
network failure), the *opposite* of R044 happens: a successful edit is silently discarded and
overwritten, with no visible error. This is also a regression relative to the pattern already
established in this same phase's sibling file — `SlideGrid.vue`'s `replaceGroupSlides` (via
`slideGroupsStore`) uses a Firestore transaction with an explicit `baseSlides` compare-and-merge
(the "CR-02" pattern documented in `src/stores/slideGroups.ts:308-321`), and its own revert
(`gridRenderNonce` bump) re-renders from live `props` rather than restoring a captured snapshot, so it
cannot exhibit this exact failure mode. `ServiceEditorView.vue`'s `serviceStore.updateService` has no
equivalent protection.

**Fix:** Two independent, complementary fixes close this:

1. Don't blindly restore `preDragSlots` — restore *this drag's own mutation* by diffing/merging
   against the *current* `localService.value.slots` at catch-time (e.g., only undo the specific splice
   this handler performed, or re-derive from `originalService.value.slots`, which reflects the last
   known-good persisted state, rather than a closure-captured pre-drag array that can go stale):
   ```ts
   } catch (err) {
     if (localService.value && originalService.value) {
       // Restore to the last known-good PERSISTED state, not a stale pre-drag closure snapshot —
       // this is correct even if another mutation succeeded and persisted in the meantime.
       localService.value.slots = JSON.parse(JSON.stringify(originalService.value.slots))
     }
     autosaveStatus.value = 'error'
     ...
   }
   ```
2. Give `serviceStore.updateService`'s slots write the same compare-and-swap protection
   `slideGroupsStore.replaceGroupSlides` already has (a Firestore transaction comparing a `baseSlots`
   snapshot against the live document before writing), so an orphaned/stale write can never silently
   clobber a later successful one server-side either.

At minimum, (1) must ship before this phase can be considered to have actually closed the "silent
failure" defect class R044 was written to eliminate.

## Warnings

### WR-01: `onSave()` normalizes the write payload's order but never syncs that normalization back into `localService`/`originalService`

**File:** `src/views/ServiceEditorView.vue:2851-2863`

**Issue:**

```ts
const { id, createdAt, updatedAt, ...data } = localService.value
...
await serviceStore.updateService(id, {
  ...
  slots: reindexSlots(orderSlotsBySection(data.slots)),
})
originalService.value = JSON.parse(JSON.stringify(localService.value))
```

`orderSlotsBySection` is only applied to the value written to Firestore (`data.slots`, destructured
from `localService.value`) — it is never assigned back onto `localService.value.slots` itself. In the
normal case this is a no-op (every mutation site already keeps the array section-major, so
`orderSlotsBySection` returns the identical reference per its own identity-preserving optimization).
But for a legacy/corrupted document whose `slots` array is not yet section-major — the documented,
deliberately-accepted "repairs on first drag" case — if the user's *first* interaction with the editor
is a **non-reorder** edit (e.g. typing in `notes`, which is the vastly more common first interaction
than a drag), the debounced `onSave()` path silently reorders what is **persisted** to Firestore
without updating what is **displayed**. `originalService` is then set from the *un-reordered*
`localService.value`, not from the *reordered* payload actually written — so immediately after this
save, local state and remote state agree in content but disagree in **order**. This self-heals on the
next Firestore snapshot (the remote-merge watcher at line 1707 will detect the `JSON.stringify`
mismatch and pull in the corrected order), so it is not data-destructive, but it means the documented
"corrupted array repairs on first drag" behavior (29-03-SUMMARY.md) is inaccurate — repair can also be
silently triggered by *any* save, not only a drag, and produces a brief, avoidable local/remote order
mismatch in the meantime.

**Fix:** Assign the normalized order back onto `localService.value.slots` before computing
`originalService`, so local state and the just-persisted state are identical in both content and
order:

```ts
localService.value.slots = reindexSlots(orderSlotsBySection(data.slots))
await serviceStore.updateService(id, { ...otherFields, slots: localService.value.slots })
originalService.value = JSON.parse(JSON.stringify(localService.value))
```

---

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
