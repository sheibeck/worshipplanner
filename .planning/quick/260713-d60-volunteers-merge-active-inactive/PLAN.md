---
quick_task: 260713-d60
title: Volunteers — merge active/inactive into one table, move status action to drawer
type: quick
scope: quick-260713-d60
files_modified:
  - src/views/RosterView.vue
  - src/views/__tests__/RosterView.test.ts
autonomous: true
---

<objective>
Rework the Volunteers page (`src/views/RosterView.vue`) so active and inactive
volunteers live in ONE unified table with a "Show inactive" toggle, inactive rows
rendered dimmer, an "Actions" column replaced by a "Status" badge column, and the
Deactivate/Reactivate (+ permanent Delete for inactive) actions relocated from the
table row into the right-side Add/Edit Volunteer drawer. Also normalize the table's
column-header casing to match the app convention established by `SongTable.vue`.

Purpose: single consistent volunteer list; status is a property you change while
editing a person, not a per-row button. Removes the separate "Inactive Volunteers"
CollapsibleSection (its contents are now inline in the main table + drawer).
Output: updated `RosterView.vue` + updated/expanded `RosterView.test.ts`.

This is an ad-hoc quick task, NOT part of phase 16.1. Do NOT modify ROADMAP.md.
Commits use the `quick-260713-d60` scope, e.g. `feat(quick-260713-d60): ...`.
</objective>

<key_decisions>
- **Toggle default:** "Show inactive" defaults to OFF — inactive volunteers are hidden
  until the user toggles it on.
- **Deactivate/Reactivate is immediate-apply, NOT part of Save.** In the drawer it calls
  `rosterStore.deactivatePerson(id)` / `reactivatePerson(id)` directly. It is a distinct
  status action, separate from the form's Save button. It must NOT trip the
  `useUnsavedGuard` prompt — the guard snapshot only tracks `{name,email,phone,roles}`, so
  a status change never marks the form dirty (leave the guard's snapshot getter unchanged).
- **Header-casing convention (determined from `src/components/SongTable.vue`):** header
  `<th>` source text is Title Case with acronyms fully capitalized (e.g. "Last Used",
  "CCLI"), styled by the shared classes `text-xs font-medium text-gray-400 uppercase
  tracking-wider` (the CSS renders them visually uppercase). The new column header is
  literally `Status`. RosterView's existing headers ("Name", "Email", "Phone", "Roles")
  are already Title Case — verify each matches this convention and the shared class string;
  fix any deviation.
- **Status column replaces Actions.** It shows a pill: green-ish "Active" for active people,
  muted/gray "Inactive" for inactive. Use static Tailwind class strings (no dynamically
  built class names — mirrors the `groupBadgeClasses` map already in this file, so classes
  survive Tailwind v4 purge).
- **Inactive rows are dimmed** via a reduced-opacity / muted-text class on the `<tr>`
  (e.g. `opacity-60`), applied conditionally on `!person.active`.
- **Separate "Inactive Volunteers" CollapsibleSection is removed.** Its Reactivate and
  permanent-Delete actions move into the edit drawer (Delete shown only when editing an
  inactive person). The Roles config panel and Danger Zone sections are left untouched.
- **No roster-store changes.** `deactivatePerson`, `reactivatePerson`, `deletePerson`, and
  `activePeople` already exist and are sufficient.
</key_decisions>

<tasks>

<task type="auto">
  <name>Task 1: Unify the table — Show-inactive toggle, Status column, dimmer inactive rows, header normalization</name>
  <files>src/views/RosterView.vue</files>
  <action>
Rework the main volunteers table so active and inactive people render in ONE table:

1. Add a `showInactive` ref defaulting to `false`.
2. Change the `displayedPeople` computed to start from `rosterStore.people` (all people),
   filtering OUT inactive people when `showInactive` is false; keep the existing name-search,
   role-filter, and name/role sort logic. Active people should sort before/with inactive per
   existing name/role ordering (do not special-case ordering unless needed to keep current
   tests' name-sort expectations green — all seeded test people are active).
3. Add a "Show inactive" toggle control at the top, beside the existing search input / role
   filter row (the `flex` filter bar around lines 63–83). Use a checkbox or small toggle
   button consistent with the page's dark-theme styling; bind it to `showInactive`.
4. In the header row (`<thead>`): replace the "Actions" `<th>` with a "Status" `<th>`.
   Normalize every header cell to the SongTable convention — Title Case source text
   (acronyms all-caps) using the shared classes `text-xs font-medium text-gray-400 uppercase
   tracking-wider`. Keep the sortable Name/Roles header buttons as-is.
5. In each row (`<tbody>`): remove the inline "Deactivate" action cell AND the adjacent
   `confirmDeactivateId` confirmation `<tr>` block entirely. Replace the Actions `<td>` with a
   Status `<td>` rendering a pill: "Active" (e.g. `bg-emerald-900/50 text-emerald-300
   border-emerald-800`) or "Inactive" (e.g. `bg-gray-800 text-gray-400 border-gray-700`),
   using static class strings selected by `person.active`.
6. Add a conditional dim class (e.g. `opacity-60`) to the row `<tr>` when `!person.active`;
   rows remain click-to-edit (open the drawer) for both active and inactive people.
7. Update the empty-row `colspan` and the "no match" empty message to reflect the new column
   count and the merged list.
8. Remove the now-redundant separate "Inactive Volunteers" `<CollapsibleSection>` block
   (around lines 172–222) and its supporting script that is no longer used by the table
   (`inactivePeople` computed, the per-row `confirmDeactivateId` / `onConfirmDeactivate`
   inline-table state). KEEP `confirmDeleteInactiveId` / `deletingInactiveId` / `onDeleteInactive`
   and `reactivatePerson` usage available — they will be wired into the drawer in Task 2 (if
   removing them now would break the build, leave them defined and unused until Task 2).
   Leave the Roles config panel and Danger Zone sections untouched.

No fenced code in commits beyond normal Vue SFC edits. Do NOT change the roster store.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run src/views/__tests__/RosterView.test.ts</automated>
  </verify>
  <done>
One table renders all people; "Show inactive" toggle (default OFF) hides inactive rows;
toggling on reveals inactive rows dimmed with an "Inactive" status pill and active rows an
"Active" pill; no per-row Deactivate button remains; header labels match the SongTable
Title-Case + `uppercase tracking-wider` convention with a "Status" header replacing "Actions";
the separate Inactive Volunteers section is gone. Type-check passes and RosterView tests are
green (the section-existence test from lines ~159–173 is updated/removed as part of this task).
  </done>
</task>

<task type="auto">
  <name>Task 2: Move Deactivate/Reactivate (+ Delete for inactive) into the edit drawer</name>
  <files>src/views/RosterView.vue</files>
  <action>
Add an immediate-apply status control inside the Add/Edit Volunteer drawer (the
right-anchored `Teleport` drawer, template lines ~293–388). Only render it when EDITING an
existing person (`editingPersonId` is set), not when adding a new one.

1. Add a computed `editingPerson` that resolves the current person reactively from the store:
   `computed(() => rosterStore.people.find(p => p.id === editingPersonId.value) ?? null)`.
   This reflects live `active` state after a status change (store updates via onSnapshot).
2. In the drawer body (below the roles checklist, still inside the scrollable body) OR a small
   footer region, add a "Status" section showing the current status (reuse the Active/Inactive
   pill styling from Task 1) plus a status action button:
   - When the person is ACTIVE: a "Deactivate" button (red/muted styling consistent with the
     drawer) that calls `rosterStore.deactivatePerson(editingPersonId.value)` immediately.
   - When the person is INACTIVE: a "Reactivate" button (indigo styling) that calls
     `rosterStore.reactivatePerson(editingPersonId.value)`, plus a secondary "Delete
     permanently" control that reuses the existing confirm flow (`confirmDeleteInactiveId` /
     `deletingInactiveId` / `onDeleteInactive`) and closes the drawer on successful delete.
3. These actions apply IMMEDIATELY and are independent of the form Save. They must NOT invoke
   `unsavedGuard.confirmDiscard()` and must NOT be added to the guard's snapshot getter — a
   status change does not count as unsaved form edits. Keep the drawer open after
   deactivate/reactivate so the user sees the updated pill; close it after a permanent delete.
4. Add a short helper note in the section (e.g. "Deactivating removes them from schedule
   proposals and pickers; history is kept and they can be reactivated anytime.") consistent
   with the wording previously shown in the removed inactive section.

Add/adjust tests in `src/views/__tests__/RosterView.test.ts`:
- Opening the drawer for an ACTIVE person shows a "Deactivate" control; clicking it calls
  `deactivatePerson` with that id and does NOT call `updatePerson`.
- Opening the drawer for an INACTIVE person shows "Reactivate" (and a Delete affordance);
  clicking Reactivate calls `reactivatePerson` with that id.
- A test asserting the unified table renders both an active and an inactive person's status
  pills, and that inactive rows are hidden when "Show inactive" is off / shown when on.
  Add `deletePerson` to the mocked roster store if the Delete flow is exercised.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run src/views/__tests__/RosterView.test.ts</automated>
  </verify>
  <done>
Editing an active person exposes an immediate Deactivate control in the drawer (calls
`deactivatePerson`, not tied to Save, no unsaved-changes prompt); editing an inactive person
exposes Reactivate + permanent Delete; the status pill reflects live state. New tests cover
the drawer status actions and the toggle-driven visibility of inactive rows. Type-check passes
and all RosterView tests are green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Final verification + record the quick task in STATE.md</name>
  <files>.planning/STATE.md</files>
  <action>
Run the full verification for the touched files, then record the completed quick task.

1. Run `npm run type-check` — must pass with no errors.
2. Run `npx vitest run src/views/__tests__/RosterView.test.ts` — all tests green.
3. Append a one-line entry for this quick task to the "Quick Tasks Completed" table/list in
   `.planning/STATE.md` (standard quick-task bookkeeping), following the existing
   `[Quick-N]: ...` bullet format, e.g.:
   `[260713-d60]: Volunteers page — active + inactive merged into one table with a Show-inactive
   toggle (default off, inactive rows dimmed), Actions column replaced by a Status badge, and
   Deactivate/Reactivate + permanent Delete moved into the edit drawer as immediate-apply
   status actions; table headers normalized to the SongTable Title-Case convention.`
   Do NOT modify ROADMAP.md.
  </action>
  <verify>
    <automated>npm run type-check</automated>
    <automated>npx vitest run src/views/__tests__/RosterView.test.ts</automated>
  </verify>
  <done>
Type-check clean, RosterView test suite green, and STATE.md's Quick Tasks Completed list has a
`[260713-d60]` entry. ROADMAP.md untouched.
  </done>
</task>

</tasks>

<success_criteria>
- One unified volunteers table; active + inactive share the same table body.
- "Show inactive" toggle beside the search input, default OFF; inactive rows dimmer when shown.
- "Actions" column replaced by a "Status" column with Active/Inactive pills.
- No per-row Deactivate/Reactivate buttons; those actions (plus permanent Delete for inactive)
  live in the edit drawer and apply immediately without tripping the unsaved-changes guard.
- Header labels match the `SongTable.vue` Title-Case + `uppercase tracking-wider` convention.
- Separate "Inactive Volunteers" CollapsibleSection removed; Roles config + Danger Zone intact.
- `npm run type-check` passes; `npx vitest run src/views/__tests__/RosterView.test.ts` green.
- STATE.md Quick Tasks list updated; ROADMAP.md untouched. Commits use `quick-260713-d60` scope.
</success_criteria>

<output>
Update `src/views/RosterView.vue` and `src/views/__tests__/RosterView.test.ts`; record the
task in `.planning/STATE.md`. No SUMMARY file required for a quick task.
</output>
