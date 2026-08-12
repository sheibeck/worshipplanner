---
phase: 48-multi-image-ordering-mobile-polish
plan: 02
subsystem: ui
tags: [vue, tailwind, sortablejs, responsive, touch, accessibility]

# Dependency graph
requires: []
provides:
  - Responsive Slides-tab layout (SlidesTab.vue flex-col sm:flex-row; SlidePlanRail.vue w-full sm:w-[260px] with a horizontal-scroll strip below sm)
  - 44px minimum hit areas on SlideCard.vue's drag handle and SlideActionMenu.vue's trigger, applied unconditionally via invisible padding + compensating negative margin
  - SortableJS touch-drag support (delay/delayOnTouchOnly/touchStartThreshold) added additively to the existing SlideGrid.vue Sortable.create instance
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Responsive two-pane stacking via flex-col sm:flex-row (QuarterView's existing sm-breakpoint recipe), reused for SlidesTab/SlidePlanRail"
    - "Invisible hit-area padding + equal negative margin (p-N -m-N) to reach a 44px touch target without changing icon size or layout"
    - "Additive-only SortableJS options object extension — new keys appended, existing keys and the onEnd body left byte-unchanged"

key-files:
  created: []
  modified:
    - src/components/slides/SlidesTab.vue
    - src/components/slides/SlidePlanRail.vue
    - src/components/slides/__tests__/SlidePlanRail.test.ts
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts
    - src/components/slides/SlideActionMenu.vue
    - src/components/slides/__tests__/SlideActionMenu.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "44px hit-area padding applied unconditionally (not gated on a breakpoint) per 48-UI-SPEC — a larger click target never regresses desktop mouse use"
  - "SortableJS touch options added strictly additively to the existing options object (delay:150, delayOnTouchOnly:true, touchStartThreshold:5) so the oldDraggableIndex/newDraggableIndex index-bug guard (ZTXcpNRcJTalEQp42fTx) is untouched by construction"
  - "The two physical-device backstops (real touch-drag correctness, real-thumb 44px reachability) are DEFERRED to the owner per the v1.5 standing autonomy grant — never self-approved. jsdom cannot simulate real touch/pointer gesture sequences or thumb reachability."

patterns-established: []

requirements-completed: [R099]

coverage:
  - id: D1
    description: "Below the sm breakpoint the Slides tab stacks the plan rail above the grid (flex-col sm:flex-row) instead of the fixed 260px rail competing with the grid"
    requirement: R099
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts (existing suite, unaffected — 57/57 pass)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidePlanRail.test.ts#R099 — responsive mobile layout"
        status: pass
    human_judgment: false
  - id: D2
    description: "Below sm the plan rail renders as a horizontal-scroll strip (flex-row overflow-x-auto, w-[220px] shrink-0 rows); skeleton takes the same axis treatment; row title truncation (line-clamp-2) unchanged"
    requirement: R099
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidePlanRail.test.ts#R099 — responsive mobile layout"
        status: pass
    human_judgment: false
  - id: D3
    description: "The drag handle (SlideCard.vue) and menu trigger (SlideActionMenu.vue) each present a >=44px hit area via invisible padding + equal negative margin, unconditional, with icon visual size unchanged"
    requirement: R099
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#R099 (48-02 Task 2): gives the drag grip a >=44px hit area..."
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideActionMenu.test.ts#R099 (48-02 Task 2): gives the trigger a >=44px hit area..."
        status: pass
    human_judgment: false
  - id: D4
    description: "Sortable.create is called once with delay:150, delayOnTouchOnly:true, touchStartThreshold:5 added to the existing options object; handle/draggable/animation/ghostClass and the onEnd body are byte-unchanged"
    requirement: R099
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#R099: Sortable.create is called once with touch options ADDED..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Real touch-drag on a physical device lands exactly where dropped (not off-by-one, the ZTXcpNRcJTalEQp42fTx regression shape); the drag handle and menu trigger are comfortably tappable with a real thumb; desktop mouse drag still starts immediately with no added delay"
    verification: []
    human_judgment: true
    rationale: "jsdom cannot simulate real touch/pointer drag gesture sequences (48-RESEARCH.md Pitfall 6) or real-thumb reachability. Both are UI-SPEC-flagged backstops, deferred to the owner per the v1.5 standing autonomy grant rather than self-approved."

duration: 6min
completed: 2026-08-08
status: complete
---

# Phase 48 Plan 02: Slides Tab Mobile Polish (R099) Summary

**Responsive Slides-tab stacking (rail-above-grid + horizontal-scroll strip), 44px hit areas on the drag handle and menu trigger, and additive SortableJS touch options on the existing instance — all unit-proven, with the two physical-device backstops deferred to the owner.**

## Performance

- **Duration:** ~6 min (task work); full wave-merge verification (type-check + full suite) run separately
- **Started:** 2026-08-08T19:40Z (first task commit)
- **Completed:** 2026-08-08T19:42:39Z (last task commit)
- **Tasks:** 3 of 4 (Task 4 is the human-verify checkpoint — see Deferred Verification below)
- **Files modified:** 9

## Accomplishments

- `SlidesTab.vue`'s two-pane row is `flex flex-1 min-h-0 flex-col sm:flex-row` — the rail stacks above the grid below `sm` and sits beside it at `sm`+, matching `QuarterView.vue`'s existing breakpoint convention.
- `SlidePlanRail.vue`'s root is `w-full sm:w-[260px] shrink-0 border-b sm:border-b-0 sm:border-r`; the rows container and skeleton wrapper both become a horizontal-scroll strip below `sm` (`flex flex-row gap-1.5 overflow-x-auto`) and a vertical list at `sm`+ (`sm:flex-col sm:space-y-1.5 sm:overflow-x-visible`); each row button is `w-[220px] shrink-0 sm:w-full sm:shrink`. The `line-clamp-2` row title is untouched.
- `SlideCard.vue`'s drag-handle span gets `p-3.5 -m-3.5` (16px SVG stays `h-4 w-4`) and `SlideActionMenu.vue`'s trigger gets `p-3 -m-3` (20px SVG stays `h-5 w-5`) — both reach a >=44px hit area via invisible padding compensated by an equal negative margin, applied unconditionally so desktop layout/mouse UX is unaffected.
- `SlideGrid.vue`'s existing `Sortable.create` call gains exactly three additive options — `delay: 150`, `delayOnTouchOnly: true`, `touchStartThreshold: 5` — inserted between `ghostClass` and `onEnd`. `handle`, `draggable`, `animation`, `ghostClass`, and the entire `onEnd` body (including the `oldDraggableIndex`/`newDraggableIndex` index-bug guard) are byte-unchanged. No second Sortable instance was created.
- Extended `SlidePlanRail.test.ts`, `SlideCard.test.ts`, `SlideActionMenu.test.ts`, and `SlideGrid.test.ts` with class-string / options-object assertions proving each of the above.

## Task Commits

Each task was committed atomically:

1. **Task 1: R099 — responsive Slides-tab layout (two-pane stack + rail strip)** - `ca8ca41` (feat)
2. **Task 2: R099 — 44px hit areas on the drag handle and menu trigger** - `f82a5a2` (feat)
3. **Task 3: R099 — additive SortableJS touch options on the existing SlideGrid instance** - `2059cb7` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/components/slides/SlidesTab.vue` - two-pane row now `flex-col sm:flex-row`
- `src/components/slides/SlidePlanRail.vue` - responsive root/rows/skeleton/row-width classes
- `src/components/slides/__tests__/SlidePlanRail.test.ts` - added `R099 — responsive mobile layout` describe block
- `src/components/slides/SlideCard.vue` - drag-handle `p-3.5 -m-3.5` hit area
- `src/components/slides/__tests__/SlideCard.test.ts` - added hit-area + unchanged-icon-size assertion
- `src/components/slides/SlideActionMenu.vue` - trigger `p-3 -m-3` hit area
- `src/components/slides/__tests__/SlideActionMenu.test.ts` - added hit-area + unchanged-icon-size assertion
- `src/components/slides/SlideGrid.vue` - additive `delay`/`delayOnTouchOnly`/`touchStartThreshold` on the existing `Sortable.create` call
- `src/components/slides/__tests__/SlideGrid.test.ts` - added options-object assertion proving the addition and the unchanged existing keys

## Decisions Made

- 44px hit-area padding applied unconditionally rather than only at mobile breakpoints, per 48-UI-SPEC's explicit instruction — a larger click target is harmless on desktop and a single unconditional class is less regression-prone than a responsive one.
- `p-3.5 -m-3.5` chosen for the 16px drag-handle SVG (16 + 2×14 = 44px) and `p-3 -m-3` for the 20px menu-trigger SVG (20 + 2×12 = 44px) — both hit exactly the 44px floor with the smallest padding values, per the plan's `e.g.` guidance.
- SortableJS touch options inserted as a strictly additive edit (new test written to assert both the new keys AND the unchanged `handle`/`draggable`/`animation`/`ghostClass`), per the locked decision that nothing else in that options object may move.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Deferred Verification (Task 4 — human-verify checkpoint)

Per this plan's checkpoint resolution and the v1.5 standing autonomy grant (STATE.md), Task 4's
human-verify checkpoint was **not blocked on** during this autonomous run. The two physical-device
backstops it covers cannot be proven by jsdom (48-UI-SPEC.md § UI Considerations flags both `🧪
backstop`; 48-RESEARCH.md Pitfall 6 explains why a jsdom touch-event test would be false confidence):

1. **Real touch-drag correctness** — long-press a slide card by its drag handle on a real phone (or
   real touch emulation, ~375px width) and drag it to a new position; confirm it lands exactly where
   dropped, not one position off (the `ZTXcpNRcJTalEQp42fTx` index-bug shape).
2. **Real-thumb 44px reachability** — confirm the drag handle and the 3-dot menu trigger are each
   comfortably tappable with a thumb on a real touch device.
3. (Related, same checkpoint) Confirm no horizontal page overflow and the rail/grid layout renders as
   designed at ~375px, and that desktop mouse drag-reorder still starts immediately with no added
   delay.

**This was NOT recorded as passed.** Per the standing grant ("Never record a deferred check as
passed"), these items are owner to-dos, not self-approved verifications. The orchestrator records
them in `.planning/PENDING-VERIFICATION.md` § Phase 48 at phase end.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- R099 is code-complete and unit-proven for everything jsdom can check; the two physical-device
  backstops above are the only remaining verification for this plan.
- No blockers for subsequent Phase 48 plans (multi-image ordering, mobile/layout polish for
  R100-R103) — this plan's file set (`SlidesTab.vue`, `SlidePlanRail.vue`, `SlideCard.vue`,
  `SlideActionMenu.vue`, `SlideGrid.vue`) does not overlap with `ServiceEditorView.vue` /
  `serviceEditorActionBar.ts` / `ContextualActionBar.vue` / `GettingStarted.vue`, which other Phase 48
  plans touch for R100-R103.

---
*Phase: 48-multi-image-ordering-mobile-polish*
*Completed: 2026-08-08*

## Self-Check: PASSED

All modified files and all three task commits (`ca8ca41`, `f82a5a2`, `2059cb7`) verified present.
