---
phase: 10
plan: "03"
subsystem: service-editor-export
tags: [service-editor, export-dialog, planningcenter, orchestra, ai-suggestions, teams]
dependency_graph:
  requires: [10-01, 10-02]
  provides: [PC-teams-UI, existing-plan-replace-rewrite, orchestra-AI-filter]
  affects: [src/views/ServiceEditorView.vue]
tech_stack:
  added: []
  patterns: [delete+recreate-at-sequence, non-fatal-team-add, orchestra-AI-filter-at-callsite]
key_files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
decisions:
  - "Teams checkbox uses v-model array binding with :value=team.id for multi-select pattern"
  - "Orchestra AI filter applied at call sites only — claudeApi.ts stays generic"
  - "Existing-plan rewrite uses collect-then-mutate pattern to avoid sequence conflicts during iteration"
  - "Team-add wrapped in non-fatal try/catch consistent with existing createPlanTime(..).catch(() => {}) pattern"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_changed: 1
requirements: [FEAT-2, FEAT-3, FEAT-4-ai]
---

# Phase 10 Plan 03: ServiceEditorView PC Teams, Delete+Recreate Export, Orchestra AI Filter Summary

**One-liner:** Wired PC Teams fetch with auto-match checkboxes into export dialog, rewrote existing-plan export to delete+recreate matched placeholders at original sequence, and filtered AI song library to orchestra-tagged songs when service includes Orchestra team.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PC Teams state + fetch + checkbox UI + team-add on export + updated info copy | 3c5d221 | src/views/ServiceEditorView.vue |
| 2 | Rewrite onConfirmExport existing-plan branch + orchestra AI filter | bba7226 | src/views/ServiceEditorView.vue |

## What Was Built

### Task 1 — PC Teams (FEAT-3)

- Added `pcTeams` and `selectedPcTeamIds` refs after `exportMode` ref
- Extended `onExportToPC`: resets both refs, then fetches teams after `checkForExistingPlan()` inside the `if (exportSelectedServiceTypeId.value)` block; auto-matches WorshipPlanner `service.teams` names case-insensitively to PC team names
- Extended `onServiceTypeChange`: resets both refs before re-fetch, then fetches teams with same auto-match logic (non-fatal inner try/catch)
- Inserted Teams checkbox section into export dialog template between Template selector and Service Date; only rendered when `pcTeams.length > 0`
- Updated existing-plan info copy to reflect replace-not-append behavior: "Worship Song items are replaced. Scripture Reading items are replaced. Unmatched placeholders are removed. Extras are appended at the end."
- Added non-fatal `addTeamToPlan` loop in `onConfirmExport` before `serviceStore.updateService` (applies to both new and existing plan branches)

### Task 2 — Delete+Recreate Export Branch (FEAT-2) + Orchestra AI Filter (FEAT-4)

**Existing-plan rewrite:** Replaced the old append-only loop with a collect-then-mutate pattern:
1. First pass: classify existing items into `songMatches`, `scriptureMatches`, `unmatchedPlaceholderIds`
2. Delete unmatched placeholders (non-fatal)
3. Delete+recreate matched song placeholders at their original `item.sequence`
4. Delete+recreate matched scripture placeholders at their original `item.sequence`
5. Append leftover unmatched WorshipPlanner slots at `max(sequence) + 1`

**Orchestra AI filter:** At both `getSongSuggestions` call sites in the file:
- `suggestAllSongs()`: builds `isOrchestraService` and `librarySource` before the batch loop; filters `songStore.songs` to `s.teamTags.includes('Orchestra')` when true
- `fetchAiForSlot()`: same `isOrchestraService`/`librarySource` variables inserted before the `getSongSuggestions` call; `songLibrary` uses `librarySource.map(...)` instead of `songStore.songs.map(...)`
- `claudeApi.ts` not modified — filter is a call-site concern only

## Decisions Made

- **Collect-then-mutate pattern**: Collecting all matches before any deletes avoids mid-iteration sequence confusion when PC reorders items after deletions.
- **Non-fatal team-add**: Consistent with existing `createPlanTime(...).catch(() => {})` pattern; individual team-add failures are silently swallowed so export always completes.
- **Orchestra filter at call sites**: `getSongSuggestions` remains generic — the filtering responsibility belongs to the caller who knows the service context. Avoids leaking service domain into the API utility.
- **Auto-match is case-insensitive**: `svcTeam.toLowerCase() === pcTeam.name.toLowerCase()` handles "Orchestra" vs "orchestra" mismatches between WorshipPlanner and PC data.

## Deviations from Plan

None — plan executed exactly as written. The info copy text in Task 1 uses the plan's specified wording ("Worship Song items are replaced...") rather than PATTERNS.md's slightly different wording; the PLAN.md text was used as the authoritative source per plan instructions.

## Verification

- `npx vue-tsc --noEmit`: exits 0 (no TypeScript errors)
- `npx vitest run`: 424 tests passed across 20 test files, 0 failures
- `src/utils/claudeApi.ts`: not modified (confirmed via `git diff`)
- Grep counts confirmed: `await fetchServiceTypeTeams` ×2, `isOrchestraService` ×4, `await deleteItem` ×3, `librarySource` ×4, `const songMatches: Array<` ×1, `const scriptureMatches: Array<` ×1, `unmatchedPlaceholderIds` ×3, `s.teamTags.includes` ×2

## Threat Flags

None — all mitigations in the plan's `<threat_model>` are implemented:
- Delete scope: only items with `worship song` or `scripture reading` in title, within the target plan's fetched items only
- Stale team refs: `onServiceTypeChange` resets `pcTeams.value = []` and `selectedPcTeamIds.value = []` before re-fetch
- Team-add auth errors: silently swallowed; results in empty `pcTeams` UI (section hidden) on fetch failure
- Orchestra zero results: `getSongSuggestions` handles empty arrays gracefully; no security impact
- XSS: `{{ team.name }}` uses Vue template interpolation (auto-escaped)

## Self-Check: PASSED

- `src/views/ServiceEditorView.vue` exists and was modified
- Commit `3c5d221` exists (Task 1)
- Commit `bba7226` exists (Task 2)
- All acceptance criteria verified via grep counts above
