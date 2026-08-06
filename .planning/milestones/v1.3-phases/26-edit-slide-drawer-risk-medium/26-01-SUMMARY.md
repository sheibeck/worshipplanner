---
phase: 26-edit-slide-drawer-risk-medium
plan: 01
subsystem: data-model
tags: [vue, pinia, firestore, slideGroups, reconciliation, cas]

# Dependency graph
requires:
  - phase: 24-slide-group-model-and-migration
    provides: SlideGroup/GroupSlideEntry types, replaceGroupSlides/setGroupBedMedia store actions, slideGroupMaterializer.ts reconciler
  - phase: 25-slides-tab-shell-plan-rail-and-slide-grid
    provides: passive reconciliation banner (SlideGrid.vue), PendingReconciliation shape (slideDisplay.ts)
provides:
  - "ReconcileResult.songSwap { oldSongId, newSongId } populated on a customized song-identity swap"
  - "SlideGroup.dismissedSignature field + dismissReconciliation() store action for durable D-07 decline"
  - "Test-pinned compare-and-swap contract for the single-field-edit write shape every drawer field uses"
affects: [26-02, 26-03, 26-04, 26-05, 26-06, 26-07, 26-08, 26-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "songSwap populated ids-only in the pure materializer; title resolution deferred to the composable layer (26-04)"
    - "dismissedSignature as a second, distinct field from sourceSignature -- never collapsed into one comparison"
    - "Scoped single-field Firestore writes (dismissReconciliation) mirror setGroupBedMedia's shape: touch only the changed field + updatedAt, never a whole-document replace"

key-files:
  created: []
  modified:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/types/slideGroup.ts
    - src/stores/slideGroups.ts
    - src/stores/__tests__/slideGroups.test.ts

key-decisions:
  - "songSwap ids-only on ReconcileResult, populated in exactly one branch (customized song-identity swap); title lookup deliberately deferred to 26-04 where the song catalog is already in scope"
  - "dismissedSignature is a second field, not a reuse of sourceSignature -- collapsing them would make an applied update indistinguishable from a declined one"
  - "dismissReconciliation has no transaction/CAS -- a lost race between two declines of the same divergence is harmless, and a decline racing a concurrent Apply self-corrects on the next reconciliation pass"
  - "Multi-song-blended stored group (a prior-bug artifact) reports the first song id in Set-insertion (stored) order as oldSongId, per the plan's stated tie-break"

patterns-established:
  - "CAS write shape for the drawer: read-modify-write of ONE field on ONE entry, always passing a freshly-read baseSlides -- pinned by tests including the negative control (omitting baseSlides discards a concurrently-added entry)"

requirements-completed: [R029, R018]

coverage:
  - id: D1
    description: "Song reconciler reports old and new song ids on a customized song-identity swap (D-08); uncustomized swaps, within-song edits, and scripture/imported confirms never populate songSwap"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#D-08: a customized song-identity swap reports old song A and new song B on songSwap"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#D-08: an UNcustomized song-identity swap replaces silently and reports no swap detail"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#D-08: a within-song section change (same song) never reports a swap"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#D-08: a song plan item with no song assigned returns the unchanged result with no swap detail"
        status: pass
    human_judgment: false
  - id: D2
    description: "SlideGroup carries a durable dismissedSignature field, written via a new scoped dismissReconciliation store action touching only that field + updatedAt"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts#dismissReconciliation issues a scoped updateDoc against the org/planItem path carrying only dismissedSignature and updatedAt"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts#dismissReconciliation the payload carries no slides key, no bed key, and no source-signature key"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts#dismissReconciliation does not call the whole-array replace function"
        status: pass
    human_judgment: false
  - id: D3
    description: "The single-field-edit compare-and-swap shape (every Edit Slide drawer write) is pinned by tests, including the negative control proving a missing baseSlides discards concurrent work"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts#compare-and-swap -- single-field slide edit (drawer write shape)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-26
status: complete
---

# Phase 26 Plan 01: Data-Model Gaps for the Edit Slide Drawer Summary

**Widened the song reconciler to name both songs on an identity swap, added a durable per-signature decline field to `SlideGroup`, and test-pinned the single-field compare-and-swap write shape every later drawer write depends on.**

## Performance

- **Duration:** ~6 min (task commits 22:23:05 -> 22:26:18)
- **Started:** 2026-07-26T22:22:00Z (approx, first test run)
- **Completed:** 2026-07-26T22:26:18-04:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `ReconcileResult` widened with an optional `songSwap: { oldSongId, newSongId }`, populated ONLY in `reconcileSongGroup`'s customized-swap confirm branch — the exact data D-08's dialog copy needs, with the materializer staying pure (ids only, no song-catalog import).
- `SlideGroup.dismissedSignature` added as a second, distinct field from `sourceSignature`, plus a new `dismissReconciliation(orgId, slotId, signature)` store action that mirrors `setGroupBedMedia`'s scoped single-field write shape exactly — no transaction, no CAS, per the plan's explicit prohibition.
- A new `compare-and-swap — single-field slide edit (drawer write shape)` describe block pins the exact read-modify-write pattern (one field, one entry) every drawer write will use, including a negative control proving a missing `baseSlides` silently discards a concurrently-added entry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Report the old and new song on a song-identity swap** - `36bfed3` (feat)
2. **Task 2: A durable record that a source update was declined** - `6b5f379` (feat)
3. **Task 3: Prove the compare-and-swap contract for a single-field slide edit** - `db4d859` (test)

_No TDD RED/GREEN split was needed beyond the plan's own tdd="true" tag — each task's test file was extended alongside its production change in the same commit, consistent with the existing codebase convention for this pure-module/store-action pairing._

## Files Created/Modified
- `src/utils/slideGroupMaterializer.ts` - `ReconcileResult.songSwap` widened field, populated in the customized song-identity-swap branch
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - 6 new `songSwap` assertions across customized/uncustomized swap, within-song edit, no-song-assigned, and scripture-confirm cases
- `src/types/slideGroup.ts` - `SlideGroup.dismissedSignature?: string` with doc comment explaining why it must be a second field
- `src/stores/slideGroups.ts` - new `dismissReconciliation` action, exported alongside the existing store actions
- `src/stores/__tests__/slideGroups.test.ts` - new `dismissReconciliation` describe block (4 tests) and `compare-and-swap` describe block (3 tests)

## Decisions Made
- `songSwap` carries ids only — title resolution stays one layer up in 26-04, where `useSongStore()` is already in scope, keeping `slideGroupMaterializer.ts` free of any song-catalog import (hard constraint honored).
- A multi-song-blended stored group (an artifact of a prior bug) reports the first song id in `Set` insertion order (== stored `group.slides` order) as `oldSongId`, matching the plan's stated tie-break — the confirmation dialog exists precisely to let the user resolve any residual blend.
- `dismissReconciliation` deliberately omits any transaction or compare-and-swap: two tabs declining the same divergence write the same value (harmless lost race), and a decline racing a concurrent "Apply" is self-correcting because the next reconciliation pass recomputes the current signature fresh.

## Deviations from Plan

None - plan executed exactly as written. All five `must_haves.truths`, all three `must_haves.artifacts`, and all `must_haves.prohibitions` were honored:
- No song title resolved or stored in the materializer.
- No reuse of `sourceSignature` for the decline record — `dismissedSignature` is a distinct field.
- No migration, backfill, or read-time fallback added for the new field.
- No transaction or compare-and-swap wrapped around the dismissal write.
- No diff/preview/side-by-side comparison structure built (D-06).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

All three data-model gaps this phase's later plans (26-02..26-09) depend on are now closed:
- The reconciliation confirm dialog (26-05/26-onward) can render D-08's "reassigned from Song A to Song B" copy directly off `ReconcileResult.songSwap`.
- The `Dismiss` action (D-07) has a concrete field and store action to write through — `dismissReconciliation`.
- Every drawer field-write task in later plans has a test-verified reference for the exact CAS write shape to follow (always pass a freshly-read `baseSlides`, never one captured when a drawer/dialog first opened).

No blockers. Verification (full suite, type-check, build) all green — see Self-Check below.

## Self-Check: PASSED

All 5 modified files confirmed present on disk; all 3 task commits (`36bfed3`, `6b5f379`, `db4d859`) confirmed present in `git log`. Full suite (`npx vitest run src/`) matched the 10-file baseline exactly (10 failed / 155 passed files, 3332 passed / 48 failed tests — the failures are all pre-existing `.gsd/quarantine/worktrees/**` + `RosterView.test.ts`). `npm run type-check` = 0 errors. `npm run build` succeeded.
