---
phase: 58-messaging-infrastructure-settings-recipient-resolution
plan: 05
subsystem: ui
tags: [vue, pinia, firestore, messaging, service-editor, overrides]

# Dependency graph
requires:
  - phase: 58-01
    provides: "Service.messaging? optional type (lockNotifyEnabled/reminderEnabled/reminderDaysBefore/reminderSentAt) + OrgSettings.messaging org defaults"
provides:
  - "setServiceMessagingDefaults(serviceId, patch) — scoped dot-path store action writing only changed messaging.<key> leaves + updatedAt, Draft-only guarded"
  - "Per-service 'Messaging defaults' panel on the Service Order tab: three inherit-or-override selects, Draft-editable / locked-read-only"
affects: [61-scheduled-reminders, 62-auto-send, messaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scoped dot-path override write (services/{id}.messaging.<key>) modeled on setRoleOverride — bypasses updateService/the R036 draft-content affectedKeys() guard"
    - "Inherit-or-override <select> idiom (empty option = null = inherit, explicit value = override) reused from the per-slot Bible-version override"
    - "Optimistic localService.messaging mutation with rollback + inline error, mirroring onToggleOverridePerson"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/hymnRetirement.regression.test.ts

key-decisions:
  - "The @change handler writes via the scoped setServiceMessagingDefaults directly, never updateService — the panel's optimistic messaging mutation is excluded from onSave's fixed field allowlist so it cannot leak into a generic autosave write."
  - "Days coerced with Number(...) at the handler; empty option maps to null (inherit). reminderSentAt seeded null in the optimistic patch because it is a required leaf on the Service.messaging shape (client never persists it — Admin-SDK-only)."

patterns-established:
  - "Per-service inherit-or-override panel: canEditService renders editable selects; authStore.isEditor && isLocked and the viewer branch both render a static effective-value summary."

requirements-completed: [R132]

coverage:
  - id: D1
    description: "setServiceMessagingDefaults writes only changed messaging.<key> dot-paths + updatedAt, throws ServiceLockedError off-draft, mirrors locally, and is exported from the store"
    requirement: "R132"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts (setServiceMessagingDefaults describe block)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Service Order tab shows Draft-editable inherit-or-override selects (lock-notify, reminder-enabled, reminder-days) that write via setServiceMessagingDefaults — empty->null, explicit->boolean, days coerced to number; days select gated on reminder resolving on"
    requirement: "R132"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (Messaging defaults panel (58-05, R132))"
        status: pass
    human_judgment: false
  - id: D3
    description: "Locked service and viewer see the read-only effective-value summary and no editable select; a save failure surfaces the inline 'Failed to save. Please try again.' message"
    requirement: "R132"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (locked/viewer read-only + save-failure cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual UAT: on a Draft service edit an override, then lock the service and confirm the panel goes read-only"
    verification: []
    human_judgment: true
    rationale: "Requires a human to visually confirm the Draft->locked read-only transition in the running app (deferred to owner per the v1.7 grant)."

# Metrics
duration: 25min
completed: 2026-08-14
status: complete
---

# Phase 58 Plan 05: Per-service Messaging Defaults Summary

**Per-service automatic-email override storage (R132): a scoped `setServiceMessagingDefaults` dot-path store action plus a Draft-editable / locked-read-only "Messaging defaults" panel on the Service Order tab that inherits from org Settings until explicitly overridden.**

## Performance

- **Duration:** ~25 min (Task 2 execution this session; Task 1 completed in a prior session)
- **Completed:** 2026-08-14
- **Tasks:** 2 (Task 1 pre-completed; Task 2 completed this session)
- **Files modified:** 5

## Accomplishments
- `setServiceMessagingDefaults(serviceId, patch)` store action — writes only the changed `messaging.<key>` dot-paths + `updatedAt`, throws `ServiceLockedError` off-draft, mirrors the applied patch into the local `services.value` entry (Task 1, prior session).
- New "Messaging defaults" card on the Service Order tab with three inherit-or-override selects (Lock notification, Service-link reminder, Reminder days-before). The days-before select renders only when the reminder row resolves on (explicit override or inherited org default).
- Each `@change` writes via the scoped `setServiceMessagingDefaults` directly — empty "Default" option → `null` (inherit), explicit On/Off → boolean, days coerced with `Number(...)` → number|null. Optimistic `localService.messaging` mutation with rollback + inline `Failed to save. Please try again.` on failure.
- Locked services (`authStore.isEditor && isLocked`) and viewers get a static effective-value read-only summary, no editable controls.

## Task Commits

1. **Task 1: setServiceMessagingDefaults store action** — `1ee3660` (test) → `b29e7d9` (feat) _[prior session]_
2. **Task 2: Messaging defaults panel** — `a039fd4` (test) → `e4a819f` (feat)

_TDD: test commit precedes feat commit for each task._

## Files Created/Modified
- `src/stores/services.ts` — `setServiceMessagingDefaults` scoped dot-path action (Task 1).
- `src/stores/__tests__/services.test.ts` — store action tests (Task 1).
- `src/views/ServiceEditorView.vue` — Messaging defaults panel (template card + handlers/computeds).
- `src/views/__tests__/ServiceEditorView.test.ts` — 11-case panel describe block; wired `mockSetServiceMessagingDefaults` + `settings.messaging` into the shared auth/service mocks.
- `src/views/__tests__/hymnRetirement.regression.test.ts` — added `settings.messaging` to its local auth mock (deviation; see below).

## Decisions Made
- Kept the pre-written panel's optimistic-mutation approach (mirrors `onToggleOverridePerson`): mutate `localService.messaging` synchronously, fire the scoped store write, roll back on failure. `onSave`'s fixed field allowlist excludes `messaging`, so the optimistic mutation cannot leak into a generic autosave write.
- The `mockUpdateService` "not routed through updateService" assertion clears the spy immediately before the `@change` to isolate the handler from an unrelated mount-time backfill write (Phase 24-06), keeping the assertion meaningful rather than coupling to mount behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `settings.messaging` to hymnRetirement.regression.test.ts auth mock**
- **Found during:** Task 2 (full-suite gate)
- **Issue:** The new panel reads `authStore.settings.messaging.lockNotifyDefault` at render. `hymnRetirement.regression.test.ts` mounts the real ServiceEditorView with its own local auth mock whose `settings` lacked `messaging`, so mounting the editor threw `TypeError: Cannot read properties of undefined (reading 'lockNotifyDefault')` — 3 editor-render tests failed. Directly caused by this task's panel.
- **Fix:** Added a conservative-default `messaging` object (matching `DEFAULT_ORG_SETTINGS`) to that test's `mockAuthState.settings`.
- **Files modified:** `src/views/__tests__/hymnRetirement.regression.test.ts`
- **Verification:** `npx vitest run src/views/__tests__/hymnRetirement.regression.test.ts` → 12/12 pass; full suite back to the 2-file baseline.
- **Committed in:** `a039fd4` (Task 2 test commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to keep the full suite at its known baseline; no scope creep.

## Issues Encountered
- None beyond the deviation above.

## Verification Gate Results
- `npx vitest run src/stores/__tests__/services.test.ts` — green (Task 1, R132 store action).
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — **293/293 pass** (includes the 11 new panel cases).
- `npm run type-check` (`vue-tsc --build`) — **clean** (exercises `Service.messaging?` + `OrgSettings.messaging` across store + component and their tests).
- `npx vitest run` (full app suite) — **3307 pass / 1 fail-file baseline**: only `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` fail (the documented 2-file known-failing baseline). No regressions.

## User Setup Required
None - no external service configuration required.

## Deferred Verification
- Manual UAT (coverage D4): on a Draft service edit an override, then lock the service and confirm the panel goes read-only. Deferred to owner at `/gsd-verify-work 58` per the v1.7 grant.

## Next Phase Readiness
- The override storage the auto-send phases (61 scheduled reminders / 62 auto-send) will consume is now in place; no send path added this plan.
- `reminderSentAt` remains an Admin-SDK-only idempotency leaf (never client-written) — Phase 61 owns it.

---
*Phase: 58-messaging-infrastructure-settings-recipient-resolution*
*Completed: 2026-08-14*
