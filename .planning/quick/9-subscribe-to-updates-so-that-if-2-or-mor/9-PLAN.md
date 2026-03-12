---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
autonomous: true
requirements:
  - QUICK-9
must_haves:
  truths:
    - "When Person A edits a service, Person B viewing the same service editor sees the changes without refreshing"
    - "Remote updates do NOT overwrite Person A's own in-progress edits (autosave pending/saving)"
    - "The Services listing already updates in real-time via Firestore onSnapshot — no changes needed there"
  artifacts:
    - path: "src/views/ServiceEditorView.vue"
      provides: "Remote-update merge logic in the store watcher"
      contains: "apply remote updates when autosaveStatus is idle or saved"
  key_links:
    - from: "serviceStore.services (onSnapshot)"
      to: "localService in ServiceEditorView"
      via: "watch on serviceStore.services, merge when not actively editing"
      pattern: "autosaveStatus.*idle|saved"
---

<objective>
Apply remote Firestore updates to ServiceEditorView's local state so that two people looking at the same service editor both see changes made by the other, in real time.

Purpose: The services listing (ServicesView) is already fully reactive — it renders directly from the Pinia store which is driven by onSnapshot. The editor is not: it deep-clones into localService on first load and never re-applies remote changes. This task closes that gap.

Output: Modified store watcher in ServiceEditorView that merges remote service updates into localService when the user is not actively editing (autosaveStatus === 'idle' or 'saved').
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md

Key architecture facts:
- serviceStore.services is populated by a Firestore onSnapshot listener (already real-time)
- ServicesView renders serviceStore.services directly — already reactive, no changes needed
- ServiceEditorView deep-clones the matching service into localService on first load
- The store watcher condition `if (!localService.value)` means only the initial load is ever applied
- autosaveStatus is: 'idle' | 'pending' | 'saving' | 'saved'
  - 'idle'  = no unsaved changes (safe to accept remote)
  - 'saved' = just saved, no pending changes (safe to accept remote)
  - 'pending' = user is typing / just dragged a slot (DO NOT overwrite)
  - 'saving' = autosave write in flight (DO NOT overwrite)
- originalService tracks the last saved server state (used for isDirty comparison)
- autosaveInitialized is a boolean flag that suppresses the first-load autosave trigger
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply remote updates to localService when editor is idle</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
    Locate the store watcher (around line 1021) that watches `serviceStore.services`:

    ```js
    watch(
      () => serviceStore.services,
      (services) => {
        if (!localService.value) {
          // Initial load: populate from store
          const found = services.find((s) => s.id === serviceId.value)
          if (found) {
            localService.value = JSON.parse(JSON.stringify(found))
            originalService.value = JSON.parse(JSON.stringify(found))
            autosaveInitialized = false
            previousService.value = null
            autosaveStatus.value = 'idle'
          }
        }
      },
      { immediate: true, deep: true },
    )
    ```

    Extend the watcher to also handle the `else` branch — when localService is already populated and a remote update arrives. The rule: only apply the remote update when the user is NOT actively editing, i.e. when autosaveStatus is 'idle' or 'saved'.

    Replace the watcher body with:

    ```js
    watch(
      () => serviceStore.services,
      (services) => {
        const found = services.find((s) => s.id === serviceId.value)
        if (!found) return

        if (!localService.value) {
          // Initial load: populate from store
          localService.value = JSON.parse(JSON.stringify(found))
          originalService.value = JSON.parse(JSON.stringify(found))
          autosaveInitialized = false
          previousService.value = null
          autosaveStatus.value = 'idle'
        } else if (autosaveStatus.value === 'idle' || autosaveStatus.value === 'saved') {
          // Remote update arrived while user is not actively editing — apply it.
          // This is what makes two simultaneous viewers see each other's changes.
          // Guard: skip if the remote version matches what we already have (avoid
          // spurious re-renders after our own save completes).
          const remoteJson = JSON.stringify(found)
          const localJson = JSON.stringify(localService.value)
          if (remoteJson !== localJson) {
            localService.value = JSON.parse(remoteJson)
            originalService.value = JSON.parse(remoteJson)
            // Reset autosaveInitialized so the watcher's first local mutation
            // after a remote merge is NOT mistakenly treated as user-initiated.
            autosaveInitialized = false
          }
        }
        // If autosaveStatus is 'pending' or 'saving', the user is actively editing —
        // do not overwrite their in-progress work. Their save will win.
      },
      { immediate: true, deep: true },
    )
    ```

    Do not change anything else in the file.
  </action>
  <verify>
    <automated>npx vue-tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - TypeScript compiles without errors
    - Two browser tabs open on the same service editor: changes made in Tab A appear in Tab B within ~1 second (Firestore round-trip), but only when Tab B's editor is idle
    - Changes made in Tab B while its autosave is pending/saving are NOT overwritten by Tab A's incoming updates
    - The autosave guard (autosaveInitialized reset) prevents a spurious autosave from firing immediately after a remote merge populates localService
  </done>
</task>

</tasks>

<verification>
Manual verification steps:
1. Open the app in two browser tabs, both signed in (same org), both on the same service editor URL
2. In Tab A, change the sermon topic — within ~1 second Tab B's sermon topic field should update automatically
3. In Tab B, start typing in a slot's notes field (do not pause) — Tab A's updates should NOT interrupt Tab B's in-progress typing
4. After Tab B finishes typing and autosaves, subsequent Tab A changes should resume appearing in Tab B

TypeScript check: `npx vue-tsc --noEmit` passes with no new errors.
</verification>

<success_criteria>
- Two simultaneous viewers of the same service editor both see remote updates within Firestore's normal latency (~200-500ms)
- An editor who is actively typing or dragging slots is never interrupted by incoming remote changes
- ServicesView (the listing) remains unchanged — it was already reactive
- No TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/9-subscribe-to-updates-so-that-if-2-or-mor/9-SUMMARY.md` following the standard summary template.
</output>
