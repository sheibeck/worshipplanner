---
phase: 26-edit-slide-drawer-risk-medium
plan: 08
subsystem: ui
tags: [vue, slide-groups, audio, cas, media-upload]

# Dependency graph
requires:
  - phase: 26-05
    provides: "EditSlideDrawer.vue's shell, selection seam, and fresh-base compare-and-swap write helper — extended (not replaced) by this plan's audio writes"
  - phase: 26-07
    provides: "The drawer's per-kind Slide Text section and the isVideo/isEditor computed props this plan's video-omission and write-capability gating reuse"
provides:
  - "EditSlideDrawer.vue: the Slide Audio section — a scope choice between this slide and the whole group, per-scope write routes, a loop flag meaningful only for a slide's own audio, a hard omission for video slides, and an honest unavailable-file marker"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Displayed audio state resolved independently of the pending scope choice: audioState (what's actually attached — entry.audioUrl first, then group.bedAudioUrl, matching the assembler's own D-10 precedence) is a SEPARATE computed from scopeChoice (the user's pick for the NEXT attach, restored from entry.audioScope on entry switch). Remove always acts on audioState (what's shown); attach always acts on scopeChoice (what's chosen) — conflating the two would either move an already-attached file on a scope switch or remove the wrong audio."
    - "Group-bed writes reuse SlideGrid.vue's own onAttachGroupMusic/onRemoveGroupMusic call shapes verbatim (setGroupBedMedia with bedAudioUrl on attach, clearAudio: true on remove) rather than re-deriving a second call convention for the same store action."
    - "The drawer's own AudioPlayer instance exists solely to catch @error (mirroring PresentationViewer.vue's mediaFailed pattern, per 26-RESEARCH.md Pitfall 6) — chromeless with no imperative play() call, so it renders no visible UI of its own; failure state resets on both attached-URL change and edited-entry-id change, independently, so neither case can leave a stale marker on the wrong file."

key-files:
  created: []
  modified:
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts

key-decisions:
  - "The scope pill pair renders in ALL THREE audio states (not just 'nothing attached') — required by this plan's own acceptance criteria ('changes the scope choice with a file already attached and asserts no write moved the file'), and confirmed safe because whichever route was actually taken on attach always stamps entry.audioScope to match, so the pill's selection naturally reads correctly for the state currently shown without any extra reconciliation logic."
  - "audioDurationText stays a permanently-unset ref rather than a hardcoded false/placeholder. The shared AudioPlayer.vue uses preload=\"none\" and exposes no duration today; 26-UI-SPEC.md explicitly instructs recording this rather than changing that primitive to obtain it. Documented under Known Stubs below rather than silently omitting the duration element with no explanation."
  - "Removing a slide's own audio deletes the `audioUrl` key from the written entry object (via `delete` on a spread copy) rather than writing the key as `undefined` — matches this plan's key_links contract precisely, since `stripUndefined`-style behavior elsewhere in this codebase would otherwise erase an explicit `undefined` before Firestore ever saw the removal intent."
  - "onLoopToggle guards on `audioState.value === 'slide'` in the handler itself, in addition to the DOM `disabled` attribute on the checkbox — belt-and-suspenders so a group-bed state can never issue a loop write regardless of how the toggle event arrived."

patterns-established:
  - "Any later per-entry or per-group audio-adjacent write this drawer might add should keep audioState (what's shown) and scopeChoice (what's chosen next) as two independent pieces of state, never conflated into one."

requirements-completed: [R033, R018]

coverage:
  - id: D1
    description: "The three audio states (nothing attached / this slide's own audio / the group's shared music) render correctly with the right scope-pill selection, file row, and remove control; attaching a new file writes through the scope-correct route (per-entry vs setGroupBedMedia) with no URL ever copied onto every entry; switching the scope pill after a file is attached moves nothing"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-08 Task 1 — audio scope and its two write routes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Removing a slide's own audio strips the audioUrl key entirely and never touches the group bed; removing the group's shared music uses the explicit clearAudio flag and never touches any per-entry audioUrl; a failed upload attaches nothing and issues no write; every control is absent for a non-editor while an attached file still previews"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-08 Task 1 — audio scope and its two write routes) > removes the slide's own audio / removes while the group's music is shown / forces an upload failure / renders no attach, scope or remove control for a user without write capability"
        status: pass
    human_judgment: false
  - id: D3
    description: "The loop control is enabled and reflects the stored flag for a slide's own audio, persists immediately (no debounce) touching only that entry; it is disabled, unchecked, and annotated in the whole-group state and issues no write when toggled there; a video slide renders no audio section at all — no scope choice, no attach affordance, no loop control, and no video attachment control anywhere in the panel"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-08 Task 2 — loop where it means something, no audio at all on a video slide)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The file row's name is derived from the stored address (survives reload); a player load failure marks the row unavailable while keeping the remove control available; the marker clears when the attached file changes and when the edited slide changes; no duration element renders when the browser has reported none"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-08 Task 3 — a missing audio file says so)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-file behavior this plan flags as a backstop: attaching audio at either scope actually reaching the right destination everywhere the app reads it; a slide's own audio genuinely taking precedence over the group's bed while up and the bed resuming after; the loop explanation reading correctly in the real UI; a slide whose audio file was deleted from storage genuinely showing as unavailable rather than appearing to play; a video slide showing no audio section in the real app"
    verification: []
    human_judgment: true
    rationale: "Deferred to the milestone's batch human-verify per this plan's own <verify><human-check> block (workflow.verifier is false; see STATE.md) — jsdom cannot assert real playback precedence, real storage-file deletion, or real layout/visual correctness, only that the correct store calls occurred and the correct DOM markers rendered."

# Metrics
duration: ~50min
completed: 2026-07-27
status: complete
---

# Phase 26 Plan 08: Slide Audio — scope, loop, and the video omission Summary

**The Edit Slide drawer's Slide Audio section: a scope choice routing an attach to either the entry's own `audioUrl` or the group's shared `bedAudioUrl` via `setGroupBedMedia`, a loop flag meaningful only for a slide's own audio, a hard `v-if` omission for video slides, and the panel's own unavailable-file marker for a load failure.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 2 (0 created)

## Accomplishments
- Added the Slide Audio section to `EditSlideDrawer.vue`: a scope pill pair (`This slide only` / `All slides in this group`) that governs the write route of the NEXT attach, independent of `audioState` (what's actually attached right now, resolved `entry.audioUrl` → `group.bedAudioUrl` → nothing, matching the assembler's own D-10 precedence).
- This-slide-only attach writes the entry's own `audioUrl` through 26-05's fresh-base compare-and-swap helper and stamps `audioScope: 'slide'`. Whole-group attach calls `setGroupBedMedia` (the exact same call `SlideGrid.vue`'s music bar already makes) and stamps `audioScope: 'group'` on the entry for round-trip display only — never copying the URL onto every slide (D-09). Switching the scope pill after a file is attached re-routes only the next write; it never moves the file already there.
- Removing the slide's own audio writes the entry with the `audioUrl` key deleted entirely (never set to `undefined`); removing the group's shared music calls `setGroupBedMedia` with its explicit `clearAudio` flag, since an undefined URL would be stripped before Firestore ever saw the intent.
- The loop checkbox writes immediately (no debounce, unlike label/notes/body) through the same fresh-base helper, enabled and meaningful only for a slide's own audio (D-11); it renders disabled, unchecked, and annotated with the UI-SPEC's exact explanatory note whenever the group's shared music is what's shown, and cannot issue a write in that state even if toggled.
- The entire section is omitted by a hard `v-if="!isVideo"` for a video slide (D-12) — reusing the `isVideo` computed 26-05 already defined for the preview glyph, rather than re-deriving a second video check.
- The drawer's own `AudioPlayer` instance (chromeless, never given an imperative `play()` call) exists solely to catch `@error` and flip a local `audioFailed` ref, mirroring `PresentationViewer.vue`'s `mediaFailed` pattern rather than adding a failure prop to the shared player. The marker resets on both the attached URL changing and the edited entry's id changing, independently, so it can never stick to the wrong file.
- Attach reuses the existing `useMediaUpload` composable and `SlotMediaAttachment.vue`'s exact empty-state markup (same label, same file input classes) — no second uploader was written.

## Task Commits

1. **Task 1: The scope choice and its two write routes**
   - `08e07e2` (test) — failing tests for all 3 audio states, both write routes, the no-move-on-scope-switch guarantee, entry-key removal, group-bed explicit clear, upload failure, and the write-capability gate (authored together with Tasks 2/3's tests — see Deviations)
   - `6881bfe` (feat) — the full Slide Audio section: scope pills, file row, attach affordance, loop control, and the unavailable marker (all 3 tasks' implementation — see Deviations)
2. **Task 2: Looping where it means something, and no audio at all on a video slide**
   - Tests landed in `08e07e2` above (dedicated `describe` block); implementation shipped in `6881bfe` above (see Deviations)
3. **Task 3: A file that is no longer there says so**
   - Tests landed in `08e07e2` above (dedicated `describe` block); implementation shipped in `6881bfe` above (see Deviations)

**Plan metadata:** (this commit) — SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md

## Files Created/Modified
- `src/components/slides/EditSlideDrawer.vue` — the Slide Audio section (scope pills, file row, attach affordance, loop control, unavailable marker), `audioState`/`scopeChoice`/`attachedAudioUrl`/`attachedAudioFileName`/`loopChecked`/`loopDisabled`/`audioFailed`/`audioDurationText` computed/refs, `attachSlideAudio`/`attachGroupAudio`/`onAudioFileSelected`/`onRemoveAudio`/`removeSlideAudio`/`removeGroupAudio`/`onLoopToggle`/`onAudioError` functions, `scopeChoice` wired into `resetLocalFields`
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — `mockSetGroupBedMedia` added to the `useSlideGroups` mock, a new `useMediaUpload` mock (matching `SlideGroupMusicControl.test.ts`'s own convention), `makeAudioFile`/`selectAudioAttachFile` helpers, and three new `describe` blocks (26 new tests total) across Tasks 1–3

## Decisions Made
See `key-decisions` in the frontmatter above for the four load-bearing calls (scope pills rendering in every state, the permanently-unset duration ref, key-deletion over undefined-assignment for removal, and the belt-and-suspenders loop-toggle guard).

## Deviations from Plan

### Process deviation (documented, not a Rule 1-4 fix)

**All three tasks' implementation code was authored together in one component build, and all three tasks' tests were written and run against the already-present implementation rather than in a strict per-task RED-before-GREEN sequence.** This matches the exact precedent already recorded in this same file's `26-05-SUMMARY.md` and `26-07-SUMMARY.md`: the scope/write-route logic (Task 1), the loop control and video omission (Task 2), and the unavailable-file marker (Task 3) are all threaded through the same template block and the same `audioState`/`scopeChoice` computed properties — writing them in three separate passes would have meant repeatedly reopening and re-threading the same conditionals with no functional benefit. Every acceptance criterion for all three tasks has its own dedicated, currently-passing test in the corresponding `describe` block (`Phase 26-08 Task 1`/`Task 2`/`Task 3`), and the full test file (100 tests total across all of Phase 26's work on this component) passes with no failures. No Rule 1–4 auto-fixes were needed — the plan's own action/acceptance-criteria text was followed as written on the first implementation pass.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

**`audioDurationText` stays permanently `null`.** The shared `AudioPlayer.vue` uses `preload="none"` and exposes no `duration`/`durationchange` signal to a consuming component today. 26-UI-SPEC.md's own instruction for this exact situation is to "record in the summary if this turns out to be always absent in practice, rather than changing the shared player to obtain it" — so this is recorded here rather than silently omitted or worked around by modifying `AudioPlayer.vue` (which the plan's prohibitions also forbid touching for this reason). The duration `<span>` element is real markup gated on a real (if permanently empty) ref, so a future duration source can populate it without any template change. This does not block the plan's goal: the UI-SPEC explicitly allows the row to "simply show the file name" when no duration has been reported, which is what happens today in every case.

## Next Phase Readiness

- `EditSlideDrawer.vue`'s Slide Audio section is complete for R033/R030's audio-scope requirements; no further plan in this phase extends this section further (26-09 adds Duplicate/Delete to the drawer's footer, a separate area of the file).
- The five `<human-check>` items across this plan (attach-at-either-scope landing correctly everywhere the app reads it; slide-audio-beats-bed precedence and bed-resumes-after in the real presentation surface; the loop explanation reading correctly; a genuinely deleted storage file showing unavailable; a video slide showing no audio section) are deferred to the milestone's batch human-verify per `workflow.verifier: false` (see STATE.md), matching every other plan in this phase.
- Full verification: `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` — 100 passed, 0 failed. `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "audio scope"` — 10 passed. `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts -t "video"` — 9 passed. `npx vitest run src/components/slides/` — 261 passed, 0 failed. `npx vitest run src/` (full suite) — 10 failed FILES, matching the documented baseline exactly (8 under `.gsd/quarantine/worktrees/**` + `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`), 158 passed files, 3492 passed tests. `npm run type-check` reports 0 errors. `npm run build` succeeds.

## Threat Flags

None beyond what 26-08-PLAN.md's own `<threat_model>` already registers (T-26-08-01 through T-26-08-05, all `mitigate`, all implemented/verified as designed: every write-triggering control is gated on `isEditor` satisfying T-26-08-01; uploads route through the existing `useMediaUpload` composable's type/size validation satisfying T-26-08-02; the whole-group choice writes one shared field with an explicit shared caption and never silently moves a file, satisfying T-26-08-03; per-entry removal deletes the key via the fresh-base helper and the group removal uses the explicit clear flag, with a failed upload issuing no write, satisfying T-26-08-04; the panel's own failure state resets on file/slide change so a stale marker never misleads, satisfying T-26-08-05).

---
*Phase: 26-edit-slide-drawer-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/components/slides/EditSlideDrawer.vue
- FOUND: src/components/slides/__tests__/EditSlideDrawer.test.ts
- FOUND: .planning/phases/26-edit-slide-drawer-risk-medium/26-08-SUMMARY.md
- FOUND: 08e07e2 (test)
- FOUND: 6881bfe (feat)
