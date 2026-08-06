---
phase: 39-org-settings-infrastructure-feature-toggles
plan: 04
subsystem: ai
tags: [pinia, vue, feature-toggle, claude-sdk, anthropic]

# Dependency graph
requires:
  - phase: 39-02
    provides: "authStore.settings — the typed OrgSettings ref, DEFAULT_ORG_SETTINGS"
provides:
  - "isAiEnabled() — private guard in src/utils/claudeApi.ts, the single AI choke point"
  - "Three AI affordances (song suggestions, scripture discovery, congregational split) hidden via v-if when AI is off"
affects: [39-05, 39-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared internal guard called as the first statement of every network-calling export in a utility module — never threaded as a parameter"
    - "Getter-backed vi.mock('@/stores/auth', ...) for toggling a reactive setting mid-suite without re-importing the module under test"

key-files:
  created: []
  modified:
    - src/utils/claudeApi.ts
    - src/utils/__tests__/claudeApi.test.ts
    - src/components/SongSlotPicker.vue
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "The AI split button's v-if reads authStore.settings.aiEnabled alone (not AND-composed with canAiSplit) — composing with canAiSplit would hide the button before a passage is fetched, changing pre-existing E5 states (empty/loading/disabled) that the plan's must_haves require to remain byte-for-byte unchanged. UI-SPEC's own text confirms this reading is not merely stylistic: the acceptance gate (canAiSplit count >= 4) is already satisfied by the pre-existing definition/handler-condition/disabled/class occurrences without touching the v-if."
  - "CongregationalEditor.test.ts uses the REAL Pinia auth store (already active via the file's existing setActivePinia(createPinia()) beforeEach) and mutates authStore.settings.aiEnabled directly, rather than adding a vi.mock — this is what the plan's read_first section identified as the file-specific approach that keeps existing tests passing without restructuring Pinia setup."
  - "ScriptureInput.test.ts and claudeApi.test.ts use a getter-backed vi.mock('@/stores/auth', ...) (SongTable.test.ts:39 precedent) since neither file had Pinia activated before this plan."

patterns-established:
  - "Pattern: a utility module's toggle guard is a single private function called as the literal first statement of each gated export — grep-countable, so a missed or over-applied call site is a build-time-discoverable regression, not a runtime one."

requirements-completed: [R088]

coverage:
  - id: D1
    description: "isAiEnabled() guard added to claudeApi.ts, gating exactly the 3 network-calling exports (getSongSuggestions, getScriptureSuggestions, splitCongregationalReading) and none of the 4 pure helpers"
    requirement: "R088"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#getSongSuggestions > aiEnabled: returns null and never invokes the SDK when the AI toggle is off"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#getScriptureSuggestions > aiEnabled: returns null and never invokes the SDK when the AI toggle is off"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#splitCongregationalReading > aiEnabled: returns null and never invokes the SDK when the AI toggle is off"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#pure helpers remain callable with AI off (aiEnabled) > safeParseJsonArray, validateSongSuggestions, validateScriptureSuggestions and validateSplitResult all return their normal results with the AI toggle off"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*\\*' src/utils/claudeApi.ts | grep -c isAiEnabled == 4"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongSlotPicker.vue's AI Picks block (including its trailing divider) is removed from the DOM when AI is off, composed onto the existing sermon-context condition"
    requirement: "R088"
    verification:
      - kind: other
        ref: "grep -c settings.aiEnabled / hasSermonContext !== false / divider condition — all present exactly once, source-verified"
        status: pass
    human_judgment: true
    rationale: "No test file exists for SongSlotPicker.vue in this repo (plan explicitly scopes this out — a large picker harness is out of scope for a two-boolean phase). The visual absence of the block and divider needs a human glance per 39-VALIDATION.md's manual checks."
  - id: D3
    description: "ScriptureInput.vue's AI scripture discovery block is AND-composed with the existing showAiSuggest prop and hidden when AI is off, with the freeform input becoming the first rendered element"
    requirement: "R088"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureInput.test.ts#AI toggle (39-04) > renders the AI block for a reading slot when the AI toggle is on"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/ScriptureInput.test.ts#AI toggle (39-04) > hides the AI block for a reading slot when the AI toggle is off, and the freeform text input is the first rendered element"
        status: pass
    human_judgment: false
  - id: D4
    description: "CongregationalEditor.vue's Split with AI button hides when AI is off; Fetch Passage, reference input, and every hand-dividing affordance stay; an existing AI-generated split is proven unaltered and still hand-editable"
    requirement: "R088"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI toggle (39-04) > hides the AI split button when AI is off, while Fetch Passage and the reference input still render"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI toggle (39-04) > mounted over an existing AI-generated split with AI off: content is unaltered and a hand edit (speaker toggle) still applies"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-08-06
status: complete
---

# Phase 39 Plan 04: AI Toggle Enforcement Summary

**Single `isAiEnabled()` guard in `claudeApi.ts` gates exactly the 3 network-calling exports (proven at the module entry point via the existing Anthropic SDK mocks), and three composed `v-if`s hide the corresponding UI affordances without touching any pre-existing state.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-06T19:43:16Z
- **Completed:** 2026-08-06T20:00:54Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `isAiEnabled()` private guard added to `claudeApi.ts`, reading `useAuthStore().settings.aiEnabled` from inside the function body (never at module scope), called as the first statement of `getSongSuggestions`, `getScriptureSuggestions`, and `splitCongregationalReading` — the four pure parse/validate helpers are untouched
- `claudeApi.test.ts` extended with a getter-backed `vi.mock('@/stores/auth', ...)`, one toggle-off case per network export asserting `mockCreate`/`mockParse` were never invoked, and one case proving the four pure helpers still work with AI off — 67 tests total, 4 match `-t "aiEnabled"`
- `SongSlotPicker.vue`'s AI Picks block (including its trailing divider) gated by AND-composing `authStore.settings.aiEnabled` onto the existing `hasSermonContext !== false` condition — no behavior change to the shimmer, error/retry, results list, or placeholder
- `ScriptureInput.vue` imports the auth store for the first time and AND-composes `authStore.settings.aiEnabled` onto the existing `showAiSuggest` prop condition; `ScriptureInput.test.ts` gets a getter-backed auth mock (defaulting `true`) plus 2 new cases
- `CongregationalEditor.vue` imports the auth store for the first time and gates only the "Split with AI" button with `v-if="authStore.settings.aiEnabled"`, leaving `canAiSplit`'s `:disabled`/class logic untouched; `CongregationalEditor.test.ts` gets 3 new cases using the file's already-active real Pinia store, including a positive assertion that an existing AI-generated split renders byte-identical content and a hand edit (speaker toggle) still applies with AI off
- Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) confirmed at its documented 2-file baseline (`storage.rules.test.ts`, `RosterView.test.ts`) after the fix below

## Task Commits

1. **Task 1: The AI guard at the module entry point, and its proving test** - `7ffa577` (feat)
2. **Task 2: Hide song suggestions and scripture discovery** - `93a349a` (feat)
3. **Task 3: Hide the AI split button and prove existing splits are never altered** - `281a77e` (feat)

## Files Created/Modified
- `src/utils/claudeApi.ts` - private `isAiEnabled()` guard; gates 3 of 7 exports
- `src/utils/__tests__/claudeApi.test.ts` - getter-mock, 3 toggle-off cases, 1 pure-helper-still-works case
- `src/components/SongSlotPicker.vue` - AI Picks block gated (AND-composed)
- `src/components/ScriptureInput.vue` - AI suggest block gated (AND-composed); new auth store import
- `src/components/__tests__/ScriptureInput.test.ts` - getter-mock, 2 new AI-toggle cases
- `src/components/CongregationalEditor.vue` - Split-with-AI button gated; new auth store import
- `src/components/__tests__/CongregationalEditor.test.ts` - 3 new AI-toggle cases using real Pinia
- `src/views/__tests__/ServiceEditorView.test.ts` - `settings` object added to its hand-rolled auth mock (see Deviations)

## Decisions Made
- Kept the AI split button's `v-if` as `authStore.settings.aiEnabled` alone rather than AND-composing `canAiSplit` into it — the plan's must_haves lock every pre-existing E5 state (empty/loading/disabled-before-fetch) as unchanged, and composing `canAiSplit` into visibility would hide the button before Fetch Passage runs, which is a behavior change the must_haves explicitly forbid. The `canAiSplit`-count acceptance gate (>= 4) is already satisfied by the pre-existing definition, handler-guard, `:disabled`, and class-binding occurrences.
- `CongregationalEditor.test.ts`'s new cases mutate the real Pinia `authStore.settings.aiEnabled` directly (the file already runs `setActivePinia(createPinia())` per-test) rather than adding a `vi.mock`, per the plan's own read_first guidance for this specific file.
- `ScriptureInput.test.ts` and `claudeApi.test.ts` both use the getter-backed `vi.mock` shape (SongTable.test.ts:39 precedent) since neither had any Pinia/store presence before this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ServiceEditorView.test.ts`'s hand-rolled auth mock had no `settings` object, breaking 134 tests across 3 files after Task 3**
- **Found during:** Task 3's full-suite verification gate (`npx vitest run --dir src --exclude '**/rules.test.ts'`)
- **Issue:** `ServiceEditorView.vue` renders `CongregationalEditor.vue` as a child (the Congregational Reading modal). `ServiceEditorView.test.ts` mocks `@/stores/auth` with its own hand-rolled `mockAuthState` object (not the real Pinia store, unlike `CongregationalEditor.test.ts`). That mock had no `settings` field at all, so `authStore.settings.aiEnabled` threw `Cannot read properties of undefined (reading 'aiEnabled')` at mount, cascading into 134 failing tests in `ServiceEditorView.test.ts` (plus a reported unhandled-rejection surfaced against 2 other files in the same worker pool).
- **Fix:** Added `settings: { aiEnabled: true, pcEnabled: true, vwModeEnabled: true }` to `mockAuthState`'s type and default value in `ServiceEditorView.test.ts`, defaulting to the same "everything on" state `DEFAULT_ORG_SETTINGS` uses, so every pre-existing test in that file keeps its current behavior.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 236/236 pass. Full suite re-run confirms the baseline is back to exactly `storage.rules.test.ts` and `RosterView.test.ts` (9 failed tests across those 2 files, 2528 passed).
- **Committed in:** `281a77e` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug caused by Task 3's component change surfacing a gap in an unrelated test file's hand-rolled mock)
**Impact on plan:** Necessary to satisfy Task 3's own acceptance criterion ("the full suite is unchanged from its documented baseline"). No scope creep — the fix is a single field addition to an existing mock object, touching no production code.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

The AI choke point (`isAiEnabled()` in `claudeApi.ts`) is the single enforcement point 39-CONTEXT.md names as the future home for paywall gating — no further changes needed there for that use case. All three AI UI affordances now respect the org-level toggle. 39-05 (Planning Center hide points) and 39-06 can proceed independently; neither depends on this plan's files.

---
*Phase: 39-org-settings-infrastructure-feature-toggles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: src/utils/claudeApi.ts (isAiEnabled guard, 4 grep occurrences confirmed)
- FOUND: 7ffa577 (Task 1 commit)
- FOUND: 93a349a (Task 2 commit)
- FOUND: 281a77e (Task 3 commit)
- FOUND: src/views/__tests__/ServiceEditorView.test.ts (deviation fix)
