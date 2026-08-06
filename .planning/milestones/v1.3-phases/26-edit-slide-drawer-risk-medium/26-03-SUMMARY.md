---
phase: 26-edit-slide-drawer-risk-medium
plan: 03
subsystem: ui
tags: [vue, emit-chain, service-editor, scripture-editor, slides-tab]

# Dependency graph
requires:
  - phase: 26-01
    provides: SlideGroup / slideGroups data-model gaps (unrelated to this plan's contract, but same phase)
  - phase: 26-02
    provides: the "Edit in song" query-param navigation convention (a sibling D-15 affordance for a different slide kind)
provides:
  - "ServiceEditorView.vue: expandScriptureEditor(index) — an expand-only sibling of the existing strict-toggle toggleScriptureEditor, guarded against an out-of-range index or a non-scripture plan item"
  - "ServiceEditorView.vue: handleNavigateToScriptureEditor(index) — validates the index/kind, switches to the Music tab, expands the item, then scrolls its panel into view via a new data-scripture-panel-index attribute"
  - "SlidesTab.vue: navigate-to-scripture-editor event + exposed requestEditInScripture(), emitting the selected plan item's raw array index"
affects: [26-05 (the Edit Slide drawer that will render the 'Edit in scripture' affordance), 26-07 (wires the drawer's link to SlidesTab's exposed requestEditInScripture)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Expand-only sibling function alongside an existing strict-toggle, rather than reusing/parametrizing the toggle — keeps the toggle button's own close behaviour provably unaffected"
    - "Validate-before-touching-state guard: an unhonourable cross-component request (bad index, wrong kind) is a no-op before any tab switch or expansion state change, not partway through"
    - "Per-plan-item DOM attribute (data-scripture-panel-index) as a scroll-target seam, kept separate from the existing stable data-testid so existing tests selecting on the testid are undisturbed"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts

key-decisions:
  - "Verified 26-RESEARCH.md Assumptions Log A2 against the source: toggleScriptureEditor (line 1333) is a strict add-or-remove toggle. Left it completely unchanged and added a new expandScriptureEditor sibling instead of reusing/guarding the toggle itself — reusing it would close an already-open editor on a second 'Edit in scripture' request, which is the exact bug the plan's must_haves prohibit."
  - "The request handler validates the requested index against the current plan item list AND its kind (slot.kind === 'SCRIPTURE') before switching tabs or touching expansion state at all (T-26-03-01) — an unhonourable request changes nothing, including the active tab."
  - "The relay emits the plan item's RAW array index (SlidesTab's existing selectedSlotArrayIndex computed), not its plan position — the two computeds are already documented in SlidesTab.vue as capable of diverging, and the array index is what both the page's expandedScriptureSlots set and the assembled slideshow are keyed on."
  - "requestEditInScripture is added to SlidesTab's existing defineExpose block (alongside selectedSlotId/selectedSlideId) rather than wired only internally, so 26-07's drawer can call it directly without a second round of plumbing."
  - "scrollIntoView is invoked with optional chaining (panel?.scrollIntoView?.(...)) since jsdom does not implement it — this keeps the test suite from needing a global polyfill while remaining a real call in a browser."

patterns-established:
  - "Emit-chain plumbing for cross-subtree requests: a page-level local-state action (tab switch + per-item expansion) reachable only via a declared event bubbling up through a prop-down/emit-up subtree, never via reaching into page state from below."

requirements-completed: [R033, R018]

coverage:
  - id: D1
    description: "A request naming a scripture plan item switches the service editor to the Music tab and expands that item's scripture editor, without touching an unrelated item"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > ServiceEditorView - Edit in scripture plumbing (Phase 26-03) > switches to the Music tab and expands the requested scripture plan item's editor"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > ServiceEditorView - Edit in scripture plumbing (Phase 26-03) > expanding one plan item's editor never expands or collapses another's"
        status: pass
    human_judgment: false
  - id: D2
    description: "Asking twice never collapses the editor — a repeated request is a no-op, not a toggle — while the existing hand-operated button still opens then closes on alternate clicks"
    requirement: R018
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > ServiceEditorView - Edit in scripture plumbing (Phase 26-03) > asking twice never collapses the editor — the second request is a no-op, not a toggle"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > ServiceEditorView - Edit in scripture plumbing (Phase 26-03) > the existing hand-operated button still opens then closes on alternate clicks"
        status: pass
    human_judgment: false
  - id: D3
    description: "An out-of-range index or a non-scripture plan item is a no-op that does not throw"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > ServiceEditorView - Edit in scripture plumbing (Phase 26-03) > an out-of-range index changes nothing and does not throw"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > ServiceEditorView - Edit in scripture plumbing (Phase 26-03) > a request naming a non-scripture plan item changes nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "SlidesTab relays a request to reveal the selected plan item's scripture editor upward, emitting the raw array index (not plan position), emitting nothing when unselected, no new store/composable import"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts > \"Edit in scripture\" relay (Phase 26-03, D-15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Once 26-07 wires the drawer's affordance to requestEditInScripture, the end-to-end flow (open drawer → follow link → tab switches → editor open and in view → follow again → still open) needs a human pass"
    verification: []
    human_judgment: true
    rationale: "This plan only builds the plumbing; the drawer link itself doesn't exist until 26-05/26-07. The plan's own <verify><human-check> defers this to the milestone's batch human-verify."

# Metrics
duration: 25min
completed: 2026-07-27
status: complete
---

# Phase 26 Plan 03: Edit-in-scripture cross-component plumbing Summary

**Expand-only scripture-editor entry point on ServiceEditorView plus a SlidesTab → ServiceEditorView emit-chain relay, both keyed on the plan item's raw array index (D-15)**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-27
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `expandScriptureEditor(index)` to `ServiceEditorView.vue` — an expand-only sibling of the existing strict-toggle `toggleScriptureEditor`, guarded so an invalid index or non-scripture plan item is a no-op.
- Added `handleNavigateToScriptureEditor(index)`, which validates the request before touching any state, switches to the Music tab, expands the requested item, then brings its panel into view (via a new `data-scripture-panel-index` attribute) without reaching inside the scripture editor component itself.
- Declared `navigate-to-scripture-editor` on `SlidesTab.vue` and exposed `requestEditInScripture()`, which emits the selected plan item's raw array index (not its plan position) — reachable now by this plan's own tests, and by the drawer in 26-07 without further plumbing.
- Verified 26-RESEARCH.md Assumptions Log A2's flagged risk against the source: `toggleScriptureEditor` is indeed a strict toggle, confirming the plan's decision to add a sibling rather than reuse it.

## Task Commits

Each task followed RED → GREEN:

1. **Task 1: An expand-only scripture-editor entry point and its request handler**
   - `3379b9d` (test) — failing tests for tab-switch, expand-only idempotency, existing toggle unchanged, out-of-range/non-scripture no-ops, and cross-item isolation
   - `e84776d` (feat) — `expandScriptureEditor` + `handleNavigateToScriptureEditor` + `data-scripture-panel-index` attribute + listener binding on the mounted `SlidesTab`
2. **Task 2: The Slides tab relays the request upward**
   - `98475db` (test) — failing tests for the emitted event, array-vs-position index, no-op when unselected, and exposure
   - `1655983` (feat) — `navigate-to-scripture-editor` event + `requestEditInScripture()` + `defineExpose` addition

**Plan metadata:** (this commit) — SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md

## Files Created/Modified
- `src/views/ServiceEditorView.vue` — new `expandScriptureEditor`/`handleNavigateToScriptureEditor` functions, `data-scripture-panel-index` attribute on the expanded panel, new listener on the mounted `SlidesTab`
- `src/views/__tests__/ServiceEditorView.test.ts` — new `describe('ServiceEditorView - Edit in scripture plumbing (Phase 26-03)')` block, 6 tests
- `src/components/slides/SlidesTab.vue` — new `navigate-to-scripture-editor` emit declaration, `requestEditInScripture()`, updated header comment, `defineExpose` addition
- `src/components/slides/__tests__/SlidesTab.test.ts` — new `describe('"Edit in scripture" relay (Phase 26-03, D-15)')` block, 4 tests

## Decisions Made
- Left `toggleScriptureEditor` byte-for-byte unchanged and added a new sibling function rather than parametrizing or reusing it — the research's verified-wrong assumption (A2) made clear that any shared-function approach risks a close-on-second-click regression.
- Guard order matters: index/kind validation happens strictly before any state mutation (including the tab switch), so an unhonourable request is a true no-op, not a partial one.
- Used `panel?.scrollIntoView?.(...)` (double optional chaining) rather than a global jsdom polyfill, since `scrollIntoView` is unimplemented in the test environment and the plan's contract is "bring into view," not "must always call a real scroll API in tests."

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>`/`<acceptance_criteria>` blocks; no Rule 1-4 fixes were needed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 26-05 (the Edit Slide drawer) and 26-07 (wiring the drawer's "Edit in scripture" affordance) can call `SlidesTab`'s exposed `requestEditInScripture()` directly — no further plumbing required.
- Full verification run: `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/components/slides/__tests__/SlidesTab.test.ts` — 69 passed, 0 failed (18 skipped, unrelated). Full `npx vitest run src/` fails in exactly the 10 baseline FILES (8 under `.gsd/quarantine/worktrees/**` + `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`) — no growth past baseline. `npm run type-check` reports 0 errors. `npm run build` succeeds.
- The end-to-end human-verify (open a service, follow the drawer's "Edit in scripture" link, confirm tab switch + expand + in-view, follow again and confirm still open) is deferred to the milestone's batch human-verify per this plan's own `<human-check>`, since the drawer itself doesn't exist until 26-05/26-07.

---
*Phase: 26-edit-slide-drawer-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/components/slides/SlidesTab.vue
- FOUND: .planning/phases/26-edit-slide-drawer-risk-medium/26-03-SUMMARY.md
- FOUND: 3379b9d (test)
- FOUND: e84776d (feat)
- FOUND: 98475db (test)
- FOUND: 1655983 (feat)
