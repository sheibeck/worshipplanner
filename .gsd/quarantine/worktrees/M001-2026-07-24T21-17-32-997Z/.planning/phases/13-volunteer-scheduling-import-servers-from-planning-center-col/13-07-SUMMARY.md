---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 07
subsystem: frontend
tags: [vue, tailwind, roster, pinia, pc-import, router, sidebar-nav, soft-delete]

# Dependency graph
requires:
  - phase: 13-04
    provides: "src/utils/planningCenterApi.ts fetchAndMapPeople (PC people fetch→map, phone always '')"
  - phase: 13-05
    provides: "src/stores/roster.ts useRosterStore (people, roles, activePeople, addPerson, updatePerson, deactivatePerson, reactivatePerson, upsertPeople, seedDefaultRolesIfEmpty, addRole, updateRole, deleteRole)"
provides:
  - "Roster management UI — /roster editor route + editor-gated sidebar nav item; RosterView (active/inactive people list, add/edit form, soft-delete deactivate/reactivate, embedded roles config); RolesConfigPanel (grouped Band/Tech/Other role CRUD); RosterImportModal (PC people preview-then-commit import, phone never PC-sourced)"
affects: ["13-08 (schedule grid view can link to roster)", "13-09 (gap-fill panels reference roster people)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static class-map role-group badges (band=blue / tech=purple / other=gray) — never dynamically constructed Tailwind strings, surviving v4 purge (mirrors SongBadge.vue / TeamTagPill.vue)"
    - "Per-row edit drafts committed only on explicit Save — local editable copies keyed by role id, kept from being clobbered by the Firestore-driven roles snapshot; stale/added drafts reconciled via a deep watch on rosterStore.roles"
    - "Deferred seedDefaultRolesIfEmpty behind a first-snapshot watch — avoids the subscribe()→synchronous-seed race that would duplicate default roles for an org that already has them"

key-files:
  created:
    - src/views/RosterView.vue
    - src/components/RolesConfigPanel.vue
    - src/components/RosterImportModal.vue
  modified:
    - src/components/AppSidebar.vue
    - src/router/index.ts

key-decisions:
  - "seedDefaultRolesIfEmpty() is called from a one-shot watch on rosterStore.roles (not immediately after subscribe()) because Firestore's onSnapshot resolves asynchronously — calling it synchronously after subscribe would always see an empty roles array and duplicate-seed defaults for orgs that already have roles"
  - "RolesConfigPanel keeps per-role edit drafts in a local roleDrafts map committed only on 'Save Role' click, so the live Firestore roles snapshot never overwrites an in-progress rename/count edit; a deep watch reconciles added/removed roles into/out of the draft map"
  - "Import-preview classification (classifyPeople) mirrors roster.ts::upsertPeople's own pcPersonId-then-normalized-name matching so the previewed add/update counts match what the commit actually does"

requirements-completed: [D-03, D-13, D-14, D-20]

# Metrics
duration: 20min
completed: 2026-07-07
---

# Phase 13 Plan 07: Roster Management Screen Summary

**The `/roster` editor screen — reachable from a new editor-gated sidebar Roster item — lets leaders view active + inactive volunteers, add/edit a person (name, email, app-only phone, roles, 1-in-N frequency), soft-delete (deactivate) and reactivate with the exact D-20 reversible-copy confirmation, edit the grouped Band/Tech/Other role list (D-03), and import volunteers from Planning Center via a preview-then-commit modal that never fabricates phone data (D-14).**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-07
- **Tasks:** 2 automated (both committed) + 1 human-verify checkpoint (approved)
- **Files:** 3 created, 2 modified

## Accomplishments
- **RosterView.vue** — on mount, subscribes the roster store to the org and defers `seedDefaultRolesIfEmpty()` behind a first-snapshot watch; renders "Import from Planning Center" and "Add Volunteer" primary CTAs, an active-volunteer table (name / email / phone / role-group badges / friendly frequency label / actions), an inline add/edit form (name, email, app-only-labeled phone, role checkbox multi-select, frequency select via `nToFrequencyLabel`), a soft-delete deactivate confirmation with the exact D-20 wording, an "Inactive Volunteers" section with Reactivate, the "No volunteers yet" empty state (with primary import + "Add person manually" text link), and an embedded `<RolesConfigPanel />`
- **RolesConfigPanel.vue** — lists `rosterStore.roles` grouped Band/Tech/Other with static-class-map group badges; each role editable inline (rename + defaultCount number) committed via `updateRole` on "Save Role"; an "Add Role" row (name + group select + count) calling `addRole` with a computed next `order`; delete behind the exact D-03 confirmation copy calling `deleteRole`
- **RosterImportModal.vue** — near-verbatim clone of `PcImportModal.vue`'s step machine (idle/fetching/preview/importing/done/error) with Teleport/Transition chrome, `hasPcCredentials` guard, `fetchAndMapPeople` → `classifyPeople` add/update counts → `rosterStore.upsertPeople`, the exact PC-error copy ("Go to Settings to check your Planning Center credentials."), and no PC-sourced phone anywhere in the preview
- **Router** — registered `/roster` with `meta: { requiresAuth: true, requiresEditor: true }` (mirrors `/songs`)
- **AppSidebar** — added an `authStore.isEditor`-gated Roster nav item (`label: 'Roster'`, `to: '/roster'`, inline `h-4.5 w-4.5` stroke-2 clipboard-people glyph) adjacent to the Songs entry

## Task Commits

1. **Task 1: RosterView + RolesConfigPanel + /roster route + sidebar nav** — `e4d2941` (feat)
2. **Task 2: RosterImportModal (PC people import)** — `d88ae8b` (feat)
3. **Task 3: Human-verify checkpoint** — approved by user (no code changes)

**Plan metadata:** this commit (following SUMMARY.md write)

## Files Created/Modified
- `src/views/RosterView.vue` (created) - roster list, add/edit form, deactivate/reactivate, inactive section, roles-config host, PC-import entry
- `src/components/RolesConfigPanel.vue` (created) - grouped role CRUD with static class-map group badges and per-row Save drafts
- `src/components/RosterImportModal.vue` (created) - PC people fetch→preview→commit modal, phone never PC-sourced
- `src/components/AppSidebar.vue` (modified) - editor-gated Roster nav item
- `src/router/index.ts` (modified) - editor-only `/roster` route

## Decisions Made
- Deferred `seedDefaultRolesIfEmpty()` behind a one-shot `watch` on `rosterStore.roles` rather than calling it synchronously after `subscribe()`, because the roles `onSnapshot` resolves asynchronously — a synchronous call would always observe an empty array and duplicate-seed defaults for orgs that already have roles
- `RolesConfigPanel` holds per-role edit drafts in a local `roleDrafts` map committed only on "Save Role", so the Firestore roles snapshot cannot clobber an in-progress edit; a deep watch keeps the draft map in sync with added/removed roles
- `classifyPeople` in the import modal mirrors `roster.ts::upsertPeople`'s matching (pcPersonId first, then normalized name) so previewed add/update counts equal the actual commit result

## Deviations from Plan

None - plan executed exactly as written. `npx vue-tsc --build` clean; all plan acceptance-criteria grep checks (exact UI-SPEC copy strings, static badge class maps, no PC-sourced phone, credential guard, editor-gated `/roster` nav entry) passed.

## Threat Model Compliance
- **T-13-07-01** (roster PII visible to non-editors): `/roster` carries `requiresEditor: true` AND the sidebar Roster item is gated behind `authStore.isEditor` — viewers never see the link or the route
- **T-13-07-02** (fabricated PC phone): import preview shows no PC-sourced phone; the form phone field is explicitly labeled "(manual — not synced from Planning Center)" and `fetchAndMapPeople` sets phone to '' upstream
- **T-13-07-03** (PC credential handling): the modal reuses `authStore.pcCredentials`/`hasPcCredentials` only; no credential entry or logging added
- **T-13-07-04** (accidental hard delete): deactivate calls `deactivatePerson` (soft-delete, `active: false`), never `deleteDoc`; the confirmation copy states history is kept and the person can be reactivated

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required (PC credentials, if used for import, are configured in Settings per Phase 8).

## Next Phase Readiness
- The roster surface is fully reachable and functional for editors; Plans 08–10 (schedule grid, gap-fill panels, share/print) can rely on people being manageable at `/roster`
- No blockers — `npx vue-tsc --build` clean; human checkpoint approved 2026-07-07

---
*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/views/RosterView.vue
- FOUND: src/components/RolesConfigPanel.vue
- FOUND: src/components/RosterImportModal.vue
- FOUND commit: e4d2941 (feat, Task 1)
- FOUND commit: d88ae8b (feat, Task 2)
