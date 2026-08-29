---
phase: 98-fullscreen-setup-helper
plan: 02
subsystem: ui
tags: [vue3-sfc, tailwind-dark-theme, blob-download, monitor-setup]

# Dependency graph
requires:
  - phase: 98-fullscreen-setup-helper (98-01)
    provides: "useFullscreenReadiness (status+recheck), detectOS/detectBrowser (+osLabel/browserLabel), buildPolicyArtifact, downloadTextFile"
  - phase: 92-monitor-configuration-screen
    provides: "MonitorSetupView.vue's phase-based v-if/v-else layout and MonitorCard.vue/MonitorFallbackPanel.vue Tailwind idiom this panel matches"
provides:
  - "FullscreenSetupPanel.vue — the operator-facing four-state (checking/ready/not-ready/unsupported) UI over the Wave-1 readiness logic"
  - "MonitorSetupView.vue mounts FullscreenSetupPanel unconditionally, outside the phase chain"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.mocked(...).mockReturnValue({ status: ref(...), recheck }) for mocking a composable in a component test — a plain mutable object (not a real Vue ref) is invisible to the template's reactivity tracking, so state-transition assertions (not-ready -> ready with no remount) require a genuine ref"

key-files:
  created:
    - src/components/FullscreenSetupPanel.vue
    - src/components/__tests__/FullscreenSetupPanel.test.ts
  modified:
    - src/views/MonitorSetupView.vue
    - src/views/__tests__/MonitorSetupView.test.ts

key-decisions:
  - "Origin is read from window.location.origin ONLY inside triggerDownload(), at click time — never hoisted to a computed or module scope — matching CONTEXT Decision 2 / T-98-04's no-injection-surface requirement verbatim"
  - "os/browser (detectOS()/detectBrowser()) are computed ONCE at component setup, not reactively — a real OS/browser change requires an actual browser restart, which the panel already models via recheck()/'checking', so there is no live-reactivity need"
  - "Per-OS step-2 verb copy uses v-html (fixed, non-interpolated strings only, matching the existing v-html precedent in ServiceEditorView.vue/AppSidebar.vue) so the UI-SPEC's inline <strong>/<code> emphasis renders without introducing a new dependency"

patterns-established:
  - "Component tests for a composable-backed panel: vi.mock the composable to a bare vi.fn(), then vi.mocked(...).mockReturnValue({ status: ref(initial), recheck: vi.fn() }) per test/beforeEach — gives tests a genuinely reactive handle to drive every state deterministically without touching navigator.permissions"

requirements-completed: [R285, R286, R287]

coverage:
  - id: D1
    description: "FullscreenSetupPanel renders all four UI-SPEC states (checking/ready/not-ready/unsupported) with the exact data-testids and copy, and no state ever shows more than one status block"
    requirement: "R285"
    verification:
      - kind: unit
        ref: "src/components/__tests__/FullscreenSetupPanel.test.ts — checking/ready/not-ready/unsupported state describe blocks (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Not-ready state's primary button names the detected browser+OS, downloads an origin-baked OS-correct artifact (HKCU default + HKLM admin link on Windows, .mobileconfig on macOS, JSON on Linux), and shows a red error line if the download throws"
    requirement: "R286"
    verification:
      - kind: unit
        ref: "src/components/__tests__/FullscreenSetupPanel.test.ts — 'not-ready state' describe block, download/admin-link/extension/error-line tests (6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Confirm fullscreen support re-runs the readiness check and flips not-ready -> ready on the SAME wrapper (no remount); troubleshooting is absent on first paint and appears only after a still-not-ready confirm"
    requirement: "R287"
    verification:
      - kind: unit
        ref: "src/components/__tests__/FullscreenSetupPanel.test.ts — 'self-correcting confirm (R287)' describe block (2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "MonitorSetupView mounts FullscreenSetupPanel exactly once, unconditionally, outside and below the phase v-if/else chain — present in prompt and unavailable phases alike — with no existing branch/handler changed"
    requirement: "R287"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts — 'FullscreenSetupPanel is mounted additively' describe block (3 tests) plus all 10 pre-existing tests kept green"
        status: pass
    human_judgment: false
  - id: D5
    description: "On real hardware: download the setup file, run it, fully restart the browser, click Confirm fullscreen support, and the panel flips to ready"
    human_judgment: true
    rationale: "Requires an actual OS-level registry/profile/policy install and a real browser restart — cannot be proven by jsdom unit tests, which mock the readiness composable and downloadTextFile by design. Deferred to the plan's documented Manual/UAT verification step (/gsd-verify-work, not an in-plan gate)."

# Metrics
duration: 22min
completed: 2026-08-29
status: complete
---

# Phase 98 Plan 02: Fullscreen Setup Helper (UI) Summary

**FullscreenSetupPanel.vue — a four-state (checking/ready/not-ready/unsupported) Vue panel over the Wave-1 readiness composable, mounted unconditionally at the bottom of MonitorSetupView.vue, offering a one-click origin-baked per-OS policy-file download and a self-correcting "Confirm fullscreen support" re-check.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-29T21:59:00Z
- **Completed:** 2026-08-29T22:21:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `src/components/FullscreenSetupPanel.vue` — renders the UI-SPEC's four mutually-exclusive states verbatim (testids, copy, dark-theme Tailwind vocabulary matching `MonitorCard.vue`/`MonitorFallbackPanel.vue`): checking (spinner), ready (green check, no CTA), not-ready (amber, per-OS download button + numbered instructions + honest-friction caveat + Confirm button + Windows HKLM admin link), and unsupported (muted, demoted "Check again" link).
- Download flow: `onDownload()`/`onDownloadAdmin()` call `buildPolicyArtifact(os, window.location.origin, scope)` then `downloadTextFile(...)`, reading the origin ONLY at click time (never hardcoded, never threaded through a prop/query param — CONTEXT Decision 2 / T-98-04). A thrown download surfaces a `text-red-400` error line under the button.
- Self-correcting Confirm: `onConfirm()` awaits `recheck()` then sets an `attempted` flag; `showTroubleshooting` gates the "Still not working?" block on `attempted && status === 'not-ready'` so it never shows on first paint, only after a resolved-still-not-ready confirm. Flipping not-ready -> ready is a plain reactive re-render on the same mounted wrapper (R287 "no reload").
- `src/views/MonitorSetupView.vue` — `<FullscreenSetupPanel class="mt-8" />` added as the last child of the outer `px-6 py-8 max-w-4xl` container, after the closing `</div>` of the phase `v-if`/`v-else` chain, rendering unconditionally in every phase (prompt/detecting/denied/manual/unavailable/granted). No existing branch, ref, computed, or handler touched.
- 28 new component + view tests, all green; `npm run type-check` (`vue-tsc --build`, includes tests) clean; bare `npx vitest run` shows exactly the documented one-file baseline (`src/storage.rules.test.ts`, Storage-emulator-dependent) with no new failures (174/175 files, 4733/4758 tests passing); the regression guard (`useOutputWindow.test.ts`, 21 tests) stays green and `git diff` confirms `useOutputWindow.ts`/`useRunControl.ts` were not touched (no `useRunControl.test.ts` file exists in this repo).

## Task Commits

Each task followed RED (failing test) then GREEN (implementation):

1. **Task 1: FullscreenSetupPanel.vue component**
   - `0314188e` test(98-02): add failing tests for FullscreenSetupPanel four-state UI
   - `4925657f` feat(98-02): implement FullscreenSetupPanel four-state UI (R285/R286/R287)
2. **Task 2: Mount the panel in MonitorSetupView (additive)**
   - `6f3104bb` test(98-02): assert FullscreenSetupPanel mounts additively in MonitorSetupView
   - `45e88183` feat(98-02): mount FullscreenSetupPanel additively in MonitorSetupView

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/components/FullscreenSetupPanel.vue` - the four-state panel (checking/ready/not-ready/unsupported), per-OS download + Confirm re-check
- `src/components/__tests__/FullscreenSetupPanel.test.ts` - 15 tests covering all four states, download/admin-link/extension behavior, download-error line, R287 self-correction + troubleshooting gating, never-calls-requestFullscreen guard
- `src/views/MonitorSetupView.vue` - additive `<FullscreenSetupPanel class="mt-8" />` mount + import, outside the phase chain
- `src/views/__tests__/MonitorSetupView.test.ts` - stubs FullscreenSetupPanel, adds 3 tests proving presence across two different phases and exactly-one-instance; all 10 pre-existing tests kept green

## Decisions Made
- Origin is read from `window.location.origin` only inside `triggerDownload()` at click time, never hoisted — keeps the no-injection-surface guarantee (T-98-04) literal and testable.
- `detectOS()`/`detectBrowser()` are called once at component setup (not reactively) since a genuine OS/browser change requires an actual restart, which the panel already models through `recheck()`.
- Per-OS instruction copy uses `v-html` for the fixed (non-user-supplied) step-2 verb strings so the UI-SPEC's inline `<strong>`/`<code>` emphasis renders, following the existing `v-html` precedent already in this codebase (`ServiceEditorView.vue`, `AppSidebar.vue`) rather than introducing a new dependency.

## Deviations from Plan

None — plan executed exactly as written. One test-authoring correction was made and folded into the same TDD cycle (not a deviation-rule fix against already-committed code):
- The first draft of `FullscreenSetupPanel.test.ts` mocked the readiness composable with a plain mutable object (`{ value: 'checking' }`) instead of a real Vue `ref`. Vue's template auto-unwrap/reactivity only tracks genuine `Ref` instances, so every state comparison (`status === 'checking'`, etc.) silently evaluated false and the component always rendered its `v-else` (unsupported) branch regardless of the intended state — 12 of 15 tests failed. Fixed during GREEN by switching to `vi.mocked(useFullscreenReadiness).mockReturnValue({ status: ref(...), recheck })`, which gives the component's `<script setup>` destructure a real reactive `Ref` the template correctly tracks.
- `MonitorSetupView.test.ts`'s first "renders the panel in the default/prompt phase" assertion needed `installGetScreenDetails(...)` before mount — without it, jsdom's default absence of `window.getScreenDetails` lands the view in the `unavailable` phase, not `prompt`, matching the existing `unavailable`-path test's own documented rationale ("`getScreenDetails` is absent from jsdom by default").

## Issues Encountered
None beyond the two test-authoring corrections above, made before either GREEN commit landed.

## User Setup Required
None - no external service configuration required. Client-only, no new npm dependency, no Firestore/rules/Cloud Function change (client-only invariant preserved, threat register T-98-SC N/A).

## Next Phase Readiness
- Phase 98 (Fullscreen Setup Helper) is now feature-complete on both waves: 98-01's pure logic layer and 98-02's UI panel, satisfying R285/R286/R287.
- The one remaining item is the plan's documented Manual/UAT step (D5 above, not an in-plan gate): on real hardware, download the file, run it, fully restart the browser, click "Confirm fullscreen support", and confirm the panel flips to ready. This is the owner's live open item tracked in STATE.md ("multi-monitor auto-fullscreen needs the one-time-per-computer Chrome policy") — this phase makes that setup reachable and self-verifying in the field; the owner still needs to walk through it once on a real machine.
- No blockers for closing out this phase or the milestone once the hardware UAT above is confirmed.

---
*Phase: 98-fullscreen-setup-helper*
*Completed: 2026-08-29*

## Self-Check: PASSED

All 4 created/modified source/test files and all 4 task commits (0314188e, 4925657f, 6f3104bb, 45e88183) verified present on disk / in git log.
