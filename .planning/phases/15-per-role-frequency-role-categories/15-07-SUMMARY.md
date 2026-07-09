---
phase: 15-per-role-frequency-role-categories
plan: 07
subsystem: scheduling
tags: [vue3, pinia, firestore, roster, per-role-tier, vitest]

# Dependency graph
requires:
  - phase: 15-per-role-frequency-role-categories
    provides: "roleTiers field on PersonQuarterData, scheduler.ts's canonical tierOf fallback chain, AvailabilityDrawer's per-role tier UI (D-05/D-06 established earlier in Phase 15)"
provides:
  - "QuarterGrid.vue manual-grid quick-assign now reads per-(person,role) tier via tierOf(personId, roleId), excluding a person from role-X candidates only when out for role X specifically"
  - "AvailabilityRosterTable.vue admin status table + 'Out this quarter' filter now aggregate per-role tiers (most-restrictive: out > fillin > regular) across a person's held roles"
  - "quarters.ts setPersonAvailability reciprocal partner write branches on partner entry existence: existing partners get a scoped pairedWith-only dot-path write (preserves roleTiers); brand-new partners still get a complete seeded entry"
affects: [15-VERIFICATION, future-phase-scheduling-surfaces]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-(person,role) tier read mirrors scheduler.ts's canonical roleTiers?.[roleId] ?? frequencyTier ?? 'regular' fallback chain, duplicated (not shared) across QuarterGrid.vue, AvailabilityRosterTable.vue, and scheduler.ts — each file owns its own tierOf/aggregateTier helper scoped to that component's props shape"
    - "Firestore dot-path scoping: reciprocal writes to another person's PersonQuarterData branch on entry-existence to choose between a scoped sub-path write (preserve existing fields) and a full-object write (seed defaults for a brand-new entry) — never a blind whole-object replace on an existing entry"

key-files:
  created:
    - src/components/__tests__/AvailabilityRosterTable.test.ts
  modified:
    - src/components/QuarterGrid.vue
    - src/components/AvailabilityRosterTable.vue
    - src/stores/quarters.ts
    - src/components/__tests__/QuarterGrid.test.ts
    - src/stores/__tests__/quarters.test.ts

key-decisions:
  - "AvailabilityRosterTable's quarterDataFor signature changed from (personId: string) to (person: Person) since aggregation needs person.roles; all call sites already held the full Person object so this was a same-file signature tightening, not a new coupling"
  - "Aggregate precedence for the admin status table is most-restrictive-wins (out > fillin > regular) across a person's held roles — a person out for ANY held role surfaces as 'Out this quarter', since that's the primary admin audit surface for the per-role frequency feature"
  - "quarters.ts reciprocal 'added' loop branches on existingPartnerData truthiness: existing entry -> scoped personQuarterData.{partnerId}.pairedWith write only; no entry -> full seeded object (personId, blackoutDates: [], pairedWith: [personId], frequencyTier: 'regular', note: '') to avoid a partial-doc crash regression in downstream unguarded .blackoutDates.includes() reads"

patterns-established:
  - "Pattern: per-role tier reconciliation site checklist — any new surface reading/writing per-quarter availability tier must consult roleTiers?.[roleId] first, then legacy frequencyTier, then 'regular', matching scheduler.ts's tierOf"

requirements-completed: [D-05]

# Metrics
duration: 7min
completed: 2026-07-09
---

# Phase 15 Plan 07: Per-Role Tier Reconciliation (D-05 Gap Closure) Summary

**Closed the D-05 BLOCKER gap by reconciling QuarterGrid's manual quick-assign, AvailabilityRosterTable's admin status/filter, and quarters.ts's reciprocal pairing write with the per-role `roleTiers` model, mirroring scheduler.ts's canonical `tierOf` fallback chain across all three previously-unreconciled surfaces.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-09T13:39:38-04:00
- **Completed:** 2026-07-09T13:46:04-04:00
- **Tasks:** 3
- **Files modified:** 6 (3 source + 3 test, 1 new test file)

## Accomplishments
- QuarterGrid's `availableUnassigned` now excludes a person from a role's quick-assign candidate list only when they are marked 'out' for that specific role, not for every role they hold — a person out for guitar but regular for drums stays eligible as a drums candidate
- AvailabilityRosterTable's status pill, freqBadge, blackoutSummary, and the "Out this quarter" filter now aggregate a person's per-role tiers with most-restrictive precedence (out > fillin > regular), so being out for any single held role surfaces the person in the admin audit filter
- `setPersonAvailability`'s reciprocal must-serve-with partner write no longer silently erases an existing partner's tuned `roleTiers` — it now writes a scoped `pairedWith`-only dot-path when the partner already has an entry, and only falls back to a full-object write (with `blackoutDates: []` initialized) for a brand-new partner with no prior entry

## Task Commits

Each task was executed as a RED → GREEN TDD pair, committed atomically:

1. **Task 1: QuarterGrid quick-assign reads per-role tier**
   - `9a32ec1` test(15-07): add failing test for per-role tier exclusion in QuarterGrid
   - `9e7a0ff` feat(15-07): QuarterGrid quick-assign reads per-role tier (D-05)
2. **Task 2: AvailabilityRosterTable status/filter reads per-role tier**
   - `8d150a2` test(15-07): add failing test for per-role tier aggregation in AvailabilityRosterTable
   - `083125e` feat(15-07): AvailabilityRosterTable status/filter reads per-role tier (D-05)
3. **Task 3: setPersonAvailability reciprocal write preserves partner roleTiers**
   - `0a54f55` test(15-07): add failing test for reciprocal write preserving partner roleTiers
   - `7da1807` feat(15-07): reciprocal pairing write preserves partner roleTiers (D-05)

_All three RED commits confirmed failing (or, for Task 3's brand-new-partner regression-guard sub-test, confirmed already-passing) before the corresponding GREEN commit landed._

## Files Created/Modified
- `src/components/QuarterGrid.vue` — replaced person-only `frequencyTierOf` with per-(person,role) `tierOf(personId, roleId)`; `availableUnassigned` now passes `roleId` into the tier check
- `src/components/__tests__/QuarterGrid.test.ts` — added a fixture person with per-role `roleTiers` (out for guitar, regular for drums) proving per-role, not per-person, exclusion
- `src/components/AvailabilityRosterTable.vue` — added `tierOf` (per-role read) and `aggregateTier` (most-restrictive reduction across held roles); `quarterDataFor` now takes the full `Person` and derives `frequencyTier` via `aggregateTier`
- `src/components/__tests__/AvailabilityRosterTable.test.ts` — new file; 4 tests covering per-role out aggregation, per-role fillin (non-out), legacy frequencyTier fallback, and no-entry default
- `src/stores/quarters.ts` — `setPersonAvailability`'s reciprocal `added` loop branches on `existingPartnerData` truthiness (scoped `pairedWith` sub-path vs. full seeded object)
- `src/stores/__tests__/quarters.test.ts` — added existing-entry (scoped write, roleTiers preserved) and brand-new-partner (complete entry, `blackoutDates: []`) test cases

## Decisions Made
- Kept three independent `tierOf`/`aggregateTier` implementations (one per file) rather than extracting a shared utility — each file's version is scoped to that component's exact props/parameter shape (`Quarter` prop vs. store's `Quarter` local var), and the plan's scope fence explicitly targeted reconciling behavior, not refactoring for code-sharing across files that weren't otherwise being touched
- `AvailabilityRosterTable.quarterDataFor` signature tightened from `personId: string` to `person: Person` — every call site already held the full `Person` object, so this was a local, zero-risk signature change enabling the roles-based aggregation

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>` and `<acceptance_criteria>` blocks without requiring architectural changes, additional bug fixes, or scope expansion.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- D-05's "per-quarter tier becomes per-role, consistently across the app" now holds across all production read/write surfaces: `scheduler.ts` (established earlier in Phase 15), `AvailabilityDrawer.vue` (established earlier in Phase 15), `QuarterGrid.vue`, `AvailabilityRosterTable.vue`, and `quarters.ts`'s reciprocal pairing write (all reconciled by this plan)
- `applyCsvToQuarter` / the CSV import workflow remains intentionally unreconciled per this plan's scope fence — CSV import is being retired, not extended
- Full test suite (655 tests, up from the 648-test baseline) and `vue-tsc --build` both pass with zero regressions

## Self-Check: PASSED

All created/modified files verified present on disk; all 7 task/summary commit hashes verified present in git log.

---
*Phase: 15-per-role-frequency-role-categories*
*Completed: 2026-07-09*
