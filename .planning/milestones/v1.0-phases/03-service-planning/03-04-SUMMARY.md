---
phase: 03-service-planning
plan: 04
subsystem: ui
tags: [vue, components, vitest, tdd, services, rotation-table]

# Dependency graph
requires:
  - phase: 03-01
    provides: src/types/service.ts, src/utils/slotTypes.ts, src/utils/rotationTable.ts (Service types and rotation utility)
  - phase: 03-02
    provides: useServiceStore with subscribe, createService, real-time Firestore subscription
provides:
  - ServicesView.vue: full services list page with upcoming/past sections, tabs, New Service button
  - ServiceCard.vue: week card component showing date, progression, song titles, status with router-link
  - NewServiceDialog.vue: date picker dialog for creating new services with progression/team selection
  - RotationTable.vue: seasonal rotation overview with songs as rows, dates as columns, amber highlights for consecutive repeats
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD applied for ServiceCard (RED test first, then GREEN implementation)
    - Static class lookup objects for Tailwind v4 purge safety (progressionClasses, statusClasses)
    - Teleport to body + Transition pattern for NewServiceDialog (consistent with SongSlideOver, CsvImportModal)
    - Local activeTab ref for tab switching (no router-based tabs)
    - computeRotationTable utility consumed directly by RotationTable component

key-files:
  created:
    - src/components/ServiceCard.vue
    - src/components/__tests__/ServiceCard.test.ts
    - src/components/NewServiceDialog.vue
    - src/components/RotationTable.vue
  modified:
    - src/views/ServicesView.vue

key-decisions:
  - "ServiceCard uses static class lookup (progressionClasses/statusClasses) to prevent Tailwind v4 purge of dynamic badge color classes"
  - "ServicesView uses local activeTab ref for Services/Rotation tab toggle — no router-based tabs needed for this simple switch"
  - "RotationTable consecutive repeat detection uses sortedDates index comparison — a song at date[i] is flagged amber if it also appears at date[i-1]"

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 3 Plan 04: ServicesView List Page Summary

**ServiceCard (TDD), ServicesView with upcoming/past sections and Rotation tab, NewServiceDialog with next-Sunday default, and RotationTable with amber consecutive-repeat highlighting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T10:57:29Z
- **Completed:** 2026-03-04T11:00:59Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- ServiceCard.vue: week card with formatted date, progression badge, song titles, status badge, router-link to editor
- ServiceCard.test.ts: 6 TDD tests (written first/RED, then GREEN) — date, progression, song titles, empty slots, status, router-link
- NewServiceDialog.vue: Teleport/Transition dialog with date input defaulting to next Sunday, progression radio buttons with descriptions, team checkboxes (Choir, Orchestra, Special Service)
- ServicesView.vue: full implementation replacing placeholder — upcoming services sorted ascending, past services collapsed toggle, Services/Rotation tab bar, New Service button in header
- RotationTable.vue: songs-as-rows / dates-as-columns table, indigo dots for song usage, amber dots/background for consecutive-week repeats, filter input for >30 songs, horizontal scroll for >12 columns, empty state

## Task Commits

Each task was committed atomically:

1. **Task 1: ServiceCard with tests, ServicesView, and NewServiceDialog** - `a3ff8a7` (feat)
2. **Task 2: RotationTable seasonal song rotation view** - `e83d8ab` (feat)

_Note: TDD applied for Task 1 — ServiceCard tests written first (RED: import fails), ServiceCard.vue created (GREEN: 6 tests pass)_

## Files Created/Modified

- `src/components/ServiceCard.vue` - Week card with date formatting, progression/status badges, song list, router-link
- `src/components/__tests__/ServiceCard.test.ts` - 6 component tests (TDD)
- `src/components/NewServiceDialog.vue` - Date picker dialog with next-Sunday default, progression radio, team checkboxes
- `src/components/RotationTable.vue` - Seasonal rotation table with consecutive repeat highlighting
- `src/views/ServicesView.vue` - Full services list view replacing placeholder (was 3 lines, now 198 lines)

## Decisions Made

- ServiceCard static class lookups prevent Tailwind v4 from purging badge color classes (same pattern as SongBadge, established in Phase 02)
- ServicesView uses `activeTab` local ref for Services/Rotation tab toggle — keeps the view self-contained without additional routing
- RotationTable consecutive repeat detection: checks if `sortedDates[i-1]` is in the song's dates array — straightforward O(n) check per cell

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Results

- ServiceCard tests: 6/6 pass
- RotationTable utility tests: 9/9 pass
- Full test suite: 180/180 pass (11 test files)
- Production build: SUCCESS (ServicesView-Brhg7V47.js 14.37 kB gzip 4.63 kB)

## Next Phase Readiness

- ServicesView is complete and wired to useServiceStore — all service navigation works
- ServiceCard provides week-at-a-glance view needed for service planning workflow
- RotationTable gives song rotation oversight needed for worship team planning
- Plan 03 (ServiceEditorView) can replace its placeholder now — all navigation links point to /services/:id

---
*Phase: 03-service-planning*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: src/components/ServiceCard.vue
- FOUND: src/components/__tests__/ServiceCard.test.ts
- FOUND: src/components/NewServiceDialog.vue
- FOUND: src/components/RotationTable.vue
- FOUND: src/views/ServicesView.vue
- FOUND: .planning/phases/03-service-planning/03-04-SUMMARY.md
- FOUND: a3ff8a7 (Task 1 commit)
- FOUND: e83d8ab (Task 2 commit)
