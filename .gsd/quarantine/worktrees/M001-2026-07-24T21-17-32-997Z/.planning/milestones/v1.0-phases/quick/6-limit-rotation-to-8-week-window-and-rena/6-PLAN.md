---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServicesView.vue
  - src/components/RotationTable.vue
autonomous: true
requirements: [QUICK-6]
must_haves:
  truths:
    - "Rotation tab label reads 'Song Rotation' instead of 'Rotation'"
    - "Rotation table only shows services within 4 weeks past and 4 weeks ahead of today"
    - "Services outside the 8-week window do not appear as columns in the rotation table"
    - "Rotation table displays an informational subtitle showing the date window"
  artifacts:
    - path: "src/views/ServicesView.vue"
      provides: "Tab label rename + filtered services prop"
      contains: "Song Rotation"
    - path: "src/components/RotationTable.vue"
      provides: "Window subtitle display"
  key_links:
    - from: "src/views/ServicesView.vue"
      to: "src/components/RotationTable.vue"
      via: ":services prop with filtered 8-week window"
      pattern: "rotationServices"
---

<objective>
Limit the rotation table to an 8-week window (4 weeks past, 4 weeks ahead from today) and rename the tab label from "Rotation" to "Song Rotation".

Purpose: The rotation table currently shows ALL services, which becomes unwieldy over time. An 8-week window focuses attention on recent and upcoming song scheduling patterns. The renamed tab better describes what it shows.
Output: Modified ServicesView.vue and RotationTable.vue
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/views/ServicesView.vue
@src/components/RotationTable.vue
@src/utils/rotationTable.ts

<interfaces>
From src/views/ServicesView.vue:
```typescript
// RotationTable receives all services currently:
<RotationTable :services="serviceStore.services" />

// Tab label is plain text "Rotation" on line 25
// activeTab type: ref<'services' | 'rotation'>('services')
```

From src/components/RotationTable.vue:
```typescript
const props = defineProps<{
  services: Service[]
}>()

// sortedDates computed extracts unique dates from props.services
// rotationEntries computed calls computeRotationTable(props.services)
```

From src/utils/rotationTable.ts:
```typescript
export interface RotationEntry {
  songId: string
  songTitle: string
  dates: string[]
}
export function computeRotationTable(services: Service[]): RotationEntry[]
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename tab label and filter services to 8-week window</name>
  <files>src/views/ServicesView.vue, src/components/RotationTable.vue</files>
  <action>
In src/views/ServicesView.vue:

1. Change the Rotation tab button label text from "Rotation" to "Song Rotation" (line 25).

2. Add a computed `rotationServices` that filters `serviceStore.services` to only services within a rolling 8-week window centered on today:
   - Calculate `windowStart` as today minus 28 days (4 weeks)
   - Calculate `windowEnd` as today plus 28 days (4 weeks)
   - Format both as YYYY-MM-DD strings
   - Filter: `serviceStore.services.filter(s => s.date >= windowStart && s.date <= windowEnd)`
   - Use a new `const today = new Date()` at the top of the computed, derive windowStart by `new Date(today); setDate(today.getDate() - 28)` and windowEnd by `new Date(today); setDate(today.getDate() + 28)`. Format each with getFullYear/getMonth/getDate zero-padded.

3. Update the RotationTable binding from `:services="serviceStore.services"` to `:services="rotationServices"` (line 142).

In src/components/RotationTable.vue:

4. Add a subtitle line below the filter input (or at the top if no filter visible) that shows the active window range. Inside the `<template v-else>` block, before the filter input div, add:
   ```html
   <p class="text-xs text-gray-500 mb-3">
     Showing {{ sortedDates.length }} week{{ sortedDates.length !== 1 ? 's' : '' }} of song rotation
   </p>
   ```
   This gives users context about the window size without exposing exact date math.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/utils/__tests__/rotationTable.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Tab label reads "Song Rotation" in the Services view tab bar
    - RotationTable receives only services within 4-weeks-past to 4-weeks-ahead window
    - RotationTable displays a subtitle indicating how many weeks are shown
    - Existing rotation table tests still pass (computeRotationTable is unchanged)
    - Build succeeds with no TypeScript errors
  </done>
</task>

</tasks>

<verification>
1. `npx vitest run src/utils/__tests__/rotationTable.test.ts` -- existing rotation tests pass
2. `npx vue-tsc --noEmit` -- no type errors
3. Visual: Tab reads "Song Rotation", rotation table shows limited date columns
</verification>

<success_criteria>
- Tab label is "Song Rotation" (not "Rotation")
- Rotation table date columns span at most 8 weeks (28 days before and after today)
- Services outside the window are excluded from the rotation view
- All existing tests pass, build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/6-limit-rotation-to-8-week-window-and-rena/6-SUMMARY.md`
</output>
