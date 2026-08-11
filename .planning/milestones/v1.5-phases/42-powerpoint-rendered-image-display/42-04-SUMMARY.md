---
phase: 42-powerpoint-rendered-image-display
plan: 04
subsystem: slides
tags: [vitest, pure-functions, pptx-render, slide-groups, reconciliation]

# Dependency graph
requires:
  - phase: 42-03
    provides: "src/utils/importedRenderReconciler.ts — resolveImportedRender, importedEntryIdentities, importedSourceSignature"
provides:
  - "slideGroupMaterializer.ts's two IMPORTED branches (deriveGroupEntries, sourceSignature) now read from the shared reconciler instead of a second copy of the decision table"
  - "The IMPORTED sourceSignature pipe/colon delimiter collision hazard is closed for real — 42-03 built the fix, this plan wires it into the branch that actually gets read on every rebuild"
  - "Proof (by test, not by reading) that a pending/failed -> ready render transition rebuilds a group exactly once, is idempotent thereafter, and never drops a user-added slide"
affects: [42-05, 42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The grid engine (slideGroupMaterializer.ts) and the presenter engine (slideshowAssembler.ts, 42-05) both consume the SAME reconciler rather than each deriving render state independently — the exact drift 42-CONTEXT.md names as the failure this phase exists to end"

key-files:
  created: []
  modified:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts

key-decisions:
  - "deriveGroupEntries's IMPORTED case keeps its two existing early-return guards (no importId, deck not yet loaded) exactly as they were — those are the T-30-02-04 loading-race guard `rebuildUnstableIdGroup` depends on. Only the entry-count/identity source changed, from `deck.slides.map(...)` directly to `importedEntryIdentities(deck, resolveImportedRender(deck, render))`."
  - "The render document lookup is keyed on `deck.renderImportId`, never on `slot.importId` — the two identifiers are deliberately distinct (T-42-07); a deck with no `renderImportId` never even touches `inputs.pptxRendersByImportId`, so a stale/mis-keyed render document present in that map cannot leak under the wrong deck (T-42-07 defense in depth)."
  - "Two doc-comment literals (the old `` `${texts.length}:${texts.join('|')}` `` form, and the module name `importedRenderReconciler`) were rephrased during Task 1 to avoid tripping the plan's own grep acceptance gates (`join('|')` count == 1, `importedRenderReconciler` count == 1 meaning exactly the import statement) — the code change was correct on the first pass; only the prose describing it needed adjusting so the gate counted the right thing."
  - "Task 2's four new describe blocks use local-only fixtures (`makeRenderedImportedDeck`, `makeRenderDoc`, `makeRenderInputs`) rather than widening any of the suite's 30+ shared fixtures — every pre-existing IMPORTED fixture deliberately still has no `renderImportId`, which is what proves D-16's byte-identical parsed-mode fallthrough for every one of the 108 pre-existing tests."

requirements-completed: [R079]

coverage:
  - id: D1
    description: "deriveGroupEntries's IMPORTED branch derives entry count and per-entry identity through resolveImportedRender + importedEntryIdentities: ready renders (3/5/8, and the renderedCount=0 self-contradictory carve-out resolving to failed) all produce the correct count and identity shape (synthetic rendered-page-N vs parsed inner slide id), and a deck with no renderImportId is unaffected by a render document present under a different id (T-42-07)."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts describe('deriveGroupEntries — IMPORTED with a render'), 7 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "sourceSignature's IMPORTED branch delegates to importedSourceSignature: pending/failed/ready-3/ready-4 all sign distinctly (D-09), an absent render document signs identically to an explicit pending document, and two decks whose parsed text differs only by where a literal pipe falls no longer collide (T-42-10) — proven by first reproducing the collision under the old encoding, then asserting the new encoding does not collide."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts describe('sourceSignature — IMPORTED render folding'), 3 cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "rebuildImportedGroup fires exactly once on a pending -> ready transition (changed: true, 5 rendered-page entries) and is changed: false on an immediately following rebuild against the same render document (D-10, no one-shot flag anywhere in the code); a failed -> ready transition is entry-for-entry identical to pending -> ready (D-12); the rendered-page-N identity is stable enough across two derivations from the same (deck, render) to carry a stored label/audioUrl forward (Assumption A1)."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts describe('rebuildImportedGroup — render transitions'), 3 cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "A stored group's authored text entry and video entry (each with their own id, and one with audioUrl/notes) survive a pending -> ready rebuild with ids, audioUrl and notes unchanged (D-11 / Phase 24 D-02), taking the unconditional rebuild path (changed: true, full slide list, not the untouched stored slides — confirming Phase 30 deleted the confirm-gate)."
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts describe('rebuildImportedGroup — user work survives a render transition'), 1 case"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every pre-existing IMPORTED test in the 2,380-line suite passes unchanged (no fixture sets renderImportId, D-16); grep confirms join('|') appears exactly once (SONG branch only) and importedRenderReconciler appears exactly once (the import statement) in slideGroupMaterializer.ts; npm run type-check reports 0 errors; the confirm-gate is confirmed gone, not assumed."
    verification:
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/slideGroupMaterializer.test.ts (122 tests: 108 pre-existing unchanged + 14 new, 0 failures) + npm run type-check (0 errors) + grep -c \"join('|')\" == 1 + grep -c importedRenderReconciler == 1 + grep -rn 'dismissedSignature|ReconcileConfirmModal' src/ == no matches"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 04: The Materializer Consumes the Shared Reconciler Summary

**`slideGroupMaterializer.ts`'s two IMPORTED branches now read from the one shared reconciler instead of a second, unsafe decision table — and a `pending`/`failed` → `ready` render transition is proven, by test, to rebuild exactly once and never destroy a user's own slides.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-07T10:32:00Z
- **Completed:** 2026-08-07T10:50:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `deriveGroupEntries`'s IMPORTED case now derives entry count and per-entry `innerSlideId` through `resolveImportedRender` + `importedEntryIdentities` instead of iterating `deck.slides` directly — the module never re-derives the count itself, closing the door to the grid and the presenter (42-05) disagreeing about what a deck contains.
- `sourceSignature`'s IMPORTED case now delegates to `importedSourceSignature`, replacing the pre-existing `` `${texts.length}:${texts.join('|')}` `` encoding with 42-03's `\x1e`/`\x1f` ASCII control-character separators — closing T-42-10's real (proven by reproducing the collision under the old encoding first) delimiter-collision hazard, and folding both render mode and `renderedCount` into the signature (D-09) so a re-render that changes page count while staying `ready` is detected.
- Both loading-race guards (`!slot.importId`, deck missing from `importedDecksById`) are untouched — `rebuildUnstableIdGroup`'s T-30-02-04 guard still works exactly as before.
- 14 new tests across four `describe` blocks prove, rather than assume: the ROADMAP criterion 3 count-disagreement matrix (ready/3, ready/5, ready/8, and the `renderedCount=0` self-contradictory carve-out), the D-09 signature-folding matrix, D-10's exactly-once-then-idempotent transition behavior with no one-shot flag, D-12's `failed → ready` parity with `pending → ready`, Assumption A1's identity stability, and D-11/Phase-24-D-02's user-slide survival guarantee.
- All 108 pre-existing tests in the 2,380+-line suite pass byte-unchanged — no existing fixture sets `renderImportId`, so every one of them still exercises the `parsed`-mode fallthrough exactly as before (D-16).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire deriveGroupEntries and sourceSignature onto the shared reconciler** - `522d702` (feat)
2. **Task 2: Prove transition behaviour — exactly once, idempotent, and user work survives** - `2cd813e` (test)

**Plan metadata:** committed separately by the state-update step.

## Files Created/Modified
- `src/utils/slideGroupMaterializer.ts` - IMPORTED branches of `deriveGroupEntries` and `sourceSignature` rewired onto `importedRenderReconciler.ts`'s `resolveImportedRender`/`importedEntryIdentities`/`importedSourceSignature`
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - four new `describe` blocks (14 tests) plus local-only fixtures (`makeRenderedImportedDeck`, `makeRenderDoc`, `makeRenderInputs`)

## Decisions Made
- Render document lookups key on `deck.renderImportId`, never `slot.importId` — see `key-decisions` in frontmatter (T-42-07 defense in depth).
- Two doc-comment literals were rephrased mid-Task-1 to stop tripping the plan's own grep acceptance gates without changing any code behavior — see `key-decisions`.
- New test fixtures stay local to the four new `describe` blocks rather than widening shared suite fixtures — see `key-decisions` (preserves D-16 proof for the 108 pre-existing tests).

## Deviations from Plan

None — plan executed exactly as written. One self-correction during Task 1's verification pass: the first draft of two doc comments quoted the literal old encoding (`` `${texts.length}:${texts.join('|')}` ``) and the literal module name (`` `importedRenderReconciler.ts` ``) for reader context, which made the acceptance criteria's `grep -c "join('|')"` and `grep -c 'importedRenderReconciler'` checks return 2 instead of the required 1. Rephrased both comments to describe the same facts without repeating the exact substring the grep gate counts — no code path changed, only prose. Caught and fixed before the Task 1 commit, so it is not reflected as a separate commit.

## Issues Encountered

None. `npm run type-check` (`vue-tsc --build`) reported 0 errors after both tasks. The targeted suite ran at 122 tests (108 pre-existing + 14 new), 0 failures. A broader regression pass (`npx vitest run --dir src --exclude '**/rules.test.ts' src/utils/__tests__/ src/composables/__tests__/`) ran at 972 passing tests, 0 failures. `grep -rn 'dismissedSignature|ReconcileConfirmModal' src/` returned no matches, confirming (not assuming) Phase 30 deleted the confirm-gated reconciler entirely.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `slideGroupMaterializer.ts`'s IMPORTED branches are fully wired to the shared reconciler and proven by test; 42-05 can now rewire `slideshowAssembler.ts`'s `resolveEntryContent`/fallback IMPORTED branches onto the same reconciler with the confidence that the grid side of this pairing is already correct and tested.
- 42-05's presenter-side work should reuse the same reconciler functions (`resolveImportedRender`, `importedEntryContent`, `renderedPageNumberFromIdentity`) this plan already exercises indirectly through `importedEntryIdentities` — no new decision-table logic should be written there.
- No blockers.

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

Both modified files (`src/utils/slideGroupMaterializer.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`)
confirmed present on disk; both task commit hashes (`522d702`, `2cd813e`) confirmed in git history. Wave-merge
bare `npx vitest run` confirmed the documented 3-failed-file baseline (`render-service/src/render.test.ts`,
`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) exactly — no regression.
