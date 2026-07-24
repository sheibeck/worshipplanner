---
id: T06
parent: S01
milestone: M001
key_files:
  - src/components/PerformanceOrderBuilder.vue
  - src/components/__tests__/PerformanceOrderBuilder.test.ts
key_decisions:
  - Reused existing implementation that fully matched task plan — only cleanup of debug console.log lines in tests
duration: 
verification_result: passed
completed_at: 2026-07-24T04:41:24.569Z
blocker_discovered: false
---

# T06: Performance Order Builder with drag-and-drop reorder, section add/remove, and reset — 8 passing tests

**Performance Order Builder with drag-and-drop reorder, section add/remove, and reset — 8 passing tests**

## What Happened

Both the component and test file already existed from prior work. The component implements the full task plan: left panel with available section chips that add to the order on click (supporting repeats), right panel with ordered items featuring drag handles and remove buttons, SortableJS integration with the DOM-revert pattern from ServiceEditorView, and a Reset to Default button. Removed three debug console.log lines from the test file that were left from development. All 8 tests pass covering: rendering available sections, adding sections, adding repeats, removing sections, reset to default, label display, empty state message, and hidden reset button.

## Failure Modes

This is a pure client-side UI component with no external dependencies (no API calls, no filesystem, no network). SortableJS is the only library dependency and is mocked in tests. No failure mode analysis needed.

## Load Profile

The component renders a list of sections and order items. Even at 10x (e.g. 30-50 sections instead of 3-5), the DOM list and array operations remain trivially fast. No runtime load concern.

## Negative Tests

- **Empty sections list**: `shows empty state when no sections are in the order` verifies the empty-state message renders when performanceOrder is empty.
- **Hidden reset button**: `hides reset button when order is empty` verifies the reset button is conditionally hidden when there's nothing to reset.
- **Unknown section ID fallback**: `labelFor()` returns the raw sectionId string when no matching section is found, preventing crashes from stale/invalid IDs in the performance order.

## Verification

Ran the task verification command: `npx vitest run src/components/__tests__/PerformanceOrderBuilder.test.ts --reporter=verbose`. All 8 tests passed in 3.92s.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/PerformanceOrderBuilder.test.ts --reporter=verbose` | 0 | pass | 7576ms |

## Deviations

Removed 3 debug console.log lines from PerformanceOrderBuilder.test.ts that were leftover from development.

## Known Issues

None

## Files Created/Modified

- `src/components/PerformanceOrderBuilder.vue`
- `src/components/__tests__/PerformanceOrderBuilder.test.ts`
