---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ServiceCard.vue
  - src/components/NewServiceDialog.vue
autonomous: true
requirements: [QUICK-7-TEAM-BADGES, QUICK-7-SONG-LABEL, QUICK-7-SUNDAY-DEFAULTS]
must_haves:
  truths:
    - "ServiceCard displays team badges (gray pills) for each team in service.teams[]"
    - "ServiceCard slot summary shows 'Song - Title' for song slots with assigned songs"
    - "NewServiceDialog defaults teams to ['Orchestra'] when date is 1st Sunday of month"
    - "NewServiceDialog defaults teams to ['Choir'] when date is 3rd Sunday of month"
    - "NewServiceDialog defaults to empty teams for other Sundays or non-Sunday dates"
  artifacts:
    - path: "src/components/ServiceCard.vue"
      provides: "Team badge rendering + song label prefix"
    - path: "src/components/NewServiceDialog.vue"
      provides: "Sunday-based team defaults with date watcher"
  key_links:
    - from: "src/components/ServiceCard.vue"
      to: "src/components/TeamTagPill.vue"
      via: "import and v-for over service.teams"
      pattern: "TeamTagPill.*v-for.*service\\.teams"
    - from: "src/components/NewServiceDialog.vue"
      to: "form.date watcher"
      via: "watch on form.date applies Sunday defaults"
      pattern: "watch.*form\\.value\\.date"
---

<objective>
Three ServiceCard/NewServiceDialog improvements: (1) render team badges on service listing cards, (2) prefix song slots with "Song - " in compact summary, (3) auto-default teams based on which Sunday of the month when creating a new service.

Purpose: Reduce manual team selection for predictable Sunday patterns and improve service card info density.
Output: Updated ServiceCard.vue and NewServiceDialog.vue
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/ServiceCard.vue
@src/components/TeamTagPill.vue
@src/components/NewServiceDialog.vue
@src/types/service.ts

<interfaces>
<!-- TeamTagPill: simple gray pill, takes a `tag` string prop -->
From src/components/TeamTagPill.vue:
```vue
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
  {{ tag }}
</span>
<script setup lang="ts">
defineProps<{ tag: string }>()
</script>
```

From src/types/service.ts:
```typescript
export interface Service {
  id: string
  date: string          // "YYYY-MM-DD"
  name: string
  progression: Progression
  teams: string[]       // e.g. ['Choir', 'Orchestra']
  status: ServiceStatus
  slots: ServiceSlot[]
  sermonPassage: ScriptureRef | null
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

From src/components/NewServiceDialog.vue (create event shape):
```typescript
emit('create', [data: { date: string; name: string; teams: string[] }])
```

From src/stores/services.ts (CreateServiceInput consumed by store):
```typescript
type CreateServiceInput = { date: string; name: string; teams: string[] }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add team badges and song label prefix to ServiceCard</name>
  <files>src/components/ServiceCard.vue</files>
  <action>
Two changes to ServiceCard.vue:

**1. Team badges below the date/status row:**
- Import TeamTagPill component: `import TeamTagPill from '@/components/TeamTagPill.vue'`
- After the top row div (date + status, line ~16) and before the service name `<p>` tag (line ~18), add a row of team badges:
  ```html
  <div v-if="service.teams.length" class="flex flex-wrap gap-1 mb-1">
    <TeamTagPill v-for="team in service.teams" :key="team" :tag="team" />
  </div>
  ```
- This renders gray pill badges for Choir, Orchestra, Special Service, etc. Only shows if teams array is non-empty.

**2. Song slot label format in slotLabel function:**
- In the `slotLabel` function (currently at ~line 106), change the SONG case from:
  ```typescript
  case 'SONG':
    return slot.songTitle ?? 'Empty'
  ```
  to:
  ```typescript
  case 'SONG':
    return slot.songTitle ? `Song — ${slot.songTitle}` : 'Empty'
  ```
- This produces "Song — Great Is Thy Faithfulness" for assigned songs, "Empty" for unassigned.
- Use em dash (—) to match the existing "Scripture — Empty" pattern already used in the SCRIPTURE case on line 112.

Also update the SCRIPTURE case to be consistent for filled scripture refs. Change from:
  ```typescript
  case 'SCRIPTURE':
    return slot.book ? `${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}` : 'Scripture — Empty'
  ```
  to:
  ```typescript
  case 'SCRIPTURE':
    return slot.book ? `Scripture — ${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}` : 'Scripture — Empty'
  ```
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>ServiceCard shows TeamTagPill badges for each team in service.teams[]. Song slots display "Song — Title" and scripture slots display "Scripture — Ref" in the compact summary. Empty slots show "Empty" or "Scripture — Empty" respectively.</done>
</task>

<task type="auto">
  <name>Task 2: Add Sunday-based team defaults to NewServiceDialog</name>
  <files>src/components/NewServiceDialog.vue</files>
  <action>
Add a watcher on `form.value.date` that applies team defaults based on which Sunday of the month the selected date falls on.

**1. Add helper function to determine Sunday ordinal:**
```typescript
/** Returns which Sunday of the month (1-5) a date falls on, or 0 if not a Sunday */
function sundayOrdinal(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  if (d.getDay() !== 0) return 0  // not a Sunday
  return Math.ceil(day / 7)
}
```

**2. Add a `watch` on `form.value.date`:**
After the existing `watch(() => props.open, ...)` block, add:
```typescript
watch(
  () => form.value.date,
  (newDate) => {
    const ordinal = sundayOrdinal(newDate)
    if (ordinal === 1) {
      form.value.teams = ['Orchestra']
    } else if (ordinal === 3) {
      form.value.teams = ['Choir']
    } else {
      form.value.teams = []
    }
  },
)
```

**3. Update `defaultForm()` to also apply defaults for the initial date:**
Change `defaultForm()` to compute the initial team defaults:
```typescript
function defaultForm(): FormState {
  const date = nextSunday()
  const ordinal = sundayOrdinal(date)
  let teams: string[] = []
  if (ordinal === 1) teams = ['Orchestra']
  else if (ordinal === 3) teams = ['Choir']
  return { date, name: '', teams }
}
```
This ensures when the dialog opens, the teams are already correct for the default next-Sunday date.

**Important:** The user can still manually change teams after the default is applied. The watcher fires on date change only, so manual team edits after date selection are preserved until the date changes again.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>NewServiceDialog auto-selects ['Orchestra'] when date is 1st Sunday, ['Choir'] when 3rd Sunday, empty teams otherwise. Defaults apply both on dialog open (via defaultForm) and when user changes the date picker.</done>
</task>

</tasks>

<verification>
1. `npx vue-tsc --noEmit` passes with no type errors
2. `npx vitest run` passes all existing tests (no regressions)
3. Visual: ServiceCard on listing shows gray team pills below date row
4. Visual: Song slots show "Song — Title" format, scripture shows "Scripture — Ref"
5. Visual: NewServiceDialog opens with correct team defaults for next Sunday's ordinal
6. Visual: Changing date in dialog updates team checkboxes reactively
</verification>

<success_criteria>
- Team badges visible on ServiceCard for services with teams assigned
- Song slot labels prefixed with "Song — " in compact summary
- Scripture slot labels prefixed with "Scripture — " in compact summary
- 1st Sunday defaults to Orchestra, 3rd Sunday defaults to Choir, others default empty
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/7-service-card-team-badges-song-slot-label/7-SUMMARY.md`
</output>
