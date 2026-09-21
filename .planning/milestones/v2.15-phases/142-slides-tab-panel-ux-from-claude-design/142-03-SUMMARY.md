---
phase: 142-slides-tab-panel-ux-from-claude-design
plan: 03
subsystem: ui
tags: [vue, popover, chips, accessibility, focus-management]

# Dependency graph
requires:
  - phase: 142-01
    provides: "BackgroundControl variant='chip-popover' branch and SlotVideoOutputControl Display tiles — mounted directly inside two of the strip's three popovers"
  - phase: 142-02
    provides: "VampPicker allowUnattached, AudioPlayer loadedmetadata, and the reworked one-slot SlideGroupMusicControl (audioTab derivation, close emit, no slideCount prop) — mounted inside the Audio popover"
provides:
  - "SlideGroupSetupStrip.vue: the standalone, fully-tested chip-row + popover-shell component (Display · Background · Audio), composing the three Wave-1 controls with single-open-at-a-time state, Esc/click-outside/focus lifecycle, viewport-edge flip, and six passthrough emits"
  - "Locked/non-editor chip rendering (inert <span>, no caret, no aria-haspopup/aria-expanded, no popover mount) — supersedes the panel's old hide-when-locked behavior for music/background"
affects: [142-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "openChip: ChipId | null single-ref pattern for 'only one popover open at a time' — collapses SlideActionMenu.vue's per-item open/toggle shape into one shared ref across three siblings"
    - "watch(openChip) → add/remove document pointerdown + window keydown listeners, mirroring VampPickerSlideOver.vue's watch(open)→keydown lifecycle shape, extended to a second event type"
    - "Active-element-first fallback in a focus-target querySelector: check the semantically 'active' element (aria-selected=true) explicitly before falling back to 'first enabled control', rather than folding both into one combined CSS selector list (which returns DOM-first, not selector-priority-first)"

key-files:
  created:
    - src/components/slides/SlideGroupSetupStrip.vue
    - src/components/slides/__tests__/SlideGroupSetupStrip.test.ts
  modified:
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "focusIntoPopover() checks '[role=\"tab\"][aria-selected=\"true\"]' explicitly before falling back to the first enabled button/input, rather than combining both into one querySelector selector list — a combined list returns the first DOM match across ALL alternatives, not the first-listed selector, so a non-default active Audio tab (e.g. Vamp, not None) would otherwise wrongly focus the None tab. Found and fixed during Task 2's test design, before any test exposed it at runtime."
  - "vampNameFromLabel() strips the stored '{name} · {key}' bedVampLabel down to the bare name for the no-MP3 chip's '♪ {name} · no MP3' copy, via lastIndexOf(' · ') rather than re-deriving from the vamp library — matches the plan's specified fallback ('Vamp') for an empty label."
  - "The hover:border-indigo-700 pill class is appended whenever editable is true, including when the chip is the currently-open one (not suppressed for the open state) — the plan's action text specified this literally; UI-SPEC's state table doesn't contradict it, since it only documents the open state's border/bg pair, not its hover behavior."

patterns-established:
  - "Single shared open-state ref + one watch(...)-driven listener lifecycle for a row of sibling popovers, instead of N independent open booleans each running their own listener pair"

requirements-completed: [R032, R055, R425, R437]

coverage:
  - id: D1
    description: "SlideGroupSetupStrip renders the three chips in Display/Background/Audio order with every UI-SPEC state (set, unset/dashed 'Add', inherited-from-song '(song)', vamp-no-mp3 amber), the trailing slot, and the singular/plural scope caption"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupSetupStrip.test.ts#SlideGroupSetupStrip — chips (142)"
        status: pass
    human_judgment: false
  - id: D2
    description: "editable: false renders all three chips as inert <span>s (no caret, no aria-haspopup/aria-expanded/aria-label, no popover on click) while still showing real chip state, including the amber no-MP3 value — supersedes the old hide-when-locked rule"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupSetupStrip.test.ts#SlideGroupSetupStrip — chips (142) > editable: false renders all three chips as inert spans, no caret, no aria-* control attributes, and no popover on click"
        status: pass
    human_judgment: false
  - id: D3
    description: "Popover lifecycle: single-open-at-a-time, re-click closes, correct per-chip widths (258px audio / 232px display+background), focus-on-open (active Audio tab / first Display tile / Background None swatch), Esc closes and returns focus to the triggering chip, pointerdown outside closes (inside/on-chip does not), group-switch resets, viewport-edge flip, no Tab-close/focus-trap"
    requirement: "R425"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupSetupStrip.test.ts#SlideGroupSetupStrip — popover lifecycle (142)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Listener hygiene: pointerdown/keydown added exactly once on open, removed exactly once on close, and removed on unmount while a popover is still open (no leak)"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupSetupStrip.test.ts#SlideGroupSetupStrip — popover lifecycle (142) > pointerdown/keydown listeners are added once on open, removed once on close, and removed on unmount while open"
        status: pass
    human_judgment: false
  - id: D5
    description: "All six passthrough emits (attach-music, remove-music, attach-vamp, attach-background, remove-background, video-output-change) bubble the child controls' own emits unchanged, with the right props (variant, recents, inheritedFrom, audioUrl, bedVampId/Label, vamps, vampsLoading, isEditor, orgId) bound into each mounted control — the strip writes to no store"
    requirement: "R032"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupSetupStrip.test.ts#SlideGroupSetupStrip — passthrough emits (142)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual/interactive verification of the chip row and popovers in a real browser (colors, spacing, the edge-flip in a real viewport, keyboard focus ring, hover states) is a real-render judgment call, not something the unit suite proves"
    verification: []
    human_judgment: true
    rationale: "Unit tests assert DOM structure/classes/emits/ARIA attributes/listener lifecycle, not rendered visual fidelity in a real browser — deferred to this milestone's batched UAT per STATE.md's existing v2.15 deferred-verification convention, same as Plans 01/02"

# Metrics
duration: 15min
completed: 2026-09-19
status: complete
---

# Phase 142 Plan 03: SlideGroupSetupStrip.vue — chip row + popover shell Summary

**New standalone `SlideGroupSetupStrip.vue` composing wrapper — three chips (Display/Background/Audio) each opening its own absolutely-positioned popover hosting the Wave-1 controls, with single-open-at-a-time state, full Esc/click-outside/focus lifecycle, and six passthrough emits, proven by 26 unit tests before ever touching `SlideGrid.vue`.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-19T02:00:00Z (approx.)
- **Completed:** 2026-09-19T06:08:43Z
- **Tasks:** 2
- **Files modified:** 3 (2 planned + 1 doc)

## Accomplishments
- `SlideGroupSetupStrip.vue` renders the three chips (Display · Background · Audio) in fixed order, each computing its own pill/value classes and ARIA label from the UI-SPEC §1 state table — Set, Unset ("Add" dashed), Inherited-from-song ("{file} (song)"), Vamp-no-MP3 (amber "♪ {name} · no MP3"), and Open (indigo tint) — with the trailing slot and a correctly singular/plural "applies to all N slide(s)…" caption.
- Locked/non-editor mode renders all three chips as inert `<span>`s (no caret, no `aria-haspopup`/`aria-expanded`/`aria-label`, no click handler, no popover mount) — the new supersede-hide rule from CONTEXT.md, proven by a dedicated test.
- The popover shell hosts `SlotVideoOutputControl`, `BackgroundControl variant="chip-popover"`, and `SlideGroupMusicControl` per chip, at the exact 232px/258px widths, with `role="dialog"`/`aria-modal="false"`/`tabindex="-1"` and an `id`↔`aria-controls` pairing generated via `useId()`.
- Full lifecycle: `openChip: ChipId | null` single ref enforces one-popover-at-a-time; `pointerdown`/`keydown` listeners are added on open and removed on close/unmount (proven via `addEventListener`/`removeEventListener` spies, including the unmount-while-open case); Esc closes and returns focus to the triggering chip; a `selectedSlot.id` watcher resets `openChip` on group switch (mirroring `SlideGrid.vue`'s `openMenuEntryId` precedent, ADR-0115); `alignRight` is computed from `getBoundingClientRect()` on open, flipping the popover to `right-0` only when it would overflow the viewport.
- Focus-on-open lands on the semantically correct control per popover (the active Audio tab, the first Display tile, the Background None swatch) — a real gap in the naive combined-selector approach was caught and fixed during test design (see Deviations).
- All six passthrough emits (`attach-music`, `remove-music`, `attach-vamp`, `attach-background`, `remove-background`, `video-output-change`) are proven to relay the mounted child controls' own emits unchanged, with the right props bound through — the strip imports no store and calls no Firestore write.

## Task Commits

Each task was committed atomically:

1. **Task 1: SlideGroupSetupStrip.vue — chip row (state table, inert mode, caption) + popover shell + chip-state tests** - `2e4441cf` (feat)
2. **Task 2: Popover lifecycle + passthrough-emit tests (fixed a focus-target gap Task 1 left)** - `30da4e8a` (test)

_Both tasks were `tdd="true"`; each commit bundles its tests and implementation together, matching Plans 01/02's precedent — the RED/GREEN split was per-behavior within one task, not a separate test-then-feat commit pair._

## Files Created/Modified
- `src/components/slides/SlideGroupSetupStrip.vue` (NEW) — the chip row + popover shell component: `chips`/`scopeCaption` computeds, `openChip`/`alignRight`/`popoverRef`/`chipRefs`/`wrapperRefs` state, `toggle`/`close`/`closeAndRefocus`/`onKeydown`/`onPointerDown`/`focusIntoPopover` functions, the `openChip` and `selectedSlot.id` watchers
- `src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` (NEW) — 26 tests across three `describe` blocks: chips (12), popover lifecycle (11), passthrough emits (3)
- `.planning/codebase/ARCHITECTURE.md` — new `### src/components/slides/SlideGroupSetupStrip.vue` entry after the `SlideGroupMusicControl.vue` entry

## Decisions Made
- `focusIntoPopover()` checks `[role="tab"][aria-selected="true"]` explicitly, falling back to `button:not([disabled]), input:not([type="hidden"])` only if no active tab is found — a single combined `querySelector` selector list (as originally drafted from the task text) returns the first DOM match across ALL alternatives, not the first-*listed* selector, so it would have focused the "None" tab (the first `<button>` in the popover) even when "Vamp" was the actually-active tab. Caught and fixed while designing Task 2's focus test, before it ever shipped as a bug.
- `vampNameFromLabel()` strips the stored `{name} · {key}` `bedVampLabel` down to the bare name via `label.lastIndexOf(' · ')`, falling back to `'Vamp'` for an empty label — exactly as the plan specified, not re-derived from the vamp library (the label is stored denormalized and may be stale by design, same as everywhere else it renders).
- The `hover:border-indigo-700` pill class is appended whenever `editable` is true, unconditionally (including the open state) — matches the plan's action text literally; the UI-SPEC state table documents the open state's border/bg pair but doesn't forbid a hover class alongside it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed focus-target selector priority before it ever shipped as a runtime bug**
- **Found during:** Task 2, while designing the focus-on-open test (`Audio: active tab`)
- **Issue:** Task 1's `focusIntoPopover()` used one combined `querySelector('[role="tab"][aria-selected="true"], button:not([disabled]), input:not([type="hidden"])')` call. `querySelector` with a comma-separated selector list returns the first element in **document order** that matches *any* alternative — not the first-listed alternative. Since the three Audio segmented-control tabs (`None`/`Track`/`Vamp`) are all plain enabled `<button>`s and appear before the tab content, this would always return the **first** tab (`None`) regardless of which tab actually carried `aria-selected="true"`. The bug was invisible in the naive default-state test (where `None` genuinely is both first-in-DOM and active) — exactly the "warning sign" pattern the plan calls out for latent gaps.
- **Fix:** Split into two calls — `el.querySelector('[role="tab"][aria-selected="true"]')` first, falling back to `el.querySelector('button:not([disabled]), input:not([type="hidden"])')` only if no active tab is found. Kept inside `focusIntoPopover()`, no template/structural change.
- **Files modified:** `src/components/slides/SlideGroupSetupStrip.vue`
- **Verification:** `npx vitest run src/components/slides/__tests__/SlideGroupSetupStrip.test.ts` — 26/26 pass, including the focus-on-open test asserting `group-music-audio-tab-none` with `aria-selected="true"`
- **Committed in:** `30da4e8a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a real correctness gap in the focus-target selector, caught during test design rather than left latent)
**Impact on plan:** No scope creep — the fix stays entirely inside `focusIntoPopover()`, the exact function Task 1 defined for this purpose; no template or emit-contract change.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `SlideGroupSetupStrip.vue` is complete, fully tested in isolation, and composes the three finished Wave-1 controls with zero store imports — Plan 04 can mount it directly into `SlideGrid.vue`'s panel as a pure wiring change (gate simplification to `Boolean(selectedSlot)`, six passthrough-emit handlers rewired, `recentBackgrounds`/`inheritedBackground` props threaded through), rather than a build.
- `npm run type-check` (vue-tsc --build) is clean.
- This plan touched neither `SlideGrid.vue` nor `SlideGrid.test.ts` — both remain exactly as Plan 02 left them, ready for Plan 04's migration.
- No blockers for Plan 04.

## Self-Check: PASSED

Both created files confirmed present on disk (`src/components/slides/SlideGroupSetupStrip.vue`,
`src/components/slides/__tests__/SlideGroupSetupStrip.test.ts`); both commit hashes (`2e4441cf`,
`30da4e8a`) confirmed in `git log`.

---
*Phase: 142-slides-tab-panel-ux-from-claude-design*
*Completed: 2026-09-19*
