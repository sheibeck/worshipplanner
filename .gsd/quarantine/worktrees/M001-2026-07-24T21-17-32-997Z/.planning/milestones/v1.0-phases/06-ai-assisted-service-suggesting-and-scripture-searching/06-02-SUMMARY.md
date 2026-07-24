---
phase: 06-ai-assisted-service-suggesting-and-scripture-searching
plan: 02
subsystem: ui
tags: [vue, ai, song-suggestions, service-editor, song-slot-picker, anthropic, typescript]

# Dependency graph
requires:
  - phase: 06-ai-assisted-service-suggesting-and-scripture-searching
    plan: 01
    provides: claudeApi.ts with getSongSuggestions/AiSongSuggestion, sermonTopic Service field
  - phase: 03-service-planning
    provides: ServiceEditorView, SongSlotPicker, SongSlot types, service store

provides:
  - Sermon Context card in ServiceEditorView with sermon topic text input
  - "Suggest All Songs" button in header (disabled without sermon context)
  - AI draft songs inline display with accept/reject actions per slot
  - SongSlotPicker AI Picks section above By Rotation suggestions
  - Per-slot AI fetch on dropdown open (via requestAiSuggestions emit)
  - Session cache for AI suggestions keyed by sermon context + slot VW type
  - Loading shimmer, error state with retry, and no-context placeholder in SongSlotPicker

affects:
  - 06-ai-assisted-service-suggesting-and-scripture-searching plan-03 (scripture AI search in ScriptureInput)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI draft pattern: suggestAllSongs fills aiDraftSongs Map, accept/reject actions write/clear slots"
    - "Session cache pattern: Map keyed by JSON.stringify({topic, passage, slotVwType}) prevents redundant API calls"
    - "Watch-to-clear pattern: sermon context watcher clears all AI caches on context change"
    - "Emit-up pattern: SongSlotPicker emits requestAiSuggestions, parent handles API call and caching"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/components/SongSlotPicker.vue

key-decisions:
  - "SongSlotPicker stays as display component — parent handles API calls, caching; child only renders"
  - "aiDraftSongs uses Map<slotIndex, draft> so only empty slots show drafts; filled slots unaffected"
  - "recentServiceSongIds computed uses 8-week cutoff with early break on sorted-desc service list"
  - "suggestAllSongs accumulates batchAcceptedIds across slots so later picks avoid duplicates"
  - "fetchAiForSlot checks cache before calling API — same cache key (topic+passage+vwType) reused across re-opens"

patterns-established:
  - "AI props pattern: optional aiSuggestions/aiLoading/aiError/hasSermonContext props with undefined defaults"
  - "Map reactivity pattern: always replace Map ref (new Map(existing)) rather than mutate to trigger Vue reactivity"

requirements-completed:
  - AI-01
  - AI-02
  - AI-03
  - AI-05
  - AI-06

# Metrics
duration: 7min
completed: 2026-03-04
---

# Phase 6 Plan 02: AI Song Suggestions UI Summary

**Sermon topic field, "Suggest All Songs" bulk flow, and AI Picks section in SongSlotPicker with accept/reject drafts, loading shimmer, and retry error state**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T19:07:43Z
- **Completed:** 2026-03-04T19:14:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added Sermon Context card to ServiceEditorView with a sermon topic text input above the existing sermon passage ScriptureInput
- Added "Suggest All Songs" button to the service editor header — disabled when no sermon context, shows "Suggesting..." while running, fills all empty song slots with AI-drafted songs that users can accept or reject inline
- Updated SongSlotPicker dropdown to show an "AI Picks" section above "By Rotation" suggestions with loading shimmer, error/retry state, and no-context placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sermon topic field and Suggest All Songs to ServiceEditorView** - `6244be4` (feat)
2. **Task 2: Add AI Picks section to SongSlotPicker dropdown** - `0b8da05` (feat)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` — Sermon Context card, Suggest All Songs button, AI draft inline display with accept/reject, AI state management (refs, computed, watch, functions), sermonTopic persisted on save
- `src/components/SongSlotPicker.vue` — AI Picks section above By Rotation, loading shimmer, error state with retry, no-context placeholder, resolvedAiSuggestions computed, requestAiSuggestions emit on dropdown open

## Decisions Made

- **SongSlotPicker as display-only:** The parent (ServiceEditorView) handles all API calls and caching. SongSlotPicker only emits `requestAiSuggestions` and renders the results via props. This avoids duplicating store access and API logic inside the picker.
- **Map reactivity:** All AI Maps (aiDraftSongs, aiPerSlotResults, etc.) use the "replace with new Map()" pattern on every mutation to trigger Vue 3 reactive tracking — direct `.set()` on a ref Map does not trigger reactivity.
- **Batch deduplication:** `suggestAllSongs` accumulates `batchAcceptedIds` as it processes each slot so later slots don't receive the same song ID twice in the same bulk operation.
- **Cache key:** The session cache key combines topic, passage (as object), and slotVwType in a JSON.stringify — if any element changes, the cache is invalidated automatically by the sermon context watcher.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Slot index guard in suggestAllSongs loop**
- **Found during:** Task 1 (suggestAllSongs implementation)
- **Issue:** `localService.value.slots[i]` can return `undefined` when TypeScript array indexing — TypeScript strict mode caught this
- **Fix:** Added `if (!slot || slot.kind !== 'SONG') continue` guard
- **Files modified:** src/views/ServiceEditorView.vue
- **Verification:** Type check passed with no errors in ServiceEditorView
- **Committed in:** `6244be4` (Task 1 commit)

**2. [Rule 1 - Pre-existing] ScriptureInput AI scripture search included in Task 1 commit**
- **Found during:** Task 1 discovery
- **Issue:** `feat(06-03)` commit at `6244be4` was already made before this plan executed, containing both Plan 02 (ServiceEditorView AI) and Plan 03 (ScriptureInput AI search) changes together. The ScriptureInput changes (showAiSuggest prop, sermonTopic prop, recentScriptures prop, AI search UI) were pre-committed.
- **Fix:** No action needed — code was already correct and committed. Task 1 was effectively pre-done.
- **Files modified:** src/components/ScriptureInput.vue, src/views/ServiceEditorView.vue (already committed)
- **Verification:** All 266 tests pass, type check clean
- **Committed in:** `6244be4` (pre-existing commit)

---

**Total deviations:** 2 (1 auto-fixed type guard, 1 pre-existing commit observation)
**Impact on plan:** Both deviations were minor. The type guard was required for correctness. The pre-existing commit observation is just documentation of the execution context.

## Issues Encountered

- Task 1 was already committed as `feat(06-03)` before this plan execution began (it appears a prior agent session committed both Plan 02 and Plan 03 work together). Task 1 verified complete via grep, type check, and tests. Task 2 (SongSlotPicker) was the remaining work to implement.

## User Setup Required

None - no additional external service configuration required. The `VITE_CLAUDE_API_KEY` configured in Plan 01 is sufficient.

## Next Phase Readiness

- Both files implementing Plan 02's AI song suggestion UI are complete
- SongSlotPicker now has the full AI Picks section with loading/error/results states
- ServiceEditorView has the complete Suggest All Songs flow with accept/reject draft UI
- Plan 03 (ScriptureInput AI scripture search) was already committed as `6244be4`
- No blockers for remaining plans

---

## Self-Check: PASSED

- `src/views/ServiceEditorView.vue` — FOUND (contains sermonTopic, hasSermonContext, suggestAllSongs, aiDraftSongs)
- `src/components/SongSlotPicker.vue` — FOUND (contains AI Picks section, resolvedAiSuggestions, requestAiSuggestions emit)
- Commit `6244be4` — FOUND (Task 1)
- Commit `0b8da05` — FOUND (Task 2)
- 266/266 tests pass — VERIFIED
- Type check clean for both files — VERIFIED

---
*Phase: 06-ai-assisted-service-suggesting-and-scripture-searching*
*Completed: 2026-03-04*
