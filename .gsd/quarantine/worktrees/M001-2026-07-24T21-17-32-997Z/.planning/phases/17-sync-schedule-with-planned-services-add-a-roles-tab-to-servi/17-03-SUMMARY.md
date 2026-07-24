---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
plan: 03
subsystem: service-store-persistence
tags: [firestore, pinia-store, tdd, scoped-writes, public-share, pii-guard]
dependency-graph:
  requires:
    - "17-01: Service.roleAssignmentOverrides field + resolveServiceRoleAssignments/findQuarterForDate resolver"
    - "17-02: serviceShares Firestore collection/rules (deployed live) + memorable route + reserved slug"
  provides:
    - "useServiceStore.setRoleOverride(serviceId, roleId, personIds) — scoped dot-path write"
    - "useServiceStore.clearRoleOverride(serviceId, roleId) — deleteField() scoped write"
    - "Extended createShareToken: serviceSnapshot.roleAssignments (names-only) + serviceShares/{slug}__service-{date} memorable-URL write"
  affects:
    - "17-04 (Roles tab UI consumes setRoleOverride/clearRoleOverride)"
    - "17-05 (public ShareView consumes serviceSnapshot.roleAssignments and reads serviceShares)"
tech-stack:
  added: []
  patterns:
    - "Scoped dot-path write (never whole-map rewrite) — mirrors quarters.ts::assignPerson (D-01)"
    - "Names-only denormalized public snapshot via personId->name Map, never raw Person object (D-24 PII guard)"
    - "Soft-fail try/catch around memorable-URL slug-claim + secondary share write — mirrors finalizeAndShare"
key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts
    - src/utils/__tests__/slug.test.ts
decisions:
  - "createShareToken's memorable-URL write uses the orgIdValue parameter (not the orgId ref) throughout, consistent with the existing opaque shareTokens write's use of the caller-supplied orgIdValue"
  - "Fixed a pre-existing regression in slug.test.ts (17-02 added 'service-share' to RESERVED_SLUGS without updating the test's hardcoded size/list) — Rule 1 auto-fix, required for this plan's own npm run test:unit wave gate"
metrics:
  duration: ~20min
  completed: 2026-07-22
status: complete
---

# Phase 17 Plan 03: Service store write surface — scoped overrides + names-only share Summary

Added `setRoleOverride`/`clearRoleOverride` (scoped `roleAssignmentOverrides.{roleId}` dot-path writes, never a whole-map rewrite) and extended `createShareToken` to embed a names-only `roleAssignments` array into the existing public snapshot plus a soft-failing `serviceShares/{slug}__service-{date}` memorable-URL write, proven by a fully TDD-driven (RED→GREEN) Vitest suite.

## What Was Built

**Task 1 — `setRoleOverride`/`clearRoleOverride`** (`src/stores/services.ts`): two new async store actions, both guarded on `orgId.value` (no-op when unset, mirroring every other write action in this store). `setRoleOverride(serviceId, roleId, personIds)` calls `updateDoc` with exactly one computed key — `` [`roleAssignmentOverrides.${roleId}`]: personIds `` — plus `updatedAt: serverTimestamp()`, mirroring `quarters.ts::assignPerson`'s `calendar.${date}.${roleId}` dot-path pattern verbatim (D-01). `clearRoleOverride(serviceId, roleId)` writes the same scoped key set to `deleteField()`. `deleteField` was added to the existing `firebase/firestore` import block.

**Task 2 — Extended `createShareToken`** (`src/stores/services.ts`): the function now also imports `useRosterStore`, `useQuartersStore`, `resolveServiceRoleAssignments`, `getDoc`, `deriveSlug`, `claimSlug`.
- Builds `nameById = new Map(rosterStore.people.map(p => [p.id, p.name]))` (names only — never the raw `Person` object, D-04/D-24 PII guard) and computes `resolved = resolveServiceRoleAssignments(service, quartersStore.quarters, rosterStore.roles)`.
- Adds `roleAssignments: Array<{roleId, roleName, group, personNames}>` to the existing `serviceSnapshot`, where `personNames = effectivePersonIds.map(id => nameById.get(id) ?? id)`.
- After the opaque `shareTokens/{token}` `setDoc` succeeds, a try/catch block resolves (or claims, on first share) the org's memorable-URL slug via `getDoc`/`deriveSlug`/`claimSlug` (same fallback-to-`'org'` logic as `finalizeAndShare`), then writes `serviceShares/{slug}__service-{date}` with `{orgId, orgSlug, serviceSnapshot, token, updatedAt}`. The whole block is soft-fail: any error is `console.error`-logged and swallowed so the opaque token share — already committed — is always returned regardless of the memorable-URL step's outcome.

## TDD Gate Compliance

- RED: `aa628f2 test(17-03): add failing tests for setRoleOverride/clearRoleOverride and extended createShareToken` — 7 new tests confirmed failing (2 `store.setRoleOverride is not a function`, 2 `store.clearRoleOverride is not a function`, 2 missing `roleAssignments`/`serviceShares`, 1 missing soft-fail `console.error` call) before any implementation existed.
- GREEN: `02a1b9f feat(17-03): add setRoleOverride/clearRoleOverride and extend createShareToken` — all new tests pass; two pre-existing `createShareToken` tests updated from `toHaveBeenCalledOnce()` to `toHaveBeenCalledTimes(2)` since the function now legitimately performs two `setDoc` writes.
- REFACTOR: not needed — implementation matched 17-PATTERNS.md's recommended shape verbatim; no cleanup pass required.

## Test Coverage

`npx vitest run src/stores/__tests__/services.test.ts` — 29 tests passed (7 new, 22 pre-existing unaffected or updated for the new call-count):
- `setRoleOverride`: writes exactly `{roleAssignmentOverrides.{roleId}, updatedAt}` (no bare whole-map key); no-ops when `orgId` unset
- `clearRoleOverride`: writes the `deleteField()` sentinel for the single scoped key; no-ops when `orgId` unset
- `createShareToken`: embeds `roleAssignments` with correct `personNames` resolved from the mocked `useRosterStore`/`useQuartersStore`; serialized written payload contains no `email`/`phone`/`pcPersonId` substring anywhere; writes a second `serviceShares/{slug}__service-{date}` doc after the opaque token write; soft-fails (still returns a valid 36-char token + logs via `console.error`) when the `serviceShares` `setDoc` rejects

Also fixed: `src/utils/__tests__/slug.test.ts` — `RESERVED_SLUGS.size` assertion updated from 12 to 13 (and `'service-share'` added to the expected-membership list), a pre-existing regression from 17-02 that only surfaced now because this plan's wave gate runs the full `npm run test:unit` (17-02 only ran `npm run test:rules`).

Full `npm run test:unit` re-run: 754/754 individual tests passed across every file that loads successfully. One test **file** (`src/views/__tests__/RosterView.test.ts`) fails to load entirely due to a `Firebase: Error (auth/invalid-api-key)` at module-import time — this is a pre-existing, environment-level condition (no Firebase env vars configured in this sandbox), unrelated to any file touched by this plan (confirmed via `git diff HEAD~2 --stat` showing only `services.ts`, `services.test.ts`, and `slug.test.ts` changed) and out of this plan's scope per the deviation rules' scope boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing RESERVED_SLUGS count regression in slug.test.ts**
- **Found during:** Task 2 verification (full `npm run test:unit` wave gate)
- **Issue:** Plan 17-02 added `'service-share'` to `RESERVED_SLUGS` in `src/utils/slug.ts` but never updated `slug.test.ts`'s hardcoded `expect(RESERVED_SLUGS.size).toBe(12)` assertion or its expected-membership list (that plan only ran `npm run test:rules`, not `npm run test:unit`, so the regression went uncaught until now).
- **Fix:** Updated the assertion to `toBe(13)` and added `'service-share'` to the expected list.
- **Files modified:** `src/utils/__tests__/slug.test.ts`
- **Commit:** `206cba5`

**2. [Rule 1 - Bug] Updated two pre-existing createShareToken tests for the new second setDoc call**
- **Found during:** Task 2 GREEN verification
- **Issue:** `createShareToken calls setDoc with token as document ID` and `createShareToken embeds BPM...` both asserted `setDoc` was called exactly once — now stale since this same plan's Task 2 legitimately adds a second `setDoc` (the `serviceShares` memorable-URL write).
- **Fix:** Changed both assertions to `toHaveBeenCalledTimes(2)`, keeping the existing assertions against `mock.calls[0]` (the opaque token write) unchanged.
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Committed in:** `02a1b9f` (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug, both required for the plan's own `npm run test:unit` wave gate to pass; no scope creep, no architectural changes).
**Impact on plan:** Zero — both fixes were pre-existing test staleness surfaced by, but not caused by, this plan's changes.

## Issues Encountered

None beyond the two auto-fixed items above.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1+2 (RED) | Failing tests for scoped overrides + extended createShareToken | `aa628f2` |
| 1+2 (GREEN) | setRoleOverride/clearRoleOverride + extended createShareToken implementation | `02a1b9f` |
| Deviation fix | RESERVED_SLUGS count regression fix | `206cba5` |

## Files Created/Modified
- `src/stores/services.ts` - Added `setRoleOverride`/`clearRoleOverride` scoped dot-path writes; extended `createShareToken` with names-only `roleAssignments` + soft-fail `serviceShares` memorable-URL write
- `src/stores/__tests__/services.test.ts` - New test cases for both tasks; mocked `useRosterStore`/`useQuartersStore`; added `getDoc`/`deleteField` to the firestore mock
- `src/utils/__tests__/slug.test.ts` - Fixed pre-existing RESERVED_SLUGS count/membership regression from 17-02

## Decisions Made
- `createShareToken`'s memorable-URL write uses the `orgIdValue` parameter throughout (not `orgId.value`), consistent with the function's existing signature and the opaque write's use of the caller-supplied value — no behavior change from the caller's perspective.
- No new architectural surface: both tasks are pure additions to an existing store's write surface, exactly as scoped in the plan's `assumption_delta_decision`.

## Known Stubs

None. Both `setRoleOverride`/`clearRoleOverride` and the extended `createShareToken` are fully implemented, wired to real Firestore calls (mocked only in tests), and covered by passing tests.

## Threat Flags

None beyond what the plan's own threat model already anticipated and mitigated (T-17-03-01 through T-17-03-04 — see 17-03-PLAN.md `<threat_model>`), all of which are proven by the test suite added in this plan:
- T-17-03-01 (PII in public snapshot) — proven by the "no email/phone/pcPersonId" serialized-payload test.
- T-17-03-02 (whole-map override clobber) — proven by the "exactly one scoped key" tests for both `setRoleOverride` and `clearRoleOverride`.
- T-17-03-03 (memorable-URL failure breaking share) — proven by the soft-fail test.
- T-17-03-04 (cross-org serviceShares overwrite) — already closed by 17-02's deployed Firestore rules; this plan writes only its own org's doc via the same `orgId`-scoped shape.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `setRoleOverride`/`clearRoleOverride` are ready for 17-04's Roles tab UI to call directly.
- The extended `createShareToken`'s `serviceSnapshot.roleAssignments` and the new `serviceShares` doc are ready for 17-05's public `ShareView.vue` "Who's Serving" section to read (per 17-PATTERNS.md's `ShareView.vue` extension plan).
- No blockers identified.

## Self-Check: PASSED

- FOUND: `src/stores/services.ts` — `setRoleOverride` (line 149), `clearRoleOverride` (line 163), `deleteField` import (line 9), `roleAssignments` (lines 200, 216), `serviceShares` (lines 228, 244, 253), `resolveServiceRoleAssignments` (lines 23, 199)
- FOUND: `src/stores/__tests__/services.test.ts` — new `describe` blocks for `setRoleOverride`, `clearRoleOverride`, and 4 new `createShareToken` tests
- FOUND: `src/utils/__tests__/slug.test.ts` — updated `RESERVED_SLUGS` assertion
- FOUND commit: `aa628f2` (test: RED)
- FOUND commit: `02a1b9f` (feat: GREEN)
- FOUND commit: `206cba5` (fix: pre-existing regression)
- `npx vitest run src/stores/__tests__/services.test.ts` — 29/29 passed
- `npx vue-tsc --build` — clean, no errors
- `npm run test:unit` — 754/754 individual tests passed (1 unrelated pre-existing test file fails to load due to missing Firebase env vars in this sandbox, confirmed untouched by this plan)

---
*Phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi*
*Completed: 2026-07-22*
