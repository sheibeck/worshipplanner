---
phase: quick-260711-dto
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/router/index.ts
  - src/views/RosterView.vue
  - src/views/TeamView.vue
  - src/components/GettingStarted.vue
  - src/utils/slug.ts
  - src/stores/songs.ts
  - src/views/DashboardView.vue
  - src/views/SongsView.vue
  - src/components/SongTable.vue
  - src/views/QuarterView.vue
  - src/components/AppSidebar.vue
autonomous: false
requirements: [QUICK-260711-DTO]

must_haves:
  truths:
    - "Volunteers page header reads 'Volunteers' (not 'Roster') and lives at /volunteers"
    - "Admins page header reads 'Admins' (not 'Users') and lives at /admins"
    - "Songs and Volunteers table rows show a right chevron (>) at the far end and open the edit drawer when the row is clicked anywhere"
    - "Dashboard Songs stat and the Songs page header count exclude soft-deleted (hidden) songs"
    - "The Add-quarter button sits at the top-right of the Schedule page header, matching Services/Volunteers/Songs"
    - "Sidebar order is Services, Songs / Schedule, Volunteers / Admins, Settings with visual separators between the three groups"
  artifacts:
    - path: "src/router/index.ts"
      provides: "Routes /volunteers (name volunteers) and /admins (name admins)"
      contains: "path: '/volunteers'"
    - path: "src/stores/songs.ts"
      provides: "visibleSongs getter (non-hidden songs)"
      contains: "visibleSongs"
    - path: "src/components/SongTable.vue"
      provides: "Trailing chevron column on song rows"
  key_links:
    - from: "src/components/AppSidebar.vue"
      to: "/volunteers, /admins"
      via: "navItems to: paths"
      pattern: "/volunteers|/admins"
    - from: "src/views/DashboardView.vue"
      to: "songStore.visibleSongs"
      via: "template interpolation"
      pattern: "visibleSongs"
---

<objective>
UI-consistency cleanup across the app: align page/route names, standardize drawer-edit row
affordances (right chevron + full-row click), count only active songs, standardize the
Schedule add button placement, and reorder/group the sidebar menu.

Purpose: The menu was recently relabeled (Roster→Volunteers, Users→Admins) but page titles
and routes still use the old names, editable lists are inconsistent, and counts include
deleted songs. This makes the app feel unfinished and confusing.

Output: Consistent naming/routing, consistent editable-row UX, correct song counts,
consistent button placement, and a grouped/reordered sidebar.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- Grounding extracted from the codebase during planning — use directly, no exploration needed. -->

Current routes (src/router/index.ts):
- { path: '/roster', name: 'roster', component: RosterView, meta: { requiresAuth, requiresEditor } }
- { path: '/team',   name: 'team',   component: TeamView,   meta: { requiresAuth, requiresEditor } }
- /songs, /schedule, /services, /settings already match their menu/page names.
- The memorable-share route comment (line ~95) lists "/songs, /roster, /schedule" as examples.

Page headers:
- src/views/RosterView.vue line 7:  <h1 ...>Roster</h1>
- src/views/TeamView.vue   line 6:  <h1 ...>Users</h1>

Sidebar (src/components/AppSidebar.vue navItems computed): current push order for editors is
Dashboard, Services, Schedule, Songs, Volunteers (to: '/roster'), Admins (to: '/team'), Settings.
The template renders one <router-link v-for="item in navItems"> with item.to / item.label / item.icon.

Reserved slugs (src/utils/slug.ts RESERVED_SLUGS): includes 'roster' and 'team'; also 'songs',
'schedule', 'services', 'settings' etc. Prevents an org memorable URL shadowing a static route (D-19).

GettingStarted.vue line 112: step object has `to: '/team'`.

Song count sources:
- src/views/DashboardView.vue line 21: {{ songStore.songs.length }}  (includes hidden)
- src/views/SongsView.vue     line 19: `${songStore.songs.length} song...`  (includes hidden)
- src/stores/songs.ts already exports `aiCandidateSongs = songs.filter(s => s.hidden !== true)`
  and `filteredSongs` (which also excludes hidden). The raw `songs` ref includes hidden docs.
  Soft-delete sets hidden === true (deleteSong). Store returns object is at the bottom (~line 315).

Song table rows (src/components/SongTable.vue): the <tr v-for="song in visibleSongs"> is ALREADY
`cursor-pointer` and `@click="$emit('select', song)"` (opens SongSlideOver drawer). Columns:
checkbox, Title, Category, Key, CCLI, Last Used, Tags. No trailing chevron column exists.

Volunteer table rows (src/views/RosterView.vue lines ~106-128): <tr class="hover:bg-gray-800/50">
is NOT clickable; last column is "Actions" with an Edit button (@click="onEditPerson(person)") and a
Deactivate button (@click="confirmDeactivateId = person.id"). onEditPerson opens a right-anchored
drawer (formOpen, Teleported to body, lines ~259-352 — "mirrors AvailabilityDrawer.vue"). A separate
inline confirm row (colspan, lines ~129-145) is a DEACTIVATE confirmation (not an edit) — leave as-is.

Schedule header (src/views/QuarterView.vue): header actions live in the top-right div at line ~13
(Print / Finalize & Share / Import Volunteer CSV). The "+ Add quarter" button currently sits INSIDE
the quarter-switcher card at lines ~76-82 (@click="addQuarterOpen = true"), not in the header.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Align routes + page titles with the new menu names</name>
  <files>src/router/index.ts, src/views/RosterView.vue, src/views/TeamView.vue, src/components/GettingStarted.vue, src/utils/slug.ts</files>
  <action>
    Rename the two routes whose names no longer match the menu/page:
    - In src/router/index.ts change the roster route to `path: '/volunteers', name: 'volunteers'`
      and the team route to `path: '/admins', name: 'admins'` (keep the same component imports and
      `meta: { requiresAuth: true, requiresEditor: true }`). Update the example-paths comment near the
      memorable-share route (currently references "/roster") to say "/volunteers".
    - Do NOT rename the store/type modules (@/stores/roster, @/types/roster) or the component filenames —
      those are internal identifiers, not routes, and renaming them is out of scope and risky.
    - src/views/RosterView.vue line 7: change the <h1> text from "Roster" to "Volunteers".
    - src/views/TeamView.vue line 6: change the <h1> text from "Users" to "Admins".
    - src/components/GettingStarted.vue: change the step `to: '/team'` (line ~112) to `to: '/admins'`.
      Grep this file for any `to: '/roster'` too and update to `/volunteers` if present.
    - src/utils/slug.ts RESERVED_SLUGS: add 'volunteers' and 'admins' to the set (keep the existing
      'roster' and 'team' entries so any old bookmarks/links stay reserved).
    Note: AppSidebar's `to:` values for these two items are corrected in Task 5, which rewrites navItems.
  </action>
  <verify>
    <automated>grep -rn "path: '/volunteers'" src/router/index.ts && grep -rn "path: '/admins'" src/router/index.ts && grep -rn ">Volunteers<" src/views/RosterView.vue && grep -rn ">Admins<" src/views/TeamView.vue && grep -rn "'volunteers'" src/utils/slug.ts && ! grep -rn "to: '/team'" src/components/GettingStarted.vue</automated>
  </verify>
  <done>Routes are /volunteers (name volunteers) and /admins (name admins); page headers read Volunteers and Admins; GettingStarted links to /admins; slug reserved list includes volunteers and admins.</done>
</task>

<task type="auto">
  <name>Task 2: Count only active (non-deleted) songs on Dashboard and Songs page</name>
  <files>src/stores/songs.ts, src/views/DashboardView.vue, src/views/SongsView.vue</files>
  <action>
    In src/stores/songs.ts add a `visibleSongs` computed that returns `songs.value.filter((s) => s.hidden !== true)`
    (soft-delete sets hidden === true; treat undefined as not-hidden for legacy docs). Add `visibleSongs`
    to the store's returned object (the return block near line ~315, alongside filteredSongs / aiCandidateSongs).
    Then swap the two count sources that currently use the raw `songs` array:
    - src/views/DashboardView.vue line ~21: `{{ songStore.songs.length }}` → `{{ songStore.visibleSongs.length }}`.
    - src/views/SongsView.vue line ~19: change `${songStore.songs.length} song${songStore.songs.length !== 1 ? 's' : ''}`
      to use `songStore.visibleSongs.length` in both the number and the pluralization test.
    Do not change SongTable's footer count (it already derives from filteredSongs, which excludes hidden).
  </action>
  <verify>
    <automated>grep -n "visibleSongs" src/stores/songs.ts && grep -n "songStore.visibleSongs.length" src/views/DashboardView.vue && grep -n "songStore.visibleSongs.length" src/views/SongsView.vue</automated>
  </verify>
  <done>A visibleSongs getter exists and is exported; Dashboard Songs stat and Songs-page header count reflect only non-hidden songs.</done>
</task>

<task type="auto">
  <name>Task 3: Standardize drawer-edit row affordance (chevron + full-row click) on Songs and Volunteers</name>
  <files>src/components/SongTable.vue, src/views/RosterView.vue</files>
  <action>
    Add a consistent "opens drawer for edit" affordance to the two editable list rows: a right-pointing
    chevron (>) as the final cell of each row, and full-row clickability. Use a plain chevron SVG
    (path d="M9 5l7 7-7 7", h-4 w-4, text-gray-500) inside a right-aligned trailing <td class="px-4 py-3 text-right">,
    with a matching empty trailing <th> in the header so column alignment holds.

    SongTable.vue (rows already clickable via @click="$emit('select', song)"):
    - Add an empty <th> at the end of the header <tr> (after the Tags <th>).
    - Add a trailing <td> with the chevron to the body <tr> (after the Tags <td>). Keep the row's existing
      cursor-pointer + @click select behavior. Ensure interactive children that must not open the drawer
      (checkbox cell, tag +/x buttons, CCLI link) keep their existing @click.stop — they already do.

    RosterView.vue active-people table:
    - Make the body <tr> (around line 107) clickable: add `class="cursor-pointer hover:bg-gray-800/50 transition-colors"`
      and `@click="onEditPerson(person)"`.
    - Remove the now-redundant "Edit" text button from the Actions cell. Keep the "Deactivate" button but
      add `@click.stop` so it does not also open the edit drawer (wrap: `@click.stop="confirmDeactivateId = person.id"`).
    - Add an empty trailing <th> to the header row and a trailing <td> with the chevron to each body row
      (after the Actions cell). The existing inline deactivate-confirm row (colspan) is a confirmation, not an
      edit, and stays as-is — leave the colspan value consistent with the new total column count.
    - Bump the confirm/empty-state colspans (currently 5) to 6 to account for the new chevron column.

    Audit note: Songs (SongTable→SongSlideOver) and Volunteers (RosterView drawer) are the only two
    editable list tables that open a right drawer; Services rows navigate to a full-page editor route
    (not a drawer) and TeamView/RolesConfigPanel edit in place within their own panels (no under-row
    expansion). No other list currently opens edit content underneath a row, so none needs conversion.
  </action>
  <verify>
    <automated>grep -n "M9 5l7 7-7 7" src/components/SongTable.vue && grep -n "M9 5l7 7-7 7" src/views/RosterView.vue && grep -n "@click=\"onEditPerson(person)\"" src/views/RosterView.vue && grep -n "@click.stop=\"confirmDeactivateId" src/views/RosterView.vue && grep -n "colspan=\"6\"" src/views/RosterView.vue</automated>
  </verify>
  <done>Both Songs and Volunteers rows show a trailing right-chevron and open the edit drawer on full-row click; Deactivate no longer triggers the drawer; colspans updated for the added column.</done>
</task>

<task type="auto">
  <name>Task 4: Move the Schedule Add-quarter button to the top-right header</name>
  <files>src/views/QuarterView.vue</files>
  <action>
    Relocate the "+ Add quarter" button (currently in the quarter-switcher card, lines ~76-82,
    @click="addQuarterOpen = true") into the page header's top-right actions div (the
    `<div class="flex items-center gap-2 flex-wrap">` at line ~13), so it matches the Add/Import button
    placement on Services, Volunteers, and Songs. Style it as the primary action (indigo) consistent with
    those pages' Add buttons: `class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"`
    with the same "+ Add quarter" label (a leading plus icon is optional — keep it simple). Remove the old
    button from the switcher card. Leave the "Delete quarter" button where it is (destructive, contextual to
    a selected quarter). Keep the existing addQuarterOpen state and dialog wiring unchanged.
  </action>
  <verify>
    <automated>grep -n "addQuarterOpen = true" src/views/QuarterView.vue | head -1 && grep -c "Add quarter" src/views/QuarterView.vue</automated>
  </verify>
  <done>The Add-quarter button renders in the Schedule page header top-right (same region/style as Services/Volunteers/Songs) and still opens the add-quarter dialog; no duplicate Add-quarter button remains.</done>
</task>

<task type="auto">
  <name>Task 5: Reorder and group the sidebar menu with separators</name>
  <files>src/components/AppSidebar.vue</files>
  <action>
    Rewrite the navItems computed so the editor menu order and grouping become:
      (Dashboard stays first, above the groups)
      Group A: Services, Songs
      --- separator ---
      Group B: Schedule, Volunteers
      --- separator ---
      Group C: Admins, Settings
    Also fix the `to:` paths to the renamed routes: Volunteers `to: '/volunteers'`, Admins `to: '/admins'`
    (Services '/services', Songs '/songs', Schedule '/schedule', Settings '/settings' unchanged). Reuse each
    item's existing SVG icon markup — do not invent new icons.

    Implement separators simply: give nav items an optional `separatorBefore: true` flag on the first item of
    Group B and Group C, and in the template render a thin divider before those items
    (e.g. `<div v-if="item.separatorBefore" class="my-2 border-t border-gray-800" aria-hidden="true" />`
    placed inside the v-for, before the <router-link>; wrap the pair in a <template :key> or move the key to a
    wrapping element as needed so Vue keys stay valid). Keep the existing isActive()/active-styling logic and
    the `@click="$emit('close')"` behavior. Non-editor users still only see Services (unchanged gating).
    Verify isActive still works for the renamed paths (it uses route.path.startsWith(item.to), so '/volunteers'
    and '/admins' resolve correctly with the Task 1 route changes).
  </action>
  <verify>
    <automated>grep -n "to: '/volunteers'" src/components/AppSidebar.vue && grep -n "to: '/admins'" src/components/AppSidebar.vue && grep -n "separatorBefore" src/components/AppSidebar.vue</automated>
  </verify>
  <done>Sidebar shows Dashboard, then Services+Songs, a separator, Schedule+Volunteers, a separator, Admins+Settings; Volunteers/Admins point to the renamed routes; active highlighting works.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Renamed routes/titles, active-only song counts, chevron + full-row-click editing on Songs and Volunteers, Schedule Add-quarter button moved to top-right, and a reordered/grouped sidebar.</what-built>
  <how-to-verify>
    Run the app (`npm run dev`) and, signed in as an editor:
    1. Sidebar order reads: Dashboard, then Services + Songs, a separator line, Schedule + Volunteers, a separator, Admins + Settings.
    2. Click Volunteers → URL is /volunteers and the page header reads "Volunteers". Click Admins → URL is /admins and header reads "Admins".
    3. On Songs and Volunteers, each row shows a ">" at the far right; clicking anywhere on a row opens the right edit drawer. On Volunteers, the Deactivate button still works and does NOT open the edit drawer.
    4. Dashboard "Songs" stat and the Songs-page header count match the number of NON-deleted songs (soft-delete a song and confirm both counts drop by one).
    5. On Schedule, the "+ Add quarter" button is at the top-right of the header (same spot as Add on Songs/Volunteers) and still opens the add-quarter dialog.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `npm run test:unit` (or the project's vitest command) passes — no route/store references broke.
- `npx vue-tsc --noEmit` (or the project build) is green.
- Manual checkpoint above confirms all six UX outcomes.
</verification>

<success_criteria>
- Volunteers page at /volunteers with header "Volunteers"; Admins page at /admins with header "Admins".
- Songs and Volunteers rows: trailing ">" chevron + full-row click opens the existing edit drawer.
- Dashboard and Songs-page counts exclude hidden (soft-deleted) songs.
- Schedule Add-quarter button sits top-right in the header like Services/Volunteers/Songs.
- Sidebar order/grouping: {Services, Songs} | {Schedule, Volunteers} | {Admins, Settings}, Dashboard on top.
</success_criteria>

<output>
Create `.planning/quick/260711-dto-menu-page-route-naming-cleanup-drawer-ed/260711-dto-SUMMARY.md` when done
</output>
