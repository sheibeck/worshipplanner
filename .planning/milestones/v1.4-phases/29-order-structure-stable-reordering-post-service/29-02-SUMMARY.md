---
phase: 29-order-structure-stable-reordering-post-service
plan: 02
subsystem: ui
tags: [vue, typescript, vitest, service-editor, ordering]

# Dependency graph
requires:
  - phase: 24-slot-identity-media-anchoring
    provides: "Stable ServiceSlot.id (D-01) that groupBySection/orderSlotsBySection key on"
provides:
  - "groupBySection<T>(items, getSection) — total, stable, SERVICE_SECTIONS-driven bucketing with a trailing legacy bucket"
  - "flattenBySection<T>(grouped) — SERVICE_SECTIONS-order concatenation, legacy last"
  - "orderSlotsBySection(slots) — identity-preserving section-major permutation of a ServiceSlot[]"
  - "Pinned, JSDoc-documented audit of defaultSectionForPosition confirming it is position-keyed, not section-count-keyed"
affects: [29-03-per-section-sortable-containers, 29-04-slidegrid-fix, 29-05-post-service-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure ordering helpers driven entirely by SERVICE_SECTIONS (no section-name string literals in implementation) so a future section addition needs zero edits here"
    - "Identity-preserving pure transform (return original reference when unchanged) — same pattern backfillSlotIds already established, now applied to reorder output to avoid false isDirty in autosave-watched views"

key-files:
  created: []
  modified:
    - src/utils/slotTypes.ts
    - src/utils/__tests__/slotTypes.test.ts

key-decisions:
  - "groupBySection routes any section value not in SERVICE_SECTIONS (not just undefined) to the legacy bucket, defensively guarding against production data outside the current union — not just the documented undefined case."
  - "orderSlotsBySection does NOT call reindexSlots — ordering and position-renumbering stay separate concerns; callers compose reindexSlots(orderSlotsBySection(slots))."
  - "defaultSectionForPosition audit: confirmed purely position-keyed (no SERVICE_SECTIONS.length arithmetic, no last-section derivation) — no source change required, only test pinning + JSDoc note."

patterns-established:
  - "Pattern: pure grouping/flattening pair generic over item shape, so both a render-time grouping ({slot, index} pairs) and a persistence-time grouping (bare slots) share one bucketing rule."

requirements-completed: [R043, R044]

coverage:
  - id: D1
    description: "groupBySection totals every input item into SERVICE_SECTIONS-ordered buckets plus a trailing legacy bucket for section-less or unrecognized-section items, preserving within-bucket order"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#groupBySection"
        status: pass
    human_judgment: false
  - id: D2
    description: "flattenBySection concatenates section buckets in SERVICE_SECTIONS order with legacy last"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#flattenBySection"
        status: pass
    human_judgment: false
  - id: D3
    description: "orderSlotsBySection is a total, stable, identity-preserving permutation of a ServiceSlot[] — returns the original array reference when already section-major, and never clones/mutates/re-mints a slot when reordering"
    requirement: "R044"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#orderSlotsBySection"
        status: pass
    human_judgment: false
  - id: D4
    description: "defaultSectionForPosition audited and pinned by test for both progressions ('1-2-2-3', '1-2-3-3'): no source change required since it is position-keyed, not section-count-keyed"
    requirement: "R043"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#buildSlots section defaults"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-28
status: complete
---

# Phase 29 Plan 02: Pure Ordering Helpers Summary

**groupBySection/flattenBySection/orderSlotsBySection in slotTypes.ts — total, SERVICE_SECTIONS-driven, identity-preserving ordering contract, plus an audit confirming defaultSectionForPosition needs no change for the fifth section.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-28T17:22:00-04:00 (approx.)
- **Completed:** 2026-07-28T17:28:05-04:00
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Added `groupBySection<T>`, `flattenBySection<T>`, and `orderSlotsBySection` to `src/utils/slotTypes.ts` — a single composed source of truth for slot order that the rendered grouping and the persisted array can never disagree on.
- Proved totality and identity-preservation with a real permutation test using `toBe` reference-identity assertions (not `toEqual`), per the plan's requirement.
- Added a defensive routing case beyond the plan's literal spec: a section value present but outside `SERVICE_SECTIONS` (not just `undefined`) also routes to the trailing `legacy` bucket rather than being silently dropped — this hardens against corrupted/out-of-union production data (T-29-03).
- Audited `defaultSectionForPosition` and `buildSlots` by reading (not assuming): confirmed the mapping is purely position-keyed with no `SERVICE_SECTIONS.length` arithmetic and no "last section" derivation. No source behavior change was made — the audit result is recorded in the function's JSDoc and pinned by a new `buildSlots section defaults` test block covering both progressions plus the `SERVICE_SECTIONS[0]`-derived "no default Pre-Service slot" invariant.

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED/GREEN):

1. **Task 1: groupBySection / flattenBySection / orderSlotsBySection in slotTypes.ts**
   - `a22e6f5` (test) — RED: failing tests for all three helpers, seven behaviors from the plan plus one defensive-routing case
   - `cc8879a` (feat) — GREEN: implemented the three helpers; all new tests pass, no refactor needed
2. **Task 2: Pin defaultSectionForPosition against the four-section era** - `0cb75d1` (test)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/utils/slotTypes.ts` - Added `groupBySection`, `flattenBySection`, `orderSlotsBySection` (inserted after `reindexSlots`); updated `defaultSectionForPosition`'s JSDoc with the Phase 29 audit finding; changed the `@/types/service` import to pull in the `SERVICE_SECTIONS` value alongside existing type-only imports.
- `src/utils/__tests__/slotTypes.test.ts` - Added `describe` blocks for `groupBySection` (4 tests), `flattenBySection` (2 tests), `orderSlotsBySection` (3 tests), and `buildSlots section defaults` (3 tests via `it.each` + 1 invariant test).

## Decisions Made
- Defensive out-of-union routing in `groupBySection` (see key-decisions above) — a Rule 2 addition (missing critical functionality: without this, a corrupted/legacy `section` string outside the current union would be silently dropped by a naive implementation, which is exactly the production-data-loss class this plan exists to prevent).
- Kept the new `buildSlots section defaults` describe block additive alongside the pre-existing `buildSlots — default section assignment (D005)` block rather than replacing it, since the plan asked for this specific new block name and the existing block already had passing coverage that shouldn't be disturbed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Defensive routing for section values outside SERVICE_SECTIONS**
- **Found during:** Task 1 (groupBySection implementation)
- **Issue:** The plan's behavior spec only explicitly covers `getSection` returning `undefined`. Production Firestore documents could theoretically carry a `section` string outside the current `ServiceSection` union (e.g., a stale value from a since-removed section, or malformed data) — a naive `sections[section].push(item)` would either drop the item or throw.
- **Fix:** Added `SERVICE_SECTIONS.includes(section)` to the guard alongside the `undefined` check, so any unrecognized value also routes to `legacy`. Added an explicit test case for this.
- **Files modified:** `src/utils/slotTypes.ts`, `src/utils/__tests__/slotTypes.test.ts`
- **Verification:** `groupBySection > routes a section value outside SERVICE_SECTIONS to legacy rather than dropping the slot (production-data safety)` passes.
- **Committed in:** `cc8879a` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Strengthens the plan's own stated production-data-safety goal (T-29-03: bucketing must be total). No scope creep — same function, same signature, one additional defensive branch.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `orderSlotsBySection`, `groupBySection`, and `flattenBySection` are ready for 29-03 (per-section Sortable containers) to consume directly — no view or component was touched by this plan, keeping it isolated from 29-01's parallel test-file work in the same wave.
- `defaultSectionForPosition` is confirmed safe against 29-05's fifth-section addition; no follow-up change needed there.
- No blockers.

---
*Phase: 29-order-structure-stable-reordering-post-service*
*Completed: 2026-07-28*

## Self-Check: PASSED
All created/modified files exist on disk; all task commit hashes (a22e6f5, cc8879a, 0cb75d1) verified in git log.
