---
phase: 143-dated-rehearsals-times-tab
plan: 02
subsystem: ui
tags: [vue, rehearsals, times-tab, component, tdd]
status: complete

requires:
  - phase: 143-01
    provides: createService stops seeding rehearsals; ADR-0245; R445 surface tests
provides:
  - "formatRehearsalDateShort exported from src/utils/rehearsalTimes.ts (empty/malformed guarded)"
  - "src/components/ServiceTimesPanel.vue: props-in/events-out Times panel (editable + read-only)"
  - "ARCHITECTURE.md behavioral note for the panel"
affects: [143-03 (editor wiring, Times tab, hasNonDisplayableRehearsal dot)]

tech-stack:
  added: []
  patterns:
    - "nullable override + computed fallback for pre-fill that follows late-arriving props"
    - "force native input value back on reject (unchanged one-way binding is not repainted)"
    - "panel-local legacy-first partition so shared sortRehearsals stays untouched"

key-files:
  created:
    - src/components/ServiceTimesPanel.vue
    - src/components/__tests__/ServiceTimesPanel.test.ts
  modified:
    - src/utils/rehearsalTimes.ts
    - src/utils/__tests__/rehearsalTimes.test.ts
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "Legacy rows render first (UI-SPEC / RESEARCH Pattern 5) rather than after dated rows (the coverage-report wording); sortRehearsals unchanged."
  - "Read-only label uses the existing formatter output 'Nov 6, 7:00 PM', not the UI-SPEC's illustrative weekday example."

patterns-established:
  - "Time input pre-fill: writable computed over a nullable override, reset to null after add"

requirements-completed: []

duration: ~25min
completed: 2026-10-27
---

# Phase 143 Plan 02: ServiceTimesPanel Summary

**Standalone `ServiceTimesPanel.vue` with an add-on-submit form, default-time pre-fill and chips, legacy "Needs a date/time" markers, and reject-clear revert, plus a shared `formatRehearsalDateShort`.**

## Accomplishments
- `formatRehearsalDateShort` now lives in the shared util (returns `''` for empty/malformed); `sortRehearsals`, `formatWallClockTime`, `isDisplayableRehearsal` bodies unchanged (one doc-comment line changed on `Rehearsal.date`).
- `ServiceTimesPanel.vue` implements the exact props/emits contract for 143-03: add form (disabled until date+time, resets after add, focus returns to the date input), org-default pre-fill via a nullable override, chips only for 2+ defaults, legacy-first row ordering with amber markers, reject-clear with a 4s `role="status"` message, report-time section with date helper, bare `v-if="!canEdit"` read-only branch with "No times set" empty state.
- 21 mount-based panel tests (R441 x7, R442 x3, R443 x6, R444 x5) plus 3 util tests.
- ARCHITECTURE.md entry added under Component & Composable Behavioral Notes.

## Task Commits
1. Task 1: formatRehearsalDateShort export + tests - `fc7b7a46`
2. Task 2: ServiceTimesPanel.vue + tests - `5edd6212`
3. Task 3: ARCHITECTURE.md behavioral note - `91703a91`

## Verification
- `npx vitest run` on ServiceTimesPanel, rehearsalTimes and services.rehearsalProjection tests: 43 passed.
- `npm run type-check` (vue-tsc --build): clean.
- Grep gates: no `v-html`, no store imports, ADR-0245 referenced, all static test ids present.

## Deviations from Plan
None - plan executed as written. (Test-authoring notes only: VTU `setValue` fires both `input` and `change`, so change-handler tests set the element value and trigger `change` directly.)

## Requirements
R441-R444 are NOT marked complete: each also depends on 143-03 (editor wiring: tab, parent handlers, persistence). REQUIREMENTS.md left unchanged.

## Manual / UAT items (batched to milestone end)
- Visual check of the Times panel (editable and read-only) at desktop and 360px: stacking below 640px, amber markers/borders, chip selected state.
- Native date/time picker behavior in a real browser when clearing a field (revert + message).
- Focus return to the add-form date input after Add and Remove with a real keyboard.

## Known Stubs
None. The panel is not yet mounted anywhere; 143-03 wires it into `ServiceEditorView`.

## Threat Flags
None. Text interpolation only; add payload re-validated by the parent in 143-03 (T-143-04).

## Self-Check: PASSED
- src/components/ServiceTimesPanel.vue, its test file, and this SUMMARY exist; commits fc7b7a46, 5edd6212, 91703a91 present in git log.
