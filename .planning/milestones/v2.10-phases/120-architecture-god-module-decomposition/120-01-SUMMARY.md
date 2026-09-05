---
phase: 120-architecture-god-module-decomposition
plan: 01
subsystem: ui
tags: [vue, composables, refactor, architecture-docs]

# Dependency graph
requires:
  - phase: 119-architecture-correctness-batching-store-ownership
    provides: useAutoSave/useSlideshowAssembly extraction pattern this plan follows
provides:
  - src/composables/useAiSongSuggestions.ts — AI song-suggestion cluster extracted from ServiceEditorView.vue
  - ServiceEditorView.vue reduced from 4606 to 4409 lines (197-line reduction), rewired to the composable
  - ARCHITECTURE.md Utility Layer section documents the sanctioned utils->useAuthStore exception (ARCH-020/R360)
affects: [120-02 (functions/src/index.ts decomposition — sibling plan, no code overlap)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composable extraction: options-object-in / reactive-surface-out, matching useAutoSave/useSlideshowAssembly"

key-files:
  created:
    - src/composables/useAiSongSuggestions.ts
  modified:
    - src/views/ServiceEditorView.vue
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "Moved the sermon-context AI-cache-clear watcher (which only touches the six AI refs and localService, both already composable inputs) into the composable alongside the four named functions — not explicitly listed in the plan's move list, but squarely within the AI-suggestion responsibility and required for a self-contained composable."
  - "Did not destructure aiSongCache back into ServiceEditorView.vue — nothing in the view or its template reads it anymore now that fetchAiForSlot and the cache-clear watcher live inside the composable; the composable still returns it per the plan's exposed surface."
  - "R360 taken as documentation-only per the plan's accepted branch — no src/utils/*.ts file was touched."

patterns-established:
  - "AI song-suggestion composable pattern: options object carrying view-owned refs/computeds/store instance/callback, returning the same reactive surface the inline code exposed — second data point (after useAutoSave/useSlideshowAssembly) for future god-module extractions."

requirements-completed: [R358, R360]

coverage:
  - id: D1
    description: "AI song-suggestion cluster (state, suggestAllSongs, fetchAiForSlot, acceptAiSong, rejectAiSong) extracted into useAiSongSuggestions.ts with behavior unchanged"
    requirement: "R358"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (346 tests, includes AI-suggestion assertions e.g. 'selecting teams passes the full candidate pool to getSongSuggestions')"
        status: pass
      - kind: unit
        ref: "npx vitest run (full app suite, 5126 tests / 189 files pass)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceEditorView.vue is measurably smaller after extraction"
    requirement: "R358"
    verification:
      - kind: other
        ref: "wc -l src/views/ServiceEditorView.vue: 4606 -> 4409"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sanctioned utils->useAuthStore exception documented in ARCHITECTURE.md"
    requirement: "R360"
    verification:
      - kind: other
        ref: "grep -qiE 'useAuthStore|ARCH-020|R360' .planning/codebase/ARCHITECTURE.md && grep -qE 'claudeApi|messaging|scriptureApi' .planning/codebase/ARCHITECTURE.md"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-05
status: complete
---

# Phase 120 Plan 01: AI Song-Suggestions Extraction + Utils Dependency-Direction Note Summary

**Extracted the AI song-suggestion cluster out of ServiceEditorView.vue into `useAiSongSuggestions.ts` (4606 -> 4409 lines) and documented the sanctioned utils->useAuthStore read as an accepted exception in ARCHITECTURE.md.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-05T05:05:54Z
- **Completed:** 2026-09-05T05:18:36Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Moved six AI reactive refs (`aiDraftSongs`, `aiSuggestingAll`, `aiSongCache`, `aiPerSlotLoading`, `aiPerSlotResults`, `aiPerSlotError`), the `aiCacheKey` helper, four functions (`suggestAllSongs`, `fetchAiForSlot`, `acceptAiSong`, `rejectAiSong`), and the sermon-context cache-clear watcher out of `ServiceEditorView.vue` into a new `src/composables/useAiSongSuggestions.ts`, mirroring the `useAutoSave` options-in/surface-out shape.
- Rewired `ServiceEditorView.vue` with one top-level `useAiSongSuggestions({...})` call placed before `activeActionItems` (which reads `aiSuggestingAll`/`suggestAllSongs`), moving the `recentServiceSongIds` computed up to satisfy the ordering constraint. Removed the now-unused `getPrimaryKey`, `getSongSuggestions`, and `AiSongSuggestion` imports from the view.
- `ServiceEditorView.vue`: **4606 -> 4409 lines** (197-line reduction).
- Documented `claudeApi.ts`/`messaging.ts`/`scriptureApi.ts`'s read-only `useAuthStore()` settings-gate reads as a sanctioned exception in `ARCHITECTURE.md`'s Utility Layer section, citing ARCH-020/R360 — no `src/` file touched by this task.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract AI song-suggestions into a useAiSongSuggestions composable (R358)** - `6a9af35f` (feat)
2. **Task 2: Document the sanctioned utils→useAuthStore exception in ARCHITECTURE.md (R360)** - `433f8894` (docs)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/composables/useAiSongSuggestions.ts` - New composable owning the AI song-suggestion state, cache, and functions
- `src/views/ServiceEditorView.vue` - Rewired to consume the composable; AI cluster removed (4606 -> 4409 lines)
- `.planning/codebase/ARCHITECTURE.md` - Utility Layer section gains the ARCH-020/R360 sanctioned-exception note

## Decisions Made
- Moved the sermon-context AI-cache-clear `watch()` into the composable (not explicitly named in the plan's move list, but it exclusively manipulates the six AI refs plus `localService`, both already composable-owned/composable-input) — keeps the composable self-contained rather than leaving an orphaned watcher in the view referencing composable-returned refs.
- Left `aiSongCache` out of the view's destructure since nothing in `ServiceEditorView.vue` reads it directly anymore (only the composable's internal `fetchAiForSlot`/watcher touch it); the composable's return type still exposes it per the plan's stated surface.
- Took R360's document-as-sanctioned branch exactly as specified — no `src/utils/*.ts` refactor.

## Deviations from Plan

**1. [Scope clarification, not a Rule 1-4 deviation] Included the sermon-context cache-clear watcher in the move**
- **Found during:** Task 1
- **Issue:** The plan's move list named six refs, `aiCacheKey`, and four functions, but did not explicitly mention the `watch(() => [sermonTopic, sermonPassage], () => { ...clear all four AI maps... })` block that sits between the refs and the functions in the original file. Leaving it inline in the view would still work (the destructured refs are the same reactive objects), but it is 100% AI-cache lifecycle logic with no other view dependency.
- **Fix:** Moved the watcher into `useAiSongSuggestions.ts` verbatim, so the composable is fully self-contained for the AI-suggestion responsibility.
- **Files modified:** src/composables/useAiSongSuggestions.ts, src/views/ServiceEditorView.vue
- **Verification:** Full app suite (5126 tests) and `ServiceEditorView.test.ts`'s AI-suggestion tests pass unchanged.
- **Committed in:** 6a9af35f (Task 1 commit)

---

**Total deviations:** 1 scope clarification (no rule triggered — a strictly in-scope inclusion, not a bug fix/missing-functionality/blocker).
**Impact on plan:** None on risk profile; kept the composable self-contained instead of leaving a stray watcher behind in the view.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This was the milestone's final phase (v2.10). Phase 120-02 (functions/src/index.ts decomposition, R359) is a sibling plan touching only `functions/src/` — no overlap with this plan's files.
- After 120-02 completes, the milestone is ready for its completion audit.

---
*Phase: 120-architecture-god-module-decomposition*
*Completed: 2026-09-05*

## Self-Check: PASSED
All created files found on disk; both task commits (6a9af35f, 433f8894) verified in git log.
