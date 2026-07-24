---
slug: pc-teams-not-added-at-all
status: resolved
trigger: Teams are not being added to PC services — neither on new service creation nor on export to an existing service. Two prior fix attempts (needed_positions with time_id, and deduplication guard) did not resolve it.
created: 2026-04-16
updated: 2026-04-16
---

## Symptoms

- **Expected:** When user selects teams in the export dialog and exports to PC, those teams appear on the PC service/plan.
- **Actual:** No teams appear on the PC service — verified on both a new service (delete + recreate) and an existing service (add to existing). Teams selection in the dialog works but nothing shows up in PC.
- **Error messages:** 422 errors on `needed_positions` endpoint. Persisted through both prior fix attempts.
- **Timeline:** Has never worked. Three fix attempts, third one resolved it.
- **Reproduction:** Select any teams in export dialog → export → check PC service → no teams.

## Prior Fix Attempts (Attempts 1 & 2 Failed)

1. **Attempt 1** (teams-export-422-needed-positions session): Added `fetchPlanTimes()` and passed `planServiceTimeId` to `addTeamToPlan`. Hypothesis was that `needed_positions` required a `time` relationship. Teams still didn't appear.

2. **Attempt 2** (existing-plan-scripture-teams-bug session): Added `fetchPlanNeededPositionTeamIds` for deduplication on existing plans. Still no teams appear — even on brand-new service creation.

3. **Attempt 3** (this session): ROOT CAUSE FOUND AND FIXED — see Resolution.

## Domain Context

- Planning Center (PC) uses templates to assign teams to services.
- The `needed_positions` endpoint IS the correct endpoint for adding teams to a plan.
- However, `time_id` in PC's JSONAPI for NeededPosition is a **write-only attribute**, not a relationship.
- Prior code incorrectly sent `time_id` as `relationships.time = { data: { type: 'PlanTime', id } }` — a pattern PC ignores.
- The correct form is `attributes.time_id = planTimeId`.

## Current Focus

hypothesis: "RESOLVED"
test: "RESOLVED"
expecting: "RESOLVED"
next_action: "complete"
reasoning_checkpoint: "Root cause confirmed via PC Dart SDK docs (PcoServicesNeededPosition): time_id is documented as a write-only (wo) attribute. Fix applied, 426 tests pass, vue-tsc clean."

## Evidence

- timestamp: 2026-04-16
  source: browser console during export attempt
  observation: "POST http://localhost:5173/api/planningcenter/services/v2/service_types/1067240/plans/88498303/needed_positions 422 (Unprocessable Content) — planningCenterApi.ts:574, onConfirmExport @ ServiceEditorView.vue:1893. Still 422 after both prior fix attempts."

- timestamp: 2026-04-16
  source: PC Dart SDK docs (pub.dev/documentation/planningcenter_api/latest)
  observation: "PcoServicesNeededPosition documents time_id as (wo) write-only attribute: 'timeId (wo) -> PCO: time_id'. It is NOT a relationship. The relationships section only shows 'team' and read-only 'time' link. Code was sending time_id as relationships.time which PC silently ignores or rejects."

## Eliminated

- Auth/credentials: other API calls (createPlan, addSlotAsItem) succeed fine
- Deduplication: not the issue — teams don't appear even on fresh new-plan creation
- Endpoint URL: `POST /service_types/{stId}/plans/{planId}/needed_positions` is correct
- team relationship format: `{ data: { type: 'Team', id } }` is correct
- Missing time_id entirely: adding time_id (Attempt 1) was the right direction but wrong placement

## Resolution

root_cause: "The PC Services API NeededPosition resource requires time_id as a write-only ATTRIBUTE (attributes.time_id), not a relationship. The code was sending it as relationships.time which PC ignores, causing 422 Unprocessable Content on every needed_positions POST."
fix: "In addTeamToPlan() in planningCenterApi.ts: removed relationships.time block; moved time_id into attributes object (attributes.time_id = timeId). Also updated JSDoc to document the correct API spec. Updated the two affected tests in planningCenterApi.test.ts to assert the new attribute-based structure."
verification: "npx vitest run: 426 passed (20 test files), exit 0. npx vue-tsc --noEmit: exit 0."
files_changed: "src/utils/planningCenterApi.ts, src/utils/__tests__/planningCenterApi.test.ts"
