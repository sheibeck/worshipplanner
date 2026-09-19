---
phase: quick-260919-k9j
plan: 01
subsystem: ui
tags: [vue, run-the-service, tdd, accessibility]

# Dependency graph
requires:
  - phase: 141-vamp-slide-assignment-live-playback
    provides: single-audio-owner AudioPlayer model in RunControlView (audioArmed/tryPlayAudio/toggleAudioArmed)
provides:
  - On-screen LIVE tag/ring in on-air red (matches header pill), amber "Rehearsing" untouched
  - Run session audio defaults On (watch(live) rising edge), toggle copy "Audio: Off / On"
  - Filmstrip end cap is a real, keyboard-focusable button wired to goByItem(1)
affects: [run-control, run-preview-pair, run-header, run-filmstrip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "watch(live) rising-edge watcher as the single wiring point for a session-start side effect that must run on BOTH go-live paths (rehearse() and finishOpen())"

key-files:
  created: []
  modified:
    - src/components/run/RunPreviewPair.vue
    - src/components/run/__tests__/RunPreviewPair.test.ts
    - src/components/run/RunHeader.vue
    - src/composables/useRunControl.ts
    - src/views/__tests__/RunControlView.audio.test.ts
    - src/components/run/RunFilmstrip.vue
    - src/components/run/__tests__/RunFilmstrip.test.ts
    - src/views/RunControlView.vue
    - src/views/__tests__/RunControlView.test.ts
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "Audio default-On mechanism: kept audioArmed = ref(false) and both teardown resets to false; added one watch(live) rising-edge handler (after the existing watch(blackout)) that arms + tryPlayAudio()s after nextTick — covers both rehearse() and finishOpen() go-live paths without touching either."
  - "Filmstrip end-cap div -> button kept the R331 dashed-box classes plus focus-visible:ring-indigo-400 (matching the thumb convention) and enabled:/disabled: state classes; disabled attribute is belt-and-braces with an early-return guard in the click handler."

patterns-established: []

requirements-completed: [R276, R331, R438, R439]

coverage:
  - id: D1
    description: "On-screen LIVE tag dot and pane ring render on-air red (bg-red-500/ring-red-500) when live and not rehearsing; amber unchanged while rehearsing; gray pre-live"
    requirement: "R276"
    verification:
      - kind: unit
        ref: "src/components/run/__tests__/RunPreviewPair.test.ts#RunPreviewPair — On-screen LIVE tag/ring is on-air red (260919-k9j)"
        status: pass
    human_judgment: true
    rationale: "Visual color correctness on a real monitor is batched into the v2.15 deferred human UAT pass per the plan's <verification> section."
  - id: D2
    description: "Audio toggle reads Audio: On / Audio: Off; every session (rehearse or real go-live) starts with audio On and the live slide's play() fires with no click; blocked-play banner still works as the fallback"
    requirement: "R439"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.audio.test.ts#RunControlView — control-window audio (R438/R439, Phase 141)"
        status: pass
    human_judgment: true
    rationale: "Real-speaker / fresh-profile autoplay-block behavior is batched into the v2.15 deferred human UAT pass per the plan's <verification> section."
  - id: D3
    description: "Filmstrip end-of-item cap is a real <button> that emits next-item -> goByItem(1) on click (same result as ArrowDown), disabled with 'End of service' at the last item"
    requirement: "R331"
    verification:
      - kind: unit
        ref: "src/components/run/__tests__/RunFilmstrip.test.ts#RunFilmstrip — end-of-item cap (R331)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RunControlView.test.ts#RunControlView — in-item filmstrip jump + scaled next-up (R282/R276)"
        status: pass
    human_judgment: true
    rationale: "Mouse-click + Tab-focus-ring UAT on the real control window is batched into the v2.15 deferred human UAT pass per the plan's <verification> section."

# Metrics
duration: 15min
completed: 2026-09-19
status: complete
---

# Quick Task 260919-k9j: Run the Service fixes (on-screen LIVE dot, audio default-On, filmstrip end cap) Summary

**On-screen LIVE tag/ring switched from green to on-air red, Run session audio now defaults On with `watch(live)` firing playback with no click, and the filmstrip end cap became a real button wired to `goByItem(1)`.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-19T14:48:00-04:00 (first RED commit)
- **Completed:** 2026-09-19T14:59:00-04:00 (last GREEN commit)
- **Tasks:** 3
- **Files modified:** 9 source/test files + ARCHITECTURE.md

## Accomplishments
- The On-screen pane's `run-current-live-tag` dot and `run-current-preview` ring are on-air red (`bg-red-500` / `ring-red-500`) once truly live, matching the header's Live pill; amber "Rehearsing" and pre-live gray are unchanged.
- Audio now defaults On for every Run session: `useRunControl`'s new `watch(live)` rising-edge handler arms audio and calls `tryPlayAudio()` after `nextTick()`, covering both `rehearse()` and `finishOpen()` (real go-live). The header toggle reads `Audio: On` / `Audio: Off`; a manual Off is not remembered across End Service / End Rehearsal — the next session starts On again. The blocked-play banner (rejected `play()`) is unchanged as the fallback.
- The filmstrip's "End of item / Next: …" cap is a real `<button type="button">`: enabled and labelled `Go to next item: {label}` with a next item present (click emits `next-item` → `RunControlView`'s `@next-item="goByItem(1)"`, the same call ArrowDown makes); `disabled` and labelled `End of service` at the last item. It uses the thumbs' `focus:outline-none focus-visible:ring-indigo-400` convention.
- ARCHITECTURE.md's RunHeader, RunPreviewPair, and RunFilmstrip entries updated (one sentence each, or corrected stale GREEN wording) to describe the new behavior.

## Task Commits

Each task followed TDD (RED then GREEN):

1. **Task 1: On-screen LIVE tag + pane ring go on-air red** — `40c48537` (test, RED) / `12f4f209` (fix, GREEN)
2. **Task 2: Audio toggle reads Off / On, defaults ON per session** — `f9819717` (test, RED) / `d53635ca` (fix, GREEN)
3. **Task 3: Filmstrip end cap is a button wired to goByItem(1)** — `5cec29d7` (test, RED) / `b68fe07c` (fix, GREEN)

**Plan metadata:** committed separately by the orchestrator (docs commit not made by this executor per the quick-task constraints).

## Files Created/Modified
- `src/components/run/RunPreviewPair.vue` — dot/ring classes `bg-green-500`/`ring-green-500` → `bg-red-500`/`ring-red-500`; 4 comment touches (head comment, rehearse-mode comment, `live`/`rehearsing` prop docs)
- `src/components/run/__tests__/RunPreviewPair.test.ts` — new describe `On-screen LIVE tag/ring is on-air red (260919-k9j)`, 3 cases (live red, rehearsing amber, pre-live gray) + a `green-500` DOM-level negative assertion
- `src/components/run/RunHeader.vue` — toggle label/aria-label/prompt copy Off/Armed → Off/On; prop doc + two comment blocks updated; `run-audio-toggle--armed`/`--needed`/`aria-pressed`/testids unchanged
- `src/composables/useRunControl.ts` — added `watch(live, async (v) => {...})` directly after `watch(blackout, ...)` (arms audio + `tryPlayAudio()` after `nextTick()` on the live rising edge); updated `toggleAudioArmed` doc comment and both teardown reset comments; `audioArmed = ref(false)` and both `audioArmed.value = false` teardown resets left untouched
- `src/views/__tests__/RunControlView.audio.test.ts` — first describe rewritten in place (17 cases) to prove default-On go-live/rehearse, Off/On toggling, blocked-banner-on-default-On-play, exit-then-next-session-starts-On, and all other pre-existing behaviors (badges, blackout, media error, hello resend, slide-change reuse) — all still green
- `src/components/run/RunFilmstrip.vue` — end cap `<div>` → `<button type="button">` with `:disabled="!props.nextItemLabel"`, `:aria-label`, `onEndcapClick` handler, `next-item` emit, and the focus-visible/enabled/disabled Tailwind classes; R331 comment updated
- `src/components/run/__tests__/RunFilmstrip.test.ts` — 3 new cases in the `end-of-item cap (R331)` describe (enabled+emits, disabled+null, disabled+omitted)
- `src/views/RunControlView.vue` — `goByItem` added to the `useRunControl()` destructure; `@next-item="goByItem(1)"` added to `<RunFilmstrip>`; section comment amended
- `src/views/__tests__/RunControlView.test.ts` — 1 new case in `in-item filmstrip jump + scaled next-up (R282/R276)` proving the cap click posts the same index as ArrowDown (skipping the empty slot) and is inert/disabled at end of service
- `.planning/codebase/ARCHITECTURE.md` — RunHeader entry: corrected stale GREEN wording to RED (code was already red since 2026-09-08; only the doc was stale) + appended the R439 default-On sentence; RunPreviewPair entry: live-frame sentence updated to RED; RunFilmstrip entry: appended the R331 button/goByItem sentence

## Decisions Made
- Kept `audioArmed = ref(false)` as the initial value and both teardown resets unchanged, per the plan's locked design — the single `watch(live)` rising-edge watcher is the only new wiring point, added directly after the existing `watch(blackout, ...)` so it reads as a natural continuation of the audio block's watcher cluster.
- The filmstrip end-cap button keeps the same `data-testid`, inner `v-if`/`v-else` template blocks, and testid contract as the old `<div>` — only the element type, attributes, and click handler changed, so no downstream test/selector churn beyond the plan's listed files.

## Deviations from Plan

None (Rules 1-4) — plan executed exactly as written for all three tasks. One documentation note below is not a deviation in the code-behavior sense but is recorded for transparency.

### Note: an acceptance-criteria grep count in the plan text is inconsistent with the plan's own comment-wording instructions

- **Found during:** Task 2 verification
- **Detail:** The plan's Task 2 `<acceptance_criteria>` states `grep -c 'watch(live' src/composables/useRunControl.ts` should equal 2. The actual count is 5: two real `watch(live, ...)` call sites (the new audio rising-edge watcher + the pre-existing `watch(live, reconcileLoop)`), one pre-existing unrelated comment ("...watch(live) reconcile below..."), and two new teardown comments whose wording was dictated verbatim by the plan's own `<action>` text ("the `watch(live)` rising edge turns audio back On..."). Following the action text's exact wording (as instructed) necessarily produces a grep count higher than the acceptance criterion expects.
- **Resolution:** Followed the `<action>` text's mandated comment wording (the more specific, load-bearing instruction) rather than contorting the comments to hit an arithmetic target in a secondary sanity-check bullet. All functionally load-bearing acceptance criteria (identifiers unchanged, exact label/aria-label strings, `audioArmed.value = false` count = 2, `audioArmed.value = true` count = 1, no old copy remaining) pass exactly as specified, and the task's `<verify><automated>` command (the actual gate) is green.
- **Files affected:** src/composables/useRunControl.ts (comments only, no behavior change)
- **Impact:** None on functionality or test coverage; purely a plan-authoring inconsistency between two parts of the same task's spec.

## Issues Encountered
None — all three tasks' RED commits failed exactly as predicted by the plan's `<behavior>` sections (verified by running each test file against the pre-change code before writing the implementation), and every GREEN commit passed on the first implementation attempt with no extra timing adjustments needed (the plan's suggested `advanceTimersByTimeAsync(0)` fallback in `rehearseFake`/`goLiveFake` was not required).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness

- All three owner-reported fixes are code-complete, unit-tested, and `npm run type-check` clean.
- Per the plan's `<verification>` section, human UAT (real red-vs-header-pill comparison, real-speaker vamp playback + blocked-banner fallback, mouse-click end-cap navigation + Tab focus ring) is batched into the v2.15 deferred-verification pass (`.planning/v2.15-DEFERRED-VERIFICATION.md`) for one owner pass against the dev build — not deployed by this task.
- Nothing blocks continuing other v2.15/v2.16 work; this quick task touched only Run-the-Service UI files with zero new dependencies.

---
*Quick task: 260919-k9j*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 10 files in `key-files.modified` (plus this SUMMARY.md) confirmed present on disk; all 6 task commits (`40c48537`, `12f4f209`, `f9819717`, `d53635ca`, `5cec29d7`, `b68fe07c`) confirmed present in `git log --oneline --all`.
