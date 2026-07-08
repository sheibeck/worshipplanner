---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 09
subsystem: frontend
tags: [vue, tailwind, quarter-grid, scheduling, gap-filling, pinia, editable-grid]

# Dependency graph
requires:
  - phase: 13-06
    provides: "src/stores/quarters.ts useQuartersStore (assignPerson, clearAssignment, swapAssignment, generateProposal scoped Firestore dot-path cell edits); ProposeResult type"
  - phase: 13-08
    provides: "src/views/QuarterView.vue quarter setup shell with grid-host placeholder + proposeResult state; /schedule editor route"
provides:
  - "QuarterGrid.vue — the phase-centerpiece editable dates×roles schedule grid: person chips per cell (multi-person-per-role + multi-role-per-person, D-04), dashed unfilled cells with red badge (D-10), amber pairing-conflict badge, click-to-expand per-cell editor (assign/clear/swap/add), and a per-gap gap-filling panel (blacked-out + available-unassigned, D-23). Mounted in QuarterView's grid host."
affects: ["13-10 (print/share reads the same calendar surface the grid edits)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-row-per-date table layout — each service date renders a data row plus a conditionally-rendered full-width (colspan) expansion row directly beneath it that holds the inline cell editor + gap panel, keeping edit UI in document flow without a floating popover"
    - "Effective-count-driven unfilled detection — a cell is flagged unfilled when assigned count < effective count (roleOverridesByDate[date] override, else role.defaultCount) OR the (date,roleId) appears in lastProposeResult.unfilled, so manual clears re-flag a cell immediately without regenerating"
    - "Static RoleGroup->class map (band=blue-900/50, tech=purple-900/50, other=gray-800) mirroring SongBadge.vue — no dynamically constructed Tailwind class strings, surviving v4 purge"
    - "Group-then-order role sort — GROUP_ORDER index primary key, role.order secondary — renders Band/Tech/Other column bands in stable order independent of raw role ordering"
    - "Gap-panel candidate helpers derived purely from quarter.personQuarterData + quarter.calendar + rosterStore.activePeople (role + not-blacked-out + not-already-in-cell) — no scheduler call needed to surface who to contact"

key-files:
  created:
    - src/components/QuarterGrid.vue
  modified:
    - src/views/QuarterView.vue

key-decisions:
  - "Cell edits are dispatched straight to the existing scoped store actions (assignPerson/clearAssignment/swapAssignment) which each write only calendar.{date}.{roleId} via Firestore dot-path — the grid never rewrites the whole calendar map (T-13-09-02)"
  - "Clearing a chip has no confirmation (UI-SPEC low-friction edit) — the × on a chip and the editor's Clear button both call clearAssignment directly"
  - "expandedCell single-open state (one {date,roleId} at a time) — clicking an expanded cell collapses it; the editor row renders only for the date whose cell is open, so at most one expansion row exists in the DOM"
  - "The gap-filling panel only renders when the expanded cell is still unfilled (cellIsUnfilled) — a fully-staffed cell's editor shows just the assign/clear/swap controls, keeping the panel focused on actual gaps (D-23)"
  - "Swap uses a transient per-row <select> reset to '' after firing (not v-model) so the same swap dropdown can be reused; add-a-person uses a v-model addSelectId cleared after Assign"
  - "Candidate lists (eligible/blacked-out) are scoped to people who actually list the role — a person without the role never appears in either gap list even if free that date"

# Threat model
threat-notes:
  - "T-13-09-02 (tampering / cross-cell corruption) mitigated: all edits go through the Plan-06 scoped dot-path store actions; grid holds no whole-calendar write path"
  - "T-13-09-01 (roster PII exposure) inherited-mitigated: grid lives only on the editor-gated /schedule route (Plan 08 meta); no viewer path reaches it"
  - "T-13-09-03 (manual assignment onto a blacked-out person) accepted per D-22: the gap panel strikethrough-marks blacked-out people so the leader override is visible; blacked-out people are excluded from the eligible/assign candidate list so an accidental assignment requires a deliberate action outside the panel"

# Metrics
metrics:
  duration: ~15min
  tasks_completed: 3
  files_created: 1
  files_modified: 1
  completed: 2026-07-07
---

# Phase 13 Plan 09: Editable Quarter Grid + Gap-Filling Panel Summary

The dates×roles editable schedule grid (`QuarterGrid.vue`) — the phase centerpiece where the leader spends most of their time — rendering person chips per cell over the Plan-06 scoped cell-edit store actions, flagging unfilled and pairing-conflict cells, and exposing a per-gap panel of who is blacked out vs. available-but-unassigned so gaps can be filled by hand.

## What Was Built

**Task 1 — Grid render + per-cell edit (`481e943`):**
- `src/components/QuarterGrid.vue` taking props `{ quarter, roles, lastProposeResult }`.
- Header row = role columns grouped Band (blue-900/50) / Tech (purple-900/50) / Other (gray-800) via a static `RoleGroup->class` map, `text-xs font-medium text-gray-400 uppercase tracking-wider`; sticky left date column (`text-sm font-medium text-gray-100`).
- Per (date, role) cell: effective count from `roleOverridesByDate[date]` (else `role.defaultCount`), assigned personIds from `calendar[date]?.[roleId]`. Assigned people render as pill chips (`rounded-full px-2 py-0.5 text-xs font-medium border`, TeamTagPill shape); cells with fewer people than the effective count (or listed in `lastProposeResult.unfilled`) render a dashed empty slot (`border border-dashed border-gray-700`) with a red "Unfilled" badge. An amber "Pairing conflict" badge shows on cells whose assigned people are in `lastProposeResult.pairingConflicts` for the date.
- Clicking a cell expands an inline editor row: per-person Clear (no confirmation), a "Swap with…" dropdown (`swapAssignment`), and an "Add a person…" dropdown + Assign button (`assignPerson`, D-04 multi-person). The chip × also clears directly.
- Cell padding `px-2 py-2` (sm token). Mounted in `QuarterView.vue` at the Plan-08 placeholder with `proposeResult` passed as `lastProposeResult`.

**Task 2 — Gap-filling panel (`1f4fa12`):**
- When an expanded cell is still unfilled, a two-column panel renders under the row: "Blacked out today" (active people who list the role but whose `personQuarterData[personId].blackoutDates` includes the date, gray-500 strikethrough) and "Available, not yet assigned" (active people who list the role, not blacked out that date, not already in the cell, green-tinted `bg-green-900/30 text-green-400`).
- Each available candidate has a one-click Assign action calling `quartersStore.assignPerson`.
- Both lists are computed purely from `quarter.personQuarterData`, `quarter.calendar`, and `rosterStore.activePeople` — no scheduler call.

**Task 3 — Checkpoint (human-verify):** Auto-approved by the coordinator (manual browser verification skipped and implementation accepted). Automated verification (`vue-tsc --build` clean, all acceptance-criteria greps passing) stands in for the visual pass.

## Verification

- `npx vue-tsc --build` — clean (EXIT 0) after each task, covering `QuarterGrid.vue` + `QuarterView.vue`.
- Acceptance greps: `assignPerson` (2), `clearAssignment` (1), `swapAssignment` (1) all present; `border-dashed` + "Unfilled" + "Pairing conflict" present; dynamic `bg-${` count = 0; `px-2 py-2` present; `confirm` count = 0 (no clear-confirmation); "Blacked out today" + "Available, not yet assigned" present; `blackoutDates` referenced.

## Deviations from Plan

None — plan executed as written. (Implementation note: to honor the atomic per-task commit protocol, the initially-drafted single-pass component was split — the gap-filling panel was removed and re-added as a separate Task 2 commit so each task maps to one commit.)

## Self-Check: PASSED

- FOUND: src/components/QuarterGrid.vue
- FOUND: src/views/QuarterView.vue (modified — mount + import)
- FOUND commit: 481e943 (Task 1)
- FOUND commit: 1f4fa12 (Task 2)
