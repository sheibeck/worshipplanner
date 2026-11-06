---
phase: 147-default-rehearsal-day-and-time
plan: 03
subsystem: services
tags: [rehearsals, createService, serviceShares, firestore, tdd, typescript]

requires:
  - phase: 147-default-rehearsal-day-and-time
    provides: buildAutoRehearsal, StoredRehearsal, inZone, ADR-0249, narrowed public projections (Plan 02)
provides:
  - createService adds one marked rehearsal from the default day and first default time
  - updateService retires the old date's serviceShares page after a real date change
  - services.publicDocs.test.ts, an in-memory document store test of what the store writes and removes
affects: [147-04, 147-05]

tech-stack:
  added: []
  patterns:
    - "Old value taken before the write (cache, else one direct read), compared after, so a normal save adds no read"
    - "Soft-failing cleanup helpers that never rethrow once the user's save has succeeded"
    - "Public-document tests assert the documents exist before asserting what they lack"

key-files:
  created:
    - src/stores/__tests__/services.publicDocs.test.ts
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.rehearsalDefaults.test.ts

key-decisions:
  - "The old date is read before updateDoc, because afterwards the stored doc already holds the new date"
  - "retireOldServiceShare reads the new date's page and requires it to record this service before it touches the old one"
  - "The in-memory mock clones with JSON, not structuredClone, because the store passes Vue reactive proxies that structuredClone rejects"

requirements-completed: []
requirements-note: "R460, R461, R462, R463, R465 are in the plan frontmatter but deliberately left open; the orchestrator closes them after phase verification."

duration: 25min
completed: 2026-11-06
status: complete
---

# Phase 147 Plan 03: createService default rehearsal and old-page retirement Summary

**`createService` now starts a service with one marked rehearsal on the default day (first default time), and `updateService` removes the old date's public page after a real date change, only once the new page exists and records the service.**

## Commits

| Step | Hash | Subject |
| ---- | ---- | ------- |
| Task 1 RED | `626df920` | test(147-03): add failing tests for the default rehearsal and old-page removal |
| Task 2 GREEN | `c952bbe6` | feat(147-03): add the default rehearsal to new services and retire the old date's page |

## What was built

- `createService` calls `buildAutoRehearsal(data.date, rehearsalDefaultWeekday, rehearsalTimeDefaults?.[0])`. The one row (or none) feeds both the `addDoc` payload and the `created` object for `ensureShareLink`. The `See ADR-0245` pointer comment is now `See ADR-0249`.
- `updateService` takes the pre-write date from `services.value`, falling back to one direct read (`readStoredServiceDate`) only when the service is not cached and the payload has a `date`. After `maybeRefreshShareLink` it calls `retireOldServiceShare` only when the new date is a string, the old date is truthy and they differ.
- `retireOldServiceShare` reads the org slug, confirms the new date's page exists and records this service, then deletes the old page only if it exists and records this service (ADR-0163). One try/catch, never rethrows.
- `services.publicDocs.test.ts` uses a path-keyed in-memory store (`setDoc`, `getDoc`, `deleteDoc`, a merging `updateDoc`, a transaction) so every public-document assertion is made on documents that were actually stored.

## What passed at RED (`626df920`)

Failed at RED: AC-RHD-17, 18, 19, 20, 21 (all three zones), 25, 10, 51, 56 (warm and cold), 58 (write-then-remove order), 59 (both, on the `console.error` assertion), 68, and the plain test for a rejected stored-date read.

Passed at RED, as the plan expected, because they are regression guards: AC-RHD-22, 23, 24, 66 (rows were always `[]`), AC-RHD-52 (Plan 02 already narrowed the projections), AC-RHD-57 (the refresh already writes the new date), AC-RHD-60, 61 (both cases), 62, the second AC-RHD-58 case, and the plain tests for an absent old page, a cold cache with no new page, and no added read. All four pre-existing `rehearsalDefaults` tests kept passing.

## Residual check

- After RED: `uncited=33 other=0`
- After GREEN: `uncited=33 other=0`

## Verification

- Scoped run (rehearsalDefaults, publicDocs, services, rehearsalProjection): 4 files, 173 tests, all pass.
- `npm run type-check`: exits 0.
- `git ls-files --eol` shows `i/lf w/crlf` (no `w/mixed`) on `services.ts` and `services.rehearsalDefaults.test.ts`. `services.publicDocs.test.ts` is new and LF, which git will convert on next touch (same as the repo's other new files).
- No unexpected file deletions in either commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mock cloned with `structuredClone` threw `DataCloneError`**
- **Found during:** Task 1 RED run
- **Issue:** the store passes Vue reactive proxies (slots arrays) to `setDoc`, which `structuredClone` rejects, so the share write failed inside the harness before it could prove anything.
- **Fix:** the in-memory mock clones with a JSON round trip (`h.clone`).
- **Files modified:** `src/stores/__tests__/services.publicDocs.test.ts`
- **Commit:** `626df920`

No spec/plan disagreements found: every criterion ID the plan assigns matches the spec text.

## Known Stubs

None.

## Threat Flags

None. The only new write path is a `deleteDoc` on `serviceShares`, already covered by the plan's threat model (T-147-05, T-147-06) and the existing rules.

## Self-Check: PASSED

- `src/stores/__tests__/services.publicDocs.test.ts` found
- `src/stores/services.ts` contains `retireOldServiceShare` (2), `readStoredServiceDate` (2), `buildAutoRehearsal(` (1)
- Commits `626df920` and `c952bbe6` found
