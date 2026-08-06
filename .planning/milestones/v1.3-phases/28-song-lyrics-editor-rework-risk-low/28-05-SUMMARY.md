---
phase: 28-song-lyrics-editor-rework-risk-low
plan: 05
subsystem: songs
tags: [vue, sortablejs, vitest]

# Dependency graph
requires:
  - phase: 28-song-lyrics-editor-rework-risk-low
    provides: "28-04's rebuilt single-list SongLyricEditor.vue (rowKey-keyed rows, reserved control-group space, inert .drag-handle) and 28-01's pure moveRow/duplicateRow/removeRow/addSection helpers, both consumed here without re-implementing ordering logic"
provides:
  - "SongLyricEditor.vue with always-on SortableJS drag reorder by handle (D-01, option 2a — no mode to enter first)"
  - "Per-row Duplicate/Remove controls wired to 28-01's duplicateRow/removeRow, on both ordinary and repeat cards"
  - "The dashed Add-section row (five ADD_SECTION_KINDS chips) appending new empty sections"
affects: [28-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SortableJS handle-scoped drag reproduced verbatim from ServiceEditorView.vue's slot list / SlideGrid.vue's slide grid: handle: '.drag-handle', draggable: '<row class>', animation: 150, ghostClass: 'opacity-30', DOM-revert-before-Vue-reactive-update inside onEnd"
    - "Row/section mutation via lookup-then-splice into the pure order-mutation helpers (moveRow/duplicateRow/removeRow/addSection) rather than any component-local reordering logic"
    - "Non-row surfaces (the dashed add-section row) kept OUTSIDE the row-list container and its `.section-row` draggable-scope class, mirroring the section-header-exclusion precedent in ServiceEditorView.vue's slot list"

key-files:
  created: []
  modified:
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts

key-decisions:
  - "Which occurrence of a repeated section is 'the followed row' vs. 'the repeat' is never tracked as separate state — it is re-derived fresh by buildSectionRows on every render (earliest occurrence in performanceOrder wins). A drag, a duplicate, or a remove that changes which occurrence comes first therefore needs no extra bookkeeping anywhere in this plan's new code."
  - "A row's position in performanceOrder is looked up at click time by counting occurrences of its sectionId up to its occurrenceIndex (orderIndexForRow), rather than storing a stable order-index on the row. This tolerates the array shifting between renders (e.g. after a duplicate or an unrelated remove) without stale-index bugs."
  - "The rowKey minted for a freshly duplicated or freshly added row is looked up by re-running buildSectionRows over the just-mutated (sections, order) pair and finding the matching row, rather than hand-assembling the `#`-joined rowKey format in the component. That format is songSectionOrder.ts's internal convention and this plan's file list does not include that module."
  - "A duplicate only auto-expands its new row when the row it was duplicated from was already expanded — a repeat's expanded view has no edit field (it's read-only shared text), so there is no need to force it open when the source was collapsed."
  - "The dashed Add-section row is a sibling of the `section-rows` container, not a child inside it, and carries no `.section-row` class. Putting it inside would have both broken every existing `[data-testid=\"section-rows\"] > div` row-count assertion and made it a fifth Sortable-draggable element it should never be."

requirements-completed: [R035, R018]

coverage:
  - id: D1
    description: "The one list is always draggable — a row can be dragged by its handle to a new position at any time, with no mode to enter first (D-01), and drag means the same thing here as on the Slides tab / service slot list (same library, same handle convention, same animation/ghost config)."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#creates the drag instance over the row list, handle-scoped, matching the slot list animation/ghost config"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#invoking the captured end handler reorders the rendered rows and the editable order to the moved sequence"
        status: pass
    human_judgment: false
  - id: D2
    description: "The end handler is a no-op on absent or equal old/new indices; a move of one occurrence of a twice-referenced section leaves the sibling occurrence in place; row numbering re-derives 1..N with no gaps after a move; a repeat dragged above the row it followed becomes the followed row and vice versa; the drag instance is destroyed on unmount."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#is a no-op when old and new index are equal"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#is a no-op when either index is absent"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#moving one occurrence of a twice-referenced section moves only that occurrence, leaving the sibling in place"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#row numbering re-derives after a move, reading 1..N with no gaps"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#a repeat dragged above the row it followed becomes the followed row, and the other becomes the repeat"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#destroys the drag instance on unmount"
        status: pass
    human_judgment: false
  - id: D3
    description: "After a move settles, the lyrics document is updated once with sections and performanceOrder together (existing single-save autosave path, unmodified)."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#after a move settles, the lyrics document is updated once with sections and order together"
        status: pass
    human_judgment: false
  - id: D4
    description: "An expanded row shows Duplicate then Remove, before the collapse control, on both ordinary and repeat cards."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#an expanded row shows Duplicate then Remove before the collapse control"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Duplicate is also available on a repeat card (duplicating a repeat adds another reference)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Duplicating a row inserts a linked repeat directly beneath sharing the original's words (D-02); editing the followed row's words after duplicating updates both rows, proving the duplicate is a reference, not a copy."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#activating Duplicate inserts a new linked-repeat row directly beneath, sharing the original words"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#editing the followed row after duplicating updates both rows (D-02, not a copy)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Removing a row referenced elsewhere removes only that occurrence, leaving the section's words visible on its other row; removing a section's only occurrence removes the row AND the section's words from the persisted document; removing a followed row of a repeated pair leaves the survivor as an ordinary row, not a repeat pointing at nothing."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Remove on a row referenced elsewhere removes only that occurrence; the section keeps its words on the other row"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Remove on a section's only occurrence removes both the row and the section's words from the document"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#removing the followed row of a repeated pair leaves the survivor as an ordinary row, not a repeat pointing at nothing"
        status: pass
    human_judgment: false
  - id: D7
    description: "The add row renders the five quick-add chips (Verse, Chorus, Bridge, Tag, Ending) in mockup order; activating a chip appends a new empty row under that kind's label and expands it; activating the same chip twice yields two distinct sections with distinct labels and ids."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#the add row renders the five quick-add chips in mockup order"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#activating a chip appends a new empty row under that kind, and expands it"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#activating the same chip twice yields two distinct sections with distinct labels and ids"
        status: pass
    human_judgment: false
  - id: D8
    description: "The closing note's section count tracks Duplicate/Remove/Add actions; every one of Duplicate, Remove, and Add-section persists through the editor's single save carrying sections and order together."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#the closing note's count tracks duplicate, remove, and add actions"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Duplicate saves once with both fields"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Remove saves once with both fields"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Add section saves once with both fields"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-07-27
status: complete
---

# Phase 28 Plan 05: Always-on drag reorder, Duplicate/Remove, and Add-section Summary

**Made the one section list act like the order it is — SortableJS attached to the row container by handle (reproducing the exact configuration already used by the service slot list and slide grid), plus per-row Duplicate/Remove controls and a five-chip Add-section row, all mutating through 28-01's pure `moveRow`/`duplicateRow`/`removeRow`/`addSection` helpers with zero ordering logic re-implemented in the component.**

## Performance

- **Duration:** ~40 min (two TDD cycles)
- **Completed:** 2026-07-27
- **Tasks:** 2
- **Files modified:** 1 component, 1 test file (no files created or deleted)

## Accomplishments

- **Task 1 — always-on drag reorder by handle (D-01):** Attached `Sortable.create` to the row-list container (`ref="rowsContainerRef"`), configured with `handle: '.drag-handle'` (matching the handle span already rendered on every row since 28-04), `draggable: '.section-row'` (a new static class added to each row div, alongside its existing dynamic card-style class), `animation: 150`, `ghostClass: 'opacity-30'` — verbatim the same values `ServiceEditorView.vue`'s slot list and `SlideGrid.vue`'s slide grid already use. The `onEnd` handler reverts SortableJS's own DOM move (the established codebase remedy for the drag-snap-back defect, T-28-19) before replacing `editableState.performanceOrder` with `moveRow(order, oldIndex, newIndex)` from 28-01 — early-returning on absent or equal indices (T-28-16). The instance is created once the container exists (`watch(rowsContainerRef, ..., { flush: 'post' })`) and destroyed in `onUnmounted`. No new state tracks which occurrence of a repeated section is "the followed row" — `buildSectionRows` already re-derives that (earliest occurrence in the order wins) on every render, so a drag that reorders occurrences is handled for free.
- **Task 2 — Duplicate, Remove, and the Add-section row (D-02):** Rendered `Duplicate` then `Remove` buttons in the expanded card's control group, ahead of the existing collapse chevron, on both the ordinary-row template and the repeat-row template (a repeat can be removed, and duplicating a repeat just adds another reference to the same pooled section). `onDuplicate`/`onRemove`/`onAddSection` locate the clicked row's index in `performanceOrder` (`orderIndexForRow`, counting occurrences of the row's `sectionId` up to its `occurrenceIndex` — tolerant of the array having shifted since the last render) and call straight through to 28-01's `duplicateRow`/`removeRow`/`addSection`, assigning the returned value(s) back onto `editableState`. A duplicate auto-expands its new row only when the source row was already expanded (found via `buildSectionRows` rather than hand-building the `#`-joined `rowKey` format, which is `songSectionOrder.ts`'s internal convention). The dashed `＋ Add section` row renders one chip per `ADD_SECTION_KINDS`, in mockup order (Verse, Chorus, Bridge, Tag, Ending); it is a sibling of the `section-rows` container — not a child inside it, and carries no `.section-row` class — so it neither inflates the row-count contract nor becomes a fifth Sortable-draggable element.
- Every action (drag, duplicate, remove, add) writes into the same reactive `editableState` that 28-04's `useAutoSave` already watches, so the existing single-call `updateCurrentLyrics(sections, performanceOrder)` autosave path fires unchanged — no new save call sites were added.

## Task Commits

Both tasks followed RED → GREEN (TDD):

1. **Task 1: Always-on drag reorder by handle**
   - `6d11bac` (test) — 9 failing tests for the drag-reorder path (jsdom cannot drag, so the end handler is invoked directly via captured Sortable options)
   - `6d94789` (feat) — implementation: 29/29 tests pass, type-check 0
2. **Task 2: Duplicate, Remove, and the Add-section row**
   - `40b2079` (test) — 14 failing tests for Duplicate/Remove/Add-section
   - `1a16d8b` (feat) — implementation: 69/69 tests pass, type-check 0

## Files Created/Modified

- `src/components/SongLyricEditor.vue` — Added the SortableJS drag-reorder instance (handle-scoped, DOM-revert `onEnd`, lifecycle-managed); a static `.section-row` class on each row div for the drag library's `draggable` scope; `Duplicate`/`Remove` buttons in both row templates' control groups, gated on `isExpanded(row)`; the dashed Add-section row with five `ADD_SECTION_KINDS` chips; and the `orderIndexForRow`/`onDuplicate`/`onRemove`/`onAddSection`/`expandRowKey` handler functions, all delegating their actual mutation to 28-01's pure helpers.
- `src/components/__tests__/SongLyricEditor.test.ts` — Added: a `sortablejs` mock capturing the options handed to `Sortable.create` so the `onEnd` handler can be invoked directly with synthetic old/new indices (the established `SlideGrid.test.ts` convention, since jsdom cannot produce a real drag); Task 1's 9 drag-reorder tests; Task 2's 14 Duplicate/Remove/Add-section tests.

## Decisions Made

- **No extra state for "which occurrence is the repeat."** `buildSectionRows` already derives that fresh from `performanceOrder` on every render (earliest occurrence wins) — a drag, duplicate, or remove that changes which occurrence comes first needed zero new bookkeeping in this plan.
- **Row-to-order-index lookup by counting, not a stored index.** `orderIndexForRow` counts occurrences of a row's `sectionId` up to its `occurrenceIndex` at click time, so it stays correct even if the order array shifted since the row was last rendered (e.g. a duplicate landing between two remove clicks).
- **New/duplicated row keys resolved via a fresh `buildSectionRows` call, not string-built.** The `sectionId#occurrenceIndex` `rowKey` format is `songSectionOrder.ts`'s internal separator convention (not exported, and that file is outside this plan's file list) — so the component re-derives the row list after a mutation and looks up the matching row by `(sectionId, occurrenceIndex)` rather than reconstructing the key string.
- **Duplicate only force-expands when the source was expanded.** A repeat's expanded view is read-only shared text with no edit field, so auto-expanding an unrequested duplicate would add nothing — the rule from the plan's action text ("leave the reading experience consistent rather than forcing it open") was implemented literally, and two of the initially-drafted tests had to be corrected (see Issues Encountered) once this behavior was actually observed.
- **Add-section row kept outside `section-rows`, uncoupled from Sortable's `.section-row` scope.** Placing it inside would have both broken the `[data-testid="section-rows"] > div` row-count assertions used throughout Task 1's and 28-04's tests, and made the dashed row itself draggable — mirroring the precedent `ServiceEditorView.vue`'s slot list already sets by excluding its non-draggable section-header divs from the `draggable: '.slot-item'` selector.

## Deviations from Plan

None beyond the two self-corrections documented below (test-authoring mistakes caught during the RED→GREEN cycle itself, not scope changes) — the plan's action text and interfaces were followed as written; no Rule 1-4 auto-fixes or escalations were needed against the *implementation*.

## Issues Encountered

- **Two Task 2 tests initially asserted the wrong post-duplicate expansion state.** The tests for "duplicate shares the original's words" and "editing the followed row updates both rows" were first written expecting the new repeat row to render collapsed (requiring an explicit toggle click to reveal its shared text) — but the row being duplicated from was expanded at the time, so per the plan's literal instruction the new row auto-expands too, and the extra toggle click in the test was actually *collapsing* it back, producing a "Cannot call text on an empty DOMWrapper" failure. Corrected during the same RED→GREEN cycle (not a separate fix-attempt loop) once the auto-expand behavior was implemented and observed; the tests now assert the shared text directly, without the redundant toggle.
- **One Task 2 test toggled an already-expanded row closed.** "the closing note's count tracks duplicate, remove, and add actions" clicked the freshly-added Bridge row's collapse toggle before clicking Remove — but `onAddSection` already auto-expands its newly minted row, so the extra toggle collapsed it and hid the Remove button, producing the same class of DOMWrapper failure. Corrected the same way — removed the redundant toggle click.
- No fix-attempt-limit escalations; no deferred items.

## User Setup Required

None — no external service configuration required. `sortablejs`/`@types/sortablejs` are pre-existing dependencies (T-28-SC in the plan's threat model: nothing installed by this plan).

## Next Phase Readiness

- **28-06** (the R035 acceptance block and phase gate) can rely on: the list being always-draggable by handle with the app-wide SortableJS convention (verified structurally, not visually); a move/duplicate/remove/add cycle staying consistent with `performanceOrder` element-for-element; D-02's reference-not-copy guarantee extended to the duplicate action; and last-occurrence garbage collection on remove — all covered by this plan's 23 new tests (9 Task 1 + 14 Task 2), on top of 28-04's 46.
- Full `npx vitest run src/` — **10 failed FILES** (unchanged from the documented baseline; the same `.gsd/quarantine/` suite plus the pre-existing `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` failures, none related to this plan's files), 155/165 files passing, 3576/3630 tests passing (18 skipped). `npm run type-check` — 0 errors. `npm run build` — succeeds.
- No blockers identified.

---
*Phase: 28-song-lyrics-editor-rework-risk-low*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/components/SongLyricEditor.vue
- FOUND: src/components/__tests__/SongLyricEditor.test.ts
- FOUND: .planning/phases/28-song-lyrics-editor-rework-risk-low/28-05-SUMMARY.md
- FOUND: commit 6d11bac (Task 1 test)
- FOUND: commit 6d94789 (Task 1 feat)
- FOUND: commit 40b2079 (Task 2 test)
- FOUND: commit 1a16d8b (Task 2 feat)
