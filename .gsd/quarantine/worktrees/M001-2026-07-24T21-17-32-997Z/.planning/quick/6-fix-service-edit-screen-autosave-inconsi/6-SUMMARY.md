---
phase: quick-6
plan: "01"
subsystem: service-editor
tags: [autosave, race-condition, drag-and-drop, concurrency]
dependency_graph:
  requires: []
  provides: [serial-autosave, drag-safe-debounce]
  affects: [ServiceEditorView]
tech_stack:
  added: []
  patterns: [inflight-guard, debounce-reschedule]
key_files:
  modified:
    - src/views/ServiceEditorView.vue
decisions:
  - autosaveSaving is a plain boolean (not a ref) — it is a synchronous mutex, not reactive UI state
  - Reschedule uses a 200ms delay when inflight (not the full 800ms) to minimise perceived save lag after the first save completes
  - scheduleAutosave extracted as a named inner function so the timeout callback can self-reference without arguments
metrics:
  duration: "5 minutes"
  completed: "2026-03-12"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 6: Fix Service Editor Autosave Race Condition — Summary

**One-liner:** Serialises autosave calls with an inflight boolean guard and increases debounce to 800ms so rapid drag sequences always persist their final slot order.

## What Was Done

### Task 1: Add inflight guard and increase debounce to prevent concurrent saves

Fixed two interacting problems in the autosave watcher in `ServiceEditorView.vue`:

**Problem 1 — Concurrent saves:** `onSave()` is async and was called while a prior invocation was still awaiting Firestore writes. Because `assignSongToSlot` runs in a loop before `updateService`, a second overlapping call's `updateService` could resolve after the first, overwriting the final drag state with an intermediate slot order.

**Fix:** Added `autosaveSaving` boolean flag at module scope (line 871). The debounce callback checks the flag before calling `onSave()`. If a save is already in flight, `scheduleAutosave()` recursively re-schedules a 200ms retry instead of running concurrently. The `finally` block always resets the flag.

**Problem 2 — Debounce too short:** The 500ms window allowed a second drag to begin before the first save fired, creating interleaved state.

**Fix:** Increased debounce delay from 500ms to 800ms.

**Cleanup:** `autosaveSaving = false` added to `onUnmounted` to prevent a stale `true` value if the component is destroyed during a save.

**Commit:** `a6aebc6`

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the pseudocode in the plan, with `scheduleAutosave` extracted as a named inner function (cleaner than the plan's `/* same callback */` comment approach).

## Verification

- Automated: `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 3/3 tests passed
- Manual verification steps documented in plan (drag slot, quickly drag again, refresh — both positions preserved)

## Self-Check: PASSED

- `src/views/ServiceEditorView.vue` modified with all three changes
- Commit `a6aebc6` exists in git log
- `autosaveSaving` flag declared at line 871
- Debounce delay is 800ms (line 1097)
- `autosaveSaving = false` in `onUnmounted` (line 1139)
