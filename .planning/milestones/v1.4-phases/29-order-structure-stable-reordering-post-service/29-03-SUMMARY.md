---
phase: 29-order-structure-stable-reordering-post-service
plan: 03
subsystem: ui
tags: [vue, sortablejs, drag-and-drop, service-editor, ordering]

# Dependency graph
requires:
  - phase: 29-order-structure-stable-reordering-post-service (plan 01)
    provides: "Failing repro of the ZTXcpNRcJTalEQp42fTx drag-reorder bug (R044), DOM-derived drag simulation harness"
  - phase: 29-order-structure-stable-reordering-post-service (plan 02)
    provides: "groupBySection/flattenBySection/orderSlotsBySection pure ordering helpers in slotTypes.ts"
provides:
  - "Per-section rendering of ServiceEditorView.vue's slot list — one always-visible container per SERVICE_SECTIONS member plus a trailing ungrouped container, driven by a new slotSectionGroups computed"
  - "Stable slot.id v-for key (was slot.kind + '-' + slot.position) plus data-slot-id on every card"
  - "reindexSlots(orderSlotsBySection(...)) applied at every mutation site: addSlot, performRemoveSlot, onSectionChange, the save payload, and the reorder handler"
  - "One Sortable instance per section container (Map<ServiceSection | 'ungrouped', Sortable>), sharing a 'service-slots' group for cross-section drag — this codebase's first multi-instance Sortable and first use of SortableJS group"
  - "onEnd reads oldDraggableIndex/newDraggableIndex exclusively, resolves source/destination section from data-section, and persists a single-write cross-section move"
  - "autosaveStatus gains an 'error' state; a rejected reorder write reverts localService.slots to the pre-drag snapshot and surfaces the UI-SPEC §5 inline message"
affects: [29-05-post-service-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-instance Sortable lifecycle: Map<key, Sortable> populated/torn down via a watch on a ref-callback-populated element map + a canReorder guard (generalizes SlideGrid.vue's single-instance canReorder/destroySortable() pattern)"
    - "Section-major array ordering as a composed invariant: reindexSlots(orderSlotsBySection(...)) at every mutation site keeps the rendered order and the persisted order provably equal"
    - "Revert-on-reject: capture the pre-mutation array reference before an optimistic assignment, restore it in catch, leave originalService untouched so isDirty still reflects reality"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "addSlot inherits the section of the current last slot (not left section-less) so a new item on a fully sectioned service lands at the end of that section rather than in the ungrouped bucket."
  - "The ungrouped (legacy) container's Sortable group config is { name: 'service-slots', pull: true, put: false } — legacy items can be dragged OUT into a real section, but nothing can be dropped back INTO limbo."
  - "onEnd never reassigns moved.section when the destination is the ungrouped bucket (which only happens on a same-list reorder within ungrouped, since put:false blocks any other path there) — preserves a legacy/out-of-union section value instead of silently normalizing it to undefined (T-29-06)."
  - "Verified (not just claimed) that the four other autosaveStatus assign/compare sites already behave correctly against the widened 'error' state with no code changes needed: the remote-merge guard already excludes any status other than idle/saved so it never silently stomps an unseen error, and the debounce watcher's unconditional 'pending' on the next dirty change is what naturally clears 'error' on a subsequent successful save."
  - "Reindexing a slot's section-major position is a genuine behavior change to onSectionChange (previously it did NOT reorder the array at all) — updated two pre-existing Phase 24-06 tests whose assumptions depended on the old non-reordering behavior (see Deviations)."

patterns-established:
  - "Keyed-Map Sortable lifecycle for multi-container drag-and-drop — the template for any future per-group Sortable split in this codebase."

requirements-completed: [R043, R044]

coverage:
  - id: D1
    description: "Every SERVICE_SECTIONS member renders its own header and its own list container, in fixed array order, whether or not it holds items; an empty section renders the UI-SPEC §2 placeholder and is still a live drop target"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > renders all four section headers unconditionally, in SERVICE_SECTIONS order (29-03)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > renders all four section headers, with placeholders, and routes every slot into the trailing ungrouped container for a legacy service (29-03)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > renders an empty-section placeholder as a live drop target for a section with no slots (29-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Section headers are structurally excluded from any section's Sortable instance (sibling of the list container, not a member of it) and are never draggable"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > creates one Sortable instance per rendered section list container, sharing the group name; the ungrouped container is pull-only (put: false)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A service-item drag — within a section or across sections — lands exactly where dropped, immediately, no refresh; a cross-section drag is a single write (position and section change together or not at all)"
    requirement: "R044"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > lands a service item exactly where it was dropped (R044)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > moves an item within its own section to a non-adjacent position (R044)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > reads only the Draggable-suffixed indices — deliberately wrong un-prefixed oldIndex/newIndex do not affect the result"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > performs no write for a no-op drag (same section, same draggable index)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Unmounting the view destroys every created Sortable instance"
    requirement: "R044"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > destroys every Sortable instance on unmount"
        status: pass
    human_judgment: false
  - id: D5
    description: "A rejected reorder write reverts localService.slots to the pre-drag snapshot and shows the inline failure message; the UI never displays an order that was not persisted"
    requirement: "R044"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > reverts to the pre-drag id sequence and surfaces the UI-SPEC §5 message when the reorder write rejects, logging once via the bracketed-module convention"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > a subsequent successful reorder clears the error state"
        status: pass
    human_judgment: false
  - id: D6
    description: "Changing a slot's section via the existing dropdown reorders section-major (same array shape a drag would produce), and adding a slot inherits the current last slot's section"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > changing a slot's section via the select moves its card into the target section's container and renumbers positions section-major (29-03)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Section headers and slideshow preview (Phase 20-04) > adding a slot inherits the section of the current last slot, landing at the end of that section rather than in the ungrouped container (29-03)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A real cross-section OS drag in the running app (jsdom cannot synthesize genuine drag events — CONTEXT.md's one manual human-verify item)"
    verification: []
    human_judgment: true
    rationale: "jsdom cannot synthesize genuine SortableJS drag events; CONTEXT.md explicitly scopes this to a single manual human-verify check rather than new E2E tooling."

duration: 95min
completed: 2026-07-28
status: complete
---

# Phase 29 Plan 03: Per-Section Render, Stable Key, Multi-Instance Sortable, and Save-Failure Revert Summary

**Rebuilt `ServiceEditorView.vue`'s drag-reorder from a single flat Sortable list to one Sortable instance per `SERVICE_SECTIONS` container (always visible, sharing a `service-slots` group for cross-section drag), keyed on the stable `slot.id`, with `reindexSlots(orderSlotsBySection(...))` composed at every mutation site so the rendered order and the persisted order can never diverge — plus a real revert-and-surface path for a rejected reorder write.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3 (plus one post-task TS-lib-target fix)
- **Files modified:** 2

## Accomplishments
- Split the single flat `v-for` (with section headers as draggable-container siblings) into a `slotSectionGroups` computed driving one always-rendered header + list-container pair per `SERVICE_SECTIONS` member, plus a trailing ungrouped container for section-less slots — closing the known v-1.2 defect where an empty Pre-Service section didn't render at all.
- Changed the `v-for` key from `slot.kind + '-' + slot.position` (rewritten by `reindexSlots` on every reorder, defeating Vue's keyed diff) to the stable `slot.id`; every card also carries `data-slot-id`.
- Deleted `showsSectionHeaderAt` (per-index conditional header logic) entirely — headers are now unconditional per section and structurally excluded from any Sortable instance (a DOM sibling of the list container, not a member of it).
- Composed `reindexSlots(orderSlotsBySection(...))` at `addSlot`, `performRemoveSlot`, `onSectionChange`, the explicit save payload, and the new reorder handler — the array order the editor renders and the array order that gets persisted are now provably identical at every mutation point.
- Replaced the single-instance Sortable block with a `Map<ServiceSection | 'ungrouped', Sortable>`, created/destroyed via a `watch` on the ref-callback-populated element map and a `canReorder` guard — this codebase's first multi-instance Sortable and first use of SortableJS `group` (shared `'service-slots'` name; the ungrouped container is pull-only, `put: false`).
- Rewrote `onEnd` to read `oldDraggableIndex`/`newDraggableIndex` exclusively, resolve source/destination section from `data-section`, splice within the grouped-bucket model (never a hand-translated whole-array index), and persist the result in one write.
- **Deleted the false comment** (previously claiming `draggable` scoped both drag eligibility and the old/new index arithmetic — factually wrong for SortableJS v1.15.7, and the documented fossil of a previous failed fix) and **the single-step D-16 DOM revert** (safe to remove now that `:key="slot.id"` makes Vue's own re-render correct — a deliberate simplification, not an oversight).
- Flipped the two Phase 29 repro tests (29-01) from `it.fails` to plain `it` — R044 is now proven, not just reproduced-as-broken.
- Added a real save-failure path: a rejected reorder write reverts `localService.slots` to the pre-drag snapshot, sets `autosaveStatus.value = 'error'`, logs once via `console.error('[ServiceEditorView] reorder save failed:', err)`, and renders the UI-SPEC §5 inline message (`data-testid="autosave-error"`, exact copy). `originalService` is left untouched on failure so `isDirty` still reflects reality.

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-section render — one container per section, stable slot.id key, empty placeholder** - `42b5586` (feat)
2. **Task 2: Multi-instance Sortable lifecycle and a correct onEnd** - `91c4502` (feat)
3. **Task 3: Revert on save failure and the 'error' autosave state** - `2ab736e` (feat)
4. **Post-task fix: Array.prototype.at() unsupported by configured TS lib target** - `0030c2c` (fix)

_Note: `91c4502`'s diffstat also shows `src/components/slides/SlideGrid.vue` and its test — see Deviations, "Cross-plan git contamination." That content is 29-04's Task 3 work, not this plan's; it was not authored here._

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - `slotSectionGroups`/`slotsBySection` computeds, per-section template restructure, `setSectionListRef`/`sectionListEls`/`dragOverSection`, the `Map<ServiceSection | 'ungrouped', Sortable>` lifecycle (`canReorder`, `destroySectionSortables`, the create/destroy watcher), the rewritten `onSlotSortEnd` (with revert-on-reject), `autosaveStatus` widened to include `'error'`, the UI-SPEC §5 error span, and `reindexSlots(orderSlotsBySection(...))` at every mutation site.
- `src/views/__tests__/ServiceEditorView.test.ts` - Restated the Phase 20-04 section-header tests to the new unconditional semantics; added empty-placeholder, data-slot-id/section-major-order, section-change-reorders, and add-inherits-last-section tests; flipped the two Phase 29 repro tests from `it.fails` to `it`; added the wrong-un-prefixed-index regression guard, no-op-drag, instance-count/group-config, unmount-destroys-every-instance, and the two save-failure-revert tests; updated two pre-existing Phase 24-06 tests whose fixed assumptions broke under the new `onSectionChange` reordering behavior (see Deviations).

## Decisions Made
- `addSlot` now inherits the current last slot's section (`createSlot(kind, vwType, currentSlots[currentSlots.length - 1]?.section)`) instead of always creating section-less slots — matches the plan's explicit behavior requirement and prevents new items on a fully sectioned service from silently landing in the ungrouped bucket.
- `onEnd` never reassigns `moved.section` when the destination bucket is `'ungrouped'` (only reachable via a same-list reorder within the ungrouped container itself, since `put: false` blocks any cross-container drop into it) — preserves a legacy or out-of-union `section` value rather than silently normalizing it to `undefined` (T-29-06, the hard constraint that legacy slots must never be silently reassigned).
- Verified rather than assumed that the four other `autosaveStatus` assign/compare sites (initial-load reset, remote-merge guard, D-17 debounce watcher's unconditional `'pending'`, `onUndo`'s reset) already behave correctly against the widened `'error'` state with zero code changes — documented the reasoning inline as code comments and in the Task 3 commit message rather than leaving it implicit.
- Verified reindexing via DOM `data-testid="slot-{index}"` sequencing instead of waiting on the debounced autosave write in the "changing a slot's section... renumbers positions section-major" test, because a single `onSectionChange` mutation is always the FIRST deep-watch trigger per mount (swallowed by the `autosaveInitialized` guard per this file's own documented pattern) — this is a more direct, timing-independent proof of reindexing than waiting 900ms for a debounce that would need a throwaway edit first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Array.prototype.at()` unsupported by this project's configured TS lib target**
- **Found during:** post-Task-3 `npx vue-tsc --build` verification
- **Issue:** `addSlot`'s `localService.value.slots.at(-1)?.section` failed with TS2550 — `.at()` requires an `es2022`+ lib target not configured in this project's `tsconfig`.
- **Fix:** Replaced with `currentSlots[currentSlots.length - 1]?.section` — identical section-inheritance behavior, no lib target change.
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Verification:** `npx vue-tsc --build` reports zero errors; full `ServiceEditorView.test.ts` run stays at 63/63 passing.
- **Committed in:** `0030c2c`

**2. [Rule 1 - Bug, consequence of a plan-mandated hard constraint] Updated two pre-existing Phase 24-06 tests broken by the new `onSectionChange` reordering behavior**
- **Found during:** Task 1 verification run
- **Issue:** The plan's hard constraint requires `reindexSlots(orderSlotsBySection(...))` at `onSectionChange` — previously that function only set `slot.section`, never reordered the array. Two Phase 24-06 tests ("deleting a middle slot leaves the surviving slots ids unchanged after reindexSlots" and "a second identical id-less remote snapshot does not change previously backfilled ids") used a throwaway `onSectionChange` edit as a "consume the autosave watcher's first trigger" idiom, relying on the OLD non-reordering behavior to keep the rest of the fixture's array order and remove-button indices stable. Under the new (mandated) reordering behavior, that same throwaway edit legitimately reorders the array, breaking both tests' index/order assumptions.
- **Fix:** "Deleting a middle slot" — recalculated the correct post-reorder remove-button index (4 → 5) and the correct expected surviving-id/position arrays. "Second identical id-less remote snapshot" — changed the final id-order assertion from `toEqual` (exact order) to a sorted-array comparison, since the test's actual guarantee (R028: no id dropped or re-minted across a stale remote merge) is about the id SET, not array order, and the reordering this edit now legitimately triggers is unrelated to that guarantee.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** Both tests pass; full file run at 57/57 (Task 1), later 63/63 (Task 3).
- **Committed in:** `42b5586` (Task 1 commit)

### Issues Encountered (not deviations — process/environment)

**Cross-plan git contamination (29-04 running concurrently in the same unworktreed checkout).** This plan's `29-CONTEXT.md`/config specifies `branching_strategy: none` — Wave 2 runs this plan (29-03) and 29-04 in parallel against the SAME shared git working directory and index (no worktree isolation). Between this plan's Task 2 `git add <files>` and `git commit`, the concurrently-running 29-04 agent had staged (but not yet committed) its own SlideGrid.vue/SlideGrid.test.ts Task 3 changes (save-failure revert + `reorderError` state, mirroring what this plan's Task 3 later built for `ServiceEditorView.vue`). Because `git commit` (without a pathspec) commits the FULL index, not just what was just `git add`ed, commit `91c4502` ended up containing both this plan's intended Task 2 changes AND 29-04's staged-but-uncommitted SlideGrid work. **No content was lost or corrupted** — the code is fully present and functionally correct in git history, just attributed to the wrong commit message. Rewriting shared history mid-parallel-execution (e.g., `git reset`/force-editing that commit) was judged too risky — it could destroy or desynchronize 29-04's own in-progress state — so the history was left as-is. From that point forward, every subsequent commit in this plan explicitly verified `git status --short` was clean of unrelated files and `git diff --cached --stat` matched exactly the intended file list before running `git commit` (Tasks 3 and the post-task fix both confirmed clean). This is flagged here for the phase orchestrator/verifier's awareness, not something this plan's own scope can resolve (it's a wave-level concurrency-isolation gap, not a defect in either plan's code).

---

**Total deviations:** 2 auto-fixed (1 bug/blocking-type-error, 1 consequential test update from a plan-mandated behavior change); 1 process issue documented (cross-plan git contamination, no data loss).
**Impact on plan:** No scope creep. Both auto-fixes were necessary corrections; the cross-plan contamination is an execution-environment finding that the phase orchestrator should account for in future wave-parallelization setups (worktree isolation, or serializing commit-sensitive steps across parallel plans in the same wave).

## Issues Encountered
See "Cross-plan git contamination" above. No other issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The four-section reorder mechanism (drag, section-select, add, remove) is proven correct and section-major-consistent at every mutation site — Plan 05 can add the fifth Post-Service section to `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS` and this plan's `slotSectionGroups`/`sectionSortables`/`onSlotSortEnd` machinery picks it up automatically (all driven by `SERVICE_SECTIONS` iteration, no section-name string literals in the reorder logic itself).
- `SlideGrid.vue`'s own three-defect fix and save-failure revert are 29-04's territory and were not touched by this plan's own edits (see the Deviations note on the git-history overlap — the actual SOURCE code changes are real 29-04 work, not a byproduct of this plan).
- The one CONTEXT.md-mandated manual human-verify item (a real cross-section OS drag — jsdom cannot synthesize genuine drag events) remains outstanding; recorded as deliverable D7 above with `human_judgment: true`.
- No blockers for Plan 05.

---
*Phase: 29-order-structure-stable-reordering-post-service*
*Completed: 2026-07-28*

## Self-Check: PASSED
All modified files exist on disk (`src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`); all task commit hashes (42b5586, 91c4502, 2ab736e, 0030c2c) verified in `git log`.
