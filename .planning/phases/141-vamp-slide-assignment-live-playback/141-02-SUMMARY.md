---
phase: 141-vamp-slide-assignment-live-playback
plan: 02
subsystem: presentation
tags: [vue, audio, output-windows, tdd]

requires:
  - phase: 141-01
    provides: "GroupSlideEntry.vampId/vampLabel + VampPicker + EditSlideDrawer assign/change/clear (independent — no code dependency)"
provides:
  - "SlideCanvas.suppressAudio prop — a render-time gate that forces currentAudioUrl to null, mirroring the shipped suppressBackground mechanism exactly"
  - "All four output-tier SlideCanvas mounts (FullscreenSlideOutput.vue x2, ConfidenceOutputView.vue x2) hardcoded to :suppress-audio=\"true\" — Audience, Confidence, and Video outputs never mount AudioPlayer"
affects: [141-03-run-control-playback]

tech-stack:
  added: []
  patterns:
    - "suppress* prop mirroring for render-time gating (SlideCanvas.vue suppressBackground precedent) applied verbatim to suppressAudio — computed returns null when the flag is set, gating both the resolved value and the v-if mount that depends on it"

key-files:
  created: []
  modified:
    - src/components/slides/SlideCanvas.vue
    - src/components/slides/__tests__/SlideCanvas.test.ts
    - src/components/output/FullscreenSlideOutput.vue
    - src/views/ConfidenceOutputView.vue
    - src/views/__tests__/AudienceOutputView.test.ts
    - src/views/__tests__/ConfidenceOutputView.test.ts
    - src/views/__tests__/VideoOutputView.test.ts

key-decisions:
  - "currentAudioUrl's suppression guard is the FIRST statement in the computed (mirroring currentBackgroundUrl's if (props.suppressBackground) return null pattern) rather than a ternary, for readability parity with its sibling gate"
  - "AudienceOutputView.vue and VideoOutputView.vue are untouched — both delegate their entire render to FullscreenSlideOutput.vue, so the two edits there (plus ConfidenceOutputView.vue's own two) cover all three outputs with zero per-output audio setting, per CONTEXT.md's explicit out-of-boundary constraint"
  - "RunPreviewPair.vue's own embedded preview SlideCanvas mounts were left unsuppressed (RESEARCH.md Pitfall 5's explicitly optional, zero-risk cleanup) — out of this plan's files_modified scope and not required for correctness since they already have no ref/no play() call"

patterns-established: []

requirements-completed: [R438]

coverage:
  - id: D1
    description: "SlideCanvas accepts suppressAudio; when true the audio element is never created (play()/pause() are inert no-ops, no throw); when false/absent behavior is byte-for-byte unchanged, including the pre-existing blackout-keeps-audio case; the gate is reactive (setProps toggles it live, not just at mount)"
    requirement: "R438"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#suppressAudio (Phase 141 — output windows are silent) (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "All four output-tier SlideCanvas mounts (FullscreenSlideOutput.vue full-stage + video-banner, ConfidenceOutputView.vue current + next panes) hardcode suppress-audio=true; AudienceOutputView.vue and VideoOutputView.vue are unmodified; the three output-view test suites each prove every registered SlideCanvas instance received suppressAudio=true with a non-vacuous length check"
    requirement: "R438"
    verification:
      - kind: unit
        ref: "src/views/__tests__/AudienceOutputView.test.ts, src/views/__tests__/ConfidenceOutputView.test.ts, src/views/__tests__/VideoOutputView.test.ts — one new suppressAudio test each, plus the full pre-existing suites (69 tests total across the three files + FullscreenSlideOutput.banner.test.ts) still green"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real-speaker 'outputs are silent, no echo' confirmation is hardware UAT, deferred to v2.15 batched verification per this plan's own <verification> section"
    human_judgment: true
    rationale: "Explicitly out of this plan's automated verify scope — requires actual speaker hardware and a live Run session; batched to .planning/v2.15-DEFERRED-VERIFICATION.md per the milestone's UAT-deferred policy."

duration: ~25min
completed: 2026-09-13
status: complete
---

# Phase 141 Plan 2: Suppress Output-Window Audio Summary

**A single `suppressAudio` render-time gate on `SlideCanvas.vue`, hardcoded `true` at all four output-tier mount sites, makes every output window structurally incapable of mounting `AudioPlayer` — the Run control window (Plan 141-03) becomes the sole audio owner by construction, not by convention.**

## Performance

- **Duration:** ~25 min (task execution + full-suite/type-check verification)
- **Tasks:** 2 completed
- **Files modified:** 7 (0 created, 7 modified)

## Accomplishments

- `src/components/slides/SlideCanvas.vue` — new `suppressAudio?: boolean` prop added directly below `suppressBackground` in the existing `defineProps` interface. `currentAudioUrl` changed from an unconditional `props.slide?.slide.audioUrl ?? null` to a guarded computed that returns `null` first when `props.suppressAudio` is set — the identical shape as `currentBackgroundUrl`'s `suppressBackground` guard. No template change: the `presentation-audio` wrapper's `v-if="currentAudioUrl && !mediaFailed"` and `currentAudioKey` both already derive from this one computed, so gating it is sufficient to prevent `AudioPlayer` from ever mounting.
- `src/components/output/FullscreenSlideOutput.vue` — `:suppress-audio="true"` added to both `SlideCanvas` mounts (`ref="slideCanvasRef"` full-stage, `ref="bannerSlideCanvasRef"` video banner), with a one-line template comment citing R438/Phase 141. Because `AudienceOutputView.vue` and `VideoOutputView.vue` delegate their entire render to this file, this single edit covers both output windows.
- `src/views/ConfidenceOutputView.vue` — `:suppress-audio="true"` added to both `SlideCanvas` mounts (current pane `ref="currentCanvasRef"`, next pane), placed after the existing `:suppressBackground="true"` attribute.
- Five new tests in a `describe('suppressAudio (Phase 141 — output windows are silent)')` block in `SlideCanvas.test.ts`, mirroring the file's own `suppressBackground` describe block; one new test each in `AudienceOutputView.test.ts`, `ConfidenceOutputView.test.ts`, and `VideoOutputView.test.ts` asserting every registered `SlideCanvasStub` instance received `suppressAudio === true` with a non-vacuous length check.

## Task Commits

Each task followed the RED -> GREEN TDD cycle with separate commits:

1. **Task 1: SlideCanvas.vue suppressAudio prop + describe block**
   - `d9d5032b` test(141-02): add failing test for SlideCanvas suppressAudio (RED)
   - `8bfd9ffe` feat(141-02): add SlideCanvas suppressAudio prop mirroring suppressBackground (GREEN)
2. **Task 2: Hardcode suppress-audio=true at the four output-tier mounts + output-view test proof**
   - `cea7992d` test(141-02): add failing test for output-view suppressAudio wiring (RED)
   - `8d57239a` feat(141-02): hardcode suppress-audio=true at the four output-tier SlideCanvas mounts (GREEN)

_Both RED commits were verified to fail before implementation existed: Task 1's five new tests failed with 4/5 assertion mismatches (the fifth — absent/false renders presentation-audio — passed trivially since that behavior was already unchanged); Task 2's three new tests failed with `expected true, received false` because no output component yet passed the `suppressAudio`/`suppress-audio` attribute. Both GREEN commits were verified to pass immediately after implementation, with the full surrounding test files staying green (22/22 in SlideCanvas.test.ts; 69/69 across the three output-view files + FullscreenSlideOutput.banner.test.ts)._

## Files Created/Modified

- `src/components/slides/SlideCanvas.vue` — added `suppressAudio?: boolean` prop + guarded `currentAudioUrl` computed
- `src/components/slides/__tests__/SlideCanvas.test.ts` — new `suppressAudio` describe block (5 tests)
- `src/components/output/FullscreenSlideOutput.vue` — `:suppress-audio="true"` on both `SlideCanvas` mounts
- `src/views/ConfidenceOutputView.vue` — `:suppress-audio="true"` on both `SlideCanvas` mounts
- `src/views/__tests__/AudienceOutputView.test.ts` — hoisted `canvasSuppressAudio: boolean[]`, stub prop, new test
- `src/views/__tests__/ConfidenceOutputView.test.ts` — `suppressAudio: boolean` added to `canvasRegistry` record + stub, new test
- `src/views/__tests__/VideoOutputView.test.ts` — hoisted `canvasSuppressAudio: boolean[]`, stub prop, new test

## Decisions Made

- `currentAudioUrl`'s suppression check is written as an early-return guard (`if (props.suppressAudio) return null`) as the first statement of a multi-line computed, exactly mirroring `currentBackgroundUrl`'s own `suppressBackground` guard shape — chosen for file-local consistency over a ternary.
- `AudienceOutputView.vue` and `VideoOutputView.vue` were confirmed as thin delegating wrappers (read, not edited) — the plan's prohibition against adding a per-output audio setting is satisfied by editing only `FullscreenSlideOutput.vue` and `ConfidenceOutputView.vue`.
- `RunPreviewPair.vue`'s own embedded preview `SlideCanvas` mounts (RESEARCH.md Pitfall 5) were left unsuppressed — they are outside this plan's `files_modified` list, already have no `ref`/no `play()` call (inert by construction), and RESEARCH.md explicitly frames suppressing them as optional cleanup, not a correctness requirement for this plan.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `must_haves.truths` are demonstrated by the test files as specified: `SlideCanvas.test.ts`'s new describe block proves the render-time gate (absent/false unchanged, true suppresses including on a blackout slide, inert play/pause, reactive toggle); the three output-view test files prove every output-tier mount received `suppressAudio === true` with non-vacuous assertions; `git diff --name-only` confirms `AudienceOutputView.vue`/`VideoOutputView.vue` were never touched.

## Issues Encountered

None. Both RED phases failed for the expected reason (missing implementation, not a test-authoring error) and both GREEN phases passed on the first implementation attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 141-03 (Run control window `AudioPlayer` mount, arm toggle, blocked/unavailable warnings, ♪ badges) can now build the single audio owner with confidence that no output window will ever create a competing `<audio>` element — the render-time gate makes this structurally impossible rather than convention-dependent.
- Plan 141-04 (delete-warning affected-service count) is fully independent of this plan.
- No blockers. `npm run type-check` (`vue-tsc --build`) is clean. Full app suite (`npx vitest run`) matches the documented baseline exactly: 237/238 files, 5822 tests passed, only `src/storage.rules.test.ts` failing (Storage-emulator dependent — ECONNREFUSED to a local emulator that was not running during this verification pass, consistent with CLAUDE.md's documented baseline).
- Real-speaker "outputs are silent, no echo" hardware UAT remains batched to `.planning/v2.15-DEFERRED-VERIFICATION.md` per the plan's own `<verification>` section — not a blocker for Plans 141-03/04.

---
*Phase: 141-vamp-slide-assignment-live-playback*
*Completed: 2026-09-13*
