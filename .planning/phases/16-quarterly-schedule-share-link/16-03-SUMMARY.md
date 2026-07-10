---
phase: 16-quarterly-schedule-share-link
plan: 03
subsystem: ui
tags: [vue, vitest, localStorage, collapsible, ux-research]

# Dependency graph
requires: []
provides:
  - "R-09 UX research artifact recommending card-stack evolution over calendar-centric redesign"
  - "Shared CollapsibleSection.vue component with localStorage-persisted open/closed state"
affects: [16-06-volunteer-roster-collapsible, 16-08-schedule-page-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CollapsibleSection.vue: title/storageKey props, default-expanded, localStorage[storageKey] = 'open'|'closed'"

key-files:
  created:
    - .planning/phases/16-quarterly-schedule-share-link/16-SCHEDULE-UX-NOTE.md
    - src/components/CollapsibleSection.vue
    - src/components/__tests__/CollapsibleSection.test.ts
  modified: []

key-decisions:
  - "Recommended evolving the existing dark card-stack Schedule layout (Option A) over a calendar/matrix-centric redesign (Option B), per R-09/D-11"
  - "CollapsibleSection defaults expanded (opposite of ArrangementAccordion's default-closed), per D-17"
  - "Header uses p-4 (16px) padding and 600 semibold title weight, deliberately diverging from ArrangementAccordion's ~12px vertical padding and (would-be) bold weight, per UI-SPEC typography/spacing contract"

patterns-established:
  - "Pattern 1: Shared collapsible wrapper (title + storageKey props, <slot /> body) reusable across Schedule and Roster pages for R-11"

requirements-completed: [R-09, R-10, R-11]

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 16 Plan 03: R-09 UX Research Note + Shared CollapsibleSection Summary

**R-09 UX research note recommending card-stack evolution (not calendar pivot) for the Schedule page, plus a shared CollapsibleSection.vue component (default-expanded, per-storageKey localStorage persistence) that plans 16-06 and 16-08 will consume for R-11.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-10T09:24:00Z
- **Completed:** 2026-07-10T09:36:50Z
- **Tasks:** 2 completed
- **Files modified:** 3 (all created)

## Accomplishments
- Wrote the R-09 UX research artifact (`16-SCHEDULE-UX-NOTE.md`, 101 lines) evaluating card-stack evolution vs. calendar-centric redesign, citing concrete code evidence (QuarterGrid is already a roles×dates matrix; R-11's existence implies decluttering, not replacing) and recommending the card-stack evolution.
- Specified the concrete redesign elements binding on downstream plans: quarter switcher separated from a secondary "+ Add quarter" modal (R-10/D-13), setup cards wrapped in CollapsibleSection (R-11/D-17) with QuarterGrid staying always-visible, and the same treatment applied to RosterView's Roles config panel / Inactive Volunteers sections.
- Built `CollapsibleSection.vue` via TDD (RED test committed first, then GREEN implementation): default-expanded state, chevron affordance copied from `ArrangementAccordion.vue`, localStorage-backed persistence keyed per `storageKey` prop, UI-SPEC-compliant styling (`p-4` header padding, 600 semibold title — not `ArrangementAccordion`'s bold/12px).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the R-09 Schedule-page UX research note** - `8d917c2` (docs)
2. **Task 2: Shared CollapsibleSection component with localStorage persistence** - `60bb113` (test, RED) → `a8b8382` (feat, GREEN)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 2 used TDD — RED test commit followed by GREEN implementation commit, no refactor needed._

## Files Created/Modified
- `.planning/phases/16-quarterly-schedule-share-link/16-SCHEDULE-UX-NOTE.md` - R-09 UX research decision record (101 lines): options evaluated, recommendation, concrete redesign elements binding on 16-06/16-08
- `src/components/CollapsibleSection.vue` - Shared collapsible wrapper: `defineProps<{ title: string; storageKey: string }>()`, `isOpen` initialized from `localStorage.getItem(storageKey) !== 'closed'` (default true), toggle writes `'open'|'closed'` back
- `src/components/__tests__/CollapsibleSection.test.ts` - 4 tests: default-expanded, toggle-collapses-and-persists, restore-collapsed-from-storage, re-expand-persists-open

## Decisions Made
- Recommended Option A (evolve card-stack) over Option B (calendar-centric pivot) for R-09 — see key-decisions above and the note itself for full reasoning.
- CollapsibleSection header uses `data-role="collapsible-header"` as a stable test hook (not present in `ArrangementAccordion.vue`, added here since this component is designed for reuse across two downstream plans that need a reliable click target in their own tests).

## Deviations from Plan

None - plan executed exactly as written. TDD flow followed per task's `tdd="true"` marker: test written and confirmed failing (component didn't exist) before implementation.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `16-SCHEDULE-UX-NOTE.md` is available for plans 16-06 (Volunteer/Roster) and 16-08 (Schedule) to follow without re-deciding layout direction.
- `CollapsibleSection.vue` is ready to import directly; both consumer plans should use distinct `storageKey` values per the `schedule.section.*` / `roster.section.*` namespacing documented in the UX note and UI-SPEC (T-16-03-01 mitigation).
- No blockers.

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created files verified present on disk; all task commit hashes (8d917c2, 60bb113, a8b8382) verified present in git log.
