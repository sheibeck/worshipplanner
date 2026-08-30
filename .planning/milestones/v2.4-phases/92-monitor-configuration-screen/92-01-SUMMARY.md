---
phase: 92-monitor-configuration-screen
plan: 01
subsystem: ui
tags: [vue3, window-management-api, localStorage, monitor-config, vue-router]

# Dependency graph
requires:
  - phase: 91-monitor-config-utilities
    provides: "src/utils/monitorConfig.ts — computeFingerprint/saveMapping/loadMapping/matchMapping"
provides:
  - "/monitor-setup route + gated AppSidebar nav entry (any authenticated org member)"
  - "MonitorSetupView.vue — full A/B/B2/B3/C/D state machine for monitor detection + role assignment"
  - "MonitorCard.vue, MonitorFallbackPanel.vue reusable child components"
  - "Save round-trip persistence verification (saveMapping -> loadMapping set-equality)"
affects: [92-02 (behavioral tests for this view), 95-run-flow (will consume matchMapping via this screen's persisted mapping)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Window Management API: getScreenDetails() called synchronously as the FIRST statement of a click handler (after a plain feature-detect guard), no await before it, to preserve user activation for the permission prompt."
    - "Fallback-as-entry-point: denied/unavailable render the same MonitorFallbackPanel component (reason prop swaps only heading/body), never an error toast or dead end."
    - "Save round-trip verification: saveMapping() -> loadMapping() -> assignment-set equality check before showing a truthful 'Saved' vs a non-blocking amber not-persisted warning."
    - "Cross-card exclusive role assignment enforced in the parent view via two fingerprint refs (audienceFingerprint/confidenceFingerprint), not native radio-name grouping."

key-files:
  created:
    - src/views/MonitorSetupView.vue
    - src/components/MonitorCard.vue
    - src/components/MonitorFallbackPanel.vue
  modified:
    - src/router/index.ts
    - src/components/AppSidebar.vue

key-decisions:
  - "Nav entry and route gated on authStore.orgId only (not isEditor), per R275 — any authenticated org member can reach monitor setup, not just editors."
  - "Post-save confirmation stays inline within the same editable-grid view (action row swaps Save button for a green 'Saved for this device' strip) rather than collapsing into the separate B2 summary card, since the grid/selections should remain visibly intact for the 'Change' link."
  - "Added the UI-SPEC's optional 'Set up manually instead' escape-hatch link under the State A hero — sets phase to the denied-equivalent fallback view directly, without waiting for a permission failure."
  - "On a successful save from the B3 (needs-reprompt) branch, grantedView flips to 'fresh' so the amber layout-changed banner clears once the new mapping is confirmed saved."

requirements-completed: [R267, R268, R269]

coverage:
  - id: D1
    description: "Any authenticated org member can navigate to /monitor-setup via a gated 'Monitor Setup' sidebar entry."
    requirement: "R267"
    verification:
      - kind: unit
        ref: "manual code check — route meta requiresAuth only, nav gated on authStore.orgId"
        status: pass
    human_judgment: false
  - id: D2
    description: "Granted-path monitor list with Audience/Confidence role assignment across two distinct monitors; Save disabled until both assigned to different displays."
    requirement: "R267"
    verification: []
    human_judgment: true
    rationale: "Requires a real getScreenDetails() grant with connected hardware or a mocked API — behavioral test authored in plan 92-02."
  - id: D3
    description: "Device-scoped persistence via monitorConfig with save round-trip verification (green 'Saved' only on confirmed persist, amber warning on silent no-op)."
    requirement: "R268"
    verification: []
    human_judgment: true
    rationale: "Round-trip logic is implemented but exercised by behavioral tests in plan 92-02, not yet authored in this plan."
  - id: D4
    description: "Denied/unavailable render the first-class MonitorFallbackPanel, never a dead end or error toast."
    requirement: "R269"
    verification: []
    human_judgment: true
    rationale: "Requires mocking window.getScreenDetails absence/rejection — behavioral test authored in plan 92-02."

# Metrics
duration: ~35min
completed: 2026-08-28
status: complete
---

# Phase 92 Plan 01: Monitor Configuration Screen (Build) Summary

**Standalone `/monitor-setup` screen with the full six-state detect/assign/persist machine, a synchronous-gesture Window Management API call, and a save round-trip check that distinguishes a truthful "Saved" from a private-mode silent no-op.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 5 (2 modified, 3 created)

## Accomplishments
- `/monitor-setup` route registered with `meta: { requiresAuth: true }` only (no `requiresEditor`), and a "Monitor Setup" AppSidebar nav entry gated on `authStore.orgId` — reachable by any authenticated org member per R267/R275.
- `MonitorCard.vue` and `MonitorFallbackPanel.vue` built per the UI-SPEC contracts: card renders label/resolution/Primary badge + an accessible `role="radiogroup"` Audience/Confidence pill pair; the fallback panel is a single reusable component whose `reason` prop swaps only heading/body copy between denied and unavailable, with an identical 3-step instructional list and a retry escape hatch.
- `MonitorSetupView.vue` implements the entire state machine: feature-detection → State D (unavailable) as a first-class entry point; `permissions.query` pre-read (UI hint only) with auto-detect on a returning `'granted'` visit; State A hero with a synchronous `getScreenDetails()` Detect handler (no `await` before the call) plus the UI-SPEC's optional "Set up manually instead" escape hatch; granted branching to State B (fresh)/B2 (matched, condensed summary)/B3 (needs-reprompt, amber banner + forced-blank grid); cross-card exclusive role assignment; Save gated on two distinct monitors with inline same-monitor validation; and a `saveMapping()` → `loadMapping()` round-trip check gating the green "Saved for this device" confirmation vs. a non-blocking amber not-persisted warning.
- `screenschange` listener kept live while mounted, removed in `onUnmounted`.

## Task Commits

1. **Task 1: Register /monitor-setup route and add the gated AppSidebar nav entry** - `9473dd47` (feat)
2. **Task 2: Build MonitorCard.vue and MonitorFallbackPanel.vue child components** - `2b23a18b` (feat)
3. **Task 3: Build MonitorSetupView.vue — state machine, synchronous detection, persistence with save round-trip check** - `bcdbefcd` (feat)

## Files Created/Modified
- `src/router/index.ts` - Added `/monitor-setup` route, `requiresAuth` only.
- `src/components/AppSidebar.vue` - Added "Monitor Setup" nav item gated on `authStore.orgId`.
- `src/views/MonitorSetupView.vue` - New view; owns the full state machine, `getScreenDetails()` handler, persistence + round-trip check.
- `src/components/MonitorCard.vue` - New; one detected-monitor card with the role radiogroup.
- `src/components/MonitorFallbackPanel.vue` - New; shared denied/unavailable manual-setup panel.

## Decisions Made
- Post-save confirmation is rendered inline within the same editable-grid view (action row swaps to a "Saved for this device" strip) rather than transitioning to the separate B2 summary card — keeps the just-saved selections visibly intact for the "Change" link, matching the UI-SPEC's State B description literally.
- Added the plan-checker-flagged "Set up manually instead" escape-hatch link under State A; it sets `phase` directly to `'denied'`, reusing the exact same fallback panel/copy as a genuine permission denial.
- A successful save from the B3 (needs-reprompt) branch flips `grantedView` back to `'fresh'` so the amber "layout changed" banner clears once the new mapping is confirmed saved (not specified verbatim in the UI-SPEC, but necessary — otherwise a stale banner would persist above a just-saved-and-correct mapping).

## Deviations from Plan

None - plan executed exactly as written. The one optional plan-checker suggestion (the State A escape-hatch link) was implemented as instructed.

## Issues Encountered

None. `npm run type-check` (vue-tsc --build) passed clean on the first run; `npx vitest run` reported exactly the documented baseline (`src/storage.rules.test.ts` only — 4090 passed, 26 skipped, 154/158 files passed), confirming no regression from the new code.

## User Setup Required

None - no external service configuration required. Real permission grant/deny, multi-monitor detection, and the drag+fullscreen fallback on real hardware are human-UAT items deferred per `92-CONTEXT.md`.

## Next Phase Readiness

- All build artifacts (`MonitorSetupView.vue`, `MonitorCard.vue`, `MonitorFallbackPanel.vue`, route, nav entry) are in place and type-clean, ready for plan 92-02 to author behavioral tests (mocked `getScreenDetails` granted/denied/unavailable paths, persistence round-trip, matched/needs-reprompt reload, synchronous-call assertion, nav gate).
- Phase 95's Run flow can consume this screen's persisted `monitorConfig` mapping and `matchMapping` seam once built.
- No blockers.

---
*Phase: 92-monitor-configuration-screen*
*Completed: 2026-08-28*

## Self-Check: PASSED

All created files found on disk; all three task commits (`9473dd47`, `2b23a18b`, `bcdbefcd`) found in git log.
