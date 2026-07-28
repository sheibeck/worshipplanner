---
phase: 23-presentation-preview-mode
plan: 01
subsystem: ui
tags: [vue, media-playback, autoplay-policy, presentation-mode]

# Dependency graph
requires:
  - phase: 22-media-attachments
    provides: AudioPlayer.vue and VideoPlayer.vue with imperative play()/pause() and autoplay-blocked handling
provides:
  - AudioPlayer/VideoPlayer chromeless rendering mode (no native controls, no panel chrome, no internal affordance button)
  - VideoPlayer isMuted accessor discriminating muted-retry success from hard autoplay block
  - VideoPlayer unmute() action for driving-layer "tap to unmute" affordance
affects: [23-02-presentation-viewer-shell, 23-03-presentation-media-driving, 23-04-entry-cta]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive boolean prop (chromeless?: boolean) toggling both a bound native attribute (:controls=\"!chromeless\") and a conditional wrapper class string, leaving default (prop-absent) rendering byte-identical"
    - "defineExpose with a computed ref for read-only state (isMuted) so proxyRefs unwraps it to a plain boolean at the template-ref call site"

key-files:
  created: []
  modified:
    - src/components/AudioPlayer.vue
    - src/components/VideoPlayer.vue
    - src/components/__tests__/AudioPlayer.test.ts
    - src/components/__tests__/VideoPlayer.test.ts

key-decisions:
  - "muted.value = false is set as the first statement of play()'s hard-failure branch (both attempts rejected), making isMuted the true discriminator between the two identical autoplay-blocked emissions per the locked STATE.md decision"
  - "unmute() never rethrows NotAllowedError — it restores muted=true and re-emits autoplay-blocked instead, matching play()'s existing convention of only rethrowing non-autoplay errors"

patterns-established:
  - "chromeless prop shape (optional boolean, bound :controls, conditional wrapper class, v-if tightened with && !chromeless) is now the template both AudioPlayer and VideoPlayer share — reusable if a third media-type player is ever added"

requirements-completed: [R016]

coverage:
  - id: D1
    description: "AudioPlayer accepts chromeless: true — omits native controls, omits wrapper panel classes, and suppresses its internal audio-play-affordance button while still emitting autoplay-blocked; default (no prop) rendering is unchanged"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts#chromeless: true mount has no controls attribute"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts#chromeless: true wrapper class does not contain the panel classes"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts#chromeless: true suppresses the internal play affordance on autoplay-blocked, default renders it"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts#default (no chromeless prop) mount still has the controls attribute"
        status: pass
    human_judgment: false
  - id: D2
    description: "VideoPlayer accepts chromeless: true — omits native controls, resizes to max-h-[80vh]/object-contain instead of max-h-48, omits wrapper panel classes, and suppresses video-play-affordance while still emitting autoplay-blocked; default rendering is unchanged"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#chromeless: true mount has no controls attribute"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#chromeless: true video class contains max-h-[80vh] and not max-h-48"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#chromeless: true wrapper class does not contain the panel classes"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#chromeless: true with a hard block emits autoplay-blocked but not video-play-affordance"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#default (no chromeless prop) mount still has the controls attribute"
        status: pass
    human_judgment: false
  - id: D3
    description: "VideoPlayer exposes isMuted, reading true after a SUCCEEDED muted retry and false after a hard block, genuinely discriminating the two identical autoplay-blocked emissions"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#exposes isMuted true after a muted retry SUCCEEDS"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#exposes isMuted false after both play attempts FAIL (hard block)"
        status: pass
    human_judgment: false
  - id: D4
    description: "VideoPlayer exposes unmute(), clearing the muted flag and re-attempting play(); on a further NotAllowedError it restores muted and re-emits autoplay-blocked instead of throwing"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#unmute() clears the muted flag and re-plays when play() resolves"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VideoPlayer.test.ts#unmute() re-blocks and re-emits autoplay-blocked when the re-attempt rejects with NotAllowedError"
        status: pass
    human_judgment: false
  - id: D5
    description: "SlideshowPreview's existing inline (non-chromeless) AudioPlayer/VideoPlayer usage is provably unregressed"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlideshowPreview.test.ts (full suite, 8 tests)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exit 0"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-25
status: complete
---

# Phase 23 Plan 01: Chromeless Media Players Summary

**AudioPlayer and VideoPlayer gained an additive `chromeless` rendering mode plus a `VideoPlayer.isMuted`/`unmute()` accessor pair — enabling the presentation viewer's projection-scale canvas and its tap-to-unmute affordance without touching the default (non-chromeless) SlideshowPreview rendering.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-25T18:18:21Z
- **Completed:** 2026-07-25T18:26:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `AudioPlayer.vue` accepts `chromeless?: boolean`: binds `:controls="!chromeless"`, conditionally strips the wrapper's panel Tailwind classes, and tightens `audio-play-affordance`'s `v-if` to `showPlayAffordance && !chromeless` — all while leaving the prop-absent path byte-identical.
- `VideoPlayer.vue` gets the same `chromeless` treatment plus projection-scale sizing (`max-h-[80vh] object-contain` vs the existing `max-h-48`).
- `VideoPlayer`'s hard-failure branch (both play attempts rejected) now clears `muted.value` before emitting `autoplay-blocked`, making the exposed `isMuted` computed a true discriminator between "muted retry succeeded" (`isMuted === true`, playing silently) and "hard block" (`isMuted === false`, nothing playing) — both cases previously emitted the identical event with no way to tell them apart.
- New `unmute()` async function clears the muted flag, re-attempts native `play()`, and on a further `NotAllowedError` restores the muted flag and re-emits `autoplay-blocked` rather than throwing — giving the future presentation-viewer's tap-to-unmute chip a real, safe action to call.
- `defineExpose` widened to `{ play, pause, isMuted: computed(() => muted.value), unmute }`; `proxyRefs` unwraps `isMuted` to a plain boolean at any template-ref call site.

## Task Commits

Each task followed the RED → GREEN TDD cycle with separate commits:

1. **Task 1: Add the chromeless rendering mode to AudioPlayer**
   - `bd223c7` (test) — failing tests for chromeless controls/panel-class/affordance-suppression
   - `96ea862` (feat) — chromeless prop, bound controls, conditional wrapper class, tightened affordance `v-if`
2. **Task 2: Add chromeless mode plus the muted-state accessor and unmute() to VideoPlayer**
   - `fe7a444` (test) — failing tests for chromeless rendering, `isMuted` discrimination, and `unmute()`
   - `e62986c` (feat) — chromeless prop/sizing, hard-failure `muted.value = false`, new `unmute()`, widened `defineExpose`

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/AudioPlayer.vue` - Additive `chromeless` prop; bound `:controls`, conditional wrapper class, affordance `v-if` guard
- `src/components/VideoPlayer.vue` - Additive `chromeless` prop/sizing; hard-failure `muted.value = false`; new `unmute()`; widened `defineExpose` with `isMuted` computed
- `src/components/__tests__/AudioPlayer.test.ts` - 4 new cases appended (default controls, chromeless no-controls, chromeless no-panel-class, chromeless suppresses affordance vs default renders it)
- `src/components/__tests__/VideoPlayer.test.ts` - 8 new cases appended (default/chromeless controls, chromeless sizing class, chromeless no-panel-class, `isMuted` true-after-success and false-after-hard-block, `unmute()` success and re-block paths, chromeless hard-block affordance suppression)

## Decisions Made
- `muted.value = false` placed as the FIRST statement of the existing hard-failure `catch` branch (before the `autoplay-blocked` emit), per the plan's exact instruction — leaves the muted-retry-success branch untouched (muted stays `true` there).
- `unmute()` mirrors `play()`'s existing convention: only `NotAllowedError` is swallowed (restoring muted + re-emitting); any other rejection rethrows.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `AudioPlayer`/`VideoPlayer` now expose everything plan 23-02 (viewer shell) and 23-03 (imperative media driving) need: `chromeless` for projection-canvas rendering, `isMuted`/`unmute()` for the two-affordance autoplay-blocked UI split.
- `SlideshowPreview.vue`'s existing inline (non-chromeless) usage is provably unregressed — full suite green, `npm run type-check` exit 0.
- No blockers for 23-02.

---
*Phase: 23-presentation-preview-mode*
*Completed: 2026-07-25*

## Self-Check: PASSED

All 4 modified files found on disk; all 4 task commits (`bd223c7`, `96ea862`, `fe7a444`, `e62986c`) found in git log.
