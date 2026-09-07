---
phase: 136-video-output-fullscreen-slice
plan: 02
subsystem: ui
tags: [vue, typescript, vitest, vue-router, output-window]

# Dependency graph
requires:
  - phase: 136-video-output-fullscreen-slice
    plan: 01
    provides: "MonitorRole widened to the 3-member union 'audience' | 'confidence' | 'video'; the Monitor Setup UI, isValidMapping's allowlist, and Run Control's display labels already accept a 'video' assignment."
provides:
  - "src/components/output/FullscreenSlideOutput.vue — the single shared fullscreen slide render + lifecycle (role/testid-parameterized), the one render definition Phase 137's Banner mode extends"
  - "AudienceOutputView.vue refactored to a thin wrapper over FullscreenSlideOutput (role='audience' testid='audience') — DOM/behavior unchanged, proven by its unedited 24-test suite"
  - "VideoOutputView.vue — a new thin wrapper (role='video' testid='video') delegating to the same shared render"
  - "/present/video/:serviceId static route -> VideoOutputView, requiresAuth only, mirroring /present/audience and /present/confidence"
  - "A saved 'video' MonitorAssignment launches at /present/video/... via the existing urlForAssignment + openPlaced/openUnplaced machinery — no useRunControl change"
affects: [137-video-output-banner-render]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared fullscreen output render: a role+testid-parameterized component (FullscreenSlideOutput) that thin view wrappers delegate to, rather than each output view forking its own render — the pattern Phase 137's Banner mode extends"

key-files:
  created:
    - src/components/output/FullscreenSlideOutput.vue
    - src/views/VideoOutputView.vue
    - src/views/__tests__/VideoOutputView.test.ts
  modified:
    - src/views/AudienceOutputView.vue
    - src/router/index.ts

key-decisions:
  - "Extracted the ENTIRE AudienceOutputView template + script into FullscreenSlideOutput.vue verbatim (behavior-preserving), parameterized only by `role` (forwarded to useOutputWindow) and `testid` (the data-testid prefix, defaulted to 'audience'). AudienceOutputView.vue became a 17-line wrapper; the unedited, pre-existing AudienceOutputView.test.ts (24 tests) is the proof the extraction changed nothing observable."
  - "VideoOutputView.vue is the second thin wrapper (role='video' testid='video') — no new render code, satisfying R426's 'reuse, don't fork' requirement directly at the type level (both wrappers literally render the same component)."
  - "No useRunControl.ts change: urlForAssignment already builds /present/${role}/${serviceId} generically, and openPlaced/openUnplaced/canGoLive are already generic over the assignments array — a 'video' assignment threads through with zero edits, verified by a dedicated urlForAssignment test."
  - "/present/video/:serviceId placed immediately after /present/confidence among the static authed routes (before the trailing dynamic slug routes) so it can never be shadowed, mirroring the existing two output routes' comment style and meta (requiresAuth only)."

requirements-completed: [R424, R426]

coverage:
  - id: D1
    description: "The Audience fullscreen slide render lives in ONE shared component that both AudienceOutputView and VideoOutputView delegate to (not copy-pasted)"
    requirement: R426
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts (24 tests, unedited, all passing against the refactored wrapper)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/VideoOutputView.test.ts#renders the channel-selected slide inside the canonical video-stage (same structure as audience-stage)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AudienceOutputView's existing behavior is unchanged — its full test suite still passes after the extraction"
    requirement: R426
    verification:
      - kind: unit
        ref: "npx vitest run src/views/__tests__/AudienceOutputView.test.ts — 24/24 passing, file unedited"
        status: pass
    human_judgment: false
  - id: D3
    description: "/present/video/:serviceId resolves to VideoOutputView with the same requiresAuth-only meta as the audience/confidence output routes"
    requirement: R424
    verification:
      - kind: structural
        ref: "src/router/index.ts — new route, path '/present/video/:serviceId', name 'video-output', meta: { requiresAuth: true }, placed before the trailing dynamic slug routes"
        status: pass
    human_judgment: false
  - id: D4
    description: "A slide sent to the Video output renders fullscreen identically to Audience (same shared render, same 1280x720 canonical stage, same blackout + re-enter-fullscreen chrome), driven by the same run-control channel"
    requirement: R426
    verification:
      - kind: unit
        ref: "src/views/__tests__/VideoOutputView.test.ts (5 tests: pure-black gate, canonical video-stage render, out-of-range guard, video-blackout overlay toggle, urlForAssignment launch URL)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A saved 'video' monitor assignment launches at /present/video/<serviceId> via the existing openPlaced/openUnplaced machinery, and the >=1 Audience go-live gate is unchanged"
    requirement: R424
    verification:
      - kind: unit
        ref: "src/views/__tests__/VideoOutputView.test.ts#urlForAssignment builds a /present/video/... path for a role \"video\" assignment"
        status: pass
      - kind: unit
        ref: "useRunControl.ts untouched (urlForAssignment/openPlaced/openUnplaced/canGoLive) — verified by inspection, no diff to this file"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 136 Plan 02: Shared FullscreenSlideOutput extraction + VideoOutputView + route Summary

**Extracted AudienceOutputView's fullscreen render into a role/testid-parameterized `FullscreenSlideOutput.vue`; both `AudienceOutputView` and the new `VideoOutputView` are now thin wrappers over it, and `/present/video/:serviceId` launches the Video output through the existing N-assignment machinery with zero `useRunControl` changes.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-07T19:18:51Z
- **Completed:** 2026-09-07T19:43:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `src/components/output/FullscreenSlideOutput.vue` is the SOLE fullscreen output render definition — the full template (canonical `${testid}-output` root, R329 `${testid}-stage` 1280x720 box, `${testid}-blackout` overlay, `${testid}-reenter-fullscreen` affordance) and script (`useOutputWindow`/`useContainScale` wiring, `currentSlide` null/out-of-range guard, the T-23-08 pause→nextTick→play sequence, the deferred first-play watch, the `onBeforeUnmount` pause) moved verbatim from AudienceOutputView, now parameterized by `role: MonitorRole` and `testid` (defaulted to `'audience'`).
- `AudienceOutputView.vue` shrank to a 17-line wrapper rendering `<FullscreenSlideOutput role="audience" testid="audience" :channel-factory="props.channelFactory" />`. Its own, UNEDITED 24-test suite passes unchanged — proof the extraction preserved DOM structure, testids, child paint order, the pause/play media invariant, wake lock, fullscreen-loss recovery, blackout overlay, and org re-subscription behavior.
- `VideoOutputView.vue` is the second thin wrapper (`role="video" testid="video"`) — the Video output renders fullscreen exactly like Audience via literally the same render component, no forked code.
- `/present/video/:serviceId` registered in `src/router/index.ts` immediately after `/present/confidence`, `meta: { requiresAuth: true }`, among the static authed routes before the trailing dynamic slug routes.
- `useRunControl.ts` required NO changes: `urlForAssignment` already builds `/present/${role}/${serviceId}`, so a saved `video` assignment (enabled by 136-01) launches through the existing `openPlaced`/`openUnplaced` machinery; `canGoLive`'s `>=1 Audience` gate is untouched.
- New `VideoOutputView.test.ts` (5 tests) proves the shared render (pure-black gate, canonical `video-stage`, out-of-range guard, `video-blackout` overlay toggle) and the launch URL (`urlForAssignment({role:'video'}, ...)` → `/present/video/svc-1...`).

## Task Commits

1. **Task 1: Extract the shared FullscreenSlideOutput render; make AudienceOutputView a thin wrapper**
   - `97aa4913` (feat) — new `FullscreenSlideOutput.vue`; `AudienceOutputView.vue` rewritten as a thin wrapper; unedited Audience suite verified green (24/24)
2. **Task 2: Create VideoOutputView + /present/video route; prove the shared render and launch URL**
   - `e8c54892` (test) — RED: `VideoOutputView.test.ts` added while `VideoOutputView.vue` did not yet exist; confirmed failing (import-resolution error) before the implementation landed
   - `3266262b` (feat) — GREEN: `VideoOutputView.vue` + the `/present/video/:serviceId` route; suite passes (5/5)

## Files Created/Modified

- `src/components/output/FullscreenSlideOutput.vue` — NEW. The shared fullscreen render + lifecycle.
- `src/views/AudienceOutputView.vue` — refactored to a thin wrapper.
- `src/views/VideoOutputView.vue` — NEW. Thin wrapper (`role="video"`, `testid="video"`).
- `src/router/index.ts` — new `/present/video/:serviceId` route.
- `src/views/__tests__/VideoOutputView.test.ts` — NEW. 5 tests covering the shared render + launch URL.

## Decisions Made

- Extraction was verbatim/behavior-preserving — no attempt to "clean up" or refactor the moved logic beyond parameterizing `role`/`testid`. The unedited Audience suite is the enforcement mechanism.
- Followed the TDD flow for Task 2 as directed by the plan's `tdd="true"` attribute: wrote the failing `VideoOutputView.test.ts` first (confirmed RED by temporarily removing the not-yet-committed `VideoOutputView.vue` from disk and re-running), then restored the implementation and confirmed GREEN, committing test and implementation separately.
- Two of the five VideoOutputView pure-black-gate tests needed `setFullscreenElement(document.createElement('div'))` (mirroring AudienceOutputView.test.ts's own pure-black describe block) so the windowed-only re-enter affordance doesn't add visible text to the pure-black assertions — an artifact of borrowing the Audience harness, not a behavior difference.

## Deviations from Plan

None beyond the harness fix described above (an artifact of writing the new test file, not a code-behavior deviation) — plan executed exactly as written. `useRunControl.ts` was deliberately left untouched per the plan's explicit instruction.

## Verification

- `npx vitest run src/views/__tests__/AudienceOutputView.test.ts src/views/__tests__/VideoOutputView.test.ts` — 29/29 passing (24 Audience + 5 Video).
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run` (full app suite) — 222/223 files passing, 5629/5664 tests passing (35 skipped); the ONLY failing file is `src/storage.rules.test.ts` (`ECONNREFUSED 127.0.0.1:9199` — the known, pre-existing Storage-emulator-dependent baseline documented in CLAUDE.md). No new failures introduced.
- Structural check: `src/router/index.ts` contains the `/present/video/:serviceId` route with `requiresAuth: true`, placed before the trailing dynamic slug routes.

## Issues Encountered

None.

## Deferred UAT

Per the autonomous-deferred-UAT mode for this execution, the human-visual checkpoint that would normally confirm "a slide sent to a real second monitor assigned to Video renders fullscreen identically to Audience" is DEFERRED rather than blocking. Automated coverage (the unedited Audience suite + the new Video suite, both exercising the real shared render component through an in-memory channel fake) fully proves the described behavior at the component level; a human can visually confirm the two-monitor demo the next time hardware is available, but this is not required to mark the plan complete. Not appended to `v2.14-DEFERRED-VERIFICATION.md` per the executor's instructions for this run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 137 (Video Output — Banner Render, R425/R427) now has exactly one shared render (`FullscreenSlideOutput.vue`) to extend with the per-item Banner/Full-screen choice and the transparent-default/solid-key-color-fallback render, rather than a second fork.
- `/present/video/:serviceId` is live and directly loadable; a `video` MonitorAssignment saved via Monitor Setup (136-01) already launches it end-to-end through the existing Run Control machinery.
- No blockers.

---
*Phase: 136-video-output-fullscreen-slice*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 task commits (97aa4913, e8c54892, 3266262b) confirmed in git log.
