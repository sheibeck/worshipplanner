---
phase: 11-song-catalog-service-planner-improvements
plan: "02"
subsystem: service-editor
tags: [drag-drop, autosave, confirmation-modal, ai-suggestions, data-integrity]
dependency_graph:
  requires: []
  provides: [snap-back-fix, immediate-reorder-save, stuck-dirty-guard, slot-delete-confirm, preview-close-decoupled, ai-hidden-filter]
  affects: [src/views/ServiceEditorView.vue, src/components/ScriptureInput.vue]
tech_stack:
  added: []
  patterns: [sortablejs-vue-dom-reconciliation, immediate-persist-pattern, confirmation-gate-pattern]
key_files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/components/ScriptureInput.vue
decisions:
  - "onEnd reverts SortableJS DOM move via insertBefore before mutating reactive slots — Vue is single source of truth for ordering (D-16)"
  - "autosaveTimer = null set as first statement in setTimeout callback so re-arm guard is always reachable (D-17)"
  - "Immediate updateService call in onEnd (not via debounce) with originalService reset — clears isDirty on reorder (D-15)"
  - "isSlotPopulated covers SONG/SCRIPTURE/PRAYER/MESSAGE/HYMN — only PRAYER and MESSAGE with linkUrl or linkLabel are gated (content-bearing state)"
  - "ServiceSlot type added to service type imports for isSlotPopulated parameter type"
metrics:
  duration_minutes: 25
  completed_date: "2026-07-01"
  tasks_completed: 3
  files_modified: 2
---

# Phase 11 Plan 02: Service Editor Reliability Fixes Summary

**One-liner:** Five data-integrity defects fixed: SortableJS snap-back (DOM revert), immediate reorder-save, stuck-dirty autosave re-arm, populated-slot delete confirmation modal, and AI hidden-song exclusion in both call sites.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix AI hidden-song leak (D-18) | e54d0cb | src/views/ServiceEditorView.vue |
| 2 | Fix snap-back, immediate reorder-save, stuck-dirty (D-16/D-15/D-17) | 705d1a5 | src/views/ServiceEditorView.vue |
| 3 | Delete confirmation modal, decouple preview-close (D-14/D-13) | c7cfa72 | src/views/ServiceEditorView.vue, src/components/ScriptureInput.vue |

## What Was Built

### Task 1 — AI Hidden-Song Leak Fix (D-18)

Both `suggestAllSongs()` and `fetchAiForSlot()` were building their song library directly from `songStore.songs`, which includes soft-deleted (hidden) songs. Both call sites now build a `base` from `songs.filter((s) => !s.hidden)` and apply the orchestra filter on top of that. `songStore.filteredSongs` was deliberately avoided because it also applies the UI search/type filters, which is wrong for AI.

### Task 2 — Snap-Back, Immediate Reorder-Save, Stuck-Dirty (D-16/D-15/D-17)

**D-16 (snap-back):** SortableJS physically moves the DOM node on drag end, then Vue re-renders from the reactive array — the two orderings fight and cause snap-back. The `onEnd` handler now reverts SortableJS's DOM move via `insertBefore` before mutating `localService.value.slots`, so Vue's reactive render is the single source of truth.

**D-15 (immediate save):** `onEnd` is now `async` and calls `serviceStore.updateService(serviceId.value, { slots: reindexed })` immediately after reindex. It then resets `originalService.value` to the new state, which clears `isDirty` so the save button doesn't stay highlighted.

**D-17 (stuck-dirty):** The `setTimeout` callback body now sets `autosaveTimer = null` as its very first statement — this makes the `autosaveTimer === null` re-arm condition always reachable after a timer fires. The autosave watcher now always marks status as `pending` and re-arms the timer when `isDirty` is true, including when the timer was cleared by the D-15 immediate save path.

**v-for key:** The slot list's `:key` was changed from `slot.position + '-' + slot.kind + '-' + index` to `slot.kind + '-' + slot.position` (no array index), so Vue's reconciliation correctly matches moved nodes after a reorder.

### Task 3 — Delete Confirmation Modal and Preview-Close Decoupling (D-14/D-13)

**D-14 (confirmation gate):** `removeSlot` now calls `isSlotPopulated(slot)` — populated slots set `pendingDeleteIndex` and `showSlotDeleteConfirm = true`; empty slots delete silently. The same gate applies to `onClearSong` for SONG slots with an assigned `songId`. A second Teleport modal bound to `showSlotDeleteConfirm` has a Cancel button (resets state) and a red Remove button (calls `confirmSlotDelete()`). `performRemoveSlot()` contains the original splice+reindex logic.

**D-13 (preview-close isolation):** `ScriptureInput.vue`'s dismiss-preview `×` button was changed to `@click.stop="dismissPreview"` to prevent any event bubbling. The preview dismiss and the slot delete X button are entirely separate elements with no shared handler — closing a preview only dismisses the preview.

## Decisions Made

1. `autosaveTimer = null` added as first statement in the `setTimeout` callback — not as an inference but as an explicit load-bearing assignment enabling the re-arm guard
2. Orchestra filter in AI applies to the non-hidden `base`, not raw `songStore.songs`
3. `isSlotPopulated` covers PRAYER/MESSAGE only when they have populated `linkUrl` or `linkLabel` — empty PRAYER/MESSAGE slots (most common) delete silently
4. `pendingDeleteIsClear` distinguishes "clear song from slot" vs "remove slot entirely" so `confirmSlotDelete` routes correctly
5. `ServiceSlot` union type added to the existing service type import (was absent, used in `isSlotPopulated` parameter)

## Deviations from Plan

None — plan executed exactly as written. The `pendingDeleteIsClear` ref is a minor implementation detail not explicitly in the plan, added to correctly handle the two confirmation routes (clear-song vs remove-slot) through a single modal.

## Human Verification Needed

The following items require manual testing in the running app (`npm run dev`):

| # | Step | Expected Behavior |
|---|------|-------------------|
| 1 | Open a service with 4+ slots; drag slot from position 1 to position 3 | Slot STAYS at position 3 — no snap-back to position 1 (D-16) |
| 2 | After drag, immediately (within ~1s) refresh the page | New order persists — slot is still at position 3 (D-15 immediate save) |
| 3 | Drag a slot, then quickly click another slot or element | Save-button highlight clears on its own within ~3s — not stuck dirty (D-17) |
| 4 | On a slot with an assigned song, click the red X delete button | A confirmation modal appears asking "Remove this item?" |
| 5 | In the confirmation modal, click Cancel | Modal closes; song assignment remains (no accidental delete) |
| 6 | Click delete X again on the populated slot, then click Remove | Slot is removed from the service plan |
| 7 | On an EMPTY slot (no song/scripture assigned), click the delete X | Slot removes immediately with NO confirmation modal (silent delete per D-14) |
| 8 | Open a scripture slot, show its passage preview, then click the × to close preview | Slot is NOT deleted — only the passage preview panel closes (D-13) |

## Known Stubs

None — all changes wire to real data paths.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The slot delete confirmation (`T-11-04`) and preview-close isolation (`T-11-05`) mitigations from the plan's threat register are now implemented. The immediate reorder-save (`T-11-06`) reuses the existing `updateService` path with existing Firestore org-ownership rules. The autosave inflight guard fix (`T-11-07`) prevents the self-inflicted "save never fires" deadlock.

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/components/ScriptureInput.vue
- FOUND: .planning/phases/11-song-catalog-service-planner-improvements/11-02-SUMMARY.md
- FOUND commit: e54d0cb (Task 1 — AI hidden-song fix)
- FOUND commit: 705d1a5 (Task 2 — snap-back/immediate save/stuck-dirty)
- FOUND commit: c7cfa72 (Task 3 — delete confirmation/preview-close)
