---
phase: 29-order-structure-stable-reordering-post-service
plan: 04
subsystem: ui
tags: [vue, sortablejs, vitest, drag-and-drop, slide-groups]

# Dependency graph
requires:
  - phase: 29-01
    provides: "Committed, running reproduction of the SlideGrid append-order defect (R050) and the reorder-failure-surfaces-an-error requirement (R049), plus the DOM-derived drag-simulation harness (simulateCardDrag) both flipped tests here build on"
provides:
  - "SlideGrid.vue's onEnd reads only draggable-scoped SortableJS indices (oldDraggableIndex/newDraggableIndex), matching ServiceEditorView.vue"
  - "D-16 single-step DOM revert and its false 'draggable scopes index arithmetic' comment removed from SlideGrid.vue"
  - "appendToGroup(entries, additions) — the one sort-append-renumber contract every append path (add-slide, deck-import-confirm, video-drop) now shares"
  - "Inline, transient reorder-failure UI (reorderError) with props-driven grid re-render on rejection (gridRenderNonce), replacing the silent console.error-only catch"
  - "Investigation finding: R050's live mechanism was the array-order/order-value divergence appendToGroup closes, not slideGroupMaterializer.ts's trailing-copyright placement (which is correct, Phase-35-owned behavior for SONG groups)"
affects: [29-05, 32, 35]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "appendToGroup(entries, additions): GroupSlideEntry[] — sort-by-order, concatenate, renumber-to-array-index. The single normalization every append/reorder write path in SlideGrid.vue now shares, so array order and the `order` field can never diverge again."
    - "gridRenderNonce (:key on the keyed card-list container) as the replacement for a hand-rolled DOM revert — forces Vue to rebuild the rendered list from props on a rejected write, and (paired with destroySortable()) lets the Sortable-instance watcher recreate a fresh instance bound to the replacement container."

key-files:
  created: []
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "R050 investigation: the live defect was the array-order/order-value divergence in onAddSlide/onImportConfirmed/appendVideoEntries's own Math.max(order)+1 computation, not slideGroupMaterializer.ts:314-317's trailing-copyright placement. The materializer's placement is correct, existing, Phase-35-owned behavior (R060: copyright first and last) and was not touched."
  - "Added destroySortable() to the reorder catch block (not explicitly named in the plan) — bumping gridRenderNonce replaces the container's DOM element via :key, which detaches the existing Sortable instance from a now-discarded node; without an explicit destroy, the watcher's create-guard (!sortableInstance) would skip recreating a fresh instance on the replacement container, silently disabling real drag-and-drop for the rest of the session after any single reorder failure."
  - "Test file changes reused the module-scope Sortable capture (`latestCapture()`) to call `onEnd` directly with a deliberately-wrong un-prefixed index pair and a synthetic leading sibling — jsdom cannot synthesize genuine multi-node drags, and `simulateCardDrag` always derives both index pairs consistently from the same DOM, so it cannot exercise the one case where they'd diverge."

requirements-completed: [R049, R050]

coverage:
  - id: D1
    description: "onEnd reads only oldDraggableIndex/newDraggableIndex; a deliberately-wrong un-prefixed pair and a leading non-card sibling are both tolerated correctly"
    requirement: "R049"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > persists the correct entry even when the un-prefixed index pair is deliberately wrong (T-29-11)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > persists the correct entry when a non-card sibling sits BEFORE the cards in the container (T-29-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A dragged slide persists to the position it was dropped in, without a DOM-revert flash — the R049 regression guard from 29-01 (already passing, kept)"
    requirement: "R049"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > drags a slide to the position it was dropped in (R049)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A new slide appends to the true end of a group with contiguous orders even when array order and order-field values had already diverged"
    requirement: "R050"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > appends a new slide at the true end of the group with contiguous orders (R050)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All three append paths (add-slide, deck-import-confirm, video-drop) renumber every entry contiguously from zero via the shared appendToGroup contract, regardless of gaps in prior order values"
    requirement: "R050"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid > add-slide control (Task 2) > appends exactly one new entry, sorted-then-appended, with every order renumbered contiguously from zero (R050)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid > video drop appends a slide, never the bed (25-07 Task 3, D-17) > renumbers all entries contiguously after appending, regardless of gaps in existing order values (R050)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A rejected reorder write renders the UI-SPEC §5 inline failure row, restores the props-derived card order, logs once with the bracketed [SlideGrid] convention, and clears on the next successful write"
    requirement: "R049"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > reorder failure surfaces and does not leave the grid showing an unsaved order (R049)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > clears the reorder failure row on the next successful write"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-07-28
status: complete
---

# Phase 29 Plan 04: SlideGrid Stable Reorder & Append-Order Fix Summary

**SlideGrid.vue's reorder/append defects fixed via draggable-scoped indices, a single `appendToGroup` sort-append-renumber contract shared by all three append paths, and an inline reorder-failure surface that replaces a hand-rolled DOM revert with a props-driven re-render.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `onEnd` now reads only `oldDraggableIndex`/`newDraggableIndex` at all four sites (null guard, equality guard, splice-out, splice-in) instead of the un-prefixed `oldIndex`/`newIndex` pair — matching `ServiceEditorView.vue` and CONTEXT.md's explicit requirement, even though 29-01 proved this specific defect is currently latent (not live) for SlideGrid's interior drags, because the drop tile is always the container's last child.
- Deleted the D-16 single-step DOM revert block and the comment above `draggable:` falsely claiming SortableJS scopes index arithmetic to the `draggable` selector — verified by `grep -c insertBefore` and `grep -c 'index arithmetic'` both returning 0.
- Added `appendToGroup(entries, additions)`: sorts a copy of `entries` by `order`, concatenates `additions`, renumbers every element to its array index. Routed `onAddSlide`, `onImportConfirmed`, and `appendVideoEntries` through it, replacing each path's own `Math.max(...entries.map(e => e.order)) + 1` computation — the mechanism that let array order and `order`-field values silently diverge (R050).
- **Investigated both candidate R050 mechanisms named in the plan** (see Deviations/Decisions): the live one was the array-order/order-value divergence `appendToGroup` closes. `slideGroupMaterializer.ts:314-317`'s trailing-copyright placement for SONG groups is correct, existing behavior owned by Phase 35 (R060) — not touched, and test assertions were scoped to non-copyright (PRAYER) groups to avoid colliding with that territory.
- Added `reorderError` (UI-SPEC §5 inline text row, `data-testid="slide-grid-reorder-error"`) and `gridRenderNonce` (bound as `:key` on the cards container). A rejected reorder write sets `reorderError`, calls `destroySortable()`, and bumps the nonce so Vue rebuilds the card list from props and the watcher creates a fresh Sortable instance on the replacement container. Replaced the un-bracketed `console.error('Failed to reorder slides:', err)` with the bracketed `[SlideGrid]` convention.
- Added two new regression guards for the draggable-index fix (deliberately-wrong un-prefixed pair; a leading non-card sibling), flipped both remaining 29-01 `it.fails` repros (R050, R049-reorder-failure) to plain `it`, added a "clears on next success" test, and updated three pre-existing append tests whose assertions assumed the old gap-preserving/reference-identity behavior that `appendToGroup` intentionally changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Draggable-scoped indices, revert removal, and the false comment** - `8883822` (fix)
2. **Task 2: One append contract — sort, append, renumber (R050)** - `23d36aa` (fix)
3. **Task 3: Reorder failure is visible and the grid restores from props** - swept into `91c4502` (see Deviations — concurrent-commit note)

_Note: Task 3's changes to `SlideGrid.vue`/`SlideGrid.test.ts` are fully present and verified at HEAD (70/70 tests pass, all grep checks pass), but landed inside the parallel 29-03 agent's commit `91c4502` rather than a dedicated 29-04 commit — see Deviations for why._

## Files Created/Modified
- `src/components/slides/SlideGrid.vue` - `onEnd` reads draggable-scoped indices only; D-16 revert and false comment removed; `appendToGroup` helper added and used by all three append paths; `reorderError`/`gridRenderNonce` refs, catch-block rewrite, and the UI-SPEC §5 inline error row added.
- `src/components/slides/__tests__/SlideGrid.test.ts` - Two new draggable-index regression guards; both remaining Phase 29 `it.fails` repros (R050, R049 reorder-failure) flipped to `it`; a new "clears on next success" test; three pre-existing append tests updated for the new contiguous-renumber/no-identity-preservation contract.

## Decisions Made
- **R050's live mechanism**, recorded per the plan's explicit investigation requirement: the array-order/`order`-value divergence in each append path's own `Math.max(...)` computation — not `slideGroupMaterializer.ts`'s trailing-copyright placement, which is correct SONG-group behavior belonging to Phase 35 (R060) and was left untouched. Test assertions for R050 use a PRAYER (non-copyright) group throughout, per the plan's explicit scoping instruction.
- **Added `destroySortable()` inside the reorder catch block** (not explicitly named in the plan's action text). Reasoning: `gridRenderNonce` incrementing changes the `:key` on the cards container, which forces Vue to discard the existing DOM node and mount a fresh one. The Sortable instance created by the `watch([cardsContainerRef, canReorder], ...)` watcher was bound to the *old* node; without releasing it first, the watcher's `!sortableInstance` create-guard would see a still-truthy `sortableInstance` and never attach a new instance to the replacement container, silently breaking real (non-test) drag-and-drop for the rest of the session after any single reorder failure. This is a Rule 2 (missing critical functionality) auto-fix — the plan's `key_links` describes the render-side half of this mechanism but not the Sortable-lifecycle half.
- Kept the existing `it('drags a slide to the position it was dropped in (R049)')` regression guard from 29-01 unchanged — it already exercises the fixed handler correctly and needed no modification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `destroySortable()` to the reorder-failure catch block**
- **Found during:** Task 3
- **Issue:** The plan specifies bumping `gridRenderNonce` on rejection to force a props-driven re-render, but incrementing a `:key` discards the DOM node the current `Sortable` instance is bound to. Without releasing that instance first, the `watch([cardsContainerRef, canReorder], ...)` guard (`!sortableInstance`) would never fire the create branch again for the replacement container, since `sortableInstance` was still non-null.
- **Fix:** Added `destroySortable()` immediately before the nonce bump in the catch block, so the watcher's destroy/create cycle runs cleanly against the new container once it lands.
- **Files modified:** `src/components/slides/SlideGrid.vue`
- **Verification:** `npm run test:unit -- --run src/components/slides/__tests__/SlideGrid.test.ts` — 70/70 pass (this specific Sortable-lifecycle concern is not independently observable through the mocked-Sortable unit harness, since the mock never attaches to real DOM; documented here as a real-browser correctness fix, not something the test suite alone proves).
- **Committed in:** swept into `91c4502` (see item 2 below)

**2. [Concurrency / shared-branch note, not a code deviation] Task 3's commit landed inside the parallel 29-03 agent's commit**
- **Found during:** Attempting to `git add`/`git commit` Task 3's changes as a dedicated 29-04 commit.
- **Issue:** This project's config sets `branching_strategy: none` (no worktree isolation) — 29-03 (wave 2, running in parallel on `ServiceEditorView.vue`) and this plan (29-04, on `SlideGrid.vue`) both operate directly on `milestone/M001` in the same working directory. Between staging Task 3's changes (`git add`) and running `git commit`, the concurrent 29-03 agent's own commit (`91c4502`, "feat(29-03): multi-instance Sortable lifecycle and a correct onEnd") landed first and its `git add` swept up my already-staged `SlideGrid.vue`/`SlideGrid.test.ts` changes alongside its own `ServiceEditorView.vue` work. `git status` afterward showed nothing left to commit for my two files — the content was already captured, verified byte-for-byte identical to what Task 1 and Task 2's edits had built toward.
- **Resolution:** Did **not** attempt to rewrite/split the shared commit — `91c4502` is on a shared branch another concurrent process may already be building on, and history rewriting there is exactly what the destructive-git-operations guidance prohibits. Verified instead that HEAD's actual file content is complete and correct: all three tasks' grep checks pass (`insertBefore` → 0, `index arithmetic` → 0, `newDraggableIndex` → 4), the full `SlideGrid.test.ts` suite is 70/70 green with zero `it.fails` remaining, lint and `vue-tsc` are clean for both files, and `SongLyricEditor.vue` remains untouched.
- **Files modified:** None beyond what Tasks 1–3 already specified — this is a commit-attribution artifact, not a functional gap.
- **Impact on plan:** Task 3's `<done>` criteria are fully met at HEAD; only the commit message/authorship for that slice of work differs from the per-task-commit protocol's normal expectation, because of the shared, unisolated branch two parallel Phase 29 plans were executing against simultaneously.

---

**Total deviations:** 2 (1 Rule-2 auto-fix, 1 shared-branch commit-attribution note — no functional scope creep)
**Impact on plan:** All auto-fixes necessary for correctness (real-browser Sortable lifecycle) or fully explained by the shared-branch execution model; no code content differs from what the plan specified.

## Issues Encountered
- The shared, non-worktree-isolated branch (`branching_strategy: none`) meant this plan's own `SlideGrid.vue`/`SlideGrid.test.ts` files were momentarily touched by a broad `git add` from the concurrently-running 29-03 agent while both plans executed at the same time — see Deviations item 2. No file content was lost or corrupted; only commit attribution was affected, and this was fully verified against HEAD before proceeding.
- `npx vue-tsc --build` reports pre-existing type errors in `src/views/ServiceEditorView.vue` (missing `slotSectionGroups`/`setSectionListRef`/`dragOverSection` on the composable's return type) — these originate entirely from the concurrent, still-in-flight 29-03 plan (out of this plan's scope; `SlideGrid.vue` itself produces zero type errors).
- **Full-suite baseline check:** `npm run test:unit -- --run` (whole `src/`) reports 12 failing files, not the documented 10. Diffed the failing set against the documented baseline (8 `.gsd/quarantine/worktrees/**` duplicates — `rules.test.ts`/`stores/services.test.ts`/`views/RosterView.test.ts`/`views/ServiceEditorView.test.ts` × 2 snapshots — plus `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts`): all 10 documented files are still present and still fail for their documented reasons (emulator required, stale copy-name assertion). The two EXTRA failures, `functions/lib/index.test.js` and `functions/lib/pptxParser.test.js`, are untracked, `.gitignore`d (`functions/lib/` — confirmed via `.gitignore:13`) compiled build output that vitest's test glob happened to pick up; they fail with `Vitest cannot be imported in a CommonJS module using require()` — a stale `tsc` build artifact issue with zero relationship to any Phase 29 source change. This plan's own scoped run (`SlideGrid.test.ts`, 70/70) is unaffected and is the correct signal for this plan's own correctness; the full-suite run is reported here only because the plan's `<verification>` names it.
- Observed (but did not touch) uncommitted, unstaged changes to `src/utils/scheduler.ts` and its two `.gsd/quarantine/worktrees/**` copies while running the full suite — not part of this plan's `files_modified` and evidently another concurrent process's in-progress work on the same shared branch. Left entirely alone.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R049 and R050 are both closed for `SlideGrid.vue`: draggable-scoped indices, the D-16 revert removed, the one `appendToGroup` contract shared by every append path, and a visible reorder-failure surface with props-driven recovery.
- `SongLyricEditor.vue` (Phase 28's equivalent editor, same copy-pasted shape) remains untouched, confirmed via `git diff --name-only` showing no entry for it — still out of scope per CONTEXT.md.
- The R050 "second candidate mechanism" investigation (`slideGroupMaterializer.ts`'s trailing-copyright placement) confirms that mechanism is correct, Phase-35-owned behavior — Phase 35 (CCLI/copyright placement, R060) can proceed against the current materializer unchanged; no cleanup debt left behind by this plan.
- 29-05 (the fifth Post-Service section and the four downstream-consumer audit) has no dependency on this plan's specific changes beyond the shared Phase 29 test harness (`simulateCardDrag`, `latestCapture`) already established by 29-01 and extended here.

---
*Phase: 29-order-structure-stable-reordering-post-service*
*Completed: 2026-07-28*

## Self-Check: PASSED
- FOUND: `src/components/slides/SlideGrid.vue`
- FOUND: `src/components/slides/__tests__/SlideGrid.test.ts`
- FOUND: `.planning/phases/29-order-structure-stable-reordering-post-service/29-04-SUMMARY.md`
- FOUND: commit `8883822` (Task 1)
- FOUND: commit `23d36aa` (Task 2)
- FOUND: commit `91c4502` (Task 3, swept into concurrent 29-03 commit — see Deviations)
