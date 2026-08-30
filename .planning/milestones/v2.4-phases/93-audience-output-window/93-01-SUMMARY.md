---
phase: 93-audience-output-window
plan: 01
subsystem: ui
tags: [vue, broadcastchannel, fullscreen, wakelock, presentation, slidecanvas]

# Dependency graph
requires:
  - phase: 91-config-channel-utilities
    provides: openRunChannel receive-only run-channel protocol (onState/postHello, stale-seq drop)
  - phase: 90-slide-canvas
    provides: SlideCanvas render component (background layer, media, render-state slides)
provides:
  - Standalone /present/audience/:serviceId route (audience-output, requiresAuth only, org via ?org=)
  - AudienceOutputView.vue — chromeless receive-only fullscreen congregation output window
  - In-window self-bootstrap pattern (services store subscribe + select-into-localService, read-only assembly)
  - Screen Wake Lock lifecycle (acquire on mount, re-acquire on visibilitychange, release on unmount)
  - Non-teardown fullscreen-loss recovery affordance pattern
affects: [95-run-control-flow, 94-confidence-monitor, audience-output-window]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route self-scoping via ?org= query (falling back to authStore.orgId) — first route to read ?org"
    - "Receive-only run-channel consumer: onState + postHello + close, never postState"
    - "Screen Wake Lock feature-detect + re-acquire-on-visibility + try/caught release"
    - "Fullscreen-loss recovery that only updates an isFullscreen ref (never teardown) — diverges from PresentationViewer"
    - "Congregation-safe pure-black loading/empty gate (no spinner/copy)"

key-files:
  created:
    - src/views/AudienceOutputView.vue
  modified:
    - src/router/index.ts

key-decisions:
  - "canWrite OMITTED on useSlideshowAssembly so the read-only viewer never attempts a Firestore write its rules would deny"
  - "cursor:none applied ONLY while fullscreen, restored windowed, so the re-enter affordance stays clickable"
  - "blackout read from RunState for forward-compat but drives NO UI this milestone"
  - "serviceStore.unsubscribeAll() on unmount is safe here (standalone sole-consumer window), unlike ServiceEditorView"

patterns-established:
  - "Self-bootstrapping standalone route view: subscribe org services, select one by id into a local ref (initial-load branch only)"
  - "Injectable BroadcastChannelFactory prop as the run-channel test seam"

requirements-completed: [R270, R271]

coverage:
  - id: D1
    description: "/present/audience/:serviceId route registered (name audience-output, meta requiresAuth only, org via ?org=, no requiresEditor)"
    requirement: R270
    verification:
      - kind: unit
        ref: "grep 'path: /present/audience/:serviceId' + AudienceOutputView.vue in src/router/index.ts"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AudienceOutputView renders the live current slide fullscreen with background and zero operator chrome; receive-only channel drives index; postHello on mount, never postState; pure-black loading/empty"
    requirement: R270
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts (authored in plan 93-02, wave 2)"
        status: unknown
    human_judgment: true
    rationale: "Behavioral tests are authored in 93-02 (wave 2); true chrome-free/cursor-free full-bleed projection on a real second monitor is only provable by human UAT (deferred per 93-CONTEXT)."
  - id: D3
    description: "Screen stays awake via Wake Lock (acquire on mount + re-acquire on visibilitychange->visible, feature-detected, try/caught, released on unmount)"
    requirement: R271
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts (authored in plan 93-02, wave 2)"
        status: unknown
    human_judgment: true
    rationale: "Real wake-lock behavior over a realistic service length is only provable on hardware (human UAT, deferred)."
  - id: D4
    description: "Fullscreen loss surfaces a single calm re-enter affordance over the live slide (synchronous requestFullscreen) and NEVER tears down the session/channel/window (Pitfall 6)"
    requirement: R271
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts (authored in plan 93-02, wave 2)"
        status: unknown
    human_judgment: true
    rationale: "No-teardown behavior + affordance findability from the booth are validated by 93-02 tests then human UAT; not provable in this wave."

# Metrics
duration: 11min
completed: 2026-08-28
status: complete
---

# Phase 93 Plan 01: Audience Output Window Summary

**A chromeless, receive-only, fullscreen `/present/audience/:serviceId` route that renders the live service's current slide (background ON) via SlideCanvas, keeps the screen awake with the Screen Wake Lock, and recovers from fullscreen loss without ever tearing down the running session.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-28T20:23:32Z
- **Completed:** 2026-08-28T20:34:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Registered the `/present/audience/:serviceId` route (`audience-output`, `requiresAuth` only, org via `?org=`) among the static authed routes, with `router.beforeEach` left untouched.
- Built `AudienceOutputView.vue`: self-bootstraps its Service load (`:serviceId` + `?org=`) through the services store (initial-load branch only), runs `useSlideshowAssembly` read-only (`canWrite` omitted), and derives the current slide receive-only from the run channel index.
- Implemented Screen Wake Lock (acquire on mount, re-acquire on `visibilitychange`→visible, feature-detected, try/caught, released on unmount) — a genuinely new behavior with no in-repo analog.
- Implemented non-teardown fullscreen-loss recovery: a `fullscreenchange` listener that updates an `isFullscreen` ref only, surfacing one calm "Re-enter fullscreen" affordance whose click calls `requestFullscreen()` synchronously; `cursor: none` only while fullscreen so the affordance stays clickable windowed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the /present/audience/:serviceId route** - `426fb6f4` (feat)
2. **Task 2: Build AudienceOutputView.vue** - `2ee6ab45` (feat)

## Files Created/Modified
- `src/views/AudienceOutputView.vue` - The chromeless receive-only fullscreen output window (created).
- `src/router/index.ts` - Added the `audience-output` route entry (modified).

## Decisions Made
- **`canWrite` omitted** on `useSlideshowAssembly` so the read-only viewer never triggers a materialize/rebuild write that Firestore rules would deny (T-93-03 mitigation).
- **`cursor: none` bound to `isFullscreen`** (not unconditional) so the recovery affordance is clickable in the windowed state (UI-SPEC FLAG).
- **`blackout` read but unused** — captured from `RunState` for forward-compat; drives no UI this milestone per plan.
- **`serviceStore.unsubscribeAll()` on unmount** — safe because this standalone window is the store's sole consumer (documented divergence from ServiceEditorView).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `npx vitest run` gate was slow (~403s) and exceeded the foreground timeout, so it was run to completion in the background; it finished with exit code 0.

## Known Stubs
None that block the plan goal. The `blackout` ref is captured from the channel state and intentionally drives no UI this milestone (documented forward-compat per the plan/UI-SPEC); no future-plan wiring debt is introduced by this view.

## Verification Results
- **`npm run type-check` (vue-tsc --build):** clean, no errors (typechecks test files too per CLAUDE.md).
- **`npx vitest run`:** 161/162 test files pass (4511 tests pass); the ONLY failing file is the documented baseline `src/storage.rules.test.ts` (Storage-emulator dependent — cross-service `firestore.exists()` limitation, not a regression). No new failures introduced.
- **Manual code check:** no `postState` call, no Firestore/`db` import, no exit/nav/progress/slide-count/org-label chrome; the `fullscreenchange` handler calls no exit/teardown/close path.

## Next Phase Readiness
- The audience output window is ready for Phase 95's Run/Control flow to open and position on the assigned monitor (this phase does not itself launch or place windows).
- Behavioral tests for the view (channel-driven index, postHello-on-mount, never-postState, chrome-absence, cursor toggle, wake-lock present/absent, fullscreen-loss no-teardown) are authored next in plan 93-02 (wave 2).
- HUMAN-UAT deferred: real second-monitor fullscreen, wake-lock over a full service, true chrome-free/cursor-free projection, and affordance findability from the booth.

## Self-Check: PASSED

- `src/views/AudienceOutputView.vue` — FOUND
- `src/router/index.ts` — FOUND
- `.planning/phases/93-audience-output-window/93-01-SUMMARY.md` — FOUND
- Commit `426fb6f4` — FOUND
- Commit `2ee6ab45` — FOUND

---
*Phase: 93-audience-output-window*
*Completed: 2026-08-28*
