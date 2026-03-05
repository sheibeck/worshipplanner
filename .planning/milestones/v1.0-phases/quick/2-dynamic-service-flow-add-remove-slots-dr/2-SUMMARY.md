---
phase: quick-2
plan: 01
subsystem: service-editor
tags: [dynamic-slots, sortablejs, drag-drop, service-flow]
dependency_graph:
  requires: []
  provides: [dynamic-slot-add-remove, sortablejs-drag-drop, slot-kind-labels]
  affects: [ServiceEditorView, ServicePrintLayout, ShareView, planningCenterExport, slotTypes]
tech_stack:
  added: [sortablejs, "@types/sortablejs"]
  patterns: [array-index-lookup, kind-based-labels, factory-function, reindex-normalization]
key_files:
  created: []
  modified:
    - src/utils/slotTypes.ts
    - src/utils/planningCenterExport.ts
    - src/stores/services.ts
    - src/views/ServiceEditorView.vue
    - src/components/ServicePrintLayout.vue
    - src/views/ShareView.vue
    - src/utils/__tests__/slotTypes.test.ts
    - src/utils/__tests__/planningCenterExport.test.ts
    - src/views/__tests__/ShareView.test.ts
    - package.json
decisions:
  - "slotLabel() replaces SLOT_LABELS: kind-based labels work for any-length slot arrays"
  - "createSlot() factory defaults Song vwType to 2 (intimate) as specified"
  - "reindexSlots() normalizes positions after every add/remove/reorder operation"
  - "Sortable onEnd updates reactive array then lets Vue reconcile (no manual DOM sync needed)"
  - "onSave uses global songId set comparison for lastUsedAt tracking after slots are reordered"
  - "planningCenterExport uses sequential Song 1/2/3 numbering (position-agnostic)"
  - "VW type selector shown inline on song slots as pill buttons (1/2/3)"
metrics:
  duration_minutes: 14
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 10
---

# Quick Task 2: Dynamic Service Flow (Add/Remove Slots) Summary

**One-liner:** Dynamic service editor with sortablejs drag-to-reorder, per-slot add/remove, VW type selector, and kind-based slot labels replacing the fixed 9-position lookup map.

## What Was Built

### Task 1: Slot Model and Utility Layer

Refactored `slotTypes.ts` to support dynamic slot arrays:

- **`slotLabel(slot, index)`** — kind-based label function replacing the old `SLOT_LABELS` position-keyed map. Returns "Song", "Scripture Reading", "Prayer", or "Message" based on `slot.kind`.
- **`createSlot(kind, vwType?)`** — factory function creating a new slot of any kind. Song slots default to VW type 2.
- **`reindexSlots(slots)`** — normalizes `position` field to match array index after any mutation.
- **`buildSlots()`** — unchanged, still produces the default 9-slot template for new services.
- **`SLOT_LABELS`** removed.

Updated `planningCenterExport.ts`:
- Removed `SLOT_EXPORT_LABELS` position-keyed map.
- Song slots now numbered sequentially ("Song 1", "Song 2", etc.) regardless of position.

Updated `stores/services.ts`:
- `assignSongToSlot()` and `clearSongFromSlot()` changed from position lookup to array index.

### Task 2: Dynamic Editor UI

**ServiceEditorView.vue** — major update:
- Slot container has `ref="slotContainerRef"` for Sortable initialization.
- Each slot card wrapped in `flex items-start gap-2` with drag handle (left) and remove X button (right).
- Drag handle uses `.drag-handle` CSS class; Sortable initializes on `watch(slotContainerRef, ...)`.
- `onEnd` callback moves the slot in the reactive array and calls `reindexSlots`.
- **"Add Element" dropdown** at bottom with options: Song Type 1/2/3, Scripture Reading, Prayer, Message.
- **VW type selector** (1/2/3 pill buttons) on each Song slot for changing `requiredVwType` inline.
- Song handlers `onSelectSong`, `onClearSong`, `onScriptureChange` updated to use array index.
- Save logic uses global songId set comparison (old vs. new) to detect newly assigned songs for `lastUsedAt` updates — position-independent after reorder.

**ServicePrintLayout.vue** — uses `slotLabel(slot, index)` instead of `SLOT_LABELS[slot.position]`.

**ShareView.vue** — uses `slotLabel(slot, index)` instead of `SLOT_LABELS[slot.position]`.

**ServiceCard.vue** — no changes needed (already uses kind-based local `slotLabel` function).

## Test Results

- 231 tests passing (16 test files)
- TypeScript type check clean for all modified files
- All new utility functions tested: `createSlot`, `reindexSlots`, `slotLabel` (29 slotTypes tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated planningCenterExport tests to match new label format**
- **Found during:** Task 2 test run
- **Issue:** Two tests expected old format `Song 1 (Call to Worship)` but new export uses `Song 1`
- **Fix:** Updated test assertions to `Song 1 --` format
- **Files modified:** `src/utils/__tests__/planningCenterExport.test.ts`
- **Commit:** ef900a0

**2. [Rule 1 - Bug] Updated ShareView test mock from SLOT_LABELS to slotLabel**
- **Found during:** Task 2 test run
- **Issue:** ShareView.test.ts mocked `@/utils/slotTypes` with `SLOT_LABELS` only; view now imports `slotLabel`
- **Fix:** Updated mock to provide `slotLabel` function
- **Files modified:** `src/views/__tests__/ShareView.test.ts`
- **Commit:** ef900a0

**3. [Rule 2 - Missing critical functionality] Fixed TypeScript type safety in date parsing**
- **Found during:** Build verification
- **Issue:** `date.split('-').map(Number)` destructuring yields `(number | undefined)[]` in strict mode
- **Fix:** Used index access with `?? 0` fallbacks in `planningCenterExport.ts` and `ServicePrintLayout.vue`
- **Files modified:** `src/utils/planningCenterExport.ts`, `src/components/ServicePrintLayout.vue`
- **Commit:** ef900a0

**4. [Rule 2 - Missing critical functionality] Fixed PROGRESSION_SLOT_TYPES index access type**
- **Found during:** Build verification
- **Issue:** `songTypeMap[position]` returns `VWType | undefined` but `SongSlot.requiredVwType` expects `VWType`
- **Fix:** Added `as VWType` cast since map is defined with known keys
- **Files modified:** `src/utils/slotTypes.ts`
- **Commit:** ef900a0

## Self-Check

Files created/modified verification:
- `src/utils/slotTypes.ts` — FOUND
- `src/utils/planningCenterExport.ts` — FOUND
- `src/stores/services.ts` — FOUND (committed in Task 1)
- `src/views/ServiceEditorView.vue` — FOUND
- `src/components/ServicePrintLayout.vue` — FOUND
- `src/views/ShareView.vue` — FOUND
- `src/utils/__tests__/slotTypes.test.ts` — FOUND
- `package.json` (sortablejs) — FOUND

Commits:
- 42b57e7 — Task 1 (slot model refactor)
- ef900a0 — Task 2 (dynamic editor + downstream views)

## Self-Check: PASSED
