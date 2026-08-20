---
phase: 70-admin-console-ui
plan: 01
subsystem: ui
tags: [vue, pinia, firebase, firestore, admin-console, config]

requires:
  - phase: 69-runtime-config-cloud-functions
    provides: appConfig/global Firestore doc, AppConfig type + DEFAULT_APP_CONFIG + coerce* read layer
  - phase: 68-super-admin-console-shell
    provides: OwnerConsoleView.vue shell, firestore.rules appConfig/* = isSuperAdmin() gate
provides:
  - Client-side AppConfig type + DEFAULT_APP_CONFIG mirror with drift-guard test
  - Pinia appConfig store (onSnapshot raw/resolved split, setDoc-merge saveField)
  - Reusable ConfigNumberField/ConfigTextField admin form components
affects: [70-02-owner-console-config-panels]

tech-stack:
  added: []
  patterns:
    - "AppConfigInput deep-partial type (nested-partial doc/test-fixture shapes, since Partial<T> is shallow)"
    - "raw/resolved onSnapshot split for presence-based (default) badges"
    - "setDoc(...,{merge:true}) never updateDoc for a doc that may not exist"

key-files:
  created:
    - src/config/appConfigDefaults.ts
    - src/config/__tests__/appConfigDefaults.test.ts
    - src/stores/appConfig.ts
    - src/stores/appConfig.test.ts
    - src/components/admin/ConfigNumberField.vue
    - src/components/admin/ConfigTextField.vue
    - src/components/admin/__tests__/ConfigNumberField.test.ts
    - src/components/admin/__tests__/ConfigTextField.test.ts
  modified:
    - functions/src/appConfig.ts

key-decisions:
  - "Introduced AppConfigInput (a deep-partial mapped type over AppConfig) instead of Partial<AppConfig> for mergeAppConfig/isExplicitlySet — Partial<T> only makes top-level keys optional, so a legitimate nested-partial doc/fixture like { cleanup: { mediaEnabled: true } } failed type-check against the shallow form."
  - "(default) badge markup uses the same text-xs text-gray-500 italic style OwnerConsoleView.vue already uses for its roster's (read-only) badge, for visual consistency (no exact class was specified in UI-SPEC for this badge)."
  - "ConfigTextField's parent-owned 'valid' prop combines with its own required/maxLength checks in isSaveDisabled but does not itself render an error message — the parent (Plan 02) owns invalid-format copy (e.g. email-shape errors) via its own logic, keeping this component's contract generic."

patterns-established:
  - "Field triad (isSaving/savedFeedback/saveError) as a component prop contract, not duplicated per-card markup"
  - "Presence-based provenance: check raw pre-merge doc for key existence, never compare resolved value to default"

requirements-completed: [R186, R187]

coverage:
  - id: D1
    description: "Client defaults mirror (appConfigDefaults.ts) resolves an unset/partial doc to DEFAULT_APP_CONFIG per-leaf, with a drift-guard snapshot test and no import from functions/"
    requirement: R186
    verification:
      - kind: unit
        ref: "src/config/__tests__/appConfigDefaults.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "appConfig Pinia store resolves doc-present/doc-missing/error onSnapshot states and saves via setDoc(...,{merge:true}) with dot-path leaf + email + serverTimestamp, never updateDoc"
    requirement: R187
    verification:
      - kind: unit
        ref: "src/stores/appConfig.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "ConfigNumberField enforces min/max/integer/required (incl. upper bound), dirty gate, (default) badge, externalError cross-field hook, and emits 'save' with the numeric value"
    requirement: R187
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/ConfigNumberField.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "ConfigTextField enforces required/maxLength, dirty gate, (default) badge, non-blocking warning, and emits 'save' with the trimmed value"
    requirement: R187
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/ConfigTextField.test.ts"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-20
status: complete
---

# Phase 70 Plan 01: Owner Console client foundation Summary

**Client-side AppConfig mirror + onSnapshot Pinia store with setDoc-merge writes + two reusable validated field components (ConfigNumberField/ConfigTextField), the substrate Plan 02's four config cards compose.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-20T16:05:00-04:00 (approx, first commit)
- **Completed:** 2026-08-20T16:16:44-04:00
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments
- `src/config/appConfigDefaults.ts` mirrors `functions/src/appConfig.ts`'s `AppConfig` type + `DEFAULT_APP_CONFIG` byte-for-byte, with a per-group `mergeAppConfig` and a presence-based `isExplicitlySet` helper, guarded by a hard-coded snapshot test so future drift fails loudly.
- `src/stores/appConfig.ts` (`useAppConfigStore`) exposes `rawDoc`/`resolvedConfig`/`loaded`/`loadError` via an `onSnapshot` subscription on `appConfig/global`, mirroring `auth.ts`'s lifecycle discipline, and a `saveField(path, value)` action that writes via `setDoc(...,{merge:true})` — never `updateDoc` — stamping `updatedBy`/`updatedAt`.
- `ConfigNumberField.vue`/`ConfigTextField.vue` factor the repeated label + `(default)` badge + input + Save-button + status-triad block out of `SettingsView.vue`'s inline pattern, each with their own validation (min/max/integer/required for numbers; required/maxLength for text) plus cross-field (`externalError`) and non-blocking (`warning`) hooks for the parent to drive.

## Task Commits

Each task was committed atomically:

1. **Task 1: Client defaults mirror + per-group merge + presence helper** - `ad0af425` (feat)
2. **Task 2: appConfig Pinia store (onSnapshot + setDoc-merge saveField)** - `f44c8b3f` (feat)
3. **Task 3: Reusable ConfigNumberField + ConfigTextField components** - `af2afcca` (feat)

**Plan metadata:** (this commit) `docs(70-01): complete Owner Console client foundation plan`

## Files Created/Modified
- `src/config/appConfigDefaults.ts` - AppConfig type, DEFAULT_APP_CONFIG, mergeAppConfig, isExplicitlySet, AppConfigInput deep-partial type
- `src/config/__tests__/appConfigDefaults.test.ts` - merge/presence/drift-guard tests
- `src/stores/appConfig.ts` - useAppConfigStore (onSnapshot subscribe/unsubscribe, saveField)
- `src/stores/appConfig.test.ts` - subscribe (present/missing/error) + saveField payload/merge/email-fallback tests
- `src/components/admin/ConfigNumberField.vue` - reusable validated number field
- `src/components/admin/ConfigTextField.vue` - reusable validated text field
- `src/components/admin/__tests__/ConfigNumberField.test.ts` - validation/dirty/badge/externalError coverage
- `src/components/admin/__tests__/ConfigTextField.test.ts` - validation/dirty/badge/warning coverage
- `functions/src/appConfig.ts` - added a forward-pointing comment cross-referencing the new client mirror (no behavior change)

## Decisions Made
- **AppConfigInput deep-partial type**: `Partial<AppConfig>` only makes top-level keys optional, so a legitimate nested-partial value (e.g. a doc that sets only `cleanup.mediaEnabled`, or a test fixture) failed `npm run type-check`. Introduced a small deep-partial mapped type (`AppConfigInput`) used by `mergeAppConfig`, `isExplicitlySet`, and the store's `rawDoc` ref instead.
- **(default) badge styling**: no exact Tailwind classes were specified in 70-UI-SPEC.md for this specific badge, so it reuses the same `text-xs text-gray-500 italic` treatment `OwnerConsoleView.vue` already uses for its roster's `(read-only)` badge, for visual consistency within the same view.
- **ConfigTextField's `valid` prop is a boolean-only hook**: the component disables Save when `valid === false` but does not itself render format-error copy — that stays a Plan 02 concern (e.g. the Sender card owns "Enter a valid email address" for `isValidEmailFormat`), keeping this shared component's contract generic rather than baking in one field's validation message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a type error in mergeAppConfig/isExplicitlySet's parameter type**
- **Found during:** Task 3 (`npm run type-check` gate, run after all three tasks were implemented)
- **Issue:** `mergeAppConfig`/`isExplicitlySet` were typed to accept `Partial<AppConfig> | undefined`. `Partial<T>` only makes TOP-LEVEL keys optional — each nested group (`cleanup`, `retention`, etc.) still required its FULL shape. A legitimate partial doc/test literal like `{ cleanup: { mediaEnabled: true } }` (exactly the R182/R186 partial-doc case this file exists to handle) failed to type-check, breaking `npm run type-check` (which, per this repo's CLAUDE.md, runs `vue-tsc --build` and therefore checks test files too).
- **Fix:** Added `AppConfigInput`, a deep-partial mapped type over `AppConfig`, and changed both functions' signatures — plus the store's `rawDoc` ref type — to use it instead of `Partial<AppConfig>`.
- **Files modified:** `src/config/appConfigDefaults.ts`, `src/stores/appConfig.ts`
- **Verification:** `npm run type-check` clean; all 37 gate tests still pass; full suite still at the 2-file baseline.
- **Committed in:** `af2afcca` (Task 3 commit — discovered while running that task's verification, folded into the same commit since it directly touches Task 1/2 files' type signatures with no behavior change)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for `npm run type-check` to pass per the plan's own verification gate. No scope creep — pure type-signature correction, zero runtime behavior change (confirmed by all pre-existing tests still passing unchanged).

## Issues Encountered
None beyond the type-check fix documented above.

## User Setup Required
None - no external service configuration required. Client-only, no deploys (per the v1.9 deploy discipline grant).

## Next Phase Readiness
- Plan 02 can now compose `useAppConfigStore()` + `ConfigNumberField.vue`/`ConfigTextField.vue` into the four `OwnerConsoleView.vue` config cards (Cleanup, AI Proxy, Messaging, Sender) with no remaining foundational work.
- No blockers. The store's `saveField` write mechanic (`setDoc(...,{merge:true})`, dot-path leaf keys) and the field components' validation/dirty/badge contracts are fully proven by this plan's tests, so Plan 02 is pure composition per this plan's objective.

---
*Phase: 70-admin-console-ui*
*Completed: 2026-08-20*

## Self-Check: PASSED

All 8 created source/test files and the SUMMARY itself were confirmed present on disk; all 3 task commits (`ad0af425`, `f44c8b3f`, `af2afcca`) were confirmed present in git history.
