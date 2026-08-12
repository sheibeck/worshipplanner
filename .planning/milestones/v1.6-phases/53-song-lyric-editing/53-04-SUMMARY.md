---
phase: 53-song-lyric-editing
plan: 04
subsystem: ui
tags: [vue, song-lyrics, paste, ccli, label-copy]

# Dependency graph
requires:
  - phase: 53-song-lyric-editing
    provides: "LyricPasteRegion component with currentSectionCount prop (from SongLyricEditor.vue = sectionRows.length)"
provides:
  - "First-paste-aware commit button label in LyricPasteRegion: 'Save' on a brand-new song (0 sections), 'Replace lyrics' when sections exist, 'Saving...' while a save is in flight"
  - "First-paste-aware footer helper that no longer claims to 'Replace the current 0 sections'"
affects: [song-lyric-editing, paste-lyrics, LyricPasteRegion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Label copy derives from the already-passed currentSectionCount prop — no new prop, no host (SongLyricEditor.vue) change"

key-files:
  created: []
  modified:
    - src/components/LyricPasteRegion.vue
    - src/components/__tests__/LyricPasteRegion.test.ts

key-decisions:
  - "currentSectionCount === 0 is exactly the first-paste state (the empty-state paste CTA is the only way to reach the region with no sections), so no new 'isNewSong' prop is needed"
  - "Footer helper on count 0 shows 'Saving lyrics for this song · undoable from History.' rather than the confusing 'Replaces the current 0 sections' phrasing"

patterns-established:
  - "Idle vs. in-flight vs. first-paste button copy expressed as a single nested ternary keyed on isSaving then currentSectionCount"

requirements-completed: [R121]

coverage:
  - id: D1
    description: "Commit button reads 'Save' on a brand-new song (currentSectionCount === 0)"
    requirement: "R121"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#reads \"Save\" when the song has no sections yet (currentSectionCount === 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Commit button reads 'Replace lyrics' when the song already has sections (currentSectionCount > 0)"
    requirement: "R121"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#reads \"Replace lyrics\" when the song already has sections (currentSectionCount > 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Commit button reads 'Saving...' while a save is in flight, regardless of section count"
    requirement: "R121"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#reads \"Saving...\" while a save is in flight, even on a brand-new song"
        status: pass
    human_judgment: false
  - id: D4
    description: "Footer helper does not claim to replace 0 sections on a first paste"
    requirement: "R121"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#does not claim to replace 0 sections in the footer helper on a first paste"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-11
status: complete
---

# Phase 53 Plan 04: First-Paste "Save" Button Label (R121) Summary

**The paste-lyrics commit button now reads "Save" on a brand-new song (0 sections), "Replace lyrics" once lyrics exist, and "Saving..." while a save is in flight — driven entirely by the existing currentSectionCount prop with no new prop and no SongLyricEditor change.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Commit button (`data-testid="paste-replace-btn"`) idle label is now conditional: "Save" when `currentSectionCount === 0`, "Replace lyrics" otherwise; the `isSaving ? 'Saving...'` state is preserved unchanged.
- Footer helper span no longer shows the confusing "Replaces the current 0 sections" on a first paste — it shows "Saving lyrics for this song · undoable from History." when count is 0, keeping the "Replaces the current N section(s)" wording for count > 0.
- No new prop introduced and `SongLyricEditor.vue` untouched, per the plan gate.

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1 (RED): failing tests for first-paste label** - `ff243f2` (test)
2. **Task 1 (GREEN): conditional 'Save' button label + footer helper** - `cbaeeeb` (feat)

**Plan metadata:** (docs commit — this SUMMARY + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `src/components/LyricPasteRegion.vue` - Commit-button idle label and footer helper span are now conditional on `currentSectionCount`.
- `src/components/__tests__/LyricPasteRegion.test.ts` - Added R121 describe block: 4 tests asserting "Save"/"Replace lyrics"/"Saving..." button copy and that the footer never says "Replaces the current 0 sections".

## Decisions Made
- Used the already-passed `currentSectionCount` prop as the first-paste signal (count 0 = brand-new song); no new `isNewSong` prop, matching the plan's key-link constraint.
- Implemented the button copy as a nested ternary `isSaving ? 'Saving...' : (currentSectionCount === 0 ? 'Save' : 'Replace lyrics')` to preserve the existing saving state exactly.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. The two failing test files in the broad suite gate (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) are the documented known-failing baseline (CLAUDE.md) — an environment limitation and a stale assertion, not a regression from this plan.

## Verification
- `npx vitest run --dir src src/components/__tests__/LyricPasteRegion.test.ts` — 20/20 pass (16 pre-existing + 4 new R121).
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 97 files / 3031 tests pass; exactly 2 files fail (`storage.rules.test.ts`, `RosterView.test.ts`), matching the documented baseline. No new regression.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R121 complete. Phase 53 plans 02 and 03 remain incomplete (independent files).
- Phase-level manual UAT (`53-VALIDATION.md`): on a brand-new song, open paste lyrics and confirm the commit button reads "Save".

## Self-Check: PASSED

- FOUND: src/components/LyricPasteRegion.vue
- FOUND: src/components/__tests__/LyricPasteRegion.test.ts
- FOUND: .planning/phases/53-song-lyric-editing/53-04-SUMMARY.md
- FOUND commit ff243f2 (test — RED)
- FOUND commit cbaeeeb (feat — GREEN)

---
*Phase: 53-song-lyric-editing*
*Completed: 2026-08-11*
