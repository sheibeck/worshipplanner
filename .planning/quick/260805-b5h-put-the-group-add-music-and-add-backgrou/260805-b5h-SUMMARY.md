---
phase: quick-260805-b5h
plan: 01
subsystem: ui
tags: [vue, tailwind, flexbox, slides]

# Dependency graph
requires:
  - phase: 34-11
    provides: "Group media panel merged into one visual box (border, single px-3 py-2, no divider) via the flush prop on SlideGroupMusicControl/BackgroundControl"
provides:
  - "Group media panel laid out as a wrapping horizontal row (flex-wrap items-start) instead of a vertical stack"
  - "Both flex-item children (music control root, background testid wrapper) carry min-w-[14rem] flex-1 so they wrap to stacked on narrow rails instead of crushing"
  - "Regression test pinning the row axis and both children's flex-item classes"
affects: [slide-grid, group-media-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "min-w-[<floor>] flex-1 pairing (never min-w-0 flex-1) as the graceful-degradation idiom for two flex items that must wrap rather than crush on narrow viewports"

key-files:
  created: []
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "Panel wrapper switched from flex flex-col gap-3 to flex flex-wrap items-start gap-x-6 gap-y-3 — axis-only change, all prior chrome classes (rounded-md, border, border-gray-800, bg-gray-900, px-3, py-2, mx-6, mt-3) preserved verbatim"
  - "Used min-w-[14rem] flex-1 on both direct children rather than the common min-w-0 flex-1 idiom, because min-w-0 would let flex-wrap never engage and the two controls would crush together instead of wrapping at narrow widths"
  - "items-start added because the two controls differ in height (background control has a caption line the music control lacks, and either can grow a filename/progress/error row once media is attached) — without it they would vertically center against each other's differing heights"

requirements-completed: [QUICK-260805-b5h]

coverage:
  - id: D1
    description: "Group media panel renders as a wrapping horizontal row (flex, flex-wrap, items-start, gap-x-6, gap-y-3) with flex-col removed"
    requirement: QUICK-260805-b5h
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#lays the panel out as a wrapping horizontal row with both controls as flex items"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both direct children (music control root, background testid wrapper) carry min-w-[14rem] and flex-1"
    requirement: QUICK-260805-b5h
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#lays the panel out as a wrapping horizontal row with both controls as flex items"
        status: pass
    human_judgment: false
  - id: D3
    description: "All pre-existing group-media-panel assertions still pass unchanged (one bordered box, no divide-y, padding once, zero chromed descendants, music-before-background source order, full render matrix)"
    verification:
      - kind: unit
        ref: "npx vitest run src/components/slides/__tests__/SlideGrid.test.ts (117/117 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The panel visually reads as one row with the two controls side by side, top-aligned, wrapping to stacked at ~400px, a lone control taking full width, and SongLyricEditor's background control unchanged — owner sign-off on the running app"
    verification: []
    human_judgment: true
    rationale: "This is a visual/UX complaint (third pass on the same panel, verbatim owner quote in the plan) that automated tests cannot prove; Task 2 is a blocking checkpoint:human-verify and has NOT been approved yet in this execution — pending human verification."

# Metrics
duration: 25min
completed: 2026-08-05
status: complete
---

# Quick Task 260805-b5h: Group media panel as a wrapping row Summary

**Group media panel switched from `flex-col` to a wrapping `flex-wrap items-start` row, with `min-w-[14rem] flex-1` on both children so the add-music and add-background controls sit side by side and wrap to stacked on narrow rails.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 1 of 2 (Task 2 is a blocking human-verify checkpoint, not yet approved)
- **Files modified:** 2

## Accomplishments
- Panel wrapper (`data-testid="slide-grid-group-media-panel"`) is now `flex flex-wrap items-start gap-x-6 gap-y-3` — axis-only change, all existing chrome classes preserved verbatim
- `SlideGroupMusicControl` and the background testid wrapper (`data-testid="slide-grid-group-background"`) both carry `min-w-[14rem] flex-1`, giving each a shrink floor paired with a grow factor so `flex-wrap` engages correctly on narrow widths instead of crushing
- Explanatory comment block above the panel extended (not rewritten) with the owner's third-pass feedback and the rationale for `min-w-[14rem] flex-1` over `min-w-0 flex-1`, and for `items-start`
- New regression test (`'lays the panel out as a wrapping horizontal row with both controls as flex items'`) added to the existing `'group media panel (34-11 Task 1)'` describe block, observed RED against the prior `flex-col` panel before the source edit, GREEN after

## Task Commits

Each task was committed atomically:

1. **Task 1: Lay the group media panel out as a wrapping horizontal row** - `8cc6c28` (feat)

**Task 2 (checkpoint:human-verify, gate="blocking") is NOT complete** — awaiting owner confirmation in the running app. No commit for Task 2; nothing further to commit until the owner responds.

_Note: TDD task (test added and observed RED, then source edit made it GREEN) — both changes are in the single Task 1 commit per plan convention (test-first within one atomic task, not a separate RED commit)._

## Files Created/Modified
- `src/components/slides/SlideGrid.vue` - Panel wrapper axis changed to wrapping row; `min-w-[14rem] flex-1` added to `SlideGroupMusicControl` and the background testid wrapper; explanatory comment extended
- `src/components/slides/__tests__/SlideGrid.test.ts` - New regression test pinning the row axis (`flex`, `flex-wrap`, `items-start`, no `flex-col`) and both children's flex-item classes (`flex-1`, `min-w-[14rem]`)

## Decisions Made
- `min-w-[14rem] flex-1` chosen over the common `min-w-0 flex-1` idiom specifically to force the wrap-before-crush behavior the owner asked for (see key-decisions in frontmatter)
- `items-start` added as a correctness requirement (not cosmetic) given the two controls' differing and dynamically-growing heights

## Deviations from Plan

None - plan executed exactly as written. All three class edits, the comment update, and the regression test match the plan's `<action>` and `<behavior>` blocks verbatim (verified class strings, verified test placement inside the existing describe block).

## Issues Encountered

During editing, two accidental stray edits were made to `SlideGrid.vue` (an unwanted `<!-- prettier-ignore -->` comment insertion, and a stray placeholder line inside the new comment paragraph) and immediately corrected before running any verification — neither was ever committed. Final diff matches the plan exactly; confirmed via `git diff` review before commit.

## Verification Results

1. `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` — **117/117 passed**, including the new test (observed RED before the source edit, GREEN after) and every pre-existing panel assertion (no divider, no padded descendant, no chromed descendant, music-before-background order, full render matrix).
2. `npm run type-check` — clean (`vue-tsc --build`, which typechecks test files too).
3. `npx vitest run --dir src --exclude '**/rules.test.ts'` — **exactly 2 files failing**, matching the documented known baseline: `src/storage.rules.test.ts` (needs Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion). 2418/2427 individual tests passed; no third failing file, no regression.
4. `git status --short` — only `src/components/slides/SlideGrid.vue` and `src/components/slides/__tests__/SlideGrid.test.ts` modified (plus pre-existing unrelated untracked `docs/example.mp3` and `docs/example.pptx`, not touched by this task). `SlideGroupMusicControl.vue`, `BackgroundControl.vue`, and `SongLyricEditor.vue` are all untouched.
5. Task 2 (owner visual confirmation) — **NOT YET DONE.** This is a blocking `checkpoint:human-verify` gate and was correctly not self-approved. Pending.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Task 1's automated evidence is complete and clean. Task 2 remains open: the owner needs to run `npm run dev`, open a service's Slides tab, and walk through the 8-step verification in the plan (side-by-side layout, single bordered panel, top alignment, top-alignment under diverging heights, wrap at ~400px, single-control full-width case, and the unchanged `SongLyricEditor` background control). This quick task is NOT fully complete until that checkpoint is resolved with "approved" (or a reported problem is fixed and re-verified).

---
*Quick task: 260805-b5h*
*Completed (Task 1 only): 2026-08-05*

## Self-Check: PASSED

- FOUND: src/components/slides/SlideGrid.vue
- FOUND: src/components/slides/__tests__/SlideGrid.test.ts
- FOUND: .planning/quick/260805-b5h-put-the-group-add-music-and-add-backgrou/260805-b5h-SUMMARY.md
- FOUND commit: 8cc6c28

---

## Post-plan owner follow-up (commit `c3dc559`)

Task 1 shipped `8cc6c28` as planned, but on visual inspection the owner
rejected two aspects of it. Recorded here because the correction is NOT what
the plan specified — the plan's own prescription was part of the problem.

**Owner report (verbatim):** "but, now you have them in their own `<div>`
containers. Let's use flex, and don't containerize each button. Move the label
for 'applies to all slides, ...' so that it shows below the buttons."

### What the plan got wrong

The plan mandated `min-w-[14rem] flex-1` on both panel children, reasoning that
a shrink floor paired with a grow factor was needed so `flex-wrap` would engage
on a narrow rail. That reasoning is sound in isolation but produced the wrong
visual: `flex-1` makes each child claim an equal share of the row **whether or
not its content needs it**, so two small buttons rendered as two half-width
columns. That is what the owner saw as "their own `<div>` containers".

The grow factor was also the only reason a width floor was needed at all. With
no `flex-1`, each item sizes to content, so there is no crush to protect
against and no floor to add. `min-w-0 max-w-full` remains, serving a different
purpose: capping an attached long filename at the panel width so the control's
own inner `truncate` engages instead of overflowing.

### The caption was the real alignment culprit

`BackgroundControl` renders its caption stacked ABOVE its add-button. So even
with a correct row axis, the background button sat one line lower than the
music button. No amount of flex tuning on the panel could fix that — the extra
line was inside one of the children. Fixed by adding an opt-in `hideCaption`
prop (default `false`, so `SongLyricEditor.vue`'s call site is byte-identical)
and painting the caption in `SlideGrid.vue` as a `basis-full` flex item, i.e.
its own full-width line below both buttons. `groupBackgroundCaption` remains
the single source of that copy.

Suppressed while `songBackgroundForInheritedDisplay` is set, preserving the
either/or relationship the control's own caption had with the "inherited from
the song" line.

### Verification (re-run after the follow-up)

- `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` — 120/120
- `npx vitest run src/components/slides/__tests__/BackgroundControl.test.ts src/components/__tests__/SongLyricEditor.test.ts` — 84/84 (both existing caption assertions unchanged and passing, proving the song-level call site is unaffected)
- `npm run type-check` — clean
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 2421 passed, failing files exactly the documented baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`)

### Test changes

The plan's own regression test asserted `flex-1` + `min-w-[14rem]` on both
children. That assertion was pinning the rejected behaviour, so it was replaced
with its inverse, plus two new tests covering caption placement (full-width,
after both buttons in source order, absent from inside the control) and caption
absence when only the music control renders.

### Task 2 status: still pending

Unchanged — the blocking `checkpoint:human-verify` gate has not been approved.
The checklist in the Task 2 section still applies, with one addition: confirm
the caption reads as a single line under both buttons, not beside or above one.
