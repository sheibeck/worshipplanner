# 0248. Feature specs are the source of truth; tests cite criteria in their titles

## Status

Accepted

## Context

On 2026-11-06 the owner directed that Specification Driven Development is the core philosophy, followed by Test Driven Design: the order is spec, then tests, then code. Phase 146 (R454-R458) builds the standard; Phase 147 is the first feature to follow it, and v2.18 backfills specs for existing features.

The repo has no CI, so a check that lives outside `npx vitest run` would never be run. Whatever enforces the standard has to be an ordinary test in the root suite.

## Decision

- **(a) One living spec per feature** at `docs/specs/<feature-slug>.md`, unnumbered, because a living spec is not a dated record the way an ADR is.
- **(b) IDs are literal `AC-<CODE>-NN` text**, with the code declared in the spec's `**Code:**` line, so an ID survives adding, removing or reordering criteria. A removed criterion moves to a Retired list and its number is never reused.
- **(c) A citation is the ID in the title of a test that can run.** A failing test then names its criterion, and a stale comment cannot keep the check passing.
- **(d) Titles are read with the `typescript` parser**, because a regex cannot tell a skipped test from the same text in a comment or a string.
- **(e) Rules beyond `.skip` and `.todo` (Claude's discretion).** The owner locked `.skip` and `.todo` as not counting. The rules below extend that decision, and they are Claude's discretion serving its intent, not the owner's own words: a citation must mean a test that can really run. `fails` passes only while its body fails, so it proves the opposite of a working test. `skipIf` and `runIf` may never run the test. An options object such as `{ skip: true }` is a skip in another spelling. A test with no body function is a todo to the runner. An empty body proves nothing, and the roadmap also says nothing may quiet the check with an empty test.
- **(f) A `describe` title counts only with a counted test under it** (also Claude's discretion, for the same reason): a suite with no counted test runs nothing, so its title cites nothing.
- **(g) `TEMPLATE.md` and `README.md` are left out of the scan.** The template holds sample IDs, and `README.md` is excluded so that a later index cannot register as a spec with no criteria.
- **(h) The check lives in the root run.** A bare `npx vitest run` therefore goes red on purpose between a spec's commit and the commits that add its tests.

## Consequences

- A pass proves that a test title cites each criterion, not that the test ran or asserts anything. A human still judges whether the test checks the criterion.
- `ctx.skip()` inside a body, variable titles and aliased imports cannot be seen. A variable title fails safe, because it cites nothing.
- Criteria for security rules are cited from `src/rules.test.ts` or `src/storage.rules.test.ts`, which a bare `npx vitest run` does not prove, so they also need `npm run test:rules`.
- Editing a spec does not re-run the check in watch mode; the test file only re-runs when a test or source file changes.
- No `AC-` token may appear in a title inside `specCoverage.test.ts`, because the scan reads that file too and would see an undefined ID.
- Reversing (h) removes the only enforcement; the standard would then rest on review alone.

## Source comments

- `src/__tests__/specCoverage.ts`
- `src/__tests__/specCoverage.test.ts`
