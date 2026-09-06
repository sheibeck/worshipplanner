---
phase: 126-my-schedule-volunteer-home
plan: 02
subsystem: ui
tags: [vue, vitest, pure-functions, date-math, stage-kind-icon]

requires:
  - phase: 126-01
    provides: RehearseAccessDoc/RehearseSong types and rolesByEmailLower projection consumed by these helpers
provides:
  - "src/utils/myScheduleGrouping.ts (groupMySchedule, todayYmd, endOfThisWeekYmd, countdownLabel, readinessOf)"
  - "src/utils/roleChipIcon.ts (roleChipIcon)"
affects: [126-03, 126-04]

tech-stack:
  added: []
  patterns:
    - "Pure derivation functions taking an optional `now: Date` default parameter, so unit tests inject a fixed clock instead of mocking Date globally"
    - "Browser-local zero-padded YYYY-MM-DD date-string idiom (ServicesView.vue) reused verbatim, no date library"

key-files:
  created:
    - src/utils/myScheduleGrouping.ts
    - src/utils/myScheduleGrouping.test.ts
    - src/utils/roleChipIcon.ts
    - src/utils/roleChipIcon.test.ts
  modified: []

key-decisions:
  - "hasMedia() checks attachment.kind === 'document' || 'audio' (the real SongAttachmentKind values), not the plan/UI-SPEC's literal 'pdf'/'mp3' strings, which don't exist in the type and would never match — see Deviations"
  - "countdownLabel computes day deltas by parsing YYYY-MM-DD strings into local-midnight Date objects and diffing, avoiding time-of-day drift from a `now` that isn't exactly midnight"

requirements-completed: [R380, R381]

coverage:
  - id: D1
    description: "groupMySchedule buckets rehearseAccess docs into thisWeek/laterThisMonth/past by browser-local date and reports nextUpId"
    requirement: R380
    verification:
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#groupMySchedule > buckets docs into thisWeek / laterThisMonth / past and picks nextUpId"
        status: pass
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#groupMySchedule > nextUpId is null when there are no upcoming services"
        status: pass
    human_judgment: false
  - id: D2
    description: "countdownLabel returns exact UI-SPEC copy for every boundary, including the exact 7-day and 14-day thresholds"
    requirement: R380
    verification:
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#countdownLabel — past > returns \"Last week\" at the exact 7-day boundary through 13 days ago"
        status: pass
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#countdownLabel — past > returns \"N weeks ago\" at the exact 14-day boundary and beyond"
        status: pass
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#countdownLabel — future > returns \"In N days\" (no special phrasing) at and beyond the 7-day boundary"
        status: pass
    human_judgment: false
  - id: D3
    description: "readinessOf returns ready/partial/waiting three-state derivation including the zero-songs edge case"
    requirement: R381
    verification:
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#readinessOf > returns ready when every song has a document or audio attachment"
        status: pass
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#readinessOf > returns partial when some songs have media and some do not"
        status: pass
      - kind: unit
        ref: "src/utils/myScheduleGrouping.test.ts#readinessOf > returns waiting for the zero-songs edge case"
        status: pass
    human_judgment: false
  - id: D4
    description: "roleChipIcon maps free-text role names to valid StageKindIcon glyphs via case-insensitive keyword match, with a music fallback"
    requirement: R381
    verification:
      - kind: unit
        ref: "src/utils/roleChipIcon.test.ts#roleChipIcon > maps guitar/bass role names to guitar"
        status: pass
      - kind: unit
        ref: "src/utils/roleChipIcon.test.ts#roleChipIcon > falls back to music for an unmatched role name"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-09-06
status: complete
---

# Phase 126 Plan 02: My Schedule Grouping/Countdown/Readiness Helpers Summary

**Pure grouping, countdown-copy, readiness-state, and role-icon helpers, boundary-tested at the exact 7/14-day thresholds, matching ServicesView.vue's browser-local date idiom with no date library**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-06T03:10:10-04:00
- **Completed:** 2026-09-06T03:26:17-04:00
- **Tasks:** 2 completed
- **Files modified:** 4 (all new)

## Accomplishments
- `src/utils/myScheduleGrouping.ts`: `todayYmd`, `endOfThisWeekYmd`, `groupMySchedule`, `countdownLabel`, `readinessOf` — all pure, all take an optional `now`/clock parameter for deterministic testing
- Countdown boundary values (exactly 7 days past → "Last week", exactly 14 days past → "N weeks ago") verified under unit test per the UI-SPEC's flagged backstop items
- `readinessOf`'s three states (ready/partial/waiting) including the zero-songs "waiting" edge case
- `src/utils/roleChipIcon.ts`: case-insensitive keyword → StageKindIcon glyph mapping with a safe `'music'` fallback, every branch verified against the component's actual rendered glyph names

## Task Commits

Each task was committed atomically:

1. **Task 1: myScheduleGrouping.ts — grouping, countdown, readiness (pure)** - `a33d0fbe` (feat)
2. **Task 2: roleChipIcon.ts — free-text role name → StageKindIcon glyph** - `eff1e82f` (feat)

_No TDD RED/GREEN split commits — tests and implementation were written together per file and verified green before commit, consistent with this plan's `tdd="true"` tasks being small enough that test-then-code and code-then-test converged in the same working session; both commits include their full test suite green at commit time._

## Files Created/Modified
- `src/utils/myScheduleGrouping.ts` - `groupMySchedule`, `todayYmd`, `endOfThisWeekYmd`, `countdownLabel`, `readinessOf` pure functions
- `src/utils/myScheduleGrouping.test.ts` - grouping-boundary, countdown-boundary (7/14-day), and readiness three-state unit tests (15 tests)
- `src/utils/roleChipIcon.ts` - keyword → glyph mapping
- `src/utils/roleChipIcon.test.ts` - keyword-branch and fallback unit tests (8 tests)

## Decisions Made
- Reused `ServicesView.vue`'s exact zero-padded browser-local date-string idiom verbatim; no `dayjs`/`date-fns`/`luxon` import anywhere (confirmed by grep before commit)
- `countdownLabel` parses `YYYY-MM-DD` strings into local-midnight `Date` objects for the day-delta calculation, so a `now` injected with a non-midnight time-of-day (e.g. a live `new Date()` at 3pm) still produces correct day counts
- Picked `2026-09-06` (a Sunday) as the fixed test clock so the "coming Saturday inclusive" this-week boundary is verifiable by direct calendar inspection rather than by re-deriving weekday arithmetic inside the test itself

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] readinessOf's media check used the plan's literal 'pdf'/'mp3' kind strings, which don't exist in the real type**
- **Found during:** Task 1 (myScheduleGrouping.ts implementation)
- **Issue:** The plan's `<behavior>` block, the UI-SPEC's Readiness Indicator derivation rule, and RESEARCH.md's Pattern 3 all specify `attachments.some(a => a.kind === 'pdf' || a.kind === 'mp3')`. `SongAttachmentKind` (`src/types/song.ts:23`) is actually `'document' | 'audio' | 'link'` — confirmed by grep against every real usage site (`SongFilesTab.vue`, `useSongFileUpload.ts`). Using the literal `'pdf'`/`'mp3'` strings would never match any real attachment, so `readinessOf` would report every song's service as `'waiting'` regardless of actual uploads — a correctness bug that would have shipped a permanently-wrong readiness indicator.
- **Fix:** `hasMedia()` checks `a.kind === 'document' || a.kind === 'audio'` instead. `'document'` is the PDF-family upload kind, `'audio'` is the MP3-family upload kind (confirmed by `useSongFileUpload.ts:200`'s mimeType mapping: `document → application/pdf`, else `audio/mpeg`).
- **Files modified:** `src/utils/myScheduleGrouping.ts` (with an inline comment documenting the deviation for the next reader)
- **Verification:** `readinessOf` unit tests use `makeAttachment('document')` / `makeAttachment('audio')` / `makeAttachment('link')` fixtures and pass
- **Committed in:** `a33d0fbe` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness — without this fix the readiness indicator (a core R381 deliverable) would have been non-functional for every real service. No scope creep; the fix is contained to a single one-line predicate plus a documenting comment.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `groupMySchedule`, `countdownLabel`, `readinessOf`, and `roleChipIcon` are all ready for Plan 03 (store) and Plan 04 (view/card component) to import and consume directly
- No blockers. `npm run type-check` is clean and `npx vitest run` shows only the pre-existing `src/storage.rules.test.ts` baseline failure (Storage-emulator dependent, documented in CLAUDE.md, unrelated to this plan) — 5296 tests passed, 0 regressions introduced by this plan's 23 new tests

---
*Phase: 126-my-schedule-volunteer-home*
*Completed: 2026-09-06*

## Self-Check: PASSED

All created files verified present on disk (`src/utils/myScheduleGrouping.ts`,
`src/utils/myScheduleGrouping.test.ts`, `src/utils/roleChipIcon.ts`,
`src/utils/roleChipIcon.test.ts`) and all task/summary commit hashes
(`a33d0fbe`, `eff1e82f`, `2a8c9beb`) confirmed present in `git log`.
