---
phase: 15-per-role-frequency-role-categories
plan: 01
subsystem: database
tags: [typescript, vue, roster, schema-migration]

# Dependency graph
requires:
  - phase: 13-volunteer-role-scheduling
    provides: Role/Person/PersonQuarterData/RoleGroup type contracts and DEFAULT_ROLES seed
provides:
  - "RoleGroup union extended with 'vocals' as a first-class group (D-08)"
  - "Person.roleFrequencies? and PersonQuarterData.roleTiers? optional per-role schema fields (D-04/D-05)"
  - "UpsertPersonInput.roleFrequencies? sibling field for standing-data upserts"
  - "DEFAULT_ROLES vocals entry reseeded to group 'vocals' (D-09)"
  - "All 5 RoleGroup-keyed exhaustive maps/arrays/options across 4 Vue files compile with 'vocals'"
affects: [scheduler, migrations, roster-ui, availability-drawer, quarter-grid]

# Tech tracking
tech-stack:
  added: []
  patterns: [additive-optional-field-with-fallback, static-literal-tailwind-class-maps]

key-files:
  created: []
  modified:
    - src/types/roster.ts
    - src/views/RosterView.vue
    - src/components/QuarterGrid.vue
    - src/components/RolesConfigPanel.vue
    - src/components/AvailabilityRosterTable.vue

key-decisions:
  - "roleFrequencies/roleTiers added as optional Record<string,...> fields, never replacing frequencyTargetN/frequencyTier (both retained as fallbacks) — keeps pre-migration Firestore docs compiling and readable"
  - "vocals RoleGroup uses a distinct pink Tailwind literal (bg-pink-900/50 text-pink-300 border-pink-800 family) across all 4 files, consistent with the existing blue/purple/gray convention"
  - "GROUP_ORDER / groupOrder place 'vocals' immediately after 'band' (user's '1 instrument + vocals' mental model)"

requirements-completed: [D-04, D-05, D-08, D-09]

# Metrics
duration: 12min
completed: 2026-07-08
---

# Phase 15 Plan 01: Per-Role Schema + Vocals RoleGroup Summary

**Extended roster.ts with additive per-role frequency/tier schema fields and a first-class 'vocals' RoleGroup, then fixed all 5 downstream `Record<RoleGroup,...>` exhaustive maps across 4 Vue files so `vue-tsc --build` compiles green.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-08T21:00:00Z
- **Completed:** 2026-07-08T21:12:00Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `RoleGroup` union now includes `'vocals'`; `DEFAULT_ROLES` vocals entry reclassified to `group: 'vocals'`
- `Person.roleFrequencies?: Record<string, number>` and `UpsertPersonInput.roleFrequencies?` added, `frequencyTargetN` retained as the fallback/default
- `PersonQuarterData.roleTiers?: Record<string, FrequencyTier>` added, `frequencyTier?` retained as the fallback
- All 5 `Record<RoleGroup, string>` maps + 1 `RoleGroup[]` order array + 1 hardcoded `<option>` list across RosterView.vue, QuarterGrid.vue, RolesConfigPanel.vue, AvailabilityRosterTable.vue gained a `vocals` entry using a consistent static pink Tailwind literal
- `npm run type-check` (vue-tsc --build) exits 0; full `npx vitest run` suite passes (609/609 tests, 28 files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend roster.ts types + DEFAULT_ROLES for per-role schema and vocals group** - `cef9c6d` (feat)
2. **Task 2: Add 'vocals' to every RoleGroup-keyed map/array/option so vue-tsc compiles** - `b484644` (feat)

_Note: no TDD tasks in this plan; both tasks are schema/compile-gate changes verified via existing test suite + type-check._

## Files Created/Modified
- `src/types/roster.ts` - RoleGroup +'vocals', Person.roleFrequencies?, PersonQuarterData.roleTiers?, UpsertPersonInput.roleFrequencies?, DEFAULT_ROLES vocals reseed
- `src/views/RosterView.vue` - groupBadgeClasses gains vocals entry
- `src/components/QuarterGrid.vue` - groupHeaderBg + GROUP_ORDER gain vocals (positioned after band)
- `src/components/RolesConfigPanel.vue` - groupLabels/groupBadgeClasses/groupOrder/groupedRoles gain vocals; new `<option value="vocals">Vocals</option>` (D-09 re-classification UI, reuses existing updateRole path)
- `src/components/AvailabilityRosterTable.vue` - ROLE_CHIP_CLASS gains vocals entry

## Decisions Made
- `roleFrequencies`/`roleTiers` are purely additive/optional — no read site in this plan assumes presence, so pre-migration Firestore docs never throw (mirrors the existing `frequencyTier?` precedent).
- Chose the pink Tailwind family for `vocals` across all 4 files (distinct from existing blue/band, purple/tech, gray/other) to keep the badge/chip/header palette visually consistent.
- `GROUP_ORDER`/`groupOrder` insert `'vocals'` immediately after `'band'`, matching the phase's "1 instrument + vocals" mental model documented in 15-PATTERNS.md.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their acceptance criteria on the first pass; no auto-fixes, no architectural questions, no blockers.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan is schema/compile-only; no new packages installed (per the plan's threat model, T-15-01-SC disposition is "accept — zero external packages").

## Next Phase Readiness
The `'vocals'` RoleGroup and per-role (`roleFrequencies`/`roleTiers`) schema fields now exist and the codebase compiles cleanly. Downstream Wave 2/3 plans (scheduler group-exclusivity predicate, opportunistic patch-on-read migration in roster.ts, per-role UI in RosterView/AvailabilityDrawer, QuarterGrid group-violation badge) can now safely import and read these new field shapes. No blockers.

---
*Phase: 15-per-role-frequency-role-categories*
*Completed: 2026-07-08*
