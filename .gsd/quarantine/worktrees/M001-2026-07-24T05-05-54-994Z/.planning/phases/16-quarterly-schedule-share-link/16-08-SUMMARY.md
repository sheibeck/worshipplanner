---
phase: 16-quarterly-schedule-share-link
plan: 08
subsystem: ui
tags: [vue3, tailwind, quarter-view, collapsible-sections, modal, teleport]

# Dependency graph
requires:
  - phase: 16-quarterly-schedule-share-link (16-01)
    provides: quartersStore.createQuarter (prior-quarter data seeding)
  - phase: 16-quarterly-schedule-share-link (16-03)
    provides: CollapsibleSection.vue shared component (title/storageKey props, default-expanded)
provides:
  - Quarter switcher (select) visually and functionally separated from quarter creation
  - Small centered "Add a new quarter" modal (Teleport, VolunteerCsvImportModal-style backdrop/panel)
  - Three dense QuarterView setup sections (Volunteer Availability, Service dates, Generate controls) wrapped in CollapsibleSection with distinct localStorage-backed storageKeys
  - QuarterGrid confirmed to remain always-visible, never wrapped in a collapsible container
affects: [16-quarterly-schedule-share-link (remaining Schedule/Roster UX-redesign plans)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centered Teleport modal (VolunteerCsvImportModal shape, shrunk to max-w-sm) for small single-purpose forms"
    - "CollapsibleSection wrapping of pre-existing dense setup cards without restyling their bodies"

key-files:
  created: []
  modified:
    - src/views/QuarterView.vue

key-decisions:
  - "Add-quarter modal reuses VolunteerCsvImportModal's exact Teleport/backdrop/Transition markup, shrunk from max-w-3xl to max-w-sm, per 16-PATTERNS.md's cited analog — no new visual language introduced"
  - "Generate controls section given the CollapsibleSection title \"Generate controls\" even though the original markup had no <h2> heading there (only a code comment) — matches the plan's required storageKey/title triad and UI-SPEC's generic collapsible copy rule (header = existing section title unchanged)"

patterns-established:
  - "Add-quarter/small-form modal pattern: Teleport to body, backdrop + centered panel Transition pair, max-w-sm, header/body/footer three-part layout with primary indigo-600 CTA and gray-800/border-gray-700 cancel"

requirements-completed: [R-09, R-10, R-11]

# Metrics
duration: ~12min
completed: 2026-07-10
---

# Phase 16 Plan 08: Schedule-Page Redesign (Quarter Switcher Split + Collapsible Sections) Summary

**Split QuarterView's conflated quarter select/create card into a lightweight switcher plus a secondary "+ Add quarter" modal, and wrapped the three dense setup cards in CollapsibleSection while keeping QuarterGrid always-visible.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 completed
- **Files modified:** 1 (`src/views/QuarterView.vue`)

## Accomplishments
- Quarter `<select>` is now a standalone lightweight switcher with no create controls inside it
- New visually-secondary "+ Add quarter" button (`border-gray-700 bg-gray-800`, not indigo) opens a small centered modal with year input, quarter select, "Add a new quarter" title, "Create quarter" (indigo-600) CTA, and "Don't create" cancel
- Volunteer Availability, Service dates, and Generate controls sections wrapped in `CollapsibleSection` with distinct `schedule.section.*` storageKeys, default expanded (D-17)
- Confirmed `QuarterGrid` remains outside any `CollapsibleSection` — always visible as the primary work surface

## Task Commits

Each task was committed atomically:

1. **Task 1: Separate quarter switcher from a secondary Add-quarter modal (D-13/R-10)** - `2296add` (feat)
2. **Task 2: Wrap the three dense setup sections in CollapsibleSection (R-11)** - `5b75624` (feat)

## Files Created/Modified
- `src/views/QuarterView.vue` - Split quarter select/create card into switcher + Add-quarter Teleport modal; wrapped Volunteer Availability/Service dates/Generate controls in CollapsibleSection; QuarterGrid left unwrapped

## Decisions Made
- Add-quarter modal reuses `VolunteerCsvImportModal.vue`'s exact Teleport/backdrop/Transition markup shrunk to `max-w-sm`, per the plan's cited analog — avoids inventing a second modal visual language
- "Generate controls" CollapsibleSection title matches the plan's specified storageKey/title even though the source markup had no visible `<h2>` there (just a code comment) — the collapsible header now surfaces that label to the user for the first time, consistent with UI-SPEC's "header = existing section title unchanged" rule (the title existed as the de facto section name)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `QuarterView.vue` now matches the R-09 UX note's binding redesign contract (switcher/create separation, collapsible setup sections, always-visible grid)
- No blockers for downstream plans in this phase (16-06 Roster follows the same `CollapsibleSection` pattern independently)

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*
