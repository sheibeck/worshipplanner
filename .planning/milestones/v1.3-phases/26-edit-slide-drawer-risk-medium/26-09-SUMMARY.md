---
phase: 26-edit-slide-drawer-risk-medium
plan: 09
subsystem: ui
tags: [vue, slideGroups, reconciliation, cas, duplicate, delete]

# Dependency graph
requires:
  - phase: 26-05
    provides: EditSlideDrawer.vue's shell, footer-adjacent body layout, and the fresh-base compare-and-swap write helper every write in this plan reuses
  - phase: 26-01
    provides: the ReconcileResult/songSwap shape and the test-pinned CAS write contract this plan's reconciliation fix and writes both build on
provides:
  - "src/utils/slideGroupMaterializer.ts — reconcileSongGroup now indexes stored song-section entries as an array per sectionId (never collapsed to one), so a duplicated song-section slide survives the next within-song reconciliation instead of being silently dropped"
  - "src/components/slides/EditSlideDrawer.vue — Duplicate (mints a fresh id, inserts directly after the original, renumbers order, moves the selection to the copy only once the write succeeds) and Delete Slide (inline confirm naming what's genuinely at risk, filters + renumbers, never touches the group's bed) in the footer action row"
  - "src/components/slides/slideDisplay.ts — deleteSlideConfirmBody, the four warning wordings as a pure function keyed on an entry's own audio/notes"
  - "src/components/slides/SlidesTab.vue — relays the drawer's duplicate event into the existing selectSlideById handler"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Duplicate mints a fresh id via crypto.randomUUID() (never the original's, never derived from label/source/position) and moves the panel's selection only AFTER the write resolves — an eager selection move would point the panel at an entry that was never actually created if the write is rejected."
    - "Delete's inline confirm reuses SongSlideOver.vue's exact shell/button-pair classes and reveal-in-place discipline (not a separate dialog), matching the codebase's one established delete-confirm pattern rather than inventing a second."
    - "The song reconciler's per-section index changed from Map<sectionId, entry> to Map<sectionId, entry[]> — the single generalization that makes the additive merge duplicate-tolerant while leaving every other behavior (insertion, retention, copyright dedup, changed-detection) provably unchanged."

key-files:
  created: []
  modified:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts

key-decisions:
  - "Task 1 (the reconciliation fix) landed and was verified GREEN before any Duplicate-exposing code was written — the plan's own critical constraint, since shipping Duplicate first would have introduced a real, unconfirmed data-loss window."
  - "Selection-follows-copy is success-gated: the drawer computes the copy's id locally (no need to await a round trip to know it) but only emits the `duplicate` event, and SlidesTab.vue only moves the selection, after `replaceGroupSlides` actually resolves — a rejected write is reported via console.error and the selection never dangles on an entry that doesn't exist."
  - "Duplicate and Delete Slide share one footer template block (per 26-UI-SPEC.md's single-row layout, and because Task 2's own acceptance criteria require the Delete Slide trigger to already render, per the plan's hard constraint 'Task 3 fills in the delete half') — documented as a deviation below rather than silently left unstated."
  - "deleteSlideConfirmBody lives in the pure slideDisplay module (not inline in the component) so its four-wordings decision table is unit-testable in isolation, matching the module's existing purity contract and its reconciliationConfirmCopy precedent from 26-04."

patterns-established:
  - "Optimistic-id, pessimistic-selection: mint an id synchronously for a create action, but gate any user-visible consequence of that id (selection, navigation) on the write's actual success — the reusable shape for any future 'create and follow' action in this drawer."

requirements-completed: [R033, R029, R018]

coverage:
  - id: D1
    description: "Song reconciliation keeps BOTH stored entries for a duplicated song section, in stored order, each with its own id, label, notes, audio and loop — while the single-entry case, section insertion, unresolvable-section retention, copyright dedup, and changed/unchanged detection are all unchanged"
    requirement: R029
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts > reconcileSongGroup > duplicate-tolerant merge (Phase 26-09 Task 1) > keeps BOTH stored entries for the same song section, in stored order, each with its own id"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts > reconcileSongGroup > duplicate-tolerant merge (Phase 26-09 Task 1) > the surviving copies keep their own label, notes, audio and loop values"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts > reconcileSongGroup > duplicate-tolerant merge (Phase 26-09 Task 1) > one entry per section still behaves exactly as before this change"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts > reconcileSongGroup > duplicate-tolerant merge (Phase 26-09 Task 1) > order values stay contiguous from 0 across a duplicated section, an inserted section, and a retained-unresolvable one"
        status: pass
    human_judgment: false
  - id: D2
    description: "A slide can be copied: the copy mints a fresh id, lands directly after the original, carries label/notes/audio/scope/loop/sourceRef by value, renumbers every entry's order, and the panel follows the copy only once the write succeeds"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 2 — Duplicate, follows the copy) > copies a slide: the written array has one more entry, positioned directly after the original"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 2 — Duplicate, follows the copy) > the copy carries the original's label, notes, audio, scope, loop and source reference"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 2 — Duplicate, follows the copy) > passes the base snapshot reflecting the group's slides at write time, not at mount"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 2 — Duplicate, follows the copy) > moves the panel's selection to the copy on a successful write (emits duplicate with the new id)"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 2 — Duplicate, follows the copy) > reports a rejected write and does not move the selection to a non-existent entry"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Duplicate follows the copy (Phase 26-09 Task 2) > selects the new entry and shows it in the panel when the drawer's duplicate event fires"
        status: pass
    human_judgment: false
  - id: D3
    description: "A slide can be deleted behind an inline confirm naming exactly what's genuinely at risk (its own audio and/or notes, never the group's shared music); deleting removes only that entry, renumbers the rest, and never calls the group-bed write"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts > deleteSlideConfirmBody (Phase 26-09 Task 3) > names both attached audio and operator notes when both are present"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 3 — Delete...) > confirming removes only that entry from the written array and renumbers the rest contiguous, every other entry unchanged by value"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 3 — Delete...) > never calls the group-bed write during a delete"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 3 — Delete...) > cancelling returns the panel to normal and deletes nothing"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 3 — Delete...) > reports a rejected write and leaves the entry in place"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both actions are gated on write capability, and neither is offered to a viewer"
    requirement: R018
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 2...) > does not render the copy action for a user without write capability"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-09 Task 3...) > does not render the delete trigger for a user without write capability"
        status: pass
    human_judgment: false
  - id: D5
    description: "Copy a slide in the middle of a group, confirm it lands after the original with the panel now editing the copy; copy a song slide and change the song's sections, confirm the copy survives; delete a slide with audio+notes and confirm both are named; confirm the group's shared music still plays after a delete; confirm the panel closes itself after a delete"
    verification: []
    human_judgment: true
    rationale: "Deferred to the milestone's batch human-verify per this plan's own <verify><human-check> block (workflow.verifier is false; see STATE.md) — jsdom cannot assert real grid layout/order rendering, cross-component navigation feel, or audio playback continuity."

# Metrics
duration: 55min
completed: 2026-07-27
status: complete
---

# Phase 26 Plan 09: Duplicate, Delete, and a Duplicate-Tolerant Song Reconciliation Summary

**Song reconciliation now keeps every stored entry per section (not just the last), and the Edit Slide drawer ships its final two actions — Duplicate (fresh id, follows the copy, success-gated) and Delete Slide (inline confirm naming only what's genuinely at risk) — completing Phase 26.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Fixed a real, previously-unconfirmed data-loss defect in `reconcileSongGroup`: the additive song merge indexed stored lyric entries into a `Map<sectionId, entry>`, keeping only the last entry seen for a repeated `sectionId`. A duplicated song-section slide would have been silently dropped the next time that song's sections changed, with no confirm gate (this is the additive merge path, which never confirm-gates). Re-indexed as `Map<sectionId, entry[]>` so every stored entry for a section survives, in stored order — verified this fix lands and is GREEN before any Duplicate-exposing code exists, per the plan's own critical constraint.
- Added the footer action row to `EditSlideDrawer.vue` (Duplicate left of Delete Slide, above a divider, per 26-UI-SPEC.md's placement) with both actions gated on write capability.
- `Duplicate`: mints a fresh `crypto.randomUUID()` id (never the original's, never derived from label/source/position — `PresentationViewer.vue` keys per-slide media components on this id), inserts the copy directly after the original, renumbers every entry's order contiguous, and writes through the same fresh-base compare-and-swap helper every other write in this drawer uses. The panel's selection moves to the copy only once the write actually succeeds — the id is known synchronously, but the `duplicate` event (which `SlidesTab.vue` relays into its existing `selectSlideById`) fires only after the write resolves, so a rejected write never leaves the panel pointed at an entry that was never created.
- `Delete Slide`: reveals an inline confirm block (matching `SongSlideOver.vue`'s own delete-confirm shell, not a separate dialog) with one of four wordings from a new pure `deleteSlideConfirmBody` in `slideDisplay.ts`, keyed on whether THIS entry (never the group's shared bed music) has its own attached audio and/or operator notes. Confirming filters the entry out, renumbers the rest, and writes through the fresh-base helper; the group's `bedAudioUrl` is never touched. No close-handling was added for the post-delete case — `SlidesTab.vue`'s existing `selectedGroupSlideIds` watch already clears the selection (and with it, `drawerOpen`) once the deleted id stops resolving.

## Task Commits

1. **Task 1: A copied song slide survives the next reconciliation** — `534b32b` (fix, includes its own test coverage)
2. **Task 2: Copy a slide, and follow the copy** — `122c8fd` (feat, includes its own test coverage; see Deviations for why the Delete Slide trigger's inert markup also lands in this commit)
3. **Task 3: Delete a slide, behind a warning that names what goes with it** — `6a6d7e1` (feat, includes its own test coverage — `deleteSlideConfirmBody` + the delete-confirm wiring)

**Plan metadata:** (this commit) — SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md

## Files Created/Modified
- `src/utils/slideGroupMaterializer.ts` — `reconcileSongGroup`'s per-section index widened to an array, keeping every stored entry per section
- `src/utils/__tests__/slideGroupMaterializer.test.ts` — new `duplicate-tolerant merge (Phase 26-09 Task 1)` describe block, 4 tests
- `src/components/slides/EditSlideDrawer.vue` — footer action row, `onDuplicate`, `showDeleteConfirm`/`isDeleting`/`deleteConfirmBody`/`onDeleteTrigger`/`onCancelDelete`/`onConfirmDelete`, `duplicate` emit
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — two new describe blocks (Duplicate: 8 tests; Delete: 11 tests)
- `src/components/slides/slideDisplay.ts` — `deleteSlideConfirmBody`
- `src/components/slides/__tests__/slideDisplay.test.ts` — new `deleteSlideConfirmBody` describe block, 6 tests
- `src/components/slides/SlidesTab.vue` — `@duplicate="selectSlideById"` wiring
- `src/components/slides/__tests__/SlidesTab.test.ts` — new `Duplicate follows the copy (Phase 26-09 Task 2)` describe block, 1 test

## Decisions Made
- Task 1's fix landed as its own commit, verified RED (failing without the fix, confirmed via a temporary `git stash` of just the production file) then GREEN, before any Duplicate-exposing code was written — honoring the plan's stated critical constraint literally rather than just in spirit.
- Selection-follows-copy is success-gated, not eager: the plan's own text ("the id is known locally before the write lands, so there is no need to wait for the round trip") is about knowing the id without a round trip, not about moving the selection before the write resolves — the acceptance criterion requiring a rejected write to never leave the selection pointing at a non-existent entry settled this in favor of gating the `duplicate` emit on write success.
- `deleteSlideConfirmBody` lives in `slideDisplay.ts` (not inline in the component) so the four-wordings decision table is unit-testable as a pure function, mirroring `reconciliationConfirmCopy`'s existing precedent in the same module.

## Deviations from Plan

### Process deviation (documented, not a Rule 1-4 fix)

**Task 2 and Task 3's `EditSlideDrawer.vue` changes were authored together in one component edit, then committed as two commits that each carry complete, dedicated, passing test coverage — but Task 2's commit unavoidably also carries Task 3's inert Delete Slide markup.** The footer row's Duplicate and Delete Slide buttons share one template block per 26-UI-SPEC.md's single-row layout, and Task 2's own acceptance criteria explicitly require the Delete Slide trigger to already render ("the copy action left of the delete trigger, above a divider") — the plan's own hard constraint states "Task 3 fills in the delete half," meaning Task 2 was always expected to ship the trigger's markup. Given git's file-level (not template-region-level) diff granularity, and that both the duplicate and delete-confirm markup sit in one contiguous inserted block with no unchanged context between them, splitting the underlying file edit into two non-overlapping patches was not practical. Both tasks nonetheless have complete, independently-verified test suites: Task 2's 8 Duplicate tests and the SlidesTab relay test were green before its commit; Task 3's 11 delete-flow tests plus `slideDisplay.ts`'s 6 `deleteSlideConfirmBody` tests were green before its commit. `slideDisplay.ts` and its test file — Task 3's one fully independent file — were committed cleanly under Task 3's own commit with no Task 2 dependency. This mirrors 26-05's own documented precedent for the identical reason (one cohesive Vue SFC edit, split into per-task commits by test coverage rather than by file diff).

No Rule 1-4 auto-fixes were needed — no bugs, missing-critical-functionality gaps, blocking issues, or architectural questions surfaced beyond the plan's own Task 1 fix (which the plan already specified in full).

## Issues Encountered
None beyond the documented process deviation above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 26 (Edit Slide drawer) is now complete: shell (26-05), per-kind Slide Text (26-07), Slide Audio (26-08), and Duplicate/Delete (this plan) are all shipped against the same `EditSlideDrawer.vue`.
- Full verification: `npx vitest run src/components/slides/ src/utils/__tests__/slideGroupMaterializer.test.ts` — 340 passed, 0 failed. `npx vitest run src/` — 10 failed FILES (unchanged from the documented baseline: 8 under `.gsd/quarantine/worktrees/**`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 3521 passed tests. `npm run type-check` reports 0 errors. `npm run build` succeeds. `git grep -n "bedVideoUrl" src/` returns nothing (D-18 guard holds).
- The five `<human-check>` items (copy-in-middle ordering + panel-follows-copy; a copied SONG slide surviving a source change; the four delete-warning wordings in situ; the group's shared music surviving a delete; the panel closing itself after a delete) are deferred to the milestone's batch human-verify per this plan's own `<verify>` block, matching every other plan in this phase.
- No blockers for Phase 27 (Service Order tab rename / Phase 18-23 slide surface removal) or Phase 28 (song lyrics editor rework).

---
*Phase: 26-edit-slide-drawer-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/utils/slideGroupMaterializer.ts
- FOUND: src/utils/__tests__/slideGroupMaterializer.test.ts
- FOUND: src/components/slides/EditSlideDrawer.vue
- FOUND: src/components/slides/__tests__/EditSlideDrawer.test.ts
- FOUND: src/components/slides/slideDisplay.ts
- FOUND: src/components/slides/__tests__/slideDisplay.test.ts
- FOUND: src/components/slides/SlidesTab.vue
- FOUND: src/components/slides/__tests__/SlidesTab.test.ts
- FOUND: 534b32b (fix, Task 1)
- FOUND: 122c8fd (feat, Task 2)
- FOUND: 6a6d7e1 (feat, Task 3)
