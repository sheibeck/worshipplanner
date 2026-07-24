---
phase: 03-service-planning
plan: 01
subsystem: api
tags: [typescript, vitest, service-planning, vw-types, scripture, suggestion-algorithm]

# Dependency graph
requires:
  - phase: 02-song-library
    provides: Song interface with vwType, teamTags, lastUsedAt fields used by suggestion algorithm

provides:
  - Service, ServiceSlot, SongSlot, ScriptureSlot, NonAssignableSlot, ScriptureRef, Progression, ServiceStatus, SlotKind, ServiceInput TypeScript types
  - PROGRESSION_SLOT_TYPES lookup table mapping progression + position to VWType
  - buildSlots() factory building the 9-slot service template
  - SLOT_LABELS position-to-label constant
  - BIBLE_BOOKS 66-book canonical list
  - esvLink() ESV URL generator
  - scripturesOverlap() verse-range overlap detector
  - rankSongsForSlot() pure scoring/filtering/ranking function
  - computeRotationTable() service-array-to-rotation-entry aggregator

affects:
  - 03-02-service-store (imports Service types, uses buildSlots)
  - 03-03-service-editor (uses rankSongsForSlot, buildSlots, esvLink, scripturesOverlap)
  - 03-04-services-list (uses computeRotationTable, Service type)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure TypeScript utility functions with no Firebase or Vue dependencies, enabling isolated Vitest unit testing
    - TDD (RED then GREEN) for all utility modules
    - Discriminated union type pattern for ServiceSlot (kind field as discriminant)
    - nowMs injectable parameter for deterministic time-dependent testing

key-files:
  created:
    - src/types/service.ts
    - src/utils/slotTypes.ts
    - src/utils/scripture.ts
    - src/utils/suggestions.ts
    - src/utils/rotationTable.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/utils/__tests__/scripture.test.ts
    - src/utils/__tests__/suggestions.test.ts
    - src/utils/__tests__/rotationTable.test.ts
  modified: []

key-decisions:
  - "Sending Song (position 8) defaults to VW Type 3 (Ascription) for both progressions — safest liturgical assumption, confirms RESEARCH.md recommendation"
  - "Team filtering uses AND logic — song must support ALL active service teams or have empty teamTags (universal)"
  - "rankSongsForSlot accepts nowMs parameter defaulting to Date.now() for deterministic testing without mocking"
  - "computeRotationTable deduplicates by service (same song in 2 slots = 1 date entry) using Set<string>"
  - "BIBLE_BOOKS uses readonly string[] to prevent accidental mutation"

patterns-established:
  - "Pure utility pattern: all Phase 3 logic functions live in src/utils/ with zero Firebase/Vue imports"
  - "TDD pattern: write failing tests first, confirm RED, then implement GREEN — applied to all 4 utility modules"
  - "Injectable nowMs pattern: time-dependent functions accept nowMs parameter for testability"

requirements-completed:
  - PLAN-02
  - PLAN-03
  - PLAN-05
  - PLAN-06
  - PLAN-09
  - SCRI-03
  - CAL-02
  - CAL-03

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 3 Plan 01: Service Types and Pure Utility Functions Summary

**TypeScript discriminated-union service types plus 4 pure utility modules (slot builder, scripture tools, VW suggestion ranker, rotation table aggregator) with 65 passing unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T10:48:35Z
- **Completed:** 2026-03-04T10:53:35Z
- **Tasks:** 2
- **Files modified:** 9 (5 source, 4 test)

## Accomplishments

- Created complete TypeScript type system for service planning (Service, ServiceSlot discriminated union, ScriptureRef, Progression enum, ServiceInput)
- Built PROGRESSION_SLOT_TYPES lookup, buildSlots() 9-slot factory, and SLOT_LABELS — the backbone of service order creation
- Implemented BIBLE_BOOKS (66 books), esvLink() URL generator, and scripturesOverlap() verse-range overlap detector
- Built rankSongsForSlot() pure suggestion algorithm with VW type filtering, AND-logic team filtering, and recency-based scoring (never used=500, stale=200+, recent<100)
- Built computeRotationTable() that aggregates song appearances across services, deduplicates per service, sorts alphabetically
- All 65 unit tests pass; TypeScript compiles without errors

## Task Commits

1. **Task 1: Service types, slot types utility, and scripture utilities** - `e9b369e` (feat)
2. **Task 2: Song suggestion algorithm and rotation table utility** - `b22c1a5` (feat)

## Files Created/Modified

- `src/types/service.ts` - Service, ServiceSlot (discriminated union), SongSlot, ScriptureSlot, NonAssignableSlot, ScriptureRef, Progression, ServiceStatus, SlotKind, ServiceInput types
- `src/utils/slotTypes.ts` - PROGRESSION_SLOT_TYPES lookup, buildSlots() factory, SLOT_LABELS constant
- `src/utils/scripture.ts` - BIBLE_BOOKS (66 books), esvLink() URL generator, scripturesOverlap() detector
- `src/utils/suggestions.ts` - rankSongsForSlot() pure scoring function with VW type + team filtering
- `src/utils/rotationTable.ts` - computeRotationTable() pure aggregation function
- `src/utils/__tests__/slotTypes.test.ts` - 21 tests for slot type mapping and buildSlots()
- `src/utils/__tests__/scripture.test.ts` - 17 tests for BIBLE_BOOKS, esvLink(), scripturesOverlap()
- `src/utils/__tests__/suggestions.test.ts` - 18 tests for rankSongsForSlot()
- `src/utils/__tests__/rotationTable.test.ts` - 9 tests for computeRotationTable()

## Decisions Made

- Sending Song (position 8) defaults to VW Type 3 (Ascription) for both progressions — confirms RESEARCH.md recommendation
- Team filtering uses AND logic — song must support ALL active teams, or have empty teamTags (universal compatibility)
- rankSongsForSlot accepts optional nowMs parameter defaulting to Date.now() for deterministic testing without mocking Date
- computeRotationTable deduplicates songs per service using Set<string> so a song used in 2 slots counts once per service date
- BIBLE_BOOKS is readonly string[] to prevent accidental mutation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All types and pure utilities are ready for downstream consumption
- 03-02 (service Pinia store) can import Service, ServiceInput, ServiceSlot, buildSlots from these modules
- 03-03 (service editor) can import rankSongsForSlot, esvLink, scripturesOverlap, SLOT_LABELS
- 03-04 (services list) can import computeRotationTable

---
*Phase: 03-service-planning*
*Completed: 2026-03-04*
