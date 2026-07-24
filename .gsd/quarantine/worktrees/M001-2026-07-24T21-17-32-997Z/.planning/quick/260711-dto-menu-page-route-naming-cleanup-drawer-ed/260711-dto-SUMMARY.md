---
phase: quick-260711-dto
plan: 01
subsystem: ui
tags: [routing, ux-consistency, sidebar, drawer-edit, song-counts]
dependency-graph:
  requires: []
  provides:
    - "/volunteers and /admins routes"
    - "songStore.visibleSongs getter"
    - "SongTable/RosterView trailing-chevron row affordance"
    - "grouped/reordered sidebar nav"
  affects:
    - src/router/index.ts
    - src/views/RosterView.vue
    - src/views/TeamView.vue
    - src/components/GettingStarted.vue
    - src/utils/slug.ts
    - src/stores/songs.ts
    - src/views/DashboardView.vue
    - src/views/SongsView.vue
    - src/components/SongTable.vue
    - src/views/QuarterView.vue
    - src/components/AppSidebar.vue
tech-stack:
  added: []
  patterns:
    - "Trailing empty <th>/right-aligned <td> chevron column (M9 5l7 7-7 7 SVG path) marks drawer-editable rows"
    - "template v-for + separatorBefore boolean flag for grouped sidebar dividers"
key-files:
  created: []
  modified:
    - src/router/index.ts
    - src/views/RosterView.vue
    - src/views/TeamView.vue
    - src/components/GettingStarted.vue
    - src/utils/slug.ts
    - src/stores/songs.ts
    - src/views/DashboardView.vue
    - src/views/SongsView.vue
    - src/components/SongTable.vue
    - src/views/QuarterView.vue
    - src/components/AppSidebar.vue
    - src/utils/__tests__/slug.test.ts
    - src/views/__tests__/RosterView.test.ts
decisions:
  - "Store/type modules (@/stores/roster, @/types/roster) and component filenames (RosterView.vue, TeamView.vue) kept as-is — only the route path/name and page titles were renamed, per plan scope guard"
  - "Old 'roster'/'team' reserved slugs kept alongside new 'volunteers'/'admins' so historical bookmarks/org-slug claims stay blocked"
  - "Add-quarter button placed last (rightmost) in the Schedule header actions row, after Import Volunteer CSV, mirroring the primary-action-last pattern used on other pages"
metrics:
  duration: "~35 minutes"
  completed: 2026-07-11
---

# Quick Task 260711-dto: Menu/page route naming cleanup + drawer-edit consistency Summary

Route/page-title alignment (Roster->Volunteers, Users->Admins), a shared
visibleSongs getter that excludes soft-deleted songs from counts, a
standardized trailing-chevron + full-row-click affordance on the Songs and
Volunteers tables, relocation of the Schedule "+ Add quarter" button into the
page header, and a regrouped/separated sidebar menu.

## What Was Built

**Task 1 — Route + title rename:** `/roster` -> `/volunteers` (route name
`volunteers`) and `/team` -> `/admins` (route name `admins`) in
`src/router/index.ts`, with the memorable-share-route comment updated.
`RosterView.vue`'s `<h1>` now reads "Volunteers"; `TeamView.vue`'s `<h1>` now
reads "Admins". `GettingStarted.vue`'s team-invite step link now points to
`/admins`. `RESERVED_SLUGS` in `src/utils/slug.ts` gained `'volunteers'` and
`'admins'` (old `'roster'`/`'team'` entries kept for backward compatibility).

**Task 2 — Active-song counts:** Added `visibleSongs` computed to
`src/stores/songs.ts` (filters `hidden !== true`, mirroring the existing
`aiCandidateSongs` pattern) and exported it from the store. Dashboard's
"Songs" stat and the Songs-page header count now read
`songStore.visibleSongs.length` instead of the raw `songs.length`, so
soft-deleted songs no longer inflate the displayed counts.

**Task 3 — Drawer-edit row affordance:** `SongTable.vue` and `RosterView.vue`
active-people rows both now end with a right-aligned trailing `<td>`
containing a chevron SVG (`M9 5l7 7-7 7`), with a matching empty `<th>` in
each header row. `RosterView.vue`'s body rows are now fully clickable
(`@click="onEditPerson(person)"`) with `cursor-pointer` styling; the
redundant "Edit" text button was removed, and "Deactivate" now uses
`@click.stop` so it no longer also opens the edit drawer. Confirm/empty-state
colspans bumped from 5 to 6 for the new column.

**Task 4 — Add-quarter button placement:** The "+ Add quarter" button moved
from the quarter-switcher card into the page header's top-right actions row
in `QuarterView.vue`, styled as the primary (indigo) action to match
Services/Volunteers/Songs. "Delete quarter" stayed in the switcher card
(destructive, contextual to a selected quarter).

**Task 5 — Sidebar reorder/grouping:** `AppSidebar.vue`'s `navItems` computed
was rewritten to order/group as: Dashboard (top), {Services, Songs},
separator, {Schedule, Volunteers}, separator, {Admins, Settings}. Volunteers
and Admins `to:` paths updated to `/volunteers` and `/admins`. A
`separatorBefore: true` flag on the first item of each group drives a thin
divider rendered via `template v-for` + `<div v-if="item.separatorBefore">`
ahead of the `router-link`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `slug.test.ts` reserved-slug count assertion broke after Task 1**
- **Found during:** Post-task verification (test run)
- **Issue:** `RESERVED_SLUGS.size` test hardcoded `10` and the expected-words
  list; Task 1 intentionally added `'volunteers'` and `'admins'` (size now 12),
  a direct and expected consequence of the plan.
- **Fix:** Updated the test's expected array and `.toBe(12)` assertion to
  include the two new reserved words.
- **Files modified:** `src/utils/__tests__/slug.test.ts`
- **Commit:** 3c33cd0

**2. [Rule 1 - Bug] `RosterView.test.ts` broke after removing the Edit button**
- **Found during:** Post-task verification (test run)
- **Issue:** Three tests located the row-edit trigger via
  `wrapper.findAll('button').find((b) => b.text() === 'Edit')` — that button
  was intentionally removed in Task 3 in favor of full-row click.
- **Fix:** Replaced the button lookup with `wrapper.findAll('tbody tr')[0]`
  and `.trigger('click')` on the row itself, matching the new UX.
- **Files modified:** `src/views/__tests__/RosterView.test.ts`
- **Commit:** 3c33cd0

No other deviations — the rest of the plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all changes are UI/routing/display cosmetics; no new endpoints, auth
paths, or trust-boundary surface introduced.

## Verification

- `npx vue-tsc --build` — passed with no errors.
- `npx vitest run` — 33 test files, 692 tests, all passed (including the two
  test files updated as part of this plan's Rule 1 fixes).
- Automated `<verify>` grep checks for all five tasks passed as specified in
  the plan.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | ea32f2b | feat(260711-dto): rename Roster/Team routes to /volunteers and /admins |
| 2 | 45c6790 | feat(260711-dto): exclude hidden songs from Dashboard/Songs counts |
| 3 | 0e1c540 | feat(260711-dto): standardize drawer-edit row affordance on Songs and Volunteers |
| 4 | 746b212 | feat(260711-dto): move Add-quarter button to Schedule page header |
| 5 | 16320dc | feat(260711-dto): reorder and group sidebar nav with separators |
| test-fix | 3c33cd0 | test(260711-dto): update slug and RosterView tests for route rename + row-click UX |

## Checkpoint Pending

Task 6 (`checkpoint:human-verify`, gate="blocking") was **not** attempted —
per the plan and execution constraints, this requires the human to run
`npm run dev`, sign in as an editor, and manually verify all five UX outcomes
listed in the plan's `<how-to-verify>` block (sidebar order/separators,
`/volunteers` and `/admins` routing + headers, chevron + full-row-click on
Songs/Volunteers with Deactivate unaffected, Dashboard/Songs counts excluding
soft-deleted songs, and Add-quarter button top-right placement on Schedule).

## Self-Check: PASSED

Verified all six modified source files referenced in commits exist and all
six commit hashes above are present in `git log`.
