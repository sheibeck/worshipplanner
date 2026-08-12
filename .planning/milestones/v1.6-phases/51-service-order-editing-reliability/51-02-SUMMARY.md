---
phase: 51-service-order-editing-reliability
plan: 02
subsystem: service-template-editor
tags: [R110, sortablejs, vue-dom-ownership, drag-reorder, reliability, default-template]
requires:
  - "ServiceTemplateEditor.vue per-section SortableJS architecture (Phase 44 Plan 02, ported from ServiceEditorView.vue)"
  - "slotTypes.ts ordering contract (groupBySection/flattenBySection)"
  - "51-01 slotRenderNonce container-rebuild pattern (proven in the live editor)"
provides:
  - "R110 fix (default-template editor half): cross-section drag leaves exactly one rendered item, no phantom"
  - "templateRenderNonce container-rebuild pattern in ServiceTemplateEditor — both editors now share one mechanism"
affects:
  - src/components/settings/ServiceTemplateEditor.vue
  - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
tech-stack:
  added: []
  patterns:
    - "destroy-then-nonce container rebuild to reclaim Sortable-orphaned DOM (SlideGrid → ServiceEditorView → ServiceTemplateEditor)"
key-files:
  created: []
  modified:
    - src/components/settings/ServiceTemplateEditor.vue
    - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
decisions:
  - "Applied 51-01's proven nonce-keyed container rebuild verbatim to the template editor — both editors now share one mechanism, no shared helper extracted (nonce is component-local state, unsuited to extraction; CONTEXT: extract only if it reduces risk)."
  - "Nonce rides the section v-for template :key, not the container <div> :key — Vue forbids :key on a child of <template v-for> (51-01 compile-error lesson)."
  - "Paired the nonce bump with destroySectionSortables() — required, not belt-and-braces: the watcher's sectionSortables.has(key) create-gate leaves rebuilt containers drag-dead otherwise (51-01 lesson)."
metrics:
  duration: ~12 min
  completed: 2026-08-11
status: complete
---

# Phase 51 Plan 02: R110 Cross-Section Drag Phantom (Default-Template Editor) Summary

Fixed R110 in the default-service-template editor (`ServiceTemplateEditor.vue`): a cross-section drag no longer spawns a second, handler-less "No Section" copy of the dragged item. The editor ports `ServiceEditorView.vue`'s per-section SortableJS reorder byte-for-byte, so it carried the identical SortableJS↔Vue DOM-ownership desync the live editor had. The reactive move logic was already correct; the fix forces Vue to rebuild the Sortable-mutated section containers from state via a render nonce, reclaiming the orphaned node without a page refresh — the same mechanism 51-01 proved in the live editor.

## What was built

**Task 1 (RED — `test(51-02)`, commit `21f3b2c`):** Added a DOM-mutating cross-section drag repro to `ServiceTemplateEditor.test.ts`. The module's `sortablejs` mock only captures options and never relocates a node (51-RESEARCH Pitfall 1), so an `onEnd`-only test is false-GREEN on buggy code — the existing cross-section test at line 415 already passed because it only asserts on the (correct) reactive render. The new test physically detaches the dragged `[data-entry-id="song-1"]` row from the ungrouped ("No Section") container and appends it into the worship container **before** invoking the captured `onEnd`, mirroring real SortableJS. It then asserts on rendered node counts: zero rows for the moved id left in the source list, and **exactly one** `[data-entry-id="song-1"]` tree-wide. Committed RED (`expected 2 to be 1` — the phantom).

**Task 2 (GREEN — `fix(51-02)`, commit `fcca4c0`):** Added `templateRenderNonce` (a component-local `ref(0)`), folded it into the section `v-for` template `:key` (`` `${group.key}-${templateRenderNonce}` ``), and at the end of `onTemplateSortEnd` — immediately after the reactive `draft.value = flattenBySection(grouped)` reassignment — call `destroySectionSortables()` then `templateRenderNonce.value += 1`. The bump gives every section fragment a fresh key, so Vue discards and rebuilds each ref-bearing section-list container `<div>` (and any node SortableJS orphaned inside it) from reactive state; the `flush: 'post'` watcher then re-binds a fresh Sortable onto each rebuilt container. The reactive move logic, the `evt.oldDraggableIndex`/`evt.newDraggableIndex` reads, the per-section Sortable architecture, and the save-time `stripUndefined(draft.value)` (line 442) are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Nonce placed on the `<template v-for>` key, not the container `<div>` key**
- **Found during:** Task 2
- **Issue:** The plan (frontmatter + Task 2 action) specified adding the nonce-bearing `:key` to the section-list container `<div>` at line 70. The Vue SFC compiler rejects a `:key` on a child element of a `<template v-for>` — it is a hard compile error (`<template v-for> key should be placed on the <template> tag`). 51-01 hit and documented the identical constraint in the live editor.
- **Fix:** Folded the nonce into the existing outer `<template v-for="group in sectionGroups">` key at line 55 instead. Functionally equivalent for R110 — a bump discards and rebuilds the entire section fragment (header + container + rows), reclaiming the orphan from state. `group.key` alone still uniquely identifies each section between bumps, so cross-section identity/ordering is unchanged.
- **Files modified:** src/components/settings/ServiceTemplateEditor.vue
- **Commit:** fcca4c0

**2. [Rule 2 — Missing critical functionality] Paired the nonce bump with `destroySectionSortables()`**
- **Found during:** Task 2
- **Issue:** The plan's Task 2 asserted the existing ref-callback teardown/recreate would "re-bind the section Sortable onto the rebuilt container automatically." It does not. The lifecycle watcher (ServiceTemplateEditor.vue:363-399) only creates a Sortable when `el && !sectionSortables.has(key)`. When the nonce recreates the container element, the ref callback runs null-then-newEl within one flush, so `sectionListEls` points at the new element while `sectionSortables` still holds the stale instance bound to the discarded element — the create condition is false and the destroy condition (`!el && has`) is also false, so the watcher does nothing and the rebuilt container is left drag-dead after one cross-section drag. This is the exact failure mode 51-01 documented for the live editor, and why SlideGrid.vue pairs its `gridRenderNonce` bump with `destroySortable()`.
- **Fix:** Call the existing `destroySectionSortables()` (clears the map + destroys instances) immediately before the nonce bump, so after the rebuild the `flush: 'post'` watcher re-creates a fresh Sortable on every current container element.
- **Files modified:** src/components/settings/ServiceTemplateEditor.vue
- **Commit:** fcca4c0

## Verification

- `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — **21/21 pass** (the R110 repro now GREEN; every pre-existing test still passes, including same-section reorder and the existing cross-section section-field-update test). The one stderr line is the deliberate `console.error` from the pre-existing rejected-save test, not a regression.
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) — **clean**.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — **2991/3004 pass**; the only red is the documented 2-file baseline: `src/storage.rules.test.ts` (12 failures — Storage-emulator cross-service `firestore.exists()` limitation, and no emulator was running) and `src/views/__tests__/RosterView.test.ts` (1 failure — stale "Roles config" assertion). No regression introduced; this plan's changes are entirely client-side and confined to the template editor.

## Scope notes

- **In scope, done:** R110 in the **default-template** editor (`ServiceTemplateEditor.vue`) only, per this plan's frontmatter (`requirements: [R110]`). Both editors now share one proven nonce-rebuild mechanism.
- **Out of scope (other Phase 51 plans):** R111 (the `updateService` `stripUndefined` funnel fix) and R112 (read-surface ordering in `ServiceCard.vue`/`buildServiceSnapshot`). No shared helper was extracted — the nonce is component-local state, unsuited to extraction (CONTEXT locked decision).

## Threat Flags

None — no new security surface. The reactive move logic and the save-time `stripUndefined` are untouched; the fix only re-renders from already-correct client state and never crosses into the persisted `OrgSettings.defaultServiceTemplate`.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: src/components/settings/ServiceTemplateEditor.vue (modified — templateRenderNonce ref, template key, onTemplateSortEnd destroy+bump)
- FOUND: src/components/settings/__tests__/ServiceTemplateEditor.test.ts (modified — R110 DOM-mutating repro test)
- FOUND commit 21f3b2c (RED test)
- FOUND commit fcca4c0 (GREEN fix)
