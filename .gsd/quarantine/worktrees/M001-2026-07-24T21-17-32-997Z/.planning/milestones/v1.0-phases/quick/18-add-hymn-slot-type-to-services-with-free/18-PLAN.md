---
phase: quick-18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/service.ts
  - src/utils/slotTypes.ts
  - src/views/ServiceEditorView.vue
  - src/components/ServicePrintLayout.vue
  - src/views/ShareView.vue
  - src/utils/planningCenterExport.ts
  - src/utils/__tests__/slotTypes.test.ts
  - src/utils/__tests__/planningCenterExport.test.ts
autonomous: true
requirements: [QUICK-18]

must_haves:
  truths:
    - "User can add a Hymn slot via the existing Add Slot dropdown menu"
    - "Hymn slot shows three freeform text fields in the editor: Hymn Name, Hymn Number, Verses"
    - "Filled hymn data appears in the print layout"
    - "Filled hymn data appears in the share view"
    - "Filled hymn data appears in the Planning Center export text"
    - "Empty hymn slot shows [not assigned] / placeholder state"
  artifacts:
    - path: "src/types/service.ts"
      provides: "HymnSlot interface and 'HYMN' added to SlotKind union"
      contains: "kind: 'HYMN'"
    - path: "src/utils/slotTypes.ts"
      provides: "createSlot and slotLabel handle 'HYMN' kind"
      exports: ["createSlot", "slotLabel"]
    - path: "src/views/ServiceEditorView.vue"
      provides: "HYMN slot template block + Add Slot menu entry"
    - path: "src/components/ServicePrintLayout.vue"
      provides: "HYMN slot rendered in print layout"
    - path: "src/views/ShareView.vue"
      provides: "HYMN slot rendered in share view"
    - path: "src/utils/planningCenterExport.ts"
      provides: "HYMN slot formatted in PC export text"
  key_links:
    - from: "ServiceEditorView.vue Add Slot dropdown"
      to: "createSlot('HYMN')"
      via: "addSlot('HYMN') call"
    - from: "HymnSlot.hymnName/hymnNumber/verses fields"
      to: "ServicePrintLayout + ShareView + planningCenterExport"
      via: "slot.kind === 'HYMN' branches"
---

<objective>
Add a "Hymn" slot kind to the service planning system — a freeform slot with Hymn Name, Hymn Number, and Verses fields (e.g. "1, 3, 4").

Purpose: Worship teams frequently use traditional hymns that are not in the song library and need a distinct slot kind for them in the service order.
Output: HymnSlot type + createSlot/slotLabel support + Add Slot menu entry + editor UI + print/share/export rendering.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/18-add-hymn-slot-type-to-services-with-free/18-PLAN.md

<interfaces>
<!-- Key types the executor needs. All from current codebase. -->

From src/types/service.ts (current):
```typescript
export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE'

export interface NonAssignableSlot {
  kind: 'PRAYER' | 'MESSAGE'
  position: number
  linkUrl?: string
  linkLabel?: string
}

export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot
```

From src/utils/slotTypes.ts (current):
```typescript
export function slotLabel(slot: ServiceSlot, _index?: number | string): string {
  switch (slot.kind) { ... }  // exhaustive switch, add 'HYMN' case
}

export function createSlot(kind: SlotKind, vwType?: VWType): ServiceSlot {
  switch (kind) { ... }  // add 'HYMN' case returning HymnSlot
}
```

From ServiceEditorView.vue (current Add Slot menu):
```html
<button type="button" @click="addSlot('SONG', 2)">Song</button>
<button type="button" @click="addSlot('SCRIPTURE')">Scripture Reading</button>
<button type="button" @click="addSlot('PRAYER')">Prayer</button>
<button type="button" @click="addSlot('MESSAGE')">Message</button>
```

Pattern for casting in ServiceEditorView template:
```html
:value="(slot as NonAssignableSlot).linkLabel"
@input="(slot as NonAssignableSlot).linkLabel = ($event.target as HTMLInputElement).value"
```

From src/utils/planningCenterExport.ts (current slot loop):
```typescript
for (const slot of service.slots) {
  if (slot.kind === 'SONG') { ... }
  else if (slot.kind === 'SCRIPTURE') { ... }
  else if (slot.kind === 'PRAYER') { ... }
  else if (slot.kind === 'MESSAGE') { ... }
  // add: else if (slot.kind === 'HYMN') { ... }
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add HymnSlot type and update slotTypes utilities</name>
  <files>src/types/service.ts, src/utils/slotTypes.ts, src/utils/__tests__/slotTypes.test.ts</files>
  <behavior>
    - createSlot('HYMN') returns { kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' }
    - slotLabel for HYMN slot returns 'Hymn'
    - TypeScript: SlotKind includes 'HYMN', ServiceSlot includes HymnSlot, switch statements are exhaustive
  </behavior>
  <action>
1. In `src/types/service.ts`:
   - Add 'HYMN' to `SlotKind` union: `export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'HYMN'`
   - Add new interface after NonAssignableSlot:
     ```typescript
     export interface HymnSlot {
       kind: 'HYMN'
       position: number
       hymnName: string
       hymnNumber: string
       verses: string
     }
     ```
   - Add HymnSlot to ServiceSlot union: `export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot`

2. In `src/utils/slotTypes.ts`:
   - Add 'HYMN' case to slotLabel: `case 'HYMN': return 'Hymn'`
   - Add 'HYMN' case to createSlot:
     ```typescript
     case 'HYMN':
       return { kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' } as HymnSlot
     ```
   - Update imports to include HymnSlot from @/types/service

3. In `src/utils/__tests__/slotTypes.test.ts`:
   - Add test: `createSlot('HYMN')` returns `{ kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' }`
   - Add test: `slotLabel({ kind: 'HYMN', position: 0, hymnName: '', hymnNumber: '', verses: '' })` returns `'Hymn'`

Write tests first (RED), then implement (GREEN).
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/utils/__tests__/slotTypes.test.ts</automated>
  </verify>
  <done>slotTypes tests pass including new HYMN cases; TypeScript compiles with no errors (npx vue-tsc --noEmit passes)</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update all rendering surfaces (editor, print, share, PC export)</name>
  <files>src/views/ServiceEditorView.vue, src/components/ServicePrintLayout.vue, src/views/ShareView.vue, src/utils/planningCenterExport.ts, src/utils/__tests__/planningCenterExport.test.ts</files>
  <behavior>
    - planningCenterExport: HYMN slot renders as "Hymn -- {hymnName} #{hymnNumber} (vv. {verses})" when filled, "Hymn -- [empty]" when hymnName is blank
    - ServiceEditorView: Add Slot menu has a "Hymn" entry calling addSlot('HYMN'); slot row shows Hymn label + three text inputs (Hymn Name, Hymn Number, Verses) for editor; viewer sees read-only display of filled values
    - ServicePrintLayout: HYMN slot renders label "Hymn" + filled values or [not assigned]
    - ShareView: HYMN slot renders label "Hymn" + filled values or [not assigned]
  </behavior>
  <action>
1. **`src/utils/planningCenterExport.ts`**: Add else-if branch in the slot loop:
   ```typescript
   } else if (slot.kind === 'HYMN') {
     if (!slot.hymnName) {
       lines.push('Hymn -- [empty]')
     } else {
       const numPart = slot.hymnNumber ? ` #${slot.hymnNumber}` : ''
       const versesPart = slot.verses ? ` (vv. ${slot.verses})` : ''
       lines.push(`Hymn -- ${slot.hymnName}${numPart}${versesPart}`)
     }
   }
   ```

2. **`src/utils/__tests__/planningCenterExport.test.ts`**: Add two tests:
   - HYMN slot with all fields filled → "Hymn -- Amazing Grace #337 (vv. 1, 3, 4)"
   - HYMN slot with empty hymnName → "Hymn -- [empty]"
   Write tests first (RED), then implement (GREEN).

3. **`src/views/ServiceEditorView.vue`**:
   a. Add import for HymnSlot: `import type { ..., HymnSlot } from '@/types/service'`
   b. In the Add Slot dropdown (around line 577), add after the Message button:
      ```html
      <button type="button" @click="addSlot('HYMN')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Hymn</button>
      ```
   c. In the slot list (after the MESSAGE template block), add a HYMN block:
      ```html
      <!-- HYMN slot -->
      <template v-else-if="slot.kind === 'HYMN'">
        <div class="mb-1">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hymn</p>
        </div>
        <!-- Editor: editable fields -->
        <div v-if="authStore.isEditor" class="flex flex-wrap items-center gap-2 mt-1">
          <input
            :value="(slot as HymnSlot).hymnName"
            @input="(slot as HymnSlot).hymnName = ($event.target as HTMLInputElement).value"
            type="text"
            placeholder="Hymn Name"
            class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1 min-w-32"
          />
          <input
            :value="(slot as HymnSlot).hymnNumber"
            @input="(slot as HymnSlot).hymnNumber = ($event.target as HTMLInputElement).value"
            type="text"
            placeholder="# (e.g. 337)"
            class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-24"
          />
          <input
            :value="(slot as HymnSlot).verses"
            @input="(slot as HymnSlot).verses = ($event.target as HTMLInputElement).value"
            type="text"
            placeholder="Verses (e.g. 1, 3, 4)"
            class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36"
          />
        </div>
        <!-- Viewer: read-only display -->
        <div v-else class="mt-1">
          <template v-if="(slot as HymnSlot).hymnName">
            <p class="text-sm text-gray-200">{{ (slot as HymnSlot).hymnName }}<template v-if="(slot as HymnSlot).hymnNumber"> #{{ (slot as HymnSlot).hymnNumber }}</template></p>
            <p v-if="(slot as HymnSlot).verses" class="text-xs text-gray-400">vv. {{ (slot as HymnSlot).verses }}</p>
          </template>
          <p v-else class="text-sm text-gray-400 italic">Hymn — Empty</p>
        </div>
      </template>
      ```

4. **`src/components/ServicePrintLayout.vue`**:
   Add import for HymnSlot and add HYMN block after the MESSAGE block:
   ```html
   <!-- HYMN slot -->
   <template v-else-if="slot.kind === 'HYMN'">
     <span class="font-semibold text-gray-700">Hymn</span>
     <template v-if="(slot as HymnSlot).hymnName">
       <span class="text-gray-500"> -- </span>
       <span class="text-gray-900">{{ (slot as HymnSlot).hymnName }}</span>
       <template v-if="(slot as HymnSlot).hymnNumber">
         <span class="text-gray-500"> #{{ (slot as HymnSlot).hymnNumber }}</span>
       </template>
       <template v-if="(slot as HymnSlot).verses">
         <span class="text-gray-600">  |  vv. {{ (slot as HymnSlot).verses }}</span>
       </template>
     </template>
     <template v-else>
       <span class="text-gray-500"> -- </span>
       <span class="text-gray-400 italic">[not assigned]</span>
     </template>
   </template>
   ```
   Update script setup: add `HymnSlot` to the type import from `@/types/service`.

5. **`src/views/ShareView.vue`**:
   Add HYMN block after the MESSAGE block:
   ```html
   <!-- HYMN slot -->
   <template v-else-if="slot.kind === 'HYMN'">
     <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Hymn</p>
     <template v-if="slot.hymnName">
       <p class="text-base font-medium text-gray-900">{{ slot.hymnName }}<template v-if="slot.hymnNumber"> #{{ slot.hymnNumber }}</template></p>
       <p v-if="slot.verses" class="text-sm text-gray-500">vv. {{ slot.verses }}</p>
     </template>
     <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
   </template>
   ```
   Note: ShareView uses `serviceSnapshot` typed as `any`, so `slot` is `any` — no cast needed. Access `slot.hymnName`, `slot.hymnNumber`, `slot.verses` directly.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/utils/__tests__/planningCenterExport.test.ts && npx vue-tsc --noEmit</automated>
  </verify>
  <done>All planningCenterExport tests pass including new HYMN tests; vue-tsc reports no type errors; Hymn appears as an option in the Add Slot dropdown in the app</done>
</task>

</tasks>

<verification>
- `npx vitest run src/utils/__tests__/slotTypes.test.ts` — all tests pass (including HYMN cases)
- `npx vitest run src/utils/__tests__/planningCenterExport.test.ts` — all tests pass (including HYMN cases)
- `npx vue-tsc --noEmit` — zero type errors (SlotKind union, ServiceSlot union, switch exhaustiveness)
- Dev server: open ServiceEditorView, click Add Slot — "Hymn" option is visible and clickable
- Adding Hymn slot: three inputs appear (Hymn Name, number, verses); data persists on save
</verification>

<success_criteria>
- 'HYMN' is a valid SlotKind and HymnSlot is a member of ServiceSlot
- createSlot('HYMN') returns a HymnSlot with empty string fields (not null — these are freeform text)
- slotLabel returns 'Hymn' for a HYMN slot
- ServiceEditorView: "Hymn" entry in Add Slot dropdown; editor sees three text inputs; viewer sees read-only display
- ServicePrintLayout: Hymn name + number + verses shown on print
- ShareView: Hymn name + number + verses shown on share page
- planningCenterExport: "Hymn -- {name} #{number} (vv. {verses})" in exported text
- All existing tests still pass (no regressions)
</success_criteria>

<output>
After completion, create `.planning/quick/18-add-hymn-slot-type-to-services-with-free/18-SUMMARY.md` following the summary template.
</output>
