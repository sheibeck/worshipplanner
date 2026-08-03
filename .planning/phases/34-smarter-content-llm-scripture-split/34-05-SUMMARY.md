---
phase: 34-smarter-content-llm-scripture-split
plan: 05
subsystem: content-model
tags: [vue, typescript, vitest, scripture, slideshow-assembler, congregational-reading]

# Dependency graph
requires:
  - phase: 34-smarter-content-llm-scripture-split (plans 01-03)
    provides: structural R064 guarantees (schema/validator/boundaries) and the CorrectedPremise that congregational sections render as ONE slide, not N
provides:
  - "ScriptureSlot.congregationalSections?: CongregationalSection[] — a place for a congregational reading to live on the slot itself"
  - "congregationalSlideFieldsFromSlot — the single congregational-ness predicate, source-inspected for byte-exactness"
  - "scriptureSlotAfterReferenceChange — the reference write plus the stale-reading clearing rule, in one place"
  - "Both slideshowAssembler scripture call sites reading congregational fields through the shared helper, with dual-path parity proven by test"
  - "Executable proof that slideGroupMaterializer.ts needs no structural change"
affects: [34-06, 34-07, presentation-viewer, service-editor-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single congregational-ness predicate consumed by both assembler call sites via object spread, avoiding the two-competing-fields defect class (Phase 28, Phase 33)"
    - "Pure passthrough helper proven byte-exact by .toString() source inspection, mirroring scriptureBoundaries.test.ts's sliceAtBoundaries technique"
    - "Clearing rule owned by one function (scriptureSlotAfterReferenceChange) rather than duplicated at each call site"

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/utils/scripture.ts
    - src/utils/__tests__/scripture.test.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts

key-decisions:
  - "congregationalSlideFieldsFromSlot ignores ScriptureSlot.readingMode entirely — gating on both readingMode and a non-empty sections array would create two fields that can disagree (Phase 28/33 defect shape). The predicate is: sections present and non-empty means congregational, matching PresentationViewer's isCongregational computed exactly."
  - "scriptureSlotAfterReferenceChange compares formatted reference strings via the canonical formatScriptureReference/scriptureRefFromSlot pair rather than a second inline book/chapter/verse comparison (ME-02 one-formatter rule)."
  - "slideGroupMaterializer.ts is left untouched — congregationalSections resolves live off the slot at assembly time (mirroring how book/chapter already do), so the stored group entry stays payload-free and the source signature stays byte-identical across section edits. Verified by test, not assumed."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "ScriptureSlot gains an optional congregationalSections field carrying the existing CongregationalSection[] type"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "congregationalSlideFieldsFromSlot is the single congregational-ness predicate: absent/empty sections yield normal mode with no own 'sections' property; populated sections yield congregational mode with the stored array by reference; proven byte-exact by source inspection and a non-ASCII strict === round-trip"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scripture.test.ts#congregationalSlideFieldsFromSlot"
        status: pass
    human_judgment: false
  - id: D3
    description: "scriptureSlotAfterReferenceChange writes the four reference fields and clears congregationalSections when (and only when) the formatted reference actually changes, using null-ref clearing too"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scripture.test.ts#scriptureSlotAfterReferenceChange"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both slideshowAssembler scripture call sites (resolveEntryContent stored-group path and the SCRIPTURE fallback branch) spread congregationalSlideFieldsFromSlot(slot), proven deep-equal by a single dual-path parity test for both the congregational and backward-compatible cases"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — congregational reading (R064)"
        status: pass
    human_judgment: false
  - id: D5
    description: "slideGroupMaterializer.ts requires no structural change — deriveGroupEntries stays payload-free/singular and sourceSignature stays byte-identical across differing congregationalSections — proven by executable assertion and a git diff --exit-code check"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#R064 — congregationalSections requires no structural change to slideGroupMaterializer"
        status: pass
      - kind: other
        ref: "git diff --exit-code -- src/utils/slideGroupMaterializer.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 05: Congregational Reading Data Model and Dual-Path Assembly Summary

**`ScriptureSlot.congregationalSections` plus one shared predicate helper threaded through both `slideshowAssembler.ts` scripture call sites, with `slideGroupMaterializer.ts` proven — not assumed — to need no change**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-03T22:43:00Z
- **Completed:** 2026-08-03T23:38:05Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `ScriptureSlot.congregationalSections?: CongregationalSection[]` added — the slot itself is now the source of truth for a congregational reading, no separate `ScriptureReading` document required (the model R047 explicitly rejected).
- `congregationalSlideFieldsFromSlot(slot)` is the single congregational-ness predicate in the entire slot→slide path: a pure passthrough (no copy/sort/filter/map/slice/string-transform of any kind), proven byte-exact by a `.toString()` source-inspection test and a strict `===` non-ASCII round-trip covering curly quotes and an em dash.
- `scriptureSlotAfterReferenceChange(slot, ref)` owns both the four-field reference write (`book`/`chapter`/`verseStart`/`verseEnd`) and the stale-reading clearing rule: a stored congregational reading is dropped (own-property absent, not set to `[]`) exactly when the formatted reference changes, using the canonical `formatScriptureReference`/`scriptureRefFromSlot` pair rather than a second inline comparison.
- Both `slideshowAssembler.ts` scripture branches — `resolveEntryContent`'s stored-group path and the SCRIPTURE fallback branch — now spread `congregationalSlideFieldsFromSlot(slot)` as the last entry in their `ScriptureSlide` literal, replacing the hardcoded `readingMode: 'normal'`. A single parity test assembles one slot fixture through both paths and asserts deep equality, for both the congregational and no-sections cases.
- `slideGroupMaterializer.ts` needed no structural change. That claim is now backed by an executable test (payload-free singular entry, byte-identical `sourceSignature` across differing sections) plus a `git diff --exit-code` check proving the file is untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ScriptureSlot.congregationalSections and the two pure scripture helpers** - `42c11b1` (feat)
2. **Task 2: Route BOTH slideshowAssembler scripture call sites through the shared helper** - `133e1df` (feat)
3. **Task 3: Prove — not assume — that slideGroupMaterializer needs no structural change** - `1d065cf` (test)

**Plan metadata:** (this commit) `docs(34-05): complete congregational reading data model plan`

## Files Created/Modified
- `src/types/service.ts` - `ScriptureSlot.congregationalSections?: CongregationalSection[]` added (imports the type from `@/types/slide`, no new type declared)
- `src/utils/scripture.ts` - `congregationalSlideFieldsFromSlot` and `scriptureSlotAfterReferenceChange` exported
- `src/utils/__tests__/scripture.test.ts` - 20 new tests across two describe blocks (56 total in the file, up from 36)
- `src/utils/slideshowAssembler.ts` - both scripture branches spread the shared helper instead of a hardcoded normal-mode literal
- `src/utils/__tests__/slideshowAssembler.test.ts` - 7 new tests in a `congregational reading (R064)` describe block (74 total, up from 67)
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - 3 new tests proving no structural change is needed (88 total, up from 85); `src/utils/slideGroupMaterializer.ts` itself is byte-unchanged

## Decisions Made
- **One predicate, not two fields.** `congregationalSlideFieldsFromSlot` ignores `ScriptureSlot.readingMode` entirely (it's declared but written by no code today) and gates purely on `congregationalSections` being a non-empty array — matching `PresentationViewer.vue`'s already-shipped `isCongregational` computed exactly. Gating on both fields would reproduce the Phase 28 (`performanceOrder`) / Phase 33 disagreeing-fields defect shape.
- **One canonical formatter for the clearing comparison.** `scriptureSlotAfterReferenceChange` compares formatted strings via `formatScriptureReference` on both sides rather than writing a second inline book/chapter/verse comparison, per the ME-02 "one canonical formatter" rule that previously caught a null-verseEnd formatting bug.
- **No change to `slideGroupMaterializer.ts`.** Sections resolve live off the slot at assembly time — exactly how `book`/`chapter` already do — so the stored group entry stays payload-free (preserving `carryStoredDerivedEntries`'s id/audio carry-forward) and `sourceSignature` stays byte-identical across section edits (so editing a reading never triggers a group rebuild that would mint fresh entry ids and drop attached audio). This was PATTERNS.md's stated hypothesis; this plan converts it into a passing, executable test rather than leaving it as an unverified assumption.

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their behavior lists, and their acceptance criteria were implemented and verified as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ScriptureSlot.congregationalSections` and its two helpers are ready for `34-07` (`ServiceEditorView.onScriptureChange` will call `scriptureSlotAfterReferenceChange` instead of its current inline four-field spread) and `34-06` (mounting `CongregationalEditor.vue` against a slot-based persistence model instead of the rejected separate `ScriptureReading` document).
- `PresentationViewer.vue`'s `isCongregational` computed (Phase 35, unchanged by this plan) now has real upstream data to render: a slot with `congregationalSections` produces exactly one `readingMode: 'congregational'` slide carrying the full `sections` array, which is the shape that component already expects.
- No blockers. Verification suite (`scripture.test.ts` + `slideshowAssembler.test.ts` + `slideGroupMaterializer.test.ts`, 218 tests) is green, `npm run type-check` (`vue-tsc --build`) exits 0, and `git diff --exit-code -- src/utils/slideGroupMaterializer.ts` confirms zero production changes to that file. No file under `src/components/`, `src/views/`, or `functions/` was touched.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 6 modified/created files verified present on disk; all 3 task commits (`42c11b1`, `133e1df`, `1d065cf`) verified present in git log.
