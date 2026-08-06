---
phase: 33-backgrounds-slide-editing
plan: 04
subsystem: ui
tags: [vue, typescript, firestore, slide-editing, audio]

# Dependency graph
requires:
  - phase: 33-01
    provides: "GroupSlideEntry/SlideGroup background fields, the shared cascade shape this plan's audio deletion sits alongside"
provides:
  - "GroupSlideEntry with no audio scope field — one attach route only"
  - "EditSlideDrawer.vue's Slide Audio section with a single this-slide-only attach path and a hint pointing to the group music control"
  - "slideGroups.ts's replaceGroupSlides doc comment with the stale round-trip paragraph removed"
  - "EditSlideDrawer.test.ts with the subjectless describe block deleted and P-02 coverage added"
affects: [33-07, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure subtraction plan pattern: remove a field/UI/tests together in the same commit so nothing dangles between steps"

key-files:
  created: []
  modified:
    - src/types/slideGroup.ts
    - src/stores/slideGroups.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts

key-decisions:
  - "Confirmed the plan-time premise correction: slideGroups.ts:~213 was a doc-comment paragraph inside replaceGroupSlides, not executable code — deleted the paragraph, left the surrounding CR-02 reasoning verbatim"
  - "Placed the four new P-02/regression/backstop assertions inside the surviving 'Phase 26-08 Task 2' (loop) describe block rather than creating a new describe block, to keep the describe count at 11 as required"
  - "Wrapped the audio-attach div's existing flex row in a child div so the new hint paragraph could sit beneath the file input without changing the input row's layout"

patterns-established: []

requirements-completed: [R058]

coverage:
  - id: D1
    description: "GroupSlideEntry.audioScope field, the drawer's scope toggle UI, both write routes, and the stale store doc-comment paragraph are all deleted; zero occurrences of the identifier remain under src/"
    requirement: "R058"
    verification:
      - kind: unit
        ref: "grep -rn audioScope src/ (zero matches)"
        status: pass
      - kind: unit
        ref: "npm run type-check (vue-tsc --build, exits 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The subjectless 'audio scope and its two write routes' describe block is deleted wholesale (not adapted); the four surviving fixture/assertion references to the removed field are cleaned; the test file is not split"
    requirement: "R058"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts (112 tests, 11 describe blocks)"
        status: pass
    human_judgment: false
  - id: D3
    description: "P-02 discharged: group-wide audio remains fully reachable via SlideGroupMusicControl.vue (attach/preview/remove UI, setGroupBedMedia write path unchanged); an entry with no own audio still shows the group's bed via the shared caption; the replacement hint renders only in the nothing-attached state"
    requirement: "R058"
    verification:
      - kind: unit
        ref: "EditSlideDrawer.test.ts#★ P-02: an entry with no audio of its own still shows the group's bed via the shared caption"
        status: pass
      - kind: unit
        ref: "EditSlideDrawer.test.ts#★ P-02: the audio-scope-hint renders only in the nothing-attached state"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-03
status: complete
---

# Phase 33 Plan 04: Remove the Per-Slide Audio Whole-Group Scope Option Summary

**Deleted `GroupSlideEntry.audioScope`, the drawer's two-write-route scope toggle, and the stale store doc-comment paragraph — leaving one attach route and a hint naming `SlideGroupMusicControl.vue` as where group-wide audio now lives.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-03T00:15:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `GroupSlideEntry` no longer declares an `audioScope` field; `audioUrl`/`audioLoop` untouched.
- `EditSlideDrawer.vue`'s Slide Audio section has exactly one attach route (`attachSlideAudio`, this-slide-only). Removed: the scope pill block and its two class constants, the `scopeChoice` ref, `attachGroupAudio`, the branch in `onAudioFileSelected`, and the `resetLocalFields` restore line. Added: a `data-testid="audio-scope-hint"` line, shown only in the nothing-attached state, reading "For audio across the whole group, use the group's music control above the grid."
- `slideGroups.ts`'s `replaceGroupSlides` doc comment no longer describes the removed round-trip behavior (the "Open Question 1 resolved" paragraph is gone); the apply-half description and CR-02 concurrent-write reasoning around it are untouched.
- `EditSlideDrawer.test.ts`'s `:813-957` ("audio scope and its two write routes") describe block is deleted wholesale — its entire subject no longer exists. Four surviving fixture/assertion references to the removed field were cleaned (2 in Duplicate, 2 in the locked-service block). Four new assertions were added to the surviving "loop" describe block: a regression test that `audio-scope-choice` never renders in any audio state, two P-02 assertions (group bed still reaches an entry with no own audio; the hint renders only in the nothing-attached state), and a concurrency backstop proving the surviving attach route's write payload carries only expected keys.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the scope choice from the drawer, the field from the model, and the stale comment from the store** - `dd27789` (feat)
2. **Task 2: Delete the now-subjectless test block and clean the four surviving fixture references** - `3416352` (test)

## Files Created/Modified
- `src/types/slideGroup.ts` - `GroupSlideEntry.audioScope` field and its doc-comment line deleted.
- `src/stores/slideGroups.ts` - the stale "Open Question 1 resolved" doc-comment paragraph deleted from `replaceGroupSlides`'s comment block.
- `src/components/slides/EditSlideDrawer.vue` - scope toggle UI, class constants, `scopeChoice` ref, `attachGroupAudio`, the scope branch in `onAudioFileSelected`, and the `resetLocalFields` line all deleted; `data-testid="audio-scope-hint"` added inside the "nothing attached" attach affordance.
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` - the `:813-957` describe block deleted wholesale; 4 fixture/assertion sites cleaned; 4 new assertions added.

## Decisions Made
- Honored the plan's premise correction verbatim: `slideGroups.ts:~213` was verified (again, at execution time) to be a doc-comment paragraph inside `replaceGroupSlides`, not executable code. Deleted only that paragraph; the surrounding load-bearing comment (apply-half description, CR-02 reasoning) is untouched — confirmed via `grep -c 'CR-02' src/stores/slideGroups.ts` returning 3 matches post-edit.
- Placed the four new test assertions (regression + 2×P-02 + concurrency backstop) inside the existing "Phase 26-08 Task 2 — loop where it means something" describe block rather than opening a new describe block. The plan's acceptance criteria fixes the describe count at 11 (was 12: -1 for the deleted block, +0 net), so the new assertions had to land in a surviving block rather than a fresh one; "loop" is the surviving block whose `beforeEach` and fixtures already cover general Slide Audio state (it already asserted `audio-scope-choice` absence for video slides).
- Restructured the `audio-attach` div from a single flex row into an outer div containing the original flex row plus the new hint paragraph beneath it, to match the plan's exact placement instruction ("directly beneath the file input, inside the `v-else-if` attach affordance") without disturbing the file input row's own layout classes.

## Deviations from Plan

None — plan executed exactly as written. The one item flagged as a discretion point (where in the test file the new P-02/regression/backstop assertions land) was resolved per the plan's own describe-count constraint (11, not 12), not a deviation from it.

## Issues Encountered

None. Type-check surfaced exactly the fixture errors in `EditSlideDrawer.test.ts` predicted by Task 1's acceptance criteria (11 `TS2353`/`TS2339` errors, all in that one file, all fixed by Task 2) — confirming the field removal was complete and zero-surprise elsewhere in `src/`.

## P-02 Confirmation (prohibition discharge)

Verified `SlideGroupMusicControl.vue` (full read) before deleting the drawer's scope option:
- **Attach:** `data-testid="group-music-add"` label + `data-testid="group-music-input"` file input (`v-else-if="isEditor"` branch, shown when no bed audio is set).
- **Preview:** `data-testid="group-music-preview"` button toggling a chromeless `AudioPlayer`.
- **Remove:** `data-testid="group-music-remove"` button (`v-if="isEditor"`).
- **Write path:** `setGroupBedMedia`, the same action `SlideGrid.vue` wires the control to — `grep -c 'setGroupBedMedia' src/components/slides/SlideGrid.vue` returns 6 both before and after this plan's changes, confirming the group-level write path was not touched.

So R058's premise holds: group-wide audio is fully settable (attach/preview/remove) through the group music control one level up from this drawer. Removing the drawer's redundant second write path does not remove a capability — it removes a duplicate. This is additionally proven by two new tests (not just prose): an entry with no own audio inside a group with bed audio still renders `audio-file-row` + `audio-shared-caption`, and the new hint appears only when nothing is attached.

## Test Count Evidence (before/after)

- `it(` count: **114 → 108** (net −6: −10 from the deleted describe block, +4 new assertions).
- `describe(` count: **12 → 11** (the one block deleted, none added).
- File count: `EditSlideDrawer.test.ts` was **not split** — `ls src/components/slides/__tests__/ | grep -c EditSlideDrawer` returns 1.
- `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts` — **112 tests pass, 0 failures.**
- Full suite (`npx vitest run`) — **2 failed files / 9 failed tests / 2030 passed**, exactly matching the documented non-defect baseline (`src/storage.rules.test.ts` needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` has a stale assertion) minus the expected −6 from this plan's wholesale test deletion (2036 − 6 = 2030). No new regressions.
- `npm run type-check` (`vue-tsc --build` form) exits 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- R058 is fully discharged. `GroupSlideEntry`, `EditSlideDrawer.vue`, `slideGroups.ts`, and `EditSlideDrawer.test.ts` all carry zero references to the removed field.
- **For Wave 3 (33-07, 33-09), which also touch `EditSlideDrawer.vue`:** this plan only touched the Slide Audio section (`data-testid="drawer-audio-section"`) and its script-side helpers (`attachSlideAudio`, `onAudioFileSelected`, `resetLocalFields`'s scope line). No other section, prop, or emit was touched — the drawer's non-audio structure (label/notes, slide text, routes-away links, duplicate/delete footer, mode prop surface for 33-07/33-09 to add) is untouched and ready for those plans to build on.
- No blockers.

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-03*

## Self-Check: PASSED
All created/modified files confirmed present on disk; both task commit hashes (dd27789, 3416352) confirmed present in git log.
