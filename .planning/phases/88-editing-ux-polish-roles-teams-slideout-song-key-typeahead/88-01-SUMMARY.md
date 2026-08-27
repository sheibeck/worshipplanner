---
phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
plan: 01
subsystem: ui
tags: [vue, datalist, typeahead, songs]

# Dependency graph
requires:
  - phase: 87-song-rotation-refinements
    provides: SongSlideOver's free-text Key input bound to primaryArrangementKey (R249)
provides:
  - src/constants/keys.ts shared MAJOR_KEYS/MINOR_KEYS constant
  - ArrangementAccordion Key select sourced from the shared constant (no inline literal)
  - SongSlideOver Key input as a native input+datalist typeahead of the 14 major keys, still accepting free entry
affects: [88-02-PLAN, 88-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [native HTML datalist typeahead reused a second time (tags + key), shared constant extraction for cross-component option lists]

key-files:
  created:
    - src/constants/keys.ts
    - src/constants/__tests__/keys.test.ts
    - src/components/__tests__/ArrangementAccordion.test.ts
  modified:
    - src/components/ArrangementAccordion.vue
    - src/components/SongSlideOver.vue
    - src/components/__tests__/SongSlideOver.test.ts

key-decisions:
  - "Extracted MAJOR_KEYS/MINOR_KEYS as byte-identical `as const` arrays — pure extraction, no content change"
  - "SongSlideOver Key input keeps its existing v-model/data-testid/persistence path; only `list` + a sibling <datalist> were added, mirroring the existing tag-suggestion datalist idiom"

patterns-established:
  - "Pattern: shared option-list constants under src/constants/ consumed by both a <select> and an <input list>+<datalist> control"

requirements-completed: [R258]

coverage:
  - id: D1
    description: "ArrangementAccordion's Key <select> Major/Minor optgroups render from the shared src/constants/keys.ts constant instead of an inline literal"
    requirement: R258
    verification:
      - kind: unit
        ref: "src/constants/__tests__/keys.test.ts#keys constants"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ArrangementAccordion.test.ts#renders the Major optgroup options from the shared MAJOR_KEYS constant"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongSlideOver Key field is a native input+datalist typeahead suggesting the 14 major keys while still accepting a free-typed value (e.g. an imported 'Am')"
    requirement: R258
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#renders a datalist of the 14 major keys for the Key input"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#accepts and persists a free-typed key not present in MAJOR_KEYS"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-27
status: complete
---

# Phase 88 Plan 01: Song Key Type-ahead Summary

**Song Key field in SongSlideOver is now a native `<input list>`+`<datalist>` typeahead over a shared 14-key constant, with free entry still accepted; ArrangementAccordion consumes the same constant instead of an inline literal.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-27T04:36:08Z
- **Completed:** 2026-08-27T04:46:47Z
- **Tasks:** 2 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Extracted `src/constants/keys.ts` exporting `MAJOR_KEYS` (14 major roots) and `MINOR_KEYS`, byte-identical to the literals that previously lived inline in `ArrangementAccordion.vue`
- Refactored `ArrangementAccordion.vue` to import the shared constant — no inline `majorKeys`/`minorKeys` literals remain
- Converted `SongSlideOver.vue`'s always-visible Key input into a native `list="ss-key-options"` + `<datalist>` typeahead of `MAJOR_KEYS`, mirroring the file's existing tag-suggestion datalist idiom
- Confirmed free-typed keys not on the list (e.g. `Am`) still persist onto the primary/first arrangement via the unchanged `onSave`/`primaryArrangementKey` path (R249 behavior preserved)

## Task Commits

Each task was committed atomically (both tasks followed RED→GREEN per their `tdd="true"` attribute):

1. **Task 1: Extract the shared key constant and move ArrangementAccordion onto it**
   - `441317fd` (test) — failing tests for `keys.ts` contents + ArrangementAccordion's Major optgroup
   - `85561467` (feat) — `src/constants/keys.ts` created; `ArrangementAccordion.vue` refactored onto it
2. **Task 2: Convert the SongSlideOver Key field to an input+datalist typeahead**
   - `57993ffd` (test) — failing test for the Key input's `list` attribute + datalist options
   - `a44e1fe8` (feat) — `list="ss-key-options"` + `<datalist>` added to SongSlideOver's Key input

**Plan metadata:** (this commit, following SUMMARY.md creation)

_Note: both TDD tasks produced a test commit followed by a feat commit, matching the plan's RED/GREEN cycle._

## Files Created/Modified
- `src/constants/keys.ts` - shared `MAJOR_KEYS`/`MINOR_KEYS` `as const` arrays
- `src/constants/__tests__/keys.test.ts` - pins the constant contents and order
- `src/components/ArrangementAccordion.vue` - imports `MAJOR_KEYS`/`MINOR_KEYS` instead of declaring them inline
- `src/components/__tests__/ArrangementAccordion.test.ts` - asserts the Major optgroup renders from the shared constant
- `src/components/SongSlideOver.vue` - Key input gains `list="ss-key-options"` + a sibling `<datalist>` of `MAJOR_KEYS`
- `src/components/__tests__/SongSlideOver.test.ts` - two new tests (datalist rendering, free-typed key persistence) added to the existing "key (R249)" describe block

## Decisions Made
- Kept the extraction byte-identical (same 14/12 values, same order) — this task is a pure refactor of the source of truth, not a content change to the key lists.
- Did not add minor keys to the SongSlideOver datalist (owner decision, recorded in 88-CONTEXT.md: major roots + free entry only).
- Left the `primaryArrangementKey` computed, the "Primary key" select, and the `onSave` payload untouched — R258 only changes how the Key value is suggested, not how it's bound or persisted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/constants/keys.ts` is now available for 88-02/88-03 (or any future phase) to reuse if a key-related control is needed elsewhere.
- Full targeted verification (`npx vitest run src/constants/__tests__/keys.test.ts src/components/__tests__/ArrangementAccordion.test.ts src/components/__tests__/SongSlideOver.test.ts`) is green: 3 files, 25 tests.
- `npm run type-check` (vue-tsc --build) is clean.
- Ran the full bare `npx vitest run` suite as a broader regression check: 151/153 files pass; the 2 failing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) are the pre-existing documented baseline in CLAUDE.md, unrelated to this plan's changes.
- No blockers for 88-02 (Roles/Teams slideout, R257).

---
*Phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead*
*Completed: 2026-08-27*

## Self-Check: PASSED

All created/modified files found on disk; all 5 commits (`441317fd`, `85561467`, `57993ffd`, `a44e1fe8`, `f43dfd08`) verified present in git log.
