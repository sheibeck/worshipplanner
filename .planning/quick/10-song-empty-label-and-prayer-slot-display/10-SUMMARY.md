# Quick Task 10: Song empty label and prayer slot display in ServiceCard

**Status:** Complete
**Date:** 2026-03-04
**Commit:** 888f5c5

## Changes

### `src/components/ServiceCard.vue`

1. **Song — Empty**: Changed unassigned song slot label from `"Empty"` to `"Song — Empty"` to match the scripture pattern (`"Scripture — Empty"`)
2. **--- Prayer ---**: Changed prayer slot display from `"Prayer"` to `"--- Prayer ---"` matching the existing `"--- Message ---"` divider pattern
3. **Prayer styling**: Added `text-gray-600 text-[10px]` class for prayer slots to match the Message divider styling

## Verification

- 243/243 tests passing
- No TypeScript errors
