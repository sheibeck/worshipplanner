---
phase: 33-backgrounds-slide-editing
plan: 02
subsystem: ui
tags: [vue3, aria, accessibility, slideDisplay, slide-action-menu]

# Dependency graph
requires:
  - phase: 33-01
    provides: backgroundImageUrl on GroupSlideEntry/SlideGroup/SongLyrics, resolved backgroundImageUrl/backgroundSource on SlideBase via resolveEntryMedia
provides:
  - "slideActionMenuItems(entry, planItemKind, canMutate) — pure per-kind 3-dot menu item list, exhaustive over UI-SPEC §3's table including the Hymn discriminator"
  - "backgroundImageLabel(url) — Storage-URL-to-filename decoder mirroring bedAudioLabel with its own fallback"
  - "SlideActionMenu.vue — presentational, parent-controlled ARIA menu (role=menu/menuitem, aria-haspopup, aria-expanded, Escape-closes-returns-focus)"
affects: [33-05 SlideCard.vue wiring, 33-07 EditSlideDrawer.vue mode split, 33-08 SlideGrid.vue openMenuEntryId, 33-09 SlidesTab.vue onMenuAction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure per-kind helper convention (slideDisplay.ts) extended with a discriminator that reads sourceRef.body, not just sourceRef.kind, for the Hymn refinement"
    - "First real ARIA menu in this codebase: role=menu/menuitem, aria-haspopup, aria-expanded, Escape-closes-and-returns-focus via a local (non-global) keydown handler"

key-files:
  created:
    - src/components/slides/SlideActionMenu.vue
    - src/components/slides/__tests__/SlideActionMenu.test.ts
  modified:
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts

key-decisions:
  - "canMutateBackground (UI-SPEC §3's stated 4th parameter) is NOT threaded into slideActionMenuItems — nothing in §3's table branches on it, and an unused trailing parameter would trip the lint config's args:'after-used' rule. Recorded in the function's own doc comment so a reviewer does not 'restore' it."
  - "The Hymn discriminator is `entry.sourceRef.body !== undefined` combined with `planItemKind`, not `sourceRef.kind` alone — implemented as `hasBody || planItemKind === 'PRAYER' || planItemKind === 'MESSAGE'`, which simultaneously satisfies the undefined-planItemKind backstop (falls through to the conservative branch) without a separate isPristineHymn variable."
  - "Dropped the literal ref=\"panelRef\" template ref from UI-SPEC §2's markup — Escape handling only needs @keydown on the panel div directly, and an unused script-side ref would trip vue/no-unused-refs. Functionally identical; every other class/attribute/data-testid in §2's markup is reproduced verbatim."

patterns-established:
  - "Menu item list is a pure function testable without mounting — the card, the grid, and the tests all read one table instead of three copies of a switch"

requirements-completed: [R051, R052, R063]

coverage:
  - id: D1
    description: "slideActionMenuItems returns the exhaustive per-kind item list from UI-SPEC §3's table, including the Hymn discriminator (pristine vs hand-added) and P-03 (lyric/copyright never offer a write affordance, even when canMutate is true)"
    requirement: "R063"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#slideActionMenuItems (R063, 33-UI-SPEC.md §3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "backgroundImageLabel decodes a Firebase Storage download URL to its filename, falling back to 'Background image' on a malformed URL"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#backgroundImageLabel"
        status: pass
    human_judgment: false
  - id: D3
    description: "SlideActionMenu.vue is a parent-controlled ARIA menu — role=menu panel, role=menuitem items, aria-haspopup/aria-expanded on a real button trigger, Escape closes and returns focus to the trigger, click-away backdrop closes, trigger click does not bubble to an ancestor handler"
    requirement: "R051"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideActionMenu.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Menu items are tone-colored (nav indigo, destructive red, default gray) and the fixed w-40/right-0 panel cannot overflow the narrowest 200px card"
    requirement: "R052"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideActionMenu.test.ts#backstop tests"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-02
status: complete
---

# Phase 33 Plan 02: SlideActionMenu building blocks Summary

**Pure per-kind 3-dot menu item list (`slideActionMenuItems`) plus the codebase's first real ARIA menu component (`SlideActionMenu.vue`), both fully unit-tested and unwired — no existing surface changed yet.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-02T23:30:00-04:00 (approx)
- **Completed:** 2026-08-02T23:39:13-04:00
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `slideActionMenuItems(entry, planItemKind, canMutate)` in `slideDisplay.ts` — exhaustive over all 6 `sourceRef.kind` members (lyric, copyright, scripture, text, imported, video) plus the Hymn refinement, with two conservative backstops (undefined `planItemKind`, unrecognized `sourceRef.kind`) and structural P-03 enforcement (lyric/copyright never offer duplicate/delete/edit-lyrics, asserted even with `canMutate: true`)
- `backgroundImageLabel(url)` — Storage-URL-to-filename decoder, sibling to `bedAudioLabel` with its own fallback text
- `SlideActionMenu.vue` — presentational, parent-controlled ARIA menu reproducing UI-SPEC §2's markup verbatim: real `<button>` trigger with `aria-haspopup="menu"`/`aria-expanded`, `role="menu"` panel with `role="menuitem"` items, Escape-closes-and-returns-focus via a local keydown handler, click-away backdrop, `@click.stop` on the trigger (borrowing `SlideCard.vue:47`'s drag-grip idiom)

## Task Commits

Each task was committed atomically:

1. **Task 1: slideActionMenuItems and backgroundImageLabel in slideDisplay.ts** - `e12ada5` (feat)
2. **Task 2: SlideActionMenu.vue — the codebase's first real ARIA menu** - `6421cbf` (feat)

## Files Created/Modified
- `src/components/slides/slideDisplay.ts` - added `MenuItemKey`, `MenuItem`, `slideActionMenuItems()`, `backgroundImageLabel()`
- `src/components/slides/__tests__/slideDisplay.test.ts` - 14 new test cases covering every behavior in Task 1's list, plus 2 for `backgroundImageLabel`
- `src/components/slides/SlideActionMenu.vue` - new component, no existing consumers yet
- `src/components/slides/__tests__/SlideActionMenu.test.ts` - 11 test cases: open/close, per-item emit, Escape-returns-focus, tone classes, both overflow backstops

## Decisions Made
- `canMutateBackground` (UI-SPEC §3's stated 4th parameter) intentionally NOT threaded — nothing in §3's table branches on it, and it would be an unused-and-therefore-lint-flagged parameter. Recorded in the function's doc comment.
- Hymn discriminator implemented as a single boolean expression (`hasBody || planItemKind === 'PRAYER' || planItemKind === 'MESSAGE'`) rather than a separate `isPristineHymn` flag — simpler and covers the undefined-`planItemKind` backstop for free, since `undefined` matches neither `'PRAYER'` nor `'MESSAGE'`.
- Dropped the unused `ref="panelRef"` template ref from UI-SPEC §2's literal markup — the panel's `@keydown` handler doesn't need to read the ref back, and an unused script-side `ref()` would trip `vue/no-unused-refs`. This is the one point of divergence from §2's markup; every class, `data-testid`, and structural element is reproduced verbatim.

## Deviations from Plan

None beyond the two decisions documented above (both are minor, mechanical, and explicitly called for a "record, don't restore" treatment in the plan itself — not unplanned work).

## Issues Encountered
None.

## Coverage of the plan's must-have truths
- **Hymn discriminator (E2 partial backstop):** `Hymn discriminator: a still-pristine Hymn text entry (no body) excludes edit-lyrics; a hand-added blank one (body: "") includes it` — both sides asserted in one test, per the plan's named-test requirement.
- **P-03 (never a write affordance on a song group's slides):** two dedicated tests assert exactly `['edit-details', 'edit-in-song']` for `lyric` and `copyright` with `canMutate: true`.
- **Backstops:** unknown source kind → `['edit-details']` only; `planItemKind: undefined` with undefined body → no `edit-lyrics`; panel width/anchor (`w-40`, `right-0`) and longest-label-length checks both pass.
- **Mutation gating:** `duplicate`/`delete` are absent as KEYS (not present-and-disabled) across all four mutation-eligible kinds when `canMutate: false` — verified in a loop test over scripture/text/imported/video.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `slideActionMenuItems` and `MenuItem`/`MenuItemKey` types are ready for 33-05 (`SlideCard.vue` wiring), 33-08 (`SlideGrid.vue`'s `openMenuEntryId` + per-card `SlideActionMenu` mount), and 33-09 (`SlidesTab.vue`'s `onMenuAction` handler) to import from `./slideDisplay`.
- `SlideActionMenu.vue`'s prop/emit contract (`entryId`, `items`, `open` / `toggle`, `select`) is stable and unit-tested in isolation — no consumer wiring exists yet, by design (this plan adds capability, it does not change any existing surface, per the plan's own `<verification>` note).
- No blockers for downstream waves. `EditSlideDrawer.vue`'s `mode` split (33-07), the background controls (33-03/33-06/33-08), and the `SlideCard.vue` structural fix (33-05, `<button>` → `<div role="button">`) are all independent of this plan's two artifacts and can proceed in parallel per the phase's wave plan.

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created files verified present on disk; both task commits (`e12ada5`, `6421cbf`) verified present in `git log`.
