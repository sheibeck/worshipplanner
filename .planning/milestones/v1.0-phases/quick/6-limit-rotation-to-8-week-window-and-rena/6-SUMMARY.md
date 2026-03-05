---
phase: quick-6
plan: 1
subsystem: services-view / rotation-table
tags: [rotation, filtering, ux, tab-label]
dependency_graph:
  requires: []
  provides: [rotation-8-week-window, song-rotation-tab-label]
  affects: [ServicesView, RotationTable]
tech_stack:
  added: []
  patterns: [computed-filtering, prop-narrowing]
key_files:
  created: []
  modified:
    - src/views/ServicesView.vue
    - src/components/RotationTable.vue
decisions:
  - "8-week window computed in ServicesView (not RotationTable) — keeps filtering as a prop concern, RotationTable remains a pure display component"
  - "Subtitle uses sortedDates.length (service count) rather than exposing date strings — simpler and avoids re-computing window bounds in the component"
metrics:
  duration_minutes: 1
  completed_date: "2026-03-04"
  tasks_completed: 1
  files_modified: 2
---

# Quick-6 Summary: Limit Rotation to 8-Week Window and Rename Tab

**One-liner:** Rolling 8-week window (28 days past / 28 days ahead) passed as filtered `rotationServices` computed to RotationTable, with "Song Rotation" tab label and a week-count subtitle.

## What Was Built

### Task 1: Rename tab label and filter services to 8-week window

**ServicesView.vue:**
- Renamed tab button text from `"Rotation"` to `"Song Rotation"`
- Added `rotationServices` computed that calculates `windowStart` (today - 28 days) and `windowEnd` (today + 28 days), formats them as YYYY-MM-DD strings, and filters `serviceStore.services` to services within that range
- Updated `:services="serviceStore.services"` binding to `:services="rotationServices"` on the RotationTable component

**RotationTable.vue:**
- Added a subtitle paragraph inside `<template v-else>` (before the filter input): `Showing N week(s) of song rotation`, using `sortedDates.length` for the count

## Verification

- All 9 rotation table unit tests pass (`computeRotationTable` is unchanged)
- `npx vue-tsc --noEmit` reports no type errors
- Build succeeds

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| f363b09 | feat(quick-6): limit rotation to 8-week window and rename tab |

## Self-Check: PASSED

- `src/views/ServicesView.vue` - modified, committed at f363b09
- `src/components/RotationTable.vue` - modified, committed at f363b09
- All tests pass, no type errors
