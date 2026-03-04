---
phase: 06-ai-assisted-service-suggesting-and-scripture-searching
plan: 01
subsystem: api
tags: [anthropic, claude, ai, sdk, song-suggestions, scripture-suggestions, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-service-planning
    provides: Service type, ServiceInput, ScriptureRef, services store
  - phase: 02-song-library
    provides: Song type, song library store
  - phase: 01-foundation
    provides: Firebase, Pinia, Vue 3 stack

provides:
  - claudeApi.ts utility with getSongSuggestions and getScriptureSuggestions functions
  - AiSongSuggestion and AiScriptureSuggestion types
  - safeParseJsonArray helper for robust JSON extraction from AI responses
  - validateSongSuggestions and validateScriptureSuggestions hallucination filters
  - Service.sermonTopic optional field for AI context
  - 23 unit tests covering all AI utility functions

affects:
  - 06-ai-assisted-service-suggesting-and-scripture-searching plan-02 (SongSlotPicker AI integration)
  - 06-ai-assisted-service-suggesting-and-scripture-searching plan-03 (ServiceEditorView AI integration)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk ^0.78.0 — Anthropic TypeScript SDK for Claude API calls"
  patterns:
    - "Lazy singleton pattern for Anthropic client (dangerouslyAllowBrowser: true)"
    - "null-on-error pattern — all AI functions return null on any failure, never throw"
    - "Hallucination filtering — AI-suggested IDs/book names validated against real data before returning"
    - "safeParseJsonArray — try direct JSON.parse, fall back to regex extraction for prose/fenced responses"
    - "vi.hoisted + function declaration mock for Anthropic SDK constructor in Vitest v4"

key-files:
  created:
    - src/utils/claudeApi.ts
    - src/utils/__tests__/claudeApi.test.ts
  modified:
    - src/types/service.ts
    - src/stores/services.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Use claude-haiku-3-5-20241022 model for cost-efficient AI suggestions (max_tokens: 512)"
  - "Lazy singleton getClient() caches Anthropic instance — avoids re-instantiation on each call"
  - "Validation returns null (not empty array) when all suggestions are invalid — callers check for null"
  - "sermonTopic added as optional field to Service (not required) — backward compatible with existing data"
  - "vi.hoisted + regular function declaration required for Anthropic mock in Vitest v4 (arrow functions break new constructor)"

patterns-established:
  - "AI null-on-error: getSongSuggestions and getScriptureSuggestions both catch all errors and return null"
  - "JSON extraction: safeParseJsonArray tries direct parse then regex for [\\s\\S]* bracket extraction"

requirements-completed:
  - AI-01
  - AI-05
  - AI-06

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 6 Plan 01: AI Foundation Summary

**Anthropic SDK installed, claudeApi.ts utility with getSongSuggestions/getScriptureSuggestions, hallucination filtering, and 23 TDD-green unit tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-04T18:55:41Z
- **Completed:** 2026-03-04T19:04:50Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments

- Installed `@anthropic-ai/sdk` and created `claudeApi.ts` as the complete AI foundation layer
- Added `sermonTopic?: string` to Service type and `sermonTopic: ''` default in createService
- Built and TDD-tested all AI utility functions: safeParseJsonArray, validateSongSuggestions, validateScriptureSuggestions, getSongSuggestions, getScriptureSuggestions
- All 266 tests across 17 test files pass (23 new + 243 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install SDK, extend Service type, create claudeApi.ts with tests** - `747a763` (feat)

## Files Created/Modified

- `src/utils/claudeApi.ts` — Complete AI API utility: Anthropic client singleton, system prompts, types, helpers, getSongSuggestions, getScriptureSuggestions
- `src/utils/__tests__/claudeApi.test.ts` — 23 unit tests with Anthropic SDK mock covering all exported functions
- `src/types/service.ts` — Added optional `sermonTopic?: string` field to Service interface
- `src/stores/services.ts` — Added `sermonTopic: ''` default in createService Firestore write
- `package.json` / `package-lock.json` — Added @anthropic-ai/sdk ^0.78.0 dependency

## Decisions Made

- **Model choice:** `claude-haiku-3-5-20241022` — cost-efficient for per-slot and per-scripture suggestions; max_tokens: 512 is sufficient for 3-5 item JSON arrays
- **Lazy singleton pattern:** `getClient()` caches the Anthropic instance to avoid re-instantiation on each suggestion call
- **null-on-error contract:** Both AI functions return `null` (not throw) on any error — API failures, parse failures, or empty validated results all return null. UI callers check for null to show fallback UI
- **Hallucination filtering:** `validateSongSuggestions` filters against the actual song ID set; `validateScriptureSuggestions` filters against BIBLE_BOOKS. Empty result after filtering returns null
- **Vitest v4 mock pattern:** Using `vi.hoisted` + regular `function` declaration (not arrow function) for the Anthropic constructor mock — arrow functions break `new` constructor calls in Vitest v4

## Deviations from Plan

None - plan executed exactly as written.

The only noteworthy implementation detail was discovering that Vitest v4 requires a regular `function` declaration (not arrow function) in `vi.mock` factories when mocking constructors called with `new`. This is Vitest v4 behavior, not a deviation from the plan.

## Issues Encountered

- **Vitest v4 mock constructor issue:** Initial test implementation used arrow functions in `vi.mock` factory for the Anthropic class constructor. Vitest v4 does not support arrow functions for `new` constructor mocking — warning "The vi.fn() mock did not use 'function' or 'class' in its implementation" was emitted and mock responses weren't forwarded. Fixed by using a regular `function MockAnthropic()` declaration in the factory, resolving all 2 failing tests.

## User Setup Required

**External services require manual configuration.**

The `VITE_CLAUDE_API_KEY` environment variable must be set for AI features to work:

1. Visit [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Add to `.env.local`:
   ```
   VITE_CLAUDE_API_KEY=sk-ant-...
   ```
3. Verify: AI suggestion buttons appear in the service editor (Plans 02/03)

Without the key, all AI functions return `null` gracefully — the app works fully without AI.

## Next Phase Readiness

- `claudeApi.ts` provides a clean contract for Plans 02 and 03 to import from
- Plans 02 and 03 can now implement UI integration using the established null-on-error contract
- No blockers — all exports, types, and tests are green

---

## Self-Check: PASSED

- `src/utils/claudeApi.ts` — FOUND
- `src/utils/__tests__/claudeApi.test.ts` — FOUND
- `sermonTopic` in `src/types/service.ts` — FOUND
- `sermonTopic` in `src/stores/services.ts` — FOUND
- `@anthropic-ai/sdk` in `package.json` — FOUND
- Commit `747a763` — FOUND
- 23/23 claudeApi tests pass — VERIFIED
- 266/266 full suite passes — VERIFIED

---
*Phase: 06-ai-assisted-service-suggesting-and-scripture-searching*
*Completed: 2026-03-04*
