---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/service.ts
  - src/utils/slotTypes.ts
  - src/utils/__tests__/slotTypes.test.ts
  - src/utils/planningCenterExport.ts
  - src/stores/services.ts
  - src/views/ServiceEditorView.vue
  - src/components/ServicePrintLayout.vue
  - src/views/ShareView.vue
  - src/components/ServiceCard.vue
  - src/components/SongSlotPicker.vue
  - src/views/__tests__/ServiceEditorView.test.ts
  - package.json
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "User can add a new element (Song, Scripture, Prayer, Message) to the service flow"
    - "User can remove any element from the service flow"
    - "User can drag-to-reorder any element in the service flow"
    - "Song slots let user pick VW type (1, 2, or 3) when adding, defaulting to type 2"
    - "Existing services with 9 fixed slots continue to render and function correctly"
    - "Print layout, share view, PC export, and service card all work with dynamic slot arrays"
  artifacts:
    - path: "src/utils/slotTypes.ts"
      provides: "createSlot() factory, slotLabel() helper, updated buildSlots()"
    - path: "src/views/ServiceEditorView.vue"
      provides: "Add element button, remove button per slot, drag handles, sortablejs integration"
    - path: "src/types/service.ts"
      provides: "SongSlot with requiredVwType as user-selectable, SlotKind includes all types"
  key_links:
    - from: "ServiceEditorView.vue"
      to: "slotTypes.ts"
      via: "createSlot() and slotLabel()"
      pattern: "createSlot|slotLabel"
    - from: "ServiceEditorView.vue"
      to: "sortablejs"
      via: "Sortable.create on slot container ref"
      pattern: "Sortable\\.create"
    - from: "stores/services.ts"
      to: "slotTypes.ts"
      via: "buildSlots for new service creation (still uses default 9-slot)"
      pattern: "buildSlots"
---

<objective>
Convert the fixed 9-slot service template into a dynamic slot list with add/remove and drag-to-reorder capabilities.

Purpose: Let users customize their service flow freely — adding, removing, and reordering songs, scripture readings, prayers, and messages — instead of being locked into the fixed 9-position template.

Output: Dynamic service editor with sortablejs drag-and-drop, add/remove buttons, and all downstream consumers (print, share, export, card) updated to work with slot arrays of any length.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/types/service.ts
@src/utils/slotTypes.ts
@src/stores/services.ts
@src/views/ServiceEditorView.vue
@src/components/SongSlotPicker.vue
@src/components/ServicePrintLayout.vue
@src/components/ServiceCard.vue
@src/views/ShareView.vue
@src/utils/planningCenterExport.ts

<interfaces>
<!-- Current types the executor needs to understand -->

From src/types/service.ts:
```typescript
export type Progression = '1-2-2-3' | '1-2-3-3'
export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE'
export interface SongSlot {
  kind: 'SONG'; position: number; requiredVwType: VWType;
  songId: string | null; songTitle: string | null; songKey: string | null;
}
export interface ScriptureSlot {
  kind: 'SCRIPTURE'; position: number;
  book: string | null; chapter: number | null; verseStart: number | null; verseEnd: number | null;
}
export interface NonAssignableSlot { kind: 'PRAYER' | 'MESSAGE'; position: number; }
export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot
export interface Service {
  id: string; date: string; name: string; progression: Progression; teams: string[];
  status: ServiceStatus; slots: ServiceSlot[]; sermonPassage: ScriptureRef | null;
  notes: string; createdAt: Timestamp; updatedAt: Timestamp;
}
```

From src/utils/slotTypes.ts:
```typescript
export const SLOT_LABELS: Record<number, string>  // position -> label
export function buildSlots(progression: Progression): ServiceSlot[]  // returns fixed 9 slots
```

From src/components/SongSlotPicker.vue:
```typescript
// Props:
requiredVwType: VWType; serviceTeams: string[];
currentSongId: string | null; songs: Song[];
// Emits: select, clear
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor slot model and utility layer for dynamic slots</name>
  <files>
    src/types/service.ts
    src/utils/slotTypes.ts
    src/utils/__tests__/slotTypes.test.ts
    src/utils/planningCenterExport.ts
    src/stores/services.ts
    src/views/__tests__/ServiceEditorView.test.ts
  </files>
  <action>
**1. Update `src/types/service.ts`:**
- Keep ALL existing types exactly as-is for backward compatibility. No fields removed.
- The `position` field on all slot types stays — it will be rewritten to match array index on save. This is a convention shift, not a type change.

**2. Refactor `src/utils/slotTypes.ts`:**

Keep `PROGRESSION_SLOT_TYPES` and `buildSlots()` — they still produce the default 9-slot template for new services.

Remove `SLOT_LABELS` (position-keyed map). Replace with a `slotLabel(slot: ServiceSlot, index: number): string` function that derives label from `slot.kind`:
- `SONG` -> "Worship Song" (or "Sending Song" if it is the last SONG slot in the array — check if `index` equals the last index where `kind === 'SONG'`)
  Actually, simpler: just use "Song" for all song slots. The old "Sending Song" distinction was positional and no longer meaningful in a dynamic list. Use `"Song"` for all.
- `SCRIPTURE` -> "Scripture Reading"
- `PRAYER` -> "Prayer"
- `MESSAGE` -> "Message"

Add a `createSlot(kind: SlotKind, vwType?: VWType): ServiceSlot` factory function:
- `SONG`: returns `{ kind: 'SONG', position: 0, requiredVwType: vwType ?? 2, songId: null, songTitle: null, songKey: null }` (default VW type 2 per constraint)
- `SCRIPTURE`: returns `{ kind: 'SCRIPTURE', position: 0, book: null, chapter: null, verseStart: null, verseEnd: null }`
- `PRAYER`: returns `{ kind: 'PRAYER', position: 0 }`
- `MESSAGE`: returns `{ kind: 'MESSAGE', position: 0 }`
Position will be set to array index when synced.

Add a `reindexSlots(slots: ServiceSlot[]): ServiceSlot[]` function that maps each slot to `{ ...slot, position: index }`. This normalizes positions after add/remove/reorder.

Export: `slotLabel`, `createSlot`, `reindexSlots`, `buildSlots`, `PROGRESSION_SLOT_TYPES` (keep for backward compat). Remove `SLOT_LABELS` export.

**3. Update `src/utils/planningCenterExport.ts`:**

Remove `SLOT_EXPORT_LABELS` (position-keyed map). In `formatForPlanningCenter`, derive labels the same way:
- Song slots: number them sequentially as "Song 1", "Song 2", etc. by counting SONG slots encountered so far
- Other kinds: use kind-based label ("Scripture", "Prayer", "Message")

**4. Update `src/stores/services.ts`:**

- `createService`: keep using `buildSlots('1-2-2-3')` for default template — new services still start with the classic 9-slot layout.
- `assignSongToSlot`: Change from finding by `slot.position === slotPosition` to finding by array index. Change signature to `assignSongToSlot(serviceId: string, slotIndex: number, song: ...)`. Find the slot at `service.slots[slotIndex]`. Keep the rest of the logic the same.
- `clearSongFromSlot`: Same change — use array index instead of position lookup. Change signature to `clearSongFromSlot(serviceId: string, slotIndex: number)`.

**5. Update `src/utils/__tests__/slotTypes.test.ts`:**
- Remove tests for `SLOT_LABELS` (deleted export).
- Keep all `buildSlots` and `PROGRESSION_SLOT_TYPES` tests (they still pass — buildSlots unchanged).
- Add tests for `createSlot`:
  - `createSlot('SONG')` returns SongSlot with requiredVwType 2 (default)
  - `createSlot('SONG', 1)` returns SongSlot with requiredVwType 1
  - `createSlot('SCRIPTURE')` returns ScriptureSlot with null fields
  - `createSlot('PRAYER')` returns NonAssignableSlot kind PRAYER
  - `createSlot('MESSAGE')` returns NonAssignableSlot kind MESSAGE
- Add tests for `reindexSlots`:
  - Given 3 slots with positions [5, 2, 8], returns slots with positions [0, 1, 2]
- Add tests for `slotLabel`:
  - Song slot returns "Song"
  - Scripture slot returns "Scripture Reading"
  - Prayer slot returns "Prayer"
  - Message slot returns "Message"

**6. Update `src/views/__tests__/ServiceEditorView.test.ts`:**
- Update mock service slots — they can keep the same 9-slot structure (it still works).
- Update any assertions that depend on `SLOT_LABELS` import if the test imports it directly. (Currently it doesn't — it just checks for "ORDER OF SERVICE" string from copy-for-PC.)
- No major changes needed — existing tests should still pass with the refactored code.

**IMPORTANT:** Do NOT change `buildSlots` output or the 9-slot default structure. New services still start with the classic layout. The dynamic add/remove is layered on top.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/utils/__tests__/slotTypes.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - `createSlot`, `reindexSlots`, `slotLabel` exported and tested
    - `SLOT_LABELS` removed from slotTypes.ts, `SLOT_EXPORT_LABELS` removed from planningCenterExport.ts
    - Store methods use array index instead of position lookup
    - All slotTypes tests pass
    - `npx vue-tsc --noEmit` passes (no type errors)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add/remove slots, drag-to-reorder, and update all downstream views</name>
  <files>
    src/views/ServiceEditorView.vue
    src/components/ServicePrintLayout.vue
    src/views/ShareView.vue
    src/components/ServiceCard.vue
    src/components/SongSlotPicker.vue
    package.json
  </files>
  <action>
**0. Install sortablejs:**
Run `npm install sortablejs` and `npm install -D @types/sortablejs`.

**1. Update `src/views/ServiceEditorView.vue`:**

This is the main editor. Major changes:

**a) Replace SLOT_LABELS usage:**
- Import `slotLabel` from `@/utils/slotTypes` instead of `SLOT_LABELS`.
- In the template, replace `SLOT_LABELS[slot.position]` with `slotLabel(slot, index)` (use `v-for="(slot, index) in localService.slots"` to get index).

**b) Add "Add Element" button below the slot list:**
Create an "Add Element" dropdown/button group at the bottom of the slots list. Use a simple dropdown (not a library — just a `ref<boolean>` toggle):

```html
<div class="mt-2 relative">
  <button @click="showAddMenu = !showAddMenu" class="...">
    + Add Element
  </button>
  <div v-if="showAddMenu" class="absolute ...">
    <button @click="addSlot('SONG', 1)">Song (Type 1: Call to Worship)</button>
    <button @click="addSlot('SONG', 2)">Song (Type 2: Intimate)</button>
    <button @click="addSlot('SONG', 3)">Song (Type 3: Ascription)</button>
    <button @click="addSlot('SCRIPTURE')">Scripture Reading</button>
    <button @click="addSlot('PRAYER')">Prayer</button>
    <button @click="addSlot('MESSAGE')">Message</button>
  </div>
</div>
```

Style the dropdown menu with dark theme classes: `bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20`. Each menu item: `px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors`. Add a click-away handler (click on backdrop div to close).

The `addSlot` function:
```typescript
import { createSlot, reindexSlots } from '@/utils/slotTypes'
function addSlot(kind: SlotKind, vwType?: VWType) {
  if (!localService.value) return
  const newSlot = createSlot(kind, vwType)
  localService.value.slots.push(newSlot)
  localService.value.slots = reindexSlots(localService.value.slots)
  showAddMenu.value = false
}
```

**c) Add remove button to every slot:**
Add an X button (same style as the existing clear-song X) at the top-right of each slot card. On click, call:
```typescript
function removeSlot(index: number) {
  if (!localService.value) return
  localService.value.slots.splice(index, 1)
  localService.value.slots = reindexSlots(localService.value.slots)
}
```

**d) Add VW type selector to Song slots:**
For SONG slots, add a small row of 3 type-selector buttons (1, 2, 3) below the slot label that let the user change the requiredVwType. Highlight the active type. When clicked:
```typescript
function changeVwType(index: number, vwType: VWType) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (slot.kind === 'SONG') {
    (localService.value.slots[index] as SongSlot).requiredVwType = vwType
  }
}
```
Style: 3 small pill buttons ("1", "2", "3") with the active one having `bg-indigo-600 text-white` and inactive having `bg-gray-800 text-gray-400 hover:bg-gray-700`. Place them inline after the VW type label text.

**e) Add drag handles and integrate sortablejs:**
Import Sortable from 'sortablejs'. Add a template ref for the slot container `<div ref="slotContainerRef" class="space-y-1.5">`.

Add a drag handle to every slot card — a 6-dot grip icon (two columns of 3 dots) at the left edge of each slot card. Use inline SVG:
```html
<div class="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 drag-handle flex-shrink-0">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
  </svg>
</div>
```

Initialize Sortable in `onMounted` (after the slot container is rendered). Use a `watch` on `localService` to initialize once it loads:
```typescript
import Sortable from 'sortablejs'

const slotContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

watch(slotContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'opacity-30',
      onEnd(evt) {
        if (!localService.value || evt.oldIndex == null || evt.newIndex == null) return
        const slots = [...localService.value.slots]
        const [moved] = slots.splice(evt.oldIndex, 1)
        slots.splice(evt.newIndex, 0, moved)
        localService.value.slots = reindexSlots(slots)
      },
    })
  }
}, { flush: 'post' })

onUnmounted(() => {
  sortableInstance?.destroy()
})
```

IMPORTANT: SortableJS physically moves DOM elements, which can conflict with Vue's virtual DOM. To prevent this, use `:key="slot.position + '-' + slot.kind + '-' + index"` on the `v-for` to force Vue to re-render after Sortable moves items. Also, in the `onEnd` callback, after updating the reactive array, call `nextTick` if needed. The standard pattern is to update the data model in `onEnd` and let Vue re-render — since we're using `reindexSlots` which creates a new array, Vue will reconcile correctly.

**f) Update slot layout to accommodate drag handle and remove button:**
Change each slot card from:
```html
<div class="rounded-lg bg-gray-900 border border-gray-800 p-3">
```
to:
```html
<div class="rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-start gap-2">
  <!-- drag handle -->
  <div class="drag-handle ...">...</div>
  <!-- slot content (flex-1) -->
  <div class="flex-1 min-w-0">
    ...existing slot template content...
  </div>
  <!-- remove button -->
  <button @click="removeSlot(index)" class="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5" title="Remove element">
    <svg ...X icon... class="h-4 w-4" />
  </button>
</div>
```

**g) Update `onSelectSong` and `onClearSong` to use array index:**
These currently find by `slot.position`. Change to use the array index directly:
```typescript
function onSelectSong(index: number, song: { id: string; title: string; key: string }) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (slot.kind === 'SONG') {
    localService.value.slots[index] = { ...slot, songId: song.id, songTitle: song.title, songKey: song.key }
  }
}
function onClearSong(index: number) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (slot.kind === 'SONG') {
    localService.value.slots[index] = { ...slot, songId: null, songTitle: null, songKey: null }
  }
}
```
Update template to pass `index` instead of `slot` to these handlers.

**h) Update `onScriptureChange` similarly** to use array index.

**i) Update the `onSave` function:**
The save function currently iterates slots comparing by position. Change the comparison to use array index:
```typescript
for (let i = 0; i < localService.value.slots.length; i++) {
  const slot = localService.value.slots[i]
  if (slot.kind === 'SONG') {
    const origSlot = original.slots[i]
    // ... rest of logic using index i
  }
}
```
And call `serviceStore.assignSongToSlot(id, i, ...)` / `serviceStore.clearSongFromSlot(id, i)` with the array index.

Actually, since the store now uses array index too, and the full slots array is written via `updateService`, the individual assignSongToSlot/clearSongFromSlot calls for lastUsedAt tracking can just iterate by songId comparison rather than position. Simplify: iterate all SONG slots, if songId changed from original, update lastUsedAt. The slot position matching is no longer reliable after reorder.

Better approach for onSave: Compare song IDs between old and new slots globally:
```typescript
// Collect all songIds in new slots
const newSongIds = new Set(
  localService.value.slots
    .filter(s => s.kind === 'SONG' && s.songId)
    .map(s => (s as SongSlot).songId!)
)
const oldSongIds = new Set(
  original.slots
    .filter(s => s.kind === 'SONG' && s.songId)
    .map(s => (s as SongSlot).songId!)
)
// Update lastUsedAt for newly added songs
for (const songId of newSongIds) {
  if (!oldSongIds.has(songId)) {
    const slot = localService.value.slots.find(s => s.kind === 'SONG' && (s as SongSlot).songId === songId) as SongSlot
    await songStore.updateSong(songId, { lastUsedAt: serverTimestamp() as never })
  }
}
```
Then just do a single `updateService(id, { ...data, slots: reindexSlots(data.slots) })` to persist.

**2. Update `src/components/ServicePrintLayout.vue`:**
- Import `slotLabel` from `@/utils/slotTypes` instead of `SLOT_LABELS`.
- Change `v-for` to `v-for="(slot, index) in props.service.slots"` and use `slotLabel(slot, index)` instead of `SLOT_LABELS[slot.position]`.

**3. Update `src/views/ShareView.vue`:**
- Import `slotLabel` from `@/utils/slotTypes` instead of `SLOT_LABELS`.
- Change `v-for` to `v-for="(slot, index) in serviceSnapshot.slots"` and use `slotLabel(slot, index)` instead of `SLOT_LABELS[slot.position]`.

**4. Update `src/components/ServiceCard.vue`:**
- ServiceCard currently splits slots into `openingSlots` (before MESSAGE) and `sendingSlots` (after MESSAGE). This still works fine with dynamic arrays — `findIndex` for MESSAGE still works regardless of slot count.
- No changes needed unless the `slotLabel` function was used (it wasn't — ServiceCard uses its own `slotLabel` local function). The local `slotLabel` function already works by `kind`, not by position. No changes needed.

**5. Update `src/components/SongSlotPicker.vue`:**
- No changes to SongSlotPicker itself. Its props (`requiredVwType`, `serviceTeams`, `currentSongId`, `songs`) are unchanged. The parent (ServiceEditorView) passes these correctly.
- The search results filter `s.vwType === props.requiredVwType` still works since `requiredVwType` is now user-selectable per slot.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    - "Add Element" dropdown at bottom of slot list with Song (Type 1/2/3), Scripture, Prayer, Message options
    - Each slot has a drag handle (left) and remove X button (right)
    - Dragging a slot reorders the array and reindexes positions
    - Song slots show VW type selector (1/2/3 pill buttons)
    - Print layout, share view render dynamic slot arrays correctly using kind-based labels
    - Service card continues to split before/after MESSAGE correctly
    - All tests pass, `npx vue-tsc --noEmit` passes
    - `sortablejs` and `@types/sortablejs` in package.json
  </done>
</task>

</tasks>

<verification>
1. `cd C:/projects/worshipplanner && npx vitest run --reporter=verbose` — all tests pass
2. `cd C:/projects/worshipplanner && npx vue-tsc --noEmit` — no type errors
3. `cd C:/projects/worshipplanner && npm run build` — production build succeeds
4. Manual check: Open a service editor, add a Song slot, add a Scripture slot, remove the Prayer slot, drag a slot to reorder. Save. Reload. Confirm the reordered dynamic layout persists.
5. Manual check: Create a new service — it still starts with the default 9-slot template.
6. Manual check: Print a service with a modified slot layout — print layout renders all slots correctly.
</verification>

<success_criteria>
- Dynamic slot add/remove/reorder fully functional in ServiceEditorView
- sortablejs drag-and-drop working with drag handles
- Song slots have VW type selector (1/2/3), default type 2
- All downstream views (print, share, export, card) work with variable-length slot arrays
- Existing services render without migration (position field maintained for compat)
- New services start with default 9-slot template
- All vitest tests pass, TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/2-dynamic-service-flow-add-remove-slots-dr/2-SUMMARY.md`
</output>
