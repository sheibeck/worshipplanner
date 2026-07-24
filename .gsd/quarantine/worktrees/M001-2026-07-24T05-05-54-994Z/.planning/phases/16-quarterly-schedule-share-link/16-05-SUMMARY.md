---
phase: 16-quarterly-schedule-share-link
plan: 05
subsystem: ui
tags: [vue3, pinia, tailwind, availability-drawer, roster]

# Dependency graph
requires:
  - phase: 16-quarterly-schedule-share-link (plan 01)
    provides: "PersonQuarterData.roleFrequency field + RoleFrequencyEntry type + quartersStore.setPersonAvailability's new payload shape"
provides:
  - "AvailabilityDrawer.vue with a single per-role frequency control writing PersonQuarterData.roleFrequency (no separate/standing frequency write)"
  - "Per-Sunday click-to-toggle as the only blackout entry method (date-range picker removed)"
  - "Roles-editing checklist in the Schedule-screen drawer, writing through rosterStore.updatePerson (D-09)"
affects: [16-11 (removal of deprecated Person.frequencyTargetN/roleFrequencies and PersonQuarterData.frequencyTier/roleTiers fields)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "heldRoles derives from the drawer's own draft.roles (not the live roster snapshot) so a just-toggled role's frequency control appears immediately, without waiting on a Firestore round-trip"
    - "Standing-data writes (roles) and quarter-scoped writes (roleFrequency/blackout/pairing/note) stay on fully disjoint store calls — never combined into one payload (D-08)"

key-files:
  created: []
  modified:
    - src/components/AvailabilityDrawer.vue
    - src/components/__tests__/AvailabilityDrawer.test.ts

key-decisions:
  - "roleFreqReadout (per-role availability text) replaces the old single global freqReadout — since frequency is now per-role, the readout must be per-role too; this is an additive UX preservation, not called out explicitly in the plan but keeps parity with the removed global text"
  - "Roles checklist toggle writes rosterStore.updatePerson immediately on change (not deferred to the drawer's Save button), matching the test's expectation that toggling is an independent, standing-data write per D-09"

patterns-established:
  - "Per-role preset-driven frequency control: activeRoleTierPresetKey matches on both tier AND n (not tier alone) so the three 'regular' presets (weekly/biweek/monthly) map to distinct roleFrequency[roleId] values"

requirements-completed: [R-04, R-05, R-06, R-07, R-08]

# Metrics
duration: 8min
completed: 2026-07-10
---

# Phase 16 Plan 05: Availability Drawer Consolidation Summary

**AvailabilityDrawer.vue rewritten to write a single per-role `roleFrequency` control (no standing frequency write), drop the date-range picker for per-Sunday-only blackout entry, and add a roles-editing checklist writing through the roster store.**

## Performance

- **Duration:** ~8 min (test commits 13:04:20 → 13:12:04 UTC-4)
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Removed the date-range picker (`rangeStart`/`rangeEnd`/`applyRange`/"Block Sundays in range") — per-Sunday click-to-toggle plus the existing Nth-Sunday quick-toggle are now the only blackout entry methods (R-08)
- Consolidated the per-role frequency control to write `{tier, n}` into `PersonQuarterData.roleFrequency[roleId]` in one step per preset click, deleting the standing `rosterStore.updatePerson` frequency write entirely (R-05/D-05) — frequency is now fully quarter-scoped
- Added a roles-editing checklist to the drawer (D-09/R-04): toggling a role checkbox writes immediately through `rosterStore.updatePerson`, identical persisted result to editing on the Volunteer screen, and completely independent of the quarter-scoped `setPersonAvailability` save
- Confirmed R-07's cross-screen blackout editing remains descoped (D-10) — no Volunteer-screen blackout editor was added; this plan touched only `AvailabilityDrawer.vue`

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: Remove date-range picker; unify frequency control to write roleFrequency**
   - `e58029a` (test) - failing tests: no date-range picker, roleFrequency payload with preset-accurate n, no standing write
   - `3d65f5c` (feat) - date-range picker removed; `selectRoleTierPreset` writes `{tier,n}`; `onSave` sends `roleFrequency`; standing write deleted
2. **Task 2: Add roles-editing checklist to the drawer (D-09)**
   - `e3590ff` (test) - failing tests: checklist checkbox state mirrors `person.roles`; toggle writes via roster store only
   - `7d55d7d` (feat) - roles checklist added; `onToggleRole` writes through `rosterStore.updatePerson`; `heldRoles` repointed to `draft.roles`

_Note: both tasks follow TDD RED → GREEN; no REFACTOR commit was needed (implementations were clean on first pass)._

## Files Created/Modified
- `src/components/AvailabilityDrawer.vue` - date-range picker removed, unified `roleFrequency` control, new roles checklist section, standing frequency write deleted
- `src/components/__tests__/AvailabilityDrawer.test.ts` - rewritten fixtures (`roleFrequency` instead of legacy `roleTiers`/`frequencyTier`), new no-range-picker test, updated save-payload assertion (preset-accurate `n`, e.g. `out` → `n:0`), new roles-checklist tests (toggle-on/toggle-off), added an unheld `guitar` role fixture for toggle-on coverage

## Decisions Made
- Kept a per-role availability readout (`roleFreqReadout`) instead of dropping the old global readout silently — preserves the "≈ N of M Sundays" / "Excluded this quarter" / "fill gaps" feedback the UI-SPEC copy contract didn't explicitly require removing, just relocated to per-role granularity since the control itself is now per-role
- `heldRoles` (which drives which per-role frequency rows render) now derives from the drawer's own `draft.roles` rather than the live `rosterStore.people` snapshot — this way a role just toggled on in the new checklist immediately gets a frequency control row without waiting on the Firestore `onSnapshot` round-trip
- Roles toggle writes `rosterStore.updatePerson` the instant the checkbox changes (not batched into the drawer's Save button) — matches D-09's "identical persisted result to the Volunteer screen" requirement, where roles are standing data independent of the quarter-scoped Save flow

## Deviations from Plan

None - plan executed as written. The per-role readout addition and the `heldRoles` repoint to `draft.roles` are implementation details in service of the plan's stated acceptance criteria (single per-role control, roles editable in this drawer) rather than scope additions.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AvailabilityDrawer.vue` is fully repointed to `roleFrequency`; ready for plan 16-07 (which copies this drawer's exact Teleport/slide-out markup for `QuarterGrid.vue`'s new group-cell editor) and plan 16-11 (final removal of the now-fully-unused deprecated `Person.frequencyTargetN`/`roleFrequencies` and `PersonQuarterData.frequencyTier`/`roleTiers` fields from `types/roster.ts`)
- No blockers.

---
*Phase: 16-quarterly-schedule-share-link*
*Completed: 2026-07-10*
