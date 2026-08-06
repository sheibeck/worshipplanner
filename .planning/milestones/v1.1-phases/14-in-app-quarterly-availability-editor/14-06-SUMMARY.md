---
phase: 14-in-app-quarterly-availability-editor
plan: 06
subsystem: frontend
tags: [vue, availability-editor, roster-table, drawer, quarter-page, human-verified]

# Dependency graph
requires:
  - phase: 14-in-app-quarterly-availability-editor
    provides: "Plan 14-05's AvailabilityDrawer.vue and Plan 14-01's FrequencyTier"
provides:
  - "AvailabilityRosterTable.vue (scannable roster with search + status filter chips) and QuarterView.vue wiring that opens the per-person availability drawer for the selected quarter"
affects: [Quarter/Schedule page — primary in-app availability input path]

# Tech tracking
tech-stack:
  added: []
  patterns: [view-level openPersonId ref controlling a right drawer; read-only summary table emitting select(personId)]

key-files:
  created:
    - src/components/AvailabilityRosterTable.vue
  modified:
    - src/views/QuarterView.vue

key-decisions:
  - "Availability editing surface lives on the Quarter/Schedule page where the quarter is chosen and scheduling happens (D-02)."
  - "Full-width roster table row surfaces core-control status (roles, frequency, unavailable summary, pairing, status) and opens the drawer on row click (D-03)."
  - "Drawer controlled by a view-level openPersonId ref (Variant A), reusing already-subscribed roster/quarters stores — no new subscription or collection."

patterns-established:
  - "Read-only summary table (AvailabilityRosterTable) emits select(personId); QuarterView owns openPersonId and mounts AvailabilityDrawer — clean container/presentational split."

requirements-completed: [D-02, D-03]

# Metrics
completed: 2026-07-08
---

# Phase 14 Plan 06: Quarter-Page Availability Editor Mount Summary

**Mounted the in-app availability editor on the Quarter/Schedule page: a full-width `AvailabilityRosterTable` whose rows open the Plan 14-05 drawer per person for the selected quarter, making the in-app editor the primary availability input path.**

## Accomplishments
- Created `AvailabilityRosterTable.vue` (columns Volunteer | Roles | Frequency | Unavailable | Pairing | Status | ›) over `rosterStore.activePeople`, reading per-quarter data with safe defaults
- Ported the sketch display helpers: blackout summary (dominant Nth-Sunday pattern + extra count), frequency badge, status pill, role chips, pairing summary
- Search box + three filter chips: All / Needs input (no personQuarterData entry yet) / Out this quarter (`frequencyTier === 'out'`)
- Row click emits `select(person.id)`; `QuarterView` sets `openPersonId` and mounts `<AvailabilityDrawer>`; existing CSV import + QuarterGrid wiring preserved

## Task Commits
1. **Task 1 (auto): AvailabilityRosterTable** — `215b33a` feat(14-06)
2. **Task 2 (auto): QuarterView mount + drawer wiring** — `8c42655` feat(14-06)

## Human Verification (Task 3 — checkpoint:human-verify, blocking)
Verified end-to-end against `docs/Sample Frequency Notes.csv`: frequency presets, Nth-Sunday chips, range block, bidirectional pairing add/remove (reciprocal chips), and out-this-quarter exclusion — all expressible via the drawer without CSV fallback, and saves round-trip into the roster table. User confirmed "everything else looks good" and approved (2026-07-08). Import-path issues surfaced during the same testing session were fixed under Plan 14-04.

## Files Created/Modified
- `src/components/AvailabilityRosterTable.vue` (new) — read-only roster table with search + filter chips, emits `select`
- `src/views/QuarterView.vue` — imports + `openPersonId` ref + table/drawer mount inside the `selectedQuarter` block

## Deviations from Plan
None — plan executed as written.

## Verification
- `npm run type-check` green; `npm run test:unit` full suite green (known ServiceEditorView print test is a pre-existing load flake, passes in isolation)
- Human-verify: PASSED (user approved 2026-07-08)

---
*Phase: 14-in-app-quarterly-availability-editor*
*Completed: 2026-07-08*

## Self-Check: PASSED
- FOUND: src/components/AvailabilityRosterTable.vue
- FOUND: src/views/QuarterView.vue
- FOUND commit: 215b33a (feat table)
- FOUND commit: 8c42655 (feat mount)
