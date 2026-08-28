---
phase: 93-audience-output-window
plan: 02
subsystem: testing
tags: [vitest, jsdom, vue-test-utils, broadcastchannel, wakelock, fullscreen, presentation]

# Dependency graph
requires:
  - phase: 93-audience-output-window
    provides: AudienceOutputView.vue with injectable channelFactory prop (93-01)
  - phase: 91-config-channel-utilities
    provides: openRunChannel receive-only protocol with real stale-seq drop
provides:
  - Behavioral jsdom coverage locking R270/R271 for the audience output window
  - In-memory BroadcastChannelLike fake pattern (records posts, replays inbound state) for run-channel consumer tests
affects: [95-run-control-flow, 94-confidence-monitor, audience-output-window]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inject channelFactory prop → in-memory BroadcastChannelLike to drive onState and assert never-postState"
    - "Mount fullscreen (stubbed fullscreenElement) to hide the windowed-only re-enter affordance and isolate the pure-black gate"
    - "Per-test install/delete of navigator.wakeLock mirroring MonitorSetupView's window.* idiom"
    - "Dispatched fullscreenchange asserting the OPPOSITE of PresentationViewer: affordance renders, channel stays open"

# Key files
key-files:
  created:
    - src/views/__tests__/AudienceOutputView.test.ts
  modified: []

# Decisions
decisions:
  - "Mock useSlideshowAssembly + the services/auth stores (not real Firestore) so the suite is about THIS view's behavior; the injected fake drives currentSlide purely from the channel index."
  - "Stub SlideCanvas to a component that renders its slide id and exposes play/pause, so assertions read WHICH slide shows without the full canvas."
  - "The two pure-black gate tests mount fullscreen so the windowed-only re-enter affordance is hidden — otherwise its 'Re-enter fullscreen' copy is legitimately present and the 'no copy' assertion would (correctly) fail."

# Metrics
metrics:
  duration: ~12m
  completed: 2026-08-28
  tasks: 1
  files-created: 1
  files-modified: 0

status: complete
---

# Phase 93 Plan 02: Audience Output Window (Tests) Summary

Authored `src/views/__tests__/AudienceOutputView.test.ts` — 13 passing jsdom tests locking the R270/R271 behavior of the receive-only, chrome-free congregation output window built in 93-01, driven through the view's injectable `channelFactory` prop.

## What was built

A single behavioral suite against the REAL `AudienceOutputView.vue`:

- **Channel-driven index (2 tests):** an injected in-memory `BroadcastChannelLike` replays `{type:'state', index, seq}` into the view's real `openRunChannel`. An index selects the matching fake slide; a higher-seq state advances; a lower/stale seq is dropped by runChannel's real high-water-mark guard (not bypassed).
- **Receive-only handshake (2 tests):** `postHello` recorded on mount; `postState` NEVER recorded across mount → several inbound states → unmount; `close()` fired once on unmount.
- **No operator chrome + cursor (2 tests):** none of PresentationViewer's operator testids render, zero `<button>`s while fullscreen, and root `cursor: none` while fullscreen.
- **Pure-black gate (2 tests):** index null and out-of-range index both render no SlideCanvas and no copy (mounted fullscreen to hide the windowed re-enter affordance and isolate the gate).
- **Screen Wake Lock (2 tests):** with `navigator.wakeLock` present, `request('screen')` on mount and again on a dispatched `visibilitychange`→visible; with it absent, mount does not throw.
- **Fullscreen-loss recovery (3 tests):** affordance absent while fullscreen; losing fullscreen renders the `aria-label="Re-enter fullscreen"` affordance over the live slide WITHOUT calling `close()` or unmounting and restores `cursor: auto`; clicking it calls `requestFullscreen`.

## Deviations from Plan

None — plan executed exactly as written. One in-flight correction (not a plan deviation): the two pure-black tests initially asserted empty text while windowed, where the re-enter affordance's copy is legitimately present; mounting them fullscreen (the intended congregation state) hides the affordance and isolates the gate.

## Verification

- `npx vitest run src/views/__tests__/AudienceOutputView.test.ts` → **13 passed** (1 file).
- `npm run type-check` (vue-tsc --build) → **clean**, no errors.
- Bare `npx vitest run` → **162 files passed, 1 failed** — the failing file is exactly `src/storage.rules.test.ts` (the known Storage-emulator baseline per CLAUDE.md). No regression; the new file is among the passing 162.

## Deferred / HUMAN-UAT

Real fullscreen on a second physical monitor, actual Screen Wake Lock endurance over a service length, true chrome-free/cursor-free projection, and the re-enter affordance's findability from the booth — none provable by jsdom; deferred to the milestone-end UAT pass.

## Self-Check: PASSED

- FOUND: src/views/__tests__/AudienceOutputView.test.ts
- FOUND commit: 096990f2 (test(93-02): author AudienceOutputView.test.ts...)
