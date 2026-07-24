---
phase: 07-invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control
plan: 01
subsystem: auth
tags: [firebase, firestore-rules, pinia, vue-router, rbac, onSnapshot]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Auth store, Firestore rules baseline, router guard pattern
provides:
  - Auth store exports orgId, orgName, userRole, isEditor, waitForRole reactively
  - Firestore rules enforce editor/viewer RBAC at data layer
  - Router guard redirects viewers from /dashboard, /songs, /team to /services
  - inviteLookup collection rules for invite-matching on sign-in
  - invites subcollection rules for pending invite management
affects:
  - 07-02 (Team UI — reads authStore.orgId, authStore.isEditor, authStore.waitForRole)
  - 07-03 (Sidebar gating — reads isEditor to hide nav links)
  - 07-04 (View gating — reads isEditor to hide edit controls in services views)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - onSnapshot subscription for live role updates in Pinia store
    - waitForRole() Promise pattern for async guard synchronization
    - Lazy migration pattern — admin-to-editor role upgrade on first sign-in snapshot
    - Invite-matching via inviteLookup top-level collection keyed by normalized email
    - requiresEditor route meta with dynamic import of auth store in beforeEach

key-files:
  created:
    - src/views/TeamView.vue
  modified:
    - src/stores/auth.ts
    - src/router/index.ts
    - firestore.rules
    - src/rules.test.ts
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "orgId/userRole/isEditor/orgName all live in auth store via loadOrgContext() — centralized so no view does ad-hoc getDoc reads"
  - "memberUnsub is module-level (not store-level) to survive store reuse; cleaned up on sign-out and logout"
  - "Lazy admin-to-editor migration: onSnapshot detects role=='admin' and calls updateDoc to set 'editor'; next snapshot event sets userRole"
  - "waitForRole() uses Vue watch on userRole ref — resolves immediately if role already loaded or user unauthenticated"
  - "inviteLookup/{normalizedEmail} keyed by lowercase email — enables O(1) lookup without scanning subcollections"
  - "Firestore: services match /services/{docId} before wildcard /{collection}/{docId} — Firestore uses most-specific rule first"
  - "TeamView.vue created as stub — Plan 02 will implement full team management UI"
  - "Router login redirect is role-aware: viewers go to /services, editors go to /dashboard"

patterns-established:
  - "Auth store as single source of truth for orgId/userRole — no view-level ad-hoc Firestore reads"
  - "requiresEditor route meta pattern — checked in beforeEach after requiresAuth"

requirements-completed:
  - AUTH-03
  - AUTH-04

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 7 Plan 01: RBAC Foundation Summary

**Centralized org/role state in auth store with Firestore RBAC rules — editors get full CRUD, viewers get read-only on services with router guards enforcing access at navigation time**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-04T21:41:05Z
- **Completed:** 2026-03-04T21:49:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Auth store now reactively exposes `orgId`, `orgName`, `userRole`, `isEditor`, `waitForRole()` — all views/components can use these without ad-hoc Firestore reads
- Firestore rules rewritten: `isOrgEditor` replaces `isOrgAdmin`, explicit services/songs/invites subcollection rules enforce viewer read restrictions
- Router guard extended with `requiresEditor` meta — viewers redirected to `/services` from `/`, `/songs`, `/team`; login redirect is role-aware
- 9 new emulator test cases cover all editor/viewer RBAC scenarios; all 22 emulator tests pass; all 266 unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich auth store with org context, role state, invite-matching, and admin-to-editor migration** - `b189681` (feat)
2. **Task 2: Rewrite Firestore rules for RBAC, add role-aware router guard, extend emulator tests** - `7e00196` (feat)

**Plan metadata:** _(created next)_

## Files Created/Modified
- `src/stores/auth.ts` - Added orgId, orgName, userRole, isEditor, waitForRole, loadOrgContext, invite-matching in ensureUserDocument, admin-to-editor lazy migration
- `src/stores/__tests__/auth.test.ts` - Added onSnapshot, updateDoc, batch.delete to firestore mock
- `firestore.rules` - Replaced isOrgAdmin with isOrgEditor; added explicit services/songs/invites/inviteLookup rules
- `src/router/index.ts` - Added RouteMeta augmentation, requiresEditor checks, role-aware login redirect, /team route
- `src/rules.test.ts` - Updated 'admin' to 'editor' in existing tests, added Editor/Viewer RBAC describe with 9 test cases
- `src/views/TeamView.vue` - Created stub view for /team route (Plan 02 will implement full UI)

## Decisions Made
- `orgId`/`userRole`/`isEditor`/`orgName` all live in auth store via `loadOrgContext()` — centralized so no view does ad-hoc getDoc reads
- `memberUnsub` is module-level (not store-level) to survive store reuse; cleaned up on sign-out and logout
- Lazy admin-to-editor migration: `onSnapshot` detects `role=='admin'` and calls `updateDoc` to set `'editor'`; next snapshot event sets `userRole`
- `waitForRole()` uses Vue `watch` on `userRole` ref — resolves immediately if role already loaded or user unauthenticated
- `inviteLookup/{normalizedEmail}` keyed by lowercase email — enables O(1) lookup without scanning subcollections
- Firestore: services `match /services/{docId}` before wildcard `/{collection}/{docId}` — Firestore uses most-specific rule first
- Router login redirect is role-aware: viewers go to `/services`, editors go to `/dashboard`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created TeamView.vue stub**
- **Found during:** Task 2 (router update)
- **Issue:** Plan adds `/team` route with lazy import of `TeamView.vue` which did not exist — would cause build/runtime error
- **Fix:** Created minimal stub component with "Team management coming soon" placeholder
- **Files modified:** `src/views/TeamView.vue`
- **Verification:** Unit tests pass, router compiles without error
- **Committed in:** `7e00196` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Stub required to avoid import error; Plan 02 will implement the real TeamView.

## Issues Encountered
- Firebase emulator port 8080 was in use from a previous background process; ran vitest directly against the running emulator instead of using `firebase emulators:exec`
- Java not in system PATH — found at `/c/Program Files/Java/jdk-25.0.2/bin/java.exe`; added to PATH for emulator session

## Next Phase Readiness
- Auth store provides `orgId`, `orgName`, `userRole`, `isEditor`, `waitForRole()` — all Plan 02/03/04 components can use these
- Firestore rules block viewers at data layer — UI gating in Plans 03/04 is defense-in-depth
- `/team` route registered and guard-protected; TeamView.vue stub ready for Plan 02 to replace with real team management UI
- `inviteLookup` and `organizations/{orgId}/invites/{email}` collection structure defined — Plan 02 invite creation can use these schemas

---
*Phase: 07-invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control*
*Completed: 2026-03-04*
