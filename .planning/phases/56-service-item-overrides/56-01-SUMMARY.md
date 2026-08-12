---
phase: 56-service-item-overrides
plan: 01
subsystem: ui
tags: [vue, service-editor, planning-center, misc-label, slots]

# Dependency graph
requires:
  - phase: 260811-vsr (quick)
    provides: the three-rail row layout + consolidated notes-canonical field the label input fits into
provides:
  - Optional label? on NonAssignableSlot (MISC-only, non-destructive)
  - Optional label? on ServiceTemplateEntry (template-path parity)
  - miscLabel() helper — single "label-or-Miscellaneous" source of truth
  - MISC label editing in live editor + template editor, PC export title, print
affects: [56-02, planning-center-export, service-templates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared display helper (miscLabel) used by editor, PC export, and print so the default can never diverge across surfaces"
    - "Optional absent-key field lifecycle: `x ? { x } : {}` spread + `|| undefined` on empty input so stripUndefined drops the key (mirrors notes/body)"

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/types/organization.ts
    - src/utils/slotTypes.ts
    - src/utils/planningCenterApi.ts
    - src/components/ServicePrintLayout.vue
    - src/views/ServiceEditorView.vue
    - src/components/settings/ServiceTemplateEditor.vue

key-decisions:
  - "label is a DISTINCT compact name input, not a second notes box (D-01) — MISC keeps its consolidated notes/details field AND gains a separate label"
  - "slotLabel unchanged — the per-kind badge stays the stable 'Miscellaneous' TYPE indicator; the custom name is its own field"
  - "createSlot gains a trailing optional label param (MISC-only); absent-key contract preserved via labelFields spread"

patterns-established:
  - "miscLabel(slot) = slot.label?.trim() || 'Miscellaneous' — one helper for every surface"

requirements-completed: [R127]

coverage:
  - id: D1
    description: "miscLabel() helper returns custom label when set, 'Miscellaneous' for whitespace/absent"
    requirement: R127
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#miscLabel (R127)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PC export titles a MISC item with its custom label (or 'Miscellaneous' when unset)"
    requirement: R127
    verification:
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#exports a MISC slot with a custom label as that label in the item title"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live editor MISC label input round-trips (type -> slot.label; clear -> undefined); viewer sees miscLabel read-only"
    requirement: R127
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#R127: typing into the MISC label input sets slot.label; clearing it to empty yields undefined"
        status: pass
    human_judgment: false
  - id: D4
    description: "Print renders the custom MISC label in place of the hard-coded 'Miscellaneous'"
    requirement: R127
    verification:
      - kind: unit
        ref: "src/components/__tests__/ServicePrintLayout.test.ts#renders a MISC slot with a custom label in place of \"Miscellaneous\" (R127)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Template MISC label flows into created slots via createSlot/buildSlotsFromTemplate; template editor input round-trips"
    requirement: R127
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#an entry { kind: MISC, label } threads label into the built slot (R127)"
        status: pass
      - kind: unit
        ref: "src/components/settings/__tests__/ServiceTemplateEditor.test.ts#typing sets the draft entry label; the save payload carries the typed text"
        status: pass
    human_judgment: false
  - id: D6
    description: "Label input styling within the three-rail row (visual/mobile fit)"
    requirement: R127
    verification: []
    human_judgment: true
    rationale: "Owner visual verification deferred under the v1.6 standing grant; recorded in PENDING-VERIFICATION.md."

# Metrics
duration: ~35min
completed: 2026-08-12
status: complete
---

# Phase 56 Plan 01: MISC Editable Label Summary

**An optional custom label for Miscellaneous service items — editable in both the live and template editors, exported as the Planning Center item title, and rendered in print — via a single `miscLabel()` helper and an absent-key-preserving optional field.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (both TDD)
- **Files modified:** 10 (5 source + 5 test, across the two tasks)

## Accomplishments
- Added optional `label?` to `NonAssignableSlot` and `ServiceTemplateEntry` — both non-destructive, absent-key preserved (no migration).
- Introduced `miscLabel(slot)` as the single "label-or-Miscellaneous" source of truth, used by the live editor viewer text, the PC export title, and print.
- Wired a distinct compact label input into the live editor MISC row (above the shared notes field, `canEditService`-gated) and the template editor, with the template label flowing into created slots via `createSlot`/`buildSlotsFromTemplate`.
- PC export MISC item title now uses `miscLabel(slot)` instead of the hard-coded "Miscellaneous"; unset MISC items are byte-identical to today.

## Task Commits

1. **Task 1: MISC label model + miscLabel helper + live editor input + PC export title + print** - `8f72116` (feat)
2. **Task 2: MISC label in the template path — entry model, createSlot/buildSlotsFromTemplate, template editor UI** - `84da0cd` (feat)

_TDD tasks: implementation + tests committed together per task._

## Files Created/Modified
- `src/types/service.ts` - added `label?` to `NonAssignableSlot` with D-01 doc comment
- `src/types/organization.ts` - added `label?` to `ServiceTemplateEntry`
- `src/utils/slotTypes.ts` - added `miscLabel()`; extended `createSlot` with trailing `label` param; threaded `entry.label` through `buildSlotsFromTemplate`
- `src/utils/planningCenterApi.ts` - MISC branch title `'Miscellaneous'` -> `miscLabel(slot)`; import added
- `src/components/ServicePrintLayout.vue` - MISC label span renders `{{ miscLabel(slot) }}`; import added
- `src/views/ServiceEditorView.vue` - MISC-only label input (editor) + `miscLabel` read-only text (viewer); import added
- `src/components/settings/ServiceTemplateEditor.vue` - MISC label input, `onLabelChange` handler, `entryDisplayName` for the displayed name
- Test files: `slotTypes.test.ts`, `planningCenterApi.test.ts`, `ServicePrintLayout.test.ts`, `ServiceEditorView.test.ts`, `ServiceTemplateEditor.test.ts`

## Decisions Made
- Followed plan/D-01 as specified: label is a distinct name input, not a repurposed notes field; `slotLabel`/badge left unchanged.

## Deviations from Plan
None - plan executed exactly as written. (One test-authoring adjustment: the template editor "displayed-name" case was split into two `it` blocks because the editor Teleports to `document.body` and a double-mount within one test stacks both instances — not a plan deviation, a test-isolation correction.)

## Gate Results
- `npm run type-check` (vue-tsc --build): clean after both tasks.
- Task 1 targeted suites (slotTypes, planningCenterApi, ServicePrintLayout, ServiceEditorView): 515 passed.
- Task 2 targeted suites (slotTypes, ServiceTemplateEditor): 136 passed.
- Full app suite `npx vitest run --dir src --exclude '**/rules.test.ts'`: 3100 passed, 13 failed across EXACTLY the 2 known-baseline files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). No other regression.

## Issues Encountered
None beyond the test-isolation split noted above.

## User Setup Required
None.

## Next Phase Readiness
- Plan 56-02 (R128 Scripture version override) depends on this plan and touches overlapping files (`src/types/service.ts`, `src/utils/planningCenterApi.ts`, `src/views/ServiceEditorView.vue`) — proceeds sequentially in place.
- Owner visual verification of the label input styling within the three-rail row is deferred (PENDING-VERIFICATION.md).

---
*Phase: 56-service-item-overrides*
*Completed: 2026-08-12*

## Self-Check: PASSED

All listed files exist on disk; all task commits (8f72116, 84da0cd) present in git.
