---
phase: quick-16
plan: "01"
subsystem: service-management-ui
tags: [bug-fix, service-card, service-editor, autosave, vue-reactivity]
dependency_graph:
  requires: []
  provides: [reliable-team-autosave, clean-service-card-badge-display]
  affects: [ServiceCard.vue, ServiceEditorView.vue]
tech_stack:
  added: []
  patterns: [immutable-array-update-for-vue-reactivity]
key_files:
  modified:
    - src/components/ServiceCard.vue
    - src/views/ServiceEditorView.vue
decisions:
  - "[Quick-16]: toggleTeam uses filter/spread immutable update — new array reference guarantees Vue 3 deep watcher fires"
  - "[Quick-16]: Autosave debounce reduced from 1500ms to 500ms for more responsive save feedback"
  - "[Quick-16]: Communion badge removed from ServiceCard — TeamTagPill already shows Communion from service.teams"
metrics:
  duration_minutes: 12
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 16: Fix Communion Badge Display + Communion Checkbox Autosave Summary

**One-liner:** Removed date-derived Communion badge from ServiceCard and fixed Vue 3 reactivity in toggleTeam with immutable array update to make team checkbox changes reliably trigger autosave.

## What Was Built

Three related bugs fixed in the service management UI:

1. **Removed date-derived Communion badge** — `ServiceCard.vue` had an amber "Communion" badge derived from the date (first Sunday of month) via `isCommunion` computed. This was redundant because `TeamTagPill` already shows Communion when it's in `service.teams`. Removed both the `<span v-if="isCommunion">` element and the `isCommunion` computed property.

2. **Fixed team checkbox autosave trigger** — `toggleTeam()` in `ServiceEditorView.vue` was using `splice()` and `push()` which mutate the array in-place. Vue 3's deep watcher on a `ref` can miss in-place array mutations. Fixed by reassigning `localService.value.teams` to a new array (using `filter()` for removal, spread `[...teams, team]` for addition), guaranteeing the watcher fires on every toggle.

3. **Reduced autosave debounce to 500ms** — Changed from 1500ms to 500ms for faster, more responsive save feedback. Also updated the undo comment to reflect "0.5s".

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove Communion badge from ServiceCard | d236d96 | src/components/ServiceCard.vue |
| 2 | Fix toggleTeam immutable update + reduce autosave debounce | dbb25a0 | src/views/ServiceEditorView.vue |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- Build passes (no new TypeScript errors introduced in modified files)
- `ServiceCard.vue` contains no `isCommunion` computed and no amber Communion badge span
- `ServiceEditorView.vue` `toggleTeam` uses `filter` and spread (`[...teams, team]`) — no `splice` or `push`
- Manual verification pending at checkpoint

## Self-Check: PASSED

Files confirmed present:
- src/components/ServiceCard.vue — FOUND (modified, isCommunion removed)
- src/views/ServiceEditorView.vue — FOUND (modified, toggleTeam uses immutable update)

Commits confirmed:
- d236d96 — FOUND (Task 1: ServiceCard badge removal)
- dbb25a0 — FOUND (Task 2: toggleTeam fix + debounce)
