---
phase: 260812-jjj-reset-to-schedule-button
plan: 01
subsystem: service-editor-roles-tab
tags: [bugfix, optimistic-update, tdd]
dependency-graph:
  requires: []
  provides: [reset-role-override-optimistic-clear]
  affects: [src/views/ServiceEditorView.vue]
tech-stack:
  added: []
  patterns: [optimistic-local-update-with-rollback]
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
decisions:
  - "onResetRoleOverride mirrors onToggleOverridePerson's existing optimistic-delete + rollback-on-failure pattern rather than introducing a new update strategy, so the two role-override handlers stay consistent."
metrics:
  duration: "~35 minutes"
  completed: 2026-08-12
status: complete
---

# Quick Task 260812-jjj: Reset to schedule button needs a proper fix Summary

Fixed `onResetRoleOverride` to optimistically delete the local override key (mirroring the sibling `onToggleOverridePerson` handler) so the "Overridden" pill clears immediately even when no generated quarterly schedule exists to fall back to, and added `cursor-pointer` to the "Reset to schedule" button.

## What Was Built

**Root cause (confirmed during planning, verified during execution):** `onResetRoleOverride` called `serviceStore.clearRoleOverride` but performed no optimistic local update. The store's snapshot watcher swallows the client's own `deleteField()` write echo via the R039 `isOwnWriteEcho` guard, so `localService` was never re-synced after the write. The stale `roleAssignmentOverrides[roleId]` key survived locally, so `resolvedRoleAssignments` kept reporting `overriddenPersonIds !== null` — leaving the "Overridden" pill and the button itself stuck on screen, most visibly (a hard no-op from the user's perspective) when no quarterly schedule existed for the role to fall back to.

**Fix (`src/views/ServiceEditorView.vue`):**
- `onResetRoleOverride(roleId)` now captures `previousOverride`, synchronously deletes `localService.value.roleAssignmentOverrides[roleId]` before awaiting `serviceStore.clearRoleOverride`, and on rejection restores `previousOverride` (only when it was previously defined) and logs the error via `console.error` — the same shape as the existing `onToggleOverridePerson` rollback.
- Existing `canEditService` / `localService` guards are unchanged (not weakened).
- The "Reset to schedule" button's class list gained `cursor-pointer`, matching the sibling clickable checkbox labels in the same override block.

**Tests (`src/views/__tests__/ServiceEditorView.test.ts`, added to the existing `describe('ServiceEditorView - Roles tab (Phase 17-04)', ...)` block):**
- `editor: Reset to schedule clears an override and shows "Nobody scheduled" when no quarter covers the service date (260812-jjj)` — mounts a draft service with `mockQuarters = []` and a `role-vox` override, clicks "Reset to schedule", and asserts `clearRoleOverride('service-1', 'role-vox')` was called, `resolvedRoleAssignments` reports `overriddenPersonIds === null` for `role-vox`, the "Overridden" pill is gone, and the slot reads "Nobody scheduled".
- `editor: Reset to schedule button shows the pointer cursor (260812-jjj)` — asserts the button's class list contains `cursor-pointer`.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the RED/GREEN TDD sequence specified in the plan.

## TDD Gate Compliance

- RED commit: `1bb81e7 test(quick-260812-jjj): add failing regression tests for reset-to-schedule` — both new tests confirmed failing against pre-fix source (`overriddenPersonIds` stayed `['person-1']` instead of `null`; button class list lacked `cursor-pointer`), no mount/import errors.
- GREEN commit: `71229cd fix(quick-260812-jjj): reset-to-schedule clears override optimistically + cursor-pointer` — both new tests pass; full `ServiceEditorView.test.ts` suite (282 tests, including the existing locked-service no-op test asserting `onResetRoleOverride` does NOT call `clearRoleOverride` on a locked service) stays green.

## Verification Results

- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 282/282 passed.
- `npm run type-check` (`vue-tsc --build`) — clean, no errors.
- `npx vitest run` (full app suite) — 3266 passed, 1 failed, 13 skipped, 3 failed suites. All failures match the documented CLAUDE.md baseline exactly, with no new regressions:
  - `src/storage.rules.test.ts` — `ECONNREFUSED 127.0.0.1:9199` (Storage emulator not running locally; documented environment limitation, not a defect introduced here).
  - `render-service/src/render.test.ts` — pre-existing Vitest version-mismatch tooling artifact (unrelated package, root `4.0.18` vs `4.1.10`).
  - `src/views/__tests__/RosterView.test.ts` — pre-existing stale assertion (`'Roles config'` text no longer present), unrelated to this change.

## Self-Check: PASSED

- `src/views/ServiceEditorView.vue` — FOUND, modified as described.
- `src/views/__tests__/ServiceEditorView.test.ts` — FOUND, modified as described.
- Commit `1bb81e7` — FOUND in `git log`.
- Commit `71229cd` — FOUND in `git log`.
