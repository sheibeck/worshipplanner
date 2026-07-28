---
phase: 25
plan: 04
subsystem: slides-tab
tags: [vue, service-editor, slide-grid, slide-card, ui-spec, tailwind-v4]
dependency-graph:
  requires: [25-03]
  provides: [SlideCard, SlideGrid, slideBodyText, slideFooterLabel, PendingReconciliation-shared]
  affects: [SlidesTab]
tech-stack:
  added: []
  patterns:
    - "CSS Grid (`grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`) — first CSS-grid layout surface in the app, no in-repo precedent to reconcile against"
    - "Shared slideDisplay.ts helpers (slideBodyText/slideFooterLabel) avoid a third local copy of the lyric/copyright shape-narrowing (sectionId presence) that SlideshowPreview.vue and PresentationViewer.vue each already carry"
    - "Slot ARRAY index (not groupId, not position) is the join key SlideGrid filters assembledSlideshow by — groupId is absent until a group's Firestore snapshot lands"
key-files:
  created:
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts
  modified:
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts
decisions:
  - "Added slideBodyText() and slideFooterLabel() to the shared slideDisplay.ts module (25-03) rather than inlining the lyric/copyright shape narrowing a third time in SlideCard.vue"
  - "Centralized the PendingReconciliation interface in slideDisplay.ts (previously a local duplicate inside SlidesTab.vue from 25-03) so SlidesTab.vue and SlideGrid.vue share one copy instead of each carrying its own — still never imported from useSlideshowAssembly.ts itself"
  - "The card's kind badge (SlotKind, shared static class map) and its content-kind label (contentKind-based, e.g. VERSE 1/TITLE/IMAGE/VIDEO) are two distinct elements per the plan's own D-10 mapping — kind badge lives in the footer, content label is the plain accent text over the preview"
  - "Reconciliation notice count uses the reconciler's own loss.customizedEntries when present, falling back to proposed.length — no apply/reject/confirm affordance of any kind (Phase 26's job)"
metrics:
  duration: "~2h"
  completed: 2026-07-26
status: complete
---

# Phase 25 Plan 04: Slide Grid, Card and Selection Round Trip Summary

Shipped R031's right half: `SlideCard.vue` (per-kind text body, slot-kind badge, one-based number,
footer label, accessible-name audio chip) and `SlideGrid.vue` (slot-array-index filtering, the
mockup's three-line header, CSS Grid layout, D-08 empty state, a passive non-blocking reconciliation
notice), mounted into `SlidesTab.vue`'s content column with the card-selection round trip closed —
the D-12 seam Phase 26's Edit Slide drawer will open against.

## What Was Built

**`src/components/slides/SlideCard.vue`** — presentational, prop-driven (`assembledSlide`, `number`,
`selected`), holds no selection state of its own. A fixed-height (`h-[140px]`, `overflow-hidden`)
preview region carries the content-kind label (top-left, plain accent text per the UI-SPEC's
developer-approved `text-[10px]` exception) and the slide's body text (`line-clamp-6`, never scrolled
or shrunk); a slide-number chip sits top-right. A footer line (`gap-1.5`, the UI-SPEC's other approved
exception) carries the slot-kind badge (reusing `KIND_BADGE_CLASSES`, the same static map the rail
uses), a natural-case footer label, and — only when the slide carries audio — an icon-only chip with
`aria-label="Slide has audio attached"`. Clicking anywhere on the card emits `select` with the slide's
id; only the selected card carries `border-indigo-500`.

**`src/components/slides/SlideGrid.vue`** — presentational, prop-driven, reads no store and calls no
composable. Filters `assembledSlideshow` by the selected plan item's `slotIndex` (never `groupId`, per
25-RESEARCH.md Pitfall 2 — `groupId` is unset for the entire window before a group's Firestore
snapshot lands, even though the fallback-path slides being shown are already real and correct), numbers
cards from one within the group, and renders the header's three lines verbatim from the mockup: the
group title (collapsed to just the kind label when the slot has no title of its own beyond its kind,
e.g. "Prayer" vs. "Song — This Is Our God"), the `group N of M · follows plan` position chip, and the
`Plays 1 → N, left to right then down` reading-order line (omitted when there are zero cards). Renders
the D-08 empty state (`No slides in this group yet` / `Add a slide, or drop a file below.`) instead of
cards when the filtered list is empty — no drop tile (that's 25-06). A passive, non-blocking
reconciliation notice renders only when a `pendingReconciliations` entry's `slotId` matches the
selected plan item, using the entry's own loss count; no apply/reject/confirm control renders anywhere
near it (Phase 26 owns that, R033), and cards stay selectable while it's showing. Ships no Grid/List
toggle (D-09). The `group` and `isEditor` props are accepted and threaded through unused — reserved for
25-05/25-06's group-header actions and group-music control, exactly as the plan's objective describes.

**`src/components/slides/slideDisplay.ts`** — extended with two new exports `SlideCard` consumes rather
than narrowing `contentKind` inline a third time (`SlideshowPreview.vue` and `PresentationViewer.vue`
each already carry their own local lyric/copyright shape-narrowing copy):
- `slideBodyText(slide)` — main preview-body text per kind (joined lyric lines / copyright title /
  `reference\ntext` for scripture / text body / a `Video: {filename}` or `Video` string for video;
  image slides render their own `<img>` in the card and don't consume this).
- `slideFooterLabel(slide)` — natural-case (non-eyebrow) label for the card footer, distinct from the
  existing uppercase `slideContentLabel`.
- `PendingReconciliation` — the confirm-required-reconciliation shape, moved here from a local copy
  25-03 had duplicated directly inside `SlidesTab.vue`, so `SlidesTab.vue` and `SlideGrid.vue` now
  share one definition. Still never imported from `useSlideshowAssembly.ts` itself — `git grep -n
  "useSlideshowAssembly" src/components/slides/` returns nothing.

**`src/components/slides/SlidesTab.vue`** — mounts `SlideGrid` in the content column in place of the
empty placeholder `<div>` 25-03 left. Computes `selectedSlot` (the full plan item), `selectedSlotPosition`
(one-based position among plan items, independent of `selectedSlotArrayIndex` — the two coincide for a
well-formed service and diverge for one whose stored `position` values have drifted from array order),
and `selectedGroup` (`groupsBySlotId.get(selectedSlotId)`), all as new computeds threaded down to the
grid. A new `onSelectSlide` handler writes `selectedSlideId` when the grid emits a card selection, and
that same id flows back down so the grid marks the matching card selected — the whole of D-12's round
trip for this phase.

## Deviations from Plan

None — the plan executed as written for all three tasks. The two additions to `slideDisplay.ts`
(`slideBodyText`, `slideFooterLabel`) were explicitly anticipated by the plan's own action text ("If
the shared module from 25-03 does not yet expose a body-text helper, add one there rather than
inlining the narrowing here"), not an unplanned deviation. Moving `PendingReconciliation` out of
`SlidesTab.vue`'s local copy and into `slideDisplay.ts` is a small refactor made in passing while
wiring `SlideGrid.vue` to the same shape — both files needed it, and duplicating a third time seemed
worse than centralizing it in the module built for exactly this kind of shared shape.

## Known Stubs

- `SlideGrid.vue` accepts `group: SlideGroup | null` and `isEditor: boolean` props but does not yet
  render anything from them (no group-music bar, no `＋ Add slide` / `⇪ Import into this group`
  buttons). This is NOT a gap in this plan — the plan's own objective text states this explicitly:
  "The group header's action buttons land with their behaviour in 25-05 and 25-06 rather than as dead
  controls here." Both props are threaded through now so 25-05/25-06 don't need a second prop-wiring
  pass through `SlidesTab.vue`.
- The drop tile that completes the D-08 empty state (`＋ drop`) is not rendered — per the plan's
  objective, it lands in 25-06 alongside the drop target.

## Verification

- `npx vitest run src/components/slides/` — 70 tests, all passing (13 SlideCard + 10 SlideGrid + 10
  SlidePlanRail + 25 slideDisplay + 12 SlidesTab).
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 45 tests, all passing (the tab
  wiring from 25-03 still holds; the two `.gsd/quarantine/worktrees/**` copies of this same test file
  fail as documented baseline, unrelated to this plan).
- `npx vitest run src/` — 10 failed test files (matches the documented baseline exactly: 8 under
  `.gsd/quarantine/worktrees/**`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`);
  152 passed test files, 3235 passed tests; did not grow past baseline.
- `npm run type-check` — 0 errors (`vue-tsc --build`, covering both `tsconfig.app.json` and
  `tsconfig.vitest.json`).
- `npm run build` — succeeds (`vite build` completed; the pre-existing >500kB chunk warning is
  unrelated to this plan).
- `git grep -n "useSlideshowAssembly" src/components/slides/` — returns nothing.

## Self-Check: PASSED

- FOUND: `src/components/slides/SlideCard.vue`
- FOUND: `src/components/slides/__tests__/SlideCard.test.ts`
- FOUND: `src/components/slides/SlideGrid.vue`
- FOUND: `src/components/slides/__tests__/SlideGrid.test.ts`
- FOUND: `src/components/slides/slideDisplay.ts` (modified)
- FOUND: `src/components/slides/SlidesTab.vue` (modified)
- FOUND commit aaa8bc4 (Task 1 — SlideCard)
- FOUND commit 86ff0ba (Task 2 — SlideGrid)
- FOUND commit f1e7563 (Task 3 — SlidesTab wiring)
