---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
  - src/views/ServicesView.vue
  - src/components/ServiceCard.vue
  - src/components/SongSlideOver.vue
autonomous: true
must_haves:
  truths:
    - "Service editor shows all 9 slots at a glance without excessive scrolling"
    - "Assigned songs in editor display CCLI number as clickable SongSelect link"
    - "Song editing slide-over no longer shows Arrangements section"
    - "Service list displays as compact grid cards reading left to right"
    - "Each service card in list mode has Share and Print action buttons"
  artifacts:
    - path: "src/views/ServiceEditorView.vue"
      provides: "Compact editor with CCLI links, reduced whitespace"
    - path: "src/views/ServicesView.vue"
      provides: "Grid layout for service cards"
    - path: "src/components/ServiceCard.vue"
      provides: "Compact card with Share/Print buttons"
    - path: "src/components/SongSlideOver.vue"
      provides: "Song editor without arrangements section"
  key_links:
    - from: "src/views/ServiceEditorView.vue"
      to: "songStore.songs"
      via: "CCLI lookup by slot.songId"
      pattern: "songStore\\.songs\\.find.*songId"
    - from: "src/components/ServiceCard.vue"
      to: "serviceStore.createShareToken"
      via: "Share button click handler"
      pattern: "createShareToken"
---

<objective>
UX tweaks across the service editor and service list views: compact the editor for at-a-glance scanning, add CCLI SongSelect links, remove the arrangements section from song editing, and convert the service list to a compact grid with Share/Print buttons on each card.

Purpose: Improve daily usability — the editor should show the full service plan without scrolling, CCLI links enable quick song lookup, and the grid list with action buttons reduces clicks.
Output: Updated ServiceEditorView, ServicesView, ServiceCard, and SongSlideOver components.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/views/ServiceEditorView.vue
@src/views/ServicesView.vue
@src/components/ServiceCard.vue
@src/components/SongSlideOver.vue
@src/components/ArrangementAccordion.vue
@src/types/song.ts
@src/types/service.ts
@src/stores/services.ts

<interfaces>
<!-- Key types the executor needs -->

From src/types/song.ts:
```typescript
export interface Song {
  id: string
  title: string
  ccliNumber: string       // <-- needed for CCLI link
  author: string
  themes: string[]
  notes: string
  vwType: VWType | null
  teamTags: string[]
  arrangements: Arrangement[]
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

From src/types/service.ts:
```typescript
export interface SongSlot {
  kind: 'SONG'
  position: number
  requiredVwType: VWType
  songId: string | null     // <-- use to look up Song.ccliNumber
  songTitle: string | null
  songKey: string | null
}

export interface Service {
  id: string
  date: string
  name: string
  progression: Progression
  teams: string[]
  status: ServiceStatus
  slots: ServiceSlot[]
  sermonPassage: ScriptureRef | null
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

From src/stores/services.ts:
```typescript
// createShareToken is already implemented — reuse in ServiceCard
async function createShareToken(service: Service, orgIdValue: string): Promise<string>
```

CCLI SongSelect URL pattern: `https://songselect.ccli.com/songs/{ccliNumber}`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Compact ServiceEditorView + CCLI links + remove arrangements from SongSlideOver</name>
  <files>src/views/ServiceEditorView.vue, src/components/SongSlideOver.vue</files>
  <action>
**ServiceEditorView.vue — Compact layout:**
1. Reduce vertical spacing throughout:
   - Change outer `px-6 py-8` to `px-6 py-4`
   - Change `mb-6` on Team Configuration section to `mb-3`
   - Change Sermon Passage section `mb-6` to `mb-3`, and reduce its inner padding from `p-4` to `p-3`
   - Change slot list `space-y-3` to `space-y-1.5`
   - Change each slot card `p-4` to `p-3`
   - Change `mb-2` on the slot header (line 171 area) to `mb-1`
   - Remove the `mb-5` on the "Back to Services" link, change to `mb-3`
   - Change header section `mb-6` to `mb-3`
   - Team Configuration section: reduce padding from `p-4` to `p-3`, reduce `mb-3` label margin to `mb-2`
   - Bottom save section: change `mt-6` to `mt-3`

2. **CCLI link on assigned songs:** In the assigned song display block (the `v-if="slot.songId"` div, around lines 184-199):
   - Add a helper computed/function `getCcliNumber(songId: string): string | null` that does `songStore.songs.find(s => s.id === songId)?.ccliNumber || null`
   - Below the song title line (`<p class="text-sm font-medium text-gray-100">{{ slot.songTitle }}</p>`), replace the existing `<p class="text-xs text-gray-500">Key: {{ slot.songKey }}</p>` with a row that shows both key AND CCLI link:
   ```html
   <p class="text-xs text-gray-500">
     Key: {{ slot.songKey }}
     <template v-if="getCcliNumber(slot.songId)">
       <span class="text-gray-700 mx-1">|</span>
       <a
         :href="`https://songselect.ccli.com/songs/${getCcliNumber(slot.songId)}`"
         target="_blank"
         rel="noopener"
         class="text-indigo-400 hover:text-indigo-300 hover:underline"
         @click.stop
       >CCLI {{ getCcliNumber(slot.songId) }}</a>
     </template>
   </p>
   ```

**SongSlideOver.vue — Remove arrangements section:**
1. Delete the entire Arrangements section (lines 167-198 in template — the `<div>` containing the "Arrangements" label, "Add Arrangement" button, empty state, and `<ArrangementAccordion>` loop).
2. Remove the `import ArrangementAccordion` import statement.
3. Remove the `addArrangement`, `updateArrangement`, and `removeArrangement` functions from the script.
4. Keep the `form.arrangements` in the form state (so existing data is preserved on save), but simply do not render it.
5. Remove `availableTags` computed if it was only used by ArrangementAccordion — check: it is also passed as prop to ArrangementAccordion. The `songLevelTags` computed uses `availableTags`, so keep `availableTags` but remove the ArrangementAccordion-specific prop usage only if needed. Actually, `availableTags` is used ONLY by ArrangementAccordion's `:availableTags` prop, but `songLevelTags` references it. Keep both — no harm, they are still used for the song-level Team Tags section.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - ServiceEditorView has visibly reduced whitespace (py-4, mb-3, space-y-1.5, p-3 throughout)
    - Assigned song slots show "Key: X | CCLI 12345" with CCLI as clickable link to songselect.ccli.com
    - SongSlideOver no longer renders the Arrangements section (ArrangementAccordion import removed, template section removed)
    - Existing arrangement data is preserved in form state (not deleted on save)
  </done>
</task>

<task type="auto">
  <name>Task 2: Grid service list with Share/Print buttons on ServiceCard</name>
  <files>src/views/ServicesView.vue, src/components/ServiceCard.vue</files>
  <action>
**ServicesView.vue — Grid layout:**
1. Change the upcoming services container from `<div class="space-y-2">` to a responsive grid:
   ```html
   <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
   ```
2. Do the same for the past services container — change `<div v-if="showPast" class="space-y-2">` to:
   ```html
   <div v-if="showPast" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
   ```

**ServiceCard.vue — Compact card with Share/Print:**
1. Change the card from a horizontal row layout to a compact vertical card layout. Replace the entire template:
   - Remove the outer `flex items-start gap-4` layout
   - New structure: vertical card with date header, compact slot list, and action footer
   - Template structure:
   ```html
   <div class="rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer overflow-hidden">
     <!-- Clickable card body (navigates to editor) -->
     <router-link :to="'/services/' + service.id" class="block px-3 py-2.5">
       <!-- Top row: date + status -->
       <div class="flex items-center justify-between gap-2 mb-1.5">
         <div class="flex items-center gap-2 min-w-0">
           <p class="text-sm font-semibold text-gray-100">{{ formattedDate }}</p>
           <span v-if="isCommunion" class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/50 text-amber-300 border border-amber-800">Communion</span>
         </div>
         <span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold shrink-0" :class="statusClass">{{ service.status }}</span>
       </div>
       <p v-if="service.name" class="text-xs font-medium text-indigo-300 mb-1.5 truncate">{{ service.name }}</p>

       <!-- Compact slot summary -->
       <div class="text-xs space-y-0.5">
         <template v-for="slot in openingSlots" :key="slot.position">
           <p class="truncate" :class="slotTextClass(slot)">{{ slotLabel(slot) }}</p>
         </template>
         <p class="text-gray-600 text-[10px] my-0.5">--- Message{{ service.sermonPassage ? ` — ${service.sermonPassage.book} ${service.sermonPassage.chapter}` : '' }} ---</p>
         <template v-for="slot in sendingSlots" :key="slot.position">
           <p class="truncate" :class="slotTextClass(slot)">{{ slotLabel(slot) }}</p>
         </template>
       </div>
     </router-link>

     <!-- Action footer: Share + Print (outside router-link to avoid navigation) -->
     <div class="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-800/50">
       <button type="button" @click="onShare" :disabled="isSharing" class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors" title="Share">
         <svg v-if="!shareCopied" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
           <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
         </svg>
         <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
           <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
         </svg>
         {{ isSharing ? '...' : shareCopied ? 'Copied!' : 'Share' }}
       </button>
       <button type="button" @click="onPrint" class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors" title="Print">
         <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
           <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
         </svg>
         Print
       </button>
     </div>
   </div>
   ```

2. Add Share and Print functionality to the script section:
   - Import `useServiceStore` and `useSongStore` from stores
   - Import `useRouter` from vue-router
   - Add reactive state: `isSharing = ref(false)`, `shareCopied = ref(false)`
   - Add `onShare` function: calls `serviceStore.createShareToken(props.service, serviceStore.orgId)`, copies URL to clipboard, shows "Copied!" feedback for 2 seconds. Guard: if `!serviceStore.orgId` return early.
   - Add `onPrint` function: navigates to `/services/${props.service.id}` then triggers `window.print()` after a short delay. Simplest approach: `router.push('/services/' + props.service.id).then(() => { setTimeout(() => window.print(), 300) })`. This opens the editor view which already has the print layout, then prints.
   - Remove the esvLink import and scripture link rendering from the card body — the compact card just shows text labels, no clickable scripture links (keeps cards compact). Keep `esvLink` import only if still used; otherwise remove it. Actually, since we are removing the `<a>` tags from the card body, the import is no longer needed. Remove it.

3. Ensure the card outer wrapper is NOT wrapped in `<router-link>` at the top level (the router-link is now inside the card, not wrapping it). The footer action buttons must NOT trigger navigation.

**Important Tailwind v4 note:** The grid classes (grid-cols-1, sm:grid-cols-2, lg:grid-cols-3) are standard responsive utilities and will work. The `text-[10px]` and `text-[11px]` arbitrary values also work in Tailwind v4.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -20 && npx vite build 2>&1 | tail -5</automated>
  </verify>
  <done>
    - ServicesView renders service cards in a responsive grid (1 col mobile, 2 col sm, 3 col lg)
    - ServiceCard is a compact vertical card showing date, status, slot summary
    - Each card has Share and Print buttons in a footer row
    - Share button creates a share token and copies link to clipboard
    - Print button navigates to the editor view and triggers window.print()
    - Cards read left-to-right in the grid (natural grid flow)
  </done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes with zero type errors
- `npx vite build` completes successfully
- Visual check: service editor shows all 9 slots compactly, CCLI links visible on assigned songs
- Visual check: service list shows cards in grid layout with Share/Print buttons
- SongSlideOver no longer shows Arrangements section
</verification>

<success_criteria>
- ServiceEditorView fits all 9 slots in less vertical space (reduced padding/margins throughout)
- Assigned songs display CCLI number as clickable link to songselect.ccli.com/songs/{ccliNumber}
- SongSlideOver has no Arrangements section visible
- ServicesView uses CSS grid for card layout (responsive 1/2/3 columns)
- ServiceCard has functional Share (clipboard copy) and Print (navigate + print) buttons
- All TypeScript compilation passes, production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/1-ux-tweaks-compact-edit-mode-ccli-links-r/1-SUMMARY.md`
</output>
