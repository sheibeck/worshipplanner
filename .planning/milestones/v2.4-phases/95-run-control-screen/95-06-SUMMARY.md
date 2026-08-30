---
phase: 95-run-control-screen
plan: 06
subsystem: testing
tags: [vitest, vue-test-utils, window-management-api, window.open, requestFullscreen, monitorConfig, run-mode]

# Dependency graph
requires:
  - phase: 95-run-control-screen (95-04)
    provides: RunControlView Go-live output orchestration (openOutputs/openPlaced/openUnplaced/closeOutputs, run-go-live-btn, run-status-placed, run-fallback-banner, run-blocked-banner)
  - phase: 95-run-control-screen (95-02)
    provides: ServiceEditorView Run button (canRunService gate, run-service-btn, onRun /run navigation)
  - phase: 91-config-channel-utilities
    provides: monitorConfig (computeFingerprint, saveMapping, loadMapping, matchMapping)
provides:
  - Behavioral coverage for RunControlView output-window orchestration (R261/R266) driven through the explicit Go-live gesture
  - Behavioral coverage for the ServiceEditorView Run button presence/absence incl. the R275 viewer-can-Run proof
affects: [95-verify, run-mode, monitor-setup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gesture-driven output-orchestration testing: mount settles idle, then a run-go-live-btn click drives window.open — the open is never asserted at mount time"
    - "Fake window handles captured in an array so per-window moveTo/requestFullscreen/close spies are inspectable after the gesture; window.open vi.spyOn'd to return them (or null for the blocked case)"
    - "Real monitorConfig seeded via saveMapping+computeFingerprint so matched-placement exercises the true loadMapping/matchMapping, not a mock"
    - "Shared hoisted useRouter().push spy stabilized in an existing suite's vue-router mock to assert navigation additively"

key-files:
  created:
    - src/views/__tests__/RunControlView.output.test.ts
  modified:
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "RunControlView.test.ts (95-05, authored concurrently) did not exist yet, so the output suite is self-contained: it mocks @/composables/useServiceAssembly directly (fixed serviceId/org + a locked service + one assembled slide) rather than mocking the store chain, and injects a fake channelFactory — no @/firebase or store mocks needed."
  - "Stubbed Element.prototype.scrollIntoView (jsdom omits it) so the rail's active-row auto-scroll watch, triggered by postIndex(0) on mount, does not raise an unhandled rejection."
  - "Registered a RouterLink anchor stub in the mount's global.stubs so the fallback banner's <router-link to='/monitor-setup'> resolves to an <a data-to> the test can assert, instead of an unresolved custom element."
  - "The exit-confirm dialog is teleported to body, so close-on-exit is driven by querying document.body for run-exit-confirm and native-clicking it."

patterns-established:
  - "Pattern: honest-state assertions — blocked (both window.open null) asserts run-blocked-banner AND the absence of run-status-placed/run-fallback-banner, so a regression that claimed success while zero windows opened fails."
  - "Pattern: pre-open assertion proves the open is gesture-driven (no window.open on mount, run-go-live-btn present, no status/banner)."

requirements-completed: [R261, R266, R275]

coverage:
  - id: D1
    description: "RunControlView output orchestration is gesture-driven — pre-open no window.open + run-go-live-btn present; matched click opens both windows (stable names) + requestFullscreen({screen}) per window + run-status-placed"
    requirement: "R261"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#pre-open idle state / matched placement"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every not-matched path (needs-reprompt / no-mapping / unavailable / denied) degrades to un-positioned pop-outs + amber fallback banner + monitor-setup link, no requestFullscreen, no throw; both-null window.open surfaces the honest run-blocked-banner (never a false success); exit closes each opened window"
    requirement: "R266"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#fallback pop-outs / blocked / close on exit"
        status: pass
    human_judgment: false
  - id: D3
    description: "ServiceEditorView Run button: absent on a draft, present on a locked service for an editor AND a viewer (R275 viewer-can-Run), absent for an org-less user, and router.push('/run/service-1?org=org-1') on click"
    requirement: "R275"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Run entry button (R261/R275)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-28
status: complete
---

# Phase 95 Plan 06: RunControlView output-orchestration + ServiceEditorView Run-button tests Summary

**Gesture-driven behavioral coverage for the Go-live output-window orchestration (open/place/fallback/blocked/close via real monitorConfig + faked window.open/getScreenDetails) and the ServiceEditorView Run button incl. the R275 viewer-can-Run proof.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Authored `src/views/__tests__/RunControlView.output.test.ts` (8 tests): a pre-open idle assertion proving the open is gesture-driven (no window.open on mount, run-go-live-btn present, nothing claims opened); matched placement (window.open per role with stable `wp-audience`/`wp-confidence` names + `requestFullscreen({screen})` per window + run-status-placed); four fallback paths (needs-reprompt, no saved mapping, getScreenDetails unavailable, getScreenDetails denied) all opening un-positioned pop-outs + the amber banner + monitor-setup link with no requestFullscreen and no throw; the honest blocked state (window.open null for both → run-blocked-banner, NOT run-status-placed/run-fallback-banner); and close-on-exit tearing down each opened window.
- Added the `Run entry button (R261/R275)` describe block (5 tests) to the existing `ServiceEditorView.test.ts`: draft → absent; locked + editor → present with the run aria-label; locked + VIEWER (isEditor=false, orgId set) → present (the load-bearing R275 non-editor-gating proof); locked + org-less user → absent; click → `router.push('/run/service-1?org=org-1')`.
- Stabilized the file's shared `useRouter().push` into a hoisted spy (additive; no existing test reads push) to assert the /run navigation.

## Task Commits

1. **Task 1: RunControlView.output.test.ts** - `99f5e240` (test)
2. **Task 2: ServiceEditorView Run-button describe block** - `8d08d9a9` (test)

## Files Created/Modified
- `src/views/__tests__/RunControlView.output.test.ts` - New: gesture-driven output-orchestration suite (8 tests), all windows/screens faked.
- `src/views/__tests__/ServiceEditorView.test.ts` - Added the Run-button describe block (5 tests) + stabilized the shared push spy in the vue-router mock.

## Decisions Made
- RunControlView.test.ts (95-05) is authored concurrently and did not exist, so the output suite is self-contained: it mocks `@/composables/useServiceAssembly` directly and injects a fake channelFactory, avoiding all store/firebase mocks.
- Stubbed `Element.prototype.scrollIntoView` (jsdom omits it) so the rail auto-scroll watch fired by `postIndex(0)` on mount does not raise an unhandled rejection.
- Registered a `RouterLink` anchor stub in `global.stubs` so the fallback banner's `<router-link to="/monitor-setup">` renders as an assertable `<a data-to>`.
- Close-on-exit is driven by querying `document.body` for the teleported `run-exit-confirm` and native-clicking it.

## Deviations from Plan

None - plan executed exactly as written. (Two harness accommodations — `scrollIntoView` stub and `RouterLink` global stub — are ordinary jsdom/test-plumbing setup, not behavioral changes; they are documented under Decisions.)

## Issues Encountered
- Initial run of the new output suite hit an unhandled rejection (`scrollIntoView is not a function`) from the rail auto-scroll watch and a failed monitor-setup-link assertion because `<router-link>` was unresolved. Both fixed with test-harness stubs (scrollIntoView + RouterLink); the suite then passed 8/8.

## Gate Results
- `npx vitest run src/views/__tests__/RunControlView.output.test.ts` → 8 passed.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` → 340 passed (was 335; +5).
- `npm run type-check` (vue-tsc --build) → clean.
- `npx vitest run` (bare, full app suite) → only `src/storage.rules.test.ts` failed (the documented Storage-emulator baseline: 166 files passed, 1 failed; its 25 failures are all cross-service `firestore.exists()` env-limited). No regression from the new tests.

## Next Phase Readiness
- With 95-05 (RunControlView core suite) this closes the phase's Nyquist coverage for R261/R266/R275. The real two-monitor placement and a real viewer account reaching the control screen remain the deferred milestone-end HUMAN-UAT items from 95-04 / 95-02.

## Self-Check: PASSED
- FOUND: src/views/__tests__/RunControlView.output.test.ts
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND commit: 99f5e240 (Task 1)
- FOUND commit: 8d08d9a9 (Task 2)

---
*Phase: 95-run-control-screen*
*Completed: 2026-08-28*
