---
phase: 86-recurring-team-scheduling
plan: 02
subsystem: ui
tags: [vue, pinia, team-scheduling, recurrence, slide-over]

# Dependency graph
requires:
  - phase: 86-recurring-team-scheduling
    plan: "86-01"
    provides: "Team.recurrence?: { ordinals: number[] } optional storage field + teamMatchesDate matching helpers"
provides:
  - "TeamRecurrenceSlideOver.vue — Teleported right-drawer UI for configuring a team's Nth-Sunday recurrence pattern"
  - "Per-row > chevron on TeamsConfigPanel.vue opening the slide-over"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Teleport-to-body right-drawer shell (scrim + translate-x-full panel transitions) reused verbatim from SongSlideOver.vue for a second, unrelated entity (Team)"
    - "Local editable-copy-then-persist-on-Save pattern: a ref seeded from the prop on open, never mutating the store object directly, mirroring TeamsConfigPanel's own teamDrafts convention"

key-files:
  created:
    - src/components/TeamRecurrenceSlideOver.vue
  modified:
    - src/components/TeamsConfigPanel.vue
    - src/components/__tests__/TeamsConfigPanel.test.ts

key-decisions:
  - "Toggle controls are five full-width buttons (1st-5th Sunday) with aria-pressed state, not checkboxes — matches the button-toggle visual language already used elsewhere in the app's slide-overs (e.g. SongSlideOver's VW Category buttons) rather than introducing a new checkbox pattern."
  - "No unsavedGuard/dirty-tracking composable (unlike SongSlideOver) — the recurrence editor has no destructive delete flow and a five-item toggle set has low accidental-loss risk; Cancel/scrim/X all close without persisting, matching the plan's explicit scope (mirror the shell, not every SongSlideOver behavior)."

requirements-completed: [R254]

coverage:
  - id: D1
    description: "TeamRecurrenceSlideOver.vue exists, mirrors the SongSlideOver Teleport/transition/header shell (Teleport to body, scrim, translate-x-full panel, header with Cancel/Save/close), exposes open+team props and close+saved emits"
    requirement: "R254"
    verification:
      - kind: unit
        ref: "npx vue-tsc --noEmit -p tsconfig.app.json (type-check, no errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Opening the slide-over seeds local ordinals from team.recurrence.ordinals (sorted ascending); a team with no recurrence starts with nothing selected"
    requirement: "R254"
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts — 'clicking a chevron opens the slide-over with that team's saved ordinals pre-selected' and 'a team opened with no recurrence starts with nothing selected'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each team row renders a > chevron with a per-team aria-label; clicking it opens TeamRecurrenceSlideOver for that team; existing row behaviours (rename soft-warn, duplicate-name guard, delete confirm, Add-Team) are unchanged"
    requirement: "R254"
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts — full 18-test file passes, including all pre-existing WR-01/WR-02/WR-04/IN-02/R245 assertions"
        status: pass
    human_judgment: false
  - id: D4
    description: "Save persists the sorted local ordinals via teamsStore.updateTeam(id, { recurrence: { ordinals } }), including the empty-clear case; toggling + Save and Clear + Save both call the store correctly"
    requirement: "R254"
    verification:
      - kind: unit
        ref: "src/components/__tests__/TeamsConfigPanel.test.ts — 'toggling ordinals and clicking Save calls updateTeam with the sorted selection' and 'clearing to none then Save persists an empty ordinals array'"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-26
status: complete
---

# Phase 86 Plan 02: Recurrence Slideout UI Summary

**`TeamRecurrenceSlideOver.vue` — a Teleported right-drawer mirroring `SongSlideOver.vue`'s shell — plus a per-row `>` chevron on the Volunteer → Teams tab, letting a planner multi-select 1st–5th Sunday ordinals (or clear to none) and persist via `teamsStore.updateTeam(id, { recurrence })`, with the saved pattern round-tripping on reopen.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-08-27T01:37:00Z (approx, first commit 2026-08-26T21:37:59-04:00)
- **Completed:** 2026-08-27T01:48:00Z (approx, last task commit 2026-08-26T21:41:33-04:00, plus verification)
- **Tasks:** 3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `TeamRecurrenceSlideOver.vue` mirrors `SongSlideOver.vue`'s Teleport-to-body / scrim / `translate-x-full` panel-transition shell, with a header (team name, Save, close) and a body of five toggle buttons (1st–5th Sunday) plus a Clear-selection action.
- The slide-over seeds its local (copy, not store-mutating) ordinals array from `props.team?.recurrence?.ordinals` every time it opens, sorted ascending — this is what makes a reopened panel show the previously saved pattern (R254 round-trip).
- `TeamsConfigPanel.vue` gets an additive per-row `>` chevron (accessible `aria-label="Edit recurring schedule for {name}"`), sitting alongside the existing Save Team / Delete buttons, opening a single slide-over instance mounted once outside the row loop.
- Save calls `teamsStore.updateTeam(team.id, { recurrence: { ordinals: <sorted> } })`, including persisting `{ ordinals: [] }` when cleared to none. Cancel/scrim/close all discard without persisting.
- `TeamsConfigPanel.test.ts` extended with 5 new tests covering: chevron discoverability by aria-label, pre-selected ordinals on open (Choir seeded with `[1,3]`), no-recurrence starts empty (Orchestra), toggle+Save persists sorted ordinals, and Clear+Save persists `[]`. All 13 pre-existing tests continue to pass unchanged (18 total).

## Task Commits

Each task was committed atomically:

1. **Task 1: TeamRecurrenceSlideOver component (mirrors SongSlideOver shell)** - `352a7697` (feat)
2. **Task 2: Per-row > chevron opening the slide-over in TeamsConfigPanel** - `373f92ab` (feat)
3. **Task 3: Slideout save round-trip test** - `87526e8c` (test)

**Plan metadata:** (this commit, docs: complete plan)

_Task 3 is marked `tdd="true"` in the plan, but the component under test (Tasks 1-2) was already implemented — writing the tests produced an immediate GREEN (all 18 tests, including the 5 new ones, passed on the first run), so there is no separate RED commit. See TDD Gate Compliance below._

## Files Created/Modified
- `src/components/TeamRecurrenceSlideOver.vue` - Teleported right-drawer; props `open`/`team`, emits `close`/`saved`; local `localOrdinals` ref seeded on open, toggle/clear controls, `onSave` calls `teamsStore.updateTeam`
- `src/components/TeamsConfigPanel.vue` - per-row `>` chevron button (SVG, `aria-label` naming the team), `slideoverTeam` ref, single `TeamRecurrenceSlideOver` instance mounted outside the row loop
- `src/components/__tests__/TeamsConfigPanel.test.ts` - `mountPanel` now stubs `Teleport` (renders inline for queries, matching `NewServiceDialog.test.ts`'s precedent); Choir mock team seeded with `recurrence: { ordinals: [1, 3] }`; 5 new R254 tests appended

## Decisions Made
- **Button-toggle controls, not checkboxes** — the five ordinal options render as full-width `aria-pressed` buttons (matching `SongSlideOver`'s VW Category button-toggle pattern) rather than introducing a new checkbox visual language into the slide-over family.
- **No `useUnsavedGuard`/dirty-tracking** — unlike `SongSlideOver`, this editor has no delete flow and a 5-item toggle set is low-risk to lose; Cancel/scrim/X close unconditionally. This mirrors the plan's explicit scope ("mirror the shell", not every `SongSlideOver` behavior).

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the implementation matched the plan's `<action>` blocks directly.

## TDD Gate Compliance

Task 3 carries `tdd="true"`, but its `<files>` (the test file only) targets behavior already built in Tasks 1 and 2 of this same plan — there was no un-implemented behavior left to drive RED-first. Running the extended test suite for the first time produced 18/18 passing (13 pre-existing + 5 new), i.e. an immediate GREEN with no separate failing-test commit. This is expected given the plan's own task ordering (component → wiring → test-of-what-was-just-built), not a process gap; `npm run type-check` and the full scoped test file both pass as required by the plan's `<verification>` block.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R254 is now fully complete (storage model from 86-01 + slideout UI from this plan). Marked complete in `.planning/REQUIREMENTS.md` (checkbox + traceability row).
- Phase 86 (R254, R255) is now fully complete — both plans (86-01, 86-02) done.
- No blockers for Phase 87.

---
*Phase: 86-recurring-team-scheduling*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: src/components/TeamRecurrenceSlideOver.vue
- FOUND: .planning/phases/86-recurring-team-scheduling/86-02-SUMMARY.md
- FOUND commit: 352a7697 (feat: TeamRecurrenceSlideOver component)
- FOUND commit: 373f92ab (feat: chevron wiring in TeamsConfigPanel)
- FOUND commit: 87526e8c (test: slideout save round-trip)
