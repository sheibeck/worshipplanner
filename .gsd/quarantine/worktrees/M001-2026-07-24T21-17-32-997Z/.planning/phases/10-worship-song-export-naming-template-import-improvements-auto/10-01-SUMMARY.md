---
phase: 10
plan: "01"
subsystem: api
tags: [planningcenter, api, export, tdd]
dependency_graph:
  requires: []
  provides: [deleteItem, fetchServiceTypeTeams, addTeamToPlan, worship-song-title-prefix]
  affects: [src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts]
tech_stack:
  added: []
  patterns: [json-api-rest-client, basic-auth-header, vitest-fetch-mock]
key_files:
  modified:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts
decisions:
  - "Worship Song prefix applied to SONG and HYMN branches only — SCRIPTURE/PRAYER/MESSAGE slots unaffected"
  - "fetchServiceTypeTeams placed immediately after fetchTemplates for locality with other service-type fetchers"
  - "deleteItem and addTeamToPlan placed after updateItem — all item/plan-mutation functions grouped together"
  - "addTeamToPlan uses optional timeId parameter — non-fatal 422 failure handling is caller's responsibility per D-05"
  - "Existing addSlotAsItem tests updated to expect prefixed titles (3 tests updated)"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_modified: 2
---

# Phase 10 Plan 01: API Layer — Worship Song Prefix + New PC API Exports Summary

**One-liner:** Added "Worship Song - " title prefix to PC export items plus three new API primitives (`deleteItem`, `fetchServiceTypeTeams`, `addTeamToPlan`) with full TDD coverage (11 new tests, 72 total passing).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Prefix SONG/HYMN titles with "Worship Song - " | 37c3aec | planningCenterApi.ts, planningCenterApi.test.ts |
| 2 | Add deleteItem, fetchServiceTypeTeams, addTeamToPlan exports | 6b619cc | planningCenterApi.ts, planningCenterApi.test.ts |

## What Was Built

### Task 1: Title Prefix (FEAT-1)

Modified `addSlotAsItem` in `src/utils/planningCenterApi.ts`:

- **SONG branch** (line 798): `const title = \`Worship Song - ${slot.songTitle ?? '[Empty Song]'}\``
- **HYMN branch** (line 849): `const title = \`Worship Song - ${slot.hymnName}${numPart}${versesPart}\``

Added `describe('addSlotAsItem - Worship Song prefix')` with 4 new tests covering:
1. SONG with `songTitle: 'I Believe'` → `'Worship Song - I Believe'`
2. SONG with `songTitle: undefined` → `'Worship Song - [Empty Song]'`
3. HYMN with name + number + verses → `'Worship Song - Holy, Holy, Holy #1 (vv. 1-3)'`
4. HYMN with bare name only → `'Worship Song - Amazing Grace'`

Updated 3 existing tests to expect prefixed titles (they previously asserted bare titles).

### Task 2: New API Exports (FEAT-2, FEAT-3)

Added three new exported functions to `src/utils/planningCenterApi.ts`:

**`fetchServiceTypeTeams`** (line 105):
- `GET /service_types/{serviceTypeId}/teams?per_page=100`
- Returns `Array<{ id: string; name: string }>` mapped from JSON:API `data[].attributes.name`
- Throws `Failed to fetch teams: {status}` on non-ok

**`deleteItem`** (line 498):
- `DELETE /service_types/{serviceTypeId}/plans/{planId}/items/{itemId}`
- Resolves void on 2xx (e.g. 204 No Content)
- Throws `Failed to delete item: {status} {text}` on non-ok

**`addTeamToPlan`** (line 528):
- `POST /service_types/{serviceTypeId}/plans/{planId}/needed_positions`
- Body: `{ data: { type: 'NeededPosition', attributes: { quantity: 1 }, relationships: { team: { data: { type: 'Team', id: teamId } }, [time?: { data: { type: 'PlanTime', id: timeId } }] } } }`
- Optional `timeId` parameter adds `relationships.time` — omitted when not provided
- Throws `Failed to add team to plan: {status} {text}` on non-ok

Added 7 new tests covering all three functions:
- `deleteItem`: URL shape, method, auth header, error path
- `fetchServiceTypeTeams`: URL, response mapping, error path
- `addTeamToPlan`: URL, method, body shape without timeId, body shape with timeId, error path

## Verification

- `npx vitest run src/utils/__tests__/planningCenterApi.test.ts`: 72 tests, all passing
- `npx vitest run` (full suite): 420 tests across 20 files, all passing
- `npx vue-tsc --noEmit`: exits 0, no TypeScript errors
- `src/utils/planningCenterExport.ts`: not modified (confirmed by git diff)

## Deviations from Plan

**1. [Rule 1 - Bug] Updated 3 existing tests for title prefix**
- **Found during:** Task 1 GREEN step
- **Issue:** Three existing `addSlotAsItem` tests asserted bare titles (`'Come Thou Fount'`, `'Amazing Grace #337 (vv. 1, 3, 4)'`, `'Holy Holy Holy'`) that became incorrect after the prefix implementation
- **Fix:** Updated assertions to expect prefixed titles (`'Worship Song - Come Thou Fount'`, etc.)
- **Files modified:** `src/utils/__tests__/planningCenterApi.test.ts`
- **Commit:** 37c3aec (included in Task 1 commit)

## Known Stubs

None — all functions are fully implemented with correct API calls.

## Threat Flags

No new threat surface introduced. All three new functions follow the existing `basicAuthHeader` pattern. No user-provided free-text flows into URL path segments (all IDs originate from prior PC API responses).

## Self-Check: PASSED

- [x] `src/utils/planningCenterApi.ts` exists and contains `Worship Song - ${slot.songTitle`, `Worship Song - ${slot.hymnName`, `export async function deleteItem(`, `export async function fetchServiceTypeTeams(`, `export async function addTeamToPlan(`
- [x] `src/utils/__tests__/planningCenterApi.test.ts` contains `describe('addSlotAsItem - Worship Song prefix'`, `describe('deleteItem'`, `describe('fetchServiceTypeTeams'`, `describe('addTeamToPlan'`
- [x] Commit `37c3aec` exists (Task 1)
- [x] Commit `6b619cc` exists (Task 2)
- [x] Full test suite: 420/420 passing
- [x] TypeScript: clean
