---
phase: 114-multi-monitor-assignment-rework
plan: 04
subsystem: ui
tags: [window-management, fullscreen-api, output-window, macos-fix, vue]

# Dependency graph
requires:
  - phase: 114-multi-monitor-assignment-rework
    provides: "114-01: computeFingerprints(screens), SCREEN_QUERY_PARAM ('screen'), ScreenLike"
  - phase: 114-multi-monitor-assignment-rework
    provides: "114-03: each output URL already carries ?screen=<fingerprint> for the assigned display"
provides:
  - "attemptScreenTargetedFullscreen(targetFingerprint) in useOutputWindow.ts — popup-side requestFullscreen({screen}) placement (R327)"
  - "useOutputWindow reads the target fingerprint from route.query[SCREEN_QUERY_PARAM] via useRoute, mirroring the existing org-query pattern"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Popup self-placement: the popup re-resolves its OWN live getScreenDetails().screens and matches by computeFingerprints, never trusting coordinates the opener computed at launch (CONTEXT.md decision) — then calls document.documentElement.requestFullscreen({screen}) on the matched ScreenDetailed"
    - "Additive gestureless-fullscreen layering: plain attemptAutoFullscreen (content-setting granted) fires first as before; the new screen-targeted attempt fires as a second, independent fire-and-forget call that fails closed to the plain path + the manual Go-fullscreen button on any absence/denial/mismatch"

key-files:
  created: []
  modified:
    - src/composables/useOutputWindow.ts
    - src/composables/__tests__/useOutputWindow.test.ts

key-decisions:
  - "attemptScreenTargetedFullscreen queries the 'window-management' permission descriptor (mirroring MonitorSetupView.vue's onMounted/onDetectClick idiom, ADR-0216/0214), NOT the 'fullscreen'/allowWithoutGesture descriptor attemptAutoFullscreen uses — the two paths are permission-independent and can each fire, or neither, without interfering with the other's call count."
  - "The whole attempt (permission query + getScreenDetails + requestFullscreen) is wrapped in one try/catch returning false on any throw/rejection, per the threat model's T-114-06 mitigation — placement can never block first paint or surface an error to the congregation."
  - "No source-level adjustment was needed for Task 2 (regression guard): none of the pre-existing granted-path tests set a route.query[SCREEN_QUERY_PARAM], so the new screen-targeted attempt's no-target short-circuit (`if (!targetFingerprint ...) return false`) keeps it from ever firing in those tests — the original call-count assertions (e.g. 'requestFullscreen called exactly once') remained valid unchanged."

patterns-established:
  - "Pattern 3 (114-RESEARCH.md): macOS placement fix via requestFullscreen({screen}) from inside the popup"

requirements-completed: [R327]

coverage:
  - id: D1
    description: "On mount, an output popup holding Window Management permission and carrying a matching target fingerprint re-resolves its own live screens and calls requestFullscreen({screen}) on the matched ScreenDetailed"
    requirement: "R327"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useOutputWindow.test.ts#Screen-Targeted Fullscreen Placement (R327 macOS fix) > requests fullscreen ON the matching screen when window-management is granted and a matching target fingerprint is on the route"
        status: pass
    human_judgment: false
  - id: D2
    description: "The screen-targeted attempt fails closed (no call, resolves false) when permission is not granted, no target fingerprint is present, or getScreenDetails is absent — the existing plain fullscreen path and manual Go-fullscreen button remain the fallback"
    requirement: "R327"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useOutputWindow.test.ts#Screen-Targeted Fullscreen Placement (R327 macOS fix) (permission-denied / no-target / absent-getScreenDetails tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The addition does not regress the existing plain auto-fullscreen, delegation, or re-enter fullscreen behaviors; the full useOutputWindow suite and the app-wide test baseline stay green"
    verification:
      - kind: unit
        ref: "npx vitest run src/composables/__tests__/useOutputWindow.test.ts (26/26 pass); npx vitest run (183/184 files pass, only src/storage.rules.test.ts fails per documented baseline)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real-hardware confirmation that an output popup lands fullscreen on its assigned non-primary display on macOS/Chrome without a fresh in-popup gesture"
    requirement: "R327"
    verification: []
    human_judgment: true
    rationale: "RESEARCH.md Open Question A1 / Assumption A1: the Window Management permission-gesture interaction on real macOS/Chrome hardware cannot be verified in jsdom. Batched into the phase's manual UAT (114-VALIDATION.md) per the plan's own verification section."

# Metrics
duration: 35min
completed: 2026-09-03
status: complete
---

# Phase 114 Plan 04: Output Window Self-Placement Summary

**Popup-side `requestFullscreen({ screen })` in `useOutputWindow.ts` — each output window re-resolves its own live screens, matches the assigned display by fingerprint, and requests fullscreen directly on it, additively layered over the existing plain fullscreen + manual fallback.**

## Performance

- **Duration:** ~35 min (includes a 754s full-suite verification run)
- **Started:** 2026-09-03T09:47:00Z (approx)
- **Completed:** 2026-09-03T10:12:00Z (approx)
- **Tasks:** 2 completed (Task 2 required no source changes — verification only)
- **Files modified:** 2

## Accomplishments
- `attemptScreenTargetedFullscreen(targetFingerprint: string | null): Promise<boolean>` added to `useOutputWindow.ts` — short-circuits false on no target or an absent `getScreenDetails`, queries the `window-management` permission descriptor, calls its own `getScreenDetails()`, matches the live screen whose `computeFingerprints` value equals the target, and calls `document.documentElement.requestFullscreen({ screen: matched })`. The whole body is wrapped so any rejection/throw resolves false rather than propagating.
- `useOutputWindow` now imports `useRoute` and reads `route.query[SCREEN_QUERY_PARAM]` in `onMounted`, invoking the screen-targeted attempt with that fingerprint (or `null`) right after the existing `void attemptAutoFullscreen()` call — fire-and-forget, purely additive.
- `AudienceOutputView.vue` / `ConfidenceOutputView.vue` required zero changes — both already render through this shared composable and inherit the new behavior for free.
- 4 new tests added to `useOutputWindow.test.ts`: granted+matching (asserts `requestFullscreen` called with `{screen: matchedScreen}`), permission-denied (asserts `getScreenDetails` never called), no-target (asserts `getScreenDetails` never called even when permission is granted), and absent-`getScreenDetails` (asserts no throw, no screen-targeted call).
- Task 2 (regression guard) confirmed rather than modified: none of the pre-existing granted-path tests set a route-query target fingerprint, so `attemptScreenTargetedFullscreen`'s no-target short-circuit means it never fires in those tests — all original call-count/no-call assertions for the plain auto-fullscreen, Fullscreen Capability Delegation, and manual re-enter paths remained correct with zero edits.

## Task Commits

Each task was committed atomically:

1. **Task 1: attemptScreenTargetedFullscreen — requestFullscreen({screen}) from inside the popup** - `5759345a` (feat)
2. **Task 2: Fallback + regression guard for the existing fullscreen paths** - no commit (verification only; see Decisions Made)

_Task 2 required no source changes: the full `useOutputWindow.test.ts` suite (26 tests, including the 4 new ones) was re-run and passed with zero edits beyond Task 1's own additions — the pre-existing granted/denied/absent-API tests never set a target fingerprint on the mock route, so the new screen-targeted call path never activates in them and their original assertions (exact call counts, no-call guarantees) already held. This is a genuine "nothing to fix" outcome, not a skipped verification — see the Verification section below for the commands actually run._

## Files Created/Modified
- `src/composables/useOutputWindow.ts` - added `attemptScreenTargetedFullscreen`, imported `useRoute`/`computeFingerprints`/`SCREEN_QUERY_PARAM`/`ScreenLike`, wired the new attempt into `onMounted` after the existing plain `attemptAutoFullscreen`
- `src/composables/__tests__/useOutputWindow.test.ts` - widened `mockRoute.query`'s type to allow a `screen` key, reset it in `beforeEach`, imported `computeFingerprints`/`SCREEN_QUERY_PARAM`/`ScreenLike`, added the "Screen-Targeted Fullscreen Placement (R327 macOS fix)" describe block with 4 tests and a per-descriptor-name `permissions.query` mock helper

## Decisions Made
- Queried the `window-management` permission descriptor (not `fullscreen`/`allowWithoutGesture`) for the screen-targeted path, matching the exact idiom already used in `MonitorSetupView.vue`'s `onMounted`/`onDetectClick` (ADR-0216/0214) — this keeps the two gestureless-fullscreen mechanisms (content-setting auto-fullscreen vs. Window-Management-gated placement) permission-independent, so either, both, or neither can fire without one masking the other's test assertions.
- Wrapped the entire screen-targeted attempt (permission query + `getScreenDetails` + `requestFullscreen`) in a single try/catch resolving `false`, satisfying the threat model's T-114-06 mitigation: placement can never block first paint or throw an uncaught error to the congregation-facing window.
- Left Task 2 as a verification-only step with no commit, since the plan's own no-target short-circuit made every pre-existing assertion already correct — documented per the plan's Task 3-style precedent in 114-03-SUMMARY.md.

## Deviations from Plan

None - plan executed exactly as written. No stub data, no new threat-surface beyond the plan's own threat model (only the two documented trust boundaries — popup↔Window Management API, route query↔popup — were touched).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan only adds a client-side popup-context permission check and Fullscreen API call; no new dependencies, no server-side changes.

## Next Phase Readiness

- R327's automated coverage (permission-gated, fingerprint-matched, additive/fail-closed) is complete and unit-tested.
- Full app test suite verified green at the documented baseline: 183/184 files pass (5006 tests pass, 27 skipped); the sole failure (`src/storage.rules.test.ts`) is the pre-existing Storage-emulator `firestore.exists()` cross-service limitation documented in CLAUDE.md, unrelated to this plan.
- `npm run type-check` (`vue-tsc --build`) clean.
- R327's real-hardware verification (an output popup landing fullscreen on its assigned non-primary display on macOS/Chrome, without a fresh in-popup gesture) remains open — this is RESEARCH.md's Open Question A1 / Assumption A1, explicitly scoped to the batched manual UAT in `114-VALIDATION.md`, not automatable in jsdom.
- This was the final plan in Phase 114 (multi-monitor-assignment-rework). All four plans (fingerprint/data-model rework, MonitorSetupView N-monitor UI, N-window run-mode orchestration, output-window self-placement) are now complete.

---
*Phase: 114-multi-monitor-assignment-rework*
*Completed: 2026-09-03*

## Self-Check: PASSED

All created/modified files confirmed present on disk; commit hash `5759345a` confirmed present in `git log`.
