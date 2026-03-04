---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SongTable.vue
  - src/views/ServicesView.vue
  - src/components/ServiceCard.vue
  - src/views/ServiceEditorView.vue
autonomous: true
requirements: [QOL-CCLI, QOL-DRAFT-STATUS, QOL-PAST-FILTER, QOL-COMPACT-SLOTS]
must_haves:
  truths:
    - "Song list shows CCLI number instead of BPM column"
    - "Clicking CCLI number in song list opens songselect.ccli.com link in new tab"
    - "Past services are hidden by default and shown via toggle"
    - "Past services toggle shows at most 5 most recent past services"
    - "Service cards show a lock icon next to planned status badge"
    - "Prayer and Message slots show label and 'No assignment needed' on same line"
  artifacts:
    - path: "src/components/SongTable.vue"
      provides: "CCLI column replacing BPM"
    - path: "src/views/ServicesView.vue"
      provides: "Past service filter with 5-item limit"
    - path: "src/components/ServiceCard.vue"
      provides: "Lock icon on planned services"
    - path: "src/views/ServiceEditorView.vue"
      provides: "Compact prayer/message slots, draft/planned toggle"
  key_links:
    - from: "src/components/SongTable.vue"
      to: "https://songselect.ccli.com/songs/{ccliNumber}"
      via: "anchor tag href"
      pattern: "songselect\\.ccli\\.com"
    - from: "src/views/ServicesView.vue"
      to: "pastServices computed"
      via: "slice(0, 5) limit"
      pattern: "slice.*5"
---

<objective>
Four targeted QoL improvements across the song list and service views.

Purpose: Improve daily usability — surface CCLI links, clarify service status, reduce noise from past services, and compact the editor layout.
Output: Updated SongTable, ServicesView, ServiceCard, and ServiceEditorView components.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/types/song.ts
@src/types/service.ts
@src/components/SongTable.vue
@src/views/ServicesView.vue
@src/components/ServiceCard.vue
@src/views/ServiceEditorView.vue

<interfaces>
From src/types/song.ts:
```typescript
export interface Song {
  id: string;
  title: string;
  ccliNumber: string;    // Already exists on Song type
  author: string;
  // ...
}
```

From src/types/service.ts:
```typescript
export type ServiceStatus = 'draft' | 'planned'   // Already has both values
export interface Service {
  id: string;
  date: string;
  status: ServiceStatus;
  // ...
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: CCLI column in SongTable + past service filter in ServicesView</name>
  <files>src/components/SongTable.vue, src/views/ServicesView.vue</files>
  <action>
**SongTable.vue — Replace BPM with CCLI:**
1. Change the column header from "BPM" to "CCLI" (line 111-113 area).
2. Replace the BPM table cell (lines 146-148) with a CCLI cell:
   - If `song.ccliNumber` is truthy, render an `<a>` tag linking to `https://songselect.ccli.com/songs/${song.ccliNumber}` with `target="_blank"` and `rel="noopener"`.
   - Style the link: `text-indigo-400 hover:text-indigo-300 hover:underline`.
   - Display text: the ccliNumber value.
   - Add `@click.stop` on the anchor to prevent triggering the row's `@click="$emit('select', song)"`.
   - If `song.ccliNumber` is falsy, render an em dash like the BPM fallback currently does.

**ServicesView.vue — Limit past services to 5:**
1. The past services section already has a `showPast` toggle (line 141) and `pastServices` computed (lines 160-164). The toggle is already collapsed by default (`showPast = ref(false)`). This satisfies "hidden by default".
2. Modify the template where past services are rendered (line 97-103): change `v-for="service in pastServices"` to `v-for="service in displayedPastServices"`.
3. Add a new computed `displayedPastServices` that slices pastServices to the first 5: `pastServices.value.slice(0, 5)`. The pastServices computed already sorts descending by date, so slice(0,5) gives the 5 most recent.
4. Update the count display in the toggle button (line 94): change `{{ pastServices.length }}` to still show total count so user knows how many exist, e.g., keep as is showing the full count but only rendering 5.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Song list table shows CCLI column with clickable links instead of BPM. Past services section renders at most 5 most recent when expanded.</done>
</task>

<task type="auto">
  <name>Task 2: Lock icon on planned ServiceCard + draft/planned toggle + compact prayer/message slots</name>
  <files>src/components/ServiceCard.vue, src/views/ServiceEditorView.vue</files>
  <action>
**ServiceCard.vue — Lock icon on planned status:**
1. In the status badge span (line 11), add a small inline SVG lock icon BEFORE the status text, but ONLY when `service.status === 'planned'`.
2. Lock icon SVG (heroicons mini lock-closed, h-3 w-3):
   ```
   <svg v-if="service.status === 'planned'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3">
     <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
   </svg>
   ```
3. Add `inline-flex items-center gap-1` to the status badge span classes so the icon and text sit inline. Currently the span has `inline-block` — change to `inline-flex items-center gap-1`.

**ServiceEditorView.vue — Draft/Planned toggle:**
1. In the header area where the status badge is displayed (lines 50-55), make the badge clickable to toggle status.
2. Replace the static `<span>` with a `<button>` element. Same classes as the current span, plus `cursor-pointer hover:opacity-80 transition-opacity`.
3. Add `@click="toggleStatus"` on the button.
4. Add lock icon (same SVG as ServiceCard) inside the button before the text, shown only when `localService.status === 'planned'`.
5. Add `toggleStatus` function:
   ```typescript
   function toggleStatus() {
     if (!localService.value) return
     localService.value.status = localService.value.status === 'draft' ? 'planned' : 'draft'
   }
   ```

**ServiceEditorView.vue — Compact prayer/message slots:**
1. Find the PRAYER slot template (lines 269-272). Currently:
   ```html
   <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prayer</p>
   <p class="text-sm text-gray-600 italic">No assignment needed</p>
   ```
2. Replace with a single line using flex layout:
   ```html
   <div class="flex items-center gap-2">
     <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prayer</p>
     <span class="text-xs text-gray-600 italic">No assignment needed</span>
   </div>
   ```
   Remove the `mb-1` from the label since they're now on the same line.
   Use `text-xs` on the helper text (was `text-sm`) to match the label size better.

3. Do the same for the MESSAGE slot template (lines 275-278):
   ```html
   <div class="flex items-center gap-2">
     <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Message</p>
     <span class="text-xs text-gray-600 italic">No assignment needed</span>
   </div>
   ```
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>ServiceCard shows lock icon next to "planned" badge. ServiceEditorView has clickable status badge toggle between draft/planned with lock icon. Prayer and Message slots display label and "No assignment needed" on a single line.</done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes with no type errors
- `npx vitest run` passes all existing tests
- Visual: Song list shows CCLI column, clicking opens CCLI link in new tab
- Visual: Past services hidden by default, toggle shows max 5
- Visual: Planned services have lock icon on card and editor
- Visual: Prayer/Message slots are single-line compact
</verification>

<success_criteria>
1. SongTable CCLI column renders ccliNumber as clickable link to songselect.ccli.com, replacing BPM
2. ServicesView past services hidden by default (already was), limited to 5 most recent when shown
3. ServiceCard displays lock icon inline with "planned" status badge
4. ServiceEditorView status badge is clickable to toggle draft/planned, includes lock icon when planned
5. Prayer and Message slots in ServiceEditorView render label + helper text on single line
6. All existing tests pass, no type errors
</success_criteria>

<output>
After completion, create `.planning/quick/3-qol-ccli-on-song-list-draft-published-st/3-SUMMARY.md`
</output>
