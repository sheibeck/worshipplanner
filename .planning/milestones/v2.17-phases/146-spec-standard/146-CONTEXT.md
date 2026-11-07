# Phase 146: Spec Standard - Context

**Gathered:** 2026-11-06
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase sets the rule that a feature starts from a written spec, and makes it enforceable. It delivers
`docs/specs/TEMPLATE.md`, the same rule in `CLAUDE.md` and `.planning/PROJECT.md`, the acceptance-criterion ID
format, `workflow.tdd_mode` on, and an automated check inside `npx vitest run` that fails when a spec's
criterion has no test citing it.

It writes no feature spec. The first real spec is Phase 147's, and the backfill for existing features is v2.18.
When this phase ends, `docs/specs/` holds only the template, so the check passes with nothing to check.

</domain>

<decisions>
## Implementation Decisions

### Spec format and IDs
- **File name:** `docs/specs/<feature-slug>.md`, one file per feature, with no number. A living spec is not a
  dated record the way an ADR is.
- **ID format:** `AC-<CODE>-NN`, for example `AC-RHD-01`. `AC-`, then a short uppercase code unique to that
  spec, then a number. The spec declares its code at the top. `AC-` appears nowhere in the repo today, so an ID
  can't be confused with `R460`, `CR-01`, `WR-01`, `T-80-02` or `SEC-S-01`.
- **Removing a criterion:** it moves to a Retired list in the same spec, and its number is never reused.
- **Link to requirements:** a criterion ends with its source in parentheses, such as `(R460)`, so a phase can
  show its requirements are traced. There is no separate traceability table.

### Test citations and the check
- **Citation:** the ID goes in the test title, following the existing `(R449)` habit:
  `it('adds it on the prior Wednesday (AC-RHD-03)')`. A failing test then names its criterion. A comment or a
  stray mention elsewhere in the file does not count, because a stale comment could keep the check passing.
- **Skipped tests:** `.skip` and `.todo` do not count as citations.
- **What fails the check:** a criterion no test cites, a duplicate ID, a malformed ID, a test citing an ID that
  is retired or doesn't exist, and a spec with no criteria. Each failure names the ID or the spec.
- **Location:** `src/__tests__/specCoverage.test.ts`, beside the other repo checks such as `brandName.test.ts`,
  so a bare `npx vitest run` runs it. The repo has no CI, so a separate command would never be run.

### Where the rule applies and rollout
- **Features with no spec yet:** only new features need a spec until v2.18. A change to an existing feature
  without a spec goes ahead, and v2.18 covers it. Once a feature has a spec, every behavior change updates it
  first.
- **Bug fixes:** the spec changes only if the fix changes what it says. A fix that makes the app match its spec
  cites the criterion in its regression test. A bug the spec doesn't cover gets a new criterion first.
- **Quick tasks:** `/gsd-quick` and `/gsd-fast` follow the same rule.
- **`tdd_mode`:** on before this phase is planned, so the check itself is built test-first.

### Decided earlier (owner, 2026-11-06; do not reopen)
- The order is spec, then tests, then code. Test-first is strict for stores, utilities, functions and security
  rules. UI layout tests may land with the code but must cite spec criteria.
- The check runs inside `npx vitest run`, so that run fails on purpose during Phase 147, between its spec commit
  and the commits that add its tests. `CLAUDE.md`'s failing-baseline note needs to say so.

### Claude's Discretion
- How the check reads test titles (a regex or the `typescript` parser). It must handle multi-line titles,
  template strings and `.each`, and must not count comments.
- Where the check's pure logic sits, and the fixtures' layout and file names.
- The spec header fields beyond the code, such as status and last-changed date.
- The wording of the rule, as long as `CLAUDE.md` and `PROJECT.md` state the same rule. In `PROJECT.md` it sits
  in a standing section (for example after Core Value), not under Current Milestone, so closing v2.17 leaves it.
- Which spec codes are allowed, such as 2 to 6 uppercase letters.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/__tests__/brandName.test.ts`, `firebaseHostingTargets.test.ts`, `legacyOriginLiterals.test.ts` and
  `cutoverRunbook.test.ts`: the repo-check pattern. They read files with `node:fs` from `process.cwd()` and run
  in the root suite.
- `brandName.test.ts` has `stripJsComments`, a comment stripper that tracks strings and template literals.
- `typescript` is already a dev dependency, if the check parses test files instead of matching text.

### Established Patterns
- Tests already cite requirements at the end of a title or describe, such as `(R449)` or `R182 ...`. 164 test
  files mention an R-number.
- Every test file is `*.test.ts` (256 files); there are no `*.spec.*` files. Skip, todo, each and only appear
  about 18 times.
- `tsconfig.vitest.json` includes `src/**/__tests__/*` (direct children only). `tsconfig.app.json`'s exclude also covers
  subdirectories, so a `.ts` file deeper down, such as `src/__tests__/fixtures/x.ts`, is type-checked by neither
  (confirmed in Phase 146 research with `tsc --listFilesOnly`), though eslint still lints it. Fixture files must not
  match `*.test.ts`, and non-`.ts` or inline fixtures avoid the linting.

### Integration Points
- Test locations the check must read: `src/**` (including `src/rules.test.ts` and `src/storage.rules.test.ts`,
  which the root run skips), `functions/src/**` and `render-service/src/**`. It reads them as text, so the root
  excludes in `vite.config.ts` don't limit it, and `functions/lib/**` must stay out.
- The real check reads `docs/specs/*.md`, ignores `TEMPLATE.md`, and must not pick up its own fixtures.
- `.planning/config.json` `workflow.tdd_mode` is true. The GSD planner marks eligible tasks `type: tdd` and the
  executor enforces the RED/GREEN gates (`gsd-core/references/tdd.md`).
- `CLAUDE.md` Testing section: "A bare `npx vitest run` should show exactly one failing file." That holds except
  during the spec-to-tests window.

</code_context>

<specifics>
## Specific Ideas

- The citation example the owner accepted is `it('adds it on the prior Wednesday (AC-RHD-03)')`.
- The template's sample IDs need to be plainly samples, and the check ignores `TEMPLATE.md`.

</specifics>

<deferred>
## Deferred Ideas

- An index of specs, like `docs/adr/README.md`'s table. A folder listing is enough until v2.18 adds many specs.
- Specs for existing features (v2.18).

</deferred>
