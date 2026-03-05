---
phase: quick-14
plan: 14
subsystem: service-editor
tags: [autosave, undo, ux, debounce]
dependency_graph:
  requires: []
  provides: [autosave, one-step-undo, autosave-status-indicator]
  affects: [ServiceEditorView]
tech_stack:
  added: []
  patterns: [debounced-watcher, snapshot-undo, vue3-keyboard-shortcut]
key_files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
decisions:
  - autosave debounce is 1500ms — balances responsiveness with Firestore write frequency
  - autosaveInitialized flag prevents first-load watch trigger from firing a save
  - Ctrl+Z bypassed when focus is INPUT/TEXTAREA so browser text undo still works
  - previousService snapshot taken immediately before each autosave (not after) to enable true undo of that save
  - onUndo clears autosaveTimer so undo does not immediately re-trigger autosave
metrics:
  duration_minutes: 8
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 1
---

# Quick Task 14: Autosave to Service Editor with One-Step Undo Summary

**One-liner:** Debounced 1.5s autosave with snapshot-based undo, status indicator (Saving soon / Saving... / Saved), and Ctrl+Z / Undo button in the service editor header.

## What Was Built

Added autosave to `ServiceEditorView.vue` so planners never lose work. Every change is persisted to Firestore automatically 1.5 seconds after the last keystroke. A one-layer undo allows reverting the last autosave via either the Undo button in the header or Ctrl+Z (when focus is outside a text input).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add autosave state, debounced watcher, undo function, Ctrl+Z handler | 8e18d4d |
| 2 | Add autosave status indicator and Undo button to header template | 6a5f861 |

## Implementation Details

### Autosave State

Added to the "Local state" block after `isSaving`:

- `previousService` — deep copy snapshot taken before each save, used by `onUndo()`
- `autosaveStatus` — `'idle' | 'pending' | 'saving' | 'saved'` drives the header indicator
- `autosaveTimer` — holds the debounce `setTimeout` handle
- `autosaveInitialized` — flag that suppresses the first watch trigger on initial load

### Debounced Watcher

A `watch(localService, ..., { deep: true })` fires on every change. It:
1. Skips if service not yet loaded or `isDirty` is false
2. Skips the first trigger (first-load suppression via `autosaveInitialized`)
3. Sets status to `'pending'`, cancels any existing timer
4. After 1500ms: snapshots current state into `previousService`, sets `'saving'`, calls `onSave()`, sets `'saved'`
5. After 3 more seconds: fades indicator back to `'idle'`

### Undo

`onUndo()` restores `previousService` into `localService`, clears the snapshot and any pending timer. The service editor watcher will fire again from the restored state — since `autosaveInitialized` is already true, it will schedule another autosave 1.5s later (re-saving the undone state).

### Ctrl+Z

A `keydown` listener is registered in `onMounted` and cleaned up via `onUnmounted`. It skips `INPUT`/`TEXTAREA` targets so browser text-level undo is unaffected.

### Header Indicator

Replaced the static `<span v-if="isDirty">Unsaved changes</span>` with a priority cascade:
1. `'pending'` or `'saving'` → italic gray "Saving soon..." / "Saving..."
2. `'saved'` → green "Saved"
3. `isDirty` fallback → amber "Unsaved changes" (covers edge cases where autosave hasn't fired yet)

The Undo button (`v-if="previousService"`) appears in the header only after a successful autosave.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/views/ServiceEditorView.vue` modified with all required additions
- [x] `previousService`, `autosaveStatus`, debounced watcher, `onUndo()` all present
- [x] Ctrl+Z handler registered in onMounted / cleaned up in onUnmounted
- [x] Header template updated with status indicator and Undo button
- [x] TypeScript compiles with no new errors (`npx vue-tsc --noEmit` clean)
- [x] Task 1 commit: 8e18d4d
- [x] Task 2 commit: 6a5f861
