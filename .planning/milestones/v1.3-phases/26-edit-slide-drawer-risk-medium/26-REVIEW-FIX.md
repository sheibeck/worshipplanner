---
phase: 26-edit-slide-drawer-risk-medium
fixed_at: 2026-07-27T03:40:00Z
review_path: .planning/phases/26-edit-slide-drawer-risk-medium/26-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 26: Code Review Fix Report

**Fixed at:** 2026-07-27T03:40:00Z
**Source review:** .planning/phases/26-edit-slide-drawer-risk-medium/26-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, CR-02, CR-03 Critical; WR-01 Warning — WR-02 "test suite never
  exercises two concurrent writers on the same entry" was folded into CR-01/CR-02's own regression
  tests per task instructions, not treated as separate work; IN-01 Info was explicitly out of scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Parallel `flushAll()` lets one debounced field-write clobber another on the same entry

**Files modified:** `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/__tests__/EditSlideDrawer.test.ts`
**Commit:** `2b4cbb1`
**Applied fix:** Applied the review's suggested fix as-is — `flushAll()` now awaits `flushField('label')`,
`flushField('notes')`, `flushField('body')` sequentially instead of via `Promise.all`, matching the
codebase's existing `autosaveSaving` serialisation precedent (Quick-6). Each `writeField` call reads
`props.group.slides` synchronously the moment it runs; serialising the three flushes means the second
and third writes observe whatever the store's own snapshot has committed by the time they run, instead
of all three racing against the exact same stale base captured before any of them landed.

Added the WR-02-required regression coverage: a test that edits both Slide Label and Notes on the SAME
entry, then switches to a different slide (triggering `flushAll`) before either field's 800ms debounce
fires naturally. The test simulates the store's own round-trip by having the mocked
`replaceGroupSlides`'s first (label) call update the live `group` prop before the second (notes) call
runs, then asserts the second write's payload carries BOTH the label AND the notes edit — the exact
case that silently discarded one of the two edits under the old `Promise.all` behavior.

All 95 tests in `EditSlideDrawer.test.ts` pass. `npm run type-check` and `npm run build` both exit 0.

### CR-02: The CAS merge never accounts for a concurrent deletion — a slower write can resurrect a just-deleted slide

**Files modified:** `src/stores/slideGroups.ts`, `src/stores/__tests__/slideGroups.test.ts`
**Commit:** `8956cfe`
**Applied fix:** Applied the review's suggested fix, adapted to the current helper's exact shape:
`mergeConcurrentlyAddedEntries` now also computes `liveIds` and filters `next` to drop any entry that is
present in `base` (this caller saw it) and still present in `next` (this caller did not itself intend to
remove it, since `next` is always `base.map(...)`/`base.filter(...)`) but absent from `live` (a
different, concurrent writer's delete already committed) — before appending the existing
concurrently-added-entry recovery logic. This caller's OWN intentional delete (an entry absent from its
own `next` regardless of what `base`/`live` say) is untouched by this filter, since the filter only ever
inspects entries `next` still carries.

Updated the stale doc comment on `replaceGroupSlides` (previously said concurrent deletions were
explicitly out of scope, written before Phase 26 shipped the first delete-a-slide path) to describe the
new behavior.

Added the WR-02-required regression coverage: one test mirroring the existing "concurrently-added entry
survives" tests but for a concurrently-*deleted* entry (`live` lacks an id that `base`/`next` both still
carry — a debounced, unrelated field-edit's stale `next`), asserting the final payload strips the deleted
entry rather than resurrecting it; and a second negative-control test confirming this caller's own
intentional delete (absent from `next`) is preserved even when `live` is unchanged from `base` (i.e. the
new filter never mistakes an intentional delete for something to "protect").

All 36 tests in `slideGroups.test.ts` pass, and the dependent `SlideGrid.test.ts` (64 tests) and
`useSlideshowAssembly.test.ts` (45 tests) both still pass unchanged. `npm run type-check` and
`npm run build` both exit 0.

### CR-03: The reconciliation pending-map is never pruned after Apply or Dismiss

**Files modified:** `src/composables/useSlideshowAssembly.ts`, `src/composables/__tests__/useSlideshowAssembly.test.ts`
**Commit:** `895ea34`
**Applied fix:** Applied the review's suggested fix, but had to extend it one level upstream once tracing
the actual code path: the review's snippet adds a `pendingReconciliationsMap.delete(outcome.slotId)` call
inside `applyReconciliationOutcomes`'s `!outcome.result.changed` branch, assuming that outcome reaches the
function at all. Tracing `reconciliationOutcomes`'s own computed showed a pre-existing filter —
`if (!result.changed && !result.needsConfirm) continue` — that discards exactly this "already resolved,
nothing to do" case *before* `applyReconciliationOutcomes` ever sees it, which would make the review's
suggested delete dead code for the Apply-resolves-to-sync path (confirmed by first writing the regression
test below and watching it fail against the review's fix verbatim).

Fixed by moving the `pendingReconciliationsMap` declaration above `reconciliationOutcomes` (still same
composable scope, no behavior change from the move itself) and widening that upstream filter to
`if (!result.changed && !result.needsConfirm && !pendingReconciliationsMap.has(slot.id)) continue` — a
slot whose reconciliation is otherwise a no-op is now let through exactly once if a stale pending entry
still exists for it, so `applyReconciliationOutcomes` gets the chance to prune it. Also added the
review's own two `.delete()` calls: one on the `dismissedSignature`-suppression branch (Dismiss), one on
the `!outcome.result.changed` branch (now reachable for the Apply-resolves-to-sync case thanks to the
upstream filter change).

D-07 durable-dismissal contract preserved: only the in-memory `pendingReconciliationsMap` is pruned here;
the persisted `dismissedSignature` field this composable compares against is never touched by this fix,
so a genuinely NEW divergence (a different `freshSignature`) still fails the `dismissedSignature` match
and re-populates the map exactly as before.

Added the WR-02-required regression coverage (both resolution paths, per the design guidance's "prune on
both outcomes"): one test starts with no `dismissedSignature`, mounts the composable, confirms
`pendingReconciliations` has length 1, then live-updates the mock group's `dismissedSignature` to match
`freshSignature` on the SAME mounted instance (simulating `SlideGrid.vue`'s Dismiss write round-tripping
back) and asserts `pendingReconciliations` drops to length 0. A second test does the equivalent for
Apply: live-updates the mock group's `sourceSignature` to match `freshSignature` (simulating
`onApplyReconciliation`'s direct, composable-bypassing store write round-tripping back) and asserts the
same drop to zero. Both tests initially failed against a fix that only touched
`applyReconciliationOutcomes` (confirming the upstream-filter gap described above) and pass with the
final fix.

All 45 tests in `useSlideshowAssembly.test.ts` pass. `npm run type-check` and `npm run build` both exit 0.

### WR-01: `SongsView.vue` fires two independent, un-awaited `router.replace` calls in `onMounted` that can race

**Files modified:** `src/views/SongsView.vue`
**Commit:** `465fa0f`
**Applied fix:** Applied the review's suggested fix as-is (the simpler of the two options it offered):
`await`ed the `?import=true` clearing `router.replace` call before `resolveSongEditRequest()` runs, so
its own synchronous `clearSongEditQueryParam()` (when a song-edit request is also present and the song
is already loaded) reads `route.query` only after the import clear's navigation has fully resolved,
closing the race between the two un-awaited replaces.

No new test file was added for this fix — consistent with 26-02's own plan note recorded in
`.planning/STATE.md` ("Task 3 (SongsView arrival handling) deliberately has no new test file per its own
plan instruction — verified via type-check/build + human-check"), and this task's scope folds WR-02's
test-coverage requirement into CR-01/CR-02's regression tests specifically, not WR-01. Verified via
`npm run type-check` and `npm run build`, both exit 0.

## Skipped Issues

None — all 4 in-scope findings were fixed.

## Verification Performed

- `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` — 95/95 pass (CR-01).
- `npx vitest run src/stores/__tests__/slideGroups.test.ts` — 36/36 pass (CR-02).
- `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts src/composables/__tests__/useSlideshowAssembly.test.ts` — 107/107 pass (CR-02 dependents).
- `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts` — 45/45 pass, re-run standalone after the CR-03 upstream-filter change (CR-03).
- `npx vitest run src/components/slides src/stores src/composables` — 1118 passed / 12 failed, both failing files exclusively inside `.gsd/quarantine/worktrees/**` debris (pre-existing baseline, unrelated to this phase's code — a `crypto.randomUUID is not a function` failure in a stale quarantined `services.test.ts` copy).
- `npm run type-check` — exits 0, no errors, after each of the 4 commits.
- `npm run build` — exits 0, production bundle produced successfully.
- `git grep -n "bedVideoUrl" src/` — zero matches, confirming D-18 (no bed video) was not reintroduced by
  any of these fixes.
- **Full-suite baseline check:** `npx vitest run src/` (final, at the last commit) — **10 failed FILES**,
  exactly matching the documented pre-fix baseline recorded in `26-09-SUMMARY.md` (8
  `.gsd/quarantine/worktrees/**` stale duplicates, `src/storage.rules.test.ts` requiring the Storage
  emulator, `src/views/__tests__/RosterView.test.ts`'s stale pre-existing "Roles config" assertion) — the
  failing-file SET did not grow past 10. **3528 tests passed** (up from the pre-fix baseline of 3521,
  consistent with this task's 7 new regression tests: 1 for CR-01, 2 for CR-02, 2 for CR-03 (WR-01 added
  no new test, per its own scope note above), plus incidental count drift from other in-flight work).
  Zero new failures introduced by these four fixes.

## Logic-Complexity Note

All four fixes are genuine logic changes to concurrency-sensitive or lifecycle-sensitive code paths, not
pure syntax edits — flagged here per this task's own instructions for human-verify attention before this
ships:

- **CR-01** changes write ORDERING (parallel → sequential) on the drawer's own debounce-flush path. Low
  risk in isolation (backed by a regression test that reproduces the exact clobber scenario), but worth a
  skim since every field-write in the drawer routes through `flushAll`.
- **CR-02** widens a Firestore-transaction merge algorithm (`mergeConcurrentlyAddedEntries`) that every
  slide-group write in the app now passes through — the highest-blast-radius change in this batch, though
  narrowly scoped (only entries present in `base`+`next` but absent from `live` are affected) and covered
  by both a positive (resurrection prevented) and negative (own-intentional-delete preserved) test.
- **CR-03** required a genuine design correction beyond the review's literal suggested snippet — the
  upstream `reconciliationOutcomes` filter had to be widened, not just the downstream apply function —
  discovered specifically because the regression test was written against the review's fix, failed, and
  the fix was corrected in response. Recommend a human skim of `useSlideshowAssembly.ts`'s
  `reconciliationOutcomes` computed and `applyReconciliationOutcomes` together before this ships, given
  how easy it was for the literal review suggestion alone to look complete while being partially inert.
- **WR-01** is a small, low-risk ordering fix (awaiting one existing call) with no new logic introduced.

---

_Fixed: 2026-07-27T03:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
