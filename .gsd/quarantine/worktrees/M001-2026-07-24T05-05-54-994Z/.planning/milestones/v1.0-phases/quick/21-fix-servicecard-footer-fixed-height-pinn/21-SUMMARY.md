---
phase: quick-21
plan: "01"
subsystem: services-ui
tags: [css, flex, layout, servicecard, ui-fix]
dependency_graph:
  requires: []
  provides: [pinned-footer-servicecard]
  affects: [ServicesView.vue]
tech_stack:
  added: []
  patterns: [flex-col-layout, h-full-grid-stretch]
key_files:
  created: []
  modified:
    - src/components/ServiceCard.vue
    - src/components/__tests__/ServiceCard.test.ts
decisions:
  - "CSS grid provides equal row heights; flex-col within card pins footer without JS"
  - "h-full on card root stretches to fill grid cell; flex-1 on body pushes footer down; shrink-0 on footer keeps fixed height"
metrics:
  duration: 3
  completed: "2026-03-04"
  tasks_completed: 2
  files_modified: 2
---

# Phase Quick-21 Plan 01: Fix ServiceCard Footer Fixed-Height Pinning Summary

**One-liner:** CSS-only flex-col fix — `h-full`, `flex-1`, `shrink-0` pin the share/print footer to the bottom of every ServiceCard regardless of slot count.

## What Was Built

Applied three Tailwind class additions to `ServiceCard.vue` to ensure the share/print footer is always pinned to the bottom of each card in the ServicesView grid:

1. **Root div** (`flex flex-col h-full`) — stretches the card to fill the CSS grid cell height and enables vertical flex layout
2. **Router-link body** (`flex-1 min-h-0`) — makes the content area grow to consume all available vertical space, pushing the footer to the bottom
3. **Footer div** (`shrink-0`) — prevents the footer from compressing when content is tall, ensuring consistent fixed height

The CSS grid in ServicesView already equalizes row heights; the fix leverages that by making each card's internal layout use flex column so the footer aligns across all cards in a row.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Apply flex-col layout to ServiceCard for pinned footer | 6c6b2e4 | src/components/ServiceCard.vue |
| 2 | Add test verifying flex layout structure | b51d273 | src/components/__tests__/ServiceCard.test.ts |

## Verification

- All 7 ServiceCard tests pass (6 existing + 1 new)
- New test "uses flex-col layout with pinned footer" confirms `flex`, `flex-col`, `h-full` on root; `flex-1` on body anchor; `shrink-0` on footer

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/components/ServiceCard.vue` modified with `flex flex-col h-full`, `flex-1 min-h-0`, `shrink-0`
- [x] `src/components/__tests__/ServiceCard.test.ts` updated with new layout test
- [x] Commit 6c6b2e4 exists (Task 1)
- [x] Commit b51d273 exists (Task 2)
- [x] All 7 tests pass

## Self-Check: PASSED
