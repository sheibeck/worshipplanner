---
phase: 14-in-app-quarterly-availability-editor
plan: 04
subsystem: frontend
tags: [vue, planning-center, roster-import, selective-import, human-verified]

# Dependency graph
requires:
  - phase: 14-in-app-quarterly-availability-editor
    provides: "Plan 14-02's fetchPeopleForTeamPositions scoped PC fetch"
provides:
  - "Selective PC roster import (service type → worship team → positions + Role mapping → preview) replacing whole-directory fetchAndMapPeople in RosterImportModal.vue"
affects: [roster people collection, PC import UX]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-step selection state machine in the import modal; per-position Role mapping; scoped team/position person fetch]

key-files:
  created: []
  modified:
    - src/components/RosterImportModal.vue
    - src/utils/planningCenterApi.ts
    - src/stores/roster.ts

key-decisions:
  - "Import is scoped by team AND checked individually-scheduled positions; choir/orchestra excluded by being left unchecked (no auto-detection) — D-08/D-09."
  - "Each checked position maps to a WorshipPlanner Role; a person serving two selected positions receives both mapped Role ids — D-10."
  - "Whole-directory fetchAndMapPeople call removed from the modal (replaced, not supplemented) — D-11."
  - "Re-import unions roles instead of replacing, so importing one team never strips a volunteer's other in-app roles (fix from human-verify)."
  - "Scoped import now brings each person's email over via the /people/{id}/emails endpoint, matching the old whole-directory import (fix from human-verify)."

patterns-established:
  - "selectServiceType → selectTeam → selectPositions → fetching → preview → importing step machine with resetToIdle() clearing all selection refs on every open (T-14-04-01 mitigation)."

requirements-completed: [D-08, D-09, D-10, D-11]

# Metrics
completed: 2026-07-08
---

# Phase 14 Plan 04: Selective Planning Center Import Summary

**Replaced `RosterImportModal.vue`'s whole-church import with a scoped service-type → worship-team → positions (+ per-position Role mapping) flow that imports only the people currently serving the checked positions, excluding choir/orchestra by omission.**

## Accomplishments
- Extended the modal `Step` state machine with `selectServiceType | selectTeam | selectPositions` and wired `fetchServiceTypes`/`fetchServiceTypeTeams`/`fetchTeamPositions` handlers mirroring the existing try/catch/step shape
- On `selectPositions`, each checked position renders a Role `<select>` (alphabetical); confirm calls `fetchPeopleForTeamPositions` per checked position and unions Role ids per person
- Reuses the existing `classifyPeople`/preview/`onConfirmImport`/`upsertPeople` path unchanged from `preview` onward
- Removed the `fetchAndMapPeople` import and call (D-11)
- `resetToIdle()` clears every new selection ref on modal open (stale-selection leak mitigation)

## Task Commits
1. **Task 1 (auto): selective import flow** — `b1a90a6` feat(14-04)

## Human Verification (Task 2 — checkpoint:human-verify, blocking)
Verified against a live Planning Center org. Three issues found during verification, each fixed and committed:
- **Roles stripped on re-import** → `a68ca0c` — `upsertPeople` now unions incoming roles with existing (+ regression test)
- **Silent empty Role dropdown** → `a68ca0c` — modal shows "No roles available — configure roles on the Roster screen first" when roles aren't loaded
- **Email not imported** → `a0f4d3e` — `fetchPeopleForTeamPositions` now resolves each person's email (batched `/people/{id}/emails`) and the modal maps it through (+ updated tests)

User approved after the fixes: scoped import imports only the correct assignees with mapped roles and email; choir/orchestra excluded.

## Files Created/Modified
- `src/components/RosterImportModal.vue` — multi-step selective import replacing whole-directory fetch; empty-roles guard; email mapping
- `src/utils/planningCenterApi.ts` — `fetchPeopleForTeamPositions` extended to return email
- `src/stores/roster.ts` — `upsertPeople` unions roles on update

## Deviations from Plan
Plan originally left `email: ''` on the selective path (deferred to manual entry); human-verify feedback reversed this — email is now imported to match prior behavior.

## Verification
- `npm run type-check` green; `planningCenterApi.test.ts` (97) green; full suite green (known ServiceEditorView print test is a pre-existing load flake, passes in isolation)
- Human-verify: PASSED (user approved 2026-07-08)

---
*Phase: 14-in-app-quarterly-availability-editor*
*Completed: 2026-07-08*

## Self-Check: PASSED
- FOUND: src/components/RosterImportModal.vue
- FOUND commit: b1a90a6 (feat selective import)
- FOUND commit: a68ca0c (fix roles-merge + empty dropdown)
- FOUND commit: a0f4d3e (fix email import)
