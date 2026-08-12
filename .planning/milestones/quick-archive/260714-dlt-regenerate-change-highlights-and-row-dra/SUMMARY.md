---
quick_id: 260714-dlt
slug: regenerate-change-highlights-and-row-drawer-matrix-redesign
date: 2026-07-14
status: complete
commits:
  - 2cdeccd
  - 977014d
  - b7cab81
  - (marker-size tweak)
---

# Summary: Regenerate change highlights + row-drawer matrix redesign

## What changed

### `src/stores/quarters.ts`
- Added ephemeral `lastRegenerate = ref<{ quarterId, changedDates } | null>` (exposed).
- `generateProposal` now diffs the previous calendar against the freshly proposed one (sorted person-id arrays per role) and records which service dates changed. In-memory only; scoped to the quarter.

### `src/components/QuarterGrid.vue` (redesign)
- **Plain-name cells** instead of pills: each role cell shows assigned people as comma-separated muted text, with tiny `unfilled` (red) / `conflict` (amber) / `group` (orange) markers. An empty short slot shows just the red `unfilled` marker (no `—`); `—` only shows when the role isn't needed that date.
- **Whole row is clickable** → opens one slide-out drawer that edits **all roles for that date** (assigned people with Clear/Swap, add-person select, and per-role gap-filling panel), replacing the per-cell drawer. Reworked `expandedCell` → `expandedDate` + per-role `addSelectByRole`.
- **Change highlight**: new optional `changedDates` prop → left accent bar + row tint + "changed" badge on changed rows.
- Cells/rows/sections carry `data-role-id` / `data-date` / `data-role-section` for testability.

### `src/views/QuarterView.vue`
- `showChanges` toggle + `changedDates` computed (from store `lastRegenerate`, scoped to the selected quarter).
- "Show changes (N)" checkbox in the generation-summary block (shown only when there are changes).
- Passes `:changed-dates="showChanges ? changedDates : []"` to QuarterGrid.

### `src/components/__tests__/QuarterGrid.test.ts`
- Rewritten for the row-drawer model: row click opens the drawer; per-role assertions scoped via `data-role-section`; group-conflict tests target `td[data-role-id][data-date]` and the `group` marker. Removed the obsolete remove-pill isolation test.

## Verification
- `npm run build` (type-check + vite) — passes.
- `npx vitest run` QuarterGrid + quarters store — **52 tests pass** (10 QuarterGrid, 42 store).

## Decisions (from user)
- Cells: plain names (not pills).
- Change highlight: row accent + badge.
- Whole-row click → full-row drawer.
- Unfilled empty slot: red `unfilled` only, no `—`.

## Notes
- `lastRegenerate` is ephemeral (lost on reload) — matches "we don't need to keep track of every change." The diff runs on every `generateProposal` (regenerate and fillGaps).
