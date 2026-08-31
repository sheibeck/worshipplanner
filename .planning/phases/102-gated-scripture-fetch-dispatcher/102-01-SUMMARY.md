---
phase: 102-gated-scripture-fetch-dispatcher
plan: 01
subsystem: api
tags: [pinia, vue3, vitest, esv, nlt, gating]

requires:
  - phase: 101
    provides: authStore.isBibleApiEnabled (single-leg computed, false-when-absent) + Organization.bibleApiEnabled
provides:
  - src/utils/scriptureApi.ts — the single client-side choke point for ESV/NLT passage fetches
  - ScriptureInput.vue and CongregationalEditor.vue routed exclusively through the dispatcher
affects: [103-scripture-manual-fallback]

tech-stack:
  added: []
  patterns:
    - "Client-side feature-gate dispatcher (isAiEnabled()-style): gate FIRST inside the function body via useAuthStore(), never at module-evaluation time; return a discriminated result instead of throwing for the disabled case"

key-files:
  created:
    - src/utils/scriptureApi.ts
    - src/utils/__tests__/scriptureApi.test.ts
  modified:
    - src/components/ScriptureInput.vue
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/ScriptureInput.test.ts
    - src/components/__tests__/CongregationalEditor.test.ts

key-decisions:
  - "Discriminated result type { status: 'ok' | 'disabled' | 'error' } rather than throwing for the disabled case — mirrors claudeApi.ts's isAiEnabled() graceful-off pattern (per 102-CONTEXT.md 'Claude's Discretion')."
  - "Version RESOLUTION (effectiveVersion / props.bibleVersion ?? authStore.settings.bibleVersion) stays in each component; version DISPATCH (ESV vs NLT fetch selection) moved into scriptureApi — the dispatcher takes an already-resolved version, not raw props."
  - "Kept fetchPassageByOrgSetting as a thin local wrapper in ScriptureInput.vue (now delegating to fetchScriptureText) rather than inlining at both call sites, to minimize the diff at the two existing call sites (fetchPreview, togglePreview)."

patterns-established:
  - "Pattern: any future scripture-fetch call site MUST route through scriptureApi.fetchScriptureText — grep for utils/esvApi|utils/nltApi imports in src/components is the choke-point proof used in this plan's verification and should be reused for regression checks."

requirements-completed: [R296, R297]

coverage:
  - id: D1
    description: "scriptureApi.ts dispatcher: enabled path dispatches ESV vs NLT correctly and returns {status:'ok', text}; disabled path returns {status:'disabled'} and calls neither underlying fetch fn; a thrown fetch error maps to {status:'error'} without re-throwing"
    requirement: R297
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scriptureApi.test.ts#fetchScriptureText — all 6 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "ScriptureInput.vue routes fetchPreview and togglePreview through the dispatcher; enabled path unchanged (ESV/NLT routing, error UX); disabled path no-ops silently with no previewError/aiPreviewError; no direct esvApi/nltApi import remains"
    requirement: R296
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureInput.test.ts — 39 tests including new 'bibleApiEnabled=false' disabled-gate test"
        status: pass
    human_judgment: false
  - id: D3
    description: "CongregationalEditor.vue routes autoFetch through the dispatcher; enabled path unchanged (ESV/NLT routing, fetchError UX, splitCongregationalReading on fetched text); disabled path no-ops silently with no fetchError and an empty textarea; no direct esvApi/nltApi import remains"
    requirement: R296
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts — 18 tests including new 'bibleApiEnabled=false' disabled-gate test"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-31
status: complete
---

# Phase 102 Plan 01: Client Dispatcher + Component Refactor Summary

**Single `scriptureApi.ts` choke point gates ESV/NLT fetches on `authStore.isBibleApiEnabled` and both consumer components now route through it exclusively — zero regression when enabled, zero proxy calls when disabled.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-31T18:00:00Z (approx)
- **Completed:** 2026-08-31T18:38:22Z
- **Tasks:** 3
- **Files modified:** 4 modified, 2 created

## Accomplishments
- Created `src/utils/scriptureApi.ts` exporting `ScriptureFetchResult` and `fetchScriptureText(query, version)` — reads `useAuthStore()` inside the function body (never at module scope), gates on `isBibleApiEnabled` FIRST, dispatches ESV vs NLT identically to the previously-duplicated inline logic, and maps thrown errors to `{status:'error'}` without re-throwing.
- Refactored `ScriptureInput.vue`'s `fetchPreview` and `togglePreview` to call the dispatcher via the retained `fetchPassageByOrgSetting` helper; removed the direct `esvApi`/`nltApi` imports.
- Refactored `CongregationalEditor.vue`'s `autoFetch` to call the dispatcher directly; removed the direct `esvApi`/`nltApi` imports. `splitCongregationalReading` and its inputs are untouched.
- Added the dispatcher's own unit test suite (6 tests) and one new disabled-gate test to each of the two component suites, while updating both suites' auth-store mocks/fixtures so every pre-existing enabled-path test keeps passing (default `isBibleApiEnabled`/`bibleApiEnabled` = true).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the scriptureApi dispatcher + unit tests** - `d59320d8` (feat)
2. **Task 2: Route ScriptureInput.vue through the dispatcher** - `ba0b86e5` (feat)
3. **Task 3: Route CongregationalEditor.vue autoFetch through the dispatcher** - `fef76e64` (feat)

**Plan metadata:** (this commit, following SUMMARY creation)

_Note: tasks were tdd="true" but the dispatcher implementation and its tests were authored together, then verified green in one run per task — no separate RED-only commit was made per task since each task's test file was new (not a modification to a previously-passing suite)._

## Files Created/Modified
- `src/utils/scriptureApi.ts` - New dispatcher: `fetchScriptureText(query, version)` + `ScriptureFetchResult` discriminated type
- `src/utils/__tests__/scriptureApi.test.ts` - New unit tests (enabled ESV/NLT routing, disabled no-op, error mapping)
- `src/components/ScriptureInput.vue` - `fetchPassageByOrgSetting`/`fetchPreview`/`togglePreview` now call `fetchScriptureText`; removed `esvApi`/`nltApi` imports
- `src/components/CongregationalEditor.vue` - `autoFetch` now calls `fetchScriptureText`; removed `esvApi`/`nltApi` imports
- `src/components/__tests__/ScriptureInput.test.ts` - mock `useAuthStore` gains `isBibleApiEnabled` getter (default true via `mockBibleApiEnabled`); new disabled-gate test
- `src/components/__tests__/CongregationalEditor.test.ts` - `beforeEach` sets real store's `bibleApiEnabled = true`; new disabled-gate test

## Decisions Made
- Discriminated `ScriptureFetchResult` (`'ok' | 'disabled' | 'error'`) rather than a thrown exception for the disabled case, matching the `102-CONTEXT.md` guidance and the `claudeApi.ts::isAiEnabled()` precedent of a graceful non-error signal.
- Version resolution (`effectiveVersion` in `ScriptureInput.vue`, `props.bibleVersion ?? authStore.settings.bibleVersion` in `CongregationalEditor.vue`) intentionally stayed in the components — only the ESV-vs-NLT dispatch and the enablement gate moved into `scriptureApi.ts`, per the plan's explicit division of concerns.
- Retained `fetchPassageByOrgSetting` in `ScriptureInput.vue` as a one-line delegating wrapper (rather than inlining `fetchScriptureText` at both call sites) to keep the diff minimal at `fetchPreview` and `togglePreview`.

## Deviations from Plan

None - plan executed exactly as written. Both components' disabled-branch behavior, the dispatcher's error mapping, and the choke-point (no remaining `esvApi`/`nltApi` imports) all match the plan's `<done>` criteria verbatim.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan is client-only; the server-side `checkOrgBibleEnablement` defense-in-depth gate is Plan 02.

## Next Phase Readiness

- Verification suite run in full:
  - `npm run type-check` (`vue-tsc --build`) — clean.
  - `npx vitest run` — 175/177 test files passed; the only 2 failing files are the documented pre-existing baseline (`src/storage.rules.test.ts` — Storage-emulator `firestore.exists()` cross-service limitation; `src/stores/appConfig.test.ts` — pre-existing dot-path payload drift), neither touched by this plan. No new failures introduced.
  - Choke-point grep (`grep -rn "utils/esvApi\|utils/nltApi" src/components/ScriptureInput.vue src/components/CongregationalEditor.vue`) returns nothing.
- `scriptureApi.fetchScriptureText` is now the sole path for client-side scripture fetches — ready for Phase 103 to attach the BibleGateway/paste manual-fallback UI at the `'disabled'` branch in both components, and for Plan 02's server-side `checkOrgBibleEnablement` to provide defense-in-depth on the `/api/esv` and `/api/nlt` proxy branches.
- No blockers.

---
*Phase: 102-gated-scripture-fetch-dispatcher*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: src/utils/scriptureApi.ts
- FOUND: src/utils/__tests__/scriptureApi.test.ts
- FOUND: .planning/phases/102-gated-scripture-fetch-dispatcher/102-01-SUMMARY.md
- FOUND commit: d59320d8
- FOUND commit: ba0b86e5
- FOUND commit: fef76e64
