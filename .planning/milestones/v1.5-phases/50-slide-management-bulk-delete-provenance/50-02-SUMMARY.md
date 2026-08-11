---
phase: 50-slide-management-bulk-delete-provenance
plan: 02
subsystem: slides
tags: [vitest, slideGroupMaterializer, reconciliation, congregational-reading]

# Dependency graph
requires: []
provides:
  - "src/utils/__tests__/manualAddPreservation.test.ts — an R107 preservation suite proving every manually-added entry (imported PPTX, hand-added text/blank, added media) survives every SlideGroup rebuild path in stored position, and only auto-generated (derived) entries re-derive"
  - "Proof (not merely a claim) that slideGroupMaterializer.ts's existing survivor mechanism (isSlotDerivableRef / survivingEntries / carryStoredDerivedEntries / orderedByStoredPosition) already satisfies R107 with zero production changes needed"
affects: [slides, reconciliation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Combining all three manual-entry kinds (imported/authored-text/video) in one stored group and asserting they survive TOGETHER, rather than testing each kind in isolation as the pre-existing suite did"]

key-files:
  created: [src/utils/__tests__/manualAddPreservation.test.ts]
  modified: []

key-decisions:
  - "Wrote the suite as a NEW sibling test file (src/utils/__tests__/manualAddPreservation.test.ts) rather than appending to the already ~2800-line slideGroupMaterializer.test.ts — the plan explicitly allowed this at the planner's discretion, and the existing file already had substantial single-kind coverage (BL-01/BL-02/D-17/HI-01) this suite intentionally does not duplicate"
  - "Task 2 made NO production code change — all 9 preservation cases passed on the first run, confirming the existing survivor mechanism already satisfies R107. Recorded as verified, not modified, per the plan's explicit instruction for this expected outcome"
  - "Each case asserts BOTH the surviving entries' sourceRef/id and that the derived side actually re-derived (new song section, new deck slide, collapsed/expanded scripture section count) — proving 'only derived entries re-derive,' not merely 'the group looks the same'"

requirements-completed: [R107]

coverage:
  - id: D1
    description: "A SONG group's manually-added imported/text/video entries survive both a within-song section edit and a full song-identity swap, spliced ahead of the trailing copyright, while the derived lyric/copyright entries actually change"
    requirement: "R107"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#within-song section edit: all three manual entries survive, spliced ahead of the trailing copyright, while a new section is actually derived"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#full song-identity swap: all three manual entries survive spliced ahead of the trailing copyright, while every lyric/copyright entry now references only the new song"
        status: pass
    human_judgment: false
  - id: D2
    description: "An IMPORTED group's own deck re-import (fresh innerSlideIds) leaves a foreign-deck entry, an authored-text entry, and a video entry untouched while only the slot's own deck's derived entries re-derive"
    requirement: "R107"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#re-importing the slot's own deck mints fresh innerSlideIds while a foreign-deck entry, an authored-text entry, and a video entry all survive byte-identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "A SCRIPTURE group's manually-added imported/text/video entries survive every rebuild branch of the scripture<->congregational toggle: Reference->Congregational convert, Congregational->Reference destroy, Congregational re-split (no compounding), DETACHED steady state (byte-untouched), and CLEARED REFERENCE (sourceSignature: null)"
    requirement: "R107"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#Reference -> Congregational (first conversion): manual entries survive; the derived reference entry becomes three section entries"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#Congregational -> Reference (DESTROY): manual entries survive; the three section entries collapse to exactly one reference entry"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#Congregational re-split (3 sections -> 2): manual entries survive; section entries REPLACE rather than grow (no compounding)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#DETACHED steady state (stored signature matches the current reading): stored slides, including all three manual entries, are returned byte-untouched"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#CLEARED REFERENCE (reference removed entirely): section entries drop to zero, manual entries survive, and the result carries sourceSignature: null"
        status: pass
    human_judgment: false
  - id: D4
    description: "A PRAYER (text-backed) group holding a hand-added imported entry is untouched by rebuildGroup (changed: false)"
    requirement: "R107"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/manualAddPreservation.test.ts#rebuildGroup returns changed: false and the imported entry is byte-untouched"
        status: pass
    human_judgment: false
  - id: D5
    description: "No production regression: the pre-existing slideGroupMaterializer.test.ts (126 tests) and congregationalDetachment.test.ts (16 tests) suites remain fully green; npm run type-check (vue-tsc --build, which also typechecks test files) is clean"
    requirement: "R107"
    verification:
      - kind: unit
        ref: "npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts src/utils/__tests__/congregationalDetachment.test.ts src/utils/__tests__/manualAddPreservation.test.ts"
        status: pass
      - kind: other
        ref: "npm run type-check"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-10
status: complete
---

# Phase 50 Plan 02: Regeneration Manual-Add Preservation (R107) Summary

**A 9-case preservation suite proving `slideGroupMaterializer.ts`'s existing derived-vs-user-added split already guarantees R107 end-to-end — zero production code changed.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-10
- **Tasks:** 2/2 (Task 2 made no code change — see below)
- **Files modified:** 1 (1 created)

## Accomplishments
- Added `src/utils/__tests__/manualAddPreservation.test.ts` (9 tests), a sibling to the pre-existing `slideGroupMaterializer.test.ts`, proving that an imported entry, an authored-text entry, and a video entry — all three manual-add kinds R107 names — survive **together**, in stored position, across every rebuild path the plan enumerated:
  - **SONG**: a within-song section edit (new Bridge section resolved) and a full song-identity swap (song-1 → song-b), both splicing all three manual entries ahead of the trailing copyright.
  - **IMPORTED**: the slot's own deck re-imports with entirely fresh `innerSlideId`s while a *foreign*-deck imported entry, an authored-text entry, and a video entry all survive untouched — only the slot's own deck's entries actually re-derive.
  - **SCRIPTURE**, all five branches of the two-state rebuild machine: Reference→Congregational (first conversion, 1 entry → 3 section entries), Congregational→Reference (DESTROY, 3 → 1), Congregational re-split (3 → 2, proven not to compound to 5 and stable on a second pass), DETACHED steady state (stored slides returned reference-equal/byte-untouched), and CLEARED REFERENCE (section entries drop to 0, `RebuildResult.sourceSignature` is explicitly `null`).
  - **PRAYER** (text-backed, no-op path): `rebuildGroup` returns `changed: false` with a hand-added imported entry byte-untouched.
- Every case asserts BOTH the surviving entries (id + `sourceRef` deep-equal) AND that the derived side actually changed — e.g. the new Bridge lyric entry exists, every lyric/copyright entry now references the swapped song, the own-deck imported entries are the fresh `innerSlideId`s not the stale ones, the scripture entry count matches the new section count. This proves "only derived entries re-derive," not merely "nothing looks different."
- **All 9 cases passed on the first run with zero production changes** — Task 2 ran the suite, confirmed every case green, and made no edit to `slideGroupMaterializer.ts`. This is the expected outcome the plan called out: the existing `isSlotDerivableRef` → `survivingEntries` rescue, `carryStoredDerivedEntries`'s positional carry, and `orderedByStoredPosition`'s stored-order restoration already implement R107 correctly; this plan converts that implicit invariant into an asserted one.
- Verified no regression: the pre-existing `slideGroupMaterializer.test.ts` (126 tests) and `congregationalDetachment.test.ts` (16 tests) both remain fully green alongside the new suite (151 tests total across the three files). `npm run type-check` (the CLAUDE.md-mandated `vue-tsc --build` gate, which also typechecks test files) is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Preservation tests for every rebuild path** - `b7ae4f5` (test)
2. **Task 2: Close any preservation gap without weakening invariants** — **no commit**. All 9 cases from Task 1 passed unmodified; per the plan's explicit instruction, when every case passes the correct action is "make NO code change" and record the invariant as verified rather than modified. There was nothing to stage or commit.

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `src/utils/__tests__/manualAddPreservation.test.ts` - New 9-test suite proving R107's manual-add preservation guarantee across every `rebuildSongGroup`/`rebuildScriptureGroup`/`rebuildImportedGroup`/`rebuildGroup` branch, combining all three manual-entry kinds (imported/text/video) in single stored groups rather than testing each kind in isolation.

## Decisions Made
- Chose a new sibling test file over appending to `slideGroupMaterializer.test.ts` (already ~2800 lines with extensive single-kind coverage under BL-01/BL-02/D-17/HI-01) — the plan explicitly allowed either, and a dedicated file keeps the R107-specific "three manual kinds together" scenarios discoverable as one coherent suite rather than scattered among ~15 pre-existing `describe` blocks.
- No production code change in Task 2 — confirmed via a direct first-pass run that all 9 cases were green, so the existing survivor/carry/order machinery already satisfies R107. Making a speculative "improvement" anyway would have violated the plan's explicit instruction not to touch code when the suite already passes.
- Reused the project's established scripture-slot manipulation pattern (constructing `ScriptureSlot` overrides directly, e.g. `scriptureSlot({ congregationalSections: [...] })` / `scriptureSlot({ book: null, ... })`) rather than importing `scriptureSlotAfterReferenceChange` from `congregationalDetachment.test.ts` — this matches the exact style the pre-existing `rebuildScriptureGroup — the two-state machine (D1)` describe block in `slideGroupMaterializer.test.ts` already uses for the same branches, so the new suite reads as one family with the existing tests rather than forking its own convention.

## Deviations from Plan

None - plan executed exactly as written. Task 1 wrote the suite without touching production code (as instructed); Task 2's expected "no code change needed" outcome held on the first run, exactly as the plan's planning read predicted.

## Issues Encountered

One local authoring mistake, caught and fixed before committing (not a plan deviation): the IMPORTED-group test's shared assertion helper (`assertManualEntriesSurviveByRef`) assumes the default manual-imported-entry fixture values (`importId: 'foreign-deck'`, `innerSlideId: 'foreign-1'`), but that specific test deliberately overrode those values to model a genuinely foreign deck (`importId: 'deck-foreign'`, `innerSlideId: 'f-1'`). Replaced the shared-helper call with direct inline assertions for that case before the suite was committed — no production code or test semantics were affected, only the test's own internal wiring.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- R107 is fully satisfied and proven in-repo: `slideGroupMaterializer.ts` needed no changes, and the guarantee is now asserted by 9 new tests plus the pre-existing single-kind coverage (151 tests total across the three touched suites, all green).
- `npm run type-check` is clean; the full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) sits at exactly the documented 2-file baseline (`src/storage.rules.test.ts` — needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` — stale assertion), no new failure introduced.
- No blockers for 50-03/50-04/50-05 (R106 bulk delete, R108 render identity, and any remaining phase-level work) — this plan touched only `src/utils/__tests__/` and made zero production changes, so it has no surface overlap with those plans' files.

---
*Phase: 50-slide-management-bulk-delete-provenance*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: src/utils/__tests__/manualAddPreservation.test.ts
- FOUND: .planning/phases/50-slide-management-bulk-delete-provenance/50-02-SUMMARY.md
- FOUND: b7ae4f5
