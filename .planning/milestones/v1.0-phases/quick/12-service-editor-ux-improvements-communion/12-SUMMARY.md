---
phase: quick-12
plan: 01
subsystem: service-editor
tags: [ux, teams, communion, slots, song-display]
dependency_graph:
  requires: []
  provides: [communion-team-checkbox, prayer-message-links, compact-song-row]
  affects: [ServiceEditorView, NewServiceDialog, NonAssignableSlot]
tech_stack:
  added: []
  patterns: [optional-fields-firestore, type-cast-template, auto-default-on-load]
key_files:
  created: []
  modified:
    - src/types/service.ts
    - src/views/ServiceEditorView.vue
    - src/components/NewServiceDialog.vue
decisions:
  - Communion auto-default applied only on initial load (originalService also updated to match) so isDirty stays false and manual unchecks are not overridden
  - vwTypeLabels constant removed entirely (was only used by the removed type selector buttons)
  - NonAssignableSlot linkUrl/linkLabel optional fields — undefined on existing Firestore docs treated as falsy, no migration needed
metrics:
  duration: 20
  completed_date: "2026-03-04"
  tasks_completed: 3
  files_modified: 3
---

# Quick Task 12: Service Editor UX Improvements — Communion, Links, Compact Song Row

**One-liner:** Four focused UX improvements — Communion checkbox with 1st-Sunday auto-default, optional URL links on PRAYER/MESSAGE slots, and a compact single-line assigned-song display with VW type buttons removed.

## What Was Built

### Task 1: Communion team checkbox + 1st-Sunday auto-check (commit: 4027d2f)

- Added `'Communion'` to `AVAILABLE_TEAMS` in `ServiceEditorView.vue` (before Special Service)
- Added `'Communion'` to `availableTeams` in `NewServiceDialog.vue`
- `ServiceEditorView`: on initial service load, if `isCommunion` is true and Communion is not already in teams, auto-adds it (and syncs `originalService` so isDirty stays false)
- `NewServiceDialog`: `defaultForm()` and the date-change watcher both set `teams = ['Orchestra', 'Communion']` when ordinal === 1 (1st Sunday)

### Task 2: Optional link (URL + label) on PRAYER and MESSAGE slots (commit: 2dc57a1)

- Extended `NonAssignableSlot` in `src/types/service.ts` with `linkUrl?: string` and `linkLabel?: string`
- Added `NonAssignableSlot` to imports in `ServiceEditorView.vue`
- Both PRAYER and MESSAGE slot templates now show:
  - A label text input (w-36, placeholder "Link label (optional)")
  - A URL input (flex-1, placeholder "https://...")
  - An external-link SVG icon (shown only when `linkUrl` is set), opens URL in new tab
- `isDirty` detection picks up changes automatically via JSON.stringify on `localService.value.slots`

### Task 3: Remove VW type 1/2/3 buttons; compact assigned-song row (commit: d04ec94)

- Removed the `v-for` button block (`[1, 2, 3]`) from SONG slot header
- Removed the verbose `vwTypeLabels` `<p>` element from SONG slot header
- Removed `changeVwType()` function (no longer referenced anywhere)
- Removed `vwTypeLabels` constant (was only used by the now-deleted buttons)
- SONG slot header is now: `slot label` on the left, `SongBadge` on the right — clean and minimal
- Assigned-song block compacted to one line: `title · key | CCLI` with `truncate` on title, `flex-shrink-0` on key/CCLI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript null safety on isCommunion check**
- **Found during:** Task 1
- **Issue:** `localService.value` could be null after the null-check on `found` in certain TypeScript flow analysis paths
- **Fix:** Added explicit `localService.value &&` guard before `.teams.includes('Communion')`
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Commit:** 4027d2f

**2. [Rule 2 - Cleanup] Removed unused vwTypeLabels constant**
- **Found during:** Task 3
- **Issue:** After removing the type selector buttons, `vwTypeLabels` was declared but never used
- **Fix:** Removed the constant entirely to prevent dead-code warnings
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Commit:** d04ec94

## Build Status

Pre-existing TypeScript errors in `src/utils/__tests__/suggestions.test.ts` and `src/views/ServicesView.vue` were present before this task and are out of scope. All three tasks introduced zero new TypeScript errors.

## Self-Check: PASSED

All modified files exist and all task commits are present in git history.
