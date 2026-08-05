---
phase: 38-congregational-readings-become-real-slides
plan: 01
subsystem: slides
tags: [vue, firestore, slide-groups, scripture, congregational-reading]

# Dependency graph
requires:
  - phase: 34-llm-scripture-split
    provides: ServiceSlot.congregationalSections (the LLM-split sections a slot stores)
  - phase: 30
    provides: the SCRIPTURE hard lock (Reference state) and the rebuild/carry machinery this plan extends
provides:
  - A scripture slide group with two states — Reference (payload-free, mirrored from the slot,
    unchanged) and Congregational (N entries, one per section, detached from slot-driven re-derivation)
  - congregationalSectionsFromSlot / congregationalSectionFromRef — the one congregational predicate
    on each side (slot, entry)
  - rebuildScriptureGroup's DETACH/CONVERT/RE-SPLIT/DESTROY/CLEARED-REFERENCE state machine
  - One assembled ScriptureSlide per congregational section, on both the stored-group and fallback
    materialization paths
affects: [38-02, 38-03, 38-04, PresentationViewer.vue, CongregationalEditor.vue, SlideGrid.vue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-state SlideGroup: sourceSignature consulted as a decision input (not just a stored
      change-detector) to distinguish 'materialized from this reading' (detached) from 'not yet'"
    - "Deterministic, order-sensitive, field-explicit signature encoding (ASCII control-char
      separators, never JSON.stringify) for content that must not depend on object key order"
    - "One-entry-per-fragment SourceRef widening, following the existing IMPORTED precedent"

key-files:
  created: []
  modified:
    - src/types/slideGroup.ts
    - src/utils/scripture.ts
    - src/utils/slideGroupMaterializer.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/scripture.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/congregationalReadingPipeline.test.ts

key-decisions:
  - "D1 (owner decision, prior phase context): converting to congregational DETACHES the group;
    any change to the slot's scripture DESTROYS the group back to the Reference state."
  - "Signature encoding: `<formatted reference>` when no sections; otherwise
    `<formatted reference>\\x1e<section count>\\x1e<speaker>\\x1f<verseRange>\\x1f<text>` joined by
    \\x1e per section — ASCII control chars (0x1e/0x1f) as separators because they cannot occur in
    typed or ESV-sourced scripture text, and no JSON.stringify because AI-split vs manual-split
    section objects are not guaranteed the same key order."
  - "The one-element `sections` array on an assembled congregational ScriptureSlide is a deliberate
    intermediate shape (each slide now carries exactly ONE section) — plan 38-02 replaces it with a
    singular field and reworks PresentationViewer's projected layout."
  - "No test beyond the plan's own enumerated set required a change — the R064 describe block
    (both in scripture.test.ts and slideGroupMaterializer.test.ts) was reversed as the plan predicted,
    and the BL-02/HI-01/T-30-02 cross-cutting scripture tests were verified unaffected because they
    all use a no-sections scriptureSlot() fixture, which still routes through the untouched
    rebuildUnstableIdGroup branch."

requirements-completed: [R072]

coverage:
  - id: D1
    description: "A SCRIPTURE slot with N congregational sections derives N entries and assembles to N slides on both materialization paths"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#deriveGroupEntries — SCRIPTURE congregational (D1)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/congregationalReadingPipeline.test.ts#fallback path / stored-group path: three sections assembles to three slides"
        status: pass
    human_judgment: false
  - id: D2
    description: "A SCRIPTURE slot with no sections derives one payload-free entry, signs to the bare formatted reference, and assembles to one reference-only slide — byte-identical to today"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#SCRIPTURE — congregational sections fold into the signature (D1) > with NO sections, the signature is byte-identical to the bare formatted reference"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/congregationalReadingPipeline.test.ts#backward compatibility, absent/empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "A group already materialized from the slot's current reading rebuilds to changed: false even after entries have been deleted from it"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#rebuildScriptureGroup — the two-state machine (D1) > DETACH"
        status: pass
    human_judgment: false
  - id: D4
    description: "A reference change collapses a congregational group to exactly one payload-free entry; a cleared reference empties it of derived entries while retaining user-added ones"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#rebuildScriptureGroup — the two-state machine (D1) > DESTROY / CLEARED REFERENCE"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both binding gates (npm run type-check via vue-tsc --build, and the full app suite) pass with no failures outside the documented two-file baseline"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' (2467 tests, 2458 passed, 9 failed — all in src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-05
status: complete
---

# Phase 38 Plan 01: The Congregational Two-State Mechanism Summary

**A congregational scripture reading now derives, signs, rebuilds and assembles as N independently-editable slide-group entries — one per section — detached from the slot once converted, instead of one slide carrying a stacked sections array.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-05
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `SourceRef`'s scripture member widened with optional `speaker`/`text`/`verseRange` — `speaker`
  present is the ONE discriminator for "this entry is a detached congregational section."
- `congregationalSectionsFromSlot` (slot → sections) and `congregationalSectionFromRef` (entry →
  section or `null`) are now the ONE congregational-ness predicate on each side, replacing the
  deleted `congregationalSlideFieldsFromSlot`.
- `deriveGroupEntries`'s SCRIPTURE case emits N entries (one per section) when sections are present,
  and the unchanged single payload-free entry when they are not.
- `sourceSignature`'s SCRIPTURE case now folds sections into the signature with a deterministic,
  field-explicit, order-sensitive encoding — and is byte-identical to the bare formatted reference
  when there are no sections, so no existing Reference-state group's stored signature changes.
- `rebuildScriptureGroup` implements the full two-state machine: DETACH (unconditional, even on an
  emptied group), CONVERT/RE-SPLIT (delegates to the existing `rebuildUnstableIdGroup` carry
  machinery), CLEARED REFERENCE (empties derived section entries while retaining user work), and
  DESTROY (reuses `carryStoredDerivedEntries`'s HI-01 surplus suppression, unmodified, to collapse
  back to exactly one Reference entry).
- `resolveEntryContent` and the SCRIPTURE fallback branch in `assembleSlideshow` both dispatch on
  `congregationalSectionFromRef`, assembling one `ScriptureSlide` per section on both materialization
  paths, with parity proven by dual-path tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: The section payload on SourceRef, and one congregational predicate per side** - `c0abf57` (feat)
2. **Task 2: The derivation, the change signature, and the two-state rebuild** - `ae67d73` (feat)
3. **Task 3: One assembled slide per section, on both materialization paths** - `8ebc532` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/types/slideGroup.ts` - Widened `SourceRef`'s scripture member; corrected the "text never
  stored" and "sourceSignature consulted by nothing" doc claims for the two states
- `src/utils/scripture.ts` - `congregationalSectionsFromSlot` + `congregationalSectionFromRef`
  replace `congregationalSlideFieldsFromSlot`
- `src/utils/slideGroupMaterializer.ts` - `deriveGroupEntries`, `sourceSignature`, and
  `rebuildScriptureGroup` (the two-state machine) for SCRIPTURE
- `src/utils/slideshowAssembler.ts` - `resolveEntryContent` and the SCRIPTURE fallback branch emit
  one slide per section on both paths
- `src/utils/__tests__/scripture.test.ts` - Positive tests for both new predicates
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - New congregational derivation/signature
  tests; DETACH/CONVERT/RE-SPLIT/DESTROY/CLEARED-REFERENCE/IDEMPOTENCE rebuild tests; the R064
  claim reversal
- `src/utils/__tests__/slideshowAssembler.test.ts` - N-slides congregational describe block,
  dual-path parity
- `src/utils/__tests__/congregationalReadingPipeline.test.ts` - Rewritten composed contract:
  N-slides assembly, rebuild survival (detachment), destroy-collapse, hand-deleted-slide survival

## Decisions Made

- **Signature encoding chosen:** `<formatted reference>` alone when the slot has no sections
  (byte-identical to before this phase). When sections are present:
  `<formatted reference>\x1e<section count>\x1e<speaker>\x1f<verseRange-or-empty>\x1f<text>` with
  successive sections joined by `\x1e`. ASCII record/unit-separator control characters (0x1e, 0x1f)
  were chosen because they cannot occur in typed or ESV-sourced scripture text, and explicitly NOT
  `JSON.stringify` on the section objects, because the AI-split path and the manual-edit path are not
  guaranteed to produce the same key order, and a signature that flips on key order would rebuild
  groups at random.
- **No test beyond the plan's own enumerated set required a change.** The R064 describe blocks in
  both `scripture.test.ts` and `slideGroupMaterializer.test.ts` were rewritten to their positive
  counterparts exactly as the plan predicted (both original claims — "one entry regardless of
  sections" and "signature ignores sections" — are reversed by D1). Every other pre-existing test
  that exercises `rebuildScriptureGroup` (`BL-02`, `HI-01`, `T-30-02-*`, `rebuildGroup dispatcher`)
  uses a no-sections `scriptureSlot()` fixture and was verified, by tracing the new branch order, to
  still route through the unmodified `rebuildUnstableIdGroup` delegation — none needed edits, and
  none were touched.

## Deviations from Plan

None — plan executed exactly as written. `carryStoredDerivedEntries`, `isSlotDerivableRef`,
`derivedIdentityKey`, `survivingEntries` and `orderedByStoredPosition` were deliberately left
unmodified, per the plan's explicit instruction, and traced by hand to confirm the DESTROY collapse
and the DETACH/user-work survival still work through them unchanged.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The pure mechanism (types, predicates, derivation, signature, rebuild state machine, assembler) is
complete and fully tested. Plan 38-02 is next: it replaces the assembled slide's one-element
`sections` array with a singular field and reworks `PresentationViewer.vue`'s projected layout — the
comments left in `resolveEntryContent` and the fallback branch explicitly flag this so the
intermediate one-element-array shape isn't "tidied" back into a stacked array. `CongregationalEditor.vue`
and `SlideGrid.vue` (the "make it congregational" affordance and per-slide editing surface) are
untouched by this plan and are presentation/editing-surface work for 38-03/38-04.

No blockers. `npm run type-check` (vue-tsc --build) is clean; the full app suite
(`npx vitest run --dir src --exclude '**/rules.test.ts'`) shows 2458/2467 passing, with the 9 failures
confined to the documented two-file baseline (`src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`) — unchanged from before this plan.

---
*Phase: 38-congregational-readings-become-real-slides*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 8 modified/created source and test files confirmed present on disk; all 3 task commits
(`c0abf57`, `ae67d73`, `8ebc532`) confirmed present in `git log`.
