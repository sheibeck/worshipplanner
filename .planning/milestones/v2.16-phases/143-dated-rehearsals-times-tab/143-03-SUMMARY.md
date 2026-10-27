---
phase: 143-dated-rehearsals-times-tab
plan: 03
subsystem: ui
tags: [vue, rehearsals, times-tab, service-editor, tdd, autosave]
status: complete

requires:
  - phase: 143-01
    provides: createService stops seeding rehearsals; ADR-0245; R445 surface tests
  - phase: 143-02
    provides: ServiceTimesPanel.vue (props/emits contract) and formatRehearsalDateShort
provides:
  - "Times tab (#svc-tab-times / #svc-panel-times) in ServiceEditorView, last tab for editors and viewers"
  - "Editor-only amber attention dot (times-tab-attention-dot) when any rehearsal row is non-displayable"
  - "Validated, R036-gated rehearsal/report-time handlers (rows are only ever created dated and timed)"
  - "ActionBarTab 'times' with an explicit empty action-bar branch"
  - "Phase 139 header Times block deleted; nothing time-related above the tab strip"
affects: [phase 143 verification, milestone-end batched UAT]

tech-stack:
  added: []
  patterns:
    - "Parent wrapper div carries v-show/id/role/aria-labelledby around the child panel, identical to sibling tab panels (ids hold under shallowMount stubs)"
    - "Handler-side defense in depth: child validates, parent re-validates with the same regexes"

key-files:
  created: []
  modified:
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/serviceEditorActionBar.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.timesSection.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/ServiceEditorView.stage.test.ts

key-decisions:
  - "onAddRehearsal takes { date, time } and refuses anything not YYYY-MM-DD / HH:mm; the zero-arg empty-row push is gone"
  - "A dated/timed row can never be cleared through onRehearsalDateChange/onRehearsalTimeChange; malformed non-empty values are a no-op; legacy empty rows can still be filled"
  - "Attention dot shown to editors on locked services too (information signal, not an edit control)"
  - "Tab-panel attributes live on a parent wrapper div, not the panel root (RESEARCH Pattern 1 discretion)"

patterns-established:
  - "Times tab unconditional in visibleTabOrder (no isEditor gate), unlike Roles/Stage/Messages"

requirements-completed: [R441, R443, R444]

duration: ~35min
completed: 2026-10-27
---

# Phase 143 Plan 03: Times Tab Wiring Summary

**Times tab in ServiceEditorView hosting ServiceTimesPanel, with an editor-only amber attention dot, R036-gated handlers that can only create dated+timed rows, and the Phase 139 header block removed.**

## Accomplishments
- `ActionBarTab` gains `'times'`; `buildActionBarItems('times', ctx)` returns `[]` (explicit branch, so the Times tab no longer falls through to the Service Order items); TIMES EMPTY cartesian test and two gating-matrix rows added.
- `ServiceEditorView.vue`: header "Times" block deleted entirely; sixth tab (third for viewers) added after Messages with the same classes and roving-tabindex support; `v-show` panel wrapper `#svc-panel-times` (`data-testid="times-panel"`) hosts `<ServiceTimesPanel>` bound to `canEditService`, `authStore.settings.rehearsalTimeDefaults ?? []`, and the five handlers. `onSave`, `isDirty` and the autosave wiring are untouched.
- Handlers: `onAddRehearsal({date,time})` ignores any payload that is not `YYYY-MM-DD` + `HH:mm`; `onRehearsalDateChange` / `onRehearsalTimeChange` reject clearing a non-empty value and any malformed non-empty value; all five handlers re-check `canEditService` first (R036).
- The view-local `editableRehearsals` / `readOnlyRehearsals` computeds and short-date formatter were removed (the panel owns ordering and formatting); the `rehearsalTimes` import is reduced to `isDisplayableRehearsal`.
- `ServiceEditorView.timesSection.test.ts` rewritten (30 tests, RED committed first, 26 failing before the wiring): header removal, tab ARIA wiring, gating, prop forwarding, attention dot, add/clear/malformed handler invariants, R036 direct-handler gates, no-write-on-load (900 ms), autosave persistence, tab switch mid-debounce, and v-show persistence of an in-progress add form.
- Existing tab-order tests in `ServiceEditorView.test.ts` and `ServiceEditorView.stage.test.ts` updated for Times as the last tab.

## Task Commits
1. Task 1: ActionBarTab 'times' + empty branch - `219bed9a`
2. Task 2: failing Times-tab view tests (RED) - `719ec844`
3. Task 3: wire Times tab, delete header block, validate handlers, update tab-order tests (GREEN) - `fae26f25`

## Verification
- `npx vitest run` on timesSection, stage, serviceEditorActionBar, ServiceTimesPanel: 131 passed; `ServiceEditorView.test.ts`: 352 passed.
- `npm run type-check` (vue-tsc --build): clean.
- Full bare `npx vitest run`: 242 files passed, 1 failed (`src/storage.rules.test.ts`, the documented baseline), 6050 tests passed, 43 skipped.
- Acceptance greps: `service-times-section`, `editableRehearsals|readOnlyRehearsals`, `function formatRehearsalDateShort`, `date: ''`, and the report-time/rehearsal-date inputs all 0 in `ServiceEditorView.vue`; `<ServiceTimesPanel`, `id="svc-tab-times"`, `id="svc-panel-times"`, `tabs.push('times')` each 1 (and not isEditor-gated); `if (!canEditService.value) return` count 30 = 30 at 3539cb2a; no diff hunk overlaps `onSave`.
- R445 source gate: no commits touching the read-surface files since 3539cb2a.

## Deviations from Plan
None - plan executed as written. (The post-RED type-check flagged `rows[0]` as possibly undefined in the new test file under `noUncheckedIndexedAccess`; fixed with optional chaining in the same task before the GREEN commit.)

## Requirements
R441, R443 and R444 marked complete (R442 and R445 were already complete from 143-01/143-02).

## Manual / UAT items (batched to milestone end, PENDING - not owner-accepted)
1. R441: in Chrome and Safari, clearing a dated rehearsal's date (and time) snaps back with the amber message for about 4 s; check whether backspacing a single segment reverts mid-typing (RESEARCH A1).
2. R444: at a 360 px phone width, scroll the tab strip, tap Times, confirm the panel shows and the active tab scrolls into view.
3. R443: open a v2.15 service with an undated row; amber dot shows on the Times tab, and the "Needs a date" marker and amber input border are legible on gray-950.
4. R444: below 640 px, rehearsal rows and the add form stack vertically with full-width inputs.
5. R443: a screen reader announces "Times (needs attention)" when legacy rows exist.
6. Plan-02 carry-over: native date/time picker clear behavior and focus return after Add/Remove with a real keyboard.

## Known Stubs
None.

## Threat Flags
None. T-143-08..T-143-11 mitigated as planned (handler self-gates, regex validation, no load-time write, explicit empty action-bar branch); T-143-12 accepted (pre-existing: rules do not validate rehearsal fields).

## Notes
- `/gsd:graphify build` not run (graph files are being left alone per execution instructions); graph remains stale.

## Self-Check: PASSED
- Files exist: ServiceEditorView.vue, serviceEditorActionBar.ts, the rewritten timesSection test, this SUMMARY.
- Commits present in git log: 219bed9a, 719ec844, fae26f25.
