---
phase: 15-per-role-frequency-role-categories
plan: 04
subsystem: database
tags: [typescript, vue, pinia, firestore, tdd, scheduler-wiring]

# Dependency graph
requires:
  - phase: 15-per-role-frequency-role-categories
    plan: 01
    provides: "RoleGroup union with 'vocals', PersonQuarterData.roleTiers? optional schema field"
  - phase: 15-per-role-frequency-role-categories
    plan: 02
    provides: "proposeQuarterSchedule roleGroupOf param (optional, defaults to () => 'other'), exported evaluateGroupCombo/isGroupCompatible"
provides:
  - "buildRoleGroupOf(roles) store helper — Map lookup from roleId to RoleGroup, unknown roleIds default to 'other'"
  - "generateProposal wires buildRoleGroupOf(rosterStore.roles) into proposeQuarterSchedule's final arg — auto-propose now enforces D-10/D-12 group co-occurrence rules in production, not just inside scheduler.ts's own tests"
  - "setPersonAvailability accepts and persists an optional roleTiers?: Record<string, FrequencyTier> field, written inside the existing scoped personQuarterData.<personId> dot-path write"
affects: [availability-drawer, quarter-grid]

# Tech tracking
tech-stack:
  added: []
  patterns: [scoped-dot-path-write-extended-with-richer-value, map-lookup-with-safe-default, real-module-substitution-for-integration-test-via-vi-importActual]

key-files:
  created: []
  modified:
    - src/stores/quarters.ts
    - src/stores/__tests__/quarters.test.ts

key-decisions:
  - "buildRoleGroupOf exposed on the store's public return object (same as buildResolveRolesForDate) so it's directly unit-testable and reusable, not kept as a private closure"
  - "The 'group rules engaged in production' proof uses vi.importActual('@/utils/scheduler') to substitute the REAL proposeQuarterSchedule into the existing mocked-module test harness for one test only — this exercises the actual 15-02 algorithm through the store's wiring instead of just asserting on mock call arguments, satisfying the plan's 'not just unit-level' requirement without restructuring the rest of the test file's mock-based bridge tests"
  - "roleTiers persists via the pre-existing spread (...data) in the personQuarterData.${personId} dot-path write — no new write logic needed, only the type signature grew a roleTiers? field, keeping the D-07 blackoutDates/pairedWith handling completely untouched"

requirements-completed: [D-05, D-12]

# Metrics
duration: ~18min
completed: 2026-07-09
---

# Phase 15 Plan 04: Group-Map Wiring + Per-Role Tier Persistence in Quarters Store Summary

**Wired `buildRoleGroupOf(rosterStore.roles)` into `generateProposal`'s call to `proposeQuarterSchedule` so auto-propose enforces TECH-exclusivity/BAND-VOCALS caps in production, and extended `setPersonAvailability` to persist a per-role `roleTiers` map through the existing scoped `personQuarterData.<personId>` write.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-09T01:34:00Z (approx.)
- **Completed:** 2026-07-09T01:42:49Z
- **Tasks:** 2 completed (each RED then GREEN)
- **Files modified:** 2

## Accomplishments
- `buildRoleGroupOf(roles: Role[])` added as a sibling of `buildResolveRolesForDate` — a `Map<roleId, RoleGroup>` lookup defaulting unknown/stale roleIds to `'other'` (T-15-04-02), exposed on the store's public API
- `generateProposal` now passes `buildRoleGroupOf(rosterStore.roles)` as the 6th/final arg to `proposeQuarterSchedule`, closing the wiring gap flagged in 15-02's Next Phase Readiness — without this, auto-propose would silently run with the "everything is 'other'" default and never enforce D-10/D-12 group rules
- A genuinely end-to-end test (using `vi.importActual` to substitute the real `scheduler.ts` into the store's mocked-module test harness) proves a person eligible for both a TECH role and a BAND role is never double-booked into both on the same date when scheduled through `generateProposal` — confirming the rules are engaged in production, not just inside scheduler.ts's own unit tests (T-15-04-03)
- `setPersonAvailability`'s `data` param gained an optional `roleTiers?: Record<string, FrequencyTier>` field; the existing `{ personId, ...data }` spread inside the already-scoped `personQuarterData.${personId}` dot-path write carries it through automatically — no new write logic, no bare `personQuarterData` root-key write, other people's entries untouched (T-15-04-01)
- `npx vitest run src/stores/__tests__/quarters.test.ts` — 30/30 green (24 pre-existing + 6 new); full suite `npx vitest run` — 639/639 green; `npm run type-check` (`vue-tsc --build`) — clean

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 (RED): failing group-map wiring case** - `dcb7303` (test)
2. **Task 1 (GREEN): wire roleGroupOf into generateProposal** - `b88021d` (feat)
3. **Task 2 (RED): failing roleTiers persistence case** - `26fd1b6` (test)
4. **Task 2 (GREEN): persist per-role roleTiers scoped write** - `d85f77b` (feat)

## TDD Gate Compliance

Both tasks' required gate commits present in git log, in order: `dcb7303` (RED, Task 1) then `b88021d` (GREEN, Task 1); `26fd1b6` (RED, Task 2) then `d85f77b` (GREEN, Task 2). No REFACTOR commits were needed — both implementations matched the planned shape on the first pass.

Note on Task 2's RED signal: the two new tests passed at the Vitest/esbuild-transform runtime level immediately (JS object spread doesn't enforce excess-property checks), but `npm run type-check` failed with `TS2353: roleTiers does not exist in type` against the un-widened `data` param — this is the real RED signal for a type-level API extension task, confirmed and captured in the RED commit message before the GREEN implementation widened the type.

## Files Created/Modified
- `src/stores/quarters.ts` — `buildRoleGroupOf(roles)` helper (Map lookup, `'other'` default), wired into `generateProposal`'s call to `proposeQuarterSchedule` as the final arg, exposed on the store's return object; `setPersonAvailability`'s `data` param type extended with optional `roleTiers?: Record<string, FrequencyTier>`
- `src/stores/__tests__/quarters.test.ts` — new `roleGroupOf` wiring-and-behavior test in the `generateProposal` describe block plus a `vi.importActual`-backed end-to-end TECH-exclusivity test; two new tests in the `setPersonAvailability` describe block covering `roleTiers` scoped persistence and back-compat omission

## Decisions Made
- Exposed `buildRoleGroupOf` on the store's public return object (mirroring `buildResolveRolesForDate`'s existing precedent) rather than keeping it a private module-level closure, so it is independently unit-testable and reusable by future callers (e.g. a manual-grid warning badge, if a future plan needs the same map shape from the store side rather than re-deriving from `evaluateGroupCombo`/`isGroupCompatible`).
- For the "group rules actually engaged in production" proof required by the plan's acceptance criteria (T-15-04-03), used `vi.importActual('@/utils/scheduler')` to swap the real `proposeQuarterSchedule` into the file's existing `vi.mock('@/utils/scheduler', ...)` harness for exactly one test, rather than restructuring the whole test file's mocking strategy. This keeps every other bridge test's simple mock-and-assert-call-args style intact while still exercising the genuine 15-02 algorithm end-to-end through `generateProposal`'s wiring for the one test that specifically needs to prove behavior, not just call shape.
- No new Firestore write logic was needed for `roleTiers` — the pre-existing `{ personId, ...data }` spread inside the scoped dot-path write already carries any new optional field on `data` through unchanged, so the GREEN commit is purely a type-signature extension (1 line) plus a doc comment, keeping the change minimal and avoiding any risk to the already-tested blackoutDates/pairedWith/pairing-diff logic (D-07).

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their acceptance criteria on the first pass; no auto-fixes, no architectural questions, no blockers. The one implementation nuance (Task 2's RED signal manifesting as a `vue-tsc` type error rather than a Vitest runtime failure, since JS object spread doesn't enforce excess-property checks at runtime) is a natural consequence of TDD-ing a TypeScript type-widening change and is not a deviation from the plan's intent — the RED commit documents this explicitly.

## Issues Encountered
None.

## User Setup Required
None — pure internal TypeScript/store logic change, no external services, no new packages (per the plan's threat model, T-15-04-SC disposition is "accept — zero packages installed").

## Next Phase Readiness
Auto-propose (`generateProposal`) now enforces the D-10/D-12 group co-occurrence rules in production via `buildRoleGroupOf`, proven end-to-end against the real scheduler algorithm. `setPersonAvailability` now has a `roleTiers` write target scoped exactly like every other per-person quarter-data field. The remaining Wave 3 UI plans (availability drawer per-role tier controls, RosterView per-role frequency form, QuarterGrid group-violation warning badge) can now safely call `setPersonAvailability({ ..., roleTiers })` and rely on `generateProposal` respecting whatever roles/groups the roster defines, with no further store-layer wiring required. No blockers.

---
*Phase: 15-per-role-frequency-role-categories*
*Completed: 2026-07-09*
