---
phase: 04-output
plan: 01
subsystem: ui
tags: [vue, typescript, print, clipboard, planning-center, tailwind]

# Dependency graph
requires:
  - phase: 03-service-planning
    provides: ServiceEditorView, Service types, ServiceSlot types, SLOT_LABELS, songStore

provides:
  - ServicePrintLayout.vue — print-optimized light-theme service layout component
  - planningCenterExport.ts — plain-text formatter for Planning Center clipboard export
  - Print button in ServiceEditorView header (calls window.print())
  - Copy for PC button in ServiceEditorView header (clipboard with "Copied!" feedback)
  - formatForPlanningCenter() utility function
  - formatScriptureRef() utility function

affects: [04-02, share-functionality, export-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Print CSS pattern: wrap AppShell in print:hidden div, render ServicePrintLayout as sibling with hidden print:block
    - Clipboard feedback pattern: pcCopied ref toggled on click, reset via setTimeout(2000)
    - data-testid attributes on interactive buttons for reliable test targeting

key-files:
  created:
    - src/components/ServicePrintLayout.vue
    - src/components/__tests__/ServicePrintLayout.test.ts
    - src/utils/planningCenterExport.ts
    - src/utils/__tests__/planningCenterExport.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
  modified:
    - src/views/ServiceEditorView.vue

key-decisions:
  - "formatScriptureRef exported from planningCenterExport.ts and imported into ServicePrintLayout.vue (script setup cannot contain ES module exports)"
  - "ServicePrintLayout uses data-slot-row attribute on each slot div for test targeting (count assertion)"
  - "ServiceEditorView uses data-testid='print-btn' and data-testid='copy-pc-btn' for test targeting"
  - "Print layout wraps AppShell in print:hidden div; ServicePrintLayout is a sibling rendered after closing div"

patterns-established:
  - "Print CSS: app chrome wrapped in print:hidden, print component is hidden print:block sibling"
  - "Clipboard feedback: pcCopied ref + setTimeout(2000) for 2-second inline feedback"
  - "Vue test mocking: vi.mock() for stores/router/firebase, shallowMount with component stubs for view tests"

requirements-completed: [OUT-01, OUT-03]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 4 Plan 01: Print Layout and Planning Center Export Summary

**Print-optimized ServicePrintLayout component and formatForPlanningCenter() formatter wired into ServiceEditorView with Print button (window.print()) and Copy for PC button (clipboard + "Copied!" feedback)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T15:05:47Z
- **Completed:** 2026-03-04T15:11:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `planningCenterExport.ts` with `formatForPlanningCenter()` that formats all 9 slot types into a structured plain-text block with date, teams, progression, CCLI numbers, scripture refs, and sermon passage
- Created `ServicePrintLayout.vue` as a pure presentational component with `hidden print:block` classes — renders light-theme order of service with BPM lookup from song arrangements
- Wired Print and Copy for PC buttons into ServiceEditorView header; app chrome hidden when printing via `print:hidden` wrapper

## Task Commits

Each task was committed atomically:

1. **Task 1: ServicePrintLayout component and planningCenterExport formatter with tests** - `4736374` (feat)
2. **Task 2: Wire Print and Copy for PC buttons into ServiceEditorView header with tests** - `60b8dc8` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/utils/planningCenterExport.ts` — Exports formatForPlanningCenter() and formatScriptureRef(); handles SONG/SCRIPTURE/PRAYER/MESSAGE slot types with CCLI lookup and notes section
- `src/utils/__tests__/planningCenterExport.test.ts` — 16 tests covering all slot types, empty slots, missing CCLI, missing notes, missing sermon passage, teams fallback
- `src/components/ServicePrintLayout.vue` — Print-optimized Vue component with header (date/teams/progression), 9 slot rows with data-slot-row attributes, BPM lookup via arrangement key matching, notes section, footer
- `src/components/__tests__/ServicePrintLayout.test.ts` — 10 tests covering slot rendering, BPM display, empty slots, sermon passage, notes visibility, date/teams in header
- `src/views/ServiceEditorView.vue` — Added Print + Copy for PC buttons with data-testid attrs, pcCopied state, onPrint/onCopyForPC handlers, ServicePrintLayout import, print:hidden wrapper on AppShell
- `src/views/__tests__/ServiceEditorView.test.ts` — 3 tests: print button calls window.print(), copy button shows "Copied!", clipboard.writeText called with ORDER OF SERVICE text

## Decisions Made

- `formatScriptureRef` moved to `planningCenterExport.ts` rather than the Vue component — `<script setup>` cannot contain ES module exports, so the function is imported from the utility module instead
- Added `data-testid` attributes (`print-btn`, `copy-pc-btn`) to buttons for reliable test targeting without depending on button text
- Added `data-slot-row` attribute to each slot div in ServicePrintLayout for counting assertions in tests
- ServicePrintLayout imported into ServiceEditorView and rendered as a sibling after the `print:hidden` AppShell wrapper (ServicePrintLayout itself has `hidden print:block` so it is invisible on screen)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid `export` keyword from function inside `<script setup>`**
- **Found during:** Task 1 (ServicePrintLayout component creation)
- **Issue:** Plan action spec said to add `export function formatScriptureRef` inside `<script setup>` — Vue 3 SFC compiler does not allow ES module exports in `<script setup>`
- **Fix:** Removed `export` keyword; imported `formatScriptureRef` from `planningCenterExport.ts` instead (where it is already exported)
- **Files modified:** `src/components/ServicePrintLayout.vue`
- **Verification:** ServicePrintLayout tests all pass (10/10)
- **Committed in:** 4736374 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Minimal fix required by Vue 3 SFC compiler constraint. No scope creep.

## Issues Encountered

None beyond the auto-fixed Vue SFC export constraint.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Print and clipboard export fully functional; ready for Plan 02 (share functionality)
- ServiceEditorView header has a code comment `// Share button added in Plan 02` placeholder
- 217 total tests pass; production build succeeds with no errors

---
*Phase: 04-output*
*Completed: 2026-03-04*

## Self-Check: PASSED

All files exist and all commits verified:
- FOUND: src/components/ServicePrintLayout.vue
- FOUND: src/components/__tests__/ServicePrintLayout.test.ts
- FOUND: src/utils/planningCenterExport.ts
- FOUND: src/utils/__tests__/planningCenterExport.test.ts
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND commit: 4736374
- FOUND commit: 60b8dc8
