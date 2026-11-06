---
phase: 146-spec-standard
verified: 2026-11-06T00:00:00Z
status: human_needed
score: 5/5 roadmap success criteria verified (automated); 3 judgment-tier prohibitions + 1 plan-01 prohibition awaiting human judgment
behavior_unverified: 0
overrides_applied: 0
gaps: []
human_verification:
  - test: "Plan 01 prohibition: no way to pass the check without a real citation"
    expected: "No allowlist, exclusion list, baseline file, env flag or per-spec opt-out in src/__tests__/specCoverage.ts or its test. Read the two files and confirm the only exclusions are TEMPLATE.md/README.md (documented, ADR-0248 g) and node_modules."
    why_human: "judgment-tier; a conditional bypass would not fail the mechanical tests"
  - test: "Plan 02 prohibition: a green check is never described as proof the test ran or the behavior works"
    expected: "TEMPLATE.md (Tests section), CLAUDE.md (The check bullet) and ADR-0248 (Consequences) each say a pass proves a title cites the criterion, not that the test ran or asserts anything. Read ADR-0248 and the three passages."
    why_human: "judgment-tier; only part of the wording is test-pinned"
  - test: "Plan 02 prohibition: no implication that an existing feature without a spec is blocked before v2.18, or that the rule covers Phase 146"
    expected: "CLAUDE.md '## Spec-driven development' and PROJECT.md '## Development Philosophy' say 'applies from Phase 147 on' and 'A change to an existing feature without a spec goes ahead'. Read both sections as a planner would."
    why_human: "judgment-tier; tests prove the phrases exist, not what the text implies"
  - test: "Plan 02 prohibition: the UI exception is not widened"
    expected: "Read CLAUDE.md '## Spec-driven development' (incl. the tdd_mode bullet: 'does not exempt a store change. Only UI layout tests may land with the code') and PROJECT.md. The exception must cover UI layout tests only, never a store, utility, function or security rule."
    why_human: "judgment-tier; the verbatim sentences are test-pinned, the surrounding text is not"
---

# Phase 146: Spec Standard Verification Report

**Phase Goal:** A feature can only start from a written spec. The spec format, the spec-then-tests-then-code rule and the test-first setting are all in force, and an automated check catches any acceptance criterion that no test cites.
**Verified:** 2026-11-06
**Status:** human_needed (no gaps; four judgment-tier prohibitions need a person)
**Re-verification:** No, initial verification

## Gate runs (run for real, on current HEAD e3430edc)

| Gate | Result |
| ---- | ------ |
| bare `npx vitest run` | `Test Files 1 failed \| 252 passed (253)`; `Tests 6324 passed \| 43 skipped`. The one failing file is `src/storage.rules.test.ts` (baseline). `src/__tests__/specCoverage.test.ts` 167/167 passed. |
| `npm run type-check` (`vue-tsc --build`) | exit 0 |
| Uncited-criterion proof on the real path | Added `docs/specs/zzz-throwaway.md` (code `ZZZ`, one criterion `AC-ZZZ-01`). `npx vitest run src/__tests__/specCoverage.test.ts` -> 1 failed / 166 passed, failing test `the real repo (R457) > passes: every criterion in docs/specs is cited by a test`, diff line `AC-ZZZ-01 (zzz-throwaway.md) has no test citing it`. Deleted the file; `ls docs/specs` = `TEMPLATE.md` only; `git status` shows only the four unrelated `.planning/graphs/*` files; re-run -> 167/167 pass. |
| TEMPLATE.md copy with code replaced | `XXX` -> `QQQ` and `parseSpec` returned `code QQQ`, criteria `AC-QQQ-01/02`, retired `AC-QQQ-00`, `errors: []`. The in-repo test `a copied template is read as a real spec while the template stays ignored` also passes. |
| e4fe5c86 inputs (`CRITERION_SHAPE`, specCoverage.ts:201) | Run against real `parseSpec` after `- **AC-FIX-01** - a`: `**AC-FIX-02** - b` errors; `  **AC-FIX-02** - b` errors; `  - **AC-FIX-02:** b` errors; `__AC-FIX-02__ - b` errors (all "not a top-level list item", AC-FIX-02 not silently dropped). `**AC-FIX-01** does`, `  **AC-FIX-01** does`, `AC-FIX-01 when x`, `  - AC-FIX-01 still holds` all stay continuations (`errors: []`); a proper `- **AC-FIX-02** - b` registers both criteria. |

`146-REVIEW.md` still says `status: issues_found` because no re-review followed e4fe5c86. The code shows the one open WR-01 finding is fixed (inputs above). The status field is stale, not the code.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Copying `docs/specs/TEMPLATE.md` starts a spec; it has purpose, behavior, numbered criteria, edge cases, out of scope, links to tests and ADRs (R454) | VERIFIED | Template has 8 H2s in order: Purpose, Behavior, Acceptance criteria, Edge cases, Out of scope, Retired criteria, Tests, ADRs. Pinned by `has every required section in order (R454)`; copy parses clean (run above). |
| 2 | CLAUDE.md and PROJECT.md state the same rule; in PROJECT.md it is in a standing section (R455) | VERIFIED | Identical line `No feature work starts until its spec exists in docs/specs/, and a behavior change updates the spec before the tests and the code.` at CLAUDE.md:49 and PROJECT.md:16. PROJECT.md `## Development Philosophy` is line 12, between Core Value and Current State (line 22), ahead of `## Current Milestone: v2.17` (line 38); the milestone block now holds only a pointer. Both files still all-CRLF (`git ls-files --eol` w/crlf). Guarded by 4 R455 tests. |
| 3 | Template shows the ID format and how a test cites an ID; IDs unique across specs and stable under add/remove/reorder (R456) | VERIFIED | Template shows `**AC-XXX-01**`, Retired list, and `it('does the thing (AC-XXX-01)', ...)`. IDs are literal text; `checkSpecCoverage` reports duplicates within and across specs, code collisions, and is order-independent (sorted, de-duplicated). 167 tests include reorder/duplicate/adjacency cases. |
| 4 | Fixture with one uncited criterion fails naming the ID; fully cited fixture passes; ignores TEMPLATE.md; finds citations in app, rules, functions/, render-service/; runs in `npx vitest run` (R457) | VERIFIED | Real-path proof above (names `AC-ZZZ-01`, then passes). `TEST_ROOTS = ['src','functions/src','render-service/src']` (rules tests live in `src/`); `runSpecCoverage` skips TEMPLATE.md and README.md; check is a plain `src/__tests__/*.test.ts` so the bare run collects it (167 tests ran in the full run). Temp-tree tests cover all five locations plus `functions/lib` and `node_modules` exclusions. |
| 5 | `workflow.tdd_mode` true; CLAUDE.md says stores/utilities/functions/security rules need a failing test first and UI layout tests may land with the code but must cite criteria (R458) | VERIFIED | `.planning/config.json:18` `"tdd_mode": true`; `TEST_FIRST_RULE` sentence verbatim at CLAUDE.md:51 and PROJECT.md:18; CLAUDE.md warns the planner heuristic "does not exempt a store change"; CLAUDE.md:92 baseline now says the check fails on purpose between a spec's commit and its tests ("Do not quiet it with an empty test or an exclusion"). |

**Score:** 5/5 verified, 0 behavior-unverified.

Plan-level truths also checked: `docs/specs` holds only `TEMPLATE.md`; ADR-0248 exists with Status/Context/Decision/Consequences/Source comments, is indexed once in `docs/adr/README.md`, and records `fails`, `skipIf`, `runIf`, options object, empty body, describe and discretion; RED commits precede GREEN (4422f2c7 -> c998cd9c, 35cece1e -> babbc3d1, cf02d18f -> cf1553cd/77972ba6).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/__tests__/specCoverage.ts` | VERIFIED | 387 lines; exports `extractCitations`, `parseSpec`, `checkSpecCoverage`, `findTestFiles`, `runSpecCoverage`; uses `ts.createSourceFile`. Wired from the test file and exercised on the real repo. |
| `src/__tests__/specCoverage.test.ts` | VERIFIED | 167 tests, all pass; includes real-repo run and doc guards. |
| `docs/specs/TEMPLATE.md` | VERIFIED | contains `**Code:** XXX`; parses clean. |
| ADR-0248 + README row | VERIFIED | see above. |
| `CLAUDE.md` section + baseline note | VERIFIED | see truths 2, 5. |
| `.planning/PROJECT.md` standing section | VERIFIED | see truth 2. |

### Key Links

All wired: test -> `./specCoverage` import; `ts.createSourceFile` in the extractor; test reads `docs/specs/TEMPLATE.md`, `.planning/PROJECT.md`, `.planning/config.json`; `specCoverage.ts` head comment points to ADR-0248.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| R454 | 146-02 | SATISFIED | truth 1 |
| R455 | 146-02 | SATISFIED | truth 2 (wording of prohibitions pending human, below) |
| R456 | 146-01, 146-02 | SATISFIED | truth 3 |
| R457 | 146-01 (and guards in 146-02) | SATISFIED | truth 4 |
| R458 | 146-02 | SATISFIED | truth 5 |

All five IDs appear in plan frontmatter (01: R456, R457; 02: R454, R455, R456, R458) and in REQUIREMENTS.md (marked `[x]`, traceability table "Complete", all mapped to Phase 146). No orphaned requirements.

### Anti-Patterns

No TBD/FIXME/XXX debt markers in `specCoverage.ts` (the `XXX` hits are the template's sample code, not a debt marker, and live in `docs/specs/TEMPLATE.md` as the documented placeholder). No allowlist/env-flag/opt-out found by grep in the two source files. No stubs.

### Known, documented limits (not gaps)

- **Code-review WR-03:** a test placed in unreachable code (`if (false)`, `if (process.env.X)`, a function nobody calls), a spread options object (`{ ...o }`), `ctx.skip()` in a body, and aliased imports still count or cannot be seen. This is documented, not fixed: CLAUDE.md:63 (The check bullet) and ADR-0248 Consequences. A green check proves a title cites the criterion only.
- A bare `npx vitest run` does not run `src/rules.test.ts` or `render-service/**`; CLAUDE.md and ADR-0248 say rules criteria need `npm run test:rules` and render-service criteria need `cd render-service && npm test`.
- R457 on a real spec is first exercised by Phase 147 (as flagged in ROADMAP). Phase 146 proves it on fixtures plus the throwaway-spec run above.

### Human Verification Required

These are the judgment-tier prohibitions in the plans. Mechanical tests back parts of each; nobody has judged the wording. I did not mark them passed.

1. **No bypass in the check** (146-01 prohibition)
   **Test:** Read `src/__tests__/specCoverage.ts` and `specCoverage.test.ts`. **Expected:** the only things never counted are TEMPLATE.md, README.md and `node_modules`; no list, flag or env var lets a criterion pass uncited. (My grep for allowlist/env/opt-out found none, but a conditional bypass needs a human eye.)
2. **Green check is not described as proof of behavior** (146-02)
   **Test:** Read TEMPLATE.md "Tests", CLAUDE.md "The check" bullet, and ADR-0248 "Consequences". **Expected:** each says a pass proves a citation in a title, not that the test ran or asserts anything.
3. **Rollout wording** (146-02)
   **Test:** Read CLAUDE.md "Spec-driven development" and PROJECT.md "Development Philosophy". **Expected:** neither says or implies an existing spec-less feature is blocked before v2.18 or that Phase 146 itself is covered ("applies from Phase 147 on"; "A change to an existing feature without a spec goes ahead").
4. **UI exception not widened** (146-02)
   **Test:** Read the same two sections plus the `tdd_mode` bullet. **Expected:** the exception covers UI layout tests only, never stores, utilities, functions or security rules.

### Notes for the orchestrator

- ROADMAP.md line 832 still shows `- [ ] **Phase 146: Spec Standard**` although the plans block says 2/2 executed; update on phase completion.
- `146-REVIEW.md` frontmatter `status: issues_found` is stale (see above).
- Four `.planning/graphs/*` files are modified and unrelated to this phase.
- Nothing was committed. VERIFICATION.md is left uncommitted for the orchestrator.

---

_Verified: 2026-11-06_
_Verifier: Claude (gsd-verifier)_
