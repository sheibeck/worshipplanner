---
phase: 29-order-structure-stable-reordering-post-service
plan: 01
subsystem: testing
tags: [vitest, sortablejs, vue-test-utils, reorder, drag-and-drop]

# Dependency graph
requires: []
provides:
  - "Committed, running reproduction of the reported ZTXcpNRcJTalEQp42fTx symptom (service-item drag, R044)"
  - "Committed, running reproduction of the SlideGrid append-order defect (R050)"
  - "Multi-instance Sortable capture harness in both ServiceEditorView.test.ts and SlideGrid.test.ts, reusable unchanged by the per-section container shape 29-03 introduces"
  - "DOM-derived drag-simulation helpers (simulateSlotDrag, simulateCardDrag) that never accept hand-passed indices"
  - "Finding: SlideGrid's own 'wrong index source' defect is structurally unreachable via an interior card drag (documented below), narrowing 29-04's actual fix surface"
affects: [29-03, 29-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-instance Sortable.create capture (array of { el, options }) with data-section-scoped and flat-container accessors, replacing single-capture mocks"
    - "DOM-derived drag simulation: index pairs (oldIndex/newIndex, oldDraggableIndex/newDraggableIndex) computed from the live rendered container, never hand-passed"

key-files:
  created: []
  modified:
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "makeSectionedService() and the Sortable capture mock/accessors live at module scope (not nested in the new describe block) so Task 1 and Task 2 could land as separate, independently-verifiable commits."
  - "SlideGrid's R049 'drag lands where dropped' test was converted from it.fails to a plain it after it passed unexpectedly — see Deviations."

requirements-completed: [R044, R049, R050]

coverage:
  - id: D1
    description: "Failing repro of the ZTXcpNRcJTalEQp42fTx symptom: a cross-section service-item drag lands in the wrong place due to header-counted DOM indices being used as raw array-splice indices"
    requirement: "R044"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > lands a service item exactly where it was dropped (R044 — repro, unfix pending)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Phase 29 reorder repro > moves an item within its own section to a non-adjacent position (R044 — repro, unfix pending)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Failing repro of the SlideGrid append-order defect: a new slide does not land at the true end with contiguous orders when array order and order-field values have diverged"
    requirement: "R050"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > appends a new slide at the true end of the group with contiguous orders (R050 — repro, unfix pending)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failing repro that a rejected reorder write surfaces a visible error and does not leave the grid showing an unsaved order (testid does not exist yet — 29-04's territory)"
    requirement: "R049"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > reorder failure surfaces and does not leave the grid showing an unsaved order (R049 — pending)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SlideGrid interior-drag regression guard (converted from a planned repro after it passed against unfixed code — see Deviations)"
    requirement: "R049"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid - Phase 29 reorder repro > drags a slide to the position it was dropped in (R049)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-28
status: complete
---

# Phase 29 Plan 01: Reorder Repro Harness Summary

**Committed failing reproductions of the ZTXcpNRcJTalEQp42fTx drag-reorder bug (R044) and the SlideGrid append-order defect (R050), built on a DOM-derived (never hand-passed) drag-index harness that reproduces exactly what the pre-existing header-free/tile-free fixtures could not catch.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added a multi-instance SortableJS capture mock to `ServiceEditorView.test.ts` (no mock existed there before — the real library ran against jsdom on every mount) and widened `SlideGrid.test.ts`'s single-capture mock to the same many-instance shape, both forward-compatible with the per-section container split 29-03 introduces.
- Built `makeSectionedService()`, the 8-slot four-section fixture matching the reported service's shape, with section-header nodes rendered as real DOM siblings — the fixture gap that let the bug survive prior fix attempts.
- Wrote `simulateSlotDrag()` / `simulateCardDrag()`, DOM-derived drag helpers that compute BOTH `oldIndex`/`newIndex` (all element children, headers/tile counted) and `oldDraggableIndex`/`newDraggableIndex` (`.slot-item`/`.slide-card` children only) from the live rendered DOM — never accept a hand-passed index.
- Landed two `it.fails` repros for R044 (cross-section move, within-section multi-position move) that genuinely fail today — spot-checked by temporarily removing `.fails` on the first and confirming an `AssertionError` (not an incidental exception): the unfixed handler misplaces `s6` because it uses a DOM-global (header-counted) index as a raw splice index into the header-free `slots` array.
- Landed one `it.fails` repro for R050 (SlideGrid append-order defect) — spot-checked the same way, confirmed genuine `AssertionError`: `onAddSlide`'s `Math.max(...)`-derived `nextOrder` does not defend against a group whose array order has already diverged from its `order` field values.
- Landed one `it.fails` repro for the R049 reorder-failure-surfaces-an-error requirement — the `slide-grid-reorder-error` testid does not exist yet (29-04's territory), so this is guaranteed red until that plan lands.
- Discovered and documented that SlideGrid's own "wrong index source" defect (as originally planned as a third `it.fails`) is **not reproducible** via an interior card drag, because SlideGrid's drop tile is always the container's last child — unlike `ServiceEditorView.vue`'s section headers, it never sits *between* draggable items, so `oldIndex`/`newIndex` and their Draggable-suffixed counterparts are numerically identical for any drag that doesn't specifically target crossing the tile boundary. Converted that test to a plain `it` per the plan's explicit escape-hatch instruction rather than force a false red.

## Task Commits

Each task was committed atomically:

1. **Task 1: Multi-instance Sortable capture harness + header-inclusive fixture in ServiceEditorView.test.ts** - `a8ffae1` (test)
2. **Task 2: DOM-derived drag helper and the ZTXcpNRcJTalEQp42fTx repro (R044)** - `b7fda9e` (test)
3. **Task 3: SlideGrid repro — sibling-inclusive drag fixture and the append-order defect (R049, R050)** - `60e7f71` (test)

_Note: Task 1's commit intentionally landed `makeSectionedService()` and the Sortable capture mock/accessors at module scope (not nested inside the new describe block, as the plan's prose implies) specifically so it forms a complete, independently-verifiable state before Task 2's describe block and tests were added — matching each task's own `<done>` criterion ("the full file passes") without carrying unused/incomplete test bodies across the commit boundary._

## Files Created/Modified
- `src/views/__tests__/ServiceEditorView.test.ts` - Added the Sortable capture mock, `makeSectionedService()` fixture, `simulateSlotDrag()` DOM-derived drag helper, and the `ServiceEditorView - Phase 29 reorder repro` describe block (two `it.fails` tests, R044).
- `src/components/slides/__tests__/SlideGrid.test.ts` - Widened the Sortable capture mock to many-instance, replaced `simulateDragEnd` with `simulateCardDrag` (updating its two existing Task-3 call sites), and added the `SlideGrid - Phase 29 reorder repro` describe block (two `it.fails` tests for R050/R049, one converted `it` for R049).

## Decisions Made
- Placed `makeSectionedService()` and the Sortable capture accessors (`resetSortableCaptures`, `captureForSection`, `flatCapture`) at module scope in `ServiceEditorView.test.ts` rather than nested in the new describe block, so Task 1 and Task 2 could be verified and committed independently (Task 1's own `<done>` criterion requires "the full file passes" as a standalone checkpoint).
- Converted the SlideGrid "drag lands where dropped" test from `it.fails` to a plain `it` after confirming (via running it and reading Vitest's "expected test to fail" error) that it passes against today's unfixed code — per the plan's explicit Task 3 instruction to convert rather than force or delete. See Deviations for the full rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — plan's own explicit escape hatch] Converted an unexpectedly-passing repro to a regression guard**
- **Found during:** Task 3 (SlideGrid repro)
- **Issue:** The plan specified `it.fails('drags a slide to the position it was dropped in (R049 — repro, unfix pending)')`, modeled on the same "wrong index source" defect confirmed in `ServiceEditorView.vue`. Running it showed Vitest's `Error: Expect test to fail` — the assertion passed against the current, unfixed `SlideGrid.vue` code.
- **Root cause:** `ServiceEditorView.vue`'s bug requires section-header `<div>` siblings interspersed *between* groups of `.slot-item` nodes in the same flat container — that's what makes `oldIndex`/`newIndex` (all-children-counted) diverge from `oldDraggableIndex`/`newDraggableIndex` (`.slot-item`-only-counted). `SlideGrid.vue`'s drop tile (`SlideDropTarget`) is a non-`.slide-card` sibling too, but it is *always the container's last child* (`v-if`/`v-else` template structure guarantees this) — it never sits between two cards. For any drag among the visible cards (not specifically targeting a drop past the tile's own position, which the UI never offers as an interior target), the two index-counting schemes are numerically identical. The "index source" defect, as modeled by an interior drag, is therefore structurally unreachable for `SlideGrid.vue`.
- **Fix:** Converted the test from `it.fails(...)` to `it(...)`, renamed without the "repro, unfix pending" suffix, and added an in-code comment explaining the finding and pointing here. Kept the test (not deleted) as a real regression guard, per the plan's explicit "do not delete a test to make the suite green" instruction.
- **Files modified:** `src/components/slides/__tests__/SlideGrid.test.ts`
- **Verification:** `npm run test:unit -- --run src/components/slides/__tests__/SlideGrid.test.ts` — 67/67 pass, including this test as a normal (non-`.fails`) assertion.
- **Committed in:** `60e7f71` (Task 3 commit)
- **Impact on 29-04:** This narrows (does not eliminate) 29-04's SlideGrid fix surface — the R049 `oldDraggableIndex`/`newDraggableIndex` fix should still be applied there for symmetry with `ServiceEditorView.vue` and to correctly handle the one genuine divergence case (dragging a card past the drop tile's own DOM position), which this plan's fixture does not exercise. The genuine, still-red R050 (append-order) and R049 (error-surfacing) defects for `SlideGrid.vue` remain fully reproduced by the other two tests in the same describe block.

---

**Total deviations:** 1 auto-fixed (plan-anticipated conversion, not a bug in this plan's work)
**Impact on plan:** No scope creep — the conversion is explicitly sanctioned by the plan's own Task 3 instructions and does not change what 29-03/29-04 need to fix.

## Issues Encountered
None beyond the documented deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 29-03 (per-section Sortable containers + stable `slot.id` keys) and 29-04 (index-source/D-16-revert fix + save-failure error surfacing) can now be verified by flipping this plan's `it.fails` declarations to plain `it` — removing `.fails` from either `ServiceEditorView.test.ts` repro or the SlideGrid R050/R049 repros should turn them green once the corresponding fix lands; if they stay red, the fix is incomplete.
- `captureForSection(section)` in `ServiceEditorView.test.ts` will start resolving once 29-03 renders `data-section`-tagged per-section containers; `flatCapture()` will stop resolving at that point — both accessors already exist so 29-03/29-04 do not need to touch this harness.
- The one CONTEXT.md-mandated manual human-verify item (a real cross-section OS drag, since jsdom cannot synthesize genuine drag events) is deferred to whichever plan lands the actual fix (29-04), not this repro-only plan.

---
*Phase: 29-order-structure-stable-reordering-post-service*
*Completed: 2026-07-28*

## Self-Check: PASSED
