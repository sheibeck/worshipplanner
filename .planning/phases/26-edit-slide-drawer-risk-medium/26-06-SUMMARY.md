---
phase: 26-edit-slide-drawer-risk-medium
plan: 06
subsystem: ui
tags: [vue, teleport, modal, slideGroups, reconciliation, r029]

# Dependency graph
requires:
  - phase: 26-edit-slide-drawer-risk-medium
    plan: 01
    provides: "SlideGroup.dismissedSignature field + dismissReconciliation() store action, ReconcileResult.songSwap"
  - phase: 26-edit-slide-drawer-risk-medium
    plan: 04
    provides: "PendingReconciliation widened with freshSignature/oldSongTitle/newSongTitle, reconciliationConfirmCopy pure builder"
provides:
  - "ReconcileConfirmModal.vue — the scrimmed, non-dismissible-by-click reconciliation confirm dialog (D-05..D-08)"
  - "SlideGrid.vue's passive notice turned into a way in, gated on write-capability"
  - "The two reconciliation writes wired: apply (replaceGroupSlides with the offered freshSignature + current base snapshot) and decline (dismissReconciliation with the same freshSignature)"
  - "Self-closing guard so the dialog cannot act on a pending update that has disappeared or a plan item that has changed"
affects: [26-07, 26-08, 26-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second, independently-teleported surface alongside the Edit Slide drawer — SAME auto-unmount discipline, opposite scrim/dismissal contract (scrimmed + non-dismissible-by-click here, vs. no-scrim on the drawer), each documented in-code as a deliberate divergence, not an oversight"
    - "Dialog visibility as `open && pending && planItem` (never `open` alone) — the render-conditional-on-subject guard that makes T-26-06-04 structurally impossible to violate, backed by parent-level watchers as the first line of defense"
    - "Write handlers close the dialog synchronously before awaiting the store call, then report a rejection via console.error and leave state alone — matching every other write handler already in SlideGrid.vue"

key-files:
  created:
    - src/components/slides/ReconcileConfirmModal.vue
    - src/components/slides/__tests__/ReconcileConfirmModal.test.ts
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "Modal prop named `planItem` (not `slot`) to avoid any confusion with Vue's native `<slot>` concept, even though 26-UI-SPEC.md and 26-04 call it 'the plan item'/'ServiceSlot' interchangeably"
  - "Both write handlers close the dialog (`showReconcileModal.value = false`) BEFORE awaiting the store call, not after — consistent with the optimistic-close pattern already used by every other write path in this file (add-slide, group music), and matches the 'closes the dialog after either choice' acceptance criterion regardless of the promise's outcome"
  - "A missing `freshSignature` on the pending update makes both write handlers no-op (return early) rather than throw — this is the SAME guard that satisfies Task 3's 'neither intent can still be triggered after a self-close' requirement, since a stale/disappeared pending update never has a synchronously-readable signature once it's gone"
  - "The `Review` affordance sits inside the existing amber notice div (not a new sibling block) to preserve the notice's own layout and border — the notice's wording and appearance are unchanged per the plan's explicit instruction"

patterns-established:
  - "Reconciliation dialog self-close discipline: two parent-level watchers (pendingForSelected going null; selectedSlot.id changing) PLUS the dialog's own render-conditional-on-pending guard — belt and suspenders for a race with no existing precedent in this codebase to copy"

requirements-completed: [R029, R018]

coverage:
  - id: D1
    description: "ReconcileConfirmModal.vue renders teleported to the document body, scrimmed (the scrim is inert — no click-to-dismiss), with Escape mapping to Dismiss and the listener removed on close/unmount"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/ReconcileConfirmModal.test.ts (13 tests: teleport+scrim render, closed/no-pending/no-planItem render nothing, inert scrim click, Escape decline, post-close Escape no-op, listener removal on unmount)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The dialog renders the shared reconciliationConfirmCopy(pending, planItem) verbatim — generic case naming the plan item, song-swap case naming both songs — and renders no diff, side-by-side, or per-slide list anywhere (D-06)"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/ReconcileConfirmModal.test.ts#renders the generic heading/body..., #renders the song-swap heading/body..., #renders no element listing the proposed slides individually"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly two action buttons render with the UI-SPEC's exact labels ('Apply source changes' / 'Dismiss'), each emitting its own distinct intent exactly once"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/ReconcileConfirmModal.test.ts#renders exactly two action buttons..."
        status: pass
    human_judgment: false
  - id: D4
    description: "SlideGrid.vue's passive notice keeps its wording/appearance and gains a Review affordance gated on isEditor (a viewer sees the notice, not the affordance); opens the dialog with the selected plan item's pending update and the plan item itself"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#renders the review affordance for an editor..., #opens the dialog with the pending update and the plan item..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Taking the source's version calls replaceGroupSlides with the plan item id, the pending update's proposed slides, its freshSignature, and the group's CURRENT slides as base snapshot; declining calls dismissReconciliation with the plan item id and the same freshSignature; neither path calls setGroupBedMedia; both close the dialog; a rejected write is reported and leaves state alone"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#taking the source's version calls..., #declining calls the decline action..., #neither choice calls the bed-media write, #closes the dialog after either choice, #reports a rejected apply write..., #reports a rejected dismiss write..."
        status: pass
    human_judgment: false
  - id: D6
    description: "The dialog self-closes (and makes no write) when the pending update for the selected plan item disappears, and self-closes when the selected plan item changes; after a self-close neither intent can still be triggered; a pending update disappearing leaves the group's slides and bed untouched"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#reconciliation dialog self-closes when its subject disappears (26-06 Task 3) — 4 tests; src/components/slides/__tests__/ReconcileConfirmModal.test.ts#closes itself and removes its Escape binding when the pending update is cleared while open"
        status: pass
    human_judgment: false
  - id: D7
    description: "D-06's no-diff trade-off's real-use sufficiency (whether the concrete counts/kinds wording suffices without a diff), and the multi-tab-race self-close backstop's real-world behavior across two actual browser tabs, are both judgment calls jsdom cannot assess — deferred to the milestone's batch human-verify per the plan's own verify block (workflow.verifier is false)"
    human_judgment: true
    rationale: "Requires triggering a real confirm-required update in the running app (reassigning a plan item's source content, and reproducing a two-tab race) and judging real-use sufficiency / real browser behavior — jsdom unit tests structurally cannot assess either. The plan's own <human-check> block defers this explicitly rather than skipping it."

duration: ~35min
completed: 2026-07-27
status: complete
---

# Phase 26 Plan 06: The Reconciliation Confirm Dialog Summary

**New `ReconcileConfirmModal.vue` — a scrimmed, non-dismissible-by-click confirm dialog reusing 26-04's copy builder — turns Phase 25's stuck passive banner into a working `Apply source changes` / `Dismiss` decision, closing the cross-phase debt Phases 24 and 25 both deferred (R029).**

## Performance

- **Duration:** ~35 min (task commits 00:34 -> 01:10, plus full-suite/type-check/build verification)
- **Started:** 2026-07-27 (approx, first file read)
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `ReconcileConfirmModal.vue` — a new, independently-teleported dialog component. Unlike the Edit Slide drawer (26-05, no scrim), this dialog IS scrimmed and the scrim is deliberately inert (no click-to-dismiss) — a decision-forcing confirmation, not a live-editing surface. Escape maps to Dismiss (the safe default, matching the app's existing Escape-as-cancel convention). Renders exactly the heading/body 26-04's `reconciliationConfirmCopy` builder produces — no diff, side-by-side, or per-slide list anywhere (D-06's explicit trade-away). Exactly two buttons: `Apply source changes` (accent) and `Dismiss` (bordered-neutral), each emitting its own intent carrying nothing derived.
- `SlideGrid.vue`'s Phase-25 passive notice gained its "way in": a `Review` button inside the existing notice, gated on `isEditor` (a viewer keeps the notice, never the affordance — T-26-06-02). Clicking it opens the dialog with the selected plan item's pending update and the plan item itself.
- The two intents are wired to the two writes named in 26-RESEARCH.md's flow table: `Apply` calls `replaceGroupSlides` with the pending update's `proposed` slides, its own `freshSignature` (never recomputed), and the group's CURRENT slides as the compare-and-swap base snapshot (CR-02 discipline, matching every other write path in this feature). `Dismiss` calls `dismissReconciliation` with the plan item id and the SAME `freshSignature` — which is exactly what makes a further, DIFFERENT source change re-prompt automatically (26-04). Neither path ever calls `setGroupBedMedia`.
- Task 3's self-close guard: two watchers in `SlideGrid.vue` close the dialog when the pending update for the selected plan item disappears (another tab resolved the same divergence) or when the selected plan item changes — backed by the dialog's own render-conditional-on-pending guard (`open && pending && planItem`, never `open` alone), so there is structurally no window in which its two actions could fire against a decision that no longer exists. No existing multi-tab-race pattern exists elsewhere in this codebase to copy (26-UI-SPEC.md's flagged backstop) — covered by explicit watchers and tests, not assumed to just work.

## Task Commits

Each task was committed atomically:

1. **Task 1: The confirmation dialog** - `72f8f25` (feat)
2. **Task 2: The notice becomes a way in, and the two choices become writes** - `6b66775` (feat)
3. **Task 3: The dialog cannot outlive the decision it is about** - `ead5a0c` (feat)

_No TDD RED/GREEN split beyond the plan's own `tdd="true"` tag — each task's test file was authored/extended alongside its production change in the same commit, matching the existing codebase convention already used by 26-01/26-04/26-05. All tests passed on first run against the production code, with no red-phase debugging needed._

## Files Created/Modified
- `src/components/slides/ReconcileConfirmModal.vue` (created) — the reconciliation confirm dialog: Teleport-to-body, scrimmed, Escape-as-decline, `reconciliationConfirmCopy`-driven heading/body, exactly two action buttons, render-conditional-on-pending guard
- `src/components/slides/__tests__/ReconcileConfirmModal.test.ts` (created) — 13 tests covering teleport/scrim rendering, inert scrim click, Escape decline + listener lifecycle, both copy variants, exactly-two-action wiring, the no-diff assertion, and the pending-cleared self-close backstop
- `src/components/slides/SlideGrid.vue` (modified) — `Review` affordance added to the existing notice (gated on `isEditor`); `ReconcileConfirmModal` mounted and wired to `onApplyReconciliation`/`onDismissReconciliation`; two Task 3 watchers guarding against a stale open dialog
- `src/components/slides/__tests__/SlideGrid.test.ts` (modified) — one Phase-25 test updated (see Deviations), plus 8 new tests in a `reconciliation confirm dialog (26-06 Task 2)` block and 4 new tests in a `reconciliation dialog self-closes... (26-06 Task 3)` block (suite grew from 56 to 64 tests)

## Decisions Made
- Modal prop named `planItem`, not `slot` — avoids any confusion with Vue's native `<slot>` concept in template code, even though the spec/summary prose calls it "the plan item" and "ServiceSlot" interchangeably.
- Both write handlers (`onApplyReconciliation`/`onDismissReconciliation`) set `showReconcileModal.value = false` BEFORE awaiting the store call, not after — matches the optimistic-close pattern every other write handler in this file already follows (`onAttachGroupMusic`, `onAddSlide`), and satisfies "closes the dialog after either choice" unconditionally rather than only on success.
- A pending update missing `freshSignature` makes both write handlers a silent no-op (guard-and-return) rather than throw. This single guard does double duty: it is also exactly what makes Task 3's "neither intent can still be triggered after a self-close" true, since a pending update that has disappeared can never be read with a signature by the time either handler runs.
- The `Review` button lives INSIDE the existing amber notice `<div>` (as a flex sibling to the notice text), not as a new block below it — keeps the notice's established border/background/spacing exactly as Phase 25 shipped it, per the plan's explicit "keep its current wording and its current appearance" instruction.

## Deviations from Plan

None outside ordinary, plan-anticipated test maintenance — all `must_haves.truths`, both `must_haves.artifacts`, and every `must_haves.prohibitions` were honored:

- **[Expected test update, not a deviation]** `SlideGrid.test.ts`'s pre-existing Phase 25 test `renders no apply, reject or confirm control alongside the notice` asserted `wrapper.find('[data-testid="slide-grid-reconciliation-notice"] button').exists()).toBe(false)` — the literal opposite of what this plan's Task 2 explicitly instructs ("Make the existing notice actionable"). Renamed to `renders no inline apply/dismiss wording alongside the notice — those live in the reconciliation dialog (26-06)` and updated to assert the `Review` affordance IS present while the literal words "apply"/"dismiss" still never appear beside the notice itself (those labels live only inside the teleported dialog, which is not inside `wrapper.text()`'s own render tree). This is the exact test-contract change the plan's own file list (`SlideGrid.test.ts` as a file this plan modifies) anticipated, not an unplanned deviation.
- No diff, side-by-side, or per-slide list was built anywhere (D-06) — verified by an explicit test asserting no proposed-entry id ever appears in the rendered dialog and that zero `<li>` elements exist.
- No song title or divergence value was re-derived in either component — the dialog reads only `reconciliationConfirmCopy(pending, planItem)` (26-04's pure builder), and both writes use `pending.freshSignature` verbatim, never recomputed.
- The dialog was never placed inside the Edit Slide drawer — it is `SlideGrid.vue`'s own mounted component, group-level per D-05.
- Neither write path calls `setGroupBedMedia` — verified by an explicit test after each choice.
- No third action, remind-me-later, or decline expiry was added — exactly `Apply source changes` and `Dismiss`.

## Issues Encountered
None — every test passed against the production code on first run; no red-phase failures or debugging iterations were needed for any of the three tasks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

R029's cross-phase debt is now fully closed: a group whose source content changed (a plan item that gained a passage or a deck after hand-added slides) is no longer stuck behind Phase 25's passive banner. The banner now offers a real, group-level decision, backed by 26-01's durable decline field and 26-04's divergence-tracking/copy data, applied here through 26-06's dialog and its two wired writes.

26-07 (audio), 26-08 (text), and 26-09 (duplicate) all build on the same Edit Slide drawer 26-05 shipped and are unaffected by this plan's changes — this plan touched only `SlideGrid.vue` and its own new dialog component, never the drawer.

D-06's no-diff trade-off's real-use sufficiency, and the self-close guard's real behavior across two actual browser tabs, remain deferred to the milestone's batch human-verify (workflow.verifier is false) — see the plan's own `<human-check>` block, restated in this SUMMARY's `coverage` D7 entry rather than silently skipped.

No blockers. Verification (full suite, type-check, build) all green — see Self-Check below.

## Self-Check: PASSED

Both created files (`src/components/slides/ReconcileConfirmModal.vue`, `src/components/slides/__tests__/ReconcileConfirmModal.test.ts`) and both modified files (`src/components/slides/SlideGrid.vue`, `src/components/slides/__tests__/SlideGrid.test.ts`) confirmed present on disk. All 3 task commits (`72f8f25`, `6b66775`, `ead5a0c`) confirmed present in `git log`. `npx vitest run src/components/slides/` — 10 files, 210 tests, all passed. Full suite (`npx vitest run src/`) matched the 10-file baseline exactly (10 failed / 158 passed files, 3441 passed / 40 failed / 18 skipped tests — failures are all pre-existing `.gsd/quarantine/worktrees/**` + `RosterView.test.ts` + `storage.rules.test.ts`, none newly introduced). `npm run type-check` = 0 errors. `npm run build` succeeded.
