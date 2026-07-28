---
phase: 08-planning-center-api-export-for-published-service-plans
plan: "01"
subsystem: planning-center-api
tags: [api-client, tdd, planning-center, service-type, vite-proxy]
dependency_graph:
  requires: []
  provides: [planningCenterApi, PC_BASE_URL, validatePcCredentials, fetchServiceTypes, createPlan, createItem, addSlotAsItem, buildPlanTitle, pcExportedAt, pcPlanId, vite-pc-proxy]
  affects: [src/utils/planningCenterApi.ts, src/types/service.ts, vite.config.ts]
tech_stack:
  added: []
  patterns: [json-api, basic-auth, vite-proxy, tdd]
key_files:
  created:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts
  modified:
    - src/types/service.ts
    - vite.config.ts
decisions:
  - SONG slots with null songId are silently skipped in addSlotAsItem (no PC item created for empty slots)
  - pcExportedAt and pcPlanId added as optional fields to preserve backward compatibility with existing services
metrics:
  duration: 5 minutes
  completed_date: "2026-03-05"
  tasks_completed: 2
  files_modified: 4
---

# Phase 08 Plan 01: PC API Client with Tests, Service Type Extension, and Vite Proxy Summary

**One-liner:** Planning Center API client with JSON:API requests, Basic auth, slot-to-item mapping, 29 unit tests via mocked fetch, and Service type extended with pcExportedAt/pcPlanId export tracking fields.

## What Was Built

### Task 1: PC API Client (TDD)

Created `src/utils/planningCenterApi.ts` with six exported functions:

- `validatePcCredentials(appId, secret)` — GET `/service_types?per_page=1`, returns `{valid: true}` on 200, `{valid: false, error}` on 401/other/network error
- `fetchServiceTypes(appId, secret)` — GET `/service_types?per_page=100`, returns `{id, name}[]` from JSON:API `data` array
- `createPlan(appId, secret, serviceTypeId, title, dates?)` — POST `/service_types/{id}/plans` with JSON:API body, returns plan ID
- `createItem(appId, secret, serviceTypeId, planId, params)` — POST `/service_types/{id}/plans/{id}/items`, uses `html_details` for description, returns item ID
- `buildPlanTitle(service)` — pure function: sermon passage reference or service name or "Service" fallback, with teams appended in parens
- `addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songs, sermonPassage?)` — maps all 5 SlotKinds (SONG, HYMN, SCRIPTURE, PRAYER, MESSAGE) to PC items

Created `src/utils/__tests__/planningCenterApi.test.ts` with 29 tests across 6 describe blocks covering all exported functions with mocked fetch and mocked esvApi.

### Task 2: Service Type Extension and Vite Proxy

Extended `src/types/service.ts` Service interface with optional export tracking fields:
- `pcExportedAt?: Timestamp | null` — when the plan was exported to PC
- `pcPlanId?: string | null` — the PC plan ID for linking back

Added `/api/planningcenter` proxy to `vite.config.ts` following the identical pattern as the existing Anthropic proxy, routing to `https://api.planningcenteronline.com`.

## Verification

- `npx vitest run --reporter=verbose`: 308 tests pass across 19 test files (zero regressions)
- All 6 functions exported from `planningCenterApi.ts`: confirmed
- `Service` interface has `pcExportedAt` and `pcPlanId`: confirmed
- `vite.config.ts` has `/api/planningcenter` proxy entry: confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed addSlotAsItem not skipping null songId SONG slots**
- **Found during:** Task 1 TDD RED/GREEN phase
- **Issue:** Original implementation called `createItem` for all SONG slots including those with `songId: null`, using title `[Empty Song]`. The plan spec says to skip such slots entirely.
- **Fix:** Added early return `return ''` when `slot.songId` is null, preventing any PC item creation for empty song slots
- **Files modified:** `src/utils/planningCenterApi.ts`
- **Commit:** 143de96

## Self-Check: PASSED

Files exist:
- `src/utils/planningCenterApi.ts` — FOUND
- `src/utils/__tests__/planningCenterApi.test.ts` — FOUND
- `src/types/service.ts` has `pcExportedAt` — FOUND
- `vite.config.ts` has `/api/planningcenter` — FOUND

Commits exist:
- 143de96: feat(08-01): create PC API client with full test coverage (TDD)
- 0ec1d92: feat(08-01): extend Service type with PC export fields and add Vite proxy
