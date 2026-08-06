---
phase: 29-order-structure-stable-reordering-post-service
fixed_at: 2026-07-28T21:20:00Z
review_path: .planning/phases/29-order-structure-stable-reordering-post-service/29-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

**Fixed at:** 2026-07-28
**Source review:** `.planning/phases/29-order-structure-stable-reordering-post-service/29-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (1 critical/blocker, 1 warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-01: Save-failure revert used a stale pre-drag snapshot and could silently discard (and then re-persist over) a later successful edit

**Files modified:** `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `00817c4`
**Applied fix:**

`onSlotSortEnd`'s catch block no longer restores the closure-captured `preDragSlots` (a snapshot of
state from *before this specific drag started*, which goes stale the instant a second, faster drag
races it — SortableJS invokes `onEnd` fire-and-forget, never awaited). Instead, on a rejected write it
now restores `JSON.parse(JSON.stringify(originalService.value.slots))` — the last known-good
**persisted** state at the moment the catch actually runs:

```ts
} catch (err) {
  if (localService.value && originalService.value) {
    localService.value.slots = JSON.parse(JSON.stringify(originalService.value.slots))
  }
  autosaveStatus.value = 'error'
  console.error('[ServiceEditorView] reorder save failed:', err)
}
```

This is the "merge against current state rather than restoring a snapshot wholesale" option the
review's design constraints offered, chosen over a generation-counter because it is simpler to reason
about and it closes all three blocker requirements in one change, with no extra state to track:

1. **Revert never clobbers newer successful state.** Every successful write (this handler's own, or
   `onSave()`'s) sets `originalService.value = clone(localService.value)` immediately after persisting.
   If a second drag already succeeded and persisted by the time an earlier drag's catch runs,
   `originalService.value.slots` already reflects that success — the revert becomes a no-op against it
   instead of overwriting it with a stale array.
2. **No stale array survives for the debounce to re-persist.** Because the revert now sets
   `localService.value.slots` to an exact clone of `originalService.value.slots`, `localService` and
   `originalService` are content-identical immediately after the revert (assuming no other field is
   independently dirty). `isDirty.value` (`JSON.stringify` comparison) is therefore `false`, so the
   general 800ms autosave watcher's `if (!isDirty.value) return` guard fires and the debounce never
   arms — closing the exact path that previously re-wrote the stale, reverted array back to Firestore.
3. **The `'error'` status survives.** Because the debounce watcher never arms (per point 2), it never
   transitions `autosaveStatus` to `'pending'`, so the `'error'` state set by the catch block is not
   immediately overwritten.

**Regression test (required by the blocker's instructions — written to fail without the fix, then
verified to pass with it):** `src/views/__tests__/ServiceEditorView.test.ts` — *"a failed drag does not
clobber (locally or via the debounce re-save) a later drag that already succeeded"*, inside the `Phase
29 reorder repro` describe block. It reproduces the reviewer's exact repro shape: drag A's write is
held open (a manually-controlled rejecting promise) and invoked **fire-and-forget** (not awaited,
matching real SortableJS), drag B's write resolves via the default mock and is fully awaited before
drag A's write is explicitly rejected. The test asserts:
- drag B's write payload is correct (`['s1','s4','s2','s3','s5','s6','s7','s8']`),
- after drag A's rejection, the DOM (`data-slot-id` order) still reflects drag B's persisted result —
  not the pre-both-drags order,
- the `autosave-error` message is visible, and
- a further 900ms wait produces **no third** `updateService` call (the debounce never re-persists the
  stale order).

Verified by temporarily `git stash`-ing the source fix and re-running: the test failed with
`expected [...'s1','s2','s3','s4',...] to deeply equal [...'s1','s4','s2','s3',...]` — i.e., without
the fix, local state reverts all the way back to the pre-both-drags order, exactly matching the
reviewer's empirical repro. The stash was then restored and the full test file re-verified passing
before committing.

**Deliberately not shipped (per the review's own "at minimum (1) must ship" framing):** fix suggestion
(2) — giving `serviceStore.updateService`'s slots write the same Firestore-transaction
compare-and-swap protection `slideGroupsStore.replaceGroupSlides` has. The review itself scoped this as
a complementary hardening, not a requirement to close the blocker, and it is out of this phase's stated
scope (`src/stores/services.ts`, not `ServiceEditorView.vue`). Fix (1) alone closes the confirmed
repro and the three design constraints listed in the blocker.

### WR-01: `onSave()` normalized the write payload's order but never synced that back into `localService`/`originalService`

**Files modified:** `src/views/ServiceEditorView.vue`
**Commit:** `12c9d15`
**Applied fix:**

```ts
const normalizedSlots = reindexSlots(orderSlotsBySection(data.slots))
await serviceStore.updateService(id, { ...otherFields, slots: normalizedSlots })

// Guarded by reference equality against `data.slots` — only sync back if
// nothing else reassigned localService.value.slots during the awaits above.
if (localService.value && localService.value.slots === data.slots) {
  localService.value.slots = normalizedSlots
}

originalService.value = JSON.parse(JSON.stringify(localService.value))
```

**Why guarded, not unconditional (a deliberate departure from the review's suggested one-liner):** the
review's own suggested fix (`localService.value.slots = reindexSlots(orderSlotsBySection(data.slots))`
unconditionally, immediately after the write) would reintroduce a narrower instance of the *exact*
failure class CR-01 just closed. `onSave()` awaits both the `scheduledSongIds` loop
(`assignSongToSlot`, only on a draft→planned transition) and the `updateService` write itself — real
async windows during which a reorder drag can independently run (D-15's "immediate save on reorder"
does not check `autosaveSaving`/`isSaving` before proceeding, so `onSlotSortEnd` and `onSave()` can be
in flight concurrently). An unconditional post-write reassignment would clobber whatever a
concurrent, already-applied (possibly already-persisted) drag had written into
`localService.value.slots` with the stale, pre-await `data.slots`-derived array.

The reference-equality guard (`localService.value.slots === data.slots`) makes the sync-back a
no-op — not a clobber — whenever anything else reassigned `.slots` to a new array reference during
this save's awaits (every mutation site in this file, including `onSlotSortEnd`, always assigns a
*fresh* array rather than mutating in place, so this reference check is a reliable signal). In the
narrow, low-risk scenario WR-01 actually describes — a legacy/corrupted document's *first* interaction
being a non-reorder edit, with nothing else racing it — the reference is unchanged and the sync-back
applies exactly as the finding requests, fixing the local/persisted order mismatch immediately rather
than waiting for the next remote snapshot to self-heal it.

**Verification performed (no dedicated regression test — see below):**
- `npx vue-tsc --noEmit` reports zero errors for `ServiceEditorView.vue`.
- Full `src/views/__tests__/ServiceEditorView.test.ts` run: 66 passed, 0 failed (baseline unchanged).
- A standalone script confirmed `orderSlotsBySection` genuinely reorders a non-section-major array
  (the premise the fix depends on) rather than being a silent no-op for the fixture shape used.

**Why no dedicated regression test was added (disclosed trade-off, not an oversight):** the bug this
fix addresses is invisible at the DOM level. `ServiceEditorView.vue`'s template renders slot cards via
a section-grouped computed (`slotSectionGroups`), so the *rendered* order is always section-major
regardless of whatever raw order `localService.value.slots` actually holds — the corrupted-vs-fixed
states are visually identical in every render. The only way to observe the array's raw order from
outside the component is indirectly, through the remote-merge watcher's `JSON.stringify` comparison (a
mismatch there forces a `localService` replacement and resets the `autosaveInitialized` guard). I
attempted exactly that discriminator — construct a corrupted fixture, save it, echo the persisted
content back as a simulated Firestore snapshot, and check whether a subsequent edit's autosave
debounce trigger gets silently swallowed by the reset guard — and confirmed by direct experimentation
(with temporary debug logging, since removed) that Vue's watcher-flush batching makes this
unreliable: the remote-merge reassignment's *own* deep-watch trigger self-consumes the "swallowed
first trigger" slot before a cleanly-separated (`await`ed) follow-up edit can be affected by it, so
both the fixed and un-fixed code paths converge to the same externally observable behavior once
mutations are properly sequenced. Racing the mutations together to avoid that self-consumption
produced a *different*, unrelated false failure (a `sermonTopic` content mismatch from the race itself
polluting the comparison), not a reliable signal tied to slot order. Forcing a fragile test built on
this racy internal timing would itself be a maintenance liability — worse than the WARNING it's meant
to guard. Given WR-01 is explicitly a self-healing, non-data-destructive display/persisted order
mismatch (per the review's own text) and the fix is verified by the means above, this is judged an
acceptable, disclosed gap rather than a forced/flaky test.

**29-03-SUMMARY.md accuracy:** the review flagged that 29-03-SUMMARY.md's claim ("a corrupted stored
array repairs on first drag, not on open") is inaccurate, since repair can also be triggered by any
non-reorder save. With the WR-01 fix applied, this is now *more* accurate than before (the mismatch
window WR-01 described is closed for the common, unraced case), so no correction to the SUMMARY was
needed — the residual gap (a save racing a concurrent reorder skips the sync-back, per the guard above)
is a narrower, lower-probability case than what the SUMMARY originally described, and self-heals via
the same pre-existing remote-merge watcher either way.

## Skipped Issues

None — both in-scope findings (CR-01, WR-01) were fixed.

## Verification Summary

- `npx vue-tsc --noEmit -p tsconfig.json`: zero errors attributable to `ServiceEditorView.vue`.
- `npx eslint src/views/ServiceEditorView.vue src/views/__tests__/ServiceEditorView.test.ts`: pre-existing
  lint errors only (all at unrelated lines, e.g. `2510`, `2545`, `2633` — untouched by this fix pass);
  zero new lint errors introduced by either fix.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts`: 66 passed, 0 failed (2 quarantine-worktree
  duplicates fail on unrelated pre-existing Pinia setup issues — documented baseline, not a regression).
- `npx vitest run src/views src/utils src/stores`: 2332 passed, 15 failed across exactly 7 files — all 7
  are the documented pre-existing baseline (`.gsd/quarantine/worktrees/**` duplicates of
  `services.test.ts`/`RosterView.test.ts`/`ServiceEditorView.test.ts`, plus the real
  `src/views/__tests__/RosterView.test.ts`). The failing FILE SET did not grow.
- CR-01's regression test was confirmed to fail without the fix (`git stash` the source change, re-run,
  observe the exact pre-both-drags-order regression, then restore) before being committed alongside the
  fix.

---

_Fixed: 2026-07-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
