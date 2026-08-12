---
phase: 53-song-lyric-editing
plan: 03
subsystem: ui
tags: [vue, typescript, song-lyrics, slideBreaks, section-numbering, editor, tdd]

# Dependency graph
requires:
  - phase: 53-song-lyric-editing (plan 01)
    provides: "SectionRow.displayLabel (per-kind position ordinal), LyricSection.slideBreaks, sliceSectionIntoSlides, 'Pre-Chorus' in ADD_SECTION_KINDS"
  - phase: 28-song-lyrics-editor-rework
    provides: "SongLyricEditor.vue pool/order editor, editableState + doAutoSave one-write autosave"
provides:
  - "Editor renders the derived per-kind displayLabel at both section-label sites (R120) — the bare-'Verse' bug is gone"
  - "Pre-Chorus palette chip renders + numbers as 'Pre-Chorus 1' via the existing ADD_SECTION_KINDS v-for (R119)"
  - "Manual click-between-lines split affordance authoring section.slideBreaks (sorted, de-duped, toggle) persisted by the existing autosave (R117 authoring)"
  - "onSectionInput prunes now-out-of-range slideBreaks at the write source (T-53-07); isDirty compares slideBreaks so a divider-only edit autosaves"
affects: [53-verification, slideshowAssembler, song-lyric-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Editor is a thin consumer of Plan 01's pure helpers — no numbering or slicing logic re-implemented in the component"
    - "Split authored as additive line-index metadata over the canonical `lines`; textarea remains the single text source, dividers never copy words"
    - "Write-source pruning (onSectionInput) complements the read-time clamp in sliceSectionIntoSlides so a stale break can never be persisted"

key-files:
  created: []
  modified:
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts

key-decisions:
  - "Rendered row.displayLabel at both label sites; stored section.label and the autosave payload are untouched (render-only, BWC)"
  - "Divider control writes through editableState; removing the last break deletes the slideBreaks field so an unsplit section persists nothing new"
  - "Extended isDirty to compare slideBreaks (a divider-only click must register dirty or the autosave skips it) — a necessary correctness addition, see Deviations"

patterns-established:
  - "data-testid `row-split-divider-<sectionId>-<k>` targets the divider before line k; data-active reflects whether k is an active break"
  - "Split affordance is song-local (not a shared component), mirroring the congregational click-between-lines interaction per research"

requirements-completed: [R117, R119, R120]

coverage:
  - id: D1
    description: "The editor renders the derived per-kind displayLabel at both the non-repeat and repeat label sites; pasting 'Verse 1'/'Verse 2' then adding a Verse shows 'VERSE 3'; a repeat row shows its origin's number; stored labels untouched (R120)"
    requirement: "R120"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R120: adding a Verse after pasted \"Verse 1\"/\"Verse 2\" shows \"VERSE 3\""
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R120: a repeat row shows the SAME derived number as the origin row"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Pre-Chorus chip renders in the add palette and adds a section that displays 'PRE-CHORUS 1' via the existing ADD_SECTION_KINDS v-for (R119)"
    requirement: "R119"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R119: the Pre-Chorus chip adds a section that displays \"PRE-CHORUS 1\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Expanded non-repeat section exposes between-line divider controls that toggle section.slideBreaks (sorted, de-duped, toggle-off); slice yields N groups; text edit prunes out-of-range breaks; unsplit section keeps the field absent; writes persist through the existing autosave (R117 authoring)"
    requirement: "R117"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R117: clicking the divider before line 2 writes slideBreaks [2] and slices into 2 groups"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R117: a second distinct divider click adds its index sorted+de-duped; clicking an active divider toggles it off"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R117: editing the text down to fewer lines drops now-out-of-range slideBreaks"
        status: pass
    human_judgment: false
  - id: D4
    description: "End-to-end split/numbering feel with a real multi-repeat song: split an 8-line chorus into two 4-line slides by hand and confirm the projected output; confirm the Pre-Chorus/numbering read on real pasted data"
    verification: []
    human_judgment: true
    rationale: "Component tests prove the DOM wiring and the persisted slideBreaks/displayLabel, but the authoring feel over real pasted song data and the projected split output need a human UAT pass (53-VALIDATION.md); deferred per the v1.6 standing autonomy grant."

# Metrics
duration: 20min
completed: 2026-08-11
status: complete
---

# Phase 53 Plan 03: Editor UI (R117/R119/R120) Summary

**SongLyricEditor now renders Plan 01's derived per-kind `displayLabel` (killing the bare-"Verse" bug), surfaces the Pre-Chorus palette chip, and adds a manual click-between-lines split affordance that authors `section.slideBreaks` through the existing one-write autosave.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-11T22:20:57Z
- **Completed:** 2026-08-11T22:47:00Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 2

## Accomplishments
- **R120:** Replaced `row.section.label.toUpperCase()` with `row.displayLabel.toUpperCase()` at both the non-repeat (:120) and repeat (:155) label sites. The editor now shows the per-kind position ordinal from Plan 01's `buildSectionRows` — a Verse added after pasted "Verse 1"/"Verse 2" renders "VERSE 3" (not bare "VERSE"), and a repeat row shares its origin's number. The stored `section.label` and the autosave payload are byte-identical to before (render-only, BWC).
- **R119:** Confirmed and locked with tests that the "Pre-Chorus" chip flows through the existing `v-for="kind in ADD_SECTION_KINDS"` palette — no template change needed — and that adding it produces a section displaying "PRE-CHORUS 1".
- **R117 authoring:** Added a manual slide-split affordance to the expanded non-repeat section body: a per-line list with a clickable divider between each pair of adjacent lines (`row-split-divider-<sectionId>-<k>`). Clicking toggles the line index in `section.slideBreaks`, kept sorted and de-duped; clicking an active divider removes it. Writes go through `editableState` so the existing `doAutoSave` persists `slideBreaks` alongside `performanceOrder` in one call. Removing the last break deletes the field, so an unsplit section persists nothing new.
- **R117 write-safety (T-53-07):** `onSectionInput` now prunes `slideBreaks` to `k in [1, lines.length)` after every text edit — the write-source complement to `sliceSectionIntoSlides`'s read-time clamp, so a stale index can never be persisted or slice into emptiness.

## Task Commits

Each task was executed TDD-first (RED test commit, then GREEN implementation commit):

1. **Task 1: Render derived numbering + confirm Pre-Chorus palette (R120, R119)** — `4a3d667` (test), `2700b49` (feat)
2. **Task 2: Manual click-between-lines split affordance writes slideBreaks (R117)** — `7744a8a` (test), `c664bb6` (feat)

**Plan metadata:** docs commit (this SUMMARY + STATE + ROADMAP).

## Files Created/Modified
- `src/components/SongLyricEditor.vue` — render `displayLabel` at both label sites; add the between-line split affordance (template + `toggleSlideBreak`/`isSlideBreak`/`pruneSlideBreaks`); extend `isDirty` and `onSectionInput` for `slideBreaks`; add static `SPLIT_DIVIDER_CLASSES`/`SPLIT_LABEL_CLASSES` maps.
- `src/components/__tests__/SongLyricEditor.test.ts` — RED-first coverage: derived-number render (Verse 3, repeat shares number), Pre-Chorus add ("PRE-CHORUS 1"), split divider render/toggle/slice, write-source pruning, unsplit-keeps-field-absent, and a divider-only-click marks-dirty assertion.

## Decisions Made
- Consume Plan 01's `displayLabel` rather than re-derive numbering in the component (per plan gate) — stored label stays immutable.
- Song-local split affordance (not a shared component), mirroring the congregational click-between-lines interaction per 53-RESEARCH.
- Delete the `slideBreaks` field when the last break is toggled off (and when pruning empties it) so a never-split section is byte-identical to today.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Extended `isDirty` to compare `slideBreaks`**
- **Found during:** Task 2 (split affordance)
- **Issue:** The plan directs writing `slideBreaks` "through `editableState` so the existing autosave persists it." But `doAutoSave` only fires when `useAutoSave`'s `isDirty` computed is true, and `isDirty` compared only `id`, `label`, and `lines` — not `slideBreaks`. A divider-only click (no text change) would leave `isDirty` false, so the autosave would silently skip persisting the split. Without this, R117 authoring does not actually save.
- **Fix:** Added a `slideBreaks` length+element comparison to `isDirty`'s per-section loop (treating absent as `[]`).
- **Files modified:** src/components/SongLyricEditor.vue
- **Verification:** New test "R117: a divider-only click makes the document dirty so the existing autosave persists it" asserts `isDirty.value` flips false → true on a divider click; passes.
- **Committed in:** `c664bb6` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical). No scope creep — the addition is exactly what makes the plan's "persisted by the existing autosave" claim true.
**Impact on plan:** Necessary for R117 authoring to persist; confined to the dirty-check, no new save path.

## Issues Encountered
None during planned work. The broad-suite run reports the documented 2-file baseline failing (`src/storage.rules.test.ts` — Storage-emulator cross-service limitation, all tests fail without an emulator up; `src/views/__tests__/RosterView.test.ts` — stale assertion). Proven unrelated: re-running the broad suite with those two files (and `rules.test.ts`) excluded is 97 files / 3035 tests green, 0 failures.

## Verification Gates (all passed)
- `npx vitest run --dir src src/components/__tests__/SongLyricEditor.test.ts` — 79/79 pass (11 new tests across both tasks).
- `npm run type-check` (vue-tsc --build, typechecks tests too) — clean.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — only the documented 2-file baseline fails; excluding the baseline confirms 3035 pass / 0 fail. No regression introduced.

## Next Phase Readiness
- **Assembler (Plan 02, already complete):** consumes `sliceSectionIntoSlides` over the `slideBreaks` this editor now authors — the authoring and resolution seams are joined.
- **Phase 53 verification:** deliverable D4 (authoring feel + projected split output on real song data) is deferred to a human UAT pass per the v1.6 standing autonomy grant.
- No blockers.

## Self-Check: PASSED

- `.planning/phases/53-song-lyric-editing/53-03-SUMMARY.md`, `src/components/SongLyricEditor.vue`, `src/components/__tests__/SongLyricEditor.test.ts` — all present on disk.
- Commits `4a3d667`, `2700b49`, `7744a8a`, `c664bb6` — all present in git history.

---
*Phase: 53-song-lyric-editing*
*Completed: 2026-08-11*
