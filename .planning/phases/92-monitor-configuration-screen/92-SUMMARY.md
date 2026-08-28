---
phase: 92-monitor-configuration-screen
plan: "01-02"
subsystem: ui
tags: [vue3, window-management-api, localStorage, monitor-config, vue-router, vitest]

# Dependency graph
requires:
  - phase: 91-monitor-config-utilities
    provides: "src/utils/monitorConfig.ts — computeFingerprint/saveMapping/loadMapping/matchMapping"
provides:
  - "/monitor-setup route + gated AppSidebar nav entry (any authenticated org member)"
  - "MonitorSetupView.vue — full A/B/B2/B3/C/D state machine for monitor detection + role assignment"
  - "MonitorCard.vue, MonitorFallbackPanel.vue reusable child components"
  - "Save round-trip persistence verification (saveMapping -> loadMapping set-equality)"
  - "Automated jsdom behavioral coverage for all three permission paths, persistence round-trip,
     matched reload, layout-changed reprompt, same-monitor Save validation, the not-persisted
     warning, the synchronous-call contract, and the orgId nav gate"
affects: [95-run-flow (will consume matchMapping via this screen's persisted mapping)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Window Management API: getScreenDetails() called synchronously as the FIRST statement of a click handler (after a plain feature-detect guard), no await before it, to preserve user activation for the permission prompt — proven by a test that asserts the mock call count is 1 BEFORE awaiting the click's settle promise."
    - "Fallback-as-entry-point: denied/unavailable render the same MonitorFallbackPanel component (reason prop swaps only heading/body), never an error toast or dead end."
    - "Save round-trip verification: saveMapping() -> loadMapping() -> assignment-set equality check before showing a truthful 'Saved' vs a non-blocking amber not-persisted warning — tested by spying on Storage.prototype.setItem to throw, simulating private-mode/disabled storage."
    - "Cross-card exclusive role assignment enforced in the parent view via two fingerprint refs (audienceFingerprint/confidenceFingerprint), not native radio-name grouping — this guard makes audience===confidence unreachable via card clicks, so the same-monitor-validation test reaches that state via a seeded (corrupted) matched mapping's raw pre-fill instead (see Decisions Made)."
    - "Test harness: exercise @/utils/monitorConfig for REAL against jsdom's localStorage (never mocked) since it's pure/framework-free; window.getScreenDetails installed/removed per test via small helpers rather than a vi.mock, since it's a global browser API surface, not a module import."

key-files:
  created:
    - src/views/MonitorSetupView.vue
    - src/components/MonitorCard.vue
    - src/components/MonitorFallbackPanel.vue
    - src/views/__tests__/MonitorSetupView.test.ts
    - src/components/__tests__/AppSidebar.test.ts
  modified:
    - src/router/index.ts
    - src/components/AppSidebar.vue

key-decisions:
  - "Nav entry and route gated on authStore.orgId only (not isEditor), per R275 — any authenticated org member can reach monitor setup, not just editors. Proven by AppSidebar.test.ts (link present with isEditor=false/orgId set, absent with orgId=null, while editor-only Group C neighbors stay absent in the same state)."
  - "Post-save confirmation stays inline within the same editable-grid view (action row swaps Save button for a green 'Saved for this device' strip) rather than collapsing into the separate B2 summary card, since the grid/selections should remain visibly intact for the 'Change' link."
  - "Added the UI-SPEC's optional 'Set up manually instead' escape-hatch link under the State A hero — sets phase to the denied-equivalent fallback view directly, without waiting for a permission failure."
  - "On a successful save from the B3 (needs-reprompt) branch, grantedView flips to 'fresh' so the amber layout-changed banner clears once the new mapping is confirmed saved."
  - "MonitorSetupView.test.ts needs NO @/stores/auth mock at all — the view imports no store; AppShell (which does use the store) is stubbed to a plain passthrough, so its internal auth reads never execute. This diverges from the plan's read_first suggestion to reuse SettingsView.test.ts's auth mock, but is a valid simplification since the view under test has zero auth-store dependency."
  - "The same-monitor-validation test cannot be built via two literal card clicks — onSelectRole's own cross-card exclusivity guard (a 92-01 design decision) clears the opposite role whenever the same fingerprint is reselected, making audienceFingerprint===confidenceFingerprint unreachable through the UI. The one reachable path is resolveGrantedBranch()'s matched-branch pre-fill, which copies a saved mapping's fingerprints directly without that guard. The test seeds a corrupted single-fingerprint mapping (both roles -> the same fingerprint, which legitimately passes matchMapping's bidirectional check against ONE live screen) and reassigns from the matched summary to reach the same sameMonitorSelected/canSave guard — exercising real production code, not a test-only shortcut."

requirements-completed: [R267, R268, R269]

coverage:
  - id: D1
    description: "Any authenticated org member can navigate to /monitor-setup via a gated 'Monitor Setup' sidebar entry, visible to non-editors and hidden without an active org."
    requirement: "R267"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#shows the Monitor Setup link to a non-editor org member (isEditor false, orgId set), while editor-only items stay absent"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#hides the Monitor Setup link when orgId is null"
        status: pass
    human_judgment: false
  - id: D2
    description: "Granted-path monitor list with Audience/Confidence role assignment across two distinct monitors; Save disabled until both assigned to different displays."
    requirement: "R267"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#renders one card per detected screen with nothing pre-selected and Save disabled"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#disables Save and shows the inline validation copy when a saved mapping pre-fills both roles to the same monitor"
        status: pass
    human_judgment: false
  - id: D3
    description: "Device-scoped persistence via monitorConfig with save round-trip verification (green 'Saved' only on confirmed persist, amber warning on silent no-op), matched reload silently reuses a saved mapping, and a changed layout re-prompts blank instead of guessing."
    requirement: "R268"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#persists the chosen assignments under MONITOR_CONFIG_STORAGE_KEY and a same-layout remount renders the matched summary"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#renders the amber layout-changed banner above a blank editable grid when the saved fingerprints no longer match"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#shows the non-blocking amber not-persisted warning (not the green confirmation) when localStorage silently no-ops"
        status: pass
    human_judgment: false
  - id: D4
    description: "Denied/unavailable render the first-class MonitorFallbackPanel, never a dead end or error toast."
    requirement: "R269"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#renders the unavailable fallback copy with no Detect button when getScreenDetails is absent"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#renders the denied fallback copy after a rejected getScreenDetails() call"
        status: pass
    human_judgment: false
  - id: D5
    description: "getScreenDetails() is invoked synchronously from the Detect click handler, with no await before it — preserving user-activation for the real browser permission prompt."
    requirement: "R267"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts#calls window.getScreenDetails synchronously from the Detect click handler, before any awaited microtask resolves"
        status: pass
    human_judgment: false
  - id: D6
    description: "Real permission grant/deny on Chrome/Edge, actual multi-monitor hardware detection, long real-world monitor-label truncation, 3+ monitor overflow, and the drag+fullscreen manual fallback on real hardware."
    verification: []
    human_judgment: true
    rationale: "None of these are provable by jsdom unit tests — jsdom does not implement the Window Management API at all, so every test here mocks window.getScreenDetails rather than exercising a real browser permission prompt or real display hardware. Deferred to the milestone-end HUMAN-UAT pass per 92-CONTEXT.md."

# Metrics
duration: ~55min (92-01: ~35min, 92-02: ~20min)
completed: 2026-08-28
status: complete
---

# Phase 92: Monitor Configuration Screen Summary

**Standalone `/monitor-setup` screen implementing the full six-state detect/assign/persist machine for the Window Management API, with a save round-trip check that distinguishes a truthful "Saved" from a private-mode silent no-op, and full jsdom behavioral coverage proving every mocked path (permission states, persistence, reprompt, validation, the synchronous-call contract, and the orgId nav gate) — real permission grant/deny, real hardware detection, and the manual drag/fullscreen fallback remain deferred HUMAN-UAT items.**

## Performance

- **Duration:** ~55 min total (92-01 build: ~35 min; 92-02 tests: ~20 min)
- **Tasks:** 5 completed (3 build tasks in 92-01, 2 test-authoring tasks in 92-02)
- **Files modified:** 7 (2 modified, 5 created)

## Accomplishments

### Plan 92-01 (Build)
- `/monitor-setup` route registered with `meta: { requiresAuth: true }` only (no `requiresEditor`), and a "Monitor Setup" AppSidebar nav entry gated on `authStore.orgId` — reachable by any authenticated org member per R267/R275.
- `MonitorCard.vue` and `MonitorFallbackPanel.vue` built per the UI-SPEC contracts: card renders label/resolution/Primary badge + an accessible `role="radiogroup"` Audience/Confidence pill pair; the fallback panel is a single reusable component whose `reason` prop swaps only heading/body copy between denied and unavailable, with an identical 3-step instructional list and a retry escape hatch.
- `MonitorSetupView.vue` implements the entire state machine: feature-detection → State D (unavailable) as a first-class entry point; `permissions.query` pre-read (UI hint only) with auto-detect on a returning `'granted'` visit; State A hero with a synchronous `getScreenDetails()` Detect handler (no `await` before the call) plus a "Set up manually instead" escape hatch; granted branching to State B (fresh)/B2 (matched, condensed summary)/B3 (needs-reprompt, amber banner + forced-blank grid); cross-card exclusive role assignment; Save gated on two distinct monitors with inline same-monitor validation; and a `saveMapping()` → `loadMapping()` round-trip check gating the green "Saved for this device" confirmation vs. a non-blocking amber not-persisted warning.

### Plan 92-02 (Tests)
- `MonitorSetupView.test.ts` (8 tests): unavailable/denied/granted-fresh permission paths, the synchronous-call contract (asserts `getScreenDetails` fires before the click's settle promise is awaited), the save→localStorage→matched-reload round-trip, the layout-changed reprompt (State B3), the same-monitor Save-disabled validation, and the not-persisted amber warning under a simulated `Storage.prototype.setItem` throw. All exercise the real `@/utils/monitorConfig` module against jsdom's actual `localStorage` — nothing mocked there.
- `AppSidebar.test.ts` (2 tests): proves the Monitor Setup nav link is visible to a non-editor org member while the Group C editor-only neighbors (Admins, Settings) stay absent in that same state, and that the link disappears entirely when `orgId` is null — locking in the R267/R275 orgId-only gate divergence.

## Task Commits

Each task was committed atomically:

1. **92-01 Task 1: Register /monitor-setup route and add the gated AppSidebar nav entry** - `9473dd47` (feat)
2. **92-01 Task 2: Build MonitorCard.vue and MonitorFallbackPanel.vue child components** - `2b23a18b` (feat)
3. **92-01 Task 3: Build MonitorSetupView.vue — state machine, synchronous detection, persistence with save round-trip check** - `bcdbefcd` (feat)
4. **92-01 plan metadata** - `1d8df977` (docs)
5. **92-02 Task 1: Author MonitorSetupView.test.ts (three paths + persistence round-trip + synchronous-call)** - `09c46c7f` (test)
6. **92-02 Task 2: Author AppSidebar.test.ts proving the orgId-gated Monitor Setup nav entry** - `d6a344d3` (test)

## Files Created/Modified
- `src/router/index.ts` - Added `/monitor-setup` route, `requiresAuth` only.
- `src/components/AppSidebar.vue` - Added "Monitor Setup" nav item gated on `authStore.orgId`.
- `src/views/MonitorSetupView.vue` - Owns the full state machine, `getScreenDetails()` handler, persistence + round-trip check.
- `src/components/MonitorCard.vue` - One detected-monitor card with the role radiogroup.
- `src/components/MonitorFallbackPanel.vue` - Shared denied/unavailable manual-setup panel.
- `src/views/__tests__/MonitorSetupView.test.ts` - Behavioral coverage for the whole state machine (new).
- `src/components/__tests__/AppSidebar.test.ts` - Behavioral coverage for the orgId nav gate (new).

## Decisions Made

- Post-save confirmation is rendered inline within the same editable-grid view (action row swaps to a "Saved for this device" strip) rather than transitioning to the separate B2 summary card — keeps the just-saved selections visibly intact for the "Change" link, matching the UI-SPEC's State B description literally.
- Added the plan-checker-flagged "Set up manually instead" escape-hatch link under State A; it sets `phase` directly to `'denied'`, reusing the exact same fallback panel/copy as a genuine permission denial.
- A successful save from the B3 (needs-reprompt) branch flips `grantedView` back to `'fresh'` so the amber "layout changed" banner clears once the new mapping is confirmed saved (not specified verbatim in the UI-SPEC, but necessary — otherwise a stale banner would persist above a just-saved-and-correct mapping).
- MonitorSetupView.test.ts needs no `@/stores/auth` mock at all — the view has zero store dependency; only `AppShell` (stubbed) reads the store, so stubbing it out removes the need entirely. A simplification from the plan's suggested harness reuse, not a deviation from any behavioral requirement.
- The same-monitor-validation test reaches `sameMonitorSelected`/`canSave`'s disabled-Save state via a seeded corrupted matched mapping (both roles pointing at the same fingerprint against a single live screen) rather than two literal card clicks, since `onSelectRole`'s cross-card exclusivity guard makes that state unreachable through normal UI interaction — this exercises real `resolveGrantedBranch()` production code, not a test-only bypass.

## Deviations from Plan

None - both plans executed exactly as written. 92-01's one optional plan-checker suggestion (the State A escape-hatch link) was implemented as instructed. 92-02's test-construction choices for the same-monitor-validation scenario and the omitted auth-store mock are documented above as decisions, not deviations from any acceptance criterion — both required acceptance behaviors (Save disabled + inline validation copy shown) are proven exactly as specified.

## Issues Encountered

None. `npm run type-check` (vue-tsc --build) passed clean after both plans. `npx vitest run` reported exactly the documented baseline (`src/storage.rules.test.ts` only — 4451 passed, 26 skipped, 157/160 files passed after 92-02 added its 2 new test files), confirming no regression from either plan's changes.

## User Setup Required

None - no external service configuration required.

**Human UAT deferred to milestone end** (per `92-CONTEXT.md`, tracked as coverage item D6 above): real Window Management API permission grant/deny on Chrome/Edge, actual multi-monitor hardware detection (label truncation, 3+ monitor overflow), and the manual drag-to-screen + fullscreen fallback flow — none of these are provable in jsdom, which does not implement the Window Management API at all. Every automated test in this phase mocks `window.getScreenDetails` rather than exercising a real browser permission prompt or connected hardware.

## Next Phase Readiness

- All build artifacts (`MonitorSetupView.vue`, `MonitorCard.vue`, `MonitorFallbackPanel.vue`, route, nav entry) and their full jsdom behavioral test coverage are in place, committed, and type-clean.
- Phase 95's Run flow can consume this screen's persisted `monitorConfig` mapping and `matchMapping` seam once built.
- The deferred human-UAT items (D6) should be exercised together with Phase 95's real window-opening flow at the milestone-end UAT pass, since that is the first point real connected-monitor hardware becomes relevant to the product surface.
- No blockers.

---
*Phase: 92-monitor-configuration-screen*
*Completed: 2026-08-28*

## Self-Check: PASSED

All created files found on disk (`src/views/__tests__/MonitorSetupView.test.ts`, `src/components/__tests__/AppSidebar.test.ts`, this SUMMARY); all six referenced commits (`9473dd47`, `2b23a18b`, `bcdbefcd`, `1d8df977`, `09c46c7f`, `d6a344d3`) found in git log.
