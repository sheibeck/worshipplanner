---
phase: 34-smarter-content-llm-scripture-split
plan: 03
subsystem: api
tags: [claude-api, structured-outputs, messages-parse, congregational-reading, r064]

requires:
  - phase: 34-smarter-content-llm-scripture-split (plan 01)
    provides: "computeBoundaries, hasSplittableBoundaries, embedBoundaryMarkers, sliceAtBoundaries, stripVerseMarkers, verseRangeForSlice — the boundary-index contract this plan threads through prompt-building, validation, and slicing"
  - phase: 34-smarter-content-llm-scripture-split (plan 02)
    provides: "SplitSection, SPLIT_SCHEMA, validateSplitResult(parsed, boundaries) — the schema and gate this plan calls immediately after the split request returns"
provides:
  - "SPLIT_SYSTEM_PROMPT: structural, marker-index-only system prompt for the split call — never asks the model to reproduce/quote passage text"
  - "splitCongregationalReading(rawText: string): Promise<CongregationalSection[] | null> — the assembled split call: computes boundaries once, calls messages.parse() with the exact accepted call shape, validates, and slices sections from the untouched source"
affects: [34-04]

tech-stack:
  added: []
  patterns:
    - "messages.parse() mock: extended the existing vi.hoisted mock factory with a second key (mockParse) alongside mockCreate — .parse() is a distinct SDK method (create() + parseMessage() internally) the existing create-only factory did not cover"
    - "Boundary-identity proof by prompt inspection: rather than exposing the internal boundaries array, a test extracts the highest embedded marker index from the captured prompt content and proves the validator accepted a reply using that exact index — a structural (not just behavioral) tie between prompt-building and validation"

key-files:
  created: []
  modified:
    - src/utils/claudeApi.ts
    - src/utils/__tests__/claudeApi.test.ts

key-decisions:
  - "Combined PLAN.md's two tasks (call shape / failure paths) into a single commit rather than four separate RED/GREEN commits, since both tasks' tests were authored together for coherence around the same describe block — no design or scope impact, only commit-granularity; see Deviations."
  - "jsonSchemaOutputFormat() deep-clones and transforms SPLIT_SCHEMA before attaching it to the request (confirmed by reading the installed SDK's lib/transform-json-schema.js), so the call-shape test asserts the transformed schema's shape (properties.sections present) rather than strict object identity against SPLIT_SCHEMA."
  - "The boundary-identity test proves agreement by extracting the highest ⟦N⟧ marker index from the captured prompt content and asserting a reply using that same index as its final endBoundary is accepted — since boundaries is never exposed outside the function, this is the most direct external proof available that one array served both prompt-building and validation."

patterns-established:
  - "Pattern: prove single-computation discipline by inspecting the artifact the computation produced (the embedded prompt), not by exposing the internal value — useful whenever a function's own internal 'compute once, thread through' contract has no natural external hook."

requirements-completed: []

coverage:
  - id: D1
    description: "splitCongregationalReading() calls messages.parse() with model claude-haiku-4-5-20251001, max_tokens 1024, output_config.format of type json_schema, and neither a top-level thinking/effort key nor an output_config.effort key"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#splitCongregationalReading (call shape tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every returned CongregationalSection.text is a byte-exact slice of the untouched rawText (via sliceAtBoundaries + stripVerseMarkers) and a substring of the marker-stripped source — the model's response never contributes a character"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#splitCongregationalReading (byte-exact slice + substring tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every failure path — no internal boundary, delimiter collision, rejected API promise, null parsed_output, out-of-range index, gap between sections, malformed sections shape — resolves to null with no partial application and no thrown error; both pre-flight refusals happen with zero API calls"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#splitCongregationalReading (failure-path tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The same boundaries array is threaded through prompt-building and validation — the highest marker index embedded in the prompt is the same highest index the validator accepts"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#splitCongregationalReading > (boundary identity)"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 03: splitCongregationalReading() and Its Call Shape Summary

**Assembled the one place the model's output and real scripture meet: `splitCongregationalReading()` computes legal boundaries once, calls `messages.parse()` with the exact accepted shape for pre-4.6-family Haiku (dated id, `output_config.format`, no `thinking`/`effort`), validates via 34-02's `validateSplitResult`, and slices every section's text from the untouched ESV source — with 16 new tests proving the call shape, the byte-exact slicing, and every failure path's total-rejection `null`.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-03T07:53:44Z
- **Tasks:** 2 (both `tdd="true"`, combined into one commit — see Deviations)
- **Files modified:** 2 (both existing, appended to only)

## Accomplishments

- `SPLIT_SYSTEM_PROMPT`: a short, structural system prompt instructing the model that the passage carries numbered `⟦i⟧` markers at every legal split position, that it must choose only among those marker indices (never reproduce/retype/quote the passage), that speakers alternate starting with `LEADER`, that sections must be gapless and fully cover the passage (first starts at 0, last ends at the highest marker index, `endBoundary === next.startBoundary`), and that a repeating congregational refrain should go to `CONGREGATION`.
- `splitCongregationalReading(rawText: string): Promise<CongregationalSection[] | null>`, exported from `src/utils/claudeApi.ts`:
  - Computes `boundaries = computeBoundaries(rawText)` exactly once and holds it in a single local, threaded unchanged through `embedBoundaryMarkers`, `validateSplitResult`, and every `sliceAtBoundaries` call.
  - Two pre-flight refusals happen **before any network call**: `hasSplittableBoundaries(boundaries)` false (no internal division to split on), and `embedBoundaryMarkers` returning `null` (source text already contains a boundary-marker delimiter character). Both cost nothing and make zero API calls.
  - Calls `getClient().messages.parse(...)` with `model: 'claude-haiku-4-5-20251001'`, `max_tokens: 1024`, `system: SPLIT_SYSTEM_PROMPT`, `output_config: { format: jsonSchemaOutputFormat(SPLIT_SCHEMA) }`, a single user message whose content is the marked-up passage, and `{ headers: await getAppAuthHeaders() }` as the second argument — matching both existing call sites' auth convention. No `thinking` key and no `effort` key anywhere in the request (top level or inside `output_config`) — both error on this pre-4.6-family model.
  - Passes `response.parsed_output` and the same `boundaries` array to `validateSplitResult`. On `null`, returns `null` immediately — no partial application.
  - Maps each validated section to a `CongregationalSection` whose `text` is `stripVerseMarkers(sliceAtBoundaries(rawText, boundaries, startBoundary, endBoundary))` and whose `verseRange` is `verseRangeForSlice` of the identical raw slice — computing the slice once per section and deriving both fields from it, rather than slicing twice.
  - The whole body is wrapped in try/catch; any thrown error (network failure, SDK exception, unexpected shape) is caught, logged with the existing `[claudeApi]` prefix, and converted to a `null` return — never a rethrow.
  - A head comment on the function records the two invariants a future editor is most likely to break: the single-computed `boundaries` local, and total (never partial) rejection on validation failure.
- 16 new tests in `src/utils/__tests__/claudeApi.test.ts`, under a new `describe('splitCongregationalReading', ...)` block:
  - Byte-exact slicing (2 tests): returned section text equals `stripVerseMarkers(sliceAtBoundaries(...))` exactly, and every section's text is a substring of the marker-stripped source.
  - Call shape (6 tests): dated model id, `max_tokens: 1024`, `output_config.format.type === 'json_schema'` with the transformed schema still constraining the reply to a `sections` property, absence of `thinking`/top-level `effort`/`output_config.effort`, sole user message carrying the marked-up passage plus the forwarded app-auth header, and a P-02 check that the system prompt never contains passage words (`shepherd`, `pastures`).
  - Pre-flight refusals (2 tests): no internal boundary and delimiter collision, both asserting `mockParse` was never called.
  - Failure paths (5 tests): rejected API promise (returns `null`, logs once, does not throw), `parsed_output: null`, out-of-range index, gap between sections, and a malformed `sections` shape — all resolving to `null` with no partial array.
  - Boundary identity (1 test): extracts the highest `⟦N⟧` marker index from the captured prompt content and proves a reply using that same index as its final `endBoundary` is accepted — the external, structural proof that one `boundaries` array served both prompt-building and validation.

## Task Commits

- `feat(34-03)`: `b823464` — `SPLIT_SYSTEM_PROMPT`, `splitCongregationalReading()`, and 16 tests covering both PLAN.md tasks (call shape + failure paths) in one commit.

**Plan metadata:** committed below (`docs(34-03): complete plan`).

## Files Created/Modified

- `src/utils/claudeApi.ts` (modified, append-only) — added `jsonSchemaOutputFormat` import from the SDK's `helpers/json-schema` subpath, a `CongregationalSection` type import, six named imports from `scriptureBoundaries.ts`, and appended `SPLIT_SYSTEM_PROMPT` + `splitCongregationalReading()` after 34-02's `// ─── Congregational Split ───` section (no new section header added, per this wave's explicit instruction). `getSongSuggestions`/`getScriptureSuggestions` and everything above the import additions are byte-unchanged — confirmed via `git diff`, which shows only the import-block hunk and one pure-append hunk at the end of the file.
- `src/utils/__tests__/claudeApi.test.ts` (modified, append-only) — extended the `vi.hoisted` mock factory with a second `mockParse` function alongside the existing `mockCreate` (the `@anthropic-ai/sdk` mock factory's `messages` object now exposes both `create` and `parse`), added `splitCongregationalReading`, `computeBoundaries`, `sliceAtBoundaries`, `stripVerseMarkers`, `verseRangeForSlice`, and `BOUNDARY_MARKER_OPEN` to the import statements, and appended a new `describe('splitCongregationalReading', ...)` block after the existing `validateSplitResult` suite. No existing test was modified.

## Decisions Made

- Extended the existing `vi.hoisted` factory with a second key (`mockParse`) rather than mocking `.parse()` as a wrapper calling through to `mockCreate` + a real `parseMessage` — matching the plan's "Resolved spike" instruction exactly: `.parse()` is mocked directly as its own function, and tests assert against `mockParse.mock.calls` for the captured request/options.
- Did not assert `request.output_config.format.schema === SPLIT_SCHEMA` (strict identity). Reading the installed SDK's `lib/transform-json-schema.js` confirmed `jsonSchemaOutputFormat` deep-clones (`JSON.parse(JSON.stringify(...))`) and restructures the schema by default (`transform: true`) — including folding `enum` into a synthesized `description` string rather than preserving it as a JSON Schema `enum` key. The call-shape test instead asserts `format.type === 'json_schema'` and `format.schema.properties` has a `sections` key, which is stable regardless of the transform's internal representation.
- Used a hand-fixture passage (`'[1] The Lord is my shepherd; I shall not want. [2] He makes me lie down in green pastures.'`) and computed its real `boundaries` via the actual (unmocked) `computeBoundaries()` in the test file, rather than hand-coding a boundary array — so the tests exercise the true boundary-computation output the implementation will also see, not a fixture that could drift from `scriptureBoundaries.ts`'s real behavior.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues were found; both tasks' behavior was achievable directly from the plan's `<action>` blocks and 34-01/34-02's already-tested exports.

### Process Deviation (commit granularity, not scope/design)

**1. Combined PLAN.md's two tasks into a single commit rather than four RED/GREEN commits**
- **What the plan implied:** Two `tdd="true"` tasks (Task 1: call shape + happy path; Task 2: failure paths), each following a genuine RED → GREEN cycle, as 34-01 and 34-02 did (4 commits total: test/feat × 2).
- **What happened:** All 16 tests (spanning both tasks' behavior bullets) were authored together in the same `describe` block, then the implementation was written to satisfy all of them, then committed as a single `feat(34-03)` commit.
- **Why:** Task 2's own `<action>` text describes it as "write these rejection tests against the implementation from Task 1 and fix any path that does not already satisfy them" — in practice, the implementation drafted to satisfy Task 1's call-shape/happy-path tests already satisfied every Task 2 rejection case without modification (the pre-flight refusals, try/catch-to-null, and total-rejection-via-`validateSplitResult` were all structural consequences of following the plan's `<action>` for Task 1 correctly), so there was no genuine second GREEN gate to separate.
- **Impact:** None on scope, design, or test content — every behavior bullet in both tasks has its own `it(...)` case, all pass, and the acceptance criteria for both tasks are met. Only the commit-history granularity differs from the four-commit RED/GREEN pattern used in 34-01/34-02.
- **Files/commit:** `src/utils/claudeApi.ts`, `src/utils/__tests__/claudeApi.test.ts` — `b823464`.

---

**Total deviations:** 1 process deviation (commit granularity), 0 scope/design changes, 0 auto-fixed bugs.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. This plan makes a real shape of network call (`messages.parse`) but all tests mock the SDK; no live Anthropic API access was used or needed. `package.json` and `functions/` are untouched.

## Verification Evidence

- `npx vitest run src/utils/__tests__/claudeApi.test.ts src/utils/__tests__/scriptureBoundaries.test.ts` — 86/86 pass (63 in `claudeApi.test.ts` = 47 pre-existing + 16 new; scriptureBoundaries unchanged at 23).
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run src/` — 2 failed files / 9 failed tests (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 78 passed files / 2197 passed tests. Exact match to the documented non-defect baseline; the passing count rose from 34-02's 2181 to 2197 solely because this plan added 16 new tests.
- `getSongSuggestions`/`getScriptureSuggestions`: confirmed byte-identical via `git diff` — the only hunks in `src/utils/claudeApi.ts` are the import-block addition at the top and one pure-append block at the end; nothing between them (including both existing functions) was touched.
- `git diff --stat -- functions/ package.json` — empty, confirming neither was modified.

## Next Phase Readiness

**What Wave 3 (34-04) needs and gets from this plan:**
- `splitCongregationalReading(rawText: string): Promise<CongregationalSection[] | null>` is exported from `src/utils/claudeApi.ts`, ready for `CongregationalEditor.vue` to call directly from an `onAiSplit()` handler behind a `data-testid="ai-split-btn"` affordance — it takes only the raw ESV text already in the component's state and returns either a ready-to-assign `CongregationalSection[]` or `null` (failure, surface via `useToasts`, leave `sections.value` untouched).
- The function never throws — 34-04's handler can `await splitCongregationalReading(rawText)` and branch on `null` without a try/catch of its own (though wrapping defensively is harmless).
- `isSplitting`/`canAiSplit` are component-local concerns 34-04 owns; this plan does not gate the affordance's *visibility* (that's `hasSplittableBoundaries` from 34-01, already exported and ready to import directly into the component for the `canAiSplit` computed).
- No blockers. `npm run type-check` is clean, `npx vitest run src/` shows the unchanged 2-file/9-test baseline, and `package.json`/`functions/` are untouched.
- **Requirements tracking note (repeating 34-01/34-02's flag):** This plan lists `requirements: [R064]` in its own frontmatter, but per this plan's explicit `<project_gates>` instruction, `requirements mark-complete R064` was **not** run — 34-04 (the phase's last plan) owns that step, since R064's full end-to-end claim isn't true until the UI affordance is wired in. This SUMMARY's frontmatter therefore lists `requirements-completed: []` rather than `[R064]`, to avoid implying completion at the phase-tracking layer prematurely.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `src/utils/claudeApi.ts`
- FOUND: `src/utils/__tests__/claudeApi.test.ts`
- FOUND commit: `b823464` (feat — both tasks)
