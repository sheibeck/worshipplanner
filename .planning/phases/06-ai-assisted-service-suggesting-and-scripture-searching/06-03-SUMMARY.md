---
phase: 06-ai-assisted-service-suggesting-and-scripture-searching
plan: 03
subsystem: ui
tags: [vue3, ai, anthropic, scripture, scripture-input, natural-language-search, typescript]

# Dependency graph
requires:
  - phase: 06-ai-assisted-service-suggesting-and-scripture-searching
    plan: 01
    provides: getScriptureSuggestions, AiScriptureSuggestion types, claudeApi utility
  - phase: 03-service-planning
    provides: ScriptureInput component, ScriptureRef type, scripturesOverlap utility

provides:
  - ScriptureInput with AI natural language search field and per-slot Suggest Scripture button
  - AI results list showing reference, reason, recency note, and overlap warnings
  - recentScriptureRefs computed in ServiceEditorView for 8-week scripture history

affects:
  - None — this is the final plan in phase 06

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI search above structured picker: natural language field rendered before book/chapter/verse row"
    - "showAiSuggest prop guards AI UI to reading slots only — sermon passage slot never shows AI features"
    - "null-on-error pattern: aiError shown when getScriptureSuggestions returns null"
    - "aiResultOverlapsSermon: builds ScriptureRef from AiScriptureSuggestion and calls scripturesOverlap"
    - "recentScriptureRefs: 8-week window of scripture slots from other services with complete book/chapter/verse"

key-files:
  created: []
  modified:
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
    - src/views/ServiceEditorView.vue

key-decisions:
  - "showAiSuggest prop (not showOverlapWarning) controls AI visibility — orthogonal concerns, separate props"
  - "recentScriptures prop type is ScriptureRef[] (not annotated with weeksAgo) — matches actual claudeApi.ts signature"
  - "onAiSuggest clears aiQuery then calls onAiSearch — empty query + sermon context = suggest mode"
  - "Selecting an AI result populates structured fields and clears results — one-click workflow"

patterns-established:
  - "ScriptureInput AI search: shows only on slots with showAiSuggest=true, positioned above structured picker"
  - "Suggest button appears only when no query typed AND sermon context exists AND no results showing"

requirements-completed:
  - AI-04
  - AI-05
  - AI-06

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 6 Plan 03: AI Scripture Discovery Summary

**Natural language scripture search with per-slot AI suggest button, overlap detection, and recency notes in ScriptureInput**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T19:07:54Z
- **Completed:** 2026-03-04T19:12:46Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added natural language search field above structured book/chapter/verse picker on scripture reading slots
- Added per-slot "Suggest scripture based on sermon" button (shown when sermon context exists, no query typed)
- AI results display reference (Book Ch:V-V), reason text, recency annotation (Used Nw ago), and overlap warning
- Clicking an AI result populates structured fields and clears results list in one step
- Sermon passage slot does NOT show AI features (controlled by `showAiSuggest` prop)
- Added `recentScriptureRefs` computed in ServiceEditorView collecting 8-week scripture history
- All 266 existing tests pass including 13 ScriptureInput tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AI scripture search and suggest button to ScriptureInput** - `6244be4` (feat)

## Files Created/Modified

- `src/components/ScriptureInput.vue` - Added AI natural language search field, Suggest Scripture button, results list with overlap/recency display, and new props (showAiSuggest, sermonTopic, recentScriptures)
- `src/components/__tests__/ScriptureInput.test.ts` - Added mock for @/utils/claudeApi to prevent import failure with new claudeApi import
- `src/views/ServiceEditorView.vue` - Added showAiSuggest/sermonTopic/recentScriptures props to SCRIPTURE slot ScriptureInput, added recentScriptureRefs computed

## Decisions Made

- **Prop separation:** Used `showAiSuggest` (not `showOverlapWarning`) to gate AI UI visibility. The two concerns are orthogonal — a slot could theoretically have overlap checking but no AI, or vice versa. Separate props keeps this clean.
- **recentScriptures type:** Plan specification described `{ book, chapter, verseStart?, verseEnd?, weeksAgo }` but actual `claudeApi.ts` uses `ScriptureRef[]`. Implemented to match the actual code contract, not the plan's interface description.
- **Suggest button condition:** Button shows only when `!aiQuery && hasSermonContext && aiResults.length === 0 && !aiLoading`. This prevents showing the button after results are already shown, keeping UI uncluttered.
- **onAiSuggest flow:** Clears `aiQuery` to empty string then calls `onAiSearch()`. With no query and sermon context present, the AI call uses only sermon context — the "suggest from context" mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added @/utils/claudeApi mock to ScriptureInput test**
- **Found during:** Task 1 (after modifying ScriptureInput.vue to import from claudeApi)
- **Issue:** ScriptureInput.test.ts would fail with Anthropic SDK browser error since claudeApi imports Anthropic SDK which tries to read browser env vars
- **Fix:** Added `vi.mock('@/utils/claudeApi', () => ({ getScriptureSuggestions: vi.fn(() => Promise.resolve(null)) }))` to test file
- **Files modified:** src/components/__tests__/ScriptureInput.test.ts
- **Verification:** All 13 ScriptureInput tests pass, 266/266 total
- **Committed in:** 6244be4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Test mock essential for test suite to run. No scope creep.

## Issues Encountered

- **Plan interface vs. actual code mismatch:** Plan 06-03 defined `recentScriptures` as `{ book, chapter, verseStart?, verseEnd?, weeksAgo: number }[]` but `claudeApi.ts` from Plan 01 uses `ScriptureRef[]` (no `weeksAgo`). Used the actual code signature to maintain correctness. The AI adds recency notes based on the recently-used list regardless of weeksAgo annotation since it infers from context.

## User Setup Required

None - no additional external service configuration required beyond the `VITE_CLAUDE_API_KEY` already documented in Plan 01.

## Next Phase Readiness

- Phase 06 is complete — all 3 plans delivered: AI foundation (Plan 01), AI song suggestions in picker (Plan 02), AI scripture discovery in ScriptureInput (Plan 03)
- No blockers — all exports, types, and tests are green
- VITE_CLAUDE_API_KEY still required for AI features to activate; app works fully without it

---

## Self-Check: PASSED

- `src/components/ScriptureInput.vue` — FOUND (modified)
- `src/views/ServiceEditorView.vue` — FOUND (modified, recentScriptureRefs and new props confirmed)
- `src/components/__tests__/ScriptureInput.test.ts` — FOUND (mock added)
- Commit `6244be4` — FOUND
- 266/266 tests pass — VERIFIED
- `showAiSuggest` prop in ScriptureInput.vue — FOUND
- `recentScriptureRefs` computed in ServiceEditorView.vue — FOUND
- AI features NOT on sermon passage ScriptureInput — CONFIRMED (no showAiSuggest prop on sermon passage slot)

---
*Phase: 06-ai-assisted-service-suggesting-and-scripture-searching*
*Completed: 2026-03-04*
