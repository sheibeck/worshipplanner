---
phase: 06-ai-assisted-service-suggesting-and-scripture-searching
plan: 04
subsystem: ui
tags: [anthropic, claude, ai, verification, vite-proxy, cors, song-suggestions, scripture-suggestions, vue3]

# Dependency graph
requires:
  - phase: 06-ai-assisted-service-suggesting-and-scripture-searching
    plan: 01
    provides: claudeApi.ts with getSongSuggestions/getScriptureSuggestions
  - phase: 06-ai-assisted-service-suggesting-and-scripture-searching
    plan: 02
    provides: AI song picks UI, Suggest All Songs, SermonContext card
  - phase: 06-ai-assisted-service-suggesting-and-scripture-searching
    plan: 03
    provides: ScriptureInput AI natural language search

provides:
  - Verified end-to-end AI-assisted service planning workflow
  - Vite proxy eliminating Anthropic API CORS errors in dev
  - Scripture passage preview before selection (expand/collapse with passage text)
  - Re-suggesting songs for filled slots via Suggest All Songs
  - CCLI number passed to AI prompt for better VW type inference on untyped songs
  - Song deduplication across slots in Suggest All Songs flow
  - Correct model ID (claude-haiku-4-5-20251001)

affects:
  - None — this is the final plan in phase 06

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite proxy pattern: /api/anthropic/* proxied to https://api.anthropic.com/* in vite.config.ts to avoid CORS"
    - "Scripture expand-preview pattern: click reference to expand inline passage text before committing to selection"
    - "CCLI-in-prompt pattern: song CCLI number passed to AI so it can infer VW type for untyped songs"
    - "Deduplication-with-find pattern: result.find() filters already-selected/drafted IDs instead of taking result[0]"

key-files:
  created: []
  modified:
    - vite.config.ts
    - src/utils/claudeApi.ts
    - src/components/ScriptureInput.vue
    - src/views/ServiceEditorView.vue

key-decisions:
  - "Proxy Anthropic API through Vite dev server (/api/anthropic) — avoids CORS without a backend; browser calls localhost, Vite forwards to api.anthropic.com"
  - "Model corrected to claude-haiku-4-5-20251001 — the claude-3-5-haiku-20241022 ID returned 404 from the API"
  - "Scripture preview expands inline before selection — user sees passage text before committing; avoids tab/link away"
  - "Suggest All Songs removes filled-slot guard — allows re-suggestion so planners can refresh stale picks"
  - "CCLI included in song library prompt — enables AI to identify and infer VW type for unset songs"

patterns-established:
  - "Vite proxy for browser-side third-party APIs: server.proxy in vite.config.ts rewriting /api/{service}/* -> {service-url}/*"

requirements-completed:
  - AI-01
  - AI-02
  - AI-03
  - AI-04
  - AI-05
  - AI-06

# Metrics
duration: N/A (human verification checkpoint)
completed: 2026-03-04
---

# Phase 6 Plan 04: AI Workflow Human Verification Summary

**End-to-end AI-assisted service planning verified with real Claude API; CORS proxy, model ID, scripture preview, re-suggestion, CCLI inference, and deduplication fixed during testing**

## Performance

- **Duration:** Human verification checkpoint (not automated)
- **Completed:** 2026-03-04
- **Tasks:** 1 (checkpoint:human-verify)
- **Files modified:** 4

## Accomplishments

- Human tested the complete AI-assisted service planning workflow end-to-end with a real Anthropic API key
- Identified and fixed 7 distinct issues discovered during live testing — all committed as `b8bee57`
- AI song suggestions, scripture discovery, Suggest All Songs, and error handling all verified functional
- Existing non-AI service editor functionality confirmed unaffected

## Task Commits

1. **Verification fixes (all issues found during testing)** - `b8bee57` (fix)
   - Anthropic API CORS fix (Vite proxy)
   - Model ID corrected to claude-haiku-4-5-20251001
   - Scripture preview before selection
   - ~10 verse scripture suggestions
   - Re-suggest songs for filled slots
   - CCLI number inclusion for VW type inference
   - Song deduplication across slots

Note: The prior model ID fix `6264a61` (claude-haiku-3-5 -> claude-3-5-haiku) was an intermediate fix before the final correction in `b8bee57`.

## Files Created/Modified

- `vite.config.ts` — Added Vite dev server proxy: `/api/anthropic/*` forwards to `https://api.anthropic.com/*`
- `src/utils/claudeApi.ts` — Corrected model ID to `claude-haiku-4-5-20251001`; added `baseURL` pointing to Vite proxy; added CCLI number to song library prompt; added ~10 verse guidance to scripture prompt; added error logging
- `src/components/ScriptureInput.vue` — Scripture results expand inline showing passage preview text before selection; added `expandedPreview`, `aiPreviewText`, `aiPreviewLoading`, `aiPreviewError` refs; `togglePreview()` fetches passage via existing ESV API helper
- `src/views/ServiceEditorView.vue` — Removed filled-slot skip guard in `suggestAllSongs` so re-suggestion works; improved deduplication using `result.find()` against `alreadySelectedIds + batchAcceptedIds`; included `ccliNumber` in song library passed to API

## Decisions Made

- **Vite proxy for CORS:** Rather than changing the Anthropic client to use a backend route (architectural change), the Vite dev server proxy (`server.proxy`) was used to forward browser requests through localhost. This is the standard Vite pattern and requires zero backend changes.
- **Scripture preview UX:** Instead of selecting a result immediately on click, results now expand inline to show the actual passage text. User then clicks "Select this passage" to confirm. This prevents selecting wrong passages without leaving the editor.
- **Re-suggestion on filled slots:** Removed the `if (songSlot.songId) continue` guard so planners can re-run Suggest All Songs to refresh picks, even for slots that already have songs. The draft overlay shows on top of existing selections.
- **Model ID correction:** The model identifier `claude-haiku-4-5-20251001` is the correct API ID for Claude Haiku 4.5; earlier attempts using `claude-3-5-haiku-20241022` and `claude-haiku-3-5` both returned API errors.

## Deviations from Plan

### Auto-fixed Issues (found during human verification)

**1. [Rule 1 - Bug] CORS error blocked all API calls in browser**
- **Found during:** Task 1 (live API testing)
- **Issue:** Browser blocked direct requests to `api.anthropic.com` due to CORS — the Anthropic SDK's `dangerouslyAllowBrowser: true` flag bypasses the SDK warning but does not bypass browser CORS policy
- **Fix:** Added Vite dev server proxy in `vite.config.ts`: `/api/anthropic` -> `https://api.anthropic.com`; updated `getClient()` to use `baseURL: ${window.location.origin}/api/anthropic`
- **Files modified:** `vite.config.ts`, `src/utils/claudeApi.ts`
- **Committed in:** `b8bee57`

**2. [Rule 1 - Bug] Wrong model ID returned 404 from API**
- **Found during:** Task 1 (live API testing)
- **Issue:** `claude-3-5-haiku-20241022` model ID format was invalid — Anthropic API returned 404
- **Fix:** Corrected to `claude-haiku-4-5-20251001`
- **Files modified:** `src/utils/claudeApi.ts`
- **Committed in:** `b8bee57` (intermediate fix also in `6264a61`)

**3. [Rule 2 - Missing Critical] No way to preview scripture before committing selection**
- **Found during:** Task 1 (usability test)
- **Issue:** Clicking an AI scripture result immediately populated the structured fields with no preview — planners couldn't verify the passage content before selecting
- **Fix:** AI results now expand inline showing full passage text (fetched via existing ESV API helper); "Select this passage" button confirms the selection
- **Files modified:** `src/components/ScriptureInput.vue`
- **Committed in:** `b8bee57`

**4. [Rule 1 - Bug] Scripture suggestions were too short (2-4 verses)**
- **Found during:** Task 1 (AI output quality test)
- **Issue:** AI was suggesting very short passages; usability required ~10 verse ranges
- **Fix:** Added guidance to `SCRIPTURE_SYSTEM_PROMPT`: "Aim for passages around 10 verses long — not too short (under 5) or too long (over 15)"
- **Files modified:** `src/utils/claudeApi.ts`
- **Committed in:** `b8bee57`

**5. [Rule 1 - Bug] Suggest All Songs skipped already-filled slots with no re-suggestion capability**
- **Found during:** Task 1 (workflow test)
- **Issue:** The `if (songSlot.songId) continue` guard meant planners couldn't refresh suggestions for slots that already had songs
- **Fix:** Removed the skip guard; draft overlay now shows on all slots including filled ones
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Committed in:** `b8bee57`

**6. [Rule 2 - Missing Critical] CCLI number not included in AI song context for VW type inference**
- **Found during:** Task 1 (AI suggestion quality review)
- **Issue:** Songs with `vwType: unset` had no way for the AI to infer their correct VW type — CCLI number would allow the AI to identify the song from its knowledge base
- **Fix:** Added `ccliNumber` to `GetSongSuggestionsParams`; included in song library prompt entries when present; added prompt instruction to use CCLI for type inference
- **Files modified:** `src/utils/claudeApi.ts`, `src/views/ServiceEditorView.vue`
- **Committed in:** `b8bee57`

**7. [Rule 1 - Bug] Song deduplication used `result[0]` without cross-slot dedup check**
- **Found during:** Task 1 (Suggest All Songs flow)
- **Issue:** `suggestAllSongs` was taking `result[0]` directly — could assign the same song to multiple slots if the API returned overlapping picks
- **Fix:** Changed to `result.find((s) => !alreadySelectedIds.includes(s.songId) && !batchAcceptedIds.includes(s.songId))` for proper cross-slot deduplication
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Committed in:** `b8bee57`

---

**Total deviations:** 7 auto-fixed (2 bugs found pre-testing via model ID fix, 5 bugs/missing-critical found during live verification)
**Impact on plan:** All fixes necessary for correct real-world operation. The CORS proxy and model ID fixes were blocking — nothing worked without them. Remaining fixes improved usability and suggestion quality.

## Issues Encountered

- **Two-stage model ID correction:** The model ID went through two fixes. An intermediate commit (`6264a61`) corrected `claude-haiku-3-5` to `claude-3-5-haiku-20241022`, but this was still wrong. The final correction in `b8bee57` set the correct ID `claude-haiku-4-5-20251001`.
- **CORS not caught by unit tests:** The `dangerouslyAllowBrowser: true` flag suppresses the SDK's own browser check, so unit tests (using mocked SDK) passed cleanly but the live browser hit CORS. The Vite proxy pattern resolves this cleanly for dev.

## User Setup Required

None beyond what was documented in Plan 01.

The `VITE_CLAUDE_API_KEY` environment variable in `.env.local` must be set to a valid Anthropic API key:

```
VITE_CLAUDE_API_KEY=sk-ant-...
```

Without the key, all AI functions return `null` gracefully — the app works fully without AI.

## Next Phase Readiness

- Phase 06 is complete — all 4 plans delivered and human-verified
- AI song suggestions, scripture discovery, Suggest All Songs, and graceful degradation all confirmed working
- No blockers for future work

---

## Self-Check: PASSED

- `vite.config.ts` — FOUND (proxy added)
- `src/utils/claudeApi.ts` — FOUND (model ID, baseURL, CCLI, logging)
- `src/components/ScriptureInput.vue` — FOUND (expandedPreview, togglePreview, aiPreviewText)
- `src/views/ServiceEditorView.vue` — FOUND (ccliNumber in songLibrary, dedup fix, no filled-slot skip)
- Commit `b8bee57` — FOUND
- Commit `6264a61` — FOUND

---
*Phase: 06-ai-assisted-service-suggesting-and-scripture-searching*
*Completed: 2026-03-04*
