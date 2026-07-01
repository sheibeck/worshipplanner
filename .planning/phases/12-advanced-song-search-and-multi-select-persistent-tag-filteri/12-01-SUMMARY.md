---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
plan: 01
subsystem: search
tags: [vitest, tdd, regex, typescript, song-search]

# Dependency graph
requires: []
provides:
  - "Multi-term AND search engine in songMatchesQuery(song, query)"
  - "Field-scoped prefix syntax: type:/key:/tag:/theme:/team: with space-after-colon tolerance"
  - "Natural two-word phrase recognition: 'Type N' and 'Key X'"
  - "matchesBareTerm() and matchesToken() internal helpers reused by both prefixed and bare tokens"
affects: [12-02, 12-03, 12-04, 12-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query pre-parse pipeline: phrase normalization -> colon-space collapse -> whitespace tokenize -> per-token AND match"
    - "Field-prefix regex dispatch via single anchored capture group regex, switched on prefix name"

key-files:
  created: []
  modified:
    - src/utils/songSearch.ts
    - src/utils/__tests__/songSearch.test.ts

key-decisions:
  - "Kept songMatchesQuery(song, query): boolean signature unchanged so both SongSlotPicker.vue and songs.ts store inherit the upgrade with zero caller changes"
  - "key: prefix and bare key matching remain exact (case-insensitive); all other fields remain substring matches, per D-04"
  - "Phrase pre-parse only recognizes explicit two-word 'type N' / 'key X' forms — a lone bare number or letter is never inferred as a type/key filter, avoiding false positives on song titles containing digits or single letters"

patterns-established:
  - "matchesBareTerm(song, term): boolean extracted as the full-field substring matcher, now reused both for unscoped tokens and as the fallback for any prefix-looking-but-unrecognized token"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07]

# Metrics
duration: 25min
completed: 2026-07-01
---

# Phase 12 Plan 01: Multi-term field-scoped song search Summary

**Rewrote songMatchesQuery into a multi-term AND engine with type:/key:/tag:/theme:/team: field-scoped prefixes and natural "Type 1"/"Key A" phrase recognition, with zero changes to the two existing callers.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T16:53:00Z
- **Completed:** 2026-07-01T21:03:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 8 new field-scoped/phrase/multi-term test cases (25 total tests, all passing) covering every D-01–D-05 requirement in the plan's must_haves
- Implemented phrase pre-parse, colon-space tolerance, tokenization, and per-token AND matching with a clean prefix-dispatch helper
- Verified `key:` filter stays exact (e.g. `key:e` does not match a song whose only key is `Em`), matching the plan's precision requirement (D-04)
- Confirmed zero changes required in `src/stores/songs.ts` or `src/components/SongSlotPicker.vue` — both callers inherit the new syntax automatically (D-07)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — write failing tests for prefixes, phrases, and multi-term AND** - `a63464c` (test)
2. **Task 2: GREEN — implement multi-term AND + prefix parser + phrase pre-parse** - `ef6ee4a` (feat)

_TDD plan: RED then GREEN gate sequence confirmed in git log; no REFACTOR commit was needed — the GREEN implementation was already clean on first pass._

## Files Created/Modified
- `src/utils/songSearch.ts` - Rewrote songMatchesQuery as a tokenize+AND pipeline with phrase pre-parse and field-prefix dispatch; extracted matchesBareTerm() helper; added matchesToken() and FIELD_PREFIX_RE
- `src/utils/__tests__/songSearch.test.ts` - Added `describe('songMatchesQuery — field-scoped + phrases (Phase 12)')` block with 9 new test cases (all existing tests untouched and still passing)

## Decisions Made
- Signature `songMatchesQuery(song: Song, query: string): boolean` kept byte-for-byte identical — this was a hard constraint (D-07) so the picker and Songs panel both get the upgrade with no caller edits
- Used a single anchored `/^(type|key|tag|theme|team):(.*)$/i` regex for prefix detection rather than five separate regexes, dispatched via switch — keeps the ReDoS threat surface minimal per the plan's threat model (T-12-01)
- A dangling prefix with an empty value (e.g. `tag:` alone) is treated as non-constraining (matches everything), mirroring the existing empty-query short-circuit behavior

## Deviations from Plan

None - plan executed exactly as written. The plan's `@.planning/phases/12-.../12-PATTERNS.md` context reference was not present in the worktree at execution time, but the PLAN.md itself contained complete, self-sufficient implementation instructions (task 2's `<action>` block fully specified the algorithm), so no information was missing.

## Issues Encountered
- One unrelated pre-existing test (`src/views/__tests__/ServiceEditorView.test.ts > Print button exists...`) timed out when running the full suite in parallel (test took 4.25s against a 5s timeout under load). Verified in isolation it passes in ~4.2s consistently — a pre-existing timing flake unrelated to songSearch.ts changes, not caused or touched by this plan. Logged as out-of-scope per the scope boundary rule; no fix applied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `songSearch.ts` is ready to be consumed by 12-02 (multi-select persistent tag filtering) and downstream plans in this phase — the underlying matching engine now supports the full D-01–D-05 query grammar
- No blockers for subsequent plans in phase 12

---
*Phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri*
*Completed: 2026-07-01*

## Self-Check: PASSED

All created/modified files and both task commits verified present on disk and in git history.
