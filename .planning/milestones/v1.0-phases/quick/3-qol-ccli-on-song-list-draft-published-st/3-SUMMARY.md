---
phase: quick-3
plan: "01"
subsystem: ui
tags: [qol, song-list, service-card, service-editor, ccli, status-toggle]
dependency_graph:
  requires: []
  provides: [CCLI-column, past-service-filter, lock-icon-badge, status-toggle, compact-slots]
  affects: [SongTable, ServicesView, ServiceCard, ServiceEditorView]
tech_stack:
  added: []
  patterns: [inline-svg-lock, clickable-badge-toggle, computed-slice-limit]
key_files:
  created: []
  modified:
    - src/components/SongTable.vue
    - src/views/ServicesView.vue
    - src/components/ServiceCard.vue
    - src/views/ServiceEditorView.vue
decisions:
  - "CCLI column replaces BPM — BPM was low-value in song list; CCLI enables one-click SongSelect lookup"
  - "displayedPastServices slices to 5 but toggle button still shows total count — user sees scope of history without visual clutter"
  - "Status badge uses button element (not span) for semantic correctness and keyboard accessibility"
  - "Prayer/Message compact layout uses text-xs on helper text to visually match label size"
metrics:
  duration: 3
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 3: QoL — CCLI column, draft/planned toggle, past filter, compact slots Summary

**One-liner:** Four targeted UI improvements: CCLI link column in song list, past services capped at 5, lock icon on planned service badges, and single-line prayer/message slots with clickable status toggle.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | CCLI column in SongTable + past service filter | 685f681 | SongTable.vue, ServicesView.vue |
| 2 | Lock icon on ServiceCard + status toggle + compact slots | 9893665 | ServiceCard.vue, ServiceEditorView.vue |

## What Was Built

### Task 1: CCLI Column and Past Service Filter

**SongTable.vue**
- Replaced "BPM" column header with "CCLI"
- BPM cell replaced with CCLI cell: renders an `<a>` tag to `https://songselect.ccli.com/songs/{ccliNumber}` when ccliNumber is present
- Link styled `text-indigo-400 hover:text-indigo-300 hover:underline` with `target="_blank" rel="noopener"`
- Added `@click.stop` to prevent row selection when clicking the link
- Falls back to em dash when ccliNumber is falsy (matching prior BPM fallback behavior)

**ServicesView.vue**
- Added `displayedPastServices` computed that slices `pastServices.value` to first 5
- Changed `v-for` in past services grid from `pastServices` to `displayedPastServices`
- Toggle button count still shows full `pastServices.length` so users see total history count
- Past services were already hidden by default (`showPast = ref(false)`) — no change needed

### Task 2: Lock Icon, Status Toggle, Compact Slots

**ServiceCard.vue**
- Changed status badge from `inline-block` to `inline-flex items-center gap-1`
- Added inline SVG lock icon (heroicons mini lock-closed, h-3 w-3) inside the badge, shown only when `service.status === 'planned'`

**ServiceEditorView.vue**
- Replaced static `<span>` status badge with `<button type="button">` element
- Button has same badge classes plus `cursor-pointer hover:opacity-80 transition-opacity`
- Added `@click="toggleStatus"` handler
- Added lock icon inside button, shown only when `localService.status === 'planned'`
- Added `toggleStatus()` function that swaps `'draft'` <-> `'planned'`
- PRAYER slot: replaced two-line stacked layout with single `<div class="flex items-center gap-2">` containing label + `<span class="text-xs text-gray-600 italic">No assignment needed</span>`
- MESSAGE slot: same compact single-line treatment

## Verification

- `npx vue-tsc --noEmit`: passed, no type errors
- `npx vitest run`: 231 tests passed across 16 test files

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] src/components/SongTable.vue modified — CCLI column present
- [x] src/views/ServicesView.vue modified — displayedPastServices computed and v-for updated
- [x] src/components/ServiceCard.vue modified — lock icon on planned badge
- [x] src/views/ServiceEditorView.vue modified — toggleStatus, lock icon, compact slots
- [x] Commit 685f681 exists
- [x] Commit 9893665 exists
- [x] All 231 tests pass

## Self-Check: PASSED
