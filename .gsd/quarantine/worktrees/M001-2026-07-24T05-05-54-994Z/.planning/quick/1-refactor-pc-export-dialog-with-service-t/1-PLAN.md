---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/service.ts
  - src/stores/auth.ts
  - src/utils/planningCenterApi.ts
  - src/utils/__tests__/planningCenterApi.test.ts
  - src/views/ServiceEditorView.vue
  - src/views/SettingsView.vue
autonomous: true
requirements: [EXPORT-DIALOG, STATUS-BADGE-CYCLE, SETTINGS-CLEANUP, PC-PLAN-DATE]
must_haves:
  truths:
    - "Clicking 'Export to PC' opens a modal dialog with service type, template, and date fields before exporting"
    - "Service type dropdown in the export dialog is fetched from PC API and defaults to 'Sunday Gathering'"
    - "Template dropdown fetches PC templates for the selected service type"
    - "Export creates the PC plan then attempts to set the date via PATCH or series_date"
    - "Status badge cycles Draft -> Planned -> Exported -> Draft on click"
    - "Exported services block editing unless user cycles badge back to Draft"
    - "Settings page no longer has service type dropdown or pcServiceTypeId references"
    - "The separate 'Exported' green badge is removed from ServiceEditorView"
  artifacts:
    - path: "src/types/service.ts"
      provides: "ServiceStatus type with 'exported' added"
      contains: "'exported'"
    - path: "src/utils/planningCenterApi.ts"
      provides: "fetchTemplates and updatePlanDate API functions"
      exports: ["fetchTemplates", "updatePlanDate"]
    - path: "src/views/ServiceEditorView.vue"
      provides: "Export dialog modal, 3-state badge cycle, editing guard for exported status"
    - path: "src/views/SettingsView.vue"
      provides: "PC section with only App ID and Secret (no service type)"
    - path: "src/stores/auth.ts"
      provides: "Auth store without pcServiceTypeId"
  key_links:
    - from: "src/views/ServiceEditorView.vue"
      to: "src/utils/planningCenterApi.ts"
      via: "fetchServiceTypes, fetchTemplates, createPlan, updatePlanDate calls in export dialog"
      pattern: "fetchTemplates|updatePlanDate|fetchServiceTypes"
    - from: "src/views/ServiceEditorView.vue"
      to: "src/types/service.ts"
      via: "ServiceStatus type with 'exported' value"
      pattern: "status.*exported"
---

<objective>
Refactor the Planning Center export flow from a one-click button into a modal dialog with service type + template selection, implement 3-state status badge cycling (Draft/Planned/Exported), set dates on exported PC plans, and clean up pcServiceTypeId from Settings/auth store.

Purpose: Give users control over which PC service type and template to export into, show exported status properly in the badge cycle, and prevent accidental edits to exported services.
Output: Updated ServiceEditorView with export dialog and 3-state badge, updated PC API client with template/date functions, cleaned Settings page.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/types/service.ts
@src/stores/auth.ts
@src/utils/planningCenterApi.ts
@src/utils/__tests__/planningCenterApi.test.ts
@src/views/ServiceEditorView.vue
@src/views/SettingsView.vue
@src/stores/services.ts

<interfaces>
<!-- Current interfaces the executor needs -->

From src/types/service.ts:
```typescript
export type ServiceStatus = 'draft' | 'planned'
// CHANGE TO: export type ServiceStatus = 'draft' | 'planned' | 'exported'

export interface Service {
  id: string
  date: string
  name: string
  progression: Progression
  teams: string[]
  status: ServiceStatus
  slots: ServiceSlot[]
  sermonPassage: ScriptureRef | null
  sermonTopic?: string
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
  pcExportedAt?: Timestamp | null
  pcPlanId?: string | null
}
```

From src/stores/auth.ts:
```typescript
// Current setPcCredentials signature (will change):
function setPcCredentials(appId: string | null, secret: string | null, serviceTypeId: string | null)
// CHANGE TO: function setPcCredentials(appId: string | null, secret: string | null)

// Current pcCredentials computed (will change):
const pcCredentials = computed(() => {
  if (!hasPcCredentials.value) return null
  return { appId: pcAppId.value!, secret: pcSecret.value!, serviceTypeId: pcServiceTypeId.value ?? '' }
})
// CHANGE TO: remove serviceTypeId from the return object
```

From src/utils/planningCenterApi.ts:
```typescript
export const PC_BASE_URL = import.meta.env.DEV ? '/api/planningcenter/services/v2' : 'https://api.planningcenteronline.com/services/v2'
function basicAuthHeader(appId: string, secret: string): string
export async function fetchServiceTypes(appId: string, secret: string): Promise<Array<{ id: string; name: string }>>
export async function createPlan(appId: string, secret: string, serviceTypeId: string, title: string): Promise<string>
export async function createItem(...)
export async function addSlotAsItem(...)
export function buildPlanTitle(...)
```

From src/views/ServiceEditorView.vue:
```typescript
// Current status badge classes (only draft/planned):
const statusBadgeClasses: Record<string, string> = {
  planned: 'bg-green-900/50 text-green-300 border-green-800',
  draft: 'bg-gray-800 text-gray-400 border-gray-700',
}

// Current toggleStatus (only 2 states):
function toggleStatus() {
  if (!localService.value) return
  localService.value.status = localService.value.status === 'draft' ? 'planned' : 'draft'
}

// Delete confirmation dialog uses Teleport pattern:
// <Teleport to="body"><div v-if="showDeleteConfirm" class="fixed inset-0 z-50 ...">
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add PC API functions (fetchTemplates, updatePlanDate) + update types + clean auth store</name>
  <files>
    src/types/service.ts
    src/stores/auth.ts
    src/utils/planningCenterApi.ts
    src/utils/__tests__/planningCenterApi.test.ts
  </files>
  <action>
**A. src/types/service.ts** - Add 'exported' to ServiceStatus:
```typescript
export type ServiceStatus = 'draft' | 'planned' | 'exported'
```
No other changes needed in this file.

**B. src/stores/auth.ts** - Remove pcServiceTypeId entirely:
1. Remove `const pcServiceTypeId = ref<string | null>(null)` (line 39).
2. Remove `serviceTypeId: pcServiceTypeId.value ?? ''` from the `pcCredentials` computed. The computed should return just `{ appId, secret }`.
3. In `loadOrgContext`: remove `pcServiceTypeId.value = null` from the "no org" branch (line 88) and remove `pcServiceTypeId.value = (orgData.pcServiceTypeId as string) ?? null` from the org data read (line 101).
4. In `logout()`: remove `pcServiceTypeId.value = null` (line 285).
5. Change `setPcCredentials` signature from `(appId, secret, serviceTypeId)` to `(appId, secret)`. Remove `pcServiceTypeId.value = serviceTypeId` from its body.
6. Remove `pcServiceTypeId` from the returned object (line 318).
7. Keep everything else (pcAppId, pcSecret, hasPcCredentials, pcCredentials) unchanged.

**C. src/utils/planningCenterApi.ts** - Add two new exported functions:

1. `fetchTemplates(appId, secret, serviceTypeId)` - Fetches plan templates for a service type:
   ```typescript
   export async function fetchTemplates(
     appId: string,
     secret: string,
     serviceTypeId: string,
   ): Promise<Array<{ id: string; name: string }>> {
     const response = await fetch(
       `${PC_BASE_URL}/service_types/${serviceTypeId}/plan_templates?per_page=100`,
       {
         headers: {
           Authorization: basicAuthHeader(appId, secret),
           Accept: 'application/json',
         },
       },
     )
     if (!response.ok) {
       throw new Error(`Failed to fetch templates: ${response.status}`)
     }
     const json = (await response.json()) as {
       data: Array<{ id: string; attributes: { name: string } }>
     }
     return json.data.map((t) => ({ id: t.id, name: t.attributes.name }))
   }
   ```

2. `updatePlanDate(appId, secret, serviceTypeId, planId, date)` - PATCHes the plan's `sort_date` after creation. The PC API rejects date fields on POST but should accept them on PATCH. Use `sort_date` as the attribute name. If the PATCH fails (API may still reject), fall back silently (the date is already in the title as a fallback from buildPlanTitle changes):
   ```typescript
   export async function updatePlanDate(
     appId: string,
     secret: string,
     serviceTypeId: string,
     planId: string,
     date: string,
   ): Promise<boolean> {
     try {
       const response = await fetch(
         `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}`,
         {
           method: 'PATCH',
           headers: {
             Authorization: basicAuthHeader(appId, secret),
             Accept: 'application/json',
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             data: {
               type: 'Plan',
               id: planId,
               attributes: { sort_date: date },
             },
           }),
         },
       )
       return response.ok
     } catch {
       return false
     }
   }
   ```

3. Update `createPlan` to accept an optional `templateId` parameter. When provided, include `{ relationships: { plan_template: { data: { type: 'PlanTemplate', id: templateId } } } }` in the POST body alongside `data`:
   ```typescript
   export async function createPlan(
     appId: string,
     secret: string,
     serviceTypeId: string,
     title: string,
     templateId?: string,
   ): Promise<string> {
     const attributes: Record<string, string> = { title }
     const body: Record<string, unknown> = {
       data: { type: 'Plan', attributes },
     }
     if (templateId) {
       ;(body.data as Record<string, unknown>).relationships = {
         plan_template: { data: { type: 'PlanTemplate', id: templateId } },
       }
     }
     // ... rest of fetch call unchanged
   }
   ```

**D. src/utils/__tests__/planningCenterApi.test.ts** - Add tests:

1. Add `fetchTemplates` and `updatePlanDate` to the import.
2. Add `describe('fetchTemplates', ...)` block:
   - Test it returns `[{id, name}]` from JSON:API response at `/service_types/{id}/plan_templates`.
   - Test it throws on non-ok response.
3. Add `describe('updatePlanDate', ...)` block:
   - Test it sends PATCH to correct URL with `sort_date` attribute.
   - Test it returns `true` on success, `false` on failure, `false` on network error.
4. Update existing `createPlan` tests: add a test that when `templateId` is passed, the body includes `relationships.plan_template`.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/utils/__tests__/planningCenterApi.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - ServiceStatus type includes 'exported'
    - auth store no longer has pcServiceTypeId ref, setPcCredentials takes 2 params
    - planningCenterApi.ts exports fetchTemplates and updatePlanDate
    - createPlan accepts optional templateId
    - All existing + new tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Build export dialog modal + 3-state status badge + editing guard in ServiceEditorView</name>
  <files>
    src/views/ServiceEditorView.vue
  </files>
  <action>
This task modifies ServiceEditorView.vue to: (A) replace the one-click export button with a dialog, (B) implement 3-state badge cycling, (C) guard editing when exported, (D) remove the separate exported badge.

**A. Export Dialog Modal:**

Add a new `<Teleport to="body">` dialog (same pattern as delete confirmation dialog) that shows when `showExportDialog` is true. The dialog contains:

1. Title: "Export to Planning Center"
2. **Service Type dropdown** - fetched from PC API using `fetchServiceTypes`. Default-select the option whose name includes "Sunday" (case-insensitive) or the first option. When the user changes service type, re-fetch templates.
3. **Template dropdown** - fetched from PC API using `fetchTemplates(appId, secret, selectedServiceTypeId)`. Show "No template (blank plan)" as the first option with value `""`. Default to first template if any exist. Fetch on dialog open and whenever service type changes.
4. **Service date** displayed as read-only text: `formattedDate` (already computed in the component).
5. **Export button** and **Cancel button**.

Add these refs to the script:
```typescript
const showExportDialog = ref(false)
const exportServiceTypes = ref<Array<{ id: string; name: string }>>([])
const exportTemplates = ref<Array<{ id: string; name: string }>>([])
const exportSelectedServiceTypeId = ref('')
const exportSelectedTemplateId = ref('')
const exportLoading = ref(false)  // loading service types/templates
```

Add imports for `fetchServiceTypes`, `fetchTemplates`, `updatePlanDate` from `@/utils/planningCenterApi`.

**Opening the dialog:** Change `onExportToPC` to just open the dialog and fetch data:
```typescript
async function onExportToPC() {
  if (!localService.value) return
  if (!authStore.hasPcCredentials || !authStore.pcCredentials) return

  showExportDialog.value = true
  exportError.value = null
  exportLoading.value = true

  try {
    const { appId, secret } = authStore.pcCredentials
    exportServiceTypes.value = await fetchServiceTypes(appId, secret)

    // Default to service type whose name contains "Sunday", else first
    const sundayType = exportServiceTypes.value.find(t =>
      t.name.toLowerCase().includes('sunday')
    )
    exportSelectedServiceTypeId.value = sundayType?.id ?? exportServiceTypes.value[0]?.id ?? ''

    // Fetch templates for selected service type
    if (exportSelectedServiceTypeId.value) {
      exportTemplates.value = await fetchTemplates(appId, secret, exportSelectedServiceTypeId.value)
      exportSelectedTemplateId.value = exportTemplates.value[0]?.id ?? ''
    }
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Failed to load export options'
  } finally {
    exportLoading.value = false
  }
}
```

Add `onServiceTypeChange` to re-fetch templates when service type dropdown changes:
```typescript
async function onServiceTypeChange() {
  if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value) return
  const { appId, secret } = authStore.pcCredentials
  exportTemplates.value = []
  exportSelectedTemplateId.value = ''
  try {
    exportTemplates.value = await fetchTemplates(appId, secret, exportSelectedServiceTypeId.value)
    exportSelectedTemplateId.value = exportTemplates.value[0]?.id ?? ''
  } catch {
    // silently ignore — user can still export without template
  }
}
```

Add `onConfirmExport` that performs the actual export:
```typescript
async function onConfirmExport() {
  if (!localService.value) return
  if (!authStore.pcCredentials || !exportSelectedServiceTypeId.value) return

  isExporting.value = true
  exportError.value = null

  try {
    const { appId, secret } = authStore.pcCredentials
    const serviceTypeId = exportSelectedServiceTypeId.value
    const templateId = exportSelectedTemplateId.value || undefined

    // 1. Build plan title
    const title = buildPlanTitle(localService.value)

    // 2. Create the plan in PC (with optional template)
    const planId = await createPlan(appId, secret, serviceTypeId, title, templateId)

    // 3. Attempt to set the date via PATCH
    await updatePlanDate(appId, secret, serviceTypeId, planId, localService.value.date)

    // 4. Add items sequentially, track failures
    const failures: string[] = []
    let sequence = 1
    for (const slot of localService.value.slots) {
      try {
        await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, localService.value.sermonPassage)
        sequence++
      } catch (e) {
        const label = slot.kind === 'SONG' ? (slot as any).songTitle ?? 'Song'
          : slot.kind === 'HYMN' ? (slot as any).hymnName ?? 'Hymn'
          : slot.kind === 'SCRIPTURE' ? 'Scripture'
          : slot.kind
        failures.push(label)
      }
    }

    // 5. Mark service as exported in Firestore — set status to 'exported'
    await serviceStore.updateService(localService.value.id, {
      pcExportedAt: serverTimestamp(),
      pcPlanId: planId,
      status: 'exported',
    })

    // 6. Update local state
    localService.value.pcExportedAt = new Date() as any
    localService.value.pcPlanId = planId
    localService.value.status = 'exported'

    // 7. Close dialog and show feedback
    showExportDialog.value = false

    if (failures.length > 0) {
      exportError.value = `Plan created but ${failures.length} item(s) failed: ${failures.join(', ')}`
    } else {
      pcExported.value = true
      setTimeout(() => { pcExported.value = false }, 3000)
    }
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Export failed'
  } finally {
    isExporting.value = false
  }
}
```

**Dialog template** (insert as a `<Teleport to="body">` after the delete confirmation dialog):
```html
<Teleport to="body">
  <div v-if="showExportDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
      <h2 class="text-base font-semibold text-gray-100 mb-4">Export to Planning Center</h2>

      <!-- Loading state -->
      <div v-if="exportLoading" class="text-sm text-gray-400 py-4 text-center">Loading options...</div>

      <template v-else>
        <!-- Service Type -->
        <div class="mb-3">
          <label class="block text-xs text-gray-400 mb-1">Service Type</label>
          <select
            v-model="exportSelectedServiceTypeId"
            @change="onServiceTypeChange"
            class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option v-for="st in exportServiceTypes" :key="st.id" :value="st.id">{{ st.name }}</option>
          </select>
        </div>

        <!-- Template -->
        <div class="mb-3">
          <label class="block text-xs text-gray-400 mb-1">Template</label>
          <select
            v-model="exportSelectedTemplateId"
            class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">No template (blank plan)</option>
            <option v-for="t in exportTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>

        <!-- Service Date (read-only) -->
        <div class="mb-4">
          <label class="block text-xs text-gray-400 mb-1">Service Date</label>
          <p class="text-sm text-gray-200">{{ formattedDate }}</p>
        </div>

        <!-- Error inside dialog -->
        <p v-if="exportError" class="text-red-400 text-sm mb-3">{{ exportError }}</p>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            type="button"
            @click="showExportDialog = false; exportError = null"
            :disabled="isExporting"
            class="rounded-md px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 disabled:opacity-50"
          >Cancel</button>
          <button
            type="button"
            @click="onConfirmExport"
            :disabled="isExporting || !exportSelectedServiceTypeId"
            class="rounded-md px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >{{ isExporting ? 'Exporting...' : 'Export' }}</button>
        </div>
      </template>
    </div>
  </div>
</Teleport>
```

**B. 3-State Status Badge Cycling:**

1. Update `statusBadgeClasses` to include exported:
```typescript
const statusBadgeClasses: Record<string, string> = {
  draft: 'bg-gray-800 text-gray-400 border-gray-700',
  planned: 'bg-green-900/50 text-green-300 border-green-800',
  exported: 'bg-green-900/50 text-green-300 border-green-800',
}
```

2. Update `toggleStatus` to cycle through 3 states:
```typescript
function toggleStatus() {
  if (!localService.value) return
  const current = localService.value.status
  if (current === 'draft') {
    localService.value.status = 'planned'
  } else if (current === 'planned') {
    localService.value.status = 'exported'
  } else {
    // exported -> draft
    localService.value.status = 'draft'
  }
}
```

3. Update the badge display text in the template. Currently it shows `localService.status === 'planned' ? 'Planned' : 'Draft'`. Change to:
```
{{ localService.status === 'exported' ? 'Exported' : localService.status === 'planned' ? 'Planned' : 'Draft' }}
```
Also add a check icon SVG for the 'exported' state alongside the existing lock icon for 'planned'. Use a checkmark icon when status is 'exported':
```html
<svg v-if="localService.status === 'planned'" ...lock icon... />
<svg v-else-if="localService.status === 'exported'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3">
  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
</svg>
```

4. Apply the same 3-state text to the non-editor (viewer) badge `<span>` too.

**C. Remove the separate "Exported" badge:**

Delete the entire `<!-- Exported to PC badge -->` block (the `<span v-if="localService.pcExportedAt" ...>Exported</span>` around lines 62-68). The status badge itself now shows "Exported" when status is 'exported'.

**D. Editing guard for exported services:**

Add a computed:
```typescript
const isExportedLocked = computed(() =>
  localService.value?.status === 'exported'
)
```

Use `isExportedLocked` to disable editing throughout the template. Find all places where editing controls are shown for editors (slot editing, name editing, notes editing, team editing, progression editing, sermon passage editing, etc.) and add `|| isExportedLocked` to their disabled conditions or wrap them in `v-if="!isExportedLocked"`.

Specifically:
- Slot drag handles, song assignment buttons, clear buttons: add `:disabled="isExportedLocked"` or `v-if="authStore.isEditor && !isExportedLocked"`
- Notes textarea: add `:disabled="isExportedLocked"`
- Team checkboxes: add `:disabled="isExportedLocked"`
- Sermon passage/topic inputs: add `:disabled="isExportedLocked"`
- Name input: add `:disabled="isExportedLocked"`
- Progression selector: add `:disabled="isExportedLocked"`
- "Suggest All Songs" button: add `|| isExportedLocked` to disabled condition
- The "Export to PC" button should: be enabled for 'planned' status (opens dialog), disabled for 'exported' (already exported), disabled for 'draft'. Change its `:disabled` from `isExporting || !!localService.pcExportedAt || localService.status !== 'planned'` to `isExporting || localService.status !== 'planned'`. Remove the `pcExportedAt` check since we now use status instead.

**E. Cleanup:**

- Remove `authStore.pcCredentials.serviceTypeId` usage from the old `onExportToPC` (which is now just the dialog opener). The serviceTypeId is selected in the dialog, not from the auth store.
- Remove the old inline export logic from `onExportToPC` — it is replaced by `onConfirmExport`.
- Update the "Export to PC" button text: show "Export to PC" for planned, "Exported" for exported status (no need for pcExportedAt check).
- Keep the pcCopied / Copy for PC button as-is for when no credentials are configured.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Export button opens a modal with service type (defaulting to Sunday), template, and date
    - Templates re-fetch when service type changes
    - Export in dialog creates plan with optional template, then PATCHes date
    - Status badge shows Draft/Planned/Exported and cycles on click
    - Exported services are read-only (editing disabled)
    - Separate "Exported" green badge is removed
    - No TypeScript errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Clean up Settings page — remove service type dropdown and pcServiceTypeId references</name>
  <files>
    src/views/SettingsView.vue
  </files>
  <action>
Remove all pcServiceTypeId-related UI and logic from SettingsView.vue:

**Template changes:**
1. Remove the "Service Type" display row in the credentials-saved view (lines 54-60 showing `authStore.pcServiceTypeId`).
2. Remove BOTH service type dropdown sections:
   - The one shown when credentials are saved and not editing (lines 84-105, the `<div v-if="pcServiceTypes.length > 0">` after the Edit/Clear buttons).
   - The one shown after validation success in edit mode (lines 163-185, the `<div v-if="pcServiceTypes.length > 0">` after the Save/Cancel buttons).

**Script changes:**
1. Remove `pcServiceTypes` ref (line 217).
2. Remove `pcSelectedServiceTypeId` ref (line 218).
3. Remove `pcServiceTypeSaving` ref (line 219).
4. Remove `pcServiceTypeSaved` ref (line 220).
5. Remove the `watch` on `authStore.pcServiceTypeId` (lines 245-252).
6. In `onMounted`: remove the entire block that fetches service types (lines 256-268). Since credentials-only Settings no longer needs service types, onMounted can be empty or removed.
7. In `onSavePcCredentials`:
   - Remove the `fetchServiceTypes` call (line 343).
   - Remove the `pcServiceTypes.value = ...` assignment.
   - Remove the `if (authStore.pcServiceTypeId)` block (lines 346-348).
   - Update `authStore.setPcCredentials` call to only pass 2 args: `authStore.setPcCredentials(pcAppIdInput.value.trim(), pcSecretInput.value.trim())`.
8. In `onClearPcCredentials`:
   - Remove `pcServiceTypeId: null` from the Firestore updateDoc (but keep pcAppId and pcSecret nulling).
   - Update `authStore.setPcCredentials(null, null)` (remove third arg).
   - Remove `pcServiceTypes.value = []` and `pcSelectedServiceTypeId.value = ''`.
9. Remove the entire `onSaveServiceType` function (lines 385-410).
10. Remove the `fetchServiceTypes` import from `@/utils/planningCenterApi` (it is no longer needed in Settings — it is now used only in ServiceEditorView).

Keep:
- App ID input
- Secret input
- "Generate at planningcenteronline.com/api_passwords" link
- Save & Validate button (validates credentials)
- Edit Credentials / Clear Credentials buttons
- The credential saved/editing flow
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | tail -20 && npx vitest run --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Settings page shows only App ID and Secret fields for PC integration
    - No service type dropdown or "Save Service Type" button in Settings
    - No pcServiceTypeId references remain in SettingsView.vue
    - No TypeScript errors across entire project
    - All tests pass
  </done>
</task>

</tasks>

<verification>
1. Type check: `npx vue-tsc --noEmit` passes with no errors
2. Unit tests: `npx vitest run` — all existing + new tests pass
3. Grep confirmation: `grep -r "pcServiceTypeId" src/` should return NO matches (only planning docs may reference it)
4. Status badge: ServiceStatus type includes 'draft', 'planned', 'exported'
</verification>

<success_criteria>
- Clicking "Export to PC" opens a modal dialog with service type (defaulted to Sunday Gathering), template dropdown, and date display
- Selecting a different service type re-fetches templates
- Exporting creates a PC plan (with optional template) and attempts to PATCH the date
- Status badge cycles Draft -> Planned -> Exported -> Draft on click
- Exported services have all editing controls disabled
- Cycling badge back to Draft re-enables editing
- Settings page only shows App ID + Secret (no service type dropdown)
- pcServiceTypeId removed from auth store
- All tests pass, no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/1-refactor-pc-export-dialog-with-service-t/1-SUMMARY.md`
</output>
