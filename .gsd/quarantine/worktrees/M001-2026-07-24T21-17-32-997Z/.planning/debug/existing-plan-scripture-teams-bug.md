---
slug: existing-plan-scripture-teams-bug
status: resolved
trigger: Two bugs in the export-to-existing-PC-service flow — scriptures appending instead of replacing, and teams not being added to existing services.
created: 2026-04-16
updated: 2026-04-16
---

## Symptoms

- **Expected (BUG 1):** When exporting to an existing PC plan, scripture items should be found on the existing plan and replaced — same find-and-replace logic used for songs.
- **Actual (BUG 1):** Scripture items are appended to the end of the existing plan instead of replacing the old ones. Duplicate scriptures result.

- **Expected (BUG 2):** When exporting to an existing PC service that has no teams yet, the checked teams should be added (same `needed_positions` logic just fixed for new service creation).
- **Actual (BUG 2):** Teams are not added when exporting to an existing service. The `needed_positions` call appears to not run (or not run correctly) for the "add to existing" code path.

- **Error messages:** None reported — export appears to succeed, items just aren't right.
- **Timeline:** First time testing the "add to existing" flow — both bugs are first occurrences.
- **Reproduction:** Export a service to PC, then export the same service again to the same PC plan (add to existing). Check scriptures (duplicated) and teams (missing).

## Domain Context

- Songs use a find-and-replace pattern on existing plans — the existing PC item is found by type/title and updated in place.
- Scriptures should follow the same pattern but appear to use an append-only path instead.
- Teams: the `needed_positions` fix (commit from this session) added `fetchPlanTimes` and wired it into `onConfirmExport` in `ServiceEditorView.vue`. The fix may only target the new-plan branch, not the existing-plan branch.
- Key files: `src/utils/planningCenterApi.ts`, `src/views/ServiceEditorView.vue`

## Current Focus

hypothesis: "BUG 1: scripture placeholder matching only matched 'scripture reading' title strings, which only exist on fresh templates. After first export, scripture items have real reference titles and itemType 'regular' — no match found, causing all scriptures to append. BUG 2: team-add loop ran for existing plans but had no deduplication guard; for plans already carrying teams, POSTs would 422 silently."
test: ""
expecting: ""
next_action: "fixed"
reasoning_checkpoint: ""

## Evidence

- timestamp: 2026-04-16
  source: ServiceEditorView.vue lines 1665-1679 (pre-fix)
  content: >
    The first-pass loop matched `isSongPlaceholder` (titleLower.includes('worship song')) and
    `isScripturePlaceholder` (titleLower.includes('scripture reading')). After first export,
    scripture items have real titles like 'John 3:16' with itemType 'regular' — no 'scripture
    reading' in title, so scriptureMatches was always empty on re-export. All scripture slots
    fell through to the Fifth pass (append leftover), causing duplicates.

- timestamp: 2026-04-16
  source: ServiceEditorView.vue lines 1870-1886 (pre-fix)
  content: >
    Team-add loop ran unconditionally for both new and existing plans. For existing plans,
    `fetchPlanNeededPositionTeamIds` was never called, so teams already on the plan would be
    posted again — either creating duplicates or silently failing with 422 and appearing not added.

## Eliminated

- BUG 2 was NOT caused by the team-add code being in the wrong branch (it's outside the if/else,
  runs for both new and existing). The root cause was lack of deduplication for existing plans.

## Resolution

root_cause: >
  BUG 1: The scripture-matching heuristic relied only on a 'scripture reading' title substring, which
  only works when the PC plan still has original template placeholders. On re-export, scripture items
  have real reference titles (e.g. 'John 3:16') with itemType='regular', so the matcher never fired
  and all scriptures fell through to the append pass.
  BUG 2: The team-add loop had no deduplication guard for existing plans. When the plan already had
  needed_positions for a team, re-posting caused 422s (swallowed silently) or duplicates.

fix: >
  BUG 1: Extended `fetchPlanItems` to return `itemType` from the PC API. Updated the first-pass
  matcher to identify song items by `titleLower.includes('worship song') || itemType in [song,
  song_arrangement]` and scripture items by `titleLower.includes('scripture reading') ||
  (itemType === 'regular' && title not in [message, prayer])`. Added `!isSongItem` guard to
  the scripture branch to prevent regular non-song items from being misclassified as songs.
  BUG 2: Added `fetchPlanNeededPositionTeamIds` to `planningCenterApi.ts` (GET needed_positions,
  return Set of team IDs). In `onConfirmExport`, when exportMode is 'existing', fetch existing
  team IDs and skip any `selectedPcTeamIds` already present before calling `addTeamToPlan`.

verification: "TypeScript type-check passes (npx tsc --noEmit, no errors). Manual re-export test needed."

files_changed: >
  src/utils/planningCenterApi.ts — fetchPlanItems return type extended with itemType field;
  new fetchPlanNeededPositionTeamIds function added after addTeamToPlan.
  src/views/ServiceEditorView.vue — import updated to include fetchPlanNeededPositionTeamIds;
  first-pass scripture matcher updated to use itemType; team-add section adds deduplication
  guard for existing plans.
