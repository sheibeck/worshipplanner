---
phase: 18-song-lyric-slides-and-editor
plan: 02
status: complete
requirements: [R017]
commits:
  - d5d7947 feat(M001-S01-T02): extract useAutoSave composable from ServiceEditorView pattern
key-files:
  created:
    - src/composables/useAutoSave.ts
    - src/composables/__tests__/useAutoSave.test.ts
---

# Phase 18 Plan 02: Auto-Save Composable Extraction — Summary

**COMPLETE.** Extracted the 800ms debounced auto-save pattern from `ServiceEditorView.vue` (lines ~1295-1347) into a reusable `useAutoSave` composable so both the service editor and the new lyric editor can share it.

## What Was Built

- **`src/composables/useAutoSave.ts`** — accepts a `watchSource`, an async `saveFn`, and options (`debounceMs`, default 800). Exposes a reactive `status` ref cycling `'idle' | 'pending' | 'saving' | 'saved'`. It deep-watches the source, skips the first (initialization) trigger, sets `pending` on change and resets the debounce timer, guards against concurrent in-flight saves (reschedules if a save is running), and after a successful save transitions `saving → saved → idle` (fading after 3s). Exposes `flush()` to force an immediate save and `cleanup()` to clear timers; accepts an optional `isDirty` computed to skip saving when clean.

Per the plan, `ServiceEditorView` was NOT refactored to consume the composable in this plan — extraction only, to keep the change surface small.

## Verification

`npx vitest run src/composables/__tests__/useAutoSave.test.ts` — 20 tests pass, using `vi.useFakeTimers()`: debounce collapses rapid changes into one save, the in-flight guard prevents concurrent saves, status transitions are asserted end to end, `flush()` bypasses the debounce, `cleanup()` clears pending timers, and saves are skipped when `isDirty` is false. Confirmed at phase UAT.
