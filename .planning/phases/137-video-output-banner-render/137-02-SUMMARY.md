---
phase: 137-video-output-banner-render
plan: 02
subsystem: ui
tags: [vue, video-output, run-mode, useContainScale, localStorage, chroma-key]

# Dependency graph
requires:
  - phase: 137-01
    provides: "MediaAttachableSlot.videoOutput?.mode schema field + SlidesTab authoring control + autosave persistence"
  - phase: 136
    provides: "Shared FullscreenSlideOutput.vue render (role/testid parameterized), useOutputWindow lifecycle"
provides:
  - "Video-only banner (lower-third) render branch on FullscreenSlideOutput.vue"
  - "wp:videoKeyColor:v1 per-device localStorage setting (transparent-default + solid key-color fallback)"
  - "Monitor Setup 'Video output background' card (visible only when a monitor has role 'video')"
  - "useOutputWindow exposing localService (the slot array) for banner-mode resolution"
affects: [video-output, monitor-setup, run-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second, smaller useContainScale({refW,refH}) region alongside a primary one, for a sub-frame band (not just full-stage fits)"
    - "Inline :style array override ([rootStyle, additionalStyle]) so a class default (bg-black) stays untouched for every branch except the one new additive mode"
    - "Untrusted-localStorage-read validation guard (strict regex) before interpolating a stored value into inline CSS — mirrors T-91-01/T-114-01"

key-files:
  created:
    - src/components/output/__tests__/FullscreenSlideOutput.banner.test.ts
  modified:
    - src/utils/monitorConfig.ts
    - src/utils/__tests__/monitorConfig.test.ts
    - src/views/MonitorSetupView.vue
    - src/composables/useOutputWindow.ts
    - src/components/output/FullscreenSlideOutput.vue

key-decisions:
  - "Key-color setting stored per-device (localStorage), sibling of MONITOR_CONFIG_STORAGE_KEY — mirrors the existing device-local reasoning for monitor role mappings (chroma-key is a physical video-room compositor property)."
  - "Root keeps its bg-black CLASS unconditionally; banner mode's transparent/key-color background is an INLINE override appended via a computed in the :style array, so the fullscreen/non-video render path carries zero new markup or conditions."
  - "Key-color setting is read once at component setup (not a live storage-event listener) — the output window opens fresh per launch, so a mid-session live-sync was unnecessary complexity for this phase."

requirements-completed: [R427]

coverage:
  - id: D1
    description: "Video output renders a banner-flagged slide fit to a bottom lower-third band (28% height, 1280x200 useContainScale region, 64px/16px/12px title-safe inset) instead of full-screen"
    requirement: R427
    verification:
      - kind: unit
        ref: "src/components/output/__tests__/FullscreenSlideOutput.banner.test.ts#renders SlideCanvas inside video-banner-band (not video-stage) with an inline transparent background"
        status: pass
    human_judgment: false
  - id: D2
    description: "Banner mode's non-content region is transparent by default (inline background: transparent, not bg-black)"
    requirement: R427
    verification:
      - kind: unit
        ref: "src/components/output/__tests__/FullscreenSlideOutput.banner.test.ts#renders SlideCanvas inside video-banner-band (not video-stage) with an inline transparent background"
        status: pass
    human_judgment: false
  - id: D3
    description: "Configurable solid key-color fallback (default magenta #FF00FF) replaces transparent when enabled, persisted per-device and validated on read"
    requirement: R427
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#saveVideoKeyColor / loadVideoKeyColor (R427)"
        status: pass
      - kind: unit
        ref: "src/components/output/__tests__/FullscreenSlideOutput.banner.test.ts#renders the root inline background as the stored colorHex when key-color is enabled"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full-screen (unflagged or mode:'fullscreen') and every non-video role render exactly as Phase 136 — no inline background override, pure-black root"
    requirement: R427
    verification:
      - kind: unit
        ref: "src/components/output/__tests__/FullscreenSlideOutput.banner.test.ts#FullscreenSlideOutput — Video fullscreen path unchanged (R427)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts (unedited, all pass)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/VideoOutputView.test.ts (unedited, all pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Key-color card in MonitorSetupView discoverable only when a live monitor has role 'video' assigned"
    requirement: R427
    verification:
      - kind: unit
        ref: "src/views/__tests__/MonitorSetupView.test.ts (existing suite, all 19 pass with the new card present)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual/functional appearance of the banner over live video, key-color chroma-keying with real OBS/vMix, and legibility against unpredictable live-video brightness"
    human_judgment: true
    rationale: "Requires a real software compositor (OBS/vMix Browser Source) and camera feed to observe the transparent alpha channel / chroma-key result — outside unit-test/jsdom reach. Deferred UAT per autonomous-mode instruction (v2.14 milestone-end batch)."

# Metrics
duration: 55min
completed: 2026-09-07
status: complete
---

# Phase 137 Plan 02: Video Output Banner Render + Key-Color Setting Summary

**Video-only lower-third banner render (transparent-default, 1280×200 useContainScale band with title-safe inset) plus a validated per-device `wp:videoKeyColor:v1` key-color fallback surfaced in Monitor Setup**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-07T21:42:00Z
- **Tasks:** 2
- **Files modified:** 5 modified, 1 created

## Accomplishments
- `FullscreenSlideOutput.vue` now renders a Video-only banner branch: when `role === 'video'` and the current slide's slot has `videoOutput.mode === 'banner'`, SlideCanvas mounts inside a bottom lower-third band (28% frame height, a second `useContainScale({refW:1280, refH:200})` region, 64px horizontal / 16px top / 12px bottom title-safe inset) instead of the full-stage.
- The banner's non-content region is transparent by default (`background: transparent`, not `bg-black`) so a software compositor (OBS/vMix Browser Source) can show live video behind the slide; an opt-in solid key-color fallback (default magenta `#FF00FF`) replaces it when enabled.
- Added `saveVideoKeyColor`/`loadVideoKeyColor` to `monitorConfig.ts`, persisting `wp:videoKeyColor:v1` device-locally with a validated read (strict `^#[0-9a-fA-F]{6}$` hex guard rejects a malformed/injected `colorHex` back to the default — T-137-01).
- Added the "Video output background" card to `MonitorSetupView.vue`, visible only when a live monitor has role `'video'` assigned.
- `useOutputWindow.ts` now additionally exposes `localService` so the render can resolve `localService.slots[currentSlide.slotIndex]?.videoOutput?.mode` — the same resolution path `useRunControl.currentLoopSlot()` uses for `loop`.
- Full-screen (the default) and every non-video role are unchanged from Phase 136: the pre-existing `AudienceOutputView.test.ts` and `VideoOutputView.test.ts` suites are byte-identical (unedited) and stay green.

## Task Commits

Each task was executed as an RED→GREEN TDD pair:

1. **Task 1: Add the per-device key-color setting (storage + Monitor Setup card)**
   - `9dcc6b4f` test(137-02): add failing tests for video key-color storage (R427)
   - `8e649800` feat(137-02): add per-device video key-color setting + Monitor Setup card (R427)
2. **Task 2: Render the Video-only banner branch in FullscreenSlideOutput**
   - `20dc52b7` test(137-02): add failing tests for the Video banner render branch (R427)
   - `d30e2194` feat(137-02): render the Video-only banner branch on FullscreenSlideOutput (R427)

_Both tasks were TDD-gated: RED confirmed by running the new test file against the pre-implementation source (9 storage-test failures for Task 1; 2 of 7 banner-render-test failures for Task 2), then GREEN confirmed by re-running after implementation._

## Files Created/Modified
- `src/utils/monitorConfig.ts` - `VIDEO_KEY_COLOR_STORAGE_KEY`, `VideoKeyColor` interface, `saveVideoKeyColor`/`loadVideoKeyColor` (never-throw, validated read)
- `src/utils/__tests__/monitorConfig.test.ts` - coverage for round-trip, malformed-colorHex rejection, throwing-storage no-op
- `src/views/MonitorSetupView.vue` - "Video output background" card (checkbox + color picker), gated on `hasVideoRoleAssigned`
- `src/composables/useOutputWindow.ts` - additionally returns `localService`
- `src/components/output/FullscreenSlideOutput.vue` - `isVideoBanner`/`currentSlideVideoOutputMode` computeds, banner band markup + second `useContainScale` region, `bannerBackgroundStyle` inline override
- `src/components/output/__tests__/FullscreenSlideOutput.banner.test.ts` - new behavioral suite (7 tests) for the banner branch

## Decisions Made
- Key-color setting stored per-device (localStorage `wp:videoKeyColor:v1`), sibling of `MONITOR_CONFIG_STORAGE_KEY` — matches the existing device-local reasoning for monitor role mappings.
- Root's `bg-black` class stays unconditional; only banner mode appends an inline `background` override via the `:style` array, so the fullscreen/non-video path carries zero new markup or conditions (verified byte-identical via the unedited Audience/Video suites staying green).
- Key-color read once at component setup rather than a live `storage`-event listener — the output window opens fresh per launch, so live-sync was unnecessary for this phase (explicitly discretionary per plan).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Deferred UAT

Per the autonomous/UAT-deferred instruction for this run, the following human-visual checks are deferred to end-of-milestone owner UAT (not blocking, not appended to a separate deferred-verification file per this plan's specific instruction):
- Visual appearance of the banner over a real live camera feed via OBS/vMix Browser Source (transparent alpha channel behaving as expected).
- Chroma-keying the solid magenta fallback color in a real downstream tool.
- Legibility of banner text against unpredictable real-world video brightness/color (the UI-SPEC's explicitly-accepted backstop — no contrast guarantee is made this phase).

## User Setup Required

None - no external service configuration required. The key-color setting is a pure client-side localStorage control discoverable in Monitor Setup once a monitor is assigned the Video role.

## Next Phase Readiness

This is the final plan of v2.14 (Phases 131-137). All R406-R427 requirements are now code-complete:
- `npm run type-check` clean (vue-tsc --build, includes test files).
- Full app suite: 224/225 files pass; the sole failing file (`src/storage.rules.test.ts`) is the documented pre-existing Storage-emulator-dependent baseline failure (CLAUDE.md), unrelated to this plan.
- Milestone-end batched human UAT (hardware/visual, incl. the Deferred UAT items above) remains outstanding before v2.14 can be marked verified/closed.

---
*Phase: 137-video-output-banner-render*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 6 created/modified files found on disk; all 4 task commit hashes (`9dcc6b4f`, `8e649800`, `20dc52b7`, `d30e2194`) found in git log.
