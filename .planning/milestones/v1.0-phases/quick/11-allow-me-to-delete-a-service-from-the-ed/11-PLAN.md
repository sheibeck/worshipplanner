---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
autonomous: true
requirements:
  - QUICK-11
must_haves:
  truths:
    - "A Delete button is visible in the service editor header"
    - "Clicking Delete shows a confirmation dialog before any destructive action"
    - "Confirming deletion deletes the service and navigates back to /services"
    - "Cancelling the dialog leaves the service unchanged"
  artifacts:
    - path: "src/views/ServiceEditorView.vue"
      provides: "Delete button + inline confirmation dialog + onDelete handler"
  key_links:
    - from: "Delete button (template)"
      to: "showDeleteConfirm ref"
      via: "@click toggle"
    - from: "Confirm button"
      to: "serviceStore.deleteService(serviceId)"
      via: "onDelete async function"
    - from: "onDelete"
      to: "router.push('/services')"
      via: "after await resolves"
---

<objective>
Add a Delete Service button to the ServiceEditorView header with an inline confirmation dialog.

Purpose: Planners need to remove services they created by mistake or that are no longer needed, without leaving the editor to do so.
Output: Delete button in the editor header, confirmation dialog, deletion via existing store method, navigation to /services on success.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key facts:
- `serviceStore.deleteService(id: string)` already exists in src/stores/services.ts — deletes the Firestore doc
- `serviceId` computed already exists in the view (`route.params.id as string`)
- `useRouter` is NOT yet imported — must add it
- Dark mode palette: gray-950 body, gray-900 cards, gray-800 inputs
- Inline SVG icons only — no icon library
- Static class lookup objects required for Tailwind v4 purge safety (already used for statusBadgeClasses etc.)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add delete button and confirmation dialog to ServiceEditorView</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
Make the following targeted changes to src/views/ServiceEditorView.vue:

**1. Add `useRouter` import** (line ~436, alongside `useRoute`):
```ts
import { useRoute, useRouter } from 'vue-router'
```

**2. Add router instance** (after `const route = useRoute()`, line ~455):
```ts
const router = useRouter()
```

**3. Add reactive state** in the "Local state" section (after `showAddMenu`):
```ts
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)
```

**4. Add `onDelete` handler** at the end of the script, just before `</script>`:
```ts
// ── Delete ─────────────────────────────────────────────────────────────────────

async function onDelete() {
  if (!localService.value) return
  isDeleting.value = true
  try {
    await serviceStore.deleteService(serviceId.value)
    router.push('/services')
  } finally {
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}
```

**5. Add Delete button in the header "Save area" `<div class="flex items-center gap-3">` block** — add it as the FIRST button (before "Suggest All Songs" button):
```html
<!-- Delete button -->
<button
  type="button"
  @click="showDeleteConfirm = true"
  class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-400 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
  Delete
</button>
```

**6. Add inline confirmation dialog** — place it just after the closing `</div>` of the header block (after the `<!-- Save area -->` div, still inside `<template v-else>`), before the slot list section. This is a modal overlay using `v-if="showDeleteConfirm"`:
```html
<!-- Delete confirmation dialog -->
<Teleport to="body">
  <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-base font-semibold text-gray-100 mb-2">Delete service?</h2>
      <p class="text-sm text-gray-400 mb-6">This will permanently delete the service for <span class="text-gray-200">{{ formattedDate }}</span>. This cannot be undone.</p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          @click="showDeleteConfirm = false"
          :disabled="isDeleting"
          class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="onDelete"
          :disabled="isDeleting"
          class="rounded-md px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete' }}
        </button>
      </div>
    </div>
  </div>
</Teleport>
```

The Teleport escapes the AppShell overflow stacking context — consistent with SongSlotPicker pattern already used in the codebase.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
- "Delete" button appears in editor header with red text and trash icon
- Clicking it opens a modal dialog showing the service date and a warning
- "Cancel" closes the dialog without side effects
- "Confirm Delete" calls serviceStore.deleteService and navigates to /services
- TypeScript compiles with no new errors
  </done>
</task>

</tasks>

<verification>
Run TypeScript check: `cd C:/projects/worshipplanner && npx vue-tsc --noEmit`
Manual: Open a service editor, verify Delete button is in header, click it, confirm dialog appears with service date, cancel works, delete navigates back to /services.
</verification>

<success_criteria>
Delete button visible in the service editor header. Confirmation dialog correctly names the service date. Deletion removes the Firestore document and returns user to /services. No TypeScript errors introduced.
</success_criteria>

<output>
After completion, create `.planning/quick/11-allow-me-to-delete-a-service-from-the-ed/11-SUMMARY.md`
</output>
