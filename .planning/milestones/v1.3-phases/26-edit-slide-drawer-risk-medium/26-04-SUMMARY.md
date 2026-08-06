---
phase: 26-edit-slide-drawer-risk-medium
plan: 04
subsystem: data-model
tags: [vue, composables, slideGroups, reconciliation, pure-functions]

# Dependency graph
requires:
  - phase: 26-edit-slide-drawer-risk-medium
    plan: 01
    provides: "ReconcileResult.songSwap { oldSongId, newSongId }, SlideGroup.dismissedSignature field + dismissReconciliation() store action"
provides:
  - "PendingReconciliation widened (both the composable's own copy and the slides subtree's local mirror) with freshSignature, oldSongTitle, newSongTitle"
  - "Durable D-07 decline suppression: a confirm-required outcome whose divergence equals the group's recorded declined value never surfaces"
  - "reconciliationConfirmCopy — the pure, spec-verbatim heading/body builder for the reconciliation confirm dialog"
affects: [26-05, 26-06, 26-07, 26-08, 26-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PendingReconciliation's two deliberately-duplicated copies (composable + slides-subtree mirror) widened identically, in lockstep, never collapsed into one import"
    - "Song titles resolve at the composable layer (where the catalogue is in scope), never in the pure reconciler — mirrors 26-01's songSwap ids-only precedent"
    - "Decline suppression compares against dismissedSignature only, never sourceSignature — the two fields mean different things (last DECLINED vs. last WRITTEN)"
    - "Dialog copy assembled the same way ServiceEditorView's existing delete-warning builder assembles its media clause: only non-zero kinds, joined, whole clause dropped when nothing is at risk"

key-files:
  created: []
  modified:
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts

key-decisions:
  - "A song-title lookup miss falls back to the generic label 'Unknown Song' rather than an id or empty string — a dialog that says 'song' for an unknown one is safer than a raw identifier"
  - "freshSignature is stored once, at the moment the confirm-required outcome is decided, and never recomputed later — Apply must write what was actually offered"
  - "reconciliationConfirmCopy takes the pending update AND the plan item's ServiceSlot (for the generic case's slotDisplayTitle) rather than trying to derive the title from the pending shape alone"

patterns-established:
  - "Pure dialog-copy builders live in slideDisplay.ts alongside the display helpers they extend, taking the widened PendingReconciliation shape plus whatever additional context (here, ServiceSlot) the copy needs"

requirements-completed: [R029, R018]

coverage:
  - id: D1
    description: "A confirm-required reconciliation stores the current divergence (freshSignature) on the pending entry, and a song-identity-swap outcome additionally stores both song titles resolved from the catalogue (falling back to a generic label on a miss); a non-song confirm stores no titles; the automatic-apply path is unaffected"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#PendingReconciliation widening — divergence and song titles (26-04 Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A confirm-required outcome whose divergence equals the group's recorded declined value (dismissedSignature) is suppressed entirely — no pending entry, no write, group untouched; a group with no decline or a differing decline surfaces normally; a further source change after a matching decline re-surfaces automatically"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#durable decline suppression (26-04 Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "reconciliationConfirmCopy reproduces 26-UI-SPEC.md's generic and song-swap copy tables verbatim, with correct singular/plural slide counts, a media clause naming only non-zero kinds (dropped entirely when neither is at risk), and a fallback to the proposed-slide count when loss data is missing"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#reconciliationConfirmCopy"
        status: pass
    human_judgment: false
  - id: D4
    description: "The no-diff trade-off (D-06) — whether the concrete counts-and-kinds wording is sufficient without a source-vs-group diff — is a real-use judgment call, deferred to the milestone's batch human-verify per the plan's verify block"
    human_judgment: true
    rationale: "Requires triggering a real confirm-required update in the running app and judging whether the sentence alone is enough to decide confidently — jsdom unit tests cannot assess that; workflow.verifier is false so this is deferred, not skipped."

duration: ~20min
completed: 2026-07-26
status: complete
---

# Phase 26 Plan 04: Reconciliation Dialog Data + Copy Summary

**Widened `PendingReconciliation` (both copies) with the divergence value and resolved song titles, added D-07's durable per-divergence decline suppression, and extracted the reconciliation confirm dialog's exact warning wording into a pure, unit-tested builder.**

## Performance

- **Duration:** ~20 min (task commits 23:26:xx -> 23:31:xx)
- **Started:** 2026-07-26 (approx, first file read)
- **Completed:** 2026-07-26
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `PendingReconciliation` widened with `freshSignature?`, `oldSongTitle?`, `newSongTitle?` on BOTH the composable's own declaration and the slides subtree's deliberately-duplicated local mirror in `slideDisplay.ts` — kept structurally identical on purpose, since nothing under `src/components/slides/` may import the assembly composable.
- The confirm-required apply branch now stores the outcome's already-computed `freshSignature` instead of dropping it, and resolves both old/new song titles from the song catalogue store (already in scope at this layer) on a song-identity-swap outcome — falling back to `'Unknown Song'` on a catalogue miss rather than an id or empty string. The pure reconciler resolves nothing.
- Durable decline suppression (D-07): a confirm-required outcome whose `freshSignature` equals the group's `dismissedSignature` is skipped entirely before it ever reaches the pending map — no pending entry, no write, and the group's slides/bed/`sourceSignature` stay untouched. Compared strictly against `dismissedSignature`, never `sourceSignature`. A further source change naturally produces a different `freshSignature`, so re-prompting needs no extra code, timestamp, or counter.
- `reconciliationConfirmCopy` added to the pure `slideDisplay.ts` module — reproduces 26-UI-SPEC.md's generic and song-swap copy tables verbatim (heading + body), assembles the media clause the same way `ServiceEditorView.vue`'s existing delete-warning builder does (only non-zero kinds, comma-joined, dropped entirely when nothing is at risk), handles singular/plural slide counts, and falls back to the proposed-slide count when `loss` is missing. No diff, per-slide list, or before-and-after is built anywhere (D-06).

## Task Commits

Each task was committed atomically:

1. **Task 1: Carry the divergence and both song names to the pending update** - `80eb5b2` (feat)
2. **Task 2: A declined update stops surfacing, until the source changes again** - `a55d505` (feat)
3. **Task 3: The warning wording, as pure functions** - `26dc6d4` (feat)

_No TDD RED/GREEN split beyond the plan's own `tdd="true"` tag — each task's test file was extended alongside its production change in the same commit, matching the existing codebase convention already used by 26-01._

## Files Created/Modified
- `src/composables/useSlideshowAssembly.ts` — `PendingReconciliation` widened; `resolveSongTitle` helper; `applyReconciliationOutcomes` now stores `freshSignature`/song titles and skips an already-declined divergence
- `src/composables/__tests__/useSlideshowAssembly.test.ts` — 5 new tests for the widened pending shape + song-title resolution, 5 new tests for durable decline suppression (10 new tests total; suite grew from 33 to 43 tests)
- `src/components/slides/slideDisplay.ts` — `PendingReconciliation` mirror widened identically; new `reconciliationConfirmCopy` exported builder
- `src/components/slides/__tests__/slideDisplay.test.ts` — 8 new tests covering the generic case, the song-swap variant, singular/plural, media-clause combinations, the missing-loss-data fallback, and a no-diff-content guard (suite grew from 24 to 32 tests)

## Decisions Made
- `resolveSongTitle` falls back to the literal string `'Unknown Song'` on a catalogue miss — chosen over an id or empty string per the plan's explicit requirement that the dialog never render a raw identifier or empty quotes.
- `reconciliationConfirmCopy(pending, slot)` takes the `ServiceSlot` as a second parameter (needed for the generic case's `slotDisplayTitle`) rather than trying to derive a title from the pending shape alone, which carries no such field for the non-song-swap case.
- The suppression guard was written and tested to compare `outcome.freshSignature === outcome.group.dismissedSignature` with an explicit `dismissedSignature !== undefined` guard, so an absent decline (the common case, per D-19: no migration needed) never accidentally matches an `undefined === undefined` freshSignature comparison.

## Deviations from Plan

None - plan executed exactly as written. All six `must_haves.truths` and both `must_haves.artifacts` were honored, and every `must_haves.prohibition` was respected:
- Nothing under `src/components/slides/` imports the assembly composable — the local `PendingReconciliation` mirror was widened in place instead.
- No song title is resolved inside `slideGroupMaterializer.ts` — titles resolve only in `useSlideshowAssembly.ts`.
- No diff, side-by-side, or per-slide list was built anywhere — `reconciliationConfirmCopy` renders only counts and kinds, verified by an explicit test asserting no proposed-entry id ever appears in the rendered copy.
- Suppression compares only against `dismissedSignature`, never `group.sourceSignature`.
- No warning wording was invented — both copy variants were transcribed verbatim from 26-UI-SPEC.md's two copy tables, character for character (including the exact `{N} slide{s} you added, including {mediaClause}` structure and its zero-media fallback).

## Issues Encountered
- One test attempted to simulate "a further source change after a decline" by reassigning the mocked scripture store's backing array (`scriptureState.readings = [...]`) mid-test. Because the Pinia store mock captures a snapshot reactive-wrapped array at composable-setup time, reassigning the OUTER test variable afterward is invisible to the already-constructed mock. Fixed by mutating the existing array's nested `text` field in place instead, which correctly propagates through Vue's reactivity (same underlying raw object, same cached proxy). This was a test-authoring correction, not a production-code issue — logged here rather than as a formal deviation since no plan behavior or acceptance criterion was affected.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

`PendingReconciliation` now carries everything the Phase 26 reconciliation confirm dialog (26-05 onward) needs to render and apply:
- `freshSignature` for a correct `Apply` write (no recomputation against possibly-changed state).
- `oldSongTitle`/`newSongTitle` for the D-08 song-swap copy variant.
- `reconciliationConfirmCopy(pending, slot)` is ready to be called directly from the dialog component — no further data-shape work needed before 26-05 can build the actual modal UI.

The D-06 no-diff trade-off's real-use sufficiency is explicitly deferred to the milestone's batch human-verify (see coverage D4) — not silently assumed.

No blockers. Verification (full suite, type-check, build) all green — see Self-Check below.

## Self-Check: PASSED

All 4 modified files confirmed present on disk; all 3 task commits (`80eb5b2`, `a55d505`, `26dc6d4`) confirmed present in `git log`. Full suite (`npx vitest run src/`) matched the 10-file baseline exactly (10 failed / 156 passed files, 3385 passed / 38 failed / 18 skipped tests — failures are all pre-existing `.gsd/quarantine/worktrees/**` + `services.test.ts` (crypto.randomUUID, quarantined copy) + `RosterView.test.ts`). `npm run type-check` = 0 errors. `npm run build` succeeded.
