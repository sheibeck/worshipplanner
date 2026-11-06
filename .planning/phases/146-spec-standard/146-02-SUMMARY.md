---
phase: 146-spec-standard
plan: 02
subsystem: docs
tags: [spec-driven, template, adr, claude-md, tdd-mode, vitest-guards]

requires:
  - phase: 146-01
    provides: "parseSpec, runSpecCoverage and the makeRepo helper in src/__tests__/specCoverage(.test).ts"
provides:
  - "docs/specs/TEMPLATE.md: the spec template with sample AC-XXX IDs, Retired list and citation form"
  - "ADR-0248: rationale for the spec standard and the check, including the discretionary not-counted rules"
  - "CLAUDE.md '## Spec-driven development' section and the baseline note about specCoverage failing on purpose"
  - "PROJECT.md standing '## Development Philosophy' section ahead of every milestone block"
  - "13 guard tests (R454, R455, R456, R457, R458) binding template, rule text and tdd_mode to the check"
affects: [147-default-rehearsal-spec, 148-spec-backfill]

tech-stack:
  added: []
  patterns:
    - "Rule sentences held verbatim in two docs and asserted as substrings, so drift fails the root run"
    - "Docs read inside each test, not at module load, so one missing file does not fail collection"

key-files:
  created:
    - docs/specs/TEMPLATE.md
    - docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md
  modified:
    - src/__tests__/specCoverage.test.ts
    - docs/adr/README.md
    - CLAUDE.md
    - .planning/PROJECT.md

key-decisions:
  - "ADR-0248 records fails, skipIf, runIf, options-object switch-off, no-body and empty-body tests and the active-child describe rule as Claude's discretion serving the owner's locked .skip/.todo decision, not as the owner's words"
  - "The philosophy paragraph under PROJECT.md Current Milestone is replaced by a one-line pointer, so closing v2.17 leaves the standing section in place"
  - "CLAUDE.md and PROJECT.md edited with a node script using \\r\\n-tolerant anchors; both files stay w/crlf with no line-ending churn"

patterns-established:
  - "Guard tests carry no AC- token in titles (the scan reads the test file too)"

requirements-completed: [R454, R455, R458]

coverage:
  - id: D1
    description: "Template parses clean under the check's parser, has the eight sections in order, shows ID format, Retired list and citation form, and a copy of it is read as a real spec while TEMPLATE.md stays ignored"
    requirement: "R454"
    verification:
      - kind: unit
        ref: "src/__tests__/specCoverage.test.ts#docs/specs/TEMPLATE.md (R454, R456)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CLAUDE.md and PROJECT.md carry the same rule sentence, PROJECT.md keeps it in a standing section, both state rollout and map-doc phrases, CLAUDE.md covers bug fixes, retired criteria, what does not count and what a pass proves"
    requirement: "R455"
    verification:
      - kind: unit
        ref: "src/__tests__/specCoverage.test.ts#the spec rule (R455)"
        status: pass
    human_judgment: true
  - id: D3
    description: "workflow.tdd_mode is true; both docs state the test-first split; CLAUDE.md warns the planner heuristic does not exempt a store change; the Testing baseline notes the check fails on purpose"
    requirement: "R458"
    verification:
      - kind: unit
        ref: "src/__tests__/specCoverage.test.ts#test-first setting (R458)"
        status: pass
    human_judgment: true

duration: 25min
completed: 2026-11-06
status: complete
---

# Phase 146 Plan 02: Spec Template, Rule and Rationale Summary

**A copy-and-fill spec template, ADR-0248, and the spec-then-tests-then-code rule written verbatim into CLAUDE.md and a standing PROJECT.md section, with 13 guard tests that fail the root run if any of it drifts.**

## Performance

- **Duration:** about 25 min (the bare `npx vitest run` is about 5 min of that)
- **Tasks:** 3 (guards first, then template and ADR, then rule docs)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `docs/specs/TEMPLATE.md` has the eight required sections in order, sample IDs `AC-XXX-01`/`02`, a Retired entry `AC-XXX-00`, and a `it('does the thing (AC-XXX-01)'...)` citation line. `docs/specs/` holds only this file.
- ADR-0248 records decisions (a) to (h), marks (e) and (f) as Claude's discretion extending the owner's locked `.skip`/`.todo` decision, and lists the consequences (a pass proves a title cites a criterion, not that the test ran).
- `CLAUDE.md` gained `## Spec-driven development` before the Testing section, and the Testing baseline line now says `specCoverage.test.ts` fails on purpose between a spec's commit and its test commits.
- `.planning/PROJECT.md` gained a standing `## Development Philosophy` section between Core Value and Current State. The Current Milestone paragraph became a one-line pointer.

## Task Commits

1. **Task 1 (RED guards):** `cf02d18f` test(146-02): add failing guards for the template, rule and tdd_mode (R454, R455, R458)
2. **Task 2 (template + ADR):** `cf1553cd` docs(146-02): add spec template and ADR-0248 (R454, R456)
3. **Task 3 (rule docs):** `77972ba6` docs(146-02): record the spec-first rule in CLAUDE.md and PROJECT.md (R455, R458)

## RED Run Before the Docs Existed

`npx vitest run src/__tests__/specCoverage.test.ts -t "R454|R455|R458"` at Task 1: 12 failed, 1 passed (96 skipped). The one pass was `workflow.tdd_mode is true in .planning/config.json (R458)`, expected because `tdd_mode` was already `true`. The Plan 01 tests (`extractCitations|parseSpec|checkSpecCoverage|findTestFiles|the real repo`) stayed at 96 passed.

## Verification

- `npx vitest run src/__tests__/specCoverage.test.ts`: 109 passed.
- `npm run type-check`: exit 0.
- `npx eslint src/__tests__/specCoverage.test.ts`: no errors (the oxlint config notice is the known repo condition).
- Bare `npx vitest run`: 252 files passed, 1 failed (253); 6266 tests passed, 43 skipped. The one failing file is `src/storage.rules.test.ts`, the documented baseline. `specCoverage.test.ts` passes.
- `ls docs/specs` prints `TEMPLATE.md` only; no `.gitattributes`; `.planning/config.json` and `eslint.config.ts` untouched.
- `git ls-files --eol`: `CLAUDE.md` and `.planning/PROJECT.md` both `w/crlf`. Commit 77972ba6 changed 20 lines in CLAUDE.md and 13 in PROJECT.md, so no line-ending churn.

## Deviations from Plan

None - plan executed exactly as written. The Edit tool was replaced by a short `node` script for the CLAUDE.md and PROJECT.md edits (the plan allowed this for CRLF files); the result is `w/crlf` throughout.

## Open for /gsd-verify-work

The three prohibitions are judgment-tier and stay with a human: that no wording calls a green check proof the test ran or the behavior works, that no wording blocks an existing spec-less feature before v2.18 or covers Phase 146 itself, and that the UI exception is not widened. Mechanical backing: the phrase and sentence guards listed in the plan.

## Known Stubs

None.

## Threat Flags

None. Docs and tests only; no network, auth or storage surface. T-146-04 is mitigated by the `SPEC_RULE` and `TEST_FIRST_RULE` guards.

## Self-Check: PASSED

- FOUND: docs/specs/TEMPLATE.md
- FOUND: docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md
- FOUND commits: cf02d18f, cf1553cd, 77972ba6
