---
phase: quick-7
plan: "01"
subsystem: service-cards
tags: [service-card, team-badges, slot-labels, new-service-dialog, sunday-defaults]
dependency_graph:
  requires: []
  provides: [team-badge-display, song-slot-label-prefix, sunday-team-defaults]
  affects: [ServicesView, ServiceEditorView]
tech_stack:
  added: []
  patterns: [TeamTagPill reuse, computed Sunday ordinal, reactive date watcher]
key_files:
  created: []
  modified:
    - src/components/ServiceCard.vue
    - src/components/NewServiceDialog.vue
    - src/views/ServiceEditorView.vue
decisions:
  - "sundayOrdinal() uses Math.ceil(day/7) — robust for any month length without hardcoding date ranges"
  - "Team badge row uses v-if guard so card layout is unaffected for services with no teams"
  - "Song/Scripture labels use em dash (—) to match existing 'Scripture — Empty' pattern"
  - "ServiceEditorView 'Service Type' heading renamed to 'Teams' per user preference"
metrics:
  duration_minutes: 12
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_changed: 3
---

# Quick Task 7: Service Card Team Badges and Song Slot Label Summary

**One-liner:** Gray team pill badges on ServiceCard, "Song — Title" / "Scripture — Ref" prefixes in slot summary, and Sunday-ordinal-based Orchestra/Choir team auto-defaults in NewServiceDialog.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add team badges and song/scripture label prefixes to ServiceCard | 1e52f80 | ServiceCard.vue, ServiceEditorView.vue |
| 2 | Add Sunday-based team defaults to NewServiceDialog | f1154f9 | NewServiceDialog.vue |

## What Was Built

### Task 1: ServiceCard Improvements

**Team badges** (`src/components/ServiceCard.vue`):
- Imported `TeamTagPill` component
- Added badge row between the date/status row and the service name: `<div v-if="service.teams.length" class="flex flex-wrap gap-1 mb-1">`
- Each team renders as a gray pill via `<TeamTagPill v-for="team in service.teams" :key="team" :tag="team" />`
- Guard ensures no layout impact when teams array is empty

**Slot label prefixes** (`src/components/ServiceCard.vue`):
- SONG case: `slot.songTitle ? 'Song — ${slot.songTitle}' : 'Empty'`
- SCRIPTURE case: `slot.book ? 'Scripture — ${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}' : 'Scripture — Empty'`
- Uses em dash (—) to match the pre-existing "Scripture — Empty" pattern

**ServiceEditorView label** (`src/views/ServiceEditorView.vue`):
- Renamed heading from "Service Type" to "Teams" per user preference

### Task 2: NewServiceDialog Sunday Defaults

**`sundayOrdinal(dateStr)` helper** (`src/components/NewServiceDialog.vue`):
- Parses date string, checks `getDay() === 0` for Sunday
- Returns `Math.ceil(day / 7)` for ordinal (1st, 2nd, 3rd...)

**`defaultForm()` updated:**
- Calls `sundayOrdinal()` on the initial `nextSunday()` date
- Pre-populates teams: `['Orchestra']` for 1st Sunday, `['Choir']` for 3rd Sunday, `[]` otherwise

**Date watcher added:**
- `watch(() => form.value.date, ...)` fires on every date picker change
- Applies same Orchestra/Choir/empty logic reactively
- User can manually change teams after date selection; watcher only fires again on next date change

## Deviations from Plan

### Additional Changes (User Instruction)

**1. [User Instruction] Rename "Service Type" to "Teams" in ServiceEditorView**
- Found during: Pre-execution search
- Issue: Label "Service Type" in ServiceEditorView.vue did not match user's preferred terminology
- Fix: Changed `<h2>Service Type</h2>` to `<h2>Teams</h2>` at line 130
- Files modified: `src/views/ServiceEditorView.vue`
- Commit: 1e52f80

## Verification

- `npx vue-tsc --noEmit`: passed (no output = no errors)
- `npx vitest run`: 231 tests passed across 16 test files

## Self-Check: PASSED

Files exist:
- FOUND: src/components/ServiceCard.vue (modified)
- FOUND: src/components/NewServiceDialog.vue (modified)
- FOUND: src/views/ServiceEditorView.vue (modified)

Commits exist:
- FOUND: 1e52f80 (Task 1 — ServiceCard + ServiceEditorView)
- FOUND: f1154f9 (Task 2 — NewServiceDialog)
