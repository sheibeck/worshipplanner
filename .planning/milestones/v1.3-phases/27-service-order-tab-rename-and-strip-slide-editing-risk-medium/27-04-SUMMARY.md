---
phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
plan: 04
subsystem: ui
tags: [vue, vitest, removal, service-editor, slide-editing, media]

# Dependency graph
requires:
  - phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
    provides: "27-03's removal of the deck editor and deck import surfaces, leaving only the media-attachment control and SlideshowPreview as the remaining slide-editing surfaces on this tab"
provides:
  - "Service Order tab with no media-attachment control on any plan item — attaching group music happens exclusively on the Slides tab (R034)"
  - "src/components/SlotMediaAttachment.vue and its test file deleted (D-02, D-19) — the last orphaned per-slot control this milestone's tab strip targeted"
  - "Group-bed audio attach/remove verified intact end-to-end through SlideGroupMusicControl.vue and SlideGrid.vue's audio-drop path, both unaffected by the view-level removal"
affects: [27-05-strip-slideshow-preview]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Deleting a view-level wrapper (read helper + write handler + component usage) while leaving the underlying scoped store action and its explicit clear-flag contract untouched for surviving callers on a different tab"]

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/EditSlideDrawer.vue

key-decisions:
  - "Reworded the slideGroupsStore setup comment in ServiceEditorView.vue (no longer references 'the media control's display values' or 'two scoped write actions') since only the group-delete cascade remains as a direct caller in this view after the write handler left."
  - "Left the groups-by-slot-id entry in the useSlideshowAssembly destructure exactly as-is (still passed to the Slides tab as a prop) — confirmed by grep before and after both tasks."

patterns-established: []

requirements-completed: [R034, R018]

coverage:
  - id: D1
    description: "The Service Order tab carries no media-attachment control on any plan item — attaching group music happens on the Slides tab (R034)."
    requirement: R034
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (52/52 real tests pass; no SlotMediaAttachment import or usage remains)"
        status: pass
      - kind: other
        ref: "grep -rl 'SlotMediaAttachment' src -> NO-REMAINING-REFERENCES"
        status: pass
    human_judgment: false
  - id: D2
    description: "Attaching and removing a group's bed audio still works from the Slides tab, writing through the same scoped store action it already used. The bed stays audio-only (D-18)."
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupMusicControl.test.ts (11/11 pass)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts (64/64 pass, incl. audio-drop-sets-bed suite)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The per-plan-item section-assignment select still renders once per plan item and still writes through the existing autosave path (D-04)."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#editor: a per-slot section select is bound to slot.section and mutates it through the existing localService path"
        status: pass
    human_judgment: false
  - id: D4
    description: "The media-attachment component and its test file no longer exist on disk, and no file in src names them (D-02, D-19)."
    verification:
      - kind: other
        ref: "test ! -f src/components/SlotMediaAttachment.vue && test ! -f src/components/__tests__/SlotMediaAttachment.test.ts -> DELETED; grep -rl SlotMediaAttachment src -> NO-REMAINING-REFERENCES"
        status: pass
      - kind: other
        ref: "npm run type-check (0 errors); npm run build (succeeds)"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-07-27
status: complete
---

# Phase 27 Plan 04: Strip the Slot Media Attachment Control Summary

**Removed the per-plan-item `SlotMediaAttachment` group-bed-audio control (usage, JSDoc comment, import, read helper, write handler) from `ServiceEditorView.vue`, then deleted the now-orphaned component and its test file, and corrected five stale prose references across the Slides tab's components — the group-bed audio write path itself is untouched and still exercised end-to-end from the Slides tab.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-27T12:24:00Z
- **Completed:** 2026-07-27T12:44:00Z
- **Tasks:** 2 completed
- **Files modified:** 7 (5 modified, 2 deleted)

## Accomplishments
- **Task 1:** Removed the `SlotMediaAttachment` usage and its explanatory comment block from the plan-item row (directly above the section-assignment select, which was left untouched), the component's import statement, the `displaySlotAudioUrl` read helper with its JSDoc, and the `onSlotBedAudioChange` write handler with its JSDoc — all from `src/views/ServiceEditorView.vue`. Reworded the `slideGroupsStore` setup comment, which previously described "the media control's display values" and "two scoped write actions" — now accurate to the single surviving direct caller (the group-delete cascade). Confirmed the `groupsBySlotId` entry stayed in the `useSlideshowAssembly` destructure (still passed as a prop to the Slides tab). Deleted the corresponding `describe('ServiceEditorView - slot media control retargeted at the group bed (Phase 24-06 Task 3)')` block (6 tests) and its top-level `SlotMediaAttachment` import from `ServiceEditorView.test.ts`, per the plan's instruction not to substitute a component-absence assertion (the view uses `shallowMount`, so neither a testid probe nor a `findComponent` probe against a deleted import would prove anything useful). Verified `ServiceEditorView.test.ts` (52/52 real tests pass), `npm run type-check` (0 errors), and both Slides-tab audio suites (`SlideGroupMusicControl.test.ts` 11/11, `SlideGrid.test.ts` 64/64) — proving the surviving write path is untouched.
- **Task 2:** Re-ran the import-graph check against the current tree (`grep -rl 'SlotMediaAttachment' src`) and confirmed zero real importers remained (only the component's own test file, which is deleted alongside it). Deleted `src/components/SlotMediaAttachment.vue` and `src/components/__tests__/SlotMediaAttachment.test.ts`. Updated the five prose-only references that named the deleted component — two in `SlideGroupMusicControl.vue`'s JSDoc (describing the pattern itself instead of pointing at the deleted analog), one in `SlideGrid.vue`'s template comment, and two in `EditSlideDrawer.vue` (one template comment, one catch-block comment) — with no code, markup, or behavior changes to any of the three files. Confirmed `src/components/AudioPlayer.vue` and `src/composables/useMediaUpload.ts` both survive (both still used by the Slides-tab controls). Ran the full slides component suite plus the view's suite (341 real tests pass across 11 real files, plus the 2 pre-existing quarantine-debris failures unrelated to this plan), `npm run type-check` (0 errors), and `npm run build` (succeeds).

## Task Commits

Each task was committed atomically:

1. **Task 1: Unmount the media control and retire its view-level helpers** - `dcdf203` (feat)
2. **Task 2: Delete the orphaned control and correct the prose that names it** - `36f4161` (chore)

**Plan metadata:** committed alongside this SUMMARY (see final metadata commit).

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - Removed the `SlotMediaAttachment` usage + comment, its import, `displaySlotAudioUrl`, and `onSlotBedAudioChange` (with JSDoc); reworded the now-stale `slideGroupsStore` setup comment
- `src/views/__tests__/ServiceEditorView.test.ts` - Removed the Phase 24-06 Task 3 media-control describe block (6 tests) and its top-level `SlotMediaAttachment` import
- `src/components/SlotMediaAttachment.vue` - Deleted (orphaned by Task 1's removal, D-02/D-19)
- `src/components/__tests__/SlotMediaAttachment.test.ts` - Deleted alongside its component
- `src/components/slides/SlideGrid.vue` - One template comment reworded (no code change)
- `src/components/slides/SlideGroupMusicControl.vue` - JSDoc header reworded, no longer points at the deleted component (no code change)
- `src/components/slides/EditSlideDrawer.vue` - Two comments reworded (no code change)

## Decisions Made
- Reworded rather than deleted the `slideGroupsStore` setup comment in `ServiceEditorView.vue` — it previously documented two responsibilities (media-control display reads + two scoped write actions); after this plan only the group-delete cascade remains as a direct write caller in this view, so the comment now says that plainly instead of describing a responsibility that left with the control.
- Followed the plan's explicit instruction not to add a component-absence unit assertion in `ServiceEditorView.test.ts` in place of the retired describe block — the view's tests use `shallowMount` (a child's own markup never renders, so a testid probe proves nothing) and a `findComponent` probe would require keeping an import to a file Task 2 deletes. The absence gate is the repo-wide `grep` check in Task 2; the behavioral gate is the surviving section-select test plus the two Slides-tab audio suites.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' interface sites, prohibitions, and verification commands matched the plan's `<interfaces>` and `<tasks>` sections exactly; no Rule 1-4 deviation was needed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 27-05 can now proceed against a view with no media-attachment surface left — `SlideshowPreview` (27-05's target) is untouched, exactly as scoped.
- Group-bed audio is now attachable/removable EXCLUSIVELY from the Slides tab (`SlideGroupMusicControl.vue`'s attach/remove bar, and `SlideGrid.vue`'s audio-drop-to-bed path) — both suites verified passing in this plan's own gates, matching the v1.3 R034 model.
- `ScriptureSlideEditor` (D-01), the section-assignment select (D-04), the group delete cascade + warning, `expandScriptureEditor`/`handleNavigateToScriptureEditor`, autosave (deep watch + 800ms debounce + saving guard + idle/saved merge), and Phase 24 D-01's lazy `ServiceSlot.id` backfill are all confirmed unchanged — verified by the full targeted suite (`ServiceEditorView.test.ts` + `src/components/slides/`, 341/341 real tests pass) plus `npm run type-check` (0 errors) and `npm run build` (succeeds).
- Full-suite baseline check (`npx vitest run src/`): 10 failed test files (unchanged from the documented baseline — all pre-existing `.gsd/quarantine/worktrees/**` debris, `storage.rules.test.ts` needing the Storage emulator, and the stale `RosterView.test.ts` assertion), 3506 tests passing. No regression introduced by this plan.

---
*Phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- CONFIRMED-DELETED: src/components/SlotMediaAttachment.vue
- CONFIRMED-DELETED: src/components/__tests__/SlotMediaAttachment.test.ts
- FOUND: dcdf203 (Task 1 commit)
- FOUND: 36f4161 (Task 2 commit)
- FOUND: .planning/phases/27-service-order-tab-rename-and-strip-slide-editing-risk-medium/27-04-SUMMARY.md
