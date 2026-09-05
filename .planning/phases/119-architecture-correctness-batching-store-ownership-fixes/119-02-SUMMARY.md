---
phase: 119-architecture-correctness-batching-store-ownership-fixes
plan: 02
subsystem: state-management
tags: [pinia, vue, firestore, onSnapshot, store-ownership]

requires:
  - phase: 119-architecture-correctness-batching-store-ownership-fixes plan 01
    provides: R351's shared lyricsQuery pattern (precedent for a store owning a query other callers must share)
provides:
  - authStore.updateOrgSettings(patch) — the ONE mutation for org-settings writes (Firestore write + local mirror-write together)
  - useMembersStore — org-scoped member-count listener, registered in resetOrgScopedStores()
  - useSuperAdminsStore — GLOBAL super-admins roster listener (not org-scoped)
affects: [phase-120-god-module-decomposition, any future org-settings write path, GettingStarted.vue, ConfigurationTab.vue]

tech-stack:
  added: []
  patterns:
    - "Store-owned settings mutation: a single authStore.updateOrgSettings(patch) method does the updateDoc AND the settings.value mirror-write together — no component hand-syncs authStore.settings after its own Firestore write."
    - "Store-owned onSnapshot lifecycle: subscribe(orgId)/unsubscribeAll() (org-scoped) or subscribe()/unsubscribe() (global) as explicit store actions called from a component's watch/onMounted/onUnmounted — never a one-off onSnapshot inline in a component."

key-files:
  created:
    - src/stores/members.ts
    - src/stores/superAdmins.ts
    - src/stores/__tests__/members.test.ts
    - src/stores/__tests__/superAdmins.test.ts
  modified:
    - src/stores/auth.ts
    - src/components/settings/ServiceTemplateEditor.vue
    - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
    - src/stores/orgScopedStores.ts
    - src/components/GettingStarted.vue
    - src/components/__tests__/GettingStarted.test.ts
    - src/components/admin/ConfigurationTab.vue
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "updateOrgSettings walks an arbitrary dot-path (not just a single leaf) so it stays correct for any future multi-segment settings key, even though this plan's only caller (ServiceTemplateEditor) uses a single-level leaf."
  - "members store is org-scoped (registered in resetOrgScopedStores()); superAdmins store is deliberately NOT registered there — it's a global listener, same posture as appConfig.ts."

patterns-established:
  - "A component that needs to hand-sync a store's own state after writing to Firestore is a signal the write belongs in the store as a mutation method instead."

requirements-completed: [R355, R356]

coverage:
  - id: D1
    description: "ServiceTemplateEditor writes org settings through authStore.updateOrgSettings (write + mirror-sync together); no direct updateDoc/db import in the component"
    requirement: R355
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#updateOrgSettings (R355/ARCH-007)"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#ServiceTemplateEditor — Save Template"
        status: pass
    human_judgment: false
  - id: D2
    description: "Member-count listener owned by useMembersStore, registered in resetOrgScopedStores() for org-switch teardown parity; GettingStarted consumes it"
    requirement: R356
    verification:
      - kind: unit
        ref: "src/stores/__tests__/members.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/GettingStarted.test.ts#drives membersStore.subscribe on org change and unsubscribeAll on unmount"
        status: pass
    human_judgment: false
  - id: D3
    description: "Super-admins listener owned by useSuperAdminsStore (global, not org-scoped); ConfigurationTab consumes it, benign logout permission-denied stays suppressed"
    requirement: R356
    verification:
      - kind: unit
        ref: "src/stores/__tests__/superAdmins.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/ConfigurationTab.test.ts#keeps the roster onSnapshot subscription and appConfig subscription untouched"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-04
status: complete
---

# Phase 119 Plan 02: Store-Ownership Fixes (R355/R356) Summary

**Adds authStore.updateOrgSettings (write+sync in one call) and two new owning stores — useMembersStore (org-scoped) and useSuperAdminsStore (global) — replacing three component-local Firestore write/listener sites with store-owned equivalents.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 12 (4 created, 8 modified)

## Accomplishments
- `authStore.updateOrgSettings(patch)` — the single store-owned mutation for org-settings writes (Firestore `updateDoc` + local `settings.value` mirror-write in one call, guarded on `orgId` + `isEditor`). `ServiceTemplateEditor.vue` now calls it instead of importing `doc`/`updateDoc`/`db` directly and hand-syncing the store.
- `useMembersStore` — new org-scoped store owning the members-collection count listener (`subscribe(orgId)`/`unsubscribeAll()`), registered in `resetOrgScopedStores()` for org-switch teardown parity with the other 11 org-scoped stores. `GettingStarted.vue` now drives `subscribe()` on org change and reads `memberCount` instead of opening its own `onSnapshot`.
- `useSuperAdminsStore` — new GLOBAL store (like `appConfig.ts`, deliberately NOT registered in `resetOrgScopedStores()`) owning the super-admins roster listener, suppressing only the benign logout permission-denied exactly as the component did before. `ConfigurationTab.vue` now subscribes/unsubscribes the store in `onMounted`/`onUnmounted` and reads `store.superAdmins`/`store.loaded`.

## Task Commits

Each task was committed atomically:

1. **Task 1: auth-store updateOrgSettings mutation; ServiceTemplateEditor writes through it (R355)** - `96844144` (feat)
2. **Task 2: Member-count listener owned by a store (R356)** - `08cb5ca1` (feat)
3. **Task 3: Super-admins listener owned by a store (R356)** - `04a3b090` (feat)

_No separate TDD RED/GREEN commits — plan frontmatter marks tasks `tdd="true"` but the codebase convention here (mirrored from prior R35x plans) is one commit per task carrying both the store/component change and its tests together, matching this plan's existing sibling commits' shape._

## Files Created/Modified
- `src/stores/auth.ts` - adds `updateOrgSettings(patch)`, exported from the store's return block
- `src/components/settings/ServiceTemplateEditor.vue` - `onSave` calls `authStore.updateOrgSettings`; removed `firebase/firestore`/`@/firebase` imports
- `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` - mocked auth store now exposes `updateOrgSettings` (mirroring the real method's write+sync) instead of mocking `firebase/firestore`'s `updateDoc` directly
- `src/stores/__tests__/auth.test.ts` - new `updateOrgSettings (R355/ARCH-007)` describe block (write+sync, isEditor guard, orgId guard)
- `src/stores/members.ts` - new org-scoped store: `memberCount` ref, `subscribe(orgId)`/`unsubscribeAll()`
- `src/stores/orgScopedStores.ts` - registers `useMembersStore().unsubscribeAll()` in `resetOrgScopedStores()`
- `src/components/GettingStarted.vue` - drives `membersStore.subscribe`/`unsubscribeAll` instead of its own `onSnapshot`
- `src/components/__tests__/GettingStarted.test.ts` - mocks `useMembersStore` (reactive stand-in) instead of `firebase/firestore`
- `src/stores/__tests__/members.test.ts` - new: subscribe/unsubscribeAll, permission-denied suppression, `resetOrgScopedStores` teardown parity
- `src/stores/superAdmins.ts` - new global store: `superAdmins`/`loaded` refs, `subscribe()`/`unsubscribe()`
- `src/components/admin/ConfigurationTab.vue` - drives `superAdminsStore.subscribe`/`unsubscribe` instead of its own `onSnapshot`; imports `SuperAdminEntry` type from the store
- `src/stores/__tests__/superAdmins.test.ts` - new: subscribe/unsubscribe, permission-denied suppression, confirms it is NOT torn down by `resetOrgScopedStores`

## Decisions Made
- `updateOrgSettings` walks an arbitrary dot-path segment-by-segment rather than hardcoding a single-leaf assumption, so it stays correct if a future caller passes a nested key (e.g. `settings.slideTypography.fontFamily`) — this plan's only caller uses a single-level leaf (`settings.defaultServiceTemplate`).
- `useMembersStore` is registered in `resetOrgScopedStores()` (org-scoped); `useSuperAdminsStore` deliberately is NOT (global, matches `appConfig.ts`'s posture) — this asymmetry is intentional per R356/CONTEXT.md, not an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated ServiceTemplateEditor.test.ts's mock harness to match the new call surface**
- **Found during:** Task 1
- **Issue:** The existing test file mocked `firebase/firestore`'s `updateDoc` directly and asserted on its call args. Once the component stopped importing `firebase/firestore` (per the plan's action), those assertions would silently never fire, and the mocked `useAuthStore()` (a plain object) had no `updateOrgSettings` method for the component to call — the save handler would throw.
- **Fix:** Added a `mockUpdateOrgSettings` spy to the mocked auth store that mirrors the real method's write+sync behavior (mirror-writes `settings.defaultServiceTemplate` on success, leaves it untouched on a mocked rejection), and updated every assertion referencing `mockUpdateDoc.mock.calls[0]![1]` to `mockUpdateOrgSettings.mock.calls[0]![0]` (patch is now the sole argument).
- **Files modified:** src/components/settings/__tests__/ServiceTemplateEditor.test.ts
- **Verification:** All 34 tests in the file pass unchanged in intent (payload shape, mirror-write, rejected-save behavior all still asserted).
- **Committed in:** 96844144 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a test-harness update required by the Task 1 rewiring, not a separate behavior change)
**Impact on plan:** Necessary consequence of Task 1's file-scope rewiring (removing `updateDoc`/`db` from the component). No scope creep — `ConfigurationTab.test.ts` needed zero changes since the mocked `firebase/firestore` module underneath the new store has the identical call shape the old component code used.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R355/R356 are the store-ownership half of Phase 119; R349-R354/R357 (batching, correctness) are covered by sibling plans in this phase.
- No blockers for Phase 120 (god-module decomposition) — the new `members.ts`/`superAdmins.ts` stores are small and self-contained, and `auth.ts`'s `updateOrgSettings` addition doesn't touch the file's overall size/shape materially.

---
*Phase: 119-architecture-correctness-batching-store-ownership-fixes*
*Completed: 2026-09-04*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commit hashes (96844144, 08cb5ca1, 04a3b090) confirmed in `git log`.
