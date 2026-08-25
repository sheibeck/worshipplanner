---
phase: 80-security-data-integrity-hardening
plan: 02
subsystem: services-store
tags: [firestore, share-links, cascade-delete, data-integrity, client-only]

# Dependency graph
requires: []
provides:
  - "deleteService revokes every shareTokens/serviceShareLinks/serviceShares artifact for a service before deleting the service doc (R234)"
affects: [80-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded existence-check before deleteDoc (getDoc().exists()) for direct-keyed public-share docs, mirroring deleteQuarter's precedent"
    - "Query-based cascade delete (getDocs(query(where(...)))) for a one-to-many artifact type, instead of a single denormalized field"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "shareTokens deletion rebuilds each ref from doc(db,'shareTokens', tokenDoc.id) rather than a snapshot .ref field, matching this codebase's existing getDocs mocking/usage convention (ensureShareLink's adoption query does the same)."
  - "serviceShares revocation is only attempted when the service object is found in the in-memory store (services.value.find) BEFORE any delete — the key needs service.date, which is unrecoverable once the service doc is gone."
  - "Each of the three artifact types is checked/queried independently (no single outer gate), since a service can have any subset of them present — unlike deleteQuarter's single shareToken-gated block."

requirements-completed: [R234]

coverage:
  - id: D1
    description: "Deleting a service with 2 shareTokens docs (both serviceId == id) deletes BOTH token docs"
    requirement: R234
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#deleteService > R234: deletes every shareTokens doc whose serviceId matches, including 2+"
        status: pass
    human_judgment: false
  - id: D2
    description: "serviceShareLinks/{id} is deleted when present; absent -> no delete call, no throw"
    requirement: R234
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#deleteService > R234: deletes serviceShareLinks/{id} when present / does not call deleteDoc ... when absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "serviceShares/{slug}__service-{date} is deleted when present; absent -> no delete call, no throw"
    requirement: R234
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#deleteService > R234: deletes serviceShares/{slug}__service-{date} when present / does not call deleteDoc ... when absent"
        status: pass
    human_judgment: false
  - id: D4
    description: "A never-shared service (no tokens, no link, no share doc) deletes the service doc and does not throw / does not hit permission-denied"
    requirement: R234
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#deleteService > R234: a never-shared service deletes without throwing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The service doc delete happens AFTER all revocation deletes; shareLinkCache.delete(id) still runs (WR-03 preserved)"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#deleteService > WR-03: deleting a service drops its shareLinkCache entry (pre-existing test, re-confirmed green)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Type gate clean and full services.test.ts + full app suite non-regressing (stays at the documented 2-file known-failing baseline)"
    verification:
      - kind: unit
        ref: "npm run type-check"
        status: pass
      - kind: unit
        ref: "npx vitest run src/stores/__tests__/services.test.ts (101/101 passed)"
        status: pass
      - kind: unit
        ref: "npx vitest run (4154 passed, 26 failed across exactly storage.rules.test.ts + RosterView.test.ts — the documented baseline)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-08-24
status: complete
---

# Phase 80 Plan 02: deleteService Share-Artifact Revocation (R234) Summary

**deleteService now revokes every public share artifact a service can accumulate — shareTokens (query-based, handles multiples), serviceShareLinks, and serviceShares — before deleting the service doc, closing the stale-share-URL information-disclosure gap.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`src/stores/services.ts`, `src/stores/__tests__/services.test.ts`)

## Accomplishments
- `deleteService(id)` in `src/stores/services.ts` now looks up the service object from `services.value` BEFORE any delete (needed for `service.date`), then revokes all three public-share artifact types — `shareTokens` (query by `serviceId`, deletes every match), `serviceShareLinks/{id}` (existence-guarded), and `serviceShares/{slug}__service-{date}` (existence-guarded, resolved via the org's slug) — before deleting the service doc itself last, mirroring `deleteQuarter`'s shipped revocation precedent.
- Added 6 new unit tests inside `describe('deleteService', ...)` covering: multi-`shareTokens` deletion, present/absent `serviceShareLinks`, present/absent `serviceShares`, and the never-shared no-throw case.
- Two pre-existing tests whose assertions assumed the old single-`deleteDoc`-call behavior (`services.test.ts`'s original `deleteService` doc-reference test and the `draft-only write guard`'s D-15 delete-at-every-status loop) were updated to mock `getDoc` as absent and/or assert on the specific deleted path rather than a bare call count — both now correctly reflect the expanded revocation behavior while still proving their original intent (correct doc reference; delete allowed at every status).

## Task Commits

Each task was committed atomically:

1. **Task 1: Revoke all three share artifacts in deleteService (R234)** - `9ff7ed85` (feat)
2. **Task 2: Type-check and full deleteService suite green** - no code changes needed; verification only (`npm run type-check` and the full `services.test.ts` file were already clean after Task 1)

## Files Created/Modified
- `src/stores/services.ts` - `deleteService` grows a query-based, existence-guarded share-artifact revocation block ahead of the service-doc delete
- `src/stores/__tests__/services.test.ts` - new `deleteService` cases (multi-shareTokens, present/absent serviceShareLinks, present/absent serviceShares, never-shared no-throw); two pre-existing tests adjusted for the new call shape

## Decisions Made
- `shareTokens` deletion rebuilds each doc ref via `doc(db, 'shareTokens', tokenDoc.id)` rather than relying on a `.ref` field on the query-result docs, matching the existing `getDocs`/`ensureShareLink` mocking and usage convention already established in this file — the module's test mock for `getDocs` returns `{ id, data() }` shapes with no `.ref`.
- `serviceShares` revocation is gated on the service being found in `services.value` (looked up before any delete); if the store has no record of the service (e.g., a subscribe with no snapshot yet), that one artifact type is skipped rather than thrown — the other two artifact types (query-based `shareTokens`, direct-keyed `serviceShareLinks`) do not depend on the lookup and still run.
- Kept the plan's discretion: each of the three artifact types is checked/queried independently (no single outer `if` gate), since a service can have any subset of them present, unlike `deleteQuarter`'s single `shareToken`-gated block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing tests' assertions no longer matched the new (correct) delete-call shape**
- **Found during:** Task 1 verification (`-t "deleteService"` run surfaced the first; the D-15 loop failure was caught before it could regress, since the module-level `getDoc` mock defaults to `exists: () => true`, which now causes every direct-keyed revocation check to also fire a `deleteDoc`)
- **Issue:** `services.test.ts`'s original `'calls deleteDoc with the correct doc reference'` test and the `draft-only write guard (R036)` describe block's `'allows delete while the stored status is ${status} (D-15)'` loop both asserted `deleteDoc` was called exactly once — true under the old single-delete `deleteService`, no longer true once revocation checks two additional direct-keyed docs (which the shared default mock reports as existing).
- **Fix:** Renamed/scoped the first test to the never-shared-service case (`getDoc` mocked absent) and asserted on the specific deleted path rather than a bare count; the D-15 loop test was given the same `getDoc`-absent override and now asserts the service doc's path is among the deleted paths, preserving its original intent (delete is allowed at every stored status) without being entangled with the new revocation logic.
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** Full `services.test.ts` file: 101/101 passing.
- **Committed in:** `9ff7ed85`

---

**Total deviations:** 1 auto-fixed (Rule 1 - test-assertion adjustment necessitated by the correctly-expanded revocation behavior)
**Impact on plan:** No scope creep — these are the exact class of test adjustment implied by the plan's instruction to keep the two pre-existing tests green, since "green" here required their assertions to reflect the new, correct call shape rather than the old one.

## Issues Encountered
None. No architectural decisions, no auth gates, no package installs. All work was client-only per the plan's scope (no `firestore.rules` change — the `allow delete` rules for `shareTokens`, `serviceShareLinks`, and `serviceShares` were already in place).

## User Setup Required
None. Client-only change, no deploy step, no `.env.local` or secret changes.

## Next Phase Readiness
`src/stores/services.ts` and `src/stores/__tests__/services.test.ts` are in a clean, fully-green state for Plan 80-03. No blockers.

---
*Phase: 80-security-data-integrity-hardening*
*Completed: 2026-08-24*

## Self-Check: PASSED

All claimed files exist (`src/stores/services.ts`, `src/stores/__tests__/services.test.ts`, this SUMMARY) and the commit hash `9ff7ed85` is present in git history.
