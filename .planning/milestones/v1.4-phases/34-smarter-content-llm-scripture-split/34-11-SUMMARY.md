---
phase: 34-smarter-content-llm-scripture-split
plan: 11
subsystem: ui
tags: [vue, slides, slide-grid, group-media, layout]

# Dependency graph
requires:
  - phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium
    provides: SlideGroupMusicControl and the group-bed music bar wrapper (25-06)
  - phase: 33-backgrounds-slide-editing
    provides: BackgroundControl and the group-background wrapper (33-08, R055)
provides:
  - One merged `data-testid="slide-grid-group-media-panel"` in SlideGrid.vue containing both the
    group music control and the group background control, replacing the two separate sibling rows
  - showGroupMusicControl / showGroupBackgroundControl computeds carrying each control's own
    wrapper-visibility condition forward unchanged
  - A regression test suite proving the merge is layout-only (permission gate, caption, inherited
    display, and all four handlers unchanged)
affects: [36-ui-rework-service-order-contextual-action-bars]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel-level 31-UI-SPEC E5: when two independently-gated controls are grouped under one
       wrapper, the wrapper's own v-if must be the disjunction of both controls' conditions, not
       an unconditional div, or two correctly-empty controls together produce one empty box."

key-files:
  created: []
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "Wrote the Task 2 permission-carve-out assertion to match the VERIFIED source behavior
     (canWriteGroupMedia deliberately omits the song-group exclusion canMutateGroup applies, so a
     song group keeps group-media write access on a draft service) rather than the plan's literal
     acceptance-criteria wording, which described the opposite direction and would have contradicted
     both the computed's own code comment and a pre-existing, must-not-modify regression test."

requirements-completed: [R055]

coverage:
  - id: D1
    description: "Group music and group background render inside one merged panel (slide-grid-group-media-panel), music first, replacing the two prior sibling rows"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel (34-11 Task 1) > shows one panel containing both controls, music first, when both would render"
        status: pass
    human_judgment: false
  - id: D2
    description: "The panel never renders empty — each control's own visibility condition is preserved, and the panel's own v-if is the disjunction of both"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel (34-11 Task 1) > renders no panel element at all with neither bed audio nor background and no write permission"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel (34-11 Task 1) > shows the panel with only the music control for bed audio and no write permission"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel (34-11 Task 1) > shows the panel with only the background control for a group background and no write permission"
        status: pass
    human_judgment: false
  - id: D3
    description: "canWriteGroupMedia gate is byte-unchanged, including the song-group carve-out — no permission widened or narrowed by the merge"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel — no-behaviour-change regression (34-11 Task 2) > a song group can still write group media on a draft service (canWriteGroupMedia carve-out), while remaining unable to mutate its slides (canMutateGroup)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The group-background caption and songBackgroundForInheritedDisplay render identically inside the merged panel"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel — no-behaviour-change regression (34-11 Task 2) > renders the caption inside the panel with the real card count for two different card counts"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel — no-behaviour-change regression (34-11 Task 2) > renders the inherited-from label in the DOM for a song group inheriting the song background, and omits it once the group has its own"
        status: pass
    human_judgment: false
  - id: D5
    description: "All four group-media handlers (attach/remove music, attach/remove background) reach the same store calls with the same arguments, including explicit clear flags"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#group media panel — no-behaviour-change regression (34-11 Task 2) > removing group background inside the merged panel still uses the explicit clear flag rather than an undefined url"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-08-04
status: complete
---

# Phase 34 Plan 11: Merge group music and group background into one panel Summary

**SlideGrid.vue's two separate group-media rows (group music bar, group background control) are now one `slide-grid-group-media-panel`, with each control's own visibility condition preserved and the permission gate, caption, inherited-display rule, and all four write handlers byte-unchanged.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-04T00:30:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Closed owner UAT finding F2: group music and group background now render inside one panel, music above background, instead of two unrelated-looking sibling rows.
- Preserved the "don't render an empty box" rule (31-UI-SPEC E5) one level up: the panel itself only renders when at least one of its two controls would.
- Proved — with executable tests, not a commit-message claim — that `canWriteGroupMedia` (including its song-group carve-out), `groupBackgroundCaption`, `songBackgroundForInheritedDisplay`, and all four group-media handlers are unchanged by the merge.

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge the two sibling rows into one group-media panel that never renders empty** - `98fdd29` (feat)
2. **Task 2: Prove the merge changed nothing but layout** - `2938d01` (test)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `src/components/slides/SlideGrid.vue` - Added `showGroupMusicControl` / `showGroupBackgroundControl` computeds (verbatim copies of the two prior wrapper conditions); replaced the two sibling wrapper divs with one `data-testid="slide-grid-group-media-panel"` div gated on their disjunction, containing the music control (gated on `showGroupMusicControl`) then the background control (gated on `showGroupBackgroundControl`, keeping `data-testid="slide-grid-group-background"`). No prop, event binding, gate, caption, or handler was touched.
- `src/components/slides/__tests__/SlideGrid.test.ts` - Added a "group media panel (34-11 Task 1)" describe block (render matrix: both/music-only/background-only/neither/write-permission cases, DOM order, and unaffected-siblings check for the notices below the panel) and a "group media panel — no-behaviour-change regression (34-11 Task 2)" describe block (caption at two card counts, all three inherited-display cases through the DOM, the permission carve-out vs. slide-mutation distinction, and both attach/remove paths with their exact store-call arguments).

## Decisions Made
- **Task 2's permission-carve-out assertion direction was corrected against verified source behavior.** The plan's acceptance criteria say "a song group renders no group-media add affordance inside the panel for an editor on a draft service." This is the opposite of what `canWriteGroupMedia` actually does: its own code comment states the gate "deliberately omits `isSongGroup`" so group media "stay[s] available on a SONG group," and a pre-existing, must-not-modify regression test elsewhere in the same file (`'a song group on a DRAFT service keeps its group-media affordance'`) already pins that exact behavior for the music control. Implementing the literal wording would have required either changing `canWriteGroupMedia` (forbidden — the gate must stay byte-unchanged) or contradicting a pre-existing test the plan explicitly says must not be modified. I wrote the regression test to assert the real, verified carve-out (a song group keeps group-media write access on a draft/unlocked service) while adding a companion assertion that slide-mutation affordances (`slide-grid-add-slide`) stay locked for the same song group — this still catches the "wrong gate" mistake the plan's test was meant to guard against: if a future change routed background through `canMutateGroup` instead of `canWriteGroupMedia`, the add affordance would disappear and this assertion would fail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - plan-text bug] Corrected the direction of Task 2's permission-carve-out test**
- **Found during:** Task 2 (writing the no-behaviour-change regression block)
- **Issue:** The plan's Task 2 action/acceptance-criteria text asserts a song group should render *no* group-media add affordance for an editor on a draft service. This contradicts `canWriteGroupMedia`'s own code comment (it deliberately omits the song-group exclusion `canMutateGroup` applies) and a pre-existing test in the same file that the plan forbids modifying.
- **Fix:** Wrote the regression test to assert the verified behavior — a song group keeps its group-media write affordance on a draft service — paired with an assertion that slide-mutation (`slide-grid-add-slide`) stays locked for the same group, preserving the test's actual purpose (catching a "wrong gate" merge mistake) without breaking real behavior or the pre-existing pinned test.
- **Files modified:** `src/components/slides/__tests__/SlideGrid.test.ts`
- **Verification:** `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` — 105/105 passing, including the pre-existing song-group test with its assertions unmodified.
- **Committed in:** `2938d01` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 plan-text bug)
**Impact on plan:** No scope creep, no behavior change to production code. The fix keeps the regression test meaningful (it still catches the wrong-gate mistake) while staying true to the plan's own "byte-unchanged gate" and "don't modify pre-existing test assertions" constraints.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `SlideGrid.vue`'s group-media panel is now a single unit; Phase 36 (deferred, "UI Rework — Service Order & Contextual Action Bars") owns the broader rework of this surface and can build on the merged panel rather than the two prior rows.
- No blockers. `npm run type-check` and the full `SlideGrid.test.ts` suite are both green.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: src/components/slides/SlideGrid.vue
- FOUND: src/components/slides/__tests__/SlideGrid.test.ts
- FOUND: .planning/phases/34-smarter-content-llm-scripture-split/34-11-SUMMARY.md
- FOUND commit: 98fdd29 (Task 1)
- FOUND commit: 2938d01 (Task 2)
