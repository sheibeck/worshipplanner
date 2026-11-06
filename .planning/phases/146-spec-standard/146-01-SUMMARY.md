---
phase: 146-spec-standard
plan: 01
subsystem: testing
tags: [vitest, typescript-ast, spec-driven, traceability]

requires: []
provides:
  - "src/__tests__/specCoverage.ts: extractCitations, parseSpec, checkSpecCoverage, findTestFiles, runSpecCoverage"
  - "src/__tests__/specCoverage.test.ts: 96 tests plus the makeRepo temp-tree helper and the real-repo run"
affects: [146-02, 147-default-rehearsal-spec, 148-spec-backfill]

tech-stack:
  added: []
  patterns:
    - "Citation = ID in the title of a test that can really run, read from the TypeScript AST, never regex over source"
    - "Pure module (no vitest import) plus a .test.ts that does only I/O and assertions"
    - "Every not-counted row carries an active control test so it cannot pass by returning nothing"

key-files:
  created:
    - src/__tests__/specCoverage.ts
    - src/__tests__/specCoverage.test.ts
  modified: []

key-decisions:
  - "Specs are sorted by name before cross-spec checks, so the 'code already used by' wording never depends on input order"
  - "Retired-section list items with no AC id are ignored; only an AC-prefixed item is validated (a prose note there is not an error)"
  - "'no acceptance criteria' is emitted only when the Acceptance criteria section holds no list items at all, so a spec with only malformed IDs gets the specific error and not a duplicate"
  - "A criterion with a mismatched code or malformed ID is reported and not added to the criteria set"

patterns-established:
  - "Test fixtures live in string constants or a mkdtemp tree; nothing is written into the repo"
  - "No AC- token in any it/describe title in the check's own test file; a self-scan test enforces it"

requirements-completed: [R456, R457]

coverage:
  - id: D1
    description: "extractCitations counts only IDs in titles of tests that can run (skip, todo, fails, skipIf, runIf, x-prefix, options-object off, no/empty body, inactive describe are not counted)"
    requirement: "R457"
    verification:
      - kind: unit
        ref: "src/__tests__/specCoverage.test.ts#extractCitations (R457)"
        status: pass
    human_judgment: false
  - id: D2
    description: "parseSpec and checkSpecCoverage report every uncited criterion and every ID/code collision by name, order-independently"
    requirement: "R456"
    verification:
      - kind: unit
        ref: "src/__tests__/specCoverage.test.ts#parseSpec (R456) and checkSpecCoverage (R456, R457)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A bare npx vitest run runs the check against this repo and passes while docs/specs is empty"
    requirement: "R457"
    verification:
      - kind: unit
        ref: "src/__tests__/specCoverage.test.ts#the real repo (R457)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-06
status: complete
---

# Phase 146 Plan 01: Spec Coverage Check Summary

**A vitest-wired check that fails a bare `npx vitest run` whenever a spec criterion has no real test citing its AC ID in a title, using the TypeScript AST so skipped, todo and empty tests never count.**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-06T16:50:00Z
- **Completed:** 2026-11-06T17:11:00Z
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 2 (both new)

## Accomplishments

- `extractCitations` walks `ts.createSourceFile` output and counts a title only when the test can run: not under a skip, todo, fails, skipIf, runIf, x-prefix or options-object switch-off, with a non-empty body, and for a describe only when it holds a counted test.
- `parseSpec` is a line-based, never-throwing parser for the `**Code:**` line, `## Acceptance criteria` and `## Retired criteria`, ignoring fences, HTML comments and prose in other sections, and CRLF-safe.
- `checkSpecCoverage` returns a sorted, de-duplicated error list with the contract strings, so order never changes a verdict.
- `findTestFiles` and `runSpecCoverage` read `src`, `functions/src` and `render-service/src` (including `src/rules.test.ts` and `src/storage.rules.test.ts`), skip `node_modules`, ignore `functions/lib`, `TEMPLATE.md` and `README.md`, and prefilter on `AC-` so the real run parses about one file.
- No allowlist, exclusion list, baseline, flag or opt-out exists anywhere in the module or its test (T-146-01).

## Task Commits

1. **Task 1 RED:** `4422f2c7` test(146-01): add failing tests for citation extraction (R457)
2. **Task 1 GREEN:** `c998cd9c` feat(146-01): implement citation extraction (R457)
3. **Task 2 RED:** `35cece1e` test(146-01): add failing tests for spec parsing and the repo scan (R456, R457)
4. **Task 2 GREEN:** `babbc3d1` feat(146-01): implement spec parsing, coverage rules and the repo scan (R456, R457)

No refactor commit was needed.

## RED Notes

At the Task 2 RED commit 36 tests failed and two passed, both expected: `the real repo (R457) > passes: every criterion in docs/specs is cited by a test` (an empty stub returns `[]`; the temp-tree tests prove the wiring) and `cites nothing from its own test file` (the stub returns nothing). At the Task 1 RED commit all 58 `extractCitations` tests failed.

## Verification

- `npx vitest run src/__tests__/specCoverage.test.ts`: 96 passed.
- `npm run type-check`: exit 0.
- `npx eslint` on both files: no errors (the oxlint config notice is the known repo condition).
- Bare `npx vitest run`: 252 files passed, 1 failed (253). The one failure is `src/storage.rules.test.ts`, confirmed failing on its own (Storage emulator), which is the documented baseline.
- `docs/specs` does not exist; this plan wrote no spec and no fixture file in the repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] eslint `vitest/valid-expect` on `expect(files, f)`**
- **Found during:** Task 2 GREEN lint pass
- **Issue:** the two-argument `expect(value, message)` form is rejected by the repo's lint rule
- **Fix:** used `expect(files).toContain(f)` inside the loop
- **Files modified:** `src/__tests__/specCoverage.test.ts`
- **Commit:** `babbc3d1`

**2. [Test tightening] Nested-directory test made non-vacuous**
- **Found during:** Task 2 RED run
- **Issue:** the first draft (nested spec ignored, everything cited, expect `[]`) passed against an empty stub
- **Fix:** the top-level spec carries an uncited criterion, so the test needs the real scan to report exactly that one while ignoring the nested spec
- **Commit:** `35cece1e`

Otherwise, the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. The check reads repo text and never executes it; roots are fixed literals resolved against `root`.

## Issues Encountered

None blocking.

## Next Plan Readiness

Plan 02 can extend `specCoverage.test.ts` and reuse `makeRepo`. Its ADR-0248 (referenced by the file header) must record the discretionary rules: `fails`, `skipIf`, `runIf`, options-object switch-off, no-body and empty-body tests, and the active-child rule for describe citations. During Phase 147, between its spec commit and its test commits, a bare run is red on `specCoverage.test.ts` by design.

## Self-Check: PASSED

- FOUND: src/__tests__/specCoverage.ts
- FOUND: src/__tests__/specCoverage.test.ts
- FOUND commits: 4422f2c7, c998cd9c, 35cece1e, babbc3d1
