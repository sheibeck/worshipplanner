---
quick_id: 260713-wm9
slug: schedule-and-volunteers-tabbed-layout
date: 2026-07-14
status: complete
---

# Quick Task: Schedule & Volunteers tabbed layout

## Problem

Both the Schedule page (`QuarterView.vue`) and Volunteers page (`RosterView.vue`)
stack all their sections vertically. On the Schedule page the action buttons were
moved to the header, but the "regenerate the full schedule" confirmation and the
generated schedule still sit far below the volunteer-availability and service-date
sections — you must scroll past (or collapse) those to reach the schedule. Awkward
and hard to use.

## Solution

Introduce a tab bar (reusing the existing `ServicesView.vue` tab-bar styling) on both
pages so each concern gets its own panel.

### Schedule page — `src/views/QuarterView.vue`
Tabs (only shown when a quarter is selected):
1. **Volunteers** — the volunteer-availability roster table
2. **Schedule** — regenerate-confirm banner, generation summary, empty state / grid
3. **Service dates** (last) — add/list service dates with per-date role overrides, plus the Danger Zone (delete quarter)

Behavior:
- Default tab on load: **Schedule** (main complaint was scrolling to reach it).
- `onGenerateSchedule`, `onFillGaps`, `onConfirmRegenerate`, and clicking **Regenerate**
  (opens the confirm) → switch to **Schedule** tab.
- `onCreateQuarter` (add new quarter) → switch to **Volunteers** tab.
- Drop the two `CollapsibleSection` wrappers (tabs replace collapse/scroll).
- Header action buttons and the share-link banner stay above the tabs (global to the quarter).

### Volunteers page — `src/views/RosterView.vue`
Tabs:
1. **Volunteers** (default) — search/filter + people table (or empty state), Danger Zone (clear all)
2. **Roles config** — `RolesConfigPanel`

Behavior:
- Clicking **Import from Planning Center** or **Add Volunteer** → switch to **Volunteers** tab first.
- Drop the `CollapsibleSection` wrapper around Roles config.

## Files
- `src/views/QuarterView.vue`
- `src/views/RosterView.vue`

## Verification
- `npm run build` (typecheck + vite build) passes.
- Manual: tab switching + the tab-redirect behaviors above.

## Commits (atomic)
1. Schedule page tabs
2. Volunteers page tabs
