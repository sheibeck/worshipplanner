---
phase: 28-song-lyrics-editor-rework-risk-low
plan: 03
subsystem: songs
tags: [typescript, vitest, slide-groups, reconciliation]

# Dependency graph
requires:
  - phase: 28-song-lyrics-editor-rework-risk-low
    provides: "28-02's single canonical order source (SongLyrics.performanceOrder) that reconcileSongGroup now diffs against, with no precedence chain to reason about"
provides:
  - "reconcileSongGroup's song merge loop consumes storedBySectionId positionally per occurrence instead of re-emitting the whole array on every occurrence of a repeated section id"
  - "Two-pass idempotence proven by test: reconciling a repeated-section group twice produces a value-equal result, with the repeated section's entry count staying equal to its occurrence count"
  - "Phase 26-09's duplicate-survival guarantee preserved byte-for-byte (one occurrence, two stored entries still emit both, adjacent)"
affects: [28-04, 28-05, 28-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Occurrence-count index built once before a merge loop, with a running per-key consumption counter, to consume a stored array positionally rather than wholesale per key occurrence"]

key-files:
  created: []
  modified:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts

key-decisions:
  - "Surplus stored entries (more stored than occurrences) are emitted once, immediately after the section's LAST occurrence in the fresh order — not the first. This is what makes the N=1-occurrence/M=2-stored case (Phase 26-09's Duplicate action) byte-identical to what 26-09 shipped: with one occurrence, that occurrence is also the last, so both entries land adjacently at the section's single position, exactly as before."
  - "Task 2 required no production change. deriveGroupEntries and sourceSignature already walk the resolved order element-by-element, so they were already correct for repeats — verified with characterization tests rather than assumed, per the plan's explicit instruction not to 'fix' code that reads correct."

requirements-completed: [R035]

coverage:
  - id: D1
    description: "A section referenced N times materializes into exactly N slide entries, each resolving to the same live section text, and reconciling reports no change when nothing changed."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#occurrence-aware repeat merge (D-02, Plan 28-03) > a section referenced twice with one stored entry per occurrence merges to exactly two entries, preserving each stored id, and reports no change"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reconciling a repeated-section group twice in a row produces an identical result the second time (idempotence); the entry count for a repeated section stays stable across reconciliations."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#occurrence-aware repeat merge (D-02, Plan 28-03) > is idempotent: feeding the merge output back in ... > N=2 occurrences with M=3 stored entries ... a second pass is value-equal"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 26-09's duplicate-survival fix still holds: a stored entry duplicated via the Edit Slide drawer's Duplicate action survives reconciliation and stays adjacent to the entry it was copied from, with no growth on a second pass."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#occurrence-aware repeat merge (D-02, Plan 28-03) > 26-09 regression: one occurrence with TWO stored entries keeps both, adjacent, at the section position"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#duplicate-tolerant merge (Phase 26-09 Task 1) (pre-existing suite, unmodified, still green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-entry user work (audio, notes, label) stays attached to the occurrence it was set on and is never copied onto a sibling occurrence of the same section."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#occurrence-aware repeat merge (D-02, Plan 28-03) > occurrence-level customisation stays on the occurrence it was set on"
        status: pass
    human_judgment: false
  - id: D5
    description: "A stored entry whose section no longer resolves is still retained, never deleted automatically, even alongside a repeated section."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#occurrence-aware repeat merge (D-02, Plan 28-03) > a stored entry whose section id is absent from the fresh order is still retained ..."
        status: pass
    human_judgment: false
  - id: D6
    description: "deriveGroupEntries and sourceSignature already correctly handle a section referenced N times (locked in by characterization tests); materialise-then-reconcile round trip is stable and the live-reference guarantee (D002/D007) holds across every occurrence."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#repeated section — derivation and round-trip parity (Plan 28-03 Task 2)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-07-27
status: complete
---

# Phase 28 Plan 03: Fix compounding repeat-entry multiplication in song reconciliation Summary

**`reconcileSongGroup`'s merge loop now consumes each repeated section's stored entries positionally (occurrence `i` takes stored entry `i`), instead of re-emitting the entire stored array on every occurrence — closing the 4→8→16 compounding defect that D-02's repeat-as-reference model would otherwise have hit on the additive, non-confirm-gated path.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-27
- **Tasks:** 2
- **Files modified:** 2 (1 production, 1 test)

## Accomplishments

- Replaced the merge loop's per-`sectionId` "push the whole stored array" behavior with an occurrence-aware positional consumption: an occurrence-count index is built over `freshOrder` before the loop, and a running per-section consumption counter decides which stored entry (if any) each occurrence takes.
- Surplus stored entries — when a section has more stored entries than fresh occurrences — are emitted once, immediately after that section's LAST occurrence in the fresh order. This is the exact rule that keeps Phase 26-09's Duplicate-action guarantee byte-identical: a section with one occurrence and two stored entries has its one occurrence also be its last, so both entries still land adjacently at that single position.
- Proved idempotence directly with two-pass tests: reconcile, feed the output back in as the group's stored slides, reconcile again, and assert the two outputs are value-equal — for the N=M case, the N=1/M=2 (26-09) case, the N=2/M=3 (surplus) case, and the general repeated-order case.
- Task 2 confirmed (rather than assumed) that `deriveGroupEntries` and `sourceSignature` were already correct for repeats — both already walk the resolved order element-by-element — and locked that in with characterization tests plus a `buildInitialGroup` → `reconcileGroup` round-trip test and a live-reference (D002/D007) test proving an edit to a shared section changes what every occurrence resolves to without altering any stored entry.
- Rewrote the `storedBySectionId` doc comment to explain both halves of the contract in one place: why the index holds an array (26-09) and why it is now consumed positionally with a surplus tail (D-02/this plan), described by failure mode rather than by restating the old code.

## Task Commits

Each task was committed atomically, following RED → GREEN (TDD):

1. **Task 1: Occurrence-aware consumption of the stored-entry index**
   - `87cf113` (test) — failing tests reproducing the multiplication defect and specifying every behaviour bullet
   - `1db1e1f` (feat) — occurrence-aware positional merge loop; all new and existing tests pass
2. **Task 2: Derivation and end-to-end parity for a repeated section**
   - `b862485` (test) — characterization + round-trip tests; no production change needed (the functions were already correct)

**Plan metadata:** committed alongside this SUMMARY.

_No refactor commit was needed for either task — the GREEN implementation was already the minimal, final form._

## Files Created/Modified

- `src/utils/slideGroupMaterializer.ts` — `reconcileSongGroup`'s merge loop rewritten to consume `storedBySectionId` positionally per occurrence, with a surplus tail emitted at each section's last occurrence; doc comment above `storedBySectionId` rewritten to explain both the 26-09 array rationale and the D-02 positional-consumption rationale together. No other function touched.
- `src/utils/__tests__/slideGroupMaterializer.test.ts` — new nested `describe('occurrence-aware repeat merge (D-02, Plan 28-03)', ...)` block inside the existing `reconcileSongGroup` describe (7 tests), and a new top-level `describe('repeated section — derivation and round-trip parity (Plan 28-03 Task 2)', ...)` block (4 tests). All 52 pre-existing tests in this file remain unmodified and green.

## Entry counts by case (per plan's `<verification>` requirement)

Explicitly, for a section referenced **N** times with **M** stored entries:

- **N = M** (e.g. N=2, M=2, one stored entry per occurrence): merge emits **2** entries — each occurrence keeps its own stored entry positionally, no surplus.
- **N < M** (e.g. N=1, M=2 — the Phase 26-09 Duplicate case; and N=2, M=3): merge emits **M** entries total. The first N occurrences each take their positional stored entry; the remaining `M − N` are surplus, emitted once, immediately after the section's last occurrence. (N=1/M=2 case: **2** entries, adjacent, at the section's single position — byte-identical to 26-09. N=2/M=3 case: **3** entries — 2 positional + 1 surplus after the second/last occurrence.)
- **N > M** (e.g. N=2, M=1): merge emits **N** entries. The first M occurrences take their positional stored entries; occurrences beyond M each mint a fresh lyric entry with a distinct id. (N=2/M=1 case: **2** entries — 1 stored + 1 freshly minted.)

A second reconciliation pass over any of the above produces a value-equal result — the multiplication defect (which would have produced 4 → 8 → 16 for the N=M=2 case) cannot recur, because each pass consumes exactly the entries the previous pass emitted.

## Decisions Made

- **Surplus lands at the LAST occurrence, not the first.** This is the load-bearing choice that keeps 26-09's output shape unchanged for the N=1 case (its only occurrence is also its last), while still bounding growth for N>1. Explored and confirmed via the N=2/M=3 test, which asserts the surplus entry sits immediately after the second (last) chorus occurrence, not the first.
- **No change to `deriveGroupEntries` or `sourceSignature` (Task 2).** Per the plan's explicit instruction, these were read first and confirmed correct by test rather than modified. Both already iterate `lyrics.performanceOrder` element-by-element with no dedup, so a 3x-repeated section already produced 3 distinct entries and was already counted 3 times in the signature.

## Deviations from Plan

None — plan executed exactly as written, including the two-pass idempotence test structure the plan mandated explicitly (reconcile, feed the result back in as the group's stored slides, reconcile again, compare by value) and the entry-count-by-case documentation the plan's `<verification>` section required.

## Issues Encountered

One TypeScript narrowing issue in a new Task 2 test: `entry.sourceRef.sectionId` was referenced inside a `.find()` callback after a discriminated-union narrow on `entry.sourceRef.kind === 'lyric'`, which TypeScript does not retain across closure boundaries. Fixed by hoisting the narrowed `sectionId` to a local `const` before the callback (Rule 3 — blocking type error, test-only, no production impact). `npm run type-check` confirmed 0 errors after the fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **28-04/28-05** (the reworked lyrics editor and drag-to-reorder UI) can now let a user add a section reference more than once in the order without risking a compounding reconciliation defect — this plan closes that risk before those plans exercise it at the UI layer.
- The additive, non-confirm-gated reconciliation path (T-28-11, accepted by design per D-02) is now mitigated by proven idempotence rather than by a dialog, exactly as the threat model called for.
- No blockers identified. `npm run type-check` is 0 errors; `npm run build` succeeds; the full `npx vitest run src/` suite fails in exactly the same 10 files as the documented pre-existing baseline (8 `.gsd/quarantine/worktrees/**` files + `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`) — no new failures introduced.

---
*Phase: 28-song-lyrics-editor-rework-risk-low*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/utils/slideGroupMaterializer.ts
- FOUND: src/utils/__tests__/slideGroupMaterializer.test.ts
- FOUND: commit 87cf113 (Task 1 RED)
- FOUND: commit 1db1e1f (Task 1 GREEN)
- FOUND: commit b862485 (Task 2 characterization tests)
- FOUND: .planning/phases/28-song-lyrics-editor-rework-risk-low/28-03-SUMMARY.md
