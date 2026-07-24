---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
autonomous: true
requirements:
  - QUICK-6
must_haves:
  truths:
    - "Rapidly dragging multiple slots in succession always saves the final order"
    - "No stale intermediate slot order is ever persisted to Firestore"
    - "Concurrent saves cannot overlap — only one save runs at a time"
  artifacts:
    - path: "src/views/ServiceEditorView.vue"
      provides: "Autosave with concurrency guard and drag-flush mechanism"
      contains: "isSavingAutosave"
  key_links:
    - from: "Sortable onEnd handler"
      to: "autosave debounce timer"
      via: "localService.value.slots mutation triggers deep watch"
      pattern: "autosaveTimer"
    - from: "autosave debounce callback"
      to: "onSave"
      via: "single-inflight guard before async call"
      pattern: "isSavingAutosave"
---

<objective>
Fix the race condition in the service editor's autosave mechanism that causes rapid drag-and-drop operations to persist a stale or incorrect slot order.

Purpose: Dragging slots quickly (or multiple times in rapid succession) can produce out-of-order Firestore writes where an older save overwrites the final drag result. In the worst case a slot appears in a completely wrong position after save.

Output: A modified ServiceEditorView.vue where the autosave debounce always captures the latest slot state and concurrent saves are prevented via an inflight guard.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add inflight guard and increase debounce to prevent concurrent saves</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
There are two problems to fix:

**Problem 1 — No inflight guard:** `onSave` is async and can be called while a previous invocation is still awaiting Firestore writes. Both calls read `localService.value` at write time, but because `serviceStore.assignSongToSlot` runs in a loop before `updateService`, the second call's `updateService` can resolve after the first, overwriting the correct final state with an intermediate state.

**Fix:** Add a module-level `let autosaveSaving = false` flag (distinct from the existing `isSaving` ref which is for the manual Save button). In the debounce callback, if `autosaveSaving` is true, reschedule — restart the 500ms debounce and return immediately. This serialises saves without blocking the UI.

```typescript
// Replace the autosave watcher callback body with this pattern:
let autosaveSaving = false

// Inside the debounce setTimeout callback:
if (autosaveSaving) {
  // A save is already in flight — reschedule so this slot state gets saved
  autosaveTimer = setTimeout(/* same callback */, 200)
  return
}
autosaveSaving = true
autosaveStatus.value = 'saving'
try {
  await onSave()
  autosaveStatus.value = 'saved'
  setTimeout(() => {
    if (autosaveStatus.value === 'saved') autosaveStatus.value = 'idle'
  }, 3000)
} finally {
  autosaveSaving = false
}
```

**Problem 2 — Debounce too short for drag sequences:** 500ms is tight for human drag interactions. Users can initiate a second drag within that window. Increase the debounce delay from 500ms to 800ms. This gives enough buffer that a drag sequence (grab, drop, grab, drop) completes before the first save fires.

**Reset `autosaveSaving` on unmount** to prevent stale flag if component is destroyed mid-save:
```typescript
onUnmounted(() => {
  sortableInstance?.destroy()
  sortableInstance = null
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveSaving = false
})
```

Do NOT change the `isSaving` ref — it controls the manual Save button state and must remain separate.

Implement the above changes as a minimal targeted edit to the autosave watcher block (lines ~1052–1088) and the `onUnmounted` block (lines ~1121–1126).
  </action>
  <verify>
    <automated>npx vitest run src/views/__tests__/ServiceEditorView.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `autosaveSaving` flag declared at module scope alongside `autosaveTimer`
    - Debounce callback checks `autosaveSaving` and reschedules (200ms) if true
    - Debounce delay increased from 500ms to 800ms
    - `autosaveSaving` reset in `onUnmounted`
    - All existing tests pass
    - Manual test: drag slot to new position, quickly drag again — both changes visible in final saved state (no revert to earlier position)
  </done>
</task>

</tasks>

<verification>
After the fix, verify by manual interaction:
1. Open a service in the editor
2. Drag slot from position 1 to position 3
3. Immediately drag slot from position 2 to position 1 (within 800ms of first drag)
4. Wait ~2 seconds for "Saved" indicator
5. Refresh the page — both drag results should be preserved in their final order

Expected: Only one Firestore write completes (or if two fire, they are serialised so the second always wins with the post-second-drag state).
</verification>

<success_criteria>
- Rapid successive drags always result in the final user-intended slot order being persisted
- The "Saved" indicator appears and the page refresh confirms the correct order
- No concurrent `onSave` invocations possible — the inflight guard ensures serial execution
- Existing ServiceEditorView tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-service-edit-screen-autosave-inconsi/6-SUMMARY.md`
</output>
