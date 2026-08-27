# Phase 88: Editing-UX Polish (Roles/Teams slideout + song Key typeahead) - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Two UI-control refinements surfaced during v2.3 UAT: (R257) align the Volunteer → Roles and Teams tabs to
the Songs editing pattern (read-only rows that open a right-side slideout on click; add/edit/delete happen
in the slideout, not inline), and (R258) make the song **Key** control a searchable type-ahead dropdown of
available keys instead of the free-text input added in Phase 87 (R249). Client-only.
</domain>

<decisions>
## Implementation Decisions

### R257 — Roles/Teams read-only rows + slideout (owner: keep group headers)
- **Mirror the Songs pattern:** `SongsView` owns `selectedSong` and opens `SongSlideOver` on row click;
  "New Song" opens it in create mode (`selectedSong = null`). `RosterView.vue` (which mounts both
  `RolesConfigPanel` and `TeamsConfigPanel`) becomes the owner of `selectedRole`/`selectedTeam` +
  slideout open/close the same way.
- **Two focused slideouts**, reusing `SongSlideOver.vue`'s shell (Teleport, right drawer, translate-x-full
  transition, scrim, header with close/save, delete-with-confirm, create/edit mode):
  - **RoleSlideOver** — edit a role's name, group (Band/Tech/Other), default count, and vocal flag
    (vocal checkbox shown only when group = Band, per Phase 85); Delete inside the slideout with the
    existing "clears assignments across quarters" confirm; a header **"+ Add role"** opens create mode.
  - **TeamSlideOver** — edit a team's name + recurrence (Nth-Sunday ordinals); Delete inside with the
    existing confirm; a header **"+ Add team"** opens create mode. This **absorbs the Phase 86
    `TeamRecurrenceSlideOver`** into a full team-edit drawer (name + recurrence in one slideout) rather
    than a recurrence-only drawer — remove/replace the separate recurrence slideout so there is ONE team
    slideout, not two.
- **Roles table keeps the Band/Tech/Other group headers** (owner decision) — only the editing UX changes:
  rows become read-only (name · group badge · default count · vocal marker) with a trailing `>` chevron;
  no inline inputs remain. Teams is a flat read-only list (name · recurrence summary like "1st & 3rd Sun"
  or "—") with the `>` chevron.
- **No editing affordance remains inline** in either table — the always-live inputs, inline Save buttons,
  and inline delete-confirm blocks are removed; all add/edit/delete flow through the slideout.

### R258 — Song Key type-ahead dropdown (owner: major roots + free entry)
- Replace the Phase-87 free-text Key `<input>` in `SongSlideOver.vue` with a **native `<input list=…>` +
  `<datalist>`** type-ahead (the same idiom SongSlideOver already uses for tag suggestions at
  `list="ss-existing-user-tags"` / `<datalist id=…>`). Filter-as-you-type, pick from the list, AND a
  free-typed value is still accepted.
- **List contents = the existing 14 major-root keys**, extracted from `ArrangementAccordion.vue:179`
  (`['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B']`) into a shared constant (e.g.
  `src/constants/` or a `keys.ts`) so `ArrangementAccordion` and the new datalist share one source.
- **Free entry allowed** (datalist gives it for free): an imported/unusual key not on the list (e.g. `Am`,
  `Bbm` from CSV/Planning Center) still persists and displays — do not restrict to the list.
- The bound target is unchanged from Phase 87: the primary/first arrangement's key
  (`primaryArrangementId ?? arrangements[0]`), persisted via the existing onSave path.

### Deferred / not in scope
- Minor-key variants in the dropdown list (owner chose major roots + free entry).
- Flattening the Roles grouping (owner chose to keep the Band/Tech/Other headers).
- Any change to the Songs table itself (it is the reference, already correct).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SongSlideOver.vue` — the slideout shell to mirror (create/edit modes, delete-with-confirm,
  Teleport/transition), AND the `<input list> + <datalist>` typeahead idiom for R258 (tags, ~lines 201-208).
- `src/views/SongsView.vue` — the parent-owns-`selectedSong` + open-on-row-click + New-Song-create-mode
  pattern to replicate in `RosterView.vue`.
- `src/views/RosterView.vue` — mounts `RolesConfigPanel` + `TeamsConfigPanel` (lines ~457-458); becomes the
  owner of the role/team slideout state.
- `src/components/RolesConfigPanel.vue` — currently all-inline-editable rows (name input, group select,
  defaultCount, vocal checkbox, Save/Delete) grouped by band/tech/other + an add-role form; refactor to
  read-only rows + chevron. `rosterStore.addRole/updateRole/deleteRole` are the store ops to reuse.
- `src/components/TeamsConfigPanel.vue` — inline name edit + Save/Delete + the Phase-86 `>` chevron opening
  `TeamRecurrenceSlideOver`; refactor to read-only rows + a single TeamSlideOver. `teamsStore.addTeam/
  updateTeam/deleteTeam`.
- `src/components/TeamRecurrenceSlideOver.vue` (Phase 86) — its recurrence multi-select body folds into
  the new TeamSlideOver.
- `src/components/ArrangementAccordion.vue:179` — `majorKeys` list to extract into a shared constant.
- `src/types/roster.ts` (Role, RoleGroup, vocal flag), `src/types/team.ts` (Team + recurrence).

### Established Patterns
- Native datalist typeahead (already used for tags) — reuse for the Key field.
- Parent view owns slideout selection state; slideout is a controlled `:open`/`@save`/`@close` component.
- Slideout header "+ Add" for create mode (SongSlideOver isCreateMode).

### Integration Points
- `RosterView` ↔ RoleSlideOver/TeamSlideOver (open on row click / +Add; save via roster/teams stores).
- SongSlideOver Key `<input list>` ↔ shared key constant ↔ primary arrangement (unchanged persistence).
- TeamSlideOver ↔ recurrence config (migrated from TeamRecurrenceSlideOver).
</code_context>

<specifics>
## Specific Ideas

- Owner (v2.3 UAT): "Roles and Teams tabs show tables that now deviate from the other tables… Songs has
  the table read-only, and you edit by clicking the row to open the slideout. Align the UX here."
- Owner (v2.3 UAT): "Key should be a dropdown of available keys with type ahead."
- Reuse over rebuild: SongSlideOver shell + datalist idiom + existing store ops + existing key list.
</specifics>

<deferred>
## Deferred Ideas

- Minor-key list entries (major roots + free entry chosen).
- Flattening Roles grouping (grouping kept).
- Touching the Songs table (it's the reference, unchanged).
</deferred>
