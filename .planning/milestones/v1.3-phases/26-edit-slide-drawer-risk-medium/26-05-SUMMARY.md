---
phase: 26-edit-slide-drawer-risk-medium
plan: 05
subsystem: ui
tags: [vue, teleport, drawer, slide-groups, cas, autosave]

# Dependency graph
requires:
  - phase: 26-03
    provides: the SlidesTab selection seam this plan mounts against (selectedSlotId/selectedSlideId, header comment documents the contract)
provides:
  - "src/components/slides/EditSlideDrawer.vue — the R033 floating, scrimless Edit Slide panel: shell, context line, preview, and live-apply label/notes fields through a fresh-base write"
  - "SlidesTab.vue: selectedEntry (direct id lookup against selectedGroup.slides), drawerOpen, onDrawerClose, selectSlideById (exposed) — the Phase 25 seam extended for the drawer"
affects: [26-06 (reconciliation modal, independent surface), 26-07 (adds the per-kind Slide Text block/edit-in-song/edit-in-scripture links to this same drawer), 26-08 (adds the Slide Audio section), 26-09 (adds Duplicate/Delete to this drawer's footer)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapt-not-invent panel reuse: SongSlideOver.vue's teleport target, panel Transition classes/timings and close-icon markup copied verbatim; its backdrop Transition block deliberately deleted, with a comment naming the decision so it isn't 'restored' for consistency later."
    - "Fresh-base compare-and-swap write, local to the component: an entryId captured at debounce-schedule time (survives a later entry switch) paired with the group's slides array re-read from the LIVE prop at write time (never a snapshot captured at open or schedule time) — the exact CR-02 data-loss class this plan's must_haves call out by name."
    - "drawerOpen is set true only inside the explicit onSelectSlide/selectSlideById handlers (not via a watch on selectedSlideId), so re-selecting the SAME already-selected slide after a close still reopens the drawer — a plain watch would miss that case since the value wouldn't change."
    - "Per-field debounce+status state (idle/saving/saved/error) hand-rolled rather than reusing the existing useAutoSave composable, so a rejected write can surface a distinct failure state without ever passing through 'saved' — useAutoSave's own saveFn call has no catch branch, which would either produce an unhandled rejection or (if swallowed) a false 'saved'."

key-files:
  created:
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
  modified:
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts

key-decisions:
  - "Task 1's shell and Task 3's label/notes write logic were authored together in a single component build (one Vue SFC is easier to reason about coherently than staging a partial file across two edits) — but committed as two separate task commits by adding each task's dedicated test coverage before/alongside its own commit, per the plan's per-task acceptance criteria. Documented here as a deviation from strict single-task RED-before-any-GREEN-code sequencing; every acceptance criterion in both tasks has its own passing, previously-failing-or-newly-added test."
  - "Reused the existing useAutoSave composable's DESIGN (debounce, status vocabulary, flush/cleanup shape) as a reference but hand-rolled the actual per-field state in EditSlideDrawer.vue rather than instantiating useAutoSave twice, specifically so a rejected write can reach a distinct 'error' status — useAutoSave's own scheduleSave has no catch around `await saveFn()`, so a rejection there either produces an unhandled promise rejection (nobody awaits the timer callback) or, if swallowed inside saveFn, would still resolve to 'saved', which the plan's must_haves explicitly forbid ('A rejected write surfaces as a failure rather than a false saved state')."
  - "Status/failure copy uses 'Saving…'/'Saved' (UI-SPEC's Roles-tab convention, quick-task 260714-e7o) and, for a rejection, 'Failed to save. Please try again.' — the exact wording already shipped in SettingsView.vue for the same class of failure, rather than inventing new copy (the UI-SPEC's copy table only fixes the two success states)."
  - "drawerOpen is a boolean local to SlidesTab.vue, set true only by onSelectSlide/selectSlideById and false only by the drawer's own close emit or the selection itself becoming unresolvable (selectedSlideId turning null via the pre-existing Phase 25 watchers) — never by a watch on selectedSlideId reacting to a value CHANGE, so re-selecting the already-selected slide after a close still reopens the panel (a change-based watch would silently no-op on that exact case, since the id doesn't change)."
  - "The entry-update helper captures the target entryId at the moment a field's debounce timer is scheduled (not read fresh from props.entry at write time) precisely so that switching the edited entry mid-debounce and flushing still targets the ENTRY BEING LEFT, while the base array (group.slides) is still always re-read fresh from the live prop at the moment the write actually fires — these are two independent freshness concerns and conflating them would either write to the wrong entry (if entryId were also read fresh) or reintroduce the stale-base bug (if the base were captured alongside entryId)."

patterns-established:
  - "Fresh-base local write helper, entryId captured at schedule time + base array re-read at write time — the pattern every later field this drawer adds (audio scope/loop in 26-08, text-kind body in 26-07) should replicate rather than re-derive."

requirements-completed: [R033, R018]

coverage:
  - id: D1
    description: "The panel is a fixed-position overlay teleported to the document body, with no backdrop/scrim of any kind; the grid stays clickable underneath"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > mounts the panel teleported to the document body when open with a resolvable entry"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > renders no backdrop, scrim, or full-screen dimming element at any time"
        status: pass
    human_judgment: false
  - id: D2
    description: "Escape and the close control both close the panel; the Escape listener is added/removed with open state and unmount; closing it swallows no further Escape presses"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > emits a close intent when the close control is activated"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > emits a close intent when Escape is pressed while open"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > emits nothing on a subsequent Escape once the panel has closed"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > removes the Escape listener on unmount so a torn-down panel never swallows the key"
        status: pass
    human_judgment: false
  - id: D3
    description: "The context line shows the kind badge, source title and position; the preview renders centred text / an image / a static video glyph per content kind, with no player element for video"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > shows the context line's kind badge, source title and position within the group"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > previews centred text for a text-bearing slide"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > previews an image for an image slide"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > previews a static, non-interactive glyph and no player element for a video slide"
        status: pass
    human_judgment: false
  - id: D4
    description: "The panel renders nothing when closed and nothing when the selection has no resolvable stored entry behind it (the pre-materialization fallback-id window); no Save/Cancel/Tag/Details control ever renders"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > renders nothing in the document body when closed"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > renders nothing when open with no resolvable entry"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 1 — shell) > renders no Save, Cancel, Tag or Details control"
        status: pass
    human_judgment: false
  - id: D5
    description: "The selected slide resolves to its stored entry by a direct id lookup with no mapping layer; an unresolvable selection resolves to null; the drawer follows the selection (swaps in place, reopens on re-select, closes only via its own close emit or the selection disappearing)"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > resolves the selected slide to its stored entry by a direct id lookup and mounts the drawer with it"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > resolves to nothing (and the drawer does not open) when the selected slide id has no matching stored entry"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > swaps to the second entry and stays open when a different slide is selected while open"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > reopens the drawer when the same slide is re-selected after it was closed"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > closes the drawer (via the existing seam) when the selected plan item changes"
        status: pass
    human_judgment: false
  - id: D6
    description: "The drawer receives the selected slide's correct one-based position and the group's total, and a select-by-id function is exposed for a later action to use; the grid's own props are unchanged"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > passes the selected slide's correct one-based position and the group's total"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > moves the selection and opens the drawer when the exposed select-by-id function is invoked"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > SlidesTab > Edit Slide drawer wiring (Phase 26-05 Task 2) > leaves every prop the grid received before this change unchanged"
        status: pass
    human_judgment: false
  - id: D7
    description: "Label and notes apply live: debounced to one write per pause (not per keystroke), touching only the target entry, saving/saved/failure status shown, gated on write capability, re-synced from a persisted-entry change"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > writes exactly once after the debounce period following a single label edit"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > collapses several rapid keystrokes into a single write, not one per keystroke"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > writes the edit on the target entry only, passing every other entry through unchanged by value"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > shows a saving state during the write and a saved state after it resolves"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > surfaces a failure (never a false saved state) on a rejected write, and does not revert the typed value"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > renders neither field for a user without write capability, while the slide information still reads"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > re-syncs the panel's own field copy when the persisted entry changes"
        status: pass
    human_judgment: false
  - id: D8
    description: "T-26-05-01 — every write's CAS base is the group's slides FRESHLY read at write time, never a copy captured when the drawer opened; switching the edited entry mid-write flushes the pending write for the entry being left"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > passes the FRESHLY-READ group slides as the write base, not the array captured when the drawer opened"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts > EditSlideDrawer (Phase 26-05 Task 3 — label/notes live-apply) > flushes the pending write for the entry being left when the edited entry switches mid-edit"
        status: pass
    human_judgment: false
  - id: D9
    description: "R033/D-01 (drawer floats with nothing underneath reflowing) and D-03 (grid stays clickable, drawer swaps in place on a real card click) — layout/pixel and real-pointer-interaction judgment jsdom cannot assert"
    verification: []
    human_judgment: true
    rationale: "Deferred to the milestone's batch human-verify per this plan's own <verify><human-check> block (workflow.verifier is false; see STATE.md) — jsdom has no layout engine to assert 'nothing shifts' and no real pointer/click-through behavior to assert 'the grid stays clickable underneath'."

# Metrics
duration: 55min
completed: 2026-07-27
status: complete
---

# Phase 26 Plan 05: Edit Slide drawer shell, selection seam, and label/notes live-apply Summary

**A floating, scrimless Edit Slide panel wired to Phase 25's `selectedSlideId` seam via a direct id lookup, with label and notes fields applying live through a fresh-base compare-and-swap write.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 2

## Accomplishments
- Built `EditSlideDrawer.vue`: a `Teleport`-to-body, fixed-position right-edge panel adapting `SongSlideOver.vue`'s exact panel shell/transition/close-icon markup while deliberately deleting its backdrop block (D-03) — the grid stays fully clickable underneath, with a comment on the panel naming that decision so a later contributor doesn't "restore" it.
- Header carries the title, an icon-only close control, and a status area; Escape and the close control both emit the same close intent; the Escape listener is added/removed with the open state and on unmount; focus moves into the panel on open and returns to whatever held it before.
- Context line (kind badge, source title, one-based position/total) and a fixed-ratio preview (centred text / image / static, non-interactive video glyph) per the UI-SPEC, reusing `slideDisplay.ts`'s existing `KIND_BADGE_CLASSES`/`slotDisplayTitle`/`slideBodyText` helpers rather than re-deriving any of them.
- Extended `SlidesTab.vue` with `selectedEntry` (a direct `selectedGroup.slides.find(e => e.id === selectedSlideId)` lookup, verified against `slideshowAssembler.ts`'s `emitFromGroup` rather than assumed), `drawerOpen`, `onDrawerClose`, and an exposed `selectSlideById` for a later duplicate action; mounted the drawer as a sibling of `SlideGrid`, changing none of the grid's own props.
- Added label and notes fields that apply live: an 800ms-debounced, per-field local write helper reads the group's slides FRESH from the live prop at the moment each write fires (never a snapshot from when the drawer opened), captures the target entry id at schedule time (so a mid-debounce entry switch still flushes to the correct, LEAVING entry), and drives a shared saving/saved/error status area.

## Task Commits

1. **Task 1: The panel shell — floating, scrimless, and self-describing**
   - `871e0cf` (test) — failing tests for the shell: teleport mount, no-backdrop, close/Escape, context line, per-kind preview, closed/no-entry renders nothing, no Save/Cancel/Tag/Details
   - `9decb1c` (feat) — the shell component
2. **Task 2: Resolve the selected entry and mount the panel beside the grid**
   - `c75f6e3` (test) — failing tests for entry resolution, follow-selection behavior, position/total, `selectSlideById`, grid prop stability
   - `a3a3096` (feat) — `selectedEntry`/`drawerOpen`/`onDrawerClose`/`selectSlideById`, drawer mounted as a grid sibling
3. **Task 3: Label and notes apply live, through a fresh-base write**
   - `2cbb987` (test) — dedicated tests for debounce collapsing, per-entry write scoping, the fresh-base CAS guarantee, entry-switch flush, saving/saved/failure status, write-capability gating, and persisted-value re-sync (implementation for this task was authored alongside Task 1's shell in the same component build — see Deviations)
   - `bc1bfb2` (fix) — type-check fix in the same test file (Promise executor typing)

**Plan metadata:** (this commit) — SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md

## Files Created/Modified
- `src/components/slides/EditSlideDrawer.vue` — new component: shell, context/preview, and label/notes live-apply
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — new test file, 38 tests across the shell and live-apply describe blocks
- `src/components/slides/SlidesTab.vue` — `selectedEntry`, `selectedGroupAssembledSlides`, `selectedAssembledSlide`, `selectedSlidePosition`/`selectedSlideTotal`, `drawerOpen`, `onDrawerClose`, `selectSlideById` (exposed), drawer mounted as a `SlideGrid` sibling
- `src/components/slides/__tests__/SlidesTab.test.ts` — new `describe('Edit Slide drawer wiring (Phase 26-05 Task 2)')` block, 8 tests

## Decisions Made
- Task 1's shell and Task 3's write logic were built together in one component file rather than staged across two partial edits — each task still got its own dedicated, passing test suite and its own commit; see "Deviations from Plan" below for the honest accounting of what that means for strict TDD sequencing.
- Hand-rolled the label/notes debounce/status state rather than instantiating the existing `useAutoSave` composable twice, specifically so a rejected write can reach a distinct `'error'` status without ever passing through `'saved'` — `useAutoSave`'s `scheduleSave` has no catch around its `await saveFn()`, so a rejection there would either produce an unhandled promise rejection (nothing awaits the fire-and-forget timer callback) or, if the caller swallowed it, still resolve to `'saved'`, which this plan's must_haves explicitly forbid.
- `drawerOpen` is set `true` only inside the explicit `onSelectSlide`/`selectSlideById` handlers, never via a `watch` reacting to a `selectedSlideId` value change — a change-based watch would silently no-op when the user re-selects the already-selected slide after closing the drawer, since the id wouldn't actually change.
- The fresh-base write helper captures the target `entryId` at debounce-SCHEDULE time (so a later entry switch still flushes to the correct, LEAVING entry) while always re-reading the group's slides array at write-EXECUTION time (never a copy from schedule or open time) — two independently-necessary freshness guarantees that must not be conflated.
- Failure copy ("Failed to save. Please try again.") reuses `SettingsView.vue`'s existing wording for the same class of failure rather than inventing new copy, since the UI-SPEC's copy table only fixes the two success states (`Saving…`/`Saved`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion used reference equality against a Vue-reactive proxy array**
- **Found during:** Task 3, writing the fresh-base CAS test
- **Issue:** `expect(baseSlides).toBe(updatedGroup.slides)` failed even though the write correctly used the freshly-set, updated array — Vue wraps a reactive prop's array in a Proxy, so a value read from `props.group.slides` inside the component is never `===` the raw array object passed to `wrapper.setProps()`, even when it IS the live, current value.
- **Fix:** Changed the assertion to `toStrictEqual`, which verifies the same freshness guarantee (content matches the UPDATED array, not the one from mount) without depending on Vue's internal proxy identity.
- **Files modified:** `src/components/slides/__tests__/EditSlideDrawer.test.ts`
- **Commit:** `2cbb987`

**2. [Rule 3 - Blocking] Fixed a Promise executor type mismatch in a new test**
- **Found during:** Task 3, `npm run type-check`
- **Issue:** `new Promise((resolve) => { resolveWrite = resolve })` typed `resolveWrite` as `(value: unknown) => void` (the executor's inferred `resolve` signature) against a declared `() => void`, failing `vue-tsc --build`.
- **Fix:** Typed the Promise explicitly as `Promise<void>` so `resolve` narrows to `() => void`.
- **Files modified:** `src/components/slides/__tests__/EditSlideDrawer.test.ts`
- **Commit:** `bc1bfb2`

### Process deviation (documented, not a Rule 1-4 fix)

**Task 1 and Task 3 code were authored together, in one component build.** The plan specifies `tdd="true"` per task with its own RED→GREEN cycle. Because `EditSlideDrawer.vue` is a single, cohesive Vue SFC, and Task 3's write/debounce/status logic is threaded through the same template (the label/notes fields, the status span in the header) that Task 1's shell defines, writing the shell first with placeholder-only fields and then re-opening the same file minutes later to bolt on live-apply logic would have produced a messier diff with no functional benefit. Task 1's own RED→GREEN cycle was followed exactly as specified (`871e0cf` test, `9decb1c` feat — 14 shell-only tests, verified failing before the component existed, then passing). Task 3's dedicated test file (`2cbb987`) was written and run against the ALREADY-PRESENT Task 3 implementation; one of its assertions caught a genuine test-authoring bug (see Auto-fixed Issue 1 above) before landing, so the test suite was not simply rubber-stamping already-correct code — but Task 3 did not have its own committed RED state. All of Task 3's acceptance criteria have dedicated, currently-passing tests.

## Issues Encountered
None beyond the two Auto-fixed Issues above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `EditSlideDrawer.vue` and its two exposed extension points (the `isEditor`-gated field pattern, the fresh-base write helper's shape) are ready for 26-07 (per-kind Slide Text block, Edit in song/scripture links), 26-08 (Slide Audio section), and 26-09 (Duplicate/Delete footer) to extend in the same file.
- `SlidesTab.vue`'s exposed `selectSlideById` is ready for 26-09's Duplicate action to move the selection onto a freshly-created entry without further plumbing.
- Full verification: `npx vitest run src/components/slides/__tests__/EditSlideDrawer.test.ts src/components/slides/__tests__/SlidesTab.test.ts` — 63 passed, 0 failed. `npx vitest run src/components/slides/` — 184 passed, 0 failed. `npx vitest run src/` — 10 failed FILES (unchanged from the documented baseline: 8 under `.gsd/quarantine/worktrees/**`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 157 passed files, 3404 passed tests. `npm run type-check` reports 0 errors. `npm run build` succeeds.
- The two `<human-check>` items (nothing shifts underneath when the panel opens; the grid stays clickable and the drawer swaps in place on a real card click) are deferred to the milestone's batch human-verify per this plan's own `<verify>` block, matching every other plan in this phase.

---
*Phase: 26-edit-slide-drawer-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/components/slides/EditSlideDrawer.vue
- FOUND: src/components/slides/__tests__/EditSlideDrawer.test.ts
- FOUND: src/components/slides/SlidesTab.vue
- FOUND: src/components/slides/__tests__/SlidesTab.test.ts
- FOUND: .planning/phases/26-edit-slide-drawer-risk-medium/26-05-SUMMARY.md
- FOUND: 871e0cf (test)
- FOUND: 9decb1c (feat)
- FOUND: c75f6e3 (test)
- FOUND: a3a3096 (feat)
- FOUND: 2cbb987 (test)
- FOUND: bc1bfb2 (fix)
