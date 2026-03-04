---
phase: quick-14
plan: 14
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
autonomous: true
requirements: []
must_haves:
  truths:
    - "Changes to the service editor are saved automatically without clicking Save"
    - "A subtle indicator shows 'Saving...' while in flight and 'Saved' after completing"
    - "One undo step is available via Ctrl+Z or an Undo button that reverts the last autosave"
    - "The manual Save button still works and remains in the header"
    - "Autosave does not fire on every keystroke — it debounces 1.5 seconds after the last change"
  artifacts:
    - path: "src/views/ServiceEditorView.vue"
      provides: "Autosave logic, undo state, status indicator, Undo button/Ctrl+Z handler"
  key_links:
    - from: "autosave watch"
      to: "onSave()"
      via: "debounced watcher on localService with 1500ms timer"
      pattern: "setTimeout.*onSave|debounce.*onSave"
    - from: "undo button / Ctrl+Z"
      to: "previousService"
      via: "restore previousService into localService"
      pattern: "previousService\\.value"
---

<objective>
Add autosave to ServiceEditorView so the planner never loses work. Every change is saved automatically after a 1.5-second idle period. A one-layer undo allows reverting the last autosave in case of an accidental change.

Purpose: Remove save anxiety. The "Unsaved changes" prompt remains but is no longer critical — the service auto-saves anyway.
Output: Updated ServiceEditorView.vue with debounced autosave, undo state, status indicator, and Ctrl+Z/button undo.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/views/ServiceEditorView.vue
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add autosave state, debounce watcher, and undo function</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
    All changes are confined to `src/views/ServiceEditorView.vue`. Read the full file first.

    **1. Add new reactive state** (insert after the existing `isSaving` ref in the "Local state" block, around line 549):

    ```typescript
    // ── Autosave state ─────────────────────────────────────────────────────────────
    const previousService = ref<Service | null>(null)   // snapshot before last autosave (for undo)
    const autosaveStatus = ref<'idle' | 'pending' | 'saving' | 'saved'>('idle')
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null
    let autosaveInitialized = false                     // suppress first-load trigger
    ```

    **2. Add debounced autosave watcher** (insert before or after the existing `watch` on `serviceStore.services`, around line 676):

    ```typescript
    // ── Autosave watcher ────────────────────────────────────────────────────────────

    watch(
      localService,
      () => {
        // Skip: not loaded yet, or no actual change
        if (!localService.value || !originalService.value) return
        // Suppress the trigger that fires when service first loads from the store
        if (!autosaveInitialized) {
          autosaveInitialized = true
          return
        }
        if (!isDirty.value) return

        autosaveStatus.value = 'pending'

        if (autosaveTimer) clearTimeout(autosaveTimer)
        autosaveTimer = setTimeout(async () => {
          if (!isDirty.value) {
            autosaveStatus.value = 'idle'
            return
          }
          // Snapshot current state before saving (enables undo)
          previousService.value = JSON.parse(JSON.stringify(localService.value))
          autosaveStatus.value = 'saving'
          await onSave()
          autosaveStatus.value = 'saved'
          // Fade "Saved" indicator after 3 seconds
          setTimeout(() => {
            if (autosaveStatus.value === 'saved') autosaveStatus.value = 'idle'
          }, 3000)
        }, 1500)
      },
      { deep: true },
    )
    ```

    **3. Add undo function** (insert after `onSave()` function, around line 1142):

    ```typescript
    // ── Undo (restore previous autosave snapshot) ───────────────────────────────────

    function onUndo() {
      if (!previousService.value) return
      // Restore previous snapshot — this will trigger another autosave after 1.5s
      localService.value = JSON.parse(JSON.stringify(previousService.value))
      previousService.value = null
      autosaveStatus.value = 'idle'
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
    }
    ```

    **4. Add Ctrl+Z keyboard shortcut** (insert inside `onMounted`, after `await initStores()`):

    ```typescript
    // Ctrl+Z / Cmd+Z undo shortcut
    function handleUndoKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Only intercept if undo is available (not inside a text input where browser undo should apply)
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (!previousService.value) return
        e.preventDefault()
        onUndo()
      }
    }
    document.addEventListener('keydown', handleUndoKey)
    onUnmounted(() => document.removeEventListener('keydown', handleUndoKey))
    ```

    Note: `onUnmounted` is already used in this component. Add the removeEventListener call to the existing `onUnmounted` callback instead of creating a duplicate — or use a separate `onUnmounted` call (Vue 3 allows multiple `onUnmounted` hooks).

    Also clear the autosave timer in `onUnmounted`:
    ```typescript
    onUnmounted(() => {
      if (autosaveTimer) clearTimeout(autosaveTimer)
    })
    ```

    **5. Reset `autosaveInitialized` and `previousService` when the service first loads** — inside the existing `watch` on `serviceStore.services`, after the initial load block sets `localService.value` and `originalService.value`, add:
    ```typescript
    autosaveInitialized = false
    previousService.value = null
    autosaveStatus.value = 'idle'
    ```

    This ensures the watcher flag resets correctly if the user navigates from one service to another without unmounting the view.
  </action>
  <verify>
    <automated>npx vue-tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <done>
    `previousService`, `autosaveStatus`, and the debounced watcher exist in ServiceEditorView.vue. `onUndo()` is defined. TypeScript compiles with no new errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add autosave indicator and Undo button to the header</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
    In the template, find the "Save area" `<div class="flex items-center gap-3">` section (around line 58). Make these targeted changes:

    **1. Replace the "Unsaved changes" span** (currently `<span v-if="isDirty" class="text-xs text-amber-400">Unsaved changes</span>`) with an autosave status indicator plus Undo button side by side:

    ```html
    <!-- Autosave status indicator -->
    <span
      v-if="autosaveStatus === 'pending' || autosaveStatus === 'saving'"
      class="text-xs text-gray-400 italic"
    >
      {{ autosaveStatus === 'saving' ? 'Saving...' : 'Saving soon...' }}
    </span>
    <span
      v-else-if="autosaveStatus === 'saved'"
      class="text-xs text-green-400"
    >
      Saved
    </span>
    <span
      v-else-if="isDirty"
      class="text-xs text-amber-400"
    >
      Unsaved changes
    </span>

    <!-- Undo button (only visible when a previous snapshot exists) -->
    <button
      v-if="previousService"
      type="button"
      @click="onUndo"
      title="Undo last save (Ctrl+Z)"
      class="print:hidden inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
      Undo
    </button>
    ```

    **2. The manual Save button remains unchanged.** Its disabled state (`!isDirty || isSaving`) is still correct — if autosave just fired, `isDirty` will be false and the button will be grayed out naturally. No changes needed to the Save button.

    Keep all other header buttons (Delete, Suggest All Songs, Print, Copy for PC, Share) exactly as they are.
  </action>
  <verify>
    <automated>npx vue-tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <done>
    The header shows "Saving soon..." / "Saving..." / "Saved" status text next to the manual Save button. An Undo button appears whenever a previous autosave snapshot is available. TypeScript compiles cleanly.
  </done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes with no new type errors
- In the browser: edit a text field in the service editor, stop typing — within ~1.5s the indicator shows "Saving..." then "Saved"
- After "Saved" appears, an Undo button is visible in the header
- Clicking Undo restores the pre-save state and clears the Undo button
- Ctrl+Z (when focus is not on a text input) also triggers undo
- The manual Save button still works independently; pressing it while dirty saves immediately
- Navigating away and back to a service does not carry over stale undo state
</verification>

<success_criteria>
Autosave fires 1.5 seconds after any change and persists to Firestore. The "Saved" status indicator confirms success. One undo step is available via both button and Ctrl+Z. No regression in manual Save, print, share, or delete workflows. TypeScript builds cleanly.
</success_criteria>

<output>
After completion, create `.planning/quick/14-add-autosave-to-service-editor-with-one-/14-SUMMARY.md`
</output>
