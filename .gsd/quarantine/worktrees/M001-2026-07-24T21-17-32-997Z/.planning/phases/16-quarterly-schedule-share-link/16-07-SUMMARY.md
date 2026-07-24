---
phase: 16-quarterly-schedule-share-link
plan: 07
subsystem: ui
tags: [vue3, tailwind, quarter-grid, teleport, slide-out, frequency-tier]

# Dependency graph
requires:
  - phase: 16-quarterly-schedule-share-link (16-01)
    provides: PersonQuarterData.roleFrequency (Record<roleId, RoleFrequencyEntry>) single-source field
provides:
  - QuarterGrid group editor as a right-side Teleport slide-out (matches AvailabilityDrawer's exact visual language)
  - Whole-cell click target for opening the group editor, with remove-pill quick-remove isolated via @click.stop
  - QuarterGrid tierOf repointed to PersonQuarterData.roleFrequency[roleId].tier (single source of truth, R-05)
affects: [16-quarterly-schedule-share-link (remaining Schedule/Roster UX-redesign plans), src/components/QuarterShareMatrix.vue (future orientation analog)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Right-side Teleport slide-out (AvailabilityDrawer shape) reused for a second editor surface (QuarterGrid group editor) instead of an in-table expand row"

key-files:
  created: []
  modified:
    - src/components/QuarterGrid.vue
    - src/components/__tests__/QuarterGrid.test.ts

key-decisions:
  - "Group editor's Teleport/backdrop/panel/Transition markup copied verbatim from AvailabilityDrawer.vue (z-40 backdrop, z-50 right-anchored max-w-lg panel, identical enter/leave transition classes) — no second slide-out visual language introduced, per UI-SPEC constraint"
  - "Panel header uses '{Role name} — {formatted date}' title (existing formatDateLabel) with an icon-only × button, aria-label=\"Close editor\", mirroring AvailabilityDrawer's close-button markup exactly"
  - "expandedCell ref kept as the single source of slide-out open/close state (not renamed) — it already cleanly maps to isExpanded/toggleCell/closeDrawer without ambiguity"
  - "Existing tier-exclusion test mocks (previously frequencyTier/roleTiers) updated to PersonQuarterData.roleFrequency to match the component's repointed tierOf — required for those pre-existing tests to keep passing under the R-05 single-source repoint"

patterns-established:
  - "Teleport-stub testing pattern (global.stubs: { Teleport: { template: '<div><slot /></div>' } }) applied to QuarterGrid.test.ts, mirroring AvailabilityDrawer.test.ts, so teleported slide-out content is queryable via wrapper.find/findAll/text"

requirements-completed: [R-13, R-14, R-05]

# Metrics
duration: ~25min
completed: 2026-07-10
---

# Phase 16 Plan 07: QuarterGrid Group Editor Slide-Out + roleFrequency Repoint Summary

**Replaced QuarterGrid's in-table expand-underneath row with a right-side Teleport slide-out (AvailabilityDrawer's exact markup), verified the whole-cell click target and remove-pill isolation, and repointed tier reads to `PersonQuarterData.roleFrequency`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`src/components/QuarterGrid.vue`, `src/components/__tests__/QuarterGrid.test.ts`)

## Accomplishments

- Group editor moved out of the `<tr v-if="expandedCell">` in-table row into a `Teleport to="body"` slide-out, reusing `AvailabilityDrawer.vue`'s exact backdrop (`fixed inset-0 z-40 bg-black/60`) and right-anchored panel (`fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl`) plus its Transition enter/leave classes verbatim
- Panel content (current-assignments list with Clear/swap, add-person select, gap-filling blacked-out/available lists) moved into the slide-out unchanged — all `quartersStore.assignPerson/clearAssignment/swapAssignment` calls preserved verbatim
- Panel header shows "{Role name} — {formatted date}" with an icon-only × close button, `aria-label="Close editor"`; backdrop click and the × both close the panel
- Whole-cell `@click="toggleCell(date, role.id)"` confirmed already present and preserved; remove-pill's `@click.stop="onClear(...)"` confirmed preserved so quick-remove never opens the editor (R-13)
- `tierOf` repointed from the deprecated `roleTiers`/`frequencyTier` fallback chain to `pqd?.roleFrequency?.[roleId]?.tier ?? 'regular'` (R-05 single source of truth)
- Regression tests added: whole-cell click (including empty cell area) opens the slide-out; remove-pill click calls `clearAssignment` and does NOT open the slide-out; slide-out add/clear/swap actions each invoke the corresponding store method
- Existing tier-exclusion tests' mock `personQuarterData` updated from the deprecated `frequencyTier`/`roleTiers` shape to `roleFrequency` to match the repointed `tierOf`

## Task-by-Task Summary

### Task 1: Replace expand-underneath row with right-side Teleport slide-out; repoint tierOf
**Commit:** `06fb54e`
- `src/components/QuarterGrid.vue`: removed the `<tr v-if="expandedCell">` row; added a `Teleport to="body"` block (backdrop `Transition` + panel `Transition`) after `</div>` closing the table wrapper, hosting the unchanged panel content; added `closeDrawer()` alongside the existing `toggleCell`/`isExpanded`; repointed `tierOf` to `roleFrequency[roleId]?.tier ?? 'regular'`
- Verified: `npx vue-tsc --build` exits 0; `<tr v-if="expandedCell"` grep count 0; `Teleport` grep count 3 (backdrop, panel wrapper, `<Teleport to="body">` opening tag); `@click.stop` still present on the remove-pill; `roleFrequency` read confirmed at `tierOf`

### Task 2: Regression tests — whole-cell opens slide-out, remove-pill doesn't, slide-out actions work
**Commit:** `de332ad`
- `src/components/__tests__/QuarterGrid.test.ts`: added `mountGrid()` helper stubbing `Teleport` (mirrors `AvailabilityDrawer.test.ts`'s pattern) so teleported panel content is queryable; added a `describe` block for R-13/R-14 whole-cell/remove-pill isolation and a second `describe` block for R-14 slide-out add/clear/swap actions; updated the three pre-existing tier-exclusion tests' mock data from `frequencyTier`/`roleTiers` to `roleFrequency` to match Task 1's repoint
- Verified: `npx vitest run src/components/__tests__/QuarterGrid.test.ts` — 11/11 passing; full suite (`npx vitest run`) — 676/676 passing; `npx vue-tsc --build` — 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tier-exclusion tests broken by the R-05 tierOf repoint**
- **Found during:** Task 1 (confirmed while running the test suite before starting Task 2)
- **Issue:** The plan's Task 1 correctly repoints `tierOf` to read only `roleFrequency[roleId]?.tier`, dropping the previous `roleTiers`/`frequencyTier` fallback. The three pre-existing tests in `QuarterGrid.test.ts` ("excludes an out tier person...", "still offers a person with no frequencyTier...", "excludes a person from a candidate list only for the role they are out for...") seeded their mock `personQuarterData` using the now-unread deprecated fields, so all three started failing once Task 1 landed.
- **Fix:** Updated the three tests' mock `personQuarterData` to use `roleFrequency: { [roleId]: { tier, n: 4 } }` instead of `frequencyTier`/`roleTiers`, preserving each test's original intent (out-tier exclusion, default-regular fallback, per-role tier isolation).
- **Files modified:** `src/components/__tests__/QuarterGrid.test.ts`
- **Commit:** `de332ad`

**2. [Rule 3 - Blocking] Teleported slide-out content unreachable via default `wrapper.find`/`.text()`**
- **Found during:** Task 2, first test-writing pass
- **Issue:** Vue Test Utils cannot query content teleported to `document.body` through the mounted wrapper's default DOM tree, so `wrapper.text()` assertions against slide-out content (role name, date, candidate names) returned empty/incomplete results after Task 1's Teleport migration.
- **Fix:** Applied the existing `AvailabilityDrawer.test.ts` pattern — `global: { stubs: { Teleport: { template: '<div><slot /></div>' } } }` — via a shared `mountGrid()` helper, rendering the Teleport's slot in place instead of moving it to `document.body`, making all slide-out content queryable through the wrapper as before.
- **Files modified:** `src/components/__tests__/QuarterGrid.test.ts`
- **Commit:** `de332ad`

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced by this plan.

## Threat Flags

None — both threat register entries (T-16-07-01, T-16-07-02) were the intended behavior (remove-pill `@click.stop` isolation; backdrop-click + header-× dual close) and no new network/auth/schema surface was introduced.
