---
phase: 33-backgrounds-slide-editing
plan: 05
subsystem: ui
tags: [vue, slides, aria, accessibility, tailwind]

# Dependency graph
requires:
  - phase: 33-backgrounds-slide-editing (33-01)
    provides: "SlideBase.backgroundImageUrl / backgroundSource resolved by resolveEntryMedia"
  - phase: 33-backgrounds-slide-editing (33-02)
    provides: "slideActionMenuItems() + SlideActionMenu.vue, unit-tested in isolation"
provides:
  - "SlideCard.vue root is a role=\"button\" div, legally hosting SlideActionMenu's real button trigger"
  - "SlideCard.vue menuItems/menuOpen props + menu-toggle/menu-select emits (grid-consumable, no wiring yet)"
  - "Background provenance chip (slide-card-background-chip) reading assembledSlide.slide.backgroundSource directly"
affects: [33-08 SlideGrid.vue, 33-09 SlidesTab.vue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "role=\"button\" div + @click/@keydown.enter/@keydown.space in place of a native <button> whenever an interactive child must nest inside"
    - "Chip color pair derived via a static ternary bound to :class, never string interpolation (Tailwind v4 purge safety)"

key-files:
  created: []
  modified:
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts

key-decisions:
  - "Both tasks landed in a single commit (55d6b6c) rather than two, since Task 2's chip markup sits immediately adjacent to Task 1's closing-tag change in the same file — a clean line-level split wasn't achievable without manual patch surgery"

patterns-established:
  - "Card holds no menu open-state of its own — menuOpen is a prop so the parent grid can enforce exactly one open menu with a single ref"

requirements-completed: [R051, R056, R063]

coverage:
  - id: D1
    description: "SlideCard.vue's root element is a role=\"button\" div (not a native <button>), preserving click/Enter/Space activation identically"
    requirement: "R051"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#root element (role=\"button\" div, 33-05 Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SlideActionMenu mounts as a direct, non-clipped child of the card root and renders only when menuItems is non-empty, relaying toggle/select emits with the slide id prepended"
    requirement: "R051"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#SlideActionMenu mounting (33-05 Task 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Background provenance chip renders the three exhaustive variants (Background/From group/From song) from backgroundSource, colour-coded indigo vs gray, absent when unresolved, reactive to prop changes with no manual refresh"
    requirement: "R056"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#background provenance chip (33-05 Task 2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The card composites no background image behind its preview (chip-only answer to provenance legibility, per phase scope reminder)"
    requirement: "R056"
    verification:
      - kind: unit
        ref: "grep -c 'background-image\\|bg-cover' src/components/slides/SlideCard.vue == 0"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-03
status: complete
---

# Phase 33 Plan 05: SlideCard root swap + menu mount + background provenance chip Summary

**Swapped `SlideCard.vue`'s root from a native `<button>` to a `role="button"` div so `SlideActionMenu` can legally nest, and added a three-variant background provenance chip read directly off the assembled slide.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-03T04:12:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `SlideCard.vue`'s root element is now `<div role="button" tabindex="0">` with `@click`/`@keydown.enter`/`@keydown.space.prevent` reproducing native button activation exactly (Space no longer scrolls the page). Every existing class, `data-testid`, `data-selected`, and the `select` emit's payload stayed byte-identical.
- `SlideActionMenu` mounts as a direct child of the card root (wrapped in `absolute right-1 top-1 z-10`), outside the `overflow-hidden` preview box, and renders only when `menuItems.length > 0`. The number badge moved `right-1.5` → `right-9` to make room. New `menuItems?`/`menuOpen?` props (both default empty/false) and `menu-toggle`/`menu-select` emits (slide id prepended) are wired but not yet consumed by any parent — that's Wave 3's job (`SlideGrid.vue`, `SlidesTab.vue`).
- A background provenance chip (`slide-card-background-chip`) sits beside the existing audio chip (`ml-1.5`, not `ml-auto`, one size step down at `text-[10px]`), showing `Background` (indigo, own) / `From group` (gray, inherited) / `From song` (gray, inherited), and rendering nothing when `backgroundSource` is unresolved. It's a computed reading `props.assembledSlide.slide.backgroundSource` directly — no local cache, no re-derivation — so it recomputes for free whenever the assembled slideshow does.
- The card composites no background image anywhere; a comment beside the chip records why, for a future reader.

## Task Commits

Both tasks landed in a single commit — see Deviations for why a clean per-task split wasn't achievable.

1. **Task 1 + Task 2: root swap, menu mount, background chip** - `55d6b6c` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/slides/SlideCard.vue` - root `<button>` → `role="button"` div; `SlideActionMenu` mounted outside the clipped preview; number badge repositioned; background provenance chip added
- `src/components/slides/__tests__/SlideCard.test.ts` - added activation-semantics (tagName/role/tabindex, Enter, Space+preventDefault), menu-rendering-gated-on-items, menu-relay (toggle/select), and background-chip (three variants, absence, reactive removal, coexistence-with-audio-chip) cases; 15 → 29 tests

## Decisions Made

- Kept both tasks in one commit: Task 2's chip markup is adjacent to Task 1's `</button>` → `</div>` closing-tag change in the diff, so a clean hunk-level split into two commits wasn't achievable without manual patch surgery. Documented as a process deviation below (not a code-correctness issue).
- Used `wrapper.element.dispatchEvent(new KeyboardEvent(...))` directly for the Space-key `preventDefault` assertion, since `@vue/test-utils`'s `trigger()` helper doesn't expose the dispatched event object for inspection.

## Deviations from Plan

### Process deviations (not covered by Rules 1-4 — commit granularity only)

**1. Single commit instead of two per-task commits**
- **Found during:** Task commit step, after both tasks were already applied to the working tree
- **Issue:** The plan's task-commit protocol expects one commit per task, but Task 2's chip `<span>` and its surrounding comment sit immediately before the `</div>` closing tag that Task 1 changed from `</button>`, producing overlapping diff hunks
- **Fix:** Committed both tasks together as `55d6b6c`, with a commit message body that separately describes Task 1's and Task 2's changes
- **Files modified:** `src/components/slides/SlideCard.vue`, `src/components/slides/__tests__/SlideCard.test.ts`
- **Verification:** Both tasks' acceptance criteria independently verified before committing (see below)
- **Committed in:** `55d6b6c`

---

**Total deviations:** 1 process deviation (commit granularity), 0 code-correctness deviations.
**Impact on plan:** None on functionality — every acceptance criterion for both tasks passed independently before the combined commit was made.

## Issues Encountered

None.

## Keyboard Operability Through the Tag Change

The native `<button>` gave click, Enter-activation, and Space-activation (with automatic scroll suppression) for free. The `role="button"` div reproduces all three explicitly:
- `@click="emit('select', ...)"` — unchanged from before.
- `@keydown.enter="emit('select', ...)"` — new, fires on Enter.
- `@keydown.space.prevent="emit('select', ...)"` — new; the `.prevent` modifier stops the page from scrolling, which a native button also suppresses by default.
- `tabindex="0"` keeps the div in the normal tab order (a native button is focusable by default; a div is not without this).

This is a like-for-like semantic swap per 33-UI-SPEC.md's Accessibility Note — screen readers announce a `role="button"` div identically to a native button for activation purposes. Verified by three dedicated tests: tagName/role/tabindex assertion, an Enter-triggered `select` emit, and a Space-triggered `select` emit with `event.defaultPrevented === true`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SlideCard.vue` is ready for Wave 3 (`SlideGrid.vue` 33-08, `SlidesTab.vue` 33-09) to consume: pass `menuItems`/`menuOpen` per card, listen for `menu-toggle`/`menu-select`, and route the latter to drawer-open/duplicate/delete/navigate handlers. The card itself decides nothing about menu contents or gating — that's entirely `slideActionMenuItems`'s job (already shipped, 33-02).
- The background chip is fully wired to `backgroundSource` and needs no further work from downstream plans; 33-06/33-07/33-08 write the values that make it non-empty (`setSongBackground`, drawer background section, `setGroupBackground`), and this chip will reflect them automatically once those land, with zero changes to `SlideCard.vue`.
- No blockers.

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: src/components/slides/SlideCard.vue
- FOUND: src/components/slides/__tests__/SlideCard.test.ts
- FOUND: .planning/phases/33-backgrounds-slide-editing/33-05-SUMMARY.md
- FOUND: 55d6b6c (git log)
