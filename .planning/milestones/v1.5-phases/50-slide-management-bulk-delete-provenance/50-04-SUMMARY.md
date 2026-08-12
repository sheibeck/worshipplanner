---
phase: 50-slide-management-bulk-delete-provenance
plan: 04
subsystem: ui
tags: [vue, slide-grid, slide-groups, bulk-delete]

# Dependency graph
requires:
  - phase: 50-03
    provides: "SlideGrid.vue's onImportConfirmed writing renderedPage on new imported entries; unaffected by this plan"
provides:
  - "Per-group 'Remove imported slides' bulk action in SlideGrid.vue (R106)"
affects: [slide-grid, slide-groups-store]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reused window.confirm for a destructive bulk action, matching the existing codebase pattern in useUnsavedGuard.ts / LyricPasteRegion.vue / LyricVersionHistory.vue"

key-files:
  created: []
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "Added a window.confirm gate before the removal write — reuses the existing codebase confirm pattern (window.confirm, tested via vi.spyOn) rather than inventing a modal; kept the happy path testable by mocking window.confirm to return true"
  - "Sorted group.slides by its order field before filtering/renumbering (mirroring the drag-reorder handler's own defensive sort) so survivors' relative PLAY order, not raw array-insertion order, is what gets renumbered — defensive, not required by any observed bug"

requirements-completed: [R106]

coverage:
  - id: D1
    description: "hasImportedEntries / showRemoveImportedControl computeds gate the control on canMutateGroup (editor + not locked + not song group) AND the group actually having an imported entry"
    requirement: "R106"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — remove imported slides action (group-level button, R106) > hides the control when the group has no imported entries"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — remove imported slides action (group-level button, R106) > hides the control on a locked service even with imported entries present"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — remove imported slides action (group-level button, R106) > hides the control for a non-editor even with imported entries present"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — remove imported slides action (group-level button, R106) > never shows the control for a SONG group"
        status: pass
    human_judgment: false
  - id: D2
    description: "onRemoveImportedSlides handler re-checks canMutateGroup, filters exactly sourceRef.kind === 'imported' entries, renumbers survivors contiguously from 0, and persists via replaceGroupSlides with (group.sourceSignature, group.slides) so the write routes through the CR-02 concurrent-merge and the source signature is left unchanged"
    requirement: "R106"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — remove imported slides action (group-level button, R106) > shows the control and, on confirm, removes exactly the imported entries, renumbering the rest contiguously from zero"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — remove imported slides action (group-level button, R106) > does not persist when the confirm dialog is cancelled"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-10
status: complete
---

# Phase 50 Plan 04: Remove Imported Slides Summary

**Per-group "Remove imported slides" bulk-delete control in `SlideGrid.vue`, gated behind the existing `canMutateGroup` seam and a `window.confirm` prompt, writing through `replaceGroupSlides`'s CR-02 concurrent-merge with the source signature left unchanged.**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `hasImportedEntries` / `showRemoveImportedControl` computeds — offered only when the selected group actually has at least one `sourceRef.kind === 'imported'` entry AND the caller can mutate the group's slides (editor, not locked, not a song group — `canMutateGroup` already excludes song groups, so no separate check was needed)
- `onRemoveImportedSlides` handler — re-checks `canMutateGroup.value` inside the handler (not template-`v-if`-only, per 30-VERIFICATION I-01), filters out exactly the imported entries, renumbers the survivors to contiguous `order` from 0 preserving their relative play order, and persists via `replaceGroupSlides(orgId, slotId, remaining, group.sourceSignature, group.slides)` — the source signature is passed through unchanged (a removal changes no source) and `group.slides` is passed as `baseSlides` so the write routes through the CR-02 concurrent-write transaction merge, exactly like every other group-slides write in this file
- "Remove imported slides" button added to the group-media panel, styled to match the existing congregational-reading button, with the panel wrapper's `v-if` disjunction extended so the panel still renders when the remove control is the only applicable one
- Six new tests covering the happy path (asserts the exact `replaceGroupSlides` call args — imported entries removed, others intact and renumbered, signature unchanged, `baseSlides` passed through), confirm-cancelled, no-imported-entries, locked-service, non-editor, and SONG-group cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove-imported handler and gates** - `55588e6` (feat)
2. **Task 2: Control in the group-media panel + tests** - `002976c` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/slides/SlideGrid.vue` - `hasImportedEntries`/`showRemoveImportedControl` computeds, `onRemoveImportedSlides` handler, and the "Remove imported slides" button in the group-media panel
- `src/components/slides/__tests__/SlideGrid.test.ts` - six new tests under `describe('SlideGrid — remove imported slides action (group-level button, R106)')`

## Decisions Made
- **Confirm dialog: added, via `window.confirm`.** The plan left this to Claude's discretion. A confirm is warranted because the action removes multiple slides at once and is irreversible; rather than inventing a new modal system, this reuses the exact `window.confirm` pattern already established in `useUnsavedGuard.ts`, `LyricPasteRegion.vue`, and tested the same way in `LyricVersionHistory.test.ts` (`vi.spyOn(window, 'confirm').mockReturnValue(...)`). The happy-path test mocks `confirm` to return `true`; a second test asserts cancelling leaves `replaceGroupSlides` uncalled.
- Sorted `group.slides` by its `order` field before filtering, mirroring the drag-reorder handler's own defensive sort (`[...currentGroup.slides].sort((a, b) => a.order - b.order)`) rather than relying on array-insertion order matching `order` values. Every existing write path (`appendToGroup`, the reorder handler) already keeps the two in sync, so this is a defensive consistency choice, not a fix for an observed bug.

## Deviations from Plan

None - plan executed exactly as written. The confirm dialog was explicitly left to discretion by the plan and is documented above, not a deviation.

## Issues Encountered

One test-authoring correction (not a deviation from the plan, an in-flight test fix): the `baseSlides` assertion initially used `toBe(group.slides)` (reference equality) and failed because Vue wraps the `group` prop in a reactive proxy. Fixed to `toEqual` — the same reasoning already documented inline in the pre-existing drag-reorder test in this same file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

R106 is complete. Ready for `50-05` (the plan that plan 50-04's context notes will consume `renderedPage`, per `50-03`'s work and the `SourceRef` doc comment in `src/types/slideGroup.ts`). No blockers.

Verification run at completion (2026-08-10):
- `npx vitest run src/components/slides/__tests__/SlideGrid.test.ts` — 132/132 pass (126 pre-existing + 6 new)
- `npm run type-check` (`vue-tsc --build`) — clean
- Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) — 2982/2995 pass, 13 failing across exactly the documented 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`); no new failures introduced by this plan

## Self-Check: PASSED

- `src/components/slides/SlideGrid.vue` exists — FOUND
- `src/components/slides/__tests__/SlideGrid.test.ts` exists — FOUND
- Commit `55588e6` present in `git log` — FOUND
- Commit `002976c` present in `git log` — FOUND

---
*Phase: 50-slide-management-bulk-delete-provenance*
*Completed: 2026-08-10*
