---
slug: teams-export-422-needed-positions
status: resolved
trigger: When exporting a service plan to Planning Center (PC), teams that the user selected are not being added to the created service.
created: 2026-04-16
updated: 2026-04-16
---

## Symptoms

- **Expected:** When user selects teams during export to Planning Center, those teams should be added to the created PC service
- **Actual:** Service is created in PC successfully, but teams are NOT added
- **Error messages:**
  - Console: `POST http://localhost:5173/api/planningcenter/services/v2/service_types/1067240/plans/88491260/needed_positions 422 (Unprocessable Content)`
  - Stack: `planningCenterApi.ts:542 → onConfirmExport @ ServiceEditorView.vue:1842`
  - Multiple 422 errors are shown (one per team position attempted)
- **Timeline:** First time testing teams export — never worked
- **Reproduction:** Select one or more teams in the export dialog, confirm export, service is created but teams are missing

## Domain Context

- Planning Center (PC) uses templates to assign teams to services
- Two ways teams can be added in PC:
  1. Create service from a template (teams come with it)
  2. On existing service → Add → Import template → choose teams
- The app is hitting `needed_positions` endpoint on the newly created plan, getting 422s

## Current Focus

hypothesis: "The needed_positions endpoint requires a time relationship (PlanTime ID) in addition to quantity and team. The current call omits the time_id, causing PC to return 422 Unprocessable Content."
test: "Confirmed: RESEARCH.md Pitfall 1 explicitly predicted: '422 response on POST with only team relationship (missing required time_id)'"
expecting: "Adding a fetchPlanTimes function and passing the service time's ID to addTeamToPlan will resolve the 422s"
next_action: "complete"
reasoning_checkpoint: "Fix applied and verified: 426 tests pass, vue-tsc clean."

## Evidence

- timestamp: 2026-04-16T00:00:00Z
  file: src/utils/planningCenterApi.ts
  lines: 528-563
  observation: "addTeamToPlan posts to needed_positions with only {quantity: 1, relationships: {team: {...}}}. The timeId parameter exists but is only included when explicitly passed. Caller never passes it."

- timestamp: 2026-04-16T00:00:00Z
  file: src/views/ServiceEditorView.vue
  lines: 1839-1846
  observation: "Team-add loop calls addTeamToPlan(appId, secret, serviceTypeId, planId, teamId) — no timeId argument. All createPlanTime calls at lines 1748-1766 use .catch(() => {}) and discard their return IDs."

- timestamp: 2026-04-16T00:00:00Z
  file: .planning/phases/10-worship-song-export-naming-template-import-improvements-auto/10-RESEARCH.md
  lines: 346-358
  observation: "Pitfall 1 explicitly states: 'Warning signs: 422 response on POST with only team relationship (missing required time_id)'. The resolved Open Questions section says 'If needed_positions requires time_id, fetch the plan's first plan_time and use its ID.'"

## Eliminated

- Wrong endpoint path: the URL structure is correct per research
- Auth/credential issue: other API calls (createPlan, addSlotAsItem) succeed
- JSONAPI body format: the outer structure is valid JSONAPI; the issue is missing required relationship

## Resolution

root_cause: "POST to needed_positions requires a time relationship (PlanTime ID) which is not included. PC returns 422 when time_id is absent."
fix: "Added fetchPlanTimes() to planningCenterApi.ts (GET /plan_times?order=starts_at). In onConfirmExport, fetch plan times before the team-add loop and pass the first service-type plan_time ID to addTeamToPlan. Falls back gracefully (undefined timeId) if plan_times fetch fails."
verification: "npx vue-tsc --noEmit: exit 0. npx vitest run: 426 passed (20 test files), exit 0."
files_changed: "src/utils/planningCenterApi.ts, src/views/ServiceEditorView.vue, src/utils/__tests__/planningCenterApi.test.ts"
