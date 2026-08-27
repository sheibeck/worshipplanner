---
phase: 89-multi-role-scheduling
plan: 01
subsystem: scheduling
tags: [vue3, pinia, typescript, firestore, scheduler]

# Dependency graph
requires:
  - phase: 88-editing-ux-polish
    provides: RoleSlideOver.vue slideout that surfaces the vocal-role checkbox control this plan generalizes
provides:
  - "Role.multiRole?: boolean, generalized from the Phase-85 vocals-only Role.vocal flag"
  - "Rewritten evaluateGroupCombo/isGroupCompatible: filters multi-role roleIds out first, then applies the Band<->Tech + <=1-non-multi-Band-instrument rule to the remainder"
  - "buildIsMultiRole projection in quarters.ts threading the flag into proposeQuarterSchedule"
  - "roster.ts read-time onSnapshot shim normalizing multiRole for every role (legacy vocal field + legacy group:'vocals'), no Firestore write migration"
  - "Generalized RoleSlideOver Multi-role control (any group, not just Band) with owner helper text"
  - "RolesConfigPanel Multi-role badge and QuarterGrid warn badge using the new rule"
affects: [89-02-same-date-bundling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filter-then-apply co-occurrence rule: evaluateGroupCombo filters multi-role roleIds out of the candidate set before applying the existing Band<->Tech/cap rule to the non-multi remainder — a reusable shape for future per-role exemption flags"
    - "Branch-specific read-time defaulting in a single onSnapshot compat shim (vocals-group branch defaults true, all other roles default false) to preserve a pre-existing legacy default without a write migration"

key-files:
  created: []
  modified:
    - src/types/roster.ts
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts
    - src/stores/quarters.ts
    - src/stores/roster.ts
    - src/stores/__tests__/roster.test.ts
    - src/components/RoleSlideOver.vue
    - src/components/RolesConfigPanel.vue
    - src/components/QuarterGrid.vue
    - src/components/__tests__/RoleSlideOver.test.ts
    - src/components/__tests__/RolesConfigPanel.test.ts
    - src/components/__tests__/QuarterGrid.test.ts
    - src/components/__tests__/AvailabilityDrawer.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/RosterView.test.ts

key-decisions:
  - "Flag name multiRole (owner's working term), per RESEARCH A.1 recommendation over combinable"
  - "evaluateGroupCombo intentionally now allows a multi-role vocalist to also hold a Tech role same date — a deliberate R259 behavior change from the Phase-85 vocals-folds-into-Band rule; the old test at ~scheduler.test.ts:505 was rewritten to assert the new cross-type allowance, with a fresh non-multi-role exclusivity regression added alongside it"
  - "Compat shim uses branch-specific defaulting: vocals-group branch defaults (data.multiRole ?? data.vocal ?? true), default branch has no ?? true fallback — preserves the pre-existing legacy-vocals-doc default without over-defaulting every other role to multiRole:true"
  - "functions/src/serviceRoles.ts left untouched — the vocal field there is never read server-side (parity-only, per RESEARCH A.6); no Cloud Functions deploy required or performed this phase"

patterns-established:
  - "Pattern: when generalizing a special-cased boolean flag exempt from a rule, filter the exempt set out FIRST then apply the unchanged rule to the remainder, rather than threading the exemption through every branch of the rule"

requirements-completed: [R259]

coverage:
  - id: D1
    description: "Role.multiRole flag settable on any role in any group via RoleSlideOver, with helper text; vocals ships multiRole:true by default via DEFAULT_ROLES"
    requirement: "R259"
    verification:
      - kind: unit
        ref: "src/components/__tests__/RoleSlideOver.test.ts#renders the Multi-role label and owner helper text explaining same-date bundling"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/RoleSlideOver.test.ts#multi-role checkbox is present for ANY group (R259 generalization), not only band; switching group keeps it visible"
        status: pass
    human_judgment: false
  - id: D2
    description: "evaluateGroupCombo filters multi-role roleIds out first, then applies the existing Band<->Tech exclusivity + <=1 non-multi Band-instrument cap to the remainder — a multi-role role never conflicts and may cross Band/Tech/Other"
    requirement: "R259"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#evaluateGroupCombo — R259 filter-multi-first predicate (6 edge cases)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group cross-type allowance via multi-role (R259)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group Band<->Tech exclusivity regression, non-multi role (R259)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Read-time compat shim maps legacy vocal field and legacy group:'vocals' to multiRole for every role, with branch-specific defaulting and no Firestore write migration"
    requirement: "R259"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/roster.test.ts#read-time multi-role compat shim (R259 — no write migration) (5 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RolesConfigPanel badge and QuarterGrid warn badge use the new multiRole flag/rule identically to the scheduler"
    requirement: "R259"
    verification:
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts#a role with multiRole:true shows the Multi-role marker and one without does not"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/QuarterGrid.test.ts#shows NO group conflict marker for a multi-role BAND role (vocals) + a TECH role — R259 cross-type allowance"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-27
status: complete
---

# Phase 89 Plan 01: Multi-Role Flag + Generalized Co-occurrence Rule Summary

**Renamed Role.vocal to a general per-role multiRole flag, rewrote evaluateGroupCombo to filter multi-role roles out before applying the Band/Tech/cap rule (making cross-type co-occurrence, e.g. vocalist + sound, now legal), and generalized the RoleSlideOver control to any group with owner helper text — all with a read-time-only legacy compat shim, no data migration.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-27T11:47:42Z
- **Completed:** 2026-08-27T12:42:00Z
- **Tasks:** 3
- **Files modified:** 15 (14 planned + 1 straggler fixture caught by the type-check gate)

## Accomplishments
- `Role.multiRole?: boolean` replaces `Role.vocal`; `DEFAULT_ROLES` vocals entry ships `multiRole: true`
- `evaluateGroupCombo`/`isGroupCompatible` rewritten to filter multi-role roleIds out of the candidate set first, then apply the unchanged Band<->Tech exclusivity + <=1-non-multi-Band-instrument-cap rule to the remainder — a multi-role role never conflicts and may cross Band/Tech/Other
- `quarters.ts`'s `buildIsVocal` renamed to `buildIsMultiRole`, threaded into `proposeQuarterSchedule` unchanged in wiring
- `roster.ts`'s onSnapshot shim now normalizes `multiRole` for EVERY role (not just the legacy `group:'vocals'` branch), with branch-specific defaulting so a pre-Phase-85 legacy vocals doc with neither field still surfaces as `multiRole:true`, while every other role defaults to `false` — read-time only, no Firestore write migration
- `RoleSlideOver.vue`'s Multi-role checkbox now shows for any group (not just Band), relabeled with owner helper text, and writes `multiRole` for any group on save
- `RolesConfigPanel.vue` badge and `QuarterGrid.vue` warn badge both switched to the new flag/rule, keeping the warn badge's logic byte-identical to the scheduler's

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the flag + rewrite the co-occurrence rule (production logic + scheduler test)** - `09782a49` (feat)
2. **Task 2: Store projection + read-time compat shim (quarters.ts, roster.ts, roster test)** - `cedbc6fd` (feat)
3. **Task 3: Generalize the UI control + badges/warn + remaining fixtures + full type-check gate** - `05cdd844` (feat)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `src/types/roster.ts` - `Role.vocal` renamed to `Role.multiRole` with rewritten JSDoc; `DEFAULT_ROLES` vocals entry ships `multiRole: true`
- `src/utils/scheduler.ts` - `evaluateGroupCombo`/`isGroupCompatible`/`proposeQuarterSchedule` renamed `isVocal`→`isMultiRole`; `evaluateGroupCombo` rewritten to filter-multi-first
- `src/utils/__tests__/scheduler.test.ts` - `makeIsVocal`→`makeIsMultiRole`; rewrote the vocals/Tech exclusivity test to assert the new cross-type allowance; added a non-multi-role exclusivity regression; added direct `evaluateGroupCombo` unit coverage for all 6 RESEARCH A.3 edge cases
- `src/stores/quarters.ts` - `buildIsVocal`→`buildIsMultiRole`, reads `r.multiRole`, threaded into `generateProposal`
- `src/stores/roster.ts` - onSnapshot shim normalizes `multiRole` for every role with branch-specific legacy defaulting
- `src/stores/__tests__/roster.test.ts` - shim tests assert `multiRole`; added legacy-vocal-field, no-field-legacy-vocals, non-vocals-default-false, and multiRole-wins-over-vocal cases
- `src/components/RoleSlideOver.vue` - Multi-role checkbox shown for any group, relabeled with helper text, `FormState.multiRole`, `onSave` writes `multiRole` unconditionally on group
- `src/components/RolesConfigPanel.vue` - badge checks `role.multiRole`, label "Multi-role"
- `src/components/QuarterGrid.vue` - `isVocalById`/`isVocal`→`isMultiRoleById`/`isMultiRole`, threaded into the warn badge's `evaluateGroupCombo` call
- `src/components/__tests__/RoleSlideOver.test.ts` - testid/payload renamed; inverted the band-only visibility test; added a helper-text assertion
- `src/components/__tests__/RolesConfigPanel.test.ts` - fixture flag + badge text updated
- `src/components/__tests__/QuarterGrid.test.ts` - fixture flag updated; added a cross-type-no-longer-warns case
- `src/components/__tests__/AvailabilityDrawer.test.ts` - straggler `vocal:true` fixture caught by `npm run type-check` (Rule 1 auto-fix)
- `src/views/__tests__/ServiceEditorView.test.ts` - fixture flag updated
- `src/views/__tests__/RosterView.test.ts` - fixture flag updated

## Decisions Made
- Flag named `multiRole` per RESEARCH A.1's recommendation (owner's working term, matches `buildIsMultiRole`/`isMultiRole` projection naming).
- The vocalist-can-now-run-Tech behavior change was implemented as designed (R259) rather than "fixed back" — the old exclusivity test was rewritten to assert the new cross-type allowance, and a fresh regression test on a genuinely non-multi Band role preserves exclusivity coverage.
- Compat shim uses branch-specific defaulting (vocals-group branch: `?? true`; default branch: no `?? true`) exactly as the plan-checker BLOCKER fix specified, so the fix doesn't silently default every non-vocals role to `multiRole:true`.
- `functions/src/serviceRoles.ts` was left untouched — confirmed via RESEARCH A.6 that its `vocal` field is never read server-side; no Cloud Functions deploy performed or required this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a straggler `vocal:true` test fixture in AvailabilityDrawer.test.ts not enumerated in the plan's `files_modified` list**
- **Found during:** Task 3 (full `npm run type-check` gate)
- **Issue:** `src/components/__tests__/AvailabilityDrawer.test.ts:87` built a `Role[]` fixture using the old `vocal: true` field, which is a type error once `Role.vocal` is renamed to `Role.multiRole` — this file was not listed in the plan's `files_modified`, but CLAUDE.md's `npm run type-check` gate (which typechecks test files) caught it exactly as the plan's critical_project_rules predicted ("Fix EVERY error it reports, not only the files the plan enumerates").
- **Fix:** Renamed the fixture field `vocal: true` → `multiRole: true`.
- **Files modified:** `src/components/__tests__/AvailabilityDrawer.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts` (9 tests pass); `npm run type-check` clean.
- **Committed in:** `05cdd844` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/type-error straggler)
**Impact on plan:** Necessary for `npm run type-check` completeness per CLAUDE.md's gate; no scope creep — same mechanical rename applied consistently.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 89-02 (R260 same-date bundling) can now build on `Role.multiRole`, `evaluateGroupCombo`'s filter-multi-first semantics, and `buildIsMultiRole`/`isMultiRole` — all in place and stable.
- Full app suite green except the documented baseline `src/storage.rules.test.ts` (Storage-emulator cross-service limitation, unrelated to this phase) — 4436 passed, 26 skipped, 1 known-failing file.
- `npm run type-check` (`vue-tsc --build`) clean across `src` + tests.
- No blockers.

---
*Phase: 89-multi-role-scheduling*
*Completed: 2026-08-27*
