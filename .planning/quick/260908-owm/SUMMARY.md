---
quick_id: 260908-owm
slug: sidebar-divider-roles-grid
status: complete
date: 2026-09-08
commit: 0e708bfc
---

# Summary: sidebar divider + grouped, gridded Services Roles tab

**Status: complete ✓** — committed `0e708bfc`; type-check clean; ServiceEditorView
+ AppSidebar suites 380/380.

## What shipped

- **Sidebar divider**: a horizontal divider now separates the volunteer-facing
  **My Schedule** item from **Dashboard** and the editor/admin surfaces below
  (`separatorBefore: true` on the Dashboard item — reuses the existing separator
  mechanism, `AppSidebar.vue`).
- **Services → Roles tab** (`ServiceEditorView.vue`): role cards are no longer one
  full-width column. They render in a **responsive grid** (stack on mobile, 2-up
  at `sm`, 3-up at `lg`), **grouped by role group** with a divider header per group
  (**Band / Tech / Other**, in that order). New `roleAssignmentGroups` computed
  buckets `resolvedRoleAssignments` by each role's `group` (falling back to
  'other'); empty groups drop out. Card internals + every testid
  (`role-override-picker`, `role-confirm-chip-*`, `roles-no-schedule-note`)
  unchanged, so the existing Roles-tab tests pass as-is.

## Non-goals

- No change to role-assignment logic, the confirmation chips, or reset-to-schedule.
