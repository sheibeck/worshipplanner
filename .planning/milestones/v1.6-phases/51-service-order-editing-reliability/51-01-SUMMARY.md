---
phase: 51-service-order-editing-reliability
plan: 01
subsystem: service-order-editor
tags: [R110, sortablejs, vue-dom-ownership, drag-reorder, reliability]
requires:
  - "ServiceEditorView.vue per-section SortableJS architecture (v1.4 Phase 29)"
  - "slotTypes.ts ordering contract (groupBySection/flattenBySection/reindexSlots)"
provides:
  - "R110 fix (live plan): cross-section drag leaves exactly one rendered item, no phantom"
  - "slotRenderNonce container-rebuild pattern in ServiceEditorView"
affects:
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
tech-stack:
  added: []
  patterns:
    - "SlideGrid-style destroy-then-nonce container rebuild to reclaim Sortable-orphaned DOM"
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
decisions:
  - "Chose the nonce-keyed container rebuild (51-RESEARCH fix option 2) over manual DOM-revert index math — proven in-repo (SlideGrid.vue), lower risk, satisfies fix-at-source/no-refresh."
  - "Nonce rides the section v-for template :key, not the container <div> :key — Vue forbids :key on a child of <template v-for>."
  - "Paired the nonce bump with destroySectionSortables() (SlideGrid precedent) — required, not belt-and-braces, or the rebuilt containers are left drag-dead."
metrics:
  duration: ~15 min
  completed: 2026-08-11
status: complete
---

# Phase 51 Plan 01: R110 Cross-Section Drag Phantom (Live Plan) Summary

Fixed R110 in the live service plan editor: a cross-section drag no longer spawns a second, undeletable "No Section" copy of the dragged item. The reactive move logic was already correct — the defect was a SortableJS↔Vue DOM-ownership desync — so the fix forces Vue to rebuild the Sortable-mutated section container from state via a render nonce, reclaiming the orphaned node without a page refresh.

## What was built

**Task 1 (RED — `test(51-01)`, commit `07a5a1c`):** Added a DOM-mutating cross-section drag repro to `ServiceEditorView.test.ts`. The module's `sortablejs` mock only captures options and never moves a DOM node, so an `onEnd`-only test is false-GREEN on buggy code (51-RESEARCH Pitfall 1). The new test physically detaches the dragged `.slot-item` from the ungrouped ("No Section") container and appends it into the worship container **before** invoking the captured `onEnd`, mirroring real SortableJS. It then asserts on rendered DOM node counts: zero clones left in the source list, and **exactly one** `.slot-item` for the moved id tree-wide. Committed RED (`expected 2 to be 1` — the phantom).

**Task 2 (GREEN — `fix(51-01)`, commit `9440e24`):** Added `slotRenderNonce` (a component-local `ref(0)`), folded it into the section `v-for` template `:key` (`` `${group.key}-${slotRenderNonce}` ``), and at the end of `onSlotSortEnd` — immediately after the reactive `localService.value.slots = reindexed` reassignment — call `destroySectionSortables()` then `slotRenderNonce.value += 1`. The bump gives every section fragment a fresh key, so Vue discards and rebuilds each ref-bearing section-list container `<div>` (and any node SortableJS orphaned inside it) from reactive state. The reactive move logic, the `evt.oldDraggableIndex`/`evt.newDraggableIndex` reads, and the per-section Sortable architecture are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Nonce moved from the container `<div>` to the `<template v-for>` key**
- **Found during:** Task 2
- **Issue:** The plan specified adding `:key="`${group.key}-${slotRenderNonce}`"` to the section-list container `<div>` at line ~837. The Vue SFC compiler rejects this: `<template v-for> key should be placed on the <template> tag`. A `:key` on a child element of a `<template v-for>` is a hard compile error.
- **Fix:** Folded the nonce into the existing outer `<template v-for="group in slotSectionGroups">` key instead. This is functionally equivalent for R110 — a bump still discards and rebuilds the entire section fragment (header + add-menu + the ref-bearing container), reclaiming the orphan from state. `group.key` alone still uniquely identifies each section between bumps, so cross-section identity/ordering is unchanged.
- **Files modified:** src/views/ServiceEditorView.vue
- **Commit:** 9440e24

**2. [Rule 1 — Bug / Rule 2 — Missing critical functionality] Added `destroySectionSortables()` before the nonce bump**
- **Found during:** Task 2 (design analysis + the added architecture-unchanged guard assertion)
- **Issue:** The plan asserted the existing ref-callback teardown/recreate would "re-bind the section Sortable onto the rebuilt container" automatically. It does not. The lifecycle watcher (`ServiceEditorView.vue:~1971`) only creates a Sortable when `!sectionSortables.has(key)`. When the container element is recreated by the nonce, the ref callback fires null-then-newEl within one flush, so the `sectionListEls` map ends pointing at the new element while `sectionSortables` still holds the stale instance bound to the discarded element. The watcher's create condition (`el && !has`) is therefore false and its destroy condition (`!el && has`) is also false — so it does nothing, leaving the rebuilt container with **no** Sortable (drag goes dead after one cross-section drag). This exactly mirrors why SlideGrid.vue pairs its `gridRenderNonce` bump with `destroySortable()`.
- **Fix:** Call the existing `destroySectionSortables()` (clears the map + destroys instances) immediately before the nonce bump, so after the rebuild the watcher re-creates a fresh Sortable on every current container element. Verified by a dedicated guard assertion in the RED/GREEN test: `sortableCaptures.some(c => c.el === currentWorshipContainer)` must hold after the drag.
- **Files modified:** src/views/ServiceEditorView.vue, src/views/__tests__/ServiceEditorView.test.ts
- **Commit:** 9440e24 (fix), 07a5a1c (guard assertion committed with the RED test)

## Verification

- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — **261/261 pass** (the R110 repro now GREEN; every pre-existing reorder test still passes, including same-section reorder, the CR-01 overlapping-drag regression, and Sortable teardown-on-unmount).
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) — **clean**.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — the only red is the documented 2-file baseline: `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation — environment, and no emulator was running) and `src/views/__tests__/RosterView.test.ts` (stale assertion). No regression introduced; this plan's changes are entirely client-side and unrelated to both.

## Scope notes

- **In scope, done:** R110 in the **live** service plan editor (`ServiceEditorView.vue`) only, per this plan's frontmatter (`requirements: [R110]`, `files_modified: ServiceEditorView.vue` + its test).
- **Out of scope (other Phase 51 plans):** R110 in the default-template editor (`ServiceTemplateEditor.vue`), R111 (the `updateService` `stripUndefined` funnel fix), and R112 (read-surface ordering in `ServiceCard.vue`/`buildServiceSnapshot`). SlideGrid.vue was confirmed by 51-RESEARCH to be structurally immune to the R110 class (single Sortable, no cross-container `group`) — no change.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: src/views/ServiceEditorView.vue (modified — `slotRenderNonce` ref, template key, onSlotSortEnd bump)
- FOUND: src/views/__tests__/ServiceEditorView.test.ts (modified — R110 repro test)
- FOUND commit 07a5a1c (RED test)
- FOUND commit 9440e24 (GREEN fix)
