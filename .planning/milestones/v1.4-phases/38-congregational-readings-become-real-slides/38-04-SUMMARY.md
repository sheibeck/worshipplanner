---
phase: 38-congregational-readings-become-real-slides
plan: 04
subsystem: slides
tags: [vue, vitest, slide-groups, scripture, congregational-reading, testing, documentation]

# Dependency graph
requires:
  - phase: 38-01
    provides: the two-state scripture group mechanism (deriveGroupEntries/sourceSignature/rebuildScriptureGroup) this plan proves durable across repeated ticks
  - phase: 38-02
    provides: ScriptureSlide.section (singular) and the projected speaker-above-passage layout this plan's PROJECTED OUTPUT case asserts through
  - phase: 38-03
    provides: the drawer edit/speaker-flip/delete surface this plan's owner-verification checkpoint (Task 3) exercises
provides:
  - "congregationalDetachment.test.ts — the composed multi-tick durability and migration contract: CONVERT, DELETE ONE/ALL, EDIT, SPEAKER FLIP, REORDER, DESTROY (both reference-change and cleared-reference), RE-CONVERT, RE-SPLIT, both migration shapes, PROJECTED OUTPUT, and a non-ASCII encoding backstop — every mutation case run for two further ticks past the mutation, not one"
  - "A tick() helper that mirrors useSlideshowAssembly's applyRebuildOutcomes apply shape exactly (writes slides AND a freshly recomputed sourceSignature, never slides alone), with its own fidelity asserted against the written signature value, not merely the changed flag"
  - "Four stale doc-comment claims in slideGroupMaterializer.ts corrected to state which state (Reference vs Congregational) they govern, plus a short two-state-and-marker pointer beside rebuildScriptureGroup's detach branch itself"
  - "PENDING-VERIFICATION.md items 38.1-38.7 — the deferred owner-verification checklist for the split/edit/delete/present/migration flow, written as the owner's to-do"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-tick composed test pattern: a tick() helper reproducing the composable's own apply-outcome shape, with every mutation case run for TWO further ticks past the mutation (not one) so a rebuild that reverts on a LATER reactive tick, not the first, cannot hide"
    - "Helper fidelity asserted directly against the written state (group.sourceSignature) rather than only the changed flag — the carry-by-position machinery is idempotent enough that a broken helper's tests can still report changed:false for the wrong reason, so the CONVERT case checks the signature value itself"

key-files:
  created:
    - src/utils/__tests__/congregationalDetachment.test.ts
  modified:
    - src/utils/slideGroupMaterializer.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "convertedGroup() test helper builds its 'already converted' starting state by actually RUNNING a conversion through tick() from a Reference-state group (the way buildInitialGroup really produces one), not by hand-assembling a 3-entry group — every later case starts from a state this file already validated in the CONVERT case."
  - "The tick() helper writes sourceSignature through a conditional spread (only when defined), mirroring slideGroupsStore.replaceGroupSlides's own stripUndefined-before-updateDoc behavior — an undefined fresh signature must leave the stored field untouched, not clear it."
  - "Comment reconciliation (Task 2) found slideGroup.ts, slideshowAssembler.ts and scripture.ts already fully reconciled by 38-01/38-02 — no changes needed there. Only slideGroupMaterializer.ts had stale unqualified claims (see Deviations below for the four specific fixes)."
  - "Task 3's blocking human-verify checkpoint was deferred, not run, per the standing autonomy grant recorded in STATE.md. Recorded as PENDING-VERIFICATION.md items 38.1-38.7, explicitly NOT marked passed/approved/verified anywhere in this summary or that file."

requirements-completed: [R072]

coverage:
  - id: D1
    description: "The composed two-state contract holds across repeated rebuild ticks: a deleted/edited/reordered/speaker-flipped section slide stays that way after two further ticks, not just one"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/congregationalDetachment.test.ts#DELETE ONE STAYS DELETED / DELETE ALL STAYS DELETED / EDIT SURVIVES / SPEAKER FLIP SURVIVES / REORDER SURVIVES"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONVERT then IDLE: a Reference-state group converts to N section entries on tick one and reports no change on ticks two and three; the tick helper's own fidelity (it wrote the refreshed sourceSignature, not just the slides) is asserted directly"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/congregationalDetachment.test.ts#CONVERT then IDLE"
        status: pass
    human_judgment: false
  - id: D3
    description: "DESTROY collapses a converted group to exactly one Reference-state entry on both a reference change and a cleared reference (retaining hand-added user work), and RE-CONVERT/RE-SPLIT opt back in correctly without growing the list"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/congregationalDetachment.test.ts#DESTROY ON REFERENCE CHANGE / DESTROY ON CLEARED REFERENCE / RE-CONVERT / RE-SPLIT"
        status: pass
    human_judgment: false
  - id: D4
    description: "A pre-existing Phase-34 congregational reading (one payload-free entry, bare-reference sourceSignature) upgrades to N section entries on its first tick with no further change on tick two; an ordinary Reference-state group in the same legacy shape is undisturbed on its very first tick"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/congregationalDetachment.test.ts#MIGRATION, congregational / MIGRATION, non-regression"
        status: pass
    human_judgment: false
  - id: D5
    description: "No doc comment in the four most-changed files (slideGroup.ts, slideGroupMaterializer.ts, slideshowAssembler.ts, scripture.ts) asserts an unqualified rule the code no longer follows unconditionally"
    verification:
      - kind: other
        ref: "manual audit of all four files against current code, commit ea9a13e — four stale claims found and fixed in slideGroupMaterializer.ts; the other three files were already correctly scoped by 38-01/38-02"
        status: pass
    human_judgment: true
    rationale: "Whether a comment's prose accurately reflects the code is a fidelity judgment, not a mechanically testable assertion (the full suite passing unchanged is necessary but not sufficient evidence — a stale comment can coexist with passing tests). Recorded as passed by the executing agent's own line-by-line audit; a human spot-check is still the more reliable signal on doc-fidelity work."
  - id: D6
    description: "Owner verifies the split/edit/delete/present flow, and — for anyone with a pre-existing service — that an old congregational reading upgrades itself with no manual step"
    verification: []
    human_judgment: true
    rationale: "Task 3 is a blocking human-verify checkpoint. Deferred under STATE.md's standing autonomy grant rather than run or self-approved. Recorded as PENDING-VERIFICATION.md items 38.1-38.7."
  - id: D7
    description: "Both binding gates pass with no failures outside the documented two-file baseline"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' (2499 tests, 2490 passed, 9 failed — all in src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-05
status: complete
---

# Phase 38 Plan 04: The Composed Contract Holds Across Repeated Ticks Summary

**A 15-case composed test file (`congregationalDetachment.test.ts`) proves the congregational two-state mechanism survives repeated rebuild ticks — not just one — covering delete/edit/speaker-flip/reorder survival, both DESTROY paths, RE-CONVERT/RE-SPLIT, and both migration shapes; four stale doc-comment claims in `slideGroupMaterializer.ts` were corrected; and the phase's owner-verification checkpoint was deferred (never self-approved) into `PENDING-VERIFICATION.md` items 38.1-38.7.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-05
- **Tasks:** 3 (2 auto + 1 deferred checkpoint)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `src/utils/__tests__/congregationalDetachment.test.ts` (15 tests, all passing): a `tick()` helper
  that mirrors `useSlideshowAssembly`'s `applyRebuildOutcomes` apply shape exactly (writes both the
  rebuild's returned slides AND a freshly recomputed `sourceSignature`, via a conditional spread that
  mirrors the store's `stripUndefined`-before-`updateDoc` behavior), and a `convertedGroup()` helper
  that produces its "already converted" starting state by actually running a real conversion through
  `tick()`, not by hand-assembling one.
- Every mutation case (delete-one, delete-all, edit, speaker-flip, reorder) runs the mutation, then
  TWO further ticks, asserting `changed: false` both times — the class of bug a single-tick test
  cannot see, because a rebuild that reverts a user's edit does so on a LATER reactive tick.
- Both DESTROY paths (reference change via `scriptureSlotAfterReferenceChange`, and a cleared
  reference retaining a hand-added video entry) collapse a converted group to exactly one
  payload-free Reference entry, proven through to an assembled slide showing the NEW reference with
  an empty passage body — never leaking one passage's words under another's heading.
- RE-CONVERT (opting back in after a destroy) and RE-SPLIT (replacing 3 sections with 2 different
  ones) both converge to the correct entry count on the second tick — "never five, never a growing
  list."
- Both migration shapes are covered: a legacy Phase-34-shaped group (one payload-free entry,
  bare-reference `sourceSignature`) on a slot that already has sections upgrades to N section entries
  on tick one with no further change on tick two; the SAME legacy shape on a slot with NO sections
  reports no change on its very FIRST tick — the non-regression guarantee that deploying this phase
  rewrites nothing that wasn't already congregational.
- Comment reconciliation audit (Task 2) found `slideGroup.ts`, `slideshowAssembler.ts` and
  `scripture.ts` already fully reconciled by 38-01/38-02's own work; `slideGroupMaterializer.ts` had
  four stale unqualified claims, all fixed (see Deviations below), plus a short two-state-and-marker
  pointer added directly beside `rebuildScriptureGroup`'s detach branch.
- Task 3's blocking human-verify checkpoint was deferred under the standing autonomy grant and
  recorded as `PENDING-VERIFICATION.md` items 38.1-38.7 — never run, never marked passed.

## Task Commits

Each task was committed atomically:

1. **Task 1: The composed durability and migration contract** - `0ff30bf` (test)
2. **Task 2: Reconcile every comment the change falsified** - `ea9a13e` (docs)
3. **Task 3 (checkpoint, deferred): record the owner-verification checklist** - `6e50815` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/utils/__tests__/congregationalDetachment.test.ts` - New: the composed multi-tick durability
  and migration contract, 15 tests, sibling to `congregationalReadingPipeline.test.ts`
- `src/utils/slideGroupMaterializer.ts` - Four doc-comment claims scoped to which state they govern
  (see Deviations); a short two-state-and-marker pointer added beside `rebuildScriptureGroup`'s
  detach branch
- `.planning/PENDING-VERIFICATION.md` - New `## Phase 38` section, items 38.1-38.7

## Decisions Made

- **`convertedGroup()` builds its starting state by actually running a conversion**, not by
  hand-assembling a 3-entry group — every case past CONVERT starts from a state this file already
  validated, and it exercises the real `buildInitialGroup` -> `tick()` path a service really takes.
- **Signature write mirrors `stripUndefined` semantics**: the helper's conditional spread means an
  `undefined` fresh signature leaves the group's stored field untouched rather than clearing it,
  matching what `replaceGroupSlides`'s Firestore `updateDoc` actually does.
- **Helper fidelity is asserted against the written `sourceSignature` value directly**, not only the
  `changed` flag — `rebuildUnstableIdGroup`'s carry-by-position machinery is idempotent enough on
  identical content that a broken helper (writing slides but never the signature) would still make
  most cases report `changed: false` for the wrong reason (permanently stale, re-derived on every
  tick). The CONVERT case's direct signature assertion is what actually rules that out.
- **Comment reconciliation found no work needed in three of the four files** — `slideGroup.ts`,
  `slideshowAssembler.ts` and `scripture.ts` were already correctly scoped to "Reference state" vs
  "Congregational state" by 38-01/38-02's own comment work. Only `slideGroupMaterializer.ts` had
  stale claims, listed in full below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/stale documentation] `deriveGroupEntries`'s doc claimed slide text is never read
or stored here — false for the Congregational case**
- **Found during:** Task 2 (comment audit)
- **Issue:** The function-level doc comment said "Slide TEXT is never read or stored here (D-02); only
  structural references (`sourceRef`) are minted" with no qualification — but the SCRIPTURE
  Congregational branch mints `sourceRef.text = section.text` (the section's actual words) directly.
- **Fix:** Scoped the claim to every kind except the SCRIPTURE Congregational state, with a pointer to
  why (no live source left to resolve against once detached — see `SourceRef`'s doc in
  `slideGroup.ts`).
- **Files modified:** `src/utils/slideGroupMaterializer.ts`
- **Verification:** `npm run type-check` clean; full suite unchanged (no behavioral change, prose only)
- **Committed in:** `ea9a13e`

**2. [Rule 1 - Bug/stale documentation] `derivedIdentityKey`'s doc claimed scripture derives exactly
ONE entry, unqualified**
- **Found during:** Task 2
- **Issue:** "R047 narrows a scripture group to exactly ONE derived entry" is true only in the
  Reference state; the Congregational state derives N entries (one per section) under the SAME
  constant identity key.
- **Fix:** Scoped to "REFERENCE-state," and added the missing explanation of why the Congregational
  state's N entries still share one key (it's what lets carry-by-position and the DESTROY collapse
  both work).
- **Files modified:** `src/utils/slideGroupMaterializer.ts`
- **Committed in:** `ea9a13e`

**3. [Rule 1 - Bug/stale documentation] `carryStoredDerivedEntries`'s surplus-suppression comments
(function doc + inline HI-01 note) described scripture's derivation as "exactly one entry"**
- **Found during:** Task 2
- **Issue:** Both comments justified suppressing scripture surplus by "scripture's derivation is
  exactly one entry (R047)" — but the SAME suppression line (`carriesSurplus = ... !== 'scripture'`)
  applies unconditionally in the Congregational state too (N>1 entries), which is exactly what keeps
  a RE-SPLIT from growing instead of replacing. The old comment gave a reason that no longer covers
  the code's own full behavior.
- **Fix:** Rewrote both to state the suppression is unconditional across every state, with the RE-SPLIT
  case named explicitly as what would break if a future edit widened `carriesSurplus`.
- **Files modified:** `src/utils/slideGroupMaterializer.ts`
- **Committed in:** `ea9a13e`

**4. [Rule 1 - Bug/stale documentation] `rebuildUnstableIdGroup`'s doc claimed `sourceSignature` is
"no longer a decision input" — true only of that one function, not the module**
- **Found during:** Task 2
- **Issue:** "it is a stored change-detector now, no longer a decision input here" reads as a
  system-wide claim, but Phase 38 gave `sourceSignature` a real reader: `rebuildScriptureGroup`
  consults it as the ONE detachment marker before ever calling this function.
- **Fix:** Scoped the "not a decision input" claim explicitly to this function, and added a pointer to
  `rebuildScriptureGroup`'s own doc for where it IS one now.
- **Files modified:** `src/utils/slideGroupMaterializer.ts`
- **Committed in:** `ea9a13e`

---

**Total deviations:** 4 auto-fixed (all Rule 1 - stale documentation, no behavioral change)
**Impact on plan:** All four fixes are prose-only corrections inside the scope Task 2 explicitly
authorized ("Audit the four files this phase changed most for prose that still describes the
pre-phase rules"). No scope creep; full suite result unchanged before/after.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 38 (Congregational Readings Become Real Slides) is now code-complete across all four plans:
the two-state mechanism (38-01), the singular-section projected layout (38-02), the drawer editing
surface (38-03), and this plan's composed multi-tick durability proof plus comment reconciliation
(38-04). `npm run type-check` (vue-tsc --build) is clean; the full app suite
(`npx vitest run --dir src --exclude '**/rules.test.ts'`) shows 2490/2499 passing, with the 9
failures confined to the documented two-file baseline (`src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`) — unchanged from before this plan.

**Task 3's owner-verification checkpoint is DEFERRED, not passed.** `PENDING-VERIFICATION.md` items
38.1-38.7 are the concrete to-do: split a scripture item, edit/flip/delete a section in isolation
(with the delete-survives-reload check flagged ★ as the criterion that has failed before), present
the reading and confirm the projected layout, confirm a scripture change destroys the split, and —
for anyone with a pre-existing service — confirm an old congregational reading upgrades itself with
no action. Nothing in this phase is marked passed until the owner runs that checklist.

No blockers for closing out Phase 38 at the roadmap level once the owner's checkpoint is run.

---
*Phase: 38-congregational-readings-become-real-slides*
*Completed: 2026-08-05*

## Self-Check: PASSED

Both modified/created source files (`src/utils/__tests__/congregationalDetachment.test.ts`,
`src/utils/slideGroupMaterializer.ts`) and `.planning/PENDING-VERIFICATION.md` confirmed present on
disk; all 3 task commits (`0ff30bf`, `ea9a13e`, `6e50815`) confirmed present in `git log`.
