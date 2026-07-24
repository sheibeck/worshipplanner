---
id: T06
parent: S01
milestone: M001
key_files:
  - src/components/PerformanceOrderBuilder.vue
  - src/components/__tests__/PerformanceOrderBuilder.test.ts
key_decisions:
  - SortableJS DOM-revert pattern mirrors ServiceEditorView exactly — revert DOM move in onEnd, update reactive array, let Vue re-render as single source of truth
  - Sections can be added multiple times to support repeats (e.g. Chorus appearing 3x in performance order)
  - SortableJS mocked in tests since jsdom does not support real drag events — drag-and-drop tested via reactive array manipulation
duration: 
verification_result: passed
completed_at: 2026-07-24T13:15:57.869Z
blocker_discovered: false
---

# T06: Performance Order Builder with drag-and-drop reorder, section add/remove/repeat, reset-to-default, and 8 passing tests

**Performance Order Builder with drag-and-drop reorder, section add/remove/repeat, reset-to-default, and 8 passing tests**

## What Happened

Component and tests were already implemented from a prior session. Verified the existing implementation covers all plan requirements:

- **PerformanceOrderBuilder.vue**: Two-panel layout — left panel shows available sections as clickable indigo chips that append to the order (repeats allowed), right panel shows the ordered list with drag handles, section labels, and remove buttons. SortableJS integration follows the ServiceEditorView DOM-revert pattern (revert SortableJS DOM move in onEnd, then update reactive array so Vue re-renders as single source of truth). Reset-to-default button restores each section once in definition order. Dark-first styling with gray-800 cards, gray-500 drag handles, indigo accent chips.

- **PerformanceOrderBuilder.test.ts**: 8 tests covering renders available sections, clicking adds to order, clicking multiple times adds repeats, removing emits updated array, reset to default restores definition order, displays correct labels, empty state message, and reset button hidden when empty. SortableJS mocked since jsdom doesn't support real drag events.

## Verification

Ran vitest on PerformanceOrderBuilder.test.ts — all 8 tests passed with exit code 0.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/PerformanceOrderBuilder.test.ts --reporter=verbose` | 0 | pass | 7279ms |

## Deviations

None — component and tests were already fully implemented from a prior session; verified as-is.

## Known Issues

None

## Files Created/Modified

- `src/components/PerformanceOrderBuilder.vue`
- `src/components/__tests__/PerformanceOrderBuilder.test.ts`
