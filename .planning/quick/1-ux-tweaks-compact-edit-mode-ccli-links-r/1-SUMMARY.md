---
phase: quick
plan: 1
subsystem: ui
tags: [ux, service-editor, service-card, song-slide-over, ccli, grid-layout]
dependency_graph:
  requires: []
  provides: [compact-service-editor, ccli-links, grid-service-list, share-print-card-buttons]
  affects: [ServiceEditorView, ServicesView, ServiceCard, SongSlideOver]
tech_stack:
  added: []
  patterns: [css-grid-responsive, ccli-songselect-url, clipboard-api, window-print]
key_files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/ServicesView.vue
    - src/components/ServiceCard.vue
    - src/components/SongSlideOver.vue
decisions:
  - ServiceCard rewritten as vertical compact card; esvLink removed from card (keeps it compact)
  - getCcliNumber implemented as plain function (not computed) since it takes a parameter
  - Arrangement functions removed from SongSlideOver but form.arrangements kept for data preservation
  - Print from ServiceCard navigates to editor view then calls window.print() after 300ms
metrics:
  duration: 12
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 1: UX Tweaks — Compact Editor, CCLI Links, Grid List Summary

**One-liner:** Compact service editor with CCLI SongSelect links, arrangements removed from song editor, and service list converted to responsive grid cards with Share/Print buttons.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Compact ServiceEditorView + CCLI links + remove arrangements from SongSlideOver | f6be3be | ServiceEditorView.vue, SongSlideOver.vue |
| 2 | Grid service list with Share/Print buttons on ServiceCard | c2c874d | ServicesView.vue, ServiceCard.vue |

## What Was Built

### Task 1 — Compact ServiceEditorView + CCLI Links

**ServiceEditorView.vue:**
- Reduced outer padding from `py-8` to `py-4`
- Back link changed from `mb-5` to `mb-3`
- Header section changed from `mb-6` to `mb-3`
- Team Configuration: padding `p-4` to `p-3`, margin `mb-6` to `mb-3`, label `mb-3` to `mb-2`
- Sermon Passage: padding `p-4` to `p-3`, margin `mb-6` to `mb-3`
- Slot list: `space-y-3` to `space-y-1.5`, slot cards `p-4` to `p-3`, header `mb-2` to `mb-1`
- Bottom save: `mt-6` to `mt-3`
- Added `getCcliNumber(songId)` helper function
- Assigned song slots now show "Key: X | CCLI 12345" with CCLI as clickable link to `https://songselect.ccli.com/songs/{ccliNumber}`

**SongSlideOver.vue:**
- Removed entire Arrangements section from template (label, Add Arrangement button, empty state, ArrangementAccordion loop)
- Removed `ArrangementAccordion` import
- Removed `addArrangement`, `updateArrangement`, `removeArrangement` functions
- `form.arrangements` preserved in FormState for data integrity on save
- `Arrangement` type import retained (used in FormState interface)

### Task 2 — Grid Service List + ServiceCard Redesign

**ServicesView.vue:**
- Upcoming services container: `space-y-2` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`
- Past services container: same grid change

**ServiceCard.vue (full rewrite):**
- New compact vertical card layout with date header, compact slot summary, and action footer
- Cards no longer wrapped in top-level `<router-link>` — router-link is inside card body only
- Footer Share and Print buttons are outside the router-link to prevent navigation on click
- Share: calls `serviceStore.createShareToken`, copies URL to clipboard, shows "Copied!" for 2 seconds
- Print: navigates to `/services/{id}` then calls `window.print()` after 300ms
- Removed ESV scripture links from card body (kept as plain text labels for compactness)
- Retained `statusClasses` static lookup pattern for Tailwind v4 purge safety

## Verification

- `npx vue-tsc --noEmit` — passed with zero errors
- `npx vite build` — completed successfully (built in 7.23s)
- All 4 files modified as planned

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/views/ServiceEditorView.vue` — modified (reduced spacing, CCLI links)
- [x] `src/components/SongSlideOver.vue` — modified (arrangements section removed)
- [x] `src/views/ServicesView.vue` — modified (grid layout)
- [x] `src/components/ServiceCard.vue` — modified (compact vertical card, Share/Print buttons)
- [x] Commit f6be3be exists (Task 1)
- [x] Commit c2c874d exists (Task 2)
- [x] TypeScript check passed
- [x] Production build passed

## Self-Check: PASSED
