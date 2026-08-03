---
phase: 34-smarter-content-llm-scripture-split
plan: 02
subsystem: api
tags: [claude-api, structured-outputs, json-schema, validation, r064, congregational-reading]

requires:
  - phase: 34-smarter-content-llm-scripture-split (plan 01)
    provides: "boundary-index contract (computeBoundaries, hasSplittableBoundaries, embedBoundaryMarkers, sliceAtBoundaries) that this plan's validator's `boundaries` parameter is designed to consume"
provides:
  - "SplitSection interface: {speaker: 'LEADER'|'CONGREGATION', startBoundary: number, endBoundary: number} — the structural data the model is allowed to return"
  - "SPLIT_SCHEMA: additionalProperties:false at root and per-section, no string field beyond speaker's closed two-value enum — the model's entire permitted vocabulary"
  - "validateSplitResult(parsed, boundaries): SplitSection[] | null — the sole gate between model output and rendered scripture; total rejection on any single violation, no repair/coercion/re-sort"
affects: [34-03, 34-04]

tech-stack:
  added: []
  patterns:
    - "Total-rejection validation: a single equality check (startBoundary === prevEnd) simultaneously rejects gaps, overlaps, and out-of-order results — the adjacency invariant makes all three failure modes structurally identical"
    - "Schema-as-guarantee: the JSON Schema's field set itself is part of the correctness argument (P-02), not just the code that reads it — asserted by a schema-walking test, not by eye"
    - "Frozen-input mutation proof: Object.freeze() on every level of a test fixture turns 'does not mutate the input' from an eyeballed assertion into a structural one (a mutation attempt throws under ESM strict mode)"

key-files:
  created: []
  modified:
    - src/utils/claudeApi.ts
    - src/utils/__tests__/claudeApi.test.ts

key-decisions:
  - "Split the plan's two tasks into four separate TDD commits (test/feat x2) rather than one combined RED/GREEN cycle per task, matching 34-01's precedent and keeping each gate's failure genuinely attributable to the task it belongs to."
  - "Key-set check for the extra-property rejection test uses exact-length-3 + all-three-names-present rather than an allowlist filter, so any additional property (including a scripture-word-bearing one) fails structurally rather than being silently dropped."
  - "Companion out-of-order assertion re-sorts the identical section array with Array.prototype.sort in the TEST (not the function under test) and asserts it IS accepted — proving validateSplitResult only ever validates the order given, never repairs it."

patterns-established:
  - "Pattern: schema-as-guarantee — for any model-facing JSON Schema carrying a correctness claim, add a deep-walk test asserting no disallowed field type exists anywhere in the tree, not just at the properties the author remembers to check."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "SPLIT_SCHEMA declares the model's entire permitted vocabulary: speaker enum (LEADER/CONGREGATION only) + two integer indices, additionalProperties:false at both levels, no string field anywhere except speaker's closed enum"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#SPLIT_SCHEMA"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateSplitResult() accepts a well-formed, gapless, in-range, fully-spanning result and returns it without mutating the input"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#validateSplitResult > accepts a well-formed result"
        status: pass
    human_judgment: false
  - id: D3
    description: "validateSplitResult() rejects every enumerated failure mode with total rejection (null, never partial/repaired): malformed top-level shape (null/non-object/no-key/non-array), empty array, out-of-range bounds, non-integer (float/NaN/numeric-string), inverted/zero-length span, overlap, gap, wrong start/end anchor, out-of-order (with a did-not-re-sort companion proof), unrecognised/lowercase speaker, and an extra property carrying scripture words"
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#validateSplitResult (19 rejection cases)"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 02: SPLIT_SCHEMA and validateSplitResult() Summary

**The model's entire permitted vocabulary (speaker enum + two integer boundary indices, `additionalProperties:false` everywhere) and the client-side `validateSplitResult()` gate — 19 distinct rejection tests plus one acceptance test prove every bounds/ordering/adjacency/coverage check the JSON Schema subset cannot express.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-03T07:32:53Z
- **Completed:** 2026-08-03T07:42:32Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 2 (both existing, appended to only)

## Accomplishments
- `SplitSection` interface and `SPLIT_SCHEMA` const exported from `src/utils/claudeApi.ts`: a root object with a single `sections` array property, whose items carry exactly `speaker` (enum `LEADER`/`CONGREGATION`), `startBoundary` (integer), `endBoundary` (integer) — `additionalProperties: false` at both the root and per-section level, and no other string-typed field anywhere in the tree (proven by a schema-walking test, not eyeballed).
- `validateSplitResult(parsed, boundaries)`: the sole client-side gate between untrusted model output and rendered scripture. Validates shape (non-null object, `sections` key, non-empty array), per-section key-set exactness, speaker enum membership, integer-ness (`Number.isInteger`, rejecting floats/NaN/numeric strings), in-range bounds against `[0, boundaries.length - 1]`, `startBoundary < endBoundary`, adjacency (`startBoundary === prevEnd`, which rejects gap/overlap/out-of-order identically), and whole-passage coverage (first section starts at 0, last ends at `maxIndex`). Any single violation returns `null` — never a partial array, never a repair, never a re-sort.
- 24 new tests: 4 for `SPLIT_SCHEMA` (additionalProperties, exact property set, P-02 deep-walk-for-string-fields, integer types) and 20 for `validateSplitResult` (1 acceptance with a frozen-input mutation proof + 19 distinct rejection cases, including a companion assertion proving the out-of-order rejection is a genuine ordering check and not silent re-sorting).

## Task Commits

Each task followed the RED → GREEN TDD cycle:

1. **Task 1: SPLIT_SCHEMA and the SplitSection contract**
   - `test(34-02)`: `5a32b75` — 4 failing tests (genuine RED: `SPLIT_SCHEMA` undefined; 23 pre-existing tests still passed)
   - `feat(34-02)`: `6ba7d5e` — implementation, all 27 tests pass
2. **Task 2: validateSplitResult() tested against every individual failure mode**
   - `test(34-02)`: `9b96aab` — 20 failing tests (genuine RED: `validateSplitResult is not a function`; 27 pre-existing tests still passed)
   - `feat(34-02)`: `bf1c30c` — implementation, all 47 tests pass

**Plan metadata:** committed below (`docs(34-02): complete plan`).

## Files Created/Modified
- `src/utils/claudeApi.ts` (modified, append-only) — added a new `// ─── Congregational Split ───` section below the existing scripture-suggestion code: `SplitSection`, `SPLIT_SCHEMA`, `validateSplitResult()`. `getSongSuggestions`/`getScriptureSuggestions` and everything above the new section are byte-unchanged (`git diff` confirms only additive hunks).
- `src/utils/__tests__/claudeApi.test.ts` (modified, append-only) — added `describe('SPLIT_SCHEMA', ...)` and `describe('validateSplitResult', ...)` blocks after the existing suites. No existing test was modified.

## Decisions Made
- Ran each task as its own genuine RED → GREEN cycle (rather than writing both tasks' tests together and implementing both at once), splitting a first combined draft back into two after noticing it collapsed the plan's two distinct task-level gates into one. This required one `git checkout --` revert of the test file mid-execution to redo it correctly — see Deviations.
- Chose `Object.freeze()` on every level of the acceptance test's input fixture as the "does not mutate the input" proof, rather than a before/after deep-equal comparison — a mutation attempt inside `validateSplitResult` would throw (ES modules are strict-mode by default), making the assertion structural rather than merely observational.
- The out-of-order companion assertion sorts the identical section array in the *test*, not by adding any sort call to `validateSplitResult` itself, to prove the rejection is a genuine ordering check and the function never silently repairs input order.

## Deviations from Plan

None from the plan's design — one self-caught process correction during execution:

### Auto-fixed Issues

**1. [Rule 1 - process bug in my own execution, not the plan] Combined both tasks' RED tests into one edit, then split them back apart**
- **Found during:** immediately after writing the first draft of Task 1 + Task 2 tests together and running the suite
- **Issue:** I initially wrote SPLIT_SCHEMA tests and validateSplitResult tests in a single edit before implementing anything, which would have collapsed the plan's two explicit task-level RED/GREEN gates (Task 1: schema, Task 2: validator) into one combined cycle — losing the per-task commit granularity the plan's `<tasks>` structure and `task_commit_protocol` require.
- **Fix:** Reverted the test file to its pre-change state (`git checkout -- src/utils/__tests__/claudeApi.test.ts`), then re-applied the SPLIT_SCHEMA tests alone as Task 1's RED, implemented and committed Task 1's GREEN, then added the validateSplitResult tests as Task 2's RED, implemented and committed Task 2's GREEN.
- **Files modified:** `src/utils/__tests__/claudeApi.test.ts` (no source files affected — this was purely a test-authoring sequencing correction, not a logic change)
- **Verification:** Re-ran `npx vitest run src/utils/__tests__/claudeApi.test.ts` after each RED and each GREEN step; final state has all 4 commits with the correct fail→pass transitions per task.
- **Committed in:** `5a32b75`, `6ba7d5e`, `9b96aab`, `bf1c30c` (the four task commits, correctly separated)

---

**Total deviations:** 1 auto-fixed (process/sequencing correction, Rule 1)
**Impact on plan:** None on scope, design, or test content — the final test and implementation content is identical to what a correctly-sequenced execution would have produced; only the commit-granularity discipline was corrected mid-flight.

## Issues Encountered
None beyond the self-corrected sequencing above.

## User Setup Required
None — no external service configuration required. This plan adds no new dependency (per plan constraint, `package.json` is unchanged), touches no `functions/` code, and makes no network call — `SPLIT_SCHEMA`/`validateSplitResult` are pure data/validation, not wired to any API call yet (that's 34-03's `splitCongregationalReading()`).

## Verification Evidence

- `npx vitest run src/utils/__tests__/claudeApi.test.ts` — 47/47 pass (23 pre-existing + 24 new), pre-existing cases unmodified.
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run src/` — 2 failed files / 9 failed tests (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 78 passed files / 2181 passed tests. Exact match to the documented non-defect baseline (the test count rose from the phase's starting 2157 to 2181 solely because this plan added 24 new tests; the failing set is unchanged).
- `getSongSuggestions`/`getScriptureSuggestions`: confirmed byte-identical via `git diff` — every hunk in `src/utils/claudeApi.ts` across this plan's four commits is a pure addition after the existing code, nothing above the new `// ─── Congregational Split ───` section was touched.
- `git diff --stat` against `functions/` and `package.json` from the plan's starting commit: empty — neither was touched.

## Next Phase Readiness

**What Wave 2 (34-03) needs and gets from this plan:**
- `SplitSection`, `SPLIT_SCHEMA`, and `validateSplitResult(parsed, boundaries)` are exported from `src/utils/claudeApi.ts`, ready for `splitCongregationalReading()` to import and call immediately after the `messages.parse()` response returns — `validateSplitResult` expects to be called with the *same* `boundaries` array threaded from `computeBoundaries()` (34-01), never recomputed (RESEARCH Pitfall 5 discipline).
- `SPLIT_SCHEMA` is ready to pass to the SDK's `jsonSchemaOutputFormat()` helper (already present, non-beta, in the installed `@anthropic-ai/sdk@0.78.0` — no upgrade needed per RESEARCH's corrected premise).
- 34-03 shares `claudeApi.ts` with this plan (both append to the same file) — 34-03's own tasks should append `SPLIT_SYSTEM_PROMPT` and `splitCongregationalReading()` after this plan's `// ─── Congregational Split ───` section, continuing the same section rather than creating a new one.
- No blockers. `npm run type-check` is clean, `npx vitest run src/` shows the unchanged 2-file/9-test baseline, and `package.json`/`functions/` are untouched.
- **Requirements tracking note (repeating 34-01's flag):** This plan lists `requirements: [R064]` in its own frontmatter (as does every plan in this phase), but per the plan's explicit `<project_gates>` instruction, `requirements mark-complete R064` was **not** run — 34-04 (the phase's last plan) owns that step, since R064's full end-to-end claim isn't true until the UI affordance is wired in.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `src/utils/claudeApi.ts`
- FOUND: `src/utils/__tests__/claudeApi.test.ts`
- FOUND commit: `5a32b75` (test — Task 1 RED)
- FOUND commit: `6ba7d5e` (feat — Task 1 GREEN)
- FOUND commit: `9b96aab` (test — Task 2 RED)
- FOUND commit: `bf1c30c` (feat — Task 2 GREEN)
