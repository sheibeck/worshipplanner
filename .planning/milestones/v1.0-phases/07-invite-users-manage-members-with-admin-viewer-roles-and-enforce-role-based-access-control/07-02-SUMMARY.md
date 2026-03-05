---
phase: 07-invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control
plan: 02
subsystem: team-management-ui
tags: [vue3, firestore, pinia, rbac, invite-flow, role-conditional-ui]

# Dependency graph
requires:
  - phase: 07-01
    provides: Auth store with orgId/orgName/userRole/isEditor, router guard pattern, Firestore RBAC rules
provides:
  - TeamView full team management page (invite, member table, role management)
  - Role-conditional sidebar (Dashboard/Songs/Team editor-only, Services for all)
  - Viewer-gated service views (all edit/mutation controls hidden for viewers)
  - Centralized orgId access across all views (zero ad-hoc user doc reads)
  - GettingStarted invite step wired to /team
affects:
  - All views that use authStore.orgId for Firestore subscriptions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - writeBatch for atomic invite + inviteLookup doc creation
    - v-if authStore.isEditor pattern for editor-only UI elements
    - v-if/v-else pattern for editor-editable vs viewer read-only display
    - computed navItems for reactive role-conditional sidebar

key-files:
  created:
    - src/views/__tests__/TeamView.test.ts
  modified:
    - src/views/TeamView.vue
    - src/components/AppSidebar.vue
    - src/views/ServicesView.vue
    - src/views/ServiceEditorView.vue
    - src/components/GettingStarted.vue
    - src/views/DashboardView.vue
    - src/views/SongsView.vue

key-decisions:
  - "TeamView test stubs use extracted pure helper functions (normalizeEmail, isDuplicateMember, canRemoveMember) for testable unit coverage without Firestore mocking"
  - "navItems changed from static array to computed() to reactively filter on authStore.isEditor"
  - "ServiceEditorView autosave watcher returns early if !authStore.isEditor — viewers cannot trigger autosave"
  - "Viewer sermon passage rendered as formatted text using template literal rather than importing a formatter"
  - "All 4 views (Dashboard, Songs, Services, ServiceEditor) now use authStore.orgId — zero ad-hoc getDoc(users/{uid}) calls remain"

patterns-established:
  - "v-if authStore.isEditor pattern: wrap editor-only controls directly in template, no wrapper components needed"
  - "v-if/v-else editor/viewer display: editor gets interactive element, viewer gets plain text"

requirements-completed:
  - AUTH-03
  - AUTH-04

# Metrics
duration: 11min
completed: 2026-03-04
---

# Phase 7 Plan 02: Team Management UI Summary

**Team management page with invite form, member table, role management guards, role-conditional sidebar, viewer-gated service views, and centralized orgId access replacing all ad-hoc user doc reads**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-04T21:52:51Z
- **Completed:** 2026-03-04T22:03:36Z
- **Tasks:** 3 (Task 0, Task 1, Task 2)
- **Files modified:** 8

## Accomplishments

- TeamView fully implemented: invite form with writeBatch atomic creation, member table with active + pending invite rows, role toggle, remove with inline confirm, last-editor guard, duplicate-email guard
- Test file with 8 passing unit tests covering all validation logic as extracted pure functions
- AppSidebar: org name display added, navItems computed for role-conditional filtering (Dashboard/Songs/Team editor-only, Services for all), Tasks replaced with Team
- ServicesView: New Service button, Song Rotation tab, Scripture Rotation tab, NewServiceDialog all gated with v-if authStore.isEditor
- ServiceEditorView: 20 isEditor guards applied — status toggle, autosave, undo, delete, suggest all, save, teams checkboxes, sermon inputs, song picker, AI drafts, scripture input, prayer/message link fields, drag handle, remove slot, add element button; print/share/copy remain for all roles
- GettingStarted "Share with your team" step wired to /team
- DashboardView wraps GettingStarted with v-if="authStore.isEditor"
- All 4 views (Dashboard, Songs, Services, ServiceEditor) replaced ad-hoc getDoc(users/{uid}) with authStore.orgId

## Task Commits

Each task was committed atomically:

1. **Task 0: Wave 0 TeamView test stubs** - `c9fb214` (test)
2. **Task 1: TeamView implementation** - `7efb55e` (feat)
3. **Task 2: Role-conditional UI + orgId centralization** - `67b33d1` (feat)

## Files Created/Modified

- `src/views/__tests__/TeamView.test.ts` — 8 unit tests for invite validation, last-editor guard, duplicate detection
- `src/views/TeamView.vue` — Full team management view with invite form, member table, subscriptions, guards
- `src/components/AppSidebar.vue` — Org name display, computed navItems with isEditor filtering, Team link replaces Tasks
- `src/views/ServicesView.vue` — isEditor gates on New Service button, rotation tabs, NewServiceDialog; authStore.orgId replaces getDoc
- `src/views/ServiceEditorView.vue` — 20 isEditor gates on all edit controls; autosave viewer guard; authStore.orgId replaces getDoc
- `src/components/GettingStarted.vue` — Share step wired to '/team'
- `src/views/DashboardView.vue` — GettingStarted wrapped with v-if isEditor; authStore.orgId replaces getDoc
- `src/views/SongsView.vue` — authStore.orgId replaces getDoc

## Decisions Made

- TeamView test stubs use extracted pure helper functions for testable unit coverage without Firestore mocking
- navItems changed from static array to `computed()` to reactively filter on authStore.isEditor
- ServiceEditorView autosave watcher returns early for viewers — no accidental saves
- All 4 views now use authStore.orgId — zero ad-hoc getDoc(users/{uid}) calls remain in application
- Viewer sermon passage displayed as formatted template literal string rather than importing a dedicated formatter

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

Verified files exist and commits are present (see below).

---
*Phase: 07-invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control*
*Completed: 2026-03-04*
