---
phase: 26-edit-slide-drawer-risk-medium
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/components/slides/EditSlideDrawer.vue
  - src/components/slides/ReconcileConfirmModal.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/slideDisplay.ts
  - src/composables/useSlideshowAssembly.ts
  - src/stores/slideGroups.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/songEditLink.ts
  - src/types/slideGroup.ts
  - src/components/SongSlideOver.vue
  - src/views/SongsView.vue
  - src/views/ServiceEditorView.vue
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
  - src/components/slides/__tests__/ReconcileConfirmModal.test.ts
  - src/components/slides/__tests__/SlidesTab.test.ts
  - src/components/slides/__tests__/slideDisplay.test.ts
  - src/stores/__tests__/slideGroups.test.ts
findings:
  critical: 3
  warning: 2
  info: 1
  total: 6
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Edit Slide drawer, the reconciliation-confirm dialog, and the CAS
(compare-and-swap) write machinery both depend on. The per-write "read the
base fresh, never one captured when the drawer opened" discipline itself is
correctly followed everywhere I traced it — every drawer write
(label/notes/body debounce, loop, both audio-scope routes, duplicate, delete)
reads `props.group.slides` synchronously at the moment the write function
actually runs, and the `SlideGrid.vue`/`useSlideshowAssembly.ts` call sites do
the same. Per-kind gating on `sourceRef.kind` (not `contentKind`) is correct
throughout, the scrimless drawer carries no leftover backdrop/click-outside
assumptions from `SongSlideOver.vue`, and the 26-09 Task 1 duplicate-lyric
reconciliation fix (`storedBySectionId` as an array, not a collapsing map)
genuinely preserves every stored entry per section.

However, tracing what actually happens to the CAS **merge algorithm** itself
(`mergeConcurrentlyAddedEntries`) once its inputs are wired together surfaced
three BLOCKER-level correctness gaps, two of which are reachable by a single
user in a single tab through entirely ordinary interaction — not just a
multi-tab race:

1. Flushing two independently-debounced fields on the same entry in parallel
   can silently discard one of the two edits (CR-01).
2. The merge only ever recovers a concurrently-*added* entry; it never
   accounts for a concurrent *deletion*, so a slower stale-base write can
   resurrect a just-deleted slide (CR-02) — this is a live gap now that
   26-09 ships the first delete-capable write path.
3. The reconciliation composable's local pending-map is never pruned after
   Apply or Dismiss, so the passive banner/"Review" affordance can persist
   indefinitely and re-triggering it can silently overwrite the group with
   stale content (CR-03).

The test suite's gaps line up exactly with these three findings (see each
finding's "Fix" section) — every existing debounce/CAS test edits exactly one
field or exercises exactly one write path, never two concurrent writes to the
same entry, and every "already dismissed" test pre-seeds `dismissedSignature`
before the composable ever mounts rather than dismissing live within one
lifecycle.

## Critical Issues

### CR-01: Parallel `flushAll()` lets one debounced field-write clobber another on the same entry

**File:** `src/components/slides/EditSlideDrawer.vue:811-813` (`flushAll`), interacting with `writeField` at `src/components/slides/EditSlideDrawer.vue:757-787`

**Issue:**
`flushAll()` flushes the three independently-debounced fields (`label`,
`notes`, `body`) via `Promise.all([flushField('label'), flushField('notes'), flushField('body')])`.
If a user edits **two** of these fields (e.g. types a new Slide Label, then
also types Notes) and then switches to a different slide — or closes the
drawer — before either field's own 800ms debounce has fired naturally, both
pending writes are flushed **concurrently**.

Each `writeField(field, entryId, value)` call reads `const base = props.group.slides`
synchronously, before its own `await slideGroupsStore.replaceGroupSlides(...)`.
Because both `flushField` calls are started back-to-back inside the same
`Promise.all` array construction, with no reactivity tick between them, both
`writeField` invocations capture the **exact same** `base` array — neither
has seen the other's pending change yet. Each computes its own `next` by
copying the *other* field's value straight from that shared stale `base`
(e.g. the `notes` write's payload carries the entry's **old** label, because
that's what `base` still says).

Both calls proceed independently into `replaceGroupSlides`'s
`runTransaction`. `mergeConcurrentlyAddedEntries` (`src/stores/slideGroups.ts:311-322`)
only recovers an entry that is **entirely missing** from both `base` and the
caller's own `next` (i.e. concurrent *additions*). For this same-id entry,
which is present in `base`, `live`, and `next` for **both** concurrent
writes, the merge function does nothing — it just returns `next` verbatim.
Whichever transaction commits **second** overwrites the field the **first**
transaction just wrote, because its own `next` was computed from the
pre-write snapshot. The result: one of the two edits (label or notes/body)
is silently discarded, with no error, no console log, and a "Saved" status
shown for both.

This is reachable by a single user in a single tab through ordinary use — no
second tab or network race required. It is exactly the class of bug flagged
by this phase's own review focus ("a debounce is a natural place for a base
to go stale"), except the two racing writers here are the *same* component's
own two debounce timers.

**Fix:** Flush sequentially, not in parallel, so each write observes the
previous one's committed base — or better, coalesce all pending fields into
a **single** `replaceGroupSlides` call that applies every dirty field at
once:
```ts
async function flushAll(): Promise<void> {
  // Sequential, not Promise.all — each flush must see the previous one's
  // committed result before computing its own base.
  await flushField('label')
  await flushField('notes')
  await flushField('body')
}
```
Add a test that edits both Label and Notes (or Notes and Body) on the same
entry, switches to a different slide (triggering `flushAll`), and asserts
**both** edits are present in the final written entry.

### CR-02: The CAS merge never accounts for a concurrent deletion — a slower write can resurrect a just-deleted slide

**File:** `src/stores/slideGroups.ts:311-322` (`mergeConcurrentlyAddedEntries`), reachable via `src/components/slides/EditSlideDrawer.vue:1025-1039` (`onConfirmDelete`) racing any other write on the same group

**Issue:**
`mergeConcurrentlyAddedEntries` is one-directional: it appends entries that
are live but missing from both `base` and `next` (concurrent *additions*).
It never removes an entry that existed in `base` but has since disappeared
from `live` (a concurrent *deletion*). Since `next` is always derived by
mapping over `base` (every drawer write does `base.map(...)` / `base.filter(...)`),
a stale-`base` write's `next` still contains the deleted entry, and the
merge step does not strip it back out.

Concretely: a debounced label/notes/body write is scheduled (800ms). Within
that window, the same entry is deleted via `onConfirmDelete` (its own
transaction, correctly using a fresh base, commits first). When the pending
field-write's timer fires, `writeField` reads `base = props.group.slides` —
if the realtime listener update for the delete hasn't yet round-tripped back
to this client (plausible under ordinary network latency, no multi-tab
needed), `base` still contains the just-deleted entry. `next = base.map(...)`
therefore still contains it too (with the field edited). The transaction's
live-doc read now excludes the entry (post-delete), but
`mergeConcurrentlyAddedEntries(base, live, next)` computes `concurrentlyAdded`
as empty (nothing in `live` is absent from `baseIds`), so it returns `next`
unchanged — **including the entry that was just deleted**. The commit
resurrects the slide the user explicitly deleted, with no indication to
either party that this happened.

This is a new live gap in Phase 26: the store's own doc comment
(`src/stores/slideGroups.ts:264-266`) says "does not attempt to reconcile
concurrent DELETIONS (no delete-a-slide path exists yet — Phase 26)" — but
Phase 26 is exactly the phase that ships the first delete path
(`EditSlideDrawer.vue`'s Delete Slide action), so this caveat is no longer
merely theoretical.

**Fix:** Extend the merge to also drop entries present in `next` but absent
from `live` **when they were unchanged relative to `base`** (i.e. this
caller didn't intentionally keep them — they were dropped elsewhere):
```ts
function mergeConcurrentlyAddedEntries(base, live, next) {
  const liveIds = new Set(live.map((e) => e.id))
  // An entry present in `base` but missing from `live` was deleted by a
  // concurrent writer — never resurrect it just because this caller's
  // stale `next` (derived from `base`) still carries it.
  const withoutConcurrentlyDeleted = next.filter((e) => !base.some((b) => b.id === e.id) || liveIds.has(e.id))
  // ...then append concurrently-added entries as before, against the filtered list.
}
```
Add a regression test mirroring the existing "concurrently-added entry
survives" tests in `src/stores/__tests__/slideGroups.test.ts`, but for a
concurrently-*deleted* entry: `live` lacks an id that `base`/`next` both
carry, and assert the final payload does **not** resurrect it.

### CR-03: The reconciliation pending-map is never pruned after Apply or Dismiss — the banner can persist and re-triggering it can overwrite newer content

**File:** `src/composables/useSlideshowAssembly.ts:431` (`pendingReconciliationsMap` declaration) and `:452-507` (`applyReconciliationOutcomes`)

**Issue:**
`pendingReconciliationsMap` is a `reactive(new Map())` that is only ever
written to via `.set()` at `useSlideshowAssembly.ts:473`, guarded by
`if (!pendingReconciliationsMap.has(outcome.slotId))`. There is **no**
`.delete()` call anywhere in this file (confirmed by exhaustive search).

Both resolution paths leave the stale entry in place:
- **Dismiss**: `SlideGrid.vue`'s `onDismissReconciliation` writes
  `dismissedSignature` to Firestore. On the next reactive tick, the
  `dismissedSignature !== undefined && freshSignature === dismissedSignature`
  guard (`useSlideshowAssembly.ts:464-469`) correctly suppresses the outcome
  from being processed further — but it does so via a bare `continue`,
  **never removing the already-set map entry from a previous tick**. The
  stale `PendingReconciliation` (with its now-outdated `proposed` and
  `freshSignature`) remains in `pendingReconciliationsMap` forever.
- **Apply**: `SlideGrid.vue`'s `onApplyReconciliation` writes the new
  `slides`/`sourceSignature` directly via the store (bypassing this
  composable's watcher entirely). Once the new signature round-trips back,
  `reconcileGroup` computes `needsConfirm: false, changed: false` (already in
  sync) — this outcome now falls through **both** branches in
  `applyReconciliationOutcomes` without ever touching the map. The stale
  entry survives Apply too.

Consequence: `SlideGrid.vue`'s passive banner ("N slides may need review
before this group updates") and its "Review" button
(`src/components/slides/SlideGrid.vue:63-78`) — both driven by
`pendingReconciliations` — continue to render **after the user has already
resolved the divergence**, indefinitely, until the page is reloaded (a fresh
composable mount correctly re-derives suppression from `dismissedSignature`,
which is exactly why this is invisible in the "starts already dismissed"
tests — see Fix below). Worse: if the user, confused by the still-showing
banner, clicks "Review" → "Apply source changes" again, `onApplyReconciliation`
(`SlideGrid.vue:303-319`) replays the **stale** `pending.proposed` list
against the group — silently reverting any edits made since the first
Apply/Dismiss, because the write itself uses a correctly-fresh `baseSlides`
CAS check but the *content* being written (`pending.proposed`) is stale.

**Fix:** Prune the map entry whenever an outcome for that slot is no longer
`needsConfirm` (both on suppression-by-dismissal and on successful apply):
```ts
if (outcome.result.needsConfirm) {
  if (outcome.group.dismissedSignature !== undefined && outcome.freshSignature === outcome.group.dismissedSignature) {
    pendingReconciliationsMap.delete(outcome.slotId)   // <-- add
    continue
  }
  if (!pendingReconciliationsMap.has(outcome.slotId)) { /* ... */ }
  continue
}
if (!outcome.result.changed) {
  pendingReconciliationsMap.delete(outcome.slotId)      // <-- add
  continue
}
```
Add a test in `useSlideshowAssembly.test.ts` that (a) starts with **no**
`dismissedSignature`, mounts the composable, confirms `pendingReconciliations`
has length 1, then (b) simulates the store round-trip after a Dismiss
(update the mock group's `dismissedSignature` to match `freshSignature` on
the SAME mounted instance) and asserts `pendingReconciliations` drops back to
length 0 — the current suite only ever tests the dismissed case by
pre-seeding `dismissedSignature` before the composable's first mount, which
cannot catch this.

## Warnings

### WR-01: `SongsView.vue` fires two independent, un-awaited `router.replace` calls in `onMounted` that can race

**File:** `src/views/SongsView.vue:333-344`

**Issue:** `onMounted` first calls `router.replace({ query: { ...route.query, import: undefined } })` (not awaited) when `?import=true` is present, then unconditionally calls `resolveSongEditRequest()`, which — if the requested song is already loaded — synchronously calls `clearSongEditQueryParam()` → a second `router.replace({ query: clearSongEditRequest(route.query) })`. Since `route.query` does not update until the first `replace`'s navigation resolves (a microtask/promise, not synchronous), the second call can read the **pre-clear** `route.query` and issue a `replace` that resurrects the `import` param the first call was clearing, or vice versa — whichever replace's navigation resolves last wins, dropping the other's clear. Low real-world likelihood (the two query params originate from different flows and rarely co-occur), but a bug is a bug.

**Fix:** Await the first `router.replace` before evaluating the second, or fold both clears into a single `router.replace` call built from one `{ ...route.query }` snapshot with all resolved keys removed at once.

### WR-02: Test suite's debounce/CAS coverage never exercises two concurrent writers on the same entry

**File:** `src/components/slides/__tests__/EditSlideDrawer.test.ts` (throughout), `src/stores/__tests__/slideGroups.test.ts:732-819`

**Issue:** Every test that exercises the debounce → flush → fresh-base path edits exactly one field before switching entries (`EditSlideDrawer.test.ts:403-417`, `:619-635`). Every CAS test in `slideGroups.test.ts`'s "compare-and-swap" describe block exercises exactly one caller's write racing one *other* write (an append from elsewhere), never two writes originating from the *same* component/entry, and never a concurrent deletion. This gap is precisely what let CR-01 and CR-02 ship — both are provable with fixtures the existing test file already has all the building blocks for (multiple `makeEntry` fixtures, fake timers, mock rejection/resolution control).

**Fix:** See the regression tests requested in CR-01 and CR-02's own "Fix" sections; add them to close this gap.

## Info

### IN-01: `reconcileSongGroup`'s multi-song tie-break silently picks "first seen" with no signal to the caller

**File:** `src/utils/slideGroupMaterializer.ts:267-271`

**Issue:** When a group's stored entries somehow reference more than one distinct `songId` (a documented "prior bug's leftovers" case), `storedSongIds.values().next().value` picks whichever song was first in `Set` insertion (= stored slide array) order as "the old song" for the swap-confirm dialog's wording. This is a reasonable pragmatic default (and is intentionally documented as such), but there is no logging/telemetry marking that this degraded path was taken, so a genuinely multi-song-blended group would silently show a possibly-misleading single-song confirmation with no trace for support/debugging to follow up on later.

**Fix:** Optional — a `console.warn` when `storedSongIds.size > 1` would make this diagnosable without changing behavior. Not blocking.

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
