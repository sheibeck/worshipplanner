---
phase: 18-song-lyric-slides-and-editor
plan: 06
status: complete
requirements: [R003, R018]
commits:
  - ae6a45b test: Performance Order Builder with drag-and-drop reorder, section add/repeat/reset
key-files:
  created:
    - src/components/PerformanceOrderBuilder.vue
    - src/components/__tests__/PerformanceOrderBuilder.test.ts
---

# Phase 18 Plan 06: Performance Order Builder — Summary

**COMPLETE.** Built the drag-and-drop performance-order builder supporting section repeats (R003).

## What Was Built

- **`src/components/PerformanceOrderBuilder.vue`** — props `sections` (available parsed sections) and `performanceOrder` (current order); emits `update:performanceOrder`. Left panel lists available section labels as clickable chips (clicking appends to the order; a section can be added multiple times for repeats like a chorus recurring 3×). Right panel is the ordered list with per-item label, drag handle, and remove button. SortableJS drives reordering, following the `ServiceEditorView` pattern exactly — the SortableJS DOM move is reverted in `onEnd` and the reactive array is updated so Vue's render stays the single source of truth (avoids the snap-back bug). Every add/remove/reorder emits the new id array. A "Reset to Default" button restores each section once in definition order. Dark-first styling.

## Verification

`npx vitest run src/components/__tests__/PerformanceOrderBuilder.test.ts` — 8 tests pass: adding a section, adding repeats, removing, reset-to-default, empty-state handling, and `update:performanceOrder` emission on change. Confirmed at phase UAT.
