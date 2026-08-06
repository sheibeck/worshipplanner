---
phase: 38-congregational-readings-become-real-slides
fixed_at: 2026-08-05T22:42:41Z
review_path: .planning/phases/38-congregational-readings-become-real-slides/38-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 38: Code Review Fix Report

**Fixed at:** 2026-08-05T22:42:41Z
**Source review:** .planning/phases/38-congregational-readings-become-real-slides/38-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1
- Fixed: 1
- Skipped: 0

## Fixed Issues

### CR-01: Clearing a congregational scripture reference leaves a stale `sourceSignature` on the group, which can later strand the group at zero slides after a re-conversion to the same reading

**Files modified:** `src/utils/slideGroupMaterializer.ts`, `src/composables/useSlideshowAssembly.ts`, `src/stores/slideGroups.ts`, `src/utils/__tests__/congregationalDetachment.test.ts`
**Commit:** `0607c09`
**Applied fix:** Direction 1 from the review — widened `RebuildResult` to carry an
optional tri-state `sourceSignature?: string | null` (`undefined` = "no opinion,
leave the stored value alone"; `null` = "explicitly clear it"; a string = "set it").
`rebuildScriptureGroup`'s CLEARED REFERENCE branch (the one branch that empties a
Congregational group's derived slides when the reference is removed) now returns
`sourceSignature: null` alongside the emptied `slides`, instead of leaving the field
unset.

`useSlideshowAssembly.ts`'s `rebuildOutcomes` computed now prefers
`result.sourceSignature` when the rebuild function set it explicitly, falling back
to the ordinary recomputed `sourceSignature(slot, inputs)` for every other branch
(unchanged behavior everywhere except the one branch above).

`slideGroups.ts`'s `replaceGroupSlides` now treats its `sourceSignature` parameter
as the same tri-state and reuses the codebase's established `deleteField()`
pattern (`setGroupBedMedia`'s `clearAudio`, `setGroupBackground`'s
`clearBackground`) rather than inventing a new mechanism: `null` writes a real
Firestore `deleteField()` sentinel for `sourceSignature`; `undefined` omits the key
(via `stripUndefined`, unchanged); a string sets the value. Both the plain
`updateDoc` path and the `runTransaction` compare-and-swap path were updated
identically.

**Regression test added and verified both ways** (per the fix guidance's mandate,
run — not merely reasoned about):

- Extended `congregationalDetachment.test.ts`'s composable-level `tick()` helper
  to mirror the FIXED production write contract exactly (tri-state signature,
  `null` → delete the stored field, `undefined` → leave it untouched) instead of
  the old helper's "write if defined, else leave alone" shape, which is precisely
  the gap CR-01 identified — the existing suite only ever exercised
  `result.slides`/`result.changed` in the cleared-reference branch, never the
  composable-level *write* of `sourceSignature` in that branch.
- Added a new test, `CR-01 REGRESSION: clearing the reference then re-entering the
  IDENTICAL reading does not strand the group at zero slides`, that runs
  CONVERT (3 sections) → CLEAR REFERENCE → RE-CONVERT WITH IDENTICAL CONTENT
  across four rebuild ticks and asserts the group ends at 3 slides (not 0), plus
  the load-bearing intermediate assertion that the stored `sourceSignature` is
  actually cleared (`toBeUndefined()`) after the reference-clear tick.
- **Verified pre-fix failure directly, not by reasoning:** with the test file's
  fix applied but the three production files reverted to their pre-fix `HEAD`
  content (via `git checkout --` in the isolated worktree, no `git stash` used),
  the new test failed exactly at the expected assertion:
  ```
  AssertionError: expected 'Psalms 23:1-33LEADER\u0…' to be undefined
  - Expected: undefined
  + Received: "Psalms 23:1-33LEADERThe Lord is my shepherd..."
  ```
  (`tick1.group.sourceSignature` — the stale congregational signature survived the
  clear, exactly as CR-01 described.) The other 15 pre-existing tests in the file
  still passed unchanged, confirming the regression test is the only one that
  distinguishes pre-fix from post-fix behavior.
- **Verified post-fix pass:** restoring the three production files brought the
  file back to 16/16 passing.

**Gate verification (in the isolated worktree, with the fix applied):**

- `npm run type-check` (`vue-tsc --build`): clean, no output.
- `npx vitest run --dir src --exclude '**/rules.test.ts'`: **2491/2500 passing**,
  9 failing confined to the documented 2-file baseline
  (`src/storage.rules.test.ts` — needs the Storage emulator;
  `src/views/__tests__/RosterView.test.ts` — stale assertion). Failing FILE SET
  is unchanged from the pre-fix baseline (2490/2499); the regression test added
  one net passing test.
- Targeted regression pass across every test file the review listed as reviewed
  in this area (`src/stores/__tests__/slideGroups.test.ts`,
  `src/composables/__tests__/useSlideshowAssembly.test.ts`,
  `src/utils/__tests__/slideGroupMaterializer.test.ts`,
  `src/utils/__tests__/congregationalReadingPipeline.test.ts`,
  `src/components/slides/__tests__/EditSlideDrawer.test.ts`,
  `src/components/slides/__tests__/SlideGrid.test.ts`): all 483 tests passing,
  confirming no regression in the Reference-state parity guarantee (38-01) or the
  detach guarantee (criterion 4 — a deleted section slide stays deleted).

No human-verification flag needed beyond the standard test evidence above: this
is a data-write-path fix with a directly observable before/after test result, not
a logic judgment call requiring separate human confirmation.

## Skipped Issues

None — the one in-scope finding (CR-01) was fixed.

---

_Fixed: 2026-08-05T22:42:41Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
