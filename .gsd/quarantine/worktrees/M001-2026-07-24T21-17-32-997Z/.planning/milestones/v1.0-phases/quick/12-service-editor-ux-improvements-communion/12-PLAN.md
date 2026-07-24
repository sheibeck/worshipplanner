---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/service.ts
  - src/views/ServiceEditorView.vue
  - src/components/NewServiceDialog.vue
autonomous: true
requirements: [QUICK-12]
must_haves:
  truths:
    - "Communion appears as a visible checkbox in the Teams row (editor and new-service dialog)"
    - "On the 1st Sunday of the month, Communion is checked by default when a service is created or loaded"
    - "PRAYER and MESSAGE slots show an optional URL/label input row"
    - "A URL saved on a PRAYER/MESSAGE slot is visible and clickable in the editor"
    - "SONG slot header no longer shows 1/2/3 type-selector buttons"
    - "SONG slot header shows the VW type badge (guideline) only"
    - "An assigned song displays its title, key, and CCLI on a single compact line"
  artifacts:
    - path: src/types/service.ts
      provides: "NonAssignableSlot with optional linkUrl and linkLabel fields"
      contains: "linkUrl"
    - path: src/views/ServiceEditorView.vue
      provides: "All 4 UX changes applied"
    - path: src/components/NewServiceDialog.vue
      provides: "Communion in availableTeams with 1st-Sunday auto-check"
  key_links:
    - from: src/types/service.ts
      to: src/views/ServiceEditorView.vue
      via: "NonAssignableSlot.linkUrl read and written in PRAYER/MESSAGE template block"
      pattern: "linkUrl"
    - from: isCommunion computed
      to: localService.teams
      via: "watch on parsedDate auto-adds Communion when 1st Sunday"
      pattern: "Communion"
---

<objective>
Apply four focused UX improvements to the service editor.

Purpose: Reduce friction when setting up services, make VW type a visible guideline not a user-editable field, and compress vertical space in song slots.
Output: Updated ServiceEditorView.vue, NewServiceDialog.vue, and service.ts types.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md

Key decisions in effect:
- Dark mode canonical palette: gray-950 body, gray-900 cards, gray-800 inputs
- Static class lookup objects required to prevent Tailwind v4 purge of dynamic color classes
- AVAILABLE_TEAMS in ServiceEditorView.vue (line 503): ['Choir', 'Orchestra', 'Special Service']
- availableTeams in NewServiceDialog.vue (line 133): ['Choir', 'Orchestra', 'Special Service']
- isCommunion computed (ServiceEditorView line 596): getDay()===0 && getDate()<=7 (already correct logic for 1st Sunday)
- NonAssignableSlot (service.ts line 26): only has kind and position — needs linkUrl/linkLabel added
- VW type selector buttons are at ServiceEditorView lines 266-278 (v-for over [1,2,3])
- Assigned song block is at lines 283-303: title on p.text-sm, key+CCLI on second p.text-xs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Communion team + 1st-Sunday auto-check</name>
  <files>src/views/ServiceEditorView.vue, src/components/NewServiceDialog.vue</files>
  <action>
In ServiceEditorView.vue:
1. Line 503 — change AVAILABLE_TEAMS to: ['Choir', 'Orchestra', 'Communion', 'Special Service']
   (Communion before Special Service; Special Service still triggers the name input)

2. Add a watcher on parsedDate that auto-adds 'Communion' to localService.value.teams when the
   date is the 1st Sunday of the month, and removes it when it is not — but only when the
   service has not already been manually edited (i.e., on initial load before isDirty becomes
   true). The safest approach: in the existing watch on `localService` (or in the watch that
   initialises localService from the store), after setting localService.value, apply the
   communion auto-default if teams does not already contain 'Communion' AND the date is the 1st
   Sunday. Use the existing isCommunion computed for the date check.

   Concretely: inside the watch that sets `localService.value = { ...service }` (around line
   540-560), after the assignment, add:
   ```ts
   if (isCommunion.value && localService.value && !localService.value.teams.includes('Communion')) {
     localService.value.teams.push('Communion')
   }
   ```
   This fires only on initial load (watch runs once when store data arrives), so it does not
   override manual user changes.

In NewServiceDialog.vue:
1. Line 133 — change availableTeams to: ['Choir', 'Orchestra', 'Communion', 'Special Service']

2. In the existing `sundayOrdinalForm` (or wherever `form.value` is initialised from a date, around
   lines 164-167), after the ordinal-based teams default, add:
   ```ts
   const day = /* parsed day from dateStr */
   if (ordinal === 1) teams.push('Communion')
   ```
   Actually: the existing logic at line 164-167 sets teams based on ordinal. Extend it:
   ```ts
   if (ordinal === 1) teams = ['Orchestra', 'Communion']
   else if (ordinal === 3) teams = ['Choir']
   ```
   And replicate for the watcher at lines 187-193:
   ```ts
   if (ordinal === 1) form.value.teams = ['Orchestra', 'Communion']
   else if (ordinal === 3) form.value.teams = ['Choir']
   else form.value.teams = []
   ```
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - "Communion" checkbox visible in Teams row in both editor and new-service dialog
    - Creating/opening a service dated on a 1st Sunday pre-checks Communion
    - Non-1st Sundays do not pre-check Communion
    - Manual uncheck is not overridden on subsequent renders
  </done>
</task>

<task type="auto">
  <name>Task 2: Add optional link (URL + label) to PRAYER and MESSAGE slots</name>
  <files>src/types/service.ts, src/views/ServiceEditorView.vue</files>
  <action>
In src/types/service.ts:
Extend NonAssignableSlot to add optional link fields:
```ts
export interface NonAssignableSlot {
  kind: 'PRAYER' | 'MESSAGE'
  position: number
  linkUrl?: string
  linkLabel?: string
}
```
No migration needed — optional fields default to undefined on existing documents; Firestore
returns undefined for missing fields which Vue treats as falsy.

In src/views/ServiceEditorView.vue:

Replace the PRAYER slot template block (currently ~lines 382-388):
```html
<!-- PRAYER slot -->
<template v-else-if="slot.kind === 'PRAYER'">
  <div class="flex items-center gap-2 mb-1">
    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prayer</p>
    <span class="text-xs text-gray-600 italic">No assignment needed</span>
  </div>
  <!-- Optional link -->
  <div class="flex items-center gap-2 mt-1">
    <input
      :value="(slot as NonAssignableSlot).linkLabel"
      @input="(slot as NonAssignableSlot).linkLabel = ($event.target as HTMLInputElement).value"
      type="text"
      placeholder="Link label (optional)"
      class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 w-36"
    />
    <input
      :value="(slot as NonAssignableSlot).linkUrl"
      @input="(slot as NonAssignableSlot).linkUrl = ($event.target as HTMLInputElement).value"
      type="url"
      placeholder="https://..."
      class="rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500 flex-1"
    />
    <a
      v-if="(slot as NonAssignableSlot).linkUrl"
      :href="(slot as NonAssignableSlot).linkUrl"
      target="_blank"
      rel="noopener"
      class="text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
      title="Open link"
      @click.stop
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  </div>
</template>
```

Apply the identical pattern to the MESSAGE slot template block (~lines 390-396), changing the
label from "Prayer" to "Message".

Import NonAssignableSlot from '@/types/service' at the top of script setup if not already
imported (check existing imports — it is likely already imported as part of the ServiceSlot union;
if not, add it).

Note: The isDirty JSON.stringify detection will automatically pick up linkUrl/linkLabel changes
since the fields are part of localService.value.slots objects.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - PRAYER and MESSAGE slots show a label input + URL input below the slot header
    - Both inputs are optional — leaving them blank shows no link icon
    - Entering a URL shows the external-link icon; clicking it opens the URL
    - isDirty detects when URL/label changes (save button activates)
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Remove VW type 1/2/3 buttons; compact assigned-song row</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
CHANGE 1 — Remove VW type selector buttons from SONG slot header.

Find the block in the SONG slot template (around lines 256-282):
```html
<!-- VW type selector buttons -->
<div class="flex items-center gap-1 ml-1">
  <button
    v-for="vt in ([1, 2, 3] as VWType[])"
    ...
  >{{ vt }}</button>
</div>
```
Delete this entire `<div>` block (the one containing the v-for buttons). Also delete the
`<p>` element that shows `vwTypeLabels[slot.requiredVwType]` (verbose label like "Type 1: Call
to Worship") since the SongBadge already conveys type visually.

After removal the SONG slot header row should look like:
```html
<div class="flex items-center justify-between gap-3 mb-1">
  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
    {{ slotLabel(slot, index) }}
  </p>
  <SongBadge :type="slot.requiredVwType" />
</div>
```
(Keep SongBadge on the right — it is the guideline indicator.)

Also remove the `changeVwType` function from the script section (~line 746-752) since it is
no longer called anywhere. This prevents a TypeScript unused-function lint warning.

CHANGE 2 — Compress assigned-song block to a single line.

Find the assigned-song display block (~lines 283-303):
```html
<div v-if="slot.songId" class="flex items-center justify-between ...">
  <div>
    <p class="text-sm font-medium text-gray-100">{{ slot.songTitle }}</p>
    <p class="text-xs text-gray-500">
      Key: {{ slot.songKey }}
      <template v-if="getCcliNumber(slot.songId)">
        <span ...>|</span>
        <a ...>CCLI {{ getCcliNumber(slot.songId) }}</a>
      </template>
    </p>
  </div>
  <button ...><!-- clear X --></button>
</div>
```

Replace the `<div>` inner content so title, key, and CCLI appear on ONE line:
```html
<div v-if="slot.songId" class="flex items-center justify-between gap-3 rounded-md bg-gray-800 border border-gray-700 px-3 py-2">
  <div class="flex items-center gap-2 min-w-0 flex-1">
    <p class="text-sm font-medium text-gray-100 truncate">{{ slot.songTitle }}</p>
    <span class="text-gray-600 flex-shrink-0">·</span>
    <span class="text-xs text-gray-400 flex-shrink-0">{{ slot.songKey || '—' }}</span>
    <template v-if="getCcliNumber(slot.songId)">
      <span class="text-gray-700 flex-shrink-0">|</span>
      <a
        :href="`https://songselect.ccli.com/songs/${getCcliNumber(slot.songId)}`"
        target="_blank"
        rel="noopener"
        class="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex-shrink-0"
        @click.stop
      >CCLI {{ getCcliNumber(slot.songId) }}</a>
    </template>
  </div>
  <button
    type="button"
    @click="onClearSong(index)"
    class="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
    title="Remove song"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - SONG slot header row shows slot label + SongBadge only (no 1/2/3 buttons, no verbose label)
    - Assigned song shows title · key | CCLI all on one line with truncation on long titles
    - Build succeeds with no TypeScript errors
    - changeVwType function removed from script (no dead-code warning)
  </done>
</task>

</tasks>

<verification>
npm run build — zero errors, zero warnings.
Manual check: open a service in the editor, confirm:
1. Teams row shows Choir / Orchestra / Communion / Special Service checkboxes
2. On a 1st-Sunday service, Communion is pre-checked on load
3. PRAYER and MESSAGE slots show the label + URL inputs
4. SONG slot header has no 1/2/3 buttons; just slot label + SongBadge
5. Assigned song: title, key, CCLI on one compact line
</verification>

<success_criteria>
All four UX changes visible in the editor with zero build errors. Communion auto-defaults on 1st Sundays. URL links on PRAYER/MESSAGE save and display correctly.
</success_criteria>

<output>
After completion, create `.planning/quick/12-service-editor-ux-improvements-communion/12-SUMMARY.md`
</output>
