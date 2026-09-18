---
phase: quick-260918-nm2
plan: 01
subsystem: ui
tags: [vue, pinia, firestore, vamps, slide-groups, run-control]

requires:
  - phase: 140-vamp-library
    provides: Vamp/VampAttachment types, useVampStore (upload/countAssignments/deleteVamp)
  - phase: 141-vamp-slide-assignment-live-playback
    provides: per-slide vampId/vampLabel denormalization, VampPicker.vue, useRunControl.vampLabelFor, EditSlideDrawer's Choose-a-vamp/Change/Clear precedent
provides:
  - SlideGroup.bedVampId/bedVampLabel — denormalized group-level vamp bed fields
  - setGroupBedMedia vamp-aware assign/clear/upload-clears
  - a vamp-sourced group bed loops in the assembled slideshow (D-04 exception)
  - Choose a vamp / Vamp label / Change / Clear / stale hint in SlideGroupMusicControl, wired through SlideGrid
  - group-level ♪ Vamp badge fallback in Run + rail row vamp label
  - countAssignments/deleteVamp now recognize group-level bedVampId assignments
affects: [vamps, slide-groups, run-control, slides-tab]

tech-stack:
  added: []
  patterns:
    - "Group-level bed media mirrors the per-slide vampId/vampLabel precedent (Phase 141) one tier up: SlideGroup carries bedVampId/bedVampLabel exactly like GroupSlideEntry carries vampId/vampLabel."
    - "A URL-only bed write always evicts the vamp fields (upload-over-vamp and drop-over-vamp both funnel through the same setGroupBedMedia branch), so a stale label can never survive an upload."

key-files:
  created: []
  modified:
    - src/types/slideGroup.ts
    - src/stores/slideGroups.ts
    - src/utils/slideshowAssembler.ts
    - src/stores/vamps.ts
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/SlideGrid.vue
    - src/composables/useRunControl.ts
    - src/components/slides/SlidePlanRail.vue

key-decisions:
  - "vampLabelFor's group-bed fallback excludes the case where slide.groupSlideId is set but no matching entry is found in the group's slides array (a stale/orphaned reference) — only a slide with NO groupSlideId at all (the synthetic scripture-reference slide) or an entry found with no own audioUrl triggers the bed fallback. This was necessary to satisfy the stated behavior that a slide whose entry isn't in the group carries no badge, while the groupSlideId-less reference slide still resolves via the bed."
  - "SlidePlanRail's vamp bed label conditionally includes the colon (`Vamp: {label}` vs bare `Vamp`) rather than the literal `Vamp: ${label ?? ''}`.trim() the plan sketched, to match the existing ♪ badge convention (RunPreviewPair) where a label-less assignment renders as bare `Vamp`, not `Vamp:`."

requirements-completed: [R437, R440]

coverage:
  - id: D1
    description: "SlideGroup.bedVampId/bedVampLabel fields + setGroupBedMedia vamp-aware assign/clear/upload-clears"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts#setGroupBedMedia — group-level vamp bed (260918-nm2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vamp-sourced group bed loops in the assembled slideshow (D-04 exception); uploaded beds never loop"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — group-level vamp bed loops (260918-nm2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "countAssignments/deleteVamp recognize group-level bedVampId assignments so the MP3 is kept"
    requirement: "R440"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/vamps.test.ts#countAssignments — group-level bedVampId (260918-nm2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Choose a vamp / Vamp label / Change / Clear / stale hint in SlideGroupMusicControl, wired through SlideGrid's attach-vamp write"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupMusicControl.test.ts#SlideGroupMusicControl — group-level vamp bed (260918-nm2)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#SlideGrid — group-level vamp bed wiring (260918-nm2)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Group-level ♪ Vamp badge fallback in Run (useRunControl.vampLabelFor) + rail row vamp label"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.audio.test.ts#badge — group-level vamp bed (260918-nm2)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidePlanRail.test.ts#SlidePlanRail (260918-nm2 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "On a new service with a 0-slide group, the vamp bed is assignable and audibly loops during a live Run session"
    verification: []
    human_judgment: true
    rationale: "Requires a real dev build, a live/rehearsal Run session, and audible/visual confirmation — batched into the orchestrator's human UAT pass per the plan's verification section."

duration: ~30min
completed: 2026-09-18
status: complete
---

# Quick Task 260918-nm2: Group-level vamp bed ("Choose a vamp" on the group media panel) Summary

**A planner can now assign a Phase 140 vamp as a whole slide group's audio bed directly from the Slides-tab group media panel, mirroring Phase 141's per-slide assignment, with the bed looping through Run and the badge/rail/library-delete paths all vamp-aware.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 (all TDD: RED commit then GREEN commit each)
- **Files modified:** 15 (8 source, 7 test)

## Accomplishments

- `SlideGroup.bedVampId`/`bedVampLabel` added; `setGroupBedMedia` writes all three bed fields together on a vamp assign, deletes all three on `clearAudio`, and evicts the two vamp fields on any URL-only write (upload or audio-drop) so a stale label can never survive an upload.
- The assembler now loops a vamp-sourced group bed for both the entry-fallback path and the synthetic scripture-reference slide, while an uploaded-only bed still never loops (D-04 preserved).
- `SlideGroupMusicControl` gained a `Choose a vamp` link (empty state and uploaded-file state), a `Vamp: {label}` display with Change/Clear and a `(no longer in library)` stale hint, and an inline `VampPicker` — the component stays emit-only (`attach-vamp`), no store import.
- `SlideGrid.onAttachGroupVamp` writes the vamp's URL/id/label through the same `setGroupBedMedia` scoped write the file-upload path already uses, idempotently, editor-gated.
- `useVampStore.countAssignments` now matches `bedVampId` alongside per-slide `vampId`, so `deleteVamp` keeps the MP3 for a group-only assignment.
- `useRunControl.vampLabelFor` falls back to the group's `bedVampLabel` for any no-own-audio slide (entry-level `vampId` still wins), and `SlidePlanRail` shows `Vamp: {label}` (or bare `Vamp`) instead of the MP3 filename for a vamp-bed row.

## Task Commits

Each task followed RED → GREEN:

1. **Task 1: SlideGroup bed-vamp fields + setGroupBedMedia + looping bed + R440 scan**
   - `baaa138e` test(260918-nm2): failing tests — group-level vamp bed fields, looping vamp bed, group-aware R440 scan
   - `6c865756` feat(260918-nm2): SlideGroup bedVampId/bedVampLabel, vamp-aware setGroupBedMedia, looping vamp bed, group-aware countAssignments
2. **Task 2: SlideGroupMusicControl vamp UI + SlideGrid attach-vamp wiring**
   - `ee4fe910` test(260918-nm2): failing tests — group music control vamp states + SlideGrid attach-vamp wiring
   - `b93f99af` feat(260918-nm2): Choose a vamp on the group music control + SlideGrid attach-vamp write
3. **Task 3: Run badge + rail label**
   - `65aa5e0a` test(260918-nm2): failing tests — group-level ♪ Vamp badge + rail vamp label
   - `f2676601` feat(260918-nm2): group-level ♪ Vamp badge in Run + rail vamp bed label (also fixes a Task 1 test-cast idiom needed for the type-check gate)

_No plan-metadata commit — SUMMARY.md/STATE.md are committed by the orchestrator per this task's constraints._

## Test Counts

- `npx vitest run src/stores/__tests__/slideGroups.test.ts src/utils/__tests__/slideshowAssembler.test.ts src/stores/__tests__/vamps.test.ts src/components/slides/__tests__/SlideGroupMusicControl.test.ts src/components/slides/__tests__/SlideGrid.test.ts src/views/__tests__/RunControlView.audio.test.ts src/components/run/__tests__/RunPreviewPair.test.ts src/components/slides/__tests__/SlidePlanRail.test.ts` → **8 files, 415 tests, all passing** (0 failures).
- `npm run type-check` (`vue-tsc --build`) → clean, 0 errors.
- The orchestrator's own bare `npx vitest run` full-suite pass was not run per this task's constraints (documented ~9 min baseline elsewhere); only the touched files above were exercised here.

## Files Created/Modified

- `src/types/slideGroup.ts` — `bedVampId?`/`bedVampLabel?` on `SlideGroup`; D-04 comment amended.
- `src/stores/slideGroups.ts` — `BedMediaPatch` widened; `setGroupBedMedia`'s existing-doc and skeleton branches made vamp-aware.
- `src/utils/slideshowAssembler.ts` — `resolveEntryMedia` and `emitSyntheticReferenceFromGroup` loop a vamp-sourced bed.
- `src/stores/vamps.ts` — `countAssignments` filter widened to include `data.bedVampId === vampId`.
- `src/components/slides/SlideGroupMusicControl.vue` — Choose a vamp / vamp label / Change / Clear / stale hint / inline `VampPicker`; new props `bedVampId`/`bedVampLabel`/`vamps`/`vampsLoading`; new emit `attach-vamp`.
- `src/components/slides/SlideGrid.vue` — `useVampStore` read, new props passed to the control, `onAttachGroupVamp` write handler.
- `src/composables/useRunControl.ts` — `vampLabelFor` rewritten with the group-bed fallback (see Decisions).
- `src/components/slides/SlidePlanRail.vue` — `bedLabel` computed shows `Vamp: {label}`/`Vamp` for a vamp bed, filename otherwise.
- Seven `__tests__` files — new `(260918-nm2)`-tagged describe blocks per the plan's `<behavior>` bullets (54 new tests total across the suite).

## Decisions Made

- **Orphaned-entry exclusion in `vampLabelFor`:** the plan's literal pseudocode (`!entry?.audioUrl && group.bedVampId`) would have made a slide whose `groupSlideId` points at a since-deleted entry incorrectly borrow the group bed's badge (since `entry` is `undefined`, so `entry?.audioUrl` is `undefined`, making `!entry?.audioUrl` true). Added an explicit `if (slide.groupSlideId && !entry) return null` guard before the bed-fallback check, which lets the genuinely `groupSlideId`-less synthetic reference slide still resolve through the bed (the case the pseudocode was written for) while a slide with a stale/orphaned `groupSlideId` gets no badge. Verified against the plan's own stated behavior ("a slide whose entry is not even in the group carries no badge") and the pre-existing badge regression test.
- **Rail label colon handling:** implemented as `` `Vamp${label ? ': ' + label : ''}` `` rather than the plan's `` `Vamp: ${label ?? ''}`.trim() `` sketch, because the latter renders `"Vamp:"` (trailing colon, no space) for a label-less vamp bed, not the bare `"Vamp"` the RunPreviewPair convention and my own behavior test require.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `vampLabelFor`'s bed-fallback predicate excluded the orphaned-entry case**
- **Found during:** Task 3, while writing the RED test for "a slide whose entry is not even in the group carries no badge"
- **Issue:** The plan's literal pseudocode would return the group's `bedVampLabel` for a slide whose `groupSlideId` doesn't resolve to any entry in the group (e.g., stale data), contradicting the plan's own stated behavior for that exact case.
- **Fix:** Added a guard so a `groupSlideId` that fails to resolve to an entry returns `null` (no badge), while the entirely `groupSlideId`-less case (the synthetic reference slide) still resolves via the bed.
- **Files modified:** `src/composables/useRunControl.ts`
- **Verification:** `src/views/__tests__/RunControlView.audio.test.ts` — all badge tests (pre-existing + new) pass.
- **Committed in:** `f2676601` (Task 3 GREEN commit)

**2. [Rule 1 - Bug] SlidePlanRail's label-less vamp bed rendered a trailing colon**
- **Found during:** Task 3, writing the RED test for a vamp bed with no `bedVampLabel`
- **Issue:** The plan's sketched expression (`` `Vamp: ${label ?? ''}`.trim() ``) leaves a trailing colon (`"Vamp:"`) when the label is absent, rather than the bare `"Vamp"` used everywhere else in the app for a label-less vamp assignment.
- **Fix:** Conditionally include `": {label}"` only when a label is present.
- **Files modified:** `src/components/slides/SlidePlanRail.vue`
- **Verification:** `src/components/slides/__tests__/SlidePlanRail.test.ts` — new no-label case passes.
- **Committed in:** `f2676601` (Task 3 GREEN commit)

**3. [Rule 3 - Blocking] Fixed a type-check-only cast idiom in Task 1's own new tests**
- **Found during:** the plan-final `npm run type-check` gate (after Task 3)
- **Issue:** Three new `setGroupBedMedia` test payload casts used `as Record<string, unknown>` directly against `updateDoc`'s mocked-but-still-real-typed second parameter (`UpdateData<T> | string | FieldPath`), which `vue-tsc --build` rejects as an insufficient-overlap cast — a pattern the rest of the file (and most of my own new tests) already avoid via `as unknown as Record<string, unknown>`.
- **Fix:** Changed the three affected lines to the established double-cast idiom.
- **Files modified:** `src/stores/__tests__/slideGroups.test.ts`
- **Verification:** `npm run type-check` clean; `slideGroups.test.ts` still 41/41 passing.
- **Committed in:** `f2676601` (bundled into the Task 3 GREEN commit, since it was caught only by the plan-final gate that runs after Task 3)

---

**Total deviations:** 3 auto-fixed (2 bug fixes for correctness against the plan's own stated behavior, 1 blocking type-check fix).
**Impact on plan:** All three were necessary to satisfy the plan's own `<behavior>`/acceptance criteria and the mandatory type-check gate. No scope creep — no files touched beyond the plan's `files_modified` list.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema trust-boundary changes beyond what the plan's own `<threat_model>` already covers (the two new `SlideGroup` fields ride the same editor-gated update rule with no key allowlist, as verified in the plan).

## Issues Encountered

None beyond the three items documented above under Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Code + unit tests + type-check are green; ready for the orchestrator's batched human UAT (new-service 0-slide group → Choose a vamp → Vamp label/Change/Clear → Run arm/loop/badge → upload-over-vamp replaces label → delete-that-vamp-keeps-MP3-and-shows-stale-hint), per this quick task's `<verification>` section.
- No blockers for downstream work.

---
*Quick task: 260918-nm2*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 6 commit hashes (`baaa138e`, `6c865756`, `ee4fe910`, `b93f99af`, `65aa5e0a`, `f2676601`) verified present in `git log --oneline --all`. All 8 modified source files verified present on disk.
