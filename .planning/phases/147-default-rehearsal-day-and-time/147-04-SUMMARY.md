---
phase: 147-default-rehearsal-day-and-time
plan: 04
subsystem: ui
tags: [rehearsals, settings, vue, tdd, typescript]

requires:
  - phase: 147-default-rehearsal-day-and-time
    provides: normalizeWeekday, mostRecentWeekdayOnOrBefore, OrgSettings.rehearsalDefaultWeekday, ADR-0249 (Plan 02)
provides:
  - Default rehearsal day select in the Settings "Rehearsal & Report Defaults" card, saved with Save defaults
  - ServiceTimesPanel defaultWeekday prop and a pre-filled add-form Date (newDateOverride / defaultDate / newDate)
  - Display parity tests for an auto-added rehearsal in the panel, service card and dashboard
affects: [147-05]

tech-stack:
  added: []
  patterns:
    - "Writable computed over an override ref (newDateOverride ?? defaultDate), mirroring newTime"
    - "Ref-backed getter in a mocked store so a watcher on the store field can fire in a test"

key-files:
  created: []
  modified:
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts
    - src/components/ServiceTimesPanel.vue
    - src/components/__tests__/ServiceTimesPanel.test.ts
    - src/components/__tests__/ServiceCard.test.ts
    - src/views/__tests__/DashboardView.rehearsalTimes.test.ts

key-decisions:
  - "The select value is the stored number (index into REHEARSAL_WEEKDAY_NAMES) or null, never a name, so None stays distinct from Sunday"
  - "Day-select tests pick an option by selectedIndex plus a change event; setSelected is private in the VTU typings"
  - "Plan 05 still has to pass defaultWeekday to ServiceTimesPanel; until then the prop defaults to null and the form is unchanged"

requirements-completed: [R459, R465]
requirements-note: "R459, R463, R464, R465 are in the plan frontmatter but deliberately left open; the orchestrator closes them after phase verification."

duration: 25min
completed: 2026-11-06
status: complete
---

# Phase 147 Plan 04: Settings day control and add-form default date Summary

**A "Default rehearsal day" select in Settings that saves 0-6 or null with the card's other defaults, and an add-rehearsal Date that pre-fills with the most recent default weekday on or before the service date.**

## Commits

| Commit | Hash | Holds |
|--------|------|-------|
| Task 1 RED | f29ec392 | `test(147-04)`: AC-RHD-01, 02, 03, 04, 05, 08, 09, 67; R442 test rewritten to the new sentence; WR-02 gains the weekday key |
| Task 1 GREEN | a3fc7140 | `feat(147-04)`: select, help text, save, rollback, church-switch watcher |
| Task 2 RED | 2ce4a498 | `test(147-04)`: AC-RHD-40 to 48, 53, 54 |
| Task 2 GREEN | bcd36677 | `feat(147-04)`: `defaultWeekday` prop, `newDateOverride`, `defaultDate`, writable `newDate` |
| Typing fix | 8d9c95a9 | `test(147-04)`: two TS errors the full type-check caught in the RED tests |

## What passed at RED

Task 1: 12 of 56 tests in `SettingsView.test.ts` failed at RED, and all were the new or deliberately changed tests: the AC-RHD-01 (three), 02 (two), 03, 04, 05, 08, 09 and 67 tests, plus WR-02. Every other test in the file passed.

Task 2: 5 failed at RED: AC-RHD-40, 43, 45, 46, 47. These passed at RED as declared regression guards: AC-RHD-41, 42, 44, 48, 53, and 54 (both the card and the dashboard test).

## Verification

- Scoped run of the four files: 115 passed, 0 failed.
- `npm run type-check` exits 0.
- Residual check: `uncited=14 other=0`, exit 0. This is the expected count with Plan 03 landed. Plan 05 closes the 14.
- No `w/mixed` on any file this plan touched. (`src/components/__tests__/AppSidebar.test.ts` is `w/mixed` already, which is unrelated.)
- Bare `npx vitest run` was not used as a pass condition (red window).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two TypeScript errors in my own RED tests**
- **Found during:** Task 2 verification (`npm run type-check`)
- **Issue:** `as Rehearsal[]` on a row carrying `autoAdded` (TS2352), and `setSelected()` being private in the VTU typings (TS2341). The scoped vitest run does not typecheck, so both passed locally until the full type-check.
- **Fix:** typed the marked row as `StoredRehearsal[]`; the day tests now set `selectedIndex` and trigger `change`.
- **Files modified:** `src/components/__tests__/ServiceTimesPanel.test.ts`, `src/views/__tests__/SettingsView.test.ts`
- **Commit:** 8d9c95a9

### Plan text versus outcome

- The plan expects `git log --format=%s -2` over the touched files to print the `feat(147-04):` subject first. Because of the typing fix, the newest commit on the Settings test file and the panel test file is `test(147-04): fix test typings...`, with the `feat` commit second. RED still precedes GREEN in every task.
- The plan's `Rehearsals:` wording in my first draft of the AC-RHD-54 tests was wrong. One row renders `Rehearsal:` (singular). Corrected before the RED commit.

## Notes for Plan 05

`ServiceTimesPanel` now accepts `defaultWeekday?: number | null`. Nothing passes it yet, so in the running app the add-form Date stays blank until Plan 05 wires `authStore.settings.rehearsalDefaultWeekday` through the Times tab.

## Pending human check

The `<human-check>` in Task 1 (Settings at about 375px wide, select stays inside the card) was not done. It needs a running local app and a browser. The select has no width utility and sizes to its longest option, so overflow is not expected, but it is unverified.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; the write goes through the existing `updateOrgSettings` under the existing `isEditor` guard (T-147-09), the option list gives only 0-6 or null (T-147-10), and the parity tests pin that the panel, card and dashboard render date and time only (T-147-11).
