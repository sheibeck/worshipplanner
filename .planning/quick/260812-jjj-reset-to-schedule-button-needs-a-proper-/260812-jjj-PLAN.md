---
phase: 260812-jjj-reset-to-schedule-button
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
autonomous: true
requirements: [BUGFIX-RESET-OVERRIDE]
must_haves:
  truths:
    - "Clicking 'Reset to schedule' clears the manual override and removes the 'Overridden' pill, even when no generated quarterly schedule exists for the service date (the slot falls back to empty / 'Nobody scheduled')."
    - "The 'Reset to schedule' button shows the standard pointer cursor on hover, like other clickable controls."
  artifacts:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
  key_links:
    - "onResetRoleOverride must optimistically delete localService.value.roleAssignmentOverrides[roleId] before/while calling serviceStore.clearRoleOverride — the R039 isOwnWriteEcho guard swallows the delete's Firestore snapshot echo, so localService is never re-synced from it."
    - "The 'Overridden' pill and the button's own v-if both read assignment.overriddenPersonIds, derived from localService.value.roleAssignmentOverrides — clearing the local key is what makes both disappear."
---

<objective>
Fix two defects in the ServiceEditorView Roles-tab "Reset to schedule" control reported by the owner (quick task 260812-jjj):

1. The button does not show a pointer cursor on hover.
2. Clicking it is a no-op when the role was overridden but has no underlying generated schedule — the override is not cleared and the "Overridden" pill remains.

Purpose: The reset control is the only way to undo a manual role override; today it silently fails and leaves a misleading "Overridden" pill.

Output: A regression test reproducing the no-schedule reset case, plus the two-part fix (handler optimistic local clear + cursor affordance).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# The control, its handler, and the store action being wired
@src/views/ServiceEditorView.vue
@src/stores/services.ts
@src/utils/serviceRoles.ts
@src/views/__tests__/ServiceEditorView.test.ts

# Root cause (verified during planning):
# - ServiceEditorView.vue onResetRoleOverride (~:3807) calls serviceStore.clearRoleOverride
#   but does NO optimistic local update, unlike its sibling onToggleOverridePerson (~:3766),
#   which synchronously mutates localService.value.roleAssignmentOverrides.
# - The store snapshot watcher (~:2348) returns early on the client's own write echo via the
#   R039 isOwnWriteEcho guard (~:2363), so the deleteField() write never re-syncs localService.
#   The stale override key survives locally, so resolvedRoleAssignments still reports
#   overriddenPersonIds !== null -> the "Overridden" pill (~:1310) and button (~:1320) stay.
# - The button (~:1320-1327) is a real <button> but its class lacks cursor-pointer; sibling
#   clickable labels (~:1346) already use cursor-pointer.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add failing regression test for reset-with-no-schedule (RED)</name>
  <files>src/views/__tests__/ServiceEditorView.test.ts</files>
  <behavior>
    - Test A (no-op repro): Mount an editor on a DRAFT service whose date has NO covering quarter
      (`mockQuarters = []`, so `hasQuarterForServiceDate` is false and scheduledPersonIds is empty),
      with `mockServicesList = [{ ...mockService, status: 'draft', roleAssignmentOverrides: { 'role-vox': ['person-1'] } }]`.
      Open the Roles tab. Assert the Vocals role card shows the "Overridden" pill and a "Reset to schedule" button.
      Click "Reset to schedule". Assert: `mockClearRoleOverride` was called with `('service-1', 'role-vox')`;
      after `await wrapper.vm.$nextTick()`, `vm.resolvedRoleAssignments` for role-vox has `overriddenPersonIds === null`
      and the "Overridden" pill is gone from the card (the slot now reads "Nobody scheduled"). This FAILS pre-fix
      because the mocked `clearRoleOverride` never mutates the store and the handler does no optimistic local delete,
      so the pill persists.
    - Test B (cursor affordance): In the same mounted state (with an override present so the button renders),
      assert the "Reset to schedule" button's class attribute contains `cursor-pointer`. This FAILS pre-fix.
  </behavior>
  <action>
    Add the two cases inside the existing `describe('ServiceEditorView - Roles tab (Phase 17-04)', ...)` block
    (near the existing override tests around the current line 1449), reusing that block's `mountView`, `beforeEach`,
    and the shared `mockService`, `mockClearRoleOverride`, `mockQuarters`, `mockAuthState`, `mockServicesList`
    fixtures. Set `mockAuthState.isEditor = true`. Find the role card by role name text (`Vocals`); locate the pill
    by its text `Overridden` and the button via `wrapper.findAll('button').find((b) => b.text() === 'Reset to schedule')`.
    Access `resolvedRoleAssignments` off `wrapper.vm` (already exposed and typed in existing tests). Do NOT restate
    any acceptance-criteria literal that a negative grep targets inside code comments. Follow the row-drawer / existing
    Roles-tab test model exactly (shallowMount, Roles tab opened by clicking the `Roles` tab button).
  </action>
  <verify>
    <automated>npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "Reset to schedule"</automated>
    RED expected: the two new cases FAIL against current source (pill persists; class lacks cursor-pointer). Confirm the
    failure is these assertions, not a mount/import error.
  </verify>
  <done>Two new tests exist in the Roles-tab describe block and fail for the intended reasons (stale pill after reset; missing cursor-pointer), with no unrelated tests broken by their addition.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix onResetRoleOverride optimistic clear + add cursor-pointer (GREEN)</name>
  <files>src/views/ServiceEditorView.vue</files>
  <behavior>
    - After `onResetRoleOverride(roleId)` runs on a draft service, `localService.value.roleAssignmentOverrides`
      no longer contains `roleId`, so `resolvedRoleAssignments` reports `overriddenPersonIds === null` for that role
      and both the "Overridden" pill and the button disappear — regardless of whether a quarterly schedule exists.
    - If `serviceStore.clearRoleOverride` rejects (e.g. ServiceLockedError), the optimistic local delete is rolled back
      so the UI never shows a cleared state that was not persisted.
    - The button shows the pointer cursor on hover.
  </behavior>
  <action>
    Edit `onResetRoleOverride` (currently ~:3807-3811) to mirror the optimistic-update + rollback pattern already used by
    `onToggleOverridePerson` (~:3766-3805): keep the existing `if (!canEditService.value) return` and
    `if (!localService.value) return` guards; capture `previousOverride = localService.value.roleAssignmentOverrides?.[roleId]`;
    synchronously `delete localService.value.roleAssignmentOverrides[roleId]` (guarding for the map being undefined) BEFORE
    awaiting `serviceStore.clearRoleOverride(localService.value.id, roleId)`; wrap the await in try/catch and, on error,
    restore `previousOverride` (re-create the map if needed, skip restore when `previousOverride === undefined`) and
    `console.error` the failure — matching the sibling handler's rollback semantics. Explain WHY in a brief comment: the
    R039 `isOwnWriteEcho` guard in the store-snapshot watcher swallows this client's own `deleteField()` echo, so without a
    local delete `localService` never re-syncs and the override key (and its "Overridden" pill) persists. Do NOT weaken or
    remove the existing lock/editor guards.

    Add `cursor-pointer` to the "Reset to schedule" button's class list (~:1324), matching the sibling clickable
    `cursor-pointer` labels in the same override block (~:1346). Class-string addition only; do not restyle.
  </action>
  <verify>
    <automated>npx vitest run src/views/__tests__/ServiceEditorView.test.ts</automated>
    GREEN: the Task 1 cases now pass and the rest of the ServiceEditorView suite (including the existing locked-service
    no-op test that asserts onResetRoleOverride does NOT call clearRoleOverride on a locked service) stays green.
  </verify>
  <done>Both new tests pass; onResetRoleOverride clears the override optimistically with rollback on failure; the button carries cursor-pointer; existing Roles-tab and locked-service tests remain green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client (Roles tab) -> serviceStore -> Firestore | A role-override mutation crosses from the editor UI to the persisted service document. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-jjj-01 | Tampering | onResetRoleOverride optimistic local delete | low | mitigate | Optimistic delete runs only after the existing `canEditService` guard; the persisted write still goes through `serviceStore.clearRoleOverride`, which throws `ServiceLockedError` on a non-draft service, and the new catch rolls the local delete back — no client-only bypass of the lock. |
| T-jjj-02 | Tampering | npm/pip/cargo installs | low | accept | No package installs in this plan — no new dependency surface. |
</threat_model>

<verification>
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — new reset/cursor tests pass; existing Roles-tab and locked-service tests stay green.
- `npx vitest run` — full app suite (excludes rules.test.ts per vite.config.ts) is green apart from the documented known-failing baseline in CLAUDE.md.
- `npm run type-check` — clean (uses vue-tsc --build, which also typechecks the test file; the narrower `-p tsconfig.app.json` form is not sufficient evidence).
</verification>

<success_criteria>
- Starting from no generated schedule, overriding a role then clicking "Reset to schedule" clears the override: the "Overridden" pill disappears and the slot returns to empty ("Nobody scheduled").
- The "Reset to schedule" button shows a pointer cursor on hover.
- The regression test reproducing the no-schedule reset case is committed and green.
- No existing tests regress; type-check is clean.
</success_criteria>

<output>
Create `.planning/quick/260812-jjj-reset-to-schedule-button-needs-a-proper-/260812-jjj-SUMMARY.md` when done
</output>
