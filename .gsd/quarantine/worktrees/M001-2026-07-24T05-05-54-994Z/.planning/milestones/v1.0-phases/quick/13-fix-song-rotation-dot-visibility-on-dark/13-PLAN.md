---
phase: quick-13
plan: 13
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/RotationTable.vue
  - src/components/ScriptureRotationTable.vue
  - src/views/ServicesView.vue
autonomous: true
requirements: []
must_haves:
  truths:
    - "Song rotation dots are clearly visible against the dark cell background"
    - "A 'Scripture Rotation' tab exists on the Services page"
    - "Scripture Rotation shows each unique scripture passage as a row with date columns"
    - "Consecutive-week scripture repeats are highlighted in amber the same way songs are"
  artifacts:
    - path: "src/components/RotationTable.vue"
      provides: "Updated dot color for better visibility"
    - path: "src/components/ScriptureRotationTable.vue"
      provides: "Scripture rotation grid — rows are passages, columns are service dates"
    - path: "src/views/ServicesView.vue"
      provides: "Third tab 'Scripture Rotation' wired to ScriptureRotationTable"
  key_links:
    - from: "src/views/ServicesView.vue"
      to: "src/components/ScriptureRotationTable.vue"
      via: "v-else-if activeTab === 'scripture-rotation'"
      pattern: "activeTab.*scripture-rotation"
---

<objective>
Two targeted UI improvements to the Services page:

1. The `bg-indigo-400` dots in RotationTable are hard to read against the `bg-indigo-900/50` cell background on the dark theme. Change the normal-use dot to `bg-sky-300` (bright cyan-blue, clearly visible on dark backgrounds) and update its legend entry to match.

2. Add a Scripture Rotation view so planners can see which passages are being repeated across services, just like the Song Rotation view.

Purpose: Improve readability and add parity between song and scripture planning visibility.
Output: Updated RotationTable.vue, new ScriptureRotationTable.vue, updated ServicesView.vue with three tabs.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix dot color in RotationTable for dark theme visibility</name>
  <files>src/components/RotationTable.vue</files>
  <action>
    In `src/components/RotationTable.vue`, replace all three occurrences of `bg-indigo-400` with `bg-sky-300`:

    1. Line 73: the dot span inside the `v-for="date in sortedDates"` cell —
       change `:class="isConsecutiveRepeat(entry.songId, date) ? 'bg-amber-400' : 'bg-indigo-400'"`
       to     `:class="isConsecutiveRepeat(entry.songId, date) ? 'bg-amber-400' : 'bg-sky-300'"`

    2. Line 84: the legend dot —
       change `class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400"`
       to     `class="inline-block w-2.5 h-2.5 rounded-full bg-sky-300"`

    No changes to cell background colors (`bg-indigo-900/50`, `bg-amber-900/30`) — only the dot indicators change.

    Rationale: `bg-indigo-400` (#818cf8) has insufficient contrast against `bg-indigo-900/50` (#1e1b4b at ~50% opacity) on gray-900. `bg-sky-300` (#7dd3fc) is a brighter, more saturated cyan-blue that reads clearly on all dark gray backgrounds used in this app.
  </action>
  <verify>
    Open the app in the browser, navigate to Services > Song Rotation tab. The dots indicating a song was used should now appear as bright cyan-blue (sky-300) and be clearly visible against the dark cell backgrounds. The amber dots for consecutive repeats remain unchanged.
  </verify>
  <done>All `bg-indigo-400` occurrences in RotationTable.vue replaced with `bg-sky-300`. The legend dot and the in-cell indicator dots both match the new color.</done>
</task>

<task type="auto">
  <name>Task 2: Add Scripture Rotation tab and ScriptureRotationTable component</name>
  <files>src/components/ScriptureRotationTable.vue, src/views/ServicesView.vue</files>
  <action>
    **Create `src/components/ScriptureRotationTable.vue`:**

    Model this component after `src/components/RotationTable.vue` but for scripture passages instead of songs. Accept a `services: Service[]` prop.

    Scripture entry logic (inline in the component, no separate utility file needed for this scope):
    - Iterate `service.slots` for slots where `slot.kind === 'SCRIPTURE'`
    - A passage key is a human-readable string: format as `"Book Chapter:verseStart–verseEnd"` (e.g., "John 3:16-17"). If no verses, use `"Book Chapter"`. Use only `book`, `chapter`, `verseStart`, `verseEnd` from the `ScriptureSlot`.
    - Skip slots where `book` is null or `chapter` is null (empty scripture slots).
    - Also include `service.sermonPassage` (type `ScriptureRef | null`) — same format. Skip if null.
    - Deduplicate: if the same formatted passage key appears twice in one service (e.g., same passage in both a slot and sermonPassage), count it once per service date.
    - Produce `ScriptureRotationEntry[]` where each entry has `{ key: string; dates: string[] }`.
    - Sort entries alphabetically by `key`.

    For consecutive repeat detection: same approach as `RotationTable.vue` — a date is a consecutive repeat if the previous date column in `sortedDates` also has this passage. Use `bg-sky-300` dot (not `bg-indigo-400`) for normal use and `bg-amber-400` for consecutive repeats, matching the updated Song Rotation style.

    Template structure mirrors RotationTable.vue:
    - Empty state: "No services planned yet. Create services to see your scripture rotation patterns."
    - Subtitle: "Showing N week(s) of scripture rotation"
    - Filter input shown when more than 20 entries (lower threshold than songs since there are usually fewer scriptures): `placeholder="Filter by passage..."`
    - Table: sticky first column labeled "Passage", date headers, dot cells
    - Cell backgrounds: `bg-sky-900/40` for normal use, `bg-amber-900/30` for consecutive repeats (keep amber cell background)
    - Legend: sky-300 dot = "Scripture used", amber dot = "Repeated in consecutive weeks"
    - If no scripture entries after computing (all slots are songs/prayer/message), show the empty state message

    **Update `src/views/ServicesView.vue`:**

    1. Add a third tab button after "Song Rotation":
       ```
       <button type="button" ... @click="activeTab = 'scripture-rotation'">
         Scripture Rotation
       </button>
       ```
       Apply the same active/inactive classes as the existing tabs (active: `text-indigo-300 border-indigo-500 bg-gray-900`, inactive: `text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600`).

    2. Extend the `activeTab` ref type: `ref<'services' | 'rotation' | 'scripture-rotation'>('services')`

    3. Add a third `v-else-if` block:
       ```
       <template v-else-if="activeTab === 'scripture-rotation'">
         <ScriptureRotationTable :services="rotationServices" />
       </template>
       ```
       Pass the same `rotationServices` computed (8-week window) used by RotationTable — no new window computation needed.

    4. Import `ScriptureRotationTable` from `@/components/ScriptureRotationTable.vue` in the script setup.

    Import `Service`, `ScriptureSlot`, `ScriptureRef` from `@/types/service` in ScriptureRotationTable.vue.
  </action>
  <verify>
    `npx vue-tsc --noEmit` passes with no type errors.
    Open the app, navigate to Services. There are now three tabs: Services, Song Rotation, Scripture Rotation. Clicking Scripture Rotation shows the rotation grid of passages across service dates with sky-300 and amber-400 dots.
  </verify>
  <done>ScriptureRotationTable.vue created and renders a passage-vs-date grid. ServicesView.vue has a working "Scripture Rotation" tab that passes the 8-week rotationServices window to the new component. No TypeScript errors.</done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes
- Song Rotation dots are now sky-300 (bright cyan-blue) instead of indigo-400
- Scripture Rotation tab appears and renders correctly
- Legend in both rotation tables uses consistent sky-300 for normal use, amber-400 for consecutive repeats
</verification>

<success_criteria>
Both dot color fix and scripture rotation tab are live, TypeScript compiles cleanly, and the UI is visually consistent between the two rotation views.
</success_criteria>

<output>
After completion, create `.planning/quick/13-fix-song-rotation-dot-visibility-on-dark/13-SUMMARY.md`
</output>
