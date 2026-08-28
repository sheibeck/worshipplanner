---
phase: 95-run-control-screen
plan: 01
subsystem: ui
tags: [vue, composables, pinia, refactor, slideshow-assembly, output-window]

# Dependency graph
requires:
  - phase: 94-confidence-output
    provides: useOutputWindow shared output-window lifecycle-core (the source of the extracted slice)
  - phase: 20-slideshow-assembly
    provides: useSlideshowAssembly reactive assembly engine consumed read-only here
provides:
  - src/composables/useServiceAssembly.ts — shared service-load + read-only assembly slice (serviceId/org scoping, initial-load watch, read-only useSlideshowAssembly, WR-02 subscribe gate) with NO output-only lifecycle and NO unsubscribeAll
  - useOutputWindow refactored to consume useServiceAssembly (behavior + return surface unchanged)
affects: [95-03 RunControlView, run-control-screen, output-window]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract a lifecycle-light shared composable slice (service-load + read-only assembly + subscribe gate) that BOTH a standalone window and an in-app SPA route can consume, keeping store teardown out of the shared slice so peers are not torn down"
    - "Call the shared slice FIRST in a consumer's setup() so its onMounted (subscribe gate) registers/fires before the consumer's own onMounted (channel open) — subscribe-before-channel ordering preserved by call order"

key-files:
  created:
    - src/composables/useServiceAssembly.ts
  modified:
    - src/composables/useOutputWindow.ts

key-decisions:
  - "useServiceAssembly registers ONLY onMounted (WR-02 subscribe gate) and NO onUnmounted — a normal in-app route (RunControlView) shares the store and must not tear peers' subscriptions down; unsubscribeAll stays solely in useOutputWindow's onUnmounted"
  - "useSlideshowAssembly is called with the options object OMITTED so canWrite stays its false default (read-only viewer) inside the shared slice"

patterns-established:
  - "Shared slice / output-only lifecycle split: the small load core lives once in useServiceAssembly; wake-lock/fullscreen/cursor/channel/unsubscribeAll stay in useOutputWindow"

requirements-completed: [R262, R263, R264]

coverage:
  - id: D1
    description: "useServiceAssembly.ts owns the service-load + read-only assembly slice (serviceId/orgIdRef computeds, localService initial-load watch, read-only useSlideshowAssembly, WR-02 org-mismatch subscribe gate in its own onMounted; no onUnmounted, no output-window machinery)"
    requirement: "R262"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useOutputWindow.test.ts (12) — WR-02 subscribe/no-re-subscribe assertions now exercised through the extracted slice"
        status: pass
      - kind: automated
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useOutputWindow refactored to consume useServiceAssembly for serviceId + assembledSlideshow; channel, font gate, rootStyle cursor, fullscreen recovery, wake lock, and onUnmounted unsubscribeAll unchanged; return surface identical"
    requirement: "R262"
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts (18) + src/views/__tests__/ConfidenceOutputView.test.ts (23) + src/composables/__tests__/useOutputWindow.test.ts (12) — 53 tests, files UNMODIFIED"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 95 Plan 01: Extract useServiceAssembly, refactor useOutputWindow Summary

**Extracted the ~20-line service-load + read-only assembly core out of useOutputWindow into a new lifecycle-light `useServiceAssembly` composable that both the output windows and the upcoming RunControlView share, with the 53 existing output-window tests staying green against unmodified files.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 refactored)

## Accomplishments
- New `src/composables/useServiceAssembly.ts` exposes exactly `{ serviceId, orgIdRef, localService, assembledSlideshow }`. It holds the `serviceId` (route param) + `orgIdRef` (`?org=` ?? `authStore.orgId` ?? null) computeds, the `{ immediate: true }` initial-load watch over `serviceStore.services` that sets `localService` once via `.find(s => s.id === serviceId.value)`, and the read-only `useSlideshowAssembly(localService, orgIdRef)` (canWrite omitted). Its ONLY lifecycle hook is an `onMounted` holding the WR-02 org-mismatch subscribe gate (`if (orgId && serviceStore.orgId !== orgId) serviceStore.subscribe(orgId)`). It registers NO `onUnmounted` and never calls `unsubscribeAll()`.
- `useOutputWindow` now calls `useServiceAssembly()` FIRST in its setup and destructures `{ serviceId, assembledSlideshow }` from it. Because the shared slice is called first, its `onMounted` (subscribe gate) registers and fires BEFORE useOutputWindow's `onMounted` opens the run channel — the subscribe-before-channel ordering the audience WR-02 tests assert is preserved.
- Everything output-window-specific stays in useOutputWindow unchanged: the receive-only run channel (`openRunChannel(serviceId.value, options.channelFactory)`, onState/postHello/close), the bounded font gate + `resolvedFontChoice`, `rootStyle` (CSS-vars + `cursor: none` while fullscreen), fullscreen-loss recovery (`rootRef`/`isFullscreen`/`handleFullscreenChange`/`handleReenterFullscreen`), the Screen Wake Lock, and the entire `onUnmounted` including `serviceStore.unsubscribeAll()`. The WR-02 gate was removed from its `onMounted` (now solely in the shared slice). The return surface `{ assembledSlideshow, index, fontReady, rootRef, rootStyle, isFullscreen, handleReenterFullscreen }` is identical.
- Trimmed now-unused imports from useOutputWindow: `useRoute`, `useSlideshowAssembly`, the `Service` type, and `watch`.

## Task Commits

1. **Task 1: Create useServiceAssembly.ts** - `b71daca2` (feat)
2. **Task 2: Refactor useOutputWindow.ts to consume useServiceAssembly** - `62a00c48` (refactor)

## Files Created/Modified
- `src/composables/useServiceAssembly.ts` - New shared service-load + read-only assembly slice (serviceId/org computeds, initial-load watch, read-only assembly, WR-02 subscribe gate); no output-only lifecycle, no unsubscribeAll.
- `src/composables/useOutputWindow.ts` - Refactored to a thin consumer of useServiceAssembly; every output-only lifecycle concern intact.

## Decisions Made
None - followed plan as specified. The plan's constraints (no onUnmounted / no unsubscribeAll in the shared slice; call the slice first; omit useSlideshowAssembly options; keep the three test files unmodified) were honored exactly.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Gate Results
- **`npm run type-check`** (vue-tsc --build, per CLAUDE.md — includes test files): PASS, clean. No `NODE_OPTIONS` bump needed (no OOM).
- **53-test regression gate** (`npx vitest run` of the three files): PASS — `useOutputWindow.test.ts` (12) + `AudienceOutputView.test.ts` (18) + `ConfidenceOutputView.test.ts` (23) = **53 passed / 53**, with all three files UNMODIFIED (confirmed via `git diff --stat HEAD~2 HEAD` = empty).
- **Full suite** (`npx vitest run`, no `--dir src`): 164 files passed, 1 failed — the sole failure is the documented baseline `src/storage.rules.test.ts` (Storage-emulator / cross-service-read limitation per CLAUDE.md). No new regression.

## Known Stubs
None.

## Next Phase Readiness
- The shared service-load + assembly slice is ready for RunControlView (95-03) to consume identically — same serviceId/org resolution, initial-load watch, WR-02 gate, and read-only assembly — without inheriting the output-window wake-lock/fullscreen/cursor/channel/unsubscribeAll machinery.

## Self-Check: PASSED

- FOUND: src/composables/useServiceAssembly.ts
- FOUND commit b71daca2 (Task 1)
- FOUND commit 62a00c48 (Task 2)

---
*Phase: 95-run-control-screen*
*Completed: 2026-08-28*
