---
quick_id: 260713-wm9
slug: schedule-and-volunteers-tabbed-layout
date: 2026-07-14
status: complete
commits:
  - 51a93e1
  - 8a54d99
---

# Summary: Schedule & Volunteers tabbed layout

## What changed

### Schedule page — `src/views/QuarterView.vue`
- Added a tab bar (reusing `ServicesView.vue` styling) with **Volunteers**, **Schedule**, **Service dates** (in that order, service dates last). Shown only when a quarter is selected.
- Removed the two `CollapsibleSection` wrappers (Volunteer Availability, Service dates).
- **Volunteers tab** — the `AvailabilityRosterTable`.
- **Schedule tab** (default on load) — regenerate-confirm banner, generation summary, empty state / `QuarterGrid`.
- **Service dates tab** — add/list service dates with per-date role overrides, plus the delete-quarter **Danger Zone** (moved here).
- Tab redirects: `onGenerateSchedule` / `onFillGaps` / `onConfirmRegenerate` → Schedule; new `onRequestRegenerate` opens the confirm on the Schedule tab; `onCreateQuarter` → Volunteers.
- Header action buttons and the share-link banner stay above the tabs (global to the quarter).

### Volunteers page — `src/views/RosterView.vue`
- Added a tab bar with **Volunteers** (default) and **Roles config**.
- **Volunteers tab** — search/filter + people table (or empty state) + clear-all **Danger Zone**.
- **Roles config tab** — `RolesConfigPanel` (removed its `CollapsibleSection`).
- New `onOpenImport` handler and `onAddVolunteer` now switch to the Volunteers tab so imported/added people are visible.

Removed the now-unused `CollapsibleSection` import from both views.

## Verification
- `npm run type-check` — passes (vue-tsc, no errors).
- `npm run build-only` — passes (vite build, 16.5s).
- Manual reasoning over tab state + redirect handlers matches the requested behavior.

## Notes / decisions
- Default Schedule-page tab is **Schedule** — the original complaint was scrolling past setup to reach the schedule.
- Tab panels use `v-show` (not `v-if`) so per-tab state (date drafts, search/filter, override editor) is preserved across tab switches.
- Delete-quarter Danger Zone placed on the Service dates (setup/config) tab rather than left always-visible below the panels.
