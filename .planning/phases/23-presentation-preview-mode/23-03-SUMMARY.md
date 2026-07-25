---
phase: 23-presentation-preview-mode
plan: 03
subsystem: ui
tags: [vue, presentation-viewer, media-playback, autoplay-blocked, graceful-degradation]

# Dependency graph
requires:
  - phase: 23-01
    provides: AudioPlayer/VideoPlayer chromeless mode, VideoPlayer isMuted accessor and unmute()
  - phase: 23-02
    provides: PresentationViewer.vue full-screen shell, per-slide-kind rendering, navigation/keyboard/chrome
provides:
  - PresentationViewer.vue media layer — chromeless AudioPlayer/VideoPlayer mounting driven imperatively across slide transitions, plus the three UI-SPEC degraded states (media-unavailable, audio/video hard-block affordance, muted-playing chip)
affects: [23-04-entry-cta]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "goToIndex(next) centralizes navigation: pauseCurrentMedia() -> resetMediaState() -> currentIndex write -> await nextTick() -> playCurrentMedia() — the pause-before-index-write ordering is the load-bearing part (T-23-08)"
    - "pauseCurrentMedia() called from onBeforeUnmount, not onUnmounted — Vue nulls child template refs via a post-flush callback queued before the parent's own onUnmounted runs, so onUnmounted would silently no-op"
    - "Autoplay-blocked discrimination via VideoPlayer's exposed isMuted accessor rather than a second event, per the locked STATE.md decision"
    - ":key=\"currentVideoUrl\" / :key=\"currentAudioUrl\" force a fresh player instance per URL so a slide-to-slide URL change never reuses (and never restarts) a still-playing element"

key-files:
  created: []
  modified:
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts

key-decisions:
  - "pauseCurrentMedia() moved from onUnmounted (as the plan's action text specified) to onBeforeUnmount — a real bug, not a style choice: Vue schedules child template-ref nulling as a post-flush callback queued before the parent's own onUnmounted fires, so calling audioRef.value?.pause()/videoRef.value?.pause() inside onUnmounted was observably a no-op (caught by the 'unmounting the viewer calls pause' test, which failed until moved)."
  - "bodyIsCaption's text-2xl/text-5xl swap applies to the lyric, scripture (non-congregational), and text-slide presentation-body elements only — NOT the copyright slide's title, which is the 60px Display role (text-6xl), a distinct typography tier from the 48px Body role UI-SPEC describes dropping to a caption. The assembler also never attaches media to a copyright slide (media attaches to the first slide emitted per slot, which for a SONG slot is a lyric slide), so this case is not reachable in practice; documented here since the plan's action text said 'every kind branch' without carving out Display explicitly."
  - "A single mediaFailed flag per slide (not per audio/video element) — the planner's own recorded assumption, adopted verbatim: the first error from either player removes both wrappers and shows one 'Media unavailable' notice."

requirements-completed: [R016]

coverage:
  - id: D1
    description: "A slide with videoUrl renders presentation-video containing a chromeless VideoPlayer with the correct src; a slide with audioUrl renders presentation-audio containing a chromeless AudioPlayer occupying no layout space (zero-size wrapper); a slide with neither renders neither wrapper"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#media playback (3 mount/render cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mounting on a media-carrying first slide calls play() once after the DOM settles; advancing (forward or back) pauses the outgoing player BEFORE playing the incoming one (ordered call log); advancing onto a media-less sibling pauses and issues no further play"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#media playback (4 ordering cases)"
        status: pass
      - kind: static
        ref: "grep confirms pauseCurrentMedia() is the first statement in goToIndex, before the currentIndex write"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking presentation-exit and unmounting the viewer both call pause()"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#clicking presentation-exit calls pause / #unmounting the viewer calls pause"
        status: pass
    human_judgment: false
  - id: D4
    description: "A video-carrying slide renders presentation-body at the Label role (text-2xl), not Body (text-5xl); an audio-only slide keeps text-5xl"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#a video-carrying slide renders presentation-body at text-2xl..."
        status: pass
    human_judgment: false
  - id: D5
    description: "A media error removes the player from the canvas, shows the exact 'Media unavailable' gray-500 notice (not bound to chrome auto-hide), leaves the slide's own text/image rendering unchanged, and does not block navigation"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts (4 cases: video error, audio error, nav-still-works, notice-survives-idle-timer)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Autoplay-blocked audio shows 'Tap to play audio' and a click retries play(); a video whose muted retry succeeded (isMuted true) shows the amber 'Playing muted — tap to unmute' chip (not the full affordance) and clicking it unmutes; a video whose muted retry also failed (isMuted false) shows 'Tap to play video' (not the chip)"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts (3 cases covering all three affordance/chip branches)"
        status: pass
      - kind: static
        ref: "grep -c '\\$refs' = 0 (isMuted read via the exposed accessor, never child internals); all four exact copy strings present"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every per-slide media flag (mediaFailed, audioBlocked, videoBlocked, videoMutedPlaying) resets on slide change so one slide's degraded state never leaks onto the next"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#advancing to the next slide clears every degraded-state flag"
        status: pass
      - kind: static
        ref: "resetMediaState() called from goToIndex, immediately after pauseCurrentMedia() and before the currentIndex write"
        status: pass
    human_judgment: false
  - id: D8
    description: "npm run type-check exits 0; the full component test scope (PresentationViewer + AudioPlayer/VideoPlayer/SlideshowPreview) stays green; no v-html anywhere"
    requirement: "R016"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exit 0"
        status: pass
      - kind: unit
        ref: "npx vitest run src/components/__tests__/ — 58 files, 714 tests, all passing"
        status: pass
      - kind: static
        ref: "grep -c 'v-html' src/components/PresentationViewer.vue = 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "Rapid key-repeat through several media-carrying slides — full timing-interleaving coverage is a documented backstop, not exhaustively enumerated"
    requirement: "R016"
    verification: []
    human_judgment: true
    human_judgment_note: "Per the plan's own must_haves.truths backstop entry: hold the advance key through a run of real media slides in a browser to verify no double-audio interleaving. Unit tests cover single-step ordering (pause logged before play) but not exhaustive rapid-repeat timing."

duration: 20min
completed: 2026-07-25
status: complete
---

# Phase 23 Plan 03: PresentationViewer Media Playback Layer Summary

**Layered chromeless AudioPlayer/VideoPlayer instances into `PresentationViewer.vue`, driven imperatively across slide transitions (pause-before-advance, never a native autoplay attribute), with the three UI-SPEC degraded states — missing media, hard-blocked autoplay, and silently-playing-muted — discriminated via VideoPlayer's exposed `isMuted` accessor.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-25T19:00:00Z
- **Tasks:** 2 completed (combined into one commit — see Deviations)
- **Files modified:** 2

## Accomplishments

- `PresentationViewer.vue` mounts a chromeless `VideoPlayer`/`AudioPlayer` whenever the current slide carries `videoUrl`/`audioUrl`, each keyed on its URL so a slide-to-slide URL change forces a fresh instance rather than reusing (and restarting) a playing one.
- `goToIndex(next)` is now the single navigation entry point: it calls `pauseCurrentMedia()` and `resetMediaState()` BEFORE writing `currentIndex`, then `await nextTick()`, then `playCurrentMedia()` — pausing the outgoing slide's media before the show advances is the documented mitigation for T-23-08 (no two audio/video tracks can ever play at once).
- Video-carrying slides give the video the dominant screen real estate; the slide's own text drops from the 48px Body role to the 24px Label caption role (`bodyIsCaption`), applied to the lyric/scripture/text kind branches (not the copyright slide's 60px Display-role title — see Decisions).
- A media `error` event sets `mediaFailed`, which removes the player from the canvas and renders a fixed `gray-500` "Media unavailable" notice that is deliberately NOT bound to the chrome auto-hide opacity class, so it stays visible even when the volunteer has stepped away; navigation is never blocked.
- `onVideoAutoplayBlocked()` reads `videoRef.value?.isMuted` to tell apart the muted-retry-succeeded case (amber "Playing muted — tap to unmute" corner chip) from the hard-block case ("Tap to play video" centered affordance) — both share VideoPlayer's single `autoplay-blocked` event, per the locked STATE.md decision.
- `onAudioAutoplayBlocked()` shows a centered "Tap to play audio" affordance; clicking either affordance calls the player's `play()` again with a user gesture.
- `resetMediaState()` zeroes all four per-slide flags (`mediaFailed`, `audioBlocked`, `videoBlocked`, `videoMutedPlaying`) on every `goToIndex` call, so no slide's degraded state leaks onto the next.
- 18 new Vitest cases (42 total, up from 24) cover mount/render, ordered pause-before-play across forward/back navigation, exit/unmount pause, the caption-vs-body typography swap, all three degraded states, and per-slide state reset.

## Task Commits

1. **Tasks 1 & 2 (combined — see Deviations below): mount/drive chromeless players and add graceful degradation**
   - `aeb6c88` (feat) — media layer + 18-case Vitest extension covering both tasks' behavior blocks

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/PresentationViewer.vue` (MODIFIED) — added `audioRef`/`videoRef` template refs, `currentAudioUrl`/`currentVideoUrl`/`bodyIsCaption` computeds, `pauseCurrentMedia`/`playCurrentMedia`/`resetMediaState`/`goToIndex`/`onMediaError`/`onVideoAutoplayBlocked`/`onAudioAutoplayBlocked`/`onUnmuteClick`, the video/audio mount blocks, the media-unavailable notice, and the three autoplay-blocked affordances
- `src/components/__tests__/PresentationViewer.test.ts` (MODIFIED) — added `videoSlide`/`audioSlide` fixture builders and two new `describe` blocks (`media playback`, `media degradation`) totaling 18 new cases

## Decisions Made

- **`pauseCurrentMedia()` moved from `onUnmounted` to `onBeforeUnmount`.** The plan's action text specified `onUnmounted`, but this was a real bug, not a style preference: Vue nulls a component's child template refs via a post-flush callback that gets queued BEFORE the parent's own `onUnmounted` hook runs, so `audioRef.value?.pause()` / `videoRef.value?.pause()` inside `onUnmounted` was observably a no-op — caught immediately by the "unmounting the viewer calls pause" test, which failed until the call moved to `onBeforeUnmount` (which runs synchronously, top-down, before any ref teardown). Auto-fixed per Rule 1.
- **`bodyIsCaption`'s Label/Body swap applies to lyric, scripture (non-congregational), and text-slide body elements — not the copyright slide's Display-role title.** The plan's action text said "this applies to every kind branch's body element," but the copyright title is the declared 60px Display role (`text-6xl`), a distinct typography tier from the 48px Body role UI-SPEC's video-dominant-layout rule describes downgrading to a Label caption. Converting Display to Label for a copyright slide has no UI-SPEC basis and is not reachable in practice (the Phase 20/22 assembler attaches media to the FIRST slide emitted per slot, which for a SONG slot is a lyric slide, never the copyright/credit slide). Documented rather than silently applied to avoid an unintended typography regression on the one slide kind that is genuinely a different scale.
- **One `mediaFailed` flag per slide, not per element** — the plan's own recorded planner assumption, adopted verbatim: the first `error` from either player removes both wrappers and shows a single notice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pauseCurrentMedia()` in `onUnmounted` was a silent no-op**
- **Found during:** Task 1, first test run of "unmounting the viewer calls pause"
- **Issue:** Vue queues child template-ref nulling as a post-flush callback ahead of the parent component's own `onUnmounted` hook in the same flush batch, so by the time `PresentationViewer`'s `onUnmounted` ran, `videoRef.value`/`audioRef.value` were already `null` and the `pause()` calls silently did nothing.
- **Fix:** Moved the `pauseCurrentMedia()` call to a new `onBeforeUnmount` hook, which runs synchronously and top-down before any ref teardown; `onUnmounted` retains its original listener/timer cleanup.
- **Files modified:** `src/components/PresentationViewer.vue`
- **Commit:** `aeb6c88` (fixed before the GREEN run, folded into the same commit)

### Process deviation (not a code defect)

**Task 1 and Task 2 landed in a single commit rather than two**, following the same precedent set by plan 23-02's own summary. Both tasks modify the exact same two files (`PresentationViewer.vue`'s template/script, `PresentationViewer.test.ts`) and Task 2's degraded-state tests reuse Task 1's `videoSlide`/`audioSlide` fixtures and mounted-player markup directly — splitting them into two isolated RED→GREEN cycles would have required either duplicating those fixtures or committing a Task 1 state where the video/audio wrappers exist but the gating (`!mediaFailed`) and event handlers referenced by Task 1's own template bindings (`@error`, `@autoplay-blocked`, `@play`) don't exist yet, which would leave Task 1's own commit non-functional in isolation. The component was written once covering both tasks' `<action>` blocks in full, then all 18 new test cases were written and run together (initial run: 1 failure, the `onBeforeUnmount` bug above, fixed before commit). Every acceptance-criteria grep check and `npm run type-check` were run and passed before committing. No task's behavior, prohibition, or acceptance criterion was skipped or weakened by this combination.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced by this plan.

## Threat Flags

None — this plan's new surface (media `error`/`autoplay-blocked` event wiring) is exactly the surface the plan's own `<threat_model>` already registers (T-23-07, T-23-08, T-23-09), all mitigated as specified: the error handler renders only the fixed literal "Media unavailable" (no URL/Event/exception text interpolated), `pauseCurrentMedia()` runs before every index change/exit/unmount with no retry loop, and `isMuted` is read via the exposed accessor with zero `$refs` occurrences (grep-verified).

## Issues Encountered

None beyond the `onBeforeUnmount` timing bug documented above (caught and fixed pre-commit).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `PresentationViewer.vue`'s media layer is complete and self-contained; ready for plan 23-04 to mount the viewer from `ServiceEditorView` behind the "Present Slideshow" CTA with no further changes needed to this file's media behavior.
- No blockers for 23-04.
- Human-verify item carried forward per the plan's own backstop truth: rapid key-repeat through several real media-carrying slides in a real browser, to confirm no timing interleaving between an in-flight `play()` promise and a subsequent `pause()` ever leaves two tracks playing — out of jsdom unit-test scope by design.

---
*Phase: 23-presentation-preview-mode*
*Completed: 2026-07-25*

## Self-Check: PASSED

`src/components/PresentationViewer.vue` and `src/components/__tests__/PresentationViewer.test.ts` both found on disk with the expected content; commit `aeb6c88` found in git log; `npx vitest run src/components/__tests__/PresentationViewer.test.ts` (42/42) and the full `src/components/__tests__/` scope (714/714) both pass; `npm run type-check` exits 0.
