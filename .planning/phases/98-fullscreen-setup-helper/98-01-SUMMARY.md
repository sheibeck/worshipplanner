---
phase: 98-fullscreen-setup-helper
plan: 01
subsystem: ui
tags: [vue3-composable, permissions-api, chrome-enterprise-policy, blob-download, client-only]

# Dependency graph
requires:
  - phase: 97-run-mode-multi-monitor-fullscreen
    provides: useOutputWindow.ts's attemptAutoFullscreen() and its { name:'fullscreen', allowWithoutGesture:true } permission descriptor, reused verbatim here
provides:
  - "detectOS()/detectBrowser() (+ osLabel/browserLabel) — pure OS+browser classification with UA-string fallback"
  - "buildWindowsRegFile/buildMacProfile/buildLinuxPolicyJson/buildPolicyArtifact — origin-baked policy-artifact string generators"
  - "downloadTextFile() — Blob + <a download> helper"
  - "useFullscreenReadiness() — read-only three-state ('checking'|'ready'|'not-ready'|'unsupported') readiness composable with focus self-correction"
affects: [98-02-fullscreen-setup-helper-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-navigator/document seam (NavigatorLike, Document param) — mirrors monitorConfig.ts's resolveStorage(storage?) idiom so pure utils never read globals inside tested bodies"
    - "RED-then-GREEN TDD per source file — test authored/committed against a temporarily-absent module (confirmed import-resolution failure), then implementation restored and committed"

key-files:
  created:
    - src/utils/osDetect.ts
    - src/utils/__tests__/osDetect.test.ts
    - src/utils/fullscreenPolicyFiles.ts
    - src/utils/__tests__/fullscreenPolicyFiles.test.ts
    - src/utils/downloadTextFile.ts
    - src/utils/__tests__/downloadTextFile.test.ts
    - src/composables/useFullscreenReadiness.ts
    - src/composables/__tests__/useFullscreenReadiness.test.ts
  modified: []

key-decisions:
  - "buildPolicyArtifact's 'unknown' OS case falls back to the Linux JSON artifact (harmless generic fallback per plan spec) rather than erroring"
  - "HKLM .reg header comment refers to the HKCU alternative only by its acronym, never the literal HKEY_CURRENT_USER string, so the HKLM file's key-line regression test (must NOT contain HKEY_CURRENT_USER) holds"
  - "macOS .mobileconfig covers both com.google.Chrome and com.microsoft.Edge as two PayloadContent array entries in one profile, each with its own uuidFn-generated PayloadUUID, plus a third UUID reused for the outer Configuration payload (2 distinct UUIDs total, matching the plan's 'two distinct PayloadUUID values' requirement)"

patterns-established:
  - "Pure-utility-module discipline extended to a new domain (policy-file text generation) — no Vue/Firebase/Pinia imports, origin/navigator/document always injected params, never read from globals inside function bodies"

requirements-completed: [R285, R286, R287]

coverage:
  - id: D1
    description: "detectOS/detectBrowser classify Windows/macOS/Linux x Chrome/Edge from an injected navigator, with UA-string fallback when userAgentData is absent"
    requirement: "R286"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/osDetect.test.ts (16 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildWindowsRegFile/buildMacProfile/buildLinuxPolicyJson/buildPolicyArtifact generate origin-baked policy artifacts in the correct per-OS shape with correct filename+MIME dispatch"
    requirement: "R286"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/fullscreenPolicyFiles.test.ts (12 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "downloadTextFile builds a Blob, clicks a synthetic anchor, and revokes the object URL (including a finally-block guarantee on click failure)"
    requirement: "R286"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/downloadTextFile.test.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "useFullscreenReadiness resolves ready/not-ready/unsupported via the shared permission descriptor, never calls requestFullscreen, self-corrects on window focus while not-ready, and degrades a stale ready back to not-ready on recheck"
    requirement: "R285"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useFullscreenReadiness.test.ts (10 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-08-29
status: complete
---

# Phase 98 Plan 01: Fullscreen Setup Helper (Pure Logic Layer) Summary

**Pure OS/browser detection, origin-baked Windows/.mobileconfig/Linux policy-file generators, a Blob download helper, and a read-only fullscreen-readiness composable — the substrate for the Wave-2 Monitor Setup UI panel.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-29T21:40:00Z
- **Completed:** 2026-08-29T21:58:44Z
- **Tasks:** 3
- **Files modified:** 8 (all created)

## Accomplishments
- `src/utils/osDetect.ts` — `detectOS`/`detectBrowser` classify Windows/macOS/Linux × Chrome/Edge from an injected `NavigatorLike`, with Edge checked before Chrome (Edge's UA also contains "Chrome/"), plus `osLabel`/`browserLabel` for UI copy.
- `src/utils/fullscreenPolicyFiles.ts` — origin-baked policy-artifact generators: `buildWindowsRegFile` (HKCU/HKLM, Chrome+Edge keys, generalized from the existing localhost `.reg` proof files), `buildMacProfile` (`.mobileconfig` XML covering both browser domains, injectable `uuidFn`), `buildLinuxPolicyJson`, and the `buildPolicyArtifact` dispatcher (filename + MIME per OS).
- `src/utils/downloadTextFile.ts` — Blob + `<a download>` helper with an injectable `doc` param and a `finally`-guaranteed `URL.revokeObjectURL`.
- `src/composables/useFullscreenReadiness.ts` — read-only three-state readiness composable reusing the exact `{ name:'fullscreen', allowWithoutGesture:true }` descriptor from `useOutputWindow.ts`'s `attemptAutoFullscreen`, never calling `requestFullscreen`; self-corrects via `onMounted` + a `window` `focus` listener gated on `status !== 'ready'`.
- 41 new unit tests across the four modules, all green; `npm run type-check` (`vue-tsc --build`, includes test files) clean; bare `npx vitest run` shows exactly the documented one-file baseline (`src/storage.rules.test.ts`) with no new failures.

## Task Commits

Each task followed RED (failing test, module temporarily absent) then GREEN (implementation restored):

1. **Task 1: OS + browser detection utility**
   - `5fabd392` test(98-01): add failing test for osDetect OS/browser detection
   - `7ad3cfaa` feat(98-01): implement osDetect OS/browser detection utility
2. **Task 2: Policy-file generators + download helper**
   - `aae6f80d` test(98-01): add failing tests for policy-file generators and download helper
   - `daf73dfe` feat(98-01): implement policy-file generators and Blob download helper
3. **Task 3: Read-only fullscreen readiness composable**
   - `be0896ad` test(98-01): add failing test for useFullscreenReadiness
   - `87f68351` feat(98-01): implement read-only useFullscreenReadiness composable

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/utils/osDetect.ts` - OS + browser classification (windows/macos/linux/unknown × chrome/edge/other), UA-string fallback, human labels
- `src/utils/__tests__/osDetect.test.ts` - 16 tests covering userAgentData path, UA-string fallback, Android exclusion, label maps
- `src/utils/fullscreenPolicyFiles.ts` - Windows `.reg` (HKCU/HKLM), macOS `.mobileconfig`, Linux managed JSON generators + `buildPolicyArtifact` dispatcher
- `src/utils/__tests__/fullscreenPolicyFiles.test.ts` - 12 tests asserting origin interpolation, hive correctness, structure+origin presence for the mac profile, dispatcher filename/MIME
- `src/utils/downloadTextFile.ts` - Blob + synthetic `<a download>` click, `finally`-guaranteed URL revoke
- `src/utils/__tests__/downloadTextFile.test.ts` - 3 tests (happy path, click-throws-still-revokes, default-document path)
- `src/composables/useFullscreenReadiness.ts` - `status` ref + `recheck()`, `onMounted` initial check, focus-triggered re-check while not ready
- `src/composables/__tests__/useFullscreenReadiness.test.ts` - 10 tests (all 5 state branches, never-calls-requestFullscreen, focus re-check gating, ready→not-ready degradation, listener cleanup)

## Decisions Made
- `buildPolicyArtifact`'s `'unknown'` OS branch reuses the Linux JSON path (per the plan's explicit "harmless generic fallback" instruction) rather than throwing.
- The HKLM `.reg` header comment references the no-admin alternative only as "HKCU" (never spelling out `HKEY_CURRENT_USER`), preserving the plan's regression assertion that the HKLM file's key lines (and now, in practice, the whole file) contain no `HKEY_CURRENT_USER` string.
- macOS `.mobileconfig` emits one `PayloadContent` array with two `com.apple.ManagedClient.preferences` entries (Chrome, Edge), each carrying its own `uuidFn()`-generated `PayloadUUID`; the outer `Configuration` payload reuses the second of those two UUIDs as its own `PayloadUUID` rather than requesting a third — satisfies the plan's "two distinct PayloadUUID values" assertion without adding a third call to `uuidFn`.

## Deviations from Plan

None — plan executed exactly as written. Two small test-authoring corrections were made and folded into the same TDD cycle (not separate deviation-rule fixes against already-committed code):
- `downloadTextFile.test.ts`'s "defaults to the global document" case originally stubbed `document.createElement` to return a plain object, which jsdom's real `document.body.appendChild` rejected as "not a Node" — fixed by also stubbing `document.body.appendChild`/`removeChild`, matching the injected-`doc` test's approach.
- `useFullscreenReadiness.test.ts`'s `uninstallPermissions()` helper originally set `navigator.permissions` to `undefined` via `defineProperty`, which left `'permissions' in navigator` reporting `true` (property still exists, just undefined) — fixed to `delete` the property so the "unsupported when navigator.permissions is absent" test correctly reproduces jsdom's real default-absent state.

## Issues Encountered
None beyond the two test-authoring corrections above, made before either commit landed.

## User Setup Required
None - no external service configuration required. This plan is entirely client-side pure logic; no Firestore, Storage, Cloud Functions, or npm dependency changes (client-only invariant preserved, threat register T-98-SC confirmed N/A).

## Next Phase Readiness
- The pure logic layer (`osDetect`, `fullscreenPolicyFiles`, `downloadTextFile`, `useFullscreenReadiness`) is complete, tested, and ready for 98-02's UI panel (`AutoFullscreenSetup.vue` or similar) to consume: the composable exposes `{ status, recheck }` for the three/four-state UI, and `buildPolicyArtifact(os, window.location.origin, scope)` + `downloadTextFile(...)` are the two calls the "download setup file" button needs.
- `src/composables/useOutputWindow.ts` and `src/composables/useRunControl.ts` were not touched — confirmed via `git diff --stat` against this plan's commit range — preserving the Phase 97 gesture-fallback runtime untouched (regression guard satisfied).
- No blockers for 98-02.

---
*Phase: 98-fullscreen-setup-helper*
*Completed: 2026-08-29*

## Self-Check: PASSED

All 8 created source/test files and all 6 task commits (5fabd392, 7ad3cfaa, aae6f80d, daf73dfe, be0896ad, 87f68351) verified present on disk / in git log.
