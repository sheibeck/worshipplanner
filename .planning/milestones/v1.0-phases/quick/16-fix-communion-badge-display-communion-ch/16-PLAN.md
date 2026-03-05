---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ServiceCard.vue
  - src/views/ServiceEditorView.vue
autonomous: true
requirements: [QUICK-16]
must_haves:
  truths:
    - "ServiceCard shows only team tag badges (e.g., TeamTagPill), never a separate Communion badge derived from the date"
    - "Checking the Communion checkbox in ServiceEditorView saves the team change via autosave"
    - "Checking or unchecking any team checkbox triggers the autosave watcher within 0.5 seconds"
    - "Autosave debounce delay is 500ms (changed from 1500ms)"
  artifacts:
    - path: "src/components/ServiceCard.vue"
      provides: "Service list card without date-derived Communion badge"
    - path: "src/views/ServiceEditorView.vue"
      provides: "toggleTeam that creates new array references to guarantee Vue 3 deep watcher fires"
  key_links:
    - from: "src/views/ServiceEditorView.vue toggleTeam()"
      to: "autosave watcher"
      via: "localService.value.teams reassigned to new array (not mutated in-place)"
---

<objective>
Fix three related bugs in service management UI:
1. Remove the date-derived "Communion" badge from ServiceCard — the team tag row (TeamTagPill) already shows Communion when it's in `service.teams`, making the separate badge redundant and confusing.
2. Fix Communion checkbox not persisting — the root cause is the same as bug 3.
3. Fix team checkbox changes not triggering autosave — `toggleTeam()` mutates `localService.value.teams` in-place via `splice`/`push`. Vue 3's deep watcher on a `ref` can miss in-place array mutations in this context. Fix: reassign `localService.value.teams` to a new array to guarantee the watcher fires.

Purpose: Team members can accurately see service configuration and edits reliably persist.
Output: Updated ServiceCard.vue (no Communion badge), updated ServiceEditorView.vue (toggleTeam uses immutable array update).
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key decisions:
- [Quick-7]: Team badge row uses v-if guard so ServiceCard layout is unaffected for services with no teams
- [Quick-14]: autosaveInitialized flag suppresses first-load watch trigger to prevent spurious save on mount
- ServiceCard.vue line 9: `<span v-if="isCommunion" ...>Communion</span>` — this derives Communion from date (1st Sunday), not from service.teams. The TeamTagPill row at line 19-21 already renders Communion from service.teams. Remove the date-derived badge entirely.
- ServiceEditorView.vue `toggleTeam()` (line 911-919): uses `splice` and `push` which mutate the array in-place. Autosave watcher at line 822 watches `localService` with `{ deep: true }` — reassigning the array guarantees trigger.

<interfaces>
From src/views/ServiceEditorView.vue:

```typescript
// Current toggleTeam (lines 911-919) — MUTATES in-place:
function toggleTeam(team: string) {
  if (!localService.value) return
  const idx = localService.value.teams.indexOf(team)
  if (idx >= 0) {
    localService.value.teams.splice(idx, 1)  // in-place mutation
  } else {
    localService.value.teams.push(team)       // in-place mutation
  }
}

// Autosave watcher (line 822):
watch(localService, () => { ... }, { deep: true })
```

From src/components/ServiceCard.vue:

```typescript
// isCommunion (line 101-104) — date-derived, NOT from service.teams:
const isCommunion = computed(() => {
  const d = parsedDate.value
  return d.getDay() === 0 && d.getDate() <= 7
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Communion badge from ServiceCard</name>
  <files>src/components/ServiceCard.vue</files>
  <action>
    In `src/components/ServiceCard.vue`:

    1. Remove the `<span v-if="isCommunion" ...>Communion</span>` element from the template (line 9 — the amber badge inside the top row div).
    2. Remove the `isCommunion` computed property from `<script setup>` (lines 101-104) since it is no longer needed.
    3. Do NOT remove or touch the `TeamTagPill` row (lines 19-21) — that already shows Communion when `service.teams` includes 'Communion'.
    4. The `parsedDate` and `formattedDate` computeds must remain (still used for date display).

    Result: ServiceCard shows Communion only via TeamTagPill (data-driven), never via a date-derived amber badge.
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>No Communion amber badge `<span>` exists in ServiceCard.vue template. TeamTagPill row unchanged. Build passes.</done>
</task>

<task type="auto">
  <name>Task 2: Fix toggleTeam to use immutable array updates (fixes autosave for team checkboxes)</name>
  <files>src/views/ServiceEditorView.vue</files>
  <action>
    In `src/views/ServiceEditorView.vue`, replace the `toggleTeam` function body (lines 911-919) with an immutable array update:

    ```typescript
    function toggleTeam(team: string) {
      if (!localService.value) return
      const teams = localService.value.teams
      const idx = teams.indexOf(team)
      if (idx >= 0) {
        localService.value.teams = teams.filter((_, i) => i !== idx)
      } else {
        localService.value.teams = [...teams, team]
      }
    }
    ```

    This creates a new array reference on every change, which guarantees Vue 3's deep watcher on `localService` fires reliably.

    Additionally, change the autosave debounce delay from 1500ms to 500ms. On line 853, change `}, 1500)` to `}, 500)`. This makes saves feel more responsive.

    Also update the comment on line 1306 that references "1.5s" — change it to "0.5s".
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    `toggleTeam` uses filter/spread (no splice/push). Autosave debounce is 500ms. Build passes. Checking any team checkbox (including Communion) triggers the autosave status indicator to show "Saving soon..." within ~100ms of the change, and persists to Firestore after 0.5s debounce.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    1. ServiceCard no longer shows an amber "Communion" badge derived from the service date.
    2. Team checkboxes (including Communion) in ServiceEditorView now trigger autosave reliably.
    3. The team tags row (TeamTagPill) still displays Communion when it's in service.teams.
  </what-built>
  <how-to-verify>
    Run `npm run dev` and open the app.

    Test 1 — Badge removal:
    1. Navigate to Services list.
    2. Find or create a service on the 1st Sunday of any month.
    3. Confirm no amber "Communion" badge appears in the service card header row.
    4. If "Communion" is in that service's teams, confirm it appears as a TeamTagPill in the tag row only.

    Test 2 — Team checkbox autosave:
    1. Open any service in the editor.
    2. Check or uncheck any team checkbox (e.g., "Choir" or "Communion").
    3. Within ~2 seconds, confirm the "Saving soon..." then "Saving..." then "Saved" indicator appears in the header.
    4. Navigate back to services, then re-open the same service.
    5. Confirm the team checkbox state persisted.
  </how-to-verify>
  <resume-signal>Type "approved" if both tests pass, or describe any issues found.</resume-signal>
</task>

</tasks>

<verification>
- `npm run build` passes with no TypeScript or template errors
- ServiceCard.vue contains no `isCommunion` computed and no amber Communion badge span
- ServiceEditorView.vue `toggleTeam` uses `filter` and spread (`[...teams, team]`) — no `splice` or `push`
- Manual verification: team checkbox changes trigger autosave indicator
</verification>

<success_criteria>
1. Service cards on 1st Sundays show no amber Communion badge — only TeamTagPill badges from service.teams
2. Checking/unchecking any team checkbox (Communion or other) in ServiceEditorView triggers autosave within 0.5 seconds
3. Team changes persist across page navigation
</success_criteria>

<output>
After completion, create `.planning/quick/16-fix-communion-badge-display-communion-ch/16-SUMMARY.md` following the summary template.
</output>
