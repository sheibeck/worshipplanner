---
phase: quick-19
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/SettingsView.vue
  - src/router/index.ts
  - src/components/AppSidebar.vue
  - src/stores/auth.ts
autonomous: true
requirements: [QUICK-19]
must_haves:
  truths:
    - "Editor can navigate to a Settings page from the sidebar"
    - "Editor can see and edit the organization name on the Settings page"
    - "Saving the org name updates Firestore and reflects in the sidebar immediately"
    - "Viewers cannot access Settings (editor-only)"
  artifacts:
    - path: "src/views/SettingsView.vue"
      provides: "Settings page with org name editing"
      min_lines: 40
    - path: "src/router/index.ts"
      provides: "/settings route with requiresAuth + requiresEditor"
      contains: "settings"
    - path: "src/components/AppSidebar.vue"
      provides: "Settings nav item for editors"
      contains: "Settings"
  key_links:
    - from: "src/views/SettingsView.vue"
      to: "organizations/{orgId}"
      via: "updateDoc on save"
      pattern: "updateDoc.*organizations"
    - from: "src/views/SettingsView.vue"
      to: "src/stores/auth.ts"
      via: "authStore.orgName reactivity"
      pattern: "authStore\\.orgName"
    - from: "src/components/AppSidebar.vue"
      to: "/settings"
      via: "router-link in navItems"
      pattern: "settings"
---

<objective>
Add a Settings view accessible from the sidebar where editors can edit the organization name (replacing the auto-generated "User's Church" default).

Purpose: Users currently have no way to change the auto-generated org name. A settings page provides a clear place to customize this and serves as a foundation for future org-level settings.
Output: New SettingsView.vue, updated router and sidebar
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/stores/auth.ts:
```typescript
// Auth store exposes these reactive refs used by SettingsView:
const orgId = ref<string | null>(null)
const orgName = ref<string | null>(null)
const isEditor = computed(() => userRole.value === 'editor')

// orgName is loaded in loadOrgContext() via:
// orgName.value = (orgSnap.data().name as string) ?? null
```

From src/router/index.ts:
```typescript
// Route meta interface:
interface RouteMeta {
  requiresAuth?: boolean
  requiresEditor?: boolean
}
// Existing guard checks requiresAuth then requiresEditor — new route just needs both meta flags
```

From firestore.rules:
```
// Organizations: editors can write (updateDoc allowed for editors)
match /organizations/{orgId} {
  allow read: if isOrgMember(orgId);
  allow write: if isOrgEditor(orgId);
}
```

From src/components/AppSidebar.vue:
```typescript
// navItems computed builds array conditionally on authStore.isEditor
// Pattern: { label: string, to: string, icon: string (inline SVG) }
// Settings should be added as last editor-only item
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create SettingsView with org name editing</name>
  <files>src/views/SettingsView.vue</files>
  <action>
Create SettingsView.vue wrapped in AppShell (same pattern as TeamView.vue). Layout:

1. Page header: h1 "Settings" with org name subtitle (same as TeamView pattern)

2. "Organization" section card (rounded-lg bg-gray-900 border border-gray-800 p-4):
   - Section heading "Organization" (text-sm font-semibold text-gray-300 mb-3)
   - Label "Organization Name" (text-xs text-gray-400 mb-1)
   - Text input bound to local `editName` ref, pre-filled with `authStore.orgName`
     - Tailwind classes matching existing inputs: bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500
   - "Save" button (indigo-600, same style as invite button in TeamView)
     - Disabled when editName matches authStore.orgName or editName is empty
     - Shows "Saving..." while saving, "Saved!" with 2s timeout on success (same feedback pattern as TeamView invite)
   - Error message (text-red-400 text-sm mt-2) on failure

Implementation details:
- Import updateDoc, doc from firebase/firestore and db from @/firebase
- On save: `await updateDoc(doc(db, 'organizations', authStore.orgId), { name: editName.value.trim() })`
- After successful save, update authStore.orgName directly: `authStore.orgName = editName.value.trim()` (keeps sidebar reactive without re-fetching)
- Use watch on authStore.orgName to sync editName if orgName changes externally
- Guard: return early if !authStore.orgId
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>SettingsView.vue exists with org name input, save button, Firestore updateDoc on save, reactive sync with authStore.orgName</done>
</task>

<task type="auto">
  <name>Task 2: Add /settings route and sidebar nav item</name>
  <files>src/router/index.ts, src/components/AppSidebar.vue</files>
  <action>
Router (src/router/index.ts):
- Add route object after the /team route:
  ```
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresEditor: true },
  }
  ```

Sidebar (src/components/AppSidebar.vue):
- In the navItems computed, add a Settings item as the LAST editor-only entry (after Team):
  ```
  if (authStore.isEditor) {
    items.push({
      label: 'Settings',
      to: '/settings',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>`,
    })
  }
  ```
  This is a separate if-block (not combined with the Team push) to keep Settings visually last in the nav. Place it after the existing Team push block.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -20 && npx vite build 2>&1 | tail -5</automated>
  </verify>
  <done>/settings route registered with requiresAuth + requiresEditor meta. Settings gear icon appears as last sidebar nav item for editors. Viewers do not see it and are redirected to /services if they navigate directly.</done>
</task>

</tasks>

<verification>
1. `npx vue-tsc --noEmit` passes with no type errors
2. `npx vite build` succeeds
3. Manual: Sign in as editor, see Settings in sidebar, click it, see org name input pre-filled, change name, click Save, sidebar org name updates immediately
</verification>

<success_criteria>
- SettingsView.vue renders org name in editable input
- Save updates Firestore organizations/{orgId}.name and authStore.orgName
- Settings appears in sidebar after Team (editors only)
- /settings route guarded by requiresAuth + requiresEditor
- Dark theme styling consistent with existing views (gray-900 cards, gray-800 inputs, indigo-600 buttons)
</success_criteria>

<output>
After completion, create `.planning/quick/19-add-settings-screen-to-edit-org-name-ins/19-SUMMARY.md`
</output>
