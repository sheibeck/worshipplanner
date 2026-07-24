---
estimated_steps: 21
estimated_files: 2
skills_used: []
---

# T02: Auto-Save Composable Extraction

Extract the auto-save debounce pattern from ServiceEditorView into a reusable composable.

1. Create src/composables/useAutoSave.ts:
   - Accept generic parameters: watchSource (WatchSource), saveFn (async callback), options (debounceMs: number, default 800)
   - Expose reactive status ref: 'idle' | 'pending' | 'saving' | 'saved'
   - Implement the same pattern as ServiceEditorView lines 1295-1347:
     - Deep watcher on watchSource
     - Skip first trigger (initialized guard)
     - Set status to 'pending' on change, clear and reset debounce timer
     - Inflight guard prevents concurrent saves (if saving, reschedule)
     - On timer fire: call saveFn, set status 'saving' -> 'saved' -> fade to 'idle' after 3s
   - Expose: status (ref), flush() to force immediate save, cleanup() to clear timers
   - Accept optional isDirty computed to skip save when clean

2. Create src/composables/__tests__/useAutoSave.test.ts:
   - Test debounce: rapid changes result in single save after debounce period
   - Test inflight guard: concurrent saves are prevented
   - Test status transitions: idle -> pending -> saving -> saved -> idle
   - Test flush: forces immediate save bypassing debounce
   - Test cleanup: clears pending timers
   - Test skip when isDirty is false
   - Use vi.useFakeTimers() for timer control

Note: Do NOT refactor ServiceEditorView to use this composable in this task.

## Inputs

- `src/views/ServiceEditorView.vue`

## Expected Output

- `src/composables/useAutoSave.ts`
- `src/composables/__tests__/useAutoSave.test.ts`

## Verification

npx vitest run src/composables/__tests__/useAutoSave.test.ts --reporter=verbose
