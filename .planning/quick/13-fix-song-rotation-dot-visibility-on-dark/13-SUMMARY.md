---
phase: quick-13
plan: 13
subsystem: ui
tags: [rotation, scripture, dark-theme, visibility, services-view]
dependency_graph:
  requires: []
  provides: [scripture-rotation-view, improved-dot-visibility]
  affects: [ServicesView, RotationTable, ScriptureRotationTable]
tech_stack:
  added: []
  patterns: [rotation-grid, consecutive-repeat-detection, passage-key-formatting]
key_files:
  created:
    - src/components/ScriptureRotationTable.vue
  modified:
    - src/components/RotationTable.vue
    - src/views/ServicesView.vue
decisions:
  - "bg-sky-300 chosen over bg-indigo-400 for dot color — higher contrast on bg-indigo-900/50 dark backgrounds"
  - "ScriptureRotationTable uses bg-sky-900/40 cell background (not bg-indigo-900/50) to visually distinguish from song rotation"
  - "Passage key format: 'Book Chapter:verseStart-verseEnd', 'Book Chapter:verseStart', or 'Book Chapter' depending on available fields"
  - "Deduplication: same passage appearing in both a ScriptureSlot and sermonPassage counts once per service date"
  - "Scripture Rotation reuses same rotationServices 8-week window computed prop from ServicesView"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-04T20:31:16Z"
  tasks_completed: 2
  files_changed: 3
---

# Quick Task 13: Fix Song Rotation Dot Visibility + Add Scripture Rotation Tab

**One-liner:** Replaced `bg-indigo-400` dots with `bg-sky-300` in RotationTable for dark-theme contrast, and added a Scripture Rotation tab with a new ScriptureRotationTable component that grids passages against service dates.

## What Was Built

### Task 1: Dot Color Fix (RotationTable.vue)

Replaced both `bg-indigo-400` occurrences with `bg-sky-300`:
- In-cell dot indicator (line 73): `isConsecutiveRepeat ? 'bg-amber-400' : 'bg-sky-300'`
- Legend dot (line 84): `class="... bg-sky-300"`

`bg-sky-300` (#7dd3fc) provides significantly better contrast against `bg-indigo-900/50` (#1e1b4b at 50% opacity on gray-900) compared to `bg-indigo-400` (#818cf8) which blends into the similar-hue dark background.

### Task 2: Scripture Rotation Tab (ScriptureRotationTable.vue + ServicesView.vue)

**ScriptureRotationTable.vue** — new component mirroring RotationTable architecture:
- Accepts `services: Service[]` prop (same interface as RotationTable)
- Collects scripture passages from two sources per service:
  - `service.slots` where `slot.kind === 'SCRIPTURE'`, skipping slots with null `book` or `chapter`
  - `service.sermonPassage` (ScriptureRef | null), skipped if null
- Deduplicates: same formatted passage key appearing in both sources counts once per service date
- Passage key format: `"Book Chapter:verseStart-verseEnd"` / `"Book Chapter:verseStart"` / `"Book Chapter"`
- Entries sorted alphabetically by passage key
- Consecutive repeat detection: same `sortedDates` index comparison as RotationTable
- Uses `bg-sky-300` dot (normal use), `bg-amber-400` dot (consecutive repeat)
- Cell backgrounds: `bg-sky-900/40` (normal), `bg-amber-900/30` (consecutive repeat)
- Filter input shown when > 20 entries (lower threshold than songs)
- Two empty states: no services, and services exist but no scripture found

**ServicesView.vue** updates:
- Added "Scripture Rotation" tab button with same active/inactive class pattern
- Extended `activeTab` ref type: `ref<'services' | 'rotation' | 'scripture-rotation'>('services')`
- Added `v-else-if="activeTab === 'scripture-rotation'"` block rendering ScriptureRotationTable
- Reuses existing `rotationServices` computed (8-week window) — no new window computation
- Imported `ScriptureRotationTable` from `@/components/ScriptureRotationTable.vue`

## Verification

- `npx vue-tsc --noEmit` passes with zero errors
- All `bg-indigo-400` occurrences in RotationTable.vue replaced with `bg-sky-300`
- ServicesView.vue now has three tabs: Services, Song Rotation, Scripture Rotation
- Scripture Rotation tab uses same 8-week `rotationServices` window

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 5bf4f68 | fix(quick-13): replace bg-indigo-400 dots with bg-sky-300 in RotationTable |
| 2 | 464c8b2 | feat(quick-13): add Scripture Rotation tab and ScriptureRotationTable component |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/components/RotationTable.vue` — modified, zero `bg-indigo-400` remaining
- `src/components/ScriptureRotationTable.vue` — created at expected path
- `src/views/ServicesView.vue` — updated with third tab and import
- Commits 5bf4f68 and 464c8b2 exist in git log
