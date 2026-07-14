---
quick_id: 260714-dlt
slug: regenerate-change-highlights-and-row-drawer-matrix-redesign
date: 2026-07-14
status: complete
---

# Quick Task: Regenerate change highlights + row-drawer matrix redesign

## Problem
1. After Regenerate there's no indication of what changed — a person added/removed on a date.
2. The schedule matrix (`QuarterGrid.vue`) is busy: every cell renders bordered people-pills + status pills, which is hard to read. Editing is per-cell.

## Decisions (user)
- Cells show **plain names** (comma-separated muted text), no pills. Unfilled/conflict shown as tiny colored text markers.
- Changes highlighted as **row accent + badge**: changed dates get a left accent bar + subtle row tint + a small "changed" badge.
- Whole **row is clickable**; the slide-out drawer edits the **entire row** (all roles for that date), not one cell.
- A **show/hide changes checkbox** lives in the generation-summary block (next to unfilled / pairing conflicts).

## Implementation

### `src/stores/quarters.ts`
- Add reactive `lastRegenerate = ref<{ quarterId: string; changedDates: string[] } | null>(null)`; expose it.
- In `generateProposal`, before writing the new calendar, diff the previous `quarter.calendar` against `result.calendar` per date (sorted person arrays per roleId). Record dates whose assignments changed (added/removed people) into `lastRegenerate`.

### `src/views/QuarterView.vue`
- `showChanges = ref(true)`.
- `changedDates` computed = `lastRegenerate.changedDates` when it matches the selected quarter, else `[]`.
- In the generation-summary block, add a "Show changes (N)" checkbox (only when `changedDates.length > 0`).
- Pass `:changed-dates="showChanges ? changedDates : []"` to `QuarterGrid`.

### `src/components/QuarterGrid.vue`
- New prop `changedDates: string[]`.
- Replace per-cell pill buttons with plain-text cells (names joined by ", "; "—" when empty; tiny red "unfilled" / amber "conflict" / orange "group" markers).
- Make the whole `<tr>` clickable → `openRow(date)` (opens the row drawer). Cursor + hover tint. Changed rows: left accent border on the date cell + row tint + "changed" badge.
- Rework the drawer from per-cell (`expandedCell`) to per-row (`expandedDate`): loop `sortedRoles`, each role a section with assigned people (Clear/Swap), an Add-person select, and the gap-filling panel when unfilled. Per-role add selection via `addSelectByRole`.
- Update actions: `onAdd(roleId)`, `onSwapSelect(event, date, roleId, fromPersonId)`; keep `onClear`, `onQuickAssign`.

## Verification
- `npm run type-check` and `npm run build-only` pass.
- Manual reasoning: regenerate marks changed rows; checkbox toggles; row click opens full-row drawer; edits write through the same store actions.

## Commits (atomic)
1. store: compute last-regenerate changed dates
2. QuarterGrid: plain-name cells + full-row drawer + change highlight
3. QuarterView: show-changes checkbox + wire changedDates
