---
id: T07
parent: S01
milestone: M001
key_files:
  - src/components/__tests__/LyricVersionHistory.test.ts
key_decisions:
  - Used vi.setSystemTime with a fixed epoch constant rather than injecting a clock parameter into the component — minimally invasive fix that addresses the flakiness without changing production code
duration: 
verification_result: passed
completed_at: 2026-07-24T05:05:33.867Z
blocker_discovered: false
---

# T07: Fixed flaky relative-time test by freezing system clock with vi.setSystemTime instead of relying on Date.now()

**Fixed flaky relative-time test by freezing system clock with vi.setSystemTime instead of relying on Date.now()**

## What Happened

Task T07 was reopened because the "formats relative time for days" test was flaky — it used `Date.now() - 3*24*3600000` to create a timestamp exactly 72 hours in the past, but the component's `formatRelativeTime` function also calls `Date.now()` independently. The tiny delta between the two `Date.now()` calls could cause `Math.floor(hours / 24)` to round to either 2 or 3 depending on wall-clock timing.

Fix: Added a `FIXED_NOW` constant (`new Date('2026-06-15T12:00:00Z').getTime()`) at module scope. Each test now uses `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_NOW)` in `beforeEach` so the component's `Date.now()` call returns the same frozen value. All `Date.now()` references in `makeVersion` defaults and individual test overrides were replaced with `FIXED_NOW`. Added `afterEach` with `vi.useRealTimers()` for cleanup.

All 16 tests pass (8 LyricVersionHistory + 8 SongSlideOver).

## Verification

Ran both test files with verbose reporter. All 16 tests pass including the previously flaky "formats relative time for days" test which now deterministically produces "3d ago".

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx vitest run src/components/__tests__/LyricVersionHistory.test.ts src/components/__tests__/SongSlideOver.test.ts --reporter=verbose` | 0 | pass | 21403ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/components/__tests__/LyricVersionHistory.test.ts`
