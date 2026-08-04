---
phase: 36-ui-rework-service-order-contextual-action-bars
plan: 01
subsystem: ui
tags: [vue, slide-grid, drop-target, accessibility, r053]

requires:
  - phase: 34-service-editor-consolidation-and-lifecycle-lock
    provides: "SlideGrid.vue's merged group-media panel (34-11, testid slide-grid-group-media-panel)"
provides:
  - "SlideDropTarget with a clickable prop and browse emit, keyboard-accessible (role=button, Enter/Space parity)"
  - "SlideGrid with the separate ⇪ Import into this group button deleted; both drop-tile instances wired as the click-to-import affordance"
affects: [36-02, 36-03, 36-04, 36-05]

tech-stack:
  added: []
  patterns:
    - "Click-to-browse affordance folded into an existing drop target rather than a sibling button — parent binds :clickable to its own mutation gate, never to the child's own media-write gate, so the click path inherits exactly the deleted control's authorization surface"

key-files:
  created: []
  modified:
    - src/components/slides/SlideDropTarget.vue
    - src/components/slides/__tests__/SlideDropTarget.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "SlideDropTarget's clickable prop is independent of audioOnly — the component itself does not couple them; SlideGrid is the sole place that binds :clickable=\"canMutateGroup\" (never canWriteGroupMedia), which is what makes a song group's tile non-clickable"
  - "＋ Add slide's class string is carried over byte-for-byte, unchanged, per the UI-SPEC's declared pre-existing padding exception"
  - "Group music and group background stay in the merged 34-11 panel, untouched"

requirements-completed: [R053]

coverage:
  - id: D1
    description: "SlideDropTarget gains a clickable variant: default renders exactly as before (no role/tabindex/aria-label, click emits nothing); clickable=true adds role=button, tabindex=0, aria-label, and click/Enter/Space each emit browse exactly once"
    requirement: "R053"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideDropTarget.test.ts#clickable variant (Phase 36 R053)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Caption gains a third branch ordered audioOnly-first, so the click-to-browse clause never leaks onto a song group's audio-only tile"
    requirement: "R053"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideDropTarget.test.ts#clickable variant (Phase 36 R053)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The separate ⇪ Import into this group button is deleted from SlideGrid's source entirely (not hidden); both SlideDropTarget instances (cards-present and empty-state) are wired with :clickable=\"canMutateGroup\" and @browse=\"openImportModal\""
    requirement: "R053"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#36-01 phase invariant — moved controls only, nothing re-implemented"
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#import action and PPTX/image append (25-07 Task 3, relocated onto the tile by 36-01)"
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#R054 — song groups are read-only"
        status: pass
    human_judgment: false
  - id: D4
    description: "＋ Add slide keeps its exact position, testid, gate and class attribute byte-for-byte; the merged group-media panel (music + background) and the entire drag path are unchanged"
    requirement: "R053"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#36-01 phase invariant — moved controls only, nothing re-implemented"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty non-song editable group's second copy line updates from 'Add a slide, or drop a file below.' to 'Add a slide, or click below to import.'"
    requirement: "R053"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#renders no reconciliation notice or review affordance for any group state (R048) [and the zero-cards empty-state test in the same describe block]"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-03
status: complete
---

# Phase 36 Plan 01: Drop-Zone-as-Import Affordance Summary

**`SlideDropTarget` gains a keyboard-accessible `clickable` variant and `SlideGrid` deletes its separate `⇪ Import into this group` button, wiring both drop-tile instances (`:clickable="canMutateGroup"`, `@browse="openImportModal"`) as the click-to-import affordance — R053, minus the button that duplicated it.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-03T23:14:00-04:00 (approx, first Read)
- **Completed:** 2026-08-03T23:27:00-04:00 (approx, last commit)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `SlideDropTarget.vue` gains a `clickable` prop (default `false`, byte-identical default rendering) and a `browse` emit, with `role="button"`/`tabindex="0"`/`aria-label` and click/Enter/Space activation parity, only when `clickable` is true.
- The caption gains a third branch — `audioOnly` first, then `clickable`, then the existing fallback — so the click-to-browse clause never leaks onto a song group's audio-only tile.
- `SlideGrid.vue`'s separate import button (`data-testid="slide-grid-import"`) is deleted from source entirely, not hidden. Both `SlideDropTarget` instances (cards-present and empty-state) are wired with `:clickable="canMutateGroup"` (never `canWriteGroupMedia`) and `@browse="openImportModal"`.
- `＋ Add slide` is untouched — same position, same testid, same `v-if="canMutateGroup"` gate, same class string carried over byte-for-byte, asserted with a single string-equality test.
- The merged group-media panel (music + background, from 34-11) and the entire grid-wide drag-and-drop path (dragenter/dragover/dragleave depth counter, files-only guard, `onGridDrop`) are provably unchanged.
- Empty-state second line for the editor-and-unlocked, non-song branch updates its verb from "drop" to "click below to import."; the song-group and locked-service branches keep their exact pre-phase strings.

## Task Commits

Each task was committed atomically:

1. **Task 1: SlideDropTarget gains a clickable variant with keyboard parity** - `0e19345` (feat)
2. **Task 2: SlideGrid drops the import button and wires the tile as the import affordance** - `ed2d288` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `src/components/slides/SlideDropTarget.vue` - `clickable` prop, `browse` emit, `role`/`tabindex`/`aria-label` bindings, three-branch caption, updated head comment
- `src/components/slides/__tests__/SlideDropTarget.test.ts` - 8 new tests covering the clickable variant, keyboard parity, and caption branching
- `src/components/slides/SlideGrid.vue` - deleted the `⇪ Import into this group` button block; both `SlideDropTarget` instances gain `:clickable="canMutateGroup"` and `@browse="openImportModal"`; empty-state copy line updated
- `src/components/slides/__tests__/SlideGrid.test.ts` - updated/added tests (see Test Edit Classification below)

## Decisions Made
- `SlideDropTarget`'s own `clickable` prop is applied independently of `audioOnly` — the component does not itself gate clickability by whether the group is a song group. The non-clickable-on-song-group behavior is entirely `SlideGrid`'s doing, via `:clickable="canMutateGroup"` (which composes `isSongGroup` into its own definition). This keeps the component reusable and the gating logic in exactly one place (`canMutateGroup`), matching the plan's key_link.
- No restyle of `＋ Add slide` — its `px-2.5 py-1.5` padding stays exactly as declared, per the UI-SPEC's explicit pre-existing exception.
- The merged group-media panel (34-11) was not touched — R053's "Add music to this group" clause is superseded per the UI-SPEC's Finding 2, and this plan's scope was confirmed to be only the drop-zone/import-button change.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the existing drag-and-drop machinery, `openImportModal()`'s guard, and the merged media panel required no changes beyond what the plan specified.

## Issues Encountered

None.

## Test Edit Classification (moved-control vs behavior-change)

Per this plan's `<test_edit_discipline>` requirement, every edit to `SlideGrid.test.ts` is classified below. All are **moved-control** edits — the affordance relocated from a dedicated button to the existing drop tile, but no gating, guard, or handler behavior changed (`openImportModal()`'s own `canMutateGroup` check is byte-unchanged).

| Edit | Classification | Why |
|---|---|---|
| "renders the import action for an editor, not for a viewer, and opens the modal on click" → split into "the separate import button no longer exists...", "an editor... gets a clickable tile; emitting browse... opens the... modal", "a viewer renders no drop tile at all" | **moved-control** | Same editor/viewer split, same modal-open outcome; only the trigger element changed from a button click to a tile `clickable` prop + `browse` emit |
| "closes the modal on confirmed" — trigger changed from `.trigger('click')` on the deleted button to `$emit('browse')` on the tile | **moved-control** | Identical downstream assertion (`props('open')` toggles true then false via `confirmed`); only how the modal is opened changed |
| "renders no Add slide or Import button for a song group..." → extended with `clickable` prop assertions | **moved-control** | The button-testid assertions are unchanged (still asserting absence); the added `clickable` assertions express the same "import affordance unavailable for a song group" fact through the tile instead of a button |
| "removes ＋ Add slide, ⇪ Import and the drop tile" (locked-service describe) — title/comment updated, assertions unchanged | **moved-control** (no code change) | The `slide-grid-import` testid assertion is kept unchanged as a regression guard that the deleted button never resurfaces; nothing about locked-service behavior changed |
| Empty-state copy assertion ("Add a slide, or drop a file below." → "Add a slide, or click below to import.") | **moved-control** | Copy text updated per the UI-SPEC's Copywriting Contract, tracking the button-to-tile relocation; the condition under which this line renders is unchanged |
| New: "36-01 phase invariant — moved controls only, nothing re-implemented" describe block (byte-for-byte class, source-deletion grep, media panel, tile-last-child ordering) | **new coverage, not an edit** | Added to directly assert this plan's `<phase_recording_of_deliberate_gaps>`-adjacent invariant (moves and reorganizes controls; does not re-implement handlers) |

No test edit in this plan was a behavior-change edit.

## Deliberate Gaps Recorded This Phase (restated verbatim from 36-01-PLAN.md)

1. **There is no `36-RESEARCH.md`, and therefore no `36-VALIDATION.md`.** Phase 36 was planned with `--skip-research` because `ROADMAP.md`'s own research flag for this phase reads *"standard/UI-heavy — no deep technical uncertainty"*, and the approved `36-UI-SPEC.md` supplies the design contract that research would otherwise have produced. **Validation criteria are authored inline instead**: every task in every Phase 36 plan carries an `<automated>` command, and no task depends on a test file that a prior task did not create.

2. **There is no `36-PATTERNS.md`.** `36-CONTEXT.md`'s "Verified starting state" table (file:line evidence for every control this phase moves) and `36-UI-SPEC.md`'s region-by-region enumeration together cover what a patterns document would have supplied. Both are cited by `<read_first>` on the tasks that need them.

3. **Plan count.** Project granularity is `coarse` (normally 1–3 plans). Phase 36 uses **5** because it spans four requirements across five source files, and because `ServiceEditorView.vue` (3,690 lines) is touched by R067, R068 and R069 — those three cannot run in parallel, so collapsing them into fewer plans would produce 5–6 task plans in the project's largest file. Same justification shape as Phase 37's recorded 6-plan departure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SlideDropTarget`'s `clickable`/`browse` contract is available for reuse if a later Phase 36 plan needs it (none currently planned to).
- `SlideGrid.vue`'s `openImportModal()`, `canMutateGroup`, and the merged group-media panel are all untouched and ready to be read/relied upon by 36-02..36-05, which touch `ServiceEditorView.vue`/`SlidesTab.vue` and do not further modify `SlideGrid.vue`'s import surface.
- No blockers. `npm run type-check` clean; targeted suite (`SlideDropTarget.test.ts` + `SlideGrid.test.ts`) 128/128 passing; full `npx vitest run --dir src` 2436/2445 passing with the failing set at the documented 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — no regression introduced.

---
*Phase: 36-ui-rework-service-order-contextual-action-bars*
*Completed: 2026-08-03*

## Self-Check: PASSED

All modified/created files verified present on disk; both task commits (`0e19345`, `ed2d288`) verified present in `git log`.
