---
phase: 08-planning-center-api-export-for-published-service-plans
plan: "03"
subsystem: ui, planning-center
tags: [planning-center, export, service-editor, vue, firestore]
dependency_graph:
  requires:
    - phase: 08-01
      provides: createPlan, addSlotAsItem, buildPlanTitle, planningCenterApi.ts
    - phase: 08-02
      provides: authStore.hasPcCredentials, authStore.pcCredentials
  provides:
    - Conditional Export to PC button in ServiceEditorView (planned + credentials)
    - Copy for PC fallback when no credentials or draft status
    - onExportToPC handler with full export flow
    - Success toast (auto-dismiss 3s), error banner (manual dismiss), partial failure message
    - Exported badge in header when service has pcExportedAt
    - pcExportedAt/pcPlanId saved to Firestore after successful export
  affects:
    - Human verification needed — 08-03 Task 2
tech-stack:
  added: []
  patterns:
    - Conditional button rendering (v-if/v-else) based on auth store state and service status
    - Sequential async item creation with individual failure tracking (partial failure pattern)
    - Optimistic local state update after Firestore write (pcExportedAt as Date())
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
key-decisions:
  - "Export to PC button only shown for planned services with credentials — hidden (not disabled) for draft status"
  - "sermonPassage passed to addSlotAsItem so MESSAGE slots include sermon passage reference in PC item description (locked decision)"
  - "Partial failure reports failed items without rolling back — plan is kept even if some items fail"
  - "Local pcExportedAt updated to new Date() immediately after Firestore write for instant UI feedback"
patterns-established:
  - "Sequential export with individual catch blocks: failures array + continue pattern for partial failure tolerance"
  - "Inline toast auto-dismisses after 3s (setTimeout); error banner stays until user dismisses (X button)"
requirements-completed:
  - PC-SC1
  - PC-SC2
  - PC-SC3
  - PC-SC4
  - PC-SC5
duration: 8min
completed: "2026-03-05"
---

# Phase 08 Plan 03: Export Flow Wire-Up in ServiceEditorView Summary

**Conditional Export to PC button in ServiceEditorView replaces Copy for PC for planned services with PC credentials, executing sequential slot-to-item export with partial failure tolerance, inline feedback, and persistent Exported badge.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-05T07:14:00Z
- **Completed:** 2026-03-05T07:22:00Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Conditional button: Export to PC (planned + credentials), Copy for PC (else) — hidden for draft, not disabled
- Full export handler: buildPlanTitle -> createPlan -> addSlotAsItem per slot -> Firestore update
- sermonPassage passed to addSlotAsItem for MESSAGE slot PC item description (per locked decision)
- Partial failure tolerance: individual slot failures tracked and reported without rolling back plan
- Three feedback states: spinner + "Exporting..." during export, green toast (3s auto-dismiss) on success, red banner (manual dismiss) on error
- Exported badge in header (green checkmark) when service has pcExportedAt
- pcExportedAt and pcPlanId saved to Firestore, local state updated immediately for UI sync

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire export flow into ServiceEditorView** - `07ee020` (feat)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` - Added conditional Export/Copy button block, exported badge, success/error feedback UI, onExportToPC handler, new imports and reactive state

## Decisions Made

- Export to PC button hidden (v-if) for draft services or when no credentials — not grayed/disabled, completely absent
- Local pcExportedAt set to `new Date() as any` immediately after Firestore write to trigger UI reactivity without waiting for Firestore listener
- Partial failure message includes item count and names: "Plan created but N item(s) failed: SongTitle, Scripture"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Task 2 (checkpoint:human-verify) requires human to verify the export flow end-to-end with a real Planning Center account
- Steps: Settings -> enter PC credentials -> validate -> select service type -> open planned service -> click Export to PC -> verify plan created in PC with correct items including MESSAGE description

---
*Phase: 08-planning-center-api-export-for-published-service-plans*
*Completed: 2026-03-05*
