---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 08
subsystem: frontend
tags: [vue, tailwind, quarter-setup, csv-import, name-reconciliation, router, sidebar-nav, pinia]

# Dependency graph
requires:
  - phase: 13-03
    provides: "src/utils/volunteerCsv.ts (parseVolunteerCsvRow, matchNameToPerson, expandBlackoutCell, frequencyLabelToN)"
  - phase: 13-05
    provides: "src/stores/roster.ts useRosterStore (people, roles, activePeople, addPerson, updatePerson)"
  - phase: 13-06
    provides: "src/stores/quarters.ts useQuartersStore (createQuarter, addServiceDate, removeServiceDate, setRoleOverrideForDate, applyCsvToQuarter, generateProposal); ResolvedCsvPerson type"
provides:
  - "Quarter setup + CSV import UI — editor-gated /schedule route + sidebar Schedule nav item; QuarterView (create/select quarter, add/remove one-off dates, per-date role-count overrides, Generate/Regenerate/Fill Remaining Gaps with unfilled+conflict summary, grid host placeholder); VolunteerCsvImportModal (upload -> name-match preview with per-row map-to-existing/create-new resolution -> per-person-replace commit, blackout-range expansion + out-of-quarter warning)"
affects: ["13-09 (editable QuarterGrid mounts in QuarterView's placeholder host)", "13-10 (print/share reached from the /schedule screen)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import-preview per-row human name reconciliation — matched rows auto-resolve; unmatched/ambiguous rows require an explicit 'Map to existing person' (dropdown) or 'Create new person' choice before commit is enabled (no silent auto-create, D-16)"
    - "Two-pass CSV commit — first pass resolves/creates people and seeds a normalized name->id map (including rows created in the same batch); second pass resolves serve-with names against that map so intra-batch pairings link correctly"
    - "Blackout out-of-quarter detection separate from expansion — expandBlackoutCell silently drops dates with no matching Sunday; a parallel hasOutOfQuarterBlackout check surfaces a per-row amber warning badge before commit rather than losing data silently"
    - "Per-date role-override draft editor — a local roleId->count draft seeded from the existing override (or role.defaultCount), committed only on 'Save role counts', so the live quarter snapshot never clobbers an in-progress edit"

key-files:
  created:
    - src/views/QuarterView.vue
    - src/components/VolunteerCsvImportModal.vue
  modified:
    - src/components/AppSidebar.vue
    - src/router/index.ts

key-decisions:
  - "QuarterView auto-selects the first (most-recent) quarter once the store snapshot loads, but only when nothing is selected yet — creating a new quarter switches selection to it immediately"
  - "hasAssignments is derived from the quarter's calendar (any role cell with >=1 person) rather than a stored flag — this drives the Generate-Schedule vs Regenerate/Fill-Gaps CTA switch and the empty-state, so first-ever generation shows the plain CTA (no confirm) and subsequent runs gate Regenerate behind the destructive confirmation"
  - "CSV commit maps role NAMES -> role ids and serve-with NAMES -> person ids in the modal (keeping volunteerCsv.ts pure); create-new rows call rosterStore.addPerson with an empty email and mapped role ids, and their new id is added to the name->id map before the serve-with second pass"
  - "Blackout out-of-quarter warning is computed with a dedicated hasOutOfQuarterBlackout helper (mirrors expandBlackoutCell's parse loop) because expandBlackoutCell itself returns only surviving dates and cannot report which were dropped"

requirements-completed: [D-01, D-02, D-15, D-16, D-17]

# Metrics
duration: 18min
completed: 2026-07-08
---

# Phase 13 Plan 08: Quarter Setup + CSV Import Summary

**The `/schedule` quarter-setup screen — reachable from a new editor-gated sidebar "Schedule" item — lets leaders create/select a quarter (auto-generated Sundays), add/remove one-off service dates, adjust per-date role counts, import the quarterly volunteer CSV through a name-reconciliation preview (matched rows auto-resolve; unmatched/ambiguous rows require explicit map-to-existing or create-new), and generate/regenerate/fill-gaps a proposed schedule with an unfilled + pairing-conflict summary — with blackout ranges expanded against the quarter's Sundays and out-of-quarter dates flagged before commit.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-07-08
- **Tasks:** 2 automated (both committed) + 1 human-verify checkpoint (approved — manual browser verification waived by coordinator)
- **Files:** 2 created, 2 modified

## Accomplishments
- **QuarterView.vue** — on mount subscribes both `quartersStore` and `rosterStore` to `authStore.orgId`; provides a quarter selector plus a year + Q1-4 "New quarter" control calling `createQuarter(year, quarter, label)` with a computed "Q{n} {year}" label; a service-dates panel with a date input -> `addServiceDate` and per-row × -> `removeServiceDate` (D-01); a per-date role-override editor (select a date, adjust each role's count draft -> `setRoleOverrideForDate`, D-02); generate controls that show "Generate Schedule" (no confirm) when the calendar is empty and "Fill Remaining Gaps" (no confirm) + "Regenerate" (destructive confirmation with the exact UI-SPEC "...including any manual edits you've made..." copy) once assignments exist; a 20px-stat summary bar of `unfilled` / `pairingConflicts` from the returned `ProposeResult`; the "No schedule generated yet" empty state with body + "Generate Schedule" CTA; a `<!-- QuarterGrid mounts here (Plan 09) -->` host placeholder; and an "Import Volunteer CSV" button opening the modal
- **VolunteerCsvImportModal.vue** — clones `CsvImportModal.vue`'s chrome (select/drop-zone -> parsing -> preview -> importing -> done/error, `max-w-3xl`, dark palette) with `Papa.parse<Record<string,string>>(file, { header, skipEmptyLines, complete })`; per-row status via `parseVolunteerCsvRow` + `matchNameToPerson` (green Matched / gray Ambiguous / red Unmatched); D-16 per-row resolution controls ("Map to existing person" dropdown of roster names / "Create new person") for every non-exact row, with Commit disabled until all such rows are resolved; blackout expansion via `expandBlackoutCell(blackoutCellRaw, quarter.serviceDates)` plus an amber "Blackout date outside quarter" warning badge; the exact UI-SPEC CSV error copy; and a two-pass commit that resolves/creates people (role names->ids), then serve-with names->person ids (intra-batch aware), then calls `quartersStore.applyCsvToQuarter` for the per-person replace
- **AppSidebar.vue** — added an `authStore.isEditor`-gated "Schedule" nav item (`to: '/schedule'`, inline `h-4.5 w-4.5` stroke-2 calendar-schedule glyph) placed immediately after the Services entry
- **router/index.ts** — registered `/schedule` with `meta: { requiresAuth: true, requiresEditor: true }` (mirrors `/songs`, `/roster`)

## Task Commits

1. **Task 1: QuarterView + Schedule sidebar nav + /schedule route** — `e411b2e` (feat)
2. **Task 2: VolunteerCsvImportModal (parse, name-match preview, per-person replace)** — `5f09aac` (feat)
3. **Task 3: Human-verify checkpoint** — approved (manual browser verification waived by coordinator; no code changes)

**Plan metadata:** this commit (following SUMMARY.md write)

## Files Created/Modified
- `src/views/QuarterView.vue` (created) - quarter create/select, date + per-date-override setup, generate CTAs, summary bar, grid host, CSV import entry
- `src/components/VolunteerCsvImportModal.vue` (created) - CSV upload -> name-match preview with per-row resolution -> per-person-replace commit
- `src/components/AppSidebar.vue` (modified) - editor-gated Schedule nav item
- `src/router/index.ts` (modified) - editor-only `/schedule` route

## Decisions Made
- QuarterView auto-selects the most-recent quarter once the snapshot loads (only when nothing selected); creating a new quarter immediately switches selection to it
- `hasAssignments` is derived from the calendar (any cell with >=1 person), driving the first-run "Generate Schedule" (no confirm) vs "Regenerate"/"Fill Remaining Gaps" split and the empty state
- Role-name->id and serve-with-name->person-id mapping lives in the modal (volunteerCsv.ts stays pure); create-new rows are added via `rosterStore.addPerson` and folded into the name map before the serve-with second pass
- Out-of-quarter blackout warning uses a dedicated `hasOutOfQuarterBlackout` helper because `expandBlackoutCell` returns only surviving dates and cannot report drops

## Deviations from Plan

None - plan executed exactly as written. `npx vue-tsc --build` clean for all four files; full unit suite green (591/591); all acceptance-criteria grep checks passed (exact UI-SPEC copy strings, editor-gated `/schedule` nav + route, store-action wiring, name-reconciliation resolution controls, blackout expansion against serviceDates, no silent auto-create).

## Threat Model Compliance
- **T-13-08-01** (silent wrong-person CSV match): `matchNameToPerson` surfaces every non-exact row; Commit is disabled until each unmatched/ambiguous row has an explicit "Map to existing person" or "Create new person" choice — no silent auto-create (D-16)
- **T-13-08-02** (malformed CSV / out-of-quarter blackout dates): `parseVolunteerCsvRow` warnings + `expandBlackoutCell` drop out-of-quarter dates, and a per-row amber "Blackout date outside quarter" badge is rendered before commit rather than silently corrupting data
- **T-13-08-03** (quarter setup visible to non-editors): `/schedule` carries `requiresEditor: true` AND the sidebar Schedule item is gated behind `authStore.isEditor`; store writes remain gated by the org-editor Firestore rule
- **T-13-08-04** (accidental destructive regenerate): "Regenerate" is gated behind the exact destructive confirmation ("...including any manual edits you've made... This cannot be undone."); "Fill Remaining Gaps" is offered as the non-destructive default
- **T-13-08-05** (CSV formula injection): accepted per plan — PapaParse parses cells as data; no CSV re-export in this phase

## Issues Encountered
None.

## User Setup Required
None - PC credentials (if used for the roster import upstream) are configured in Settings per Phase 8; this plan adds no new external configuration.

## Next Phase Readiness
- The `/schedule` screen is reachable and functional for editors; Plan 09's editable `QuarterGrid` + gap-fill panel mount into the `<!-- QuarterGrid mounts here (Plan 09) -->` host; Plan 10's print/share is reached from this screen
- No blockers — `npx vue-tsc --build` clean; human checkpoint approved 2026-07-08

---
*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: src/views/QuarterView.vue
- FOUND: src/components/VolunteerCsvImportModal.vue
- FOUND: src/components/AppSidebar.vue
- FOUND: src/router/index.ts
- FOUND commit: e411b2e (feat, Task 1)
- FOUND commit: 5f09aac (feat, Task 2)
