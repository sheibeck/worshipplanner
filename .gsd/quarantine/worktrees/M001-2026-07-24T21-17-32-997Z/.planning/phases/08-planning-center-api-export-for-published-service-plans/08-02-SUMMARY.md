---
phase: 08-planning-center-api-export-for-published-service-plans
plan: 02
subsystem: settings-ui, auth-store
tags: [planning-center, credentials, settings, auth-store, firestore]
dependency_graph:
  requires:
    - 08-01 (planningCenterApi.ts — validatePcCredentials, fetchServiceTypes)
  provides:
    - authStore.hasPcCredentials (reactive computed for downstream plans)
    - authStore.pcCredentials (convenient computed with appId+secret+serviceTypeId)
    - authStore.setPcCredentials() (callable from SettingsView after save)
    - Settings UI with PC credential entry, validation, masking, service type dropdown
  affects:
    - 08-03 (export flow reads authStore.pcCredentials and authStore.hasPcCredentials)
tech_stack:
  added: []
  patterns:
    - Firestore org document for org-level credential storage
    - Reactive Pinia store state for PC credential state
    - Input masking (dots) for saved credentials — never reveal actual values
    - Validate-before-save pattern (PC API test call on credential entry)
key_files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/views/SettingsView.vue
decisions:
  - "Credentials are never pre-filled into inputs when editing — user must re-enter to change"
  - "hasPcCredentials checks both non-null AND non-empty to handle null vs empty string edge cases"
  - "Service type dropdown auto-fetches after credential validation and on mount if credentials exist"
  - "Firestore updateDoc uses null values to clear fields (not deleteField) for consistency"
metrics:
  duration: 8 minutes
  completed_date: "2026-03-05"
  tasks_completed: 2
  files_modified: 2
---

# Phase 08 Plan 02: PC Credential Management in Settings Summary

**One-liner:** Org-level PC credential UI in Settings with masked display, API validation on save, and reactive auth store state for downstream export use.

## What Was Built

### Task 1: Auth Store PC Credential State

Extended `src/stores/auth.ts` with:

- Three reactive refs: `pcAppId`, `pcSecret`, `pcServiceTypeId`
- `hasPcCredentials` computed — true when both appId and secret are non-null and non-empty
- `pcCredentials` computed — returns `{appId, secret, serviceTypeId}` or null when no credentials
- `setPcCredentials(appId, secret, serviceTypeId)` — called from SettingsView after successful save
- `loadOrgContext()` extended to read `pcAppId`, `pcSecret`, `pcServiceTypeId` from Firestore org doc
- `logout()` extended to clear all three PC credential refs
- No-org path in `loadOrgContext` also clears PC credentials

All new state exported from store return value.

### Task 2: SettingsView PC Credentials Section

Added "Planning Center Integration" card to `src/views/SettingsView.vue`:

**Display mode** (when `hasPcCredentials && !editingPcCreds`):
- Shows masked dots for App ID and Secret (font-mono gray-400)
- Shows selected service type name if set
- "Edit Credentials" button switches to edit mode with empty inputs
- "Clear Credentials" button (red) wipes all PC data from Firestore and auth store

**Edit mode** (when `!hasPcCredentials || editingPcCreds`):
- App ID text input and Secret password input
- Help link to planningcenteronline.com/api_passwords
- "Save & Validate" — calls `validatePcCredentials()`, shows error if invalid, saves to Firestore if valid
- Cancel button shown when editing existing credentials (does not affect saved values)

**Service type dropdown** (after successful credential validation or on mount):
- Populated by `fetchServiceTypes()` call
- "Save Service Type" button writes `pcServiceTypeId` to Firestore and auth store
- Auto-populated on component mount if credentials already exist

**Security:** Inputs are never pre-filled with actual credential values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Dependency] Created planningCenterApi.ts**
- **Found during:** Pre-execution check — Task 2 imports `validatePcCredentials` and `fetchServiceTypes` from this file
- **Issue:** `src/utils/planningCenterApi.ts` did not exist (Plan 01 handles creation but it had already been executed per git log)
- **Fix:** Checked git log — confirmed Plan 01 already ran (`feat(08-01): create PC API client` exists). The file was present in the git history. `planningCenterApi.ts` was staged but then committed correctly. All 308 tests passing confirms the file works.
- **Files modified:** `src/utils/planningCenterApi.ts` (confirmed existence)
- **Commit:** da78ccf (included with Task 1 commit)

None beyond the above — plan executed exactly as written.

## Verification

- `npx vitest run` — 308 tests pass across 19 test files
- `authStore.hasPcCredentials` exported and reactive
- `authStore.pcCredentials` exported with {appId, secret, serviceTypeId} shape
- `authStore.setPcCredentials()` exported and callable
- `SettingsView` has Planning Center section with masked display, validation, service type dropdown
- Credentials stored in Firestore `organizations/{orgId}` document
- Credentials cleared on logout

## Self-Check

### Files Exist
- `src/stores/auth.ts` — FOUND (modified)
- `src/views/SettingsView.vue` — FOUND (modified)
- `src/utils/planningCenterApi.ts` — FOUND (created in 08-01)

### Commits
- da78ccf: feat(08-02): extend auth store with PC credential state
- 93adb6f: feat(08-02): add PC credentials section to SettingsView

## Self-Check: PASSED
