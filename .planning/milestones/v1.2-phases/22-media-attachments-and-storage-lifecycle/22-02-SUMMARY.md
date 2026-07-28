---
phase: 22-media-attachments-and-storage-lifecycle
plan: 02
subsystem: media
tags: [vue-component, html5-media, autoplay-policy, slideshow-preview]

# Dependency graph
requires:
  - phase: 22-media-attachments-and-storage-lifecycle
    plan: 22-01
    provides: "SlideBase.audioUrl?/videoUrl? render carriers, assembleSlideshow first-slide media propagation"
provides:
  - "AudioPlayer.vue — reusable <audio> component, no-loop, autoplay-block play affordance"
  - "VideoPlayer.vue — reusable <video> component (MP4/WebM/MOV), no-loop, muted-autoplay retry then affordance"
  - "SlideshowPreview media rendering on preview cards carrying audioUrl/videoUrl"
affects: [22-03, 22-04, phase-23-presentation-preview-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled HTML5 <audio>/<video> components (no third-party player library) — imperative play()/pause() via defineExpose, native play/pause/ended/error DOM events re-emitted as component events"
    - "Autoplay-block handling: catch play() rejection, branch on DOMException.name === 'NotAllowedError', emit 'autoplay-blocked' distinctly from other errors (which rethrow)"
    - "Explicit emit('play') inside the play() success path (in addition to the native @play listener) so imperative callers get a signal even when the underlying media element is a test double that doesn't dispatch native events"

key-files:
  created:
    - src/components/AudioPlayer.vue
    - src/components/VideoPlayer.vue
    - src/components/__tests__/AudioPlayer.test.ts
    - src/components/__tests__/VideoPlayer.test.ts
  modified:
    - src/components/SlideshowPreview.vue
    - src/components/__tests__/SlideshowPreview.test.ts

key-decisions:
  - "VideoPlayer's muted-retry-then-affordance ladder emits 'autoplay-blocked' in BOTH outcomes (muted-success and still-rejected) — the event means 'unmuted/attended playback did not happen as requested', and the driving layer (Phase 23) distinguishes the two outcomes by checking the element's own muted state / affordance visibility, not by a second event type."
  - "Explicit emit('play') is fired from inside play() on success, in addition to binding the native @play DOM listener — real browsers dispatch a native 'play' event when play() resolves, but jsdom test doubles for HTMLMediaElement.play() do not, so the explicit emit guarantees Phase 23's imperative play-on-entry driver always observes the signal regardless of runtime."
  - "SlideshowPreview mounts players unconditionally with no autoplay in the preview list (matches T-22-02-02 DoS mitigation: preload='none' + no autoplay attribute means N media cards never eagerly fetch N files) — the preview is for confirming an attachment exists and is playable, not for driving playback."

patterns-established:
  - "Any future slot-scoped media type addition (e.g., a third player kind) should mirror the AudioPlayer/VideoPlayer play()/pause() + autoplay-blocked contract rather than inventing a new event vocabulary, so Phase 23's driver can treat all player kinds uniformly."

requirements-completed: [R013, R014]

coverage:
  - id: D1
    description: "AudioPlayer renders <audio> with the passed src, preload='none', no loop; play() (mocked resolve) emits play; play() rejected with NotAllowedError emits autoplay-blocked and reveals the play affordance; native ended re-emits as component ended"
    requirement: "R013"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "VideoPlayer renders <video> with the passed src, preload='none', playsinline, no loop; play() (mocked resolve) emits play; play() rejected once with NotAllowedError then resolved sets the muted DOM property and emits autoplay-blocked; play() always rejected emits autoplay-blocked and reveals the play affordance; native ended re-emits as component ended"
    requirement: "R014"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SlideshowPreview renders an AudioPlayer for a slide with audioUrl and a VideoPlayer for a slide with videoUrl (sourced from the correct URL), and neither player wrapper for a slide with no media (still showing its own text/image content)"
    requirement: "R013, R014"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlideshowPreview.test.ts — 'renders an AudioPlayer for a slide with audioUrl and a VideoPlayer for a slide with videoUrl, and neither for a slide with no media'"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-07-25
status: complete
---

# Phase 22 Plan 02: AudioPlayer + VideoPlayer + SlideshowPreview media rendering Summary

**Hand-rolled AudioPlayer/VideoPlayer Vue components with a strict no-loop/stop-at-end contract and graceful browser-autoplay-policy fallback (muted-retry for video, play affordance for audio), wired into SlideshowPreview so assembled slides carrying `audioUrl`/`videoUrl` render playable media on preview cards.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-25T12:52:00Z (approx.)
- **Completed:** 2026-07-25T17:00:33Z
- **Tasks:** 3
- **Files modified:** 6 (4 new, 2 modified)

## Accomplishments
- `AudioPlayer.vue`: renders an `<audio>` bound to `src` with `controls`, `preload="none"`, and NEVER a `loop` attribute (R013 stop-at-end). Exposes `play()`/`pause()` via `defineExpose`; on a `NotAllowedError` rejection from `play()`, emits `autoplay-blocked` and reveals a `data-testid="audio-play-affordance"` button for a user-gesture retry. Native `ended`/`error` events re-emit as component events.
- `VideoPlayer.vue`: renders a `<video>` bound to `src` with `controls`, `preload="none"`, `playsinline`, and NEVER `loop` — sources MP4/WebM/MOV via native HTML5 video (no codec transcoding). On a `NotAllowedError` rejection, sets the element `muted` DOM property and retries `play()` once; if the muted retry succeeds it plays silently (still emits `autoplay-blocked` to signal degraded/muted playback to the driving layer); if the muted retry also rejects, reveals a `data-testid="video-play-affordance"` button.
- `SlideshowPreview.vue`: each preview-slide card now conditionally renders a compact `VideoPlayer` (wrapped in `data-testid="preview-slide-video"`) when `assembled.slide.videoUrl` is truthy, and a compact `AudioPlayer` (`data-testid="preview-slide-audio"`) when `assembled.slide.audioUrl` is truthy — placed below the existing text/image content so the slide's own content is always visible. Cards with neither field render no player wrapper (graceful no-media path). No autoplay in the scrolling preview list.
- 17 new/extended component tests across the three files prove the no-loop DOM contract, the play()/autoplay-blocked event lifecycle for both players, and the media-conditional rendering in SlideshowPreview — all pass, and `npm run type-check` stays at 0 errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: AudioPlayer.vue with no-loop + graceful autoplay-block handling** — RED `838ca0a` (test), GREEN `96427b2` (feat)
2. **Task 2: VideoPlayer.vue with MP4/WebM/MOV support + muted-autoplay fallback** — RED `cd04c9f` (test), GREEN `d4348a8` (feat)
3. **Task 3: Render attached media in SlideshowPreview** — `7a901fc` (feat; not a TDD task per plan)

## Files Created/Modified
- `src/components/AudioPlayer.vue` — new: `<audio>` playback component; props `src`/`label?`; emits `play`/`pause`/`ended`/`error`/`autoplay-blocked`; `defineExpose({ play, pause })`
- `src/components/VideoPlayer.vue` — new: `<video>` playback component; props `src`/`poster?`; muted-retry ladder on autoplay rejection; same event/expose contract as AudioPlayer
- `src/components/__tests__/AudioPlayer.test.ts` — new: 4 tests (DOM attributes, play() success emit, NotAllowedError → autoplay-blocked + affordance, native ended re-emit)
- `src/components/__tests__/VideoPlayer.test.ts` — new: 5 tests (DOM attributes incl. playsinline, play() success emit, muted-retry-then-success path, always-rejected → affordance path, native ended re-emit)
- `src/components/SlideshowPreview.vue` — imports and conditionally renders `AudioPlayer`/`VideoPlayer` per preview-slide card based on `assembled.slide.audioUrl`/`videoUrl`
- `src/components/__tests__/SlideshowPreview.test.ts` — extended: 1 new test asserting audio/video player presence + correct `src` wiring, and no player wrapper (with content still shown) for a media-less slide; added a `beforeEach` stubbing `HTMLMediaElement.prototype.play`/`pause` for jsdom

## Decisions Made
- VideoPlayer's autoplay-fallback ladder treats "muted retry succeeded" and "muted retry also rejected" as the same `autoplay-blocked` event — the event semantically means "unattended/unmuted playback did not happen"; the driving layer distinguishes the two outcomes by observing element `muted` state or affordance visibility rather than a second event name, keeping the event vocabulary shared with AudioPlayer.
- Both players explicitly `emit('play')` from inside the `play()` method on success, in addition to binding the native `@play` DOM listener. Real browsers dispatch a native `play` event when `.play()` resolves, but the `HTMLMediaElement.prototype.play` test doubles used here (and any other synthetic caller) do not — the explicit emit guarantees Phase 23's imperative play-on-entry driver always observes the signal.
- `SlideshowPreview`'s test assertion for the `muted` state (video muted-retry test) checks the DOM property (`(el as HTMLVideoElement).muted`) rather than the `muted` HTML attribute — Vue sets `muted` on media elements via the IDL property (not a reflected attribute), matching Vue's `shouldSetAsProp` heuristic for media elements.
- Media players are mounted with no autoplay and `preload='none'` in the scrolling preview list (T-22-02-02 DoS mitigation carried over from the plan's threat model) — the preview proves an attachment exists and is playable; it does not drive playback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a test assertion that checked the wrong DOM surface for `muted`**
- **Found during:** Task 2 GREEN run
- **Issue:** The written test asserted `wrapper.find('video').attributes('muted')` to be defined after the muted-retry path, but Vue sets `muted` on `<video>`/`<audio>` elements as a DOM (IDL) property rather than a reflected HTML attribute — the assertion returned `undefined` even though the component was setting `muted` correctly.
- **Fix:** Changed the assertion to read `(wrapper.find('video').element as HTMLVideoElement).muted` instead of the attribute.
- **Files modified:** `src/components/__tests__/VideoPlayer.test.ts`
- **Commit:** `d4348a8`

No other deviations — Tasks 1 and 3 executed exactly as planned.

## Issues Encountered
None. `npm run type-check` was 0 errors after every task; only the changed component test files were run (`npx vitest run <file>`), per the environment constraint against running the full suite or touching the emulator.

## User Setup Required
None — no new packages, no external service configuration. Both components use only native HTML5 media elements.

## Next Phase Readiness
- `AudioPlayer`/`VideoPlayer` are unit-tested, exposed via `play()`/`pause()`, and emit the full `play`/`pause`/`ended`/`error`/`autoplay-blocked` lifecycle — Phase 23's presentation-preview play-on-entry driver can consume these directly with no further player-level work.
- `SlideshowPreview` now visually confirms attached media in the editor's slide list, ready for 22-04's slide-editor attachment UI to reuse the same two components for in-editor preview/upload confirmation.
- No blockers. `npm run test:rules` from 22-01 remains outstanding (unrelated to this plan) — flagged in that plan's SUMMARY for a human/later agent once the shared emulator is free.

---
*Phase: 22-media-attachments-and-storage-lifecycle*
*Completed: 2026-07-25*

## Self-Check: PASSED

All created/modified files found on disk; all 5 task commit hashes (838ca0a, 96427b2, cd04c9f, d4348a8, 7a901fc) found in git log.
