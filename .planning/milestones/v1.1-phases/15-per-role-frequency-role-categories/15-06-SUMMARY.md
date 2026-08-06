---
phase: 15-per-role-frequency-role-categories
plan: 06
subsystem: frontend
tags: [vue, pinia, tdd, quarter-view, per-role-tiers, co-occurrence-warning]

# Dependency graph
requires:
  - phase: 15-per-role-frequency-role-categories
    plan: 01
    provides: "PersonQuarterData.roleTiers? optional schema field; RoleGroup union with 'vocals'"
  - phase: 15-per-role-frequency-role-categories
    plan: 02
    provides: "exported pure evaluateGroupCombo(roleIds, roleGroupOf) => { ok, reason? } group-rule helper"
  - phase: 15-per-role-frequency-role-categories
    plan: 04
    provides: "quarters store setPersonAvailability accepts roleTiers via the scoped personQuarterData.<personId> dot-path write"
provides:
  - "AvailabilityDrawer renders one tier control per held role for the active quarter (D-06), loading pqd.roleTiers?.[id] ?? pqd.frequencyTier ?? 'regular' and saving a per-role roleTiers map (D-05)"
  - "QuarterGrid renders a live, non-blocking orange 'Group conflict' badge (D-11) computed from props.quarter.calendar + props.roles via the shared evaluateGroupCombo helper — no rule duplication, works on historical calendars not just fresh proposals"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [per-role-vfor-preset-controls, shared-exported-rule-helper-reuse-in-component, report-dont-force-third-badge]

key-files:
  created: []
  modified:
    - src/components/AvailabilityDrawer.vue
    - src/components/__tests__/AvailabilityDrawer.test.ts
    - src/components/QuarterGrid.vue
    - src/components/__tests__/QuarterGrid.test.ts

key-decisions:
  - "AvailabilityDrawer wraps the existing FREQ_PRESETS button block in a v-for over held roles bound to draft.roleTiers[roleId]; loadDraft seeds each via pqd?.roleTiers?.[id] ?? pqd?.frequencyTier ?? 'regular' so pre-migration quarter data never appears reset; onSave adds roleTiers alongside the legacy frequencyTier (T-15-06-01: persistence flows through 15-04's scoped write, drawer supplies only the value)"
  - "QuarterGrid.cellHasGroupViolation builds roleGroupOf from props.roles (Map, default 'other') and, for each assigned person in the cell, gathers ALL their assigned roleIds across that date's cells and calls the shared evaluateGroupCombo — the SAME exported helper the scheduler uses, so warning logic cannot drift from auto-propose rules (T-15-06-02)"
  - "Third badge uses a distinct orange palette (bg-orange-900/40 ...) to avoid collision with the existing red Unfilled / amber Pairing-conflict badges; the badge is advisory only and never gates or removes the assignment (D-11 warn-don't-block)"
  - "Blackout/pairing/note controls and the standing frequencyTargetN → rosterStore.updatePerson path left untouched (D-07)"

requirements-completed: [D-05, D-06, D-11]

# Metrics
duration: ~35min

# Verification
automated:
  - "npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts src/components/__tests__/QuarterGrid.test.ts — 9/9 passed"
  - "npx vitest run (full suite) — 648/648 passed"
  - "npm run type-check (vue-tsc --build) — exits 0"
  - "grep confirms roleTiers in AvailabilityDrawer draft/loadDraft/onSave; evaluateGroupCombo + cellHasGroupViolation in QuarterGrid script and template"
human_verify:
  - "Verified in npm run dev by the user — one tier control per held role with independent persistence; 'Group conflict' badge appears on TECH+BAND without removing the assignment; no warning on 1 BAND + 1 VOCALS; auto-propose produces no conflict badges — APPROVED"
---

# 15-06 Summary: Per-Role Tier Controls + Manual-Grid Group-Conflict Warning

Delivered the two quarter-view surfaces of the per-role model, completing the auto-obey /
manual-warn co-occurrence split.

## What was built

- **Per-role tier controls** (`src/components/AvailabilityDrawer.vue`): a reactive
  `draft.roleTiers` map backs one preset-button tier control per held role for the active
  quarter. `loadDraft` seeds each from `pqd?.roleTiers?.[id] ?? pqd?.frequencyTier ??
  'regular'`; `onSave` persists the map via `setPersonAvailability` (15-04's scoped write).
  Blackout/pairing/note and standing `frequencyTargetN` paths unchanged (D-07).
- **Live group-conflict badge** (`src/components/QuarterGrid.vue`): `cellHasGroupViolation`
  reuses the shared exported `evaluateGroupCombo` from `scheduler.ts` — one rule source, no
  drift — computing live from `props.quarter.calendar` + `props.roles`. Renders a distinct
  orange "Group conflict" badge; never blocks or removes the assignment (D-11).

## Commits

- `86031e4` test(15-06): failing tests for per-role tier controls
- `015bfa0` feat(15-06): per-role tier controls in availability drawer
- `830a881` test(15-06): failing tests for live group co-occurrence warning
- `601345f` feat(15-06): live group co-occurrence warning in manual grid

## Checkpoint

Task 3 was a blocking `checkpoint:human-verify`. The user verified the running app
(`npm run dev`) per the plan's how-to-verify steps and approved. No issues reported.

## Deviations

None — plan executed as written. Both TDD RED→GREEN sequences confirmed in git log.

## Self-Check: PASSED
