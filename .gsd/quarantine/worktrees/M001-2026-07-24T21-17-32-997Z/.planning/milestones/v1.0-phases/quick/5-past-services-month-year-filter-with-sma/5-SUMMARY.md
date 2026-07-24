---
phase: quick
plan: 5
subsystem: services-view
tags: [ux, filtering, month-picker]
key-files:
  modified:
    - src/views/ServicesView.vue
decisions:
  - "selectedMonth/selectedYear use null as 'unset' sentinel; activeMonth/activeYear computeds apply smart default fallback — avoids eager initialization that would prevent the smart default from updating if pastServices loads after mount"
  - "Date parsing uses s.date + 'T00:00:00' to force local-time interpretation and avoid UTC midnight off-by-one day issues"
  - "onYearChange resets selectedMonth to null so activeMonth computed auto-selects the best available month in the new year rather than silently showing an empty list"
metrics:
  duration: 5
  completed: 2026-03-04
---

# Quick Task 5: Past Services Month/Year Filter — Summary

**One-liner:** Month/year picker replaces arbitrary 5-item past services slice; smart default selects current month or falls back to most recent month with services.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Replace past services limit with month/year picker and smart default | df2d0b4 | src/views/ServicesView.vue |

## What Was Built

The past services section of `ServicesView.vue` previously capped display at 5 items via `pastServices.value.slice(0, 5)`. This was replaced with a full month/year filtering system:

**New computeds:**
- `availableMonths` — unique `{ month, year, monthName }` entries from `pastServices`, sorted descending (inherits order from `pastServices`)
- `availableYears` — unique years extracted from `availableMonths`, sorted descending
- `smartDefault` — returns current month/year if it has past services; otherwise the first (most recent) entry in `availableMonths`
- `activeYear` — `selectedYear ?? smartDefault.year`
- `monthsForActiveYear` — filters `availableMonths` to entries matching `activeYear`
- `activeMonth` — `selectedMonth` if valid for `activeYear`; else smart default if same year; else first month in year
- `displayedPastServices` — filters `pastServices` to `activeMonth`/`activeYear` with no slice cap

**Template changes:**
- Section header changed from `Past Services ({{ pastServices.length }})` to `Past Services`
- Inside `v-if="showPast"`: added flex row with two `<select>` elements (month, year) styled with dark theme classes
- Month select options come from `monthsForActiveYear` (only months with data in the selected year)
- Year select options come from `availableYears`
- `onYearChange` resets `selectedMonth` to null; `onMonthChange` sets `selectedMonth` directly

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vue-tsc --noEmit` — passed, no errors
- `npx vitest run` — 231 tests passed, 16 test files, no regressions
- Type-check clean

## Self-Check: PASSED

- `src/views/ServicesView.vue` — exists and modified
- Commit `df2d0b4` — verified present
