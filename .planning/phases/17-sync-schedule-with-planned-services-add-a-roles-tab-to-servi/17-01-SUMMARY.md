---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
plan: 01
subsystem: service-role-resolution
tags: [types, utils, tdd, pure-function]
dependency-graph:
  requires: []
  provides:
    - "Service.roleAssignmentOverrides field"
    - "src/utils/serviceRoles.ts (findQuarterForDate, resolveServiceRoleAssignments)"
    - "ResolvedRoleAssignment type"
  affects:
    - "17-02 (store writes: setRoleOverride/clearRoleOverride, extended createShareToken)"
    - "17-03 (Roles tab UI)"
    - "17-04/17-05 (public share view)"
tech-stack:
  added: []
  patterns:
    - "Sparse override map layered on a computed default (mirrors Quarter.roleOverridesByDate)"
    - "Pure function in utils/ (no store/Pinia/Firebase imports) — same convention as slug.ts/quarterDates.ts"
key-files:
  created:
    - src/utils/serviceRoles.ts
    - src/utils/__tests__/serviceRoles.test.ts
  modified:
    - src/types/service.ts
decisions:
  - "Adopted first-match-wins tie-break for findQuarterForDate when two quarters both list the same service date (accepted pre-existing edge case, not a regression this phase introduces — 17-RESEARCH.md Open Question 1)"
  - "resolveServiceRoleAssignments stays id-only (roleId/personId strings) — never reaches into Person for email/phone (T-17-01-01)"
metrics:
  duration: ~25min
  completed: 2026-07-22
status: complete
---

# Phase 17 Plan 01: Pure seeding-join foundation Summary

Added the `Service.roleAssignmentOverrides` sparse-override field and the pure, store-free `resolveServiceRoleAssignments`/`findQuarterForDate` resolver that computes each role's effective assignment (override ?? quarter-scheduled ?? []) for a service date, with a full TDD-driven Vitest suite covering the round-trip invariant, override-wins, explicit-clear-vs-inherit, no-quarter, ordering, and tie-break behaviors.

## What Was Built

**Task 1 — `Service.roleAssignmentOverrides` field** (`src/types/service.ts`): a single optional field `roleAssignmentOverrides?: Record<string, string[]>` (roleId -> personId[]) added to the `Service` interface, mirroring the existing `Quarter.roleOverridesByDate` sparse-override precedent. `ServiceInput` required no change since the field is optional. `npx vue-tsc --build` is green.

**Task 2 — `src/utils/serviceRoles.ts`** (TDD RED->GREEN): a pure-functions module exporting:
- `ResolvedRoleAssignment` interface (roleId, roleName, group, scheduledPersonIds, overriddenPersonIds, effectivePersonIds)
- `findQuarterForDate(quarters, date)` — first quarter whose `serviceDates` includes `date`, `undefined` if none
- `resolveServiceRoleAssignments(service, quarters, roles)` — for each role sorted by `order` ascending: `scheduledPersonIds = quarter?.calendar[service.date]?.[role.id] ?? []`; `overriddenPersonIds = service.roleAssignmentOverrides?.[role.id] ?? null`; `effectivePersonIds = overriddenPersonIds ?? scheduledPersonIds`

No Firestore/Pinia/store imports — verified store-free via `grep -v '^\s*//' src/utils/serviceRoles.ts | grep -c "stores/"` returning `0`.

## TDD Gate Compliance

- RED: `b9a12fb test(17-01): add failing test for serviceRoles resolver` — confirmed failing (module not found) before implementation existed.
- GREEN: `0d16300 feat(17-01): implement pure serviceRoles resolver` — all 8 tests (A-F, split across `describe` blocks) pass; `npx vue-tsc --build` green.
- REFACTOR: not needed — implementation matched 17-PATTERNS.md's recommended signature verbatim; no cleanup pass required.

## Test Coverage

`npx vitest run src/utils/__tests__/serviceRoles.test.ts` — 8 tests passed:
- Test A (seed): round-trip invariant — un-overridden role's `effectivePersonIds` equals `quarter.calendar[date][roleId]`
- Test B (override wins): override present ignores the schedule
- Test C (explicit clear vs inherit): override `[]` -> nobody serving, distinct from absent override -> inherits schedule
- Test D (no quarter): every role resolves with empty `scheduledPersonIds`, no throw
- Test E (ordering): results sorted by `role.order` ascending
- Test F / `findQuarterForDate` unit tests: correct match, `undefined` when none, deterministic first-match tie-break

Full `src/utils` suite re-run after implementation: 384 tests passed across 14 files — no regressions.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>`/`<acceptance_criteria>` blocks precisely; no auto-fixes, no architectural questions, no auth gates.

One environment note (not a deviation from the plan's content, just a one-time setup step): `node_modules/` did not exist in this working tree at execution start, so `npm install` was run before the first `vue-tsc`/`vitest` invocation to make the verification commands runnable.

## Known Stubs

None. Both artifacts are fully implemented and tested; no placeholder/empty-value stubs were introduced.

## Threat Flags

None. This plan introduces no new trust boundary — pure functions operating on already-authorized, in-memory data (per the plan's own threat model, which found no new STRIDE surface beyond the two accepted/mitigated items already listed in 17-01-PLAN.md).

## Self-Check: PASSED

- FOUND: src/types/service.ts (roleAssignmentOverrides field present, line 67)
- FOUND: src/utils/serviceRoles.ts
- FOUND: src/utils/__tests__/serviceRoles.test.ts
- FOUND commit: 7191659 (feat: Service field)
- FOUND commit: b9a12fb (test: RED)
- FOUND commit: 0d16300 (feat: GREEN)
