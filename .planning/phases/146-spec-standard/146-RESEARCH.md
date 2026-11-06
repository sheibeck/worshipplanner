# Phase 146: Spec Standard - Research

**Researched:** 2026-11-06
**Domain:** Repo-check tooling (vitest + `typescript` AST) and project documentation rules; no app code, no new packages
**Confidence:** HIGH (every load-bearing claim below was tried against this repo, not reasoned)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Spec format and IDs**
- **File name:** `docs/specs/<feature-slug>.md`, one file per feature, with no number. A living spec is not a dated record the way an ADR is.
- **ID format:** `AC-<CODE>-NN`, for example `AC-RHD-01`. `AC-`, then a short uppercase code unique to that spec, then a number. The spec declares its code at the top. `AC-` appears nowhere in the repo today, so an ID can't be confused with `R460`, `CR-01`, `WR-01`, `T-80-02` or `SEC-S-01`.
- **Removing a criterion:** it moves to a Retired list in the same spec, and its number is never reused.
- **Link to requirements:** a criterion ends with its source in parentheses, such as `(R460)`, so a phase can show its requirements are traced. There is no separate traceability table.

**Test citations and the check**
- **Citation:** the ID goes in the test title, following the existing `(R449)` habit: `it('adds it on the prior Wednesday (AC-RHD-03)')`. A failing test then names its criterion. A comment or a stray mention elsewhere in the file does not count, because a stale comment could keep the check passing.
- **Skipped tests:** `.skip` and `.todo` do not count as citations.
- **What fails the check:** a criterion no test cites, a duplicate ID, a malformed ID, a test citing an ID that is retired or doesn't exist, and a spec with no criteria. Each failure names the ID or the spec.
- **Location:** `src/__tests__/specCoverage.test.ts`, beside the other repo checks such as `brandName.test.ts`, so a bare `npx vitest run` runs it. The repo has no CI, so a separate command would never be run.

**Where the rule applies and rollout**
- **Features with no spec yet:** only new features need a spec until v2.18. A change to an existing feature without a spec goes ahead, and v2.18 covers it. Once a feature has a spec, every behavior change updates it first.
- **Bug fixes:** the spec changes only if the fix changes what it says. A fix that makes the app match its spec cites the criterion in its regression test. A bug the spec doesn't cover gets a new criterion first.
- **Quick tasks:** `/gsd-quick` and `/gsd-fast` follow the same rule.
- **`tdd_mode`:** on before this phase is planned, so the check itself is built test-first.

**Decided earlier (owner, 2026-11-06; do not reopen)**
- The order is spec, then tests, then code. Test-first is strict for stores, utilities, functions and security rules. UI layout tests may land with the code but must cite spec criteria.
- The check runs inside `npx vitest run`, so that run fails on purpose during Phase 147, between its spec commit and the commits that add its tests. `CLAUDE.md`'s failing-baseline note needs to say so.

### Claude's Discretion
- How the check reads test titles (a regex or the `typescript` parser). It must handle multi-line titles, template strings and `.each`, and must not count comments.
- Where the check's pure logic sits, and the fixtures' layout and file names.
- The spec header fields beyond the code, such as status and last-changed date.
- The wording of the rule, as long as `CLAUDE.md` and `PROJECT.md` state the same rule. In `PROJECT.md` it sits in a standing section (for example after Core Value), not under Current Milestone, so closing v2.17 leaves it.
- Which spec codes are allowed, such as 2 to 6 uppercase letters.

### Deferred Ideas (OUT OF SCOPE)
- An index of specs, like `docs/adr/README.md`'s table. A folder listing is enough until v2.18 adds many specs.
- Specs for existing features (v2.18).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R454 | `docs/specs/TEMPLATE.md` defines purpose, behavior, numbered acceptance criteria, edge cases, out of scope, links to tests and ADRs | Recommended template skeleton (Code Examples); a template-validity test keeps the parser and template in step |
| R455 | `CLAUDE.md` and `.planning/PROJECT.md` record the same rule | PROJECT.md heading analysis (Q6): a new `## Development Philosophy` section after Core Value survives milestone close; optional parity test makes "still there" mechanical |
| R456 | Stable, unique criterion IDs; tests cite them | ID grammar + spec-parsing rules (Q5); IDs are literal text in bullets (never list-position derived), code embedded in ID gives cross-spec uniqueness |
| R457 | Automated check fails on an uncited criterion, runs in `npx vitest run` | AST extractor (Q1), temp-dir fixtures (Q2), root globs (Q3), pure-function shapes (Code Examples) |
| R458 | `workflow.tdd_mode` on; test-first rule in `CLAUDE.md` | `tdd_mode` already `true` and committed (1677d309); CLAUDE.md wording + optional config assertion |
</phase_requirements>

## Summary

The check should parse test files with the `typescript` compiler API, not a regex. A regex cannot tell a real `it.skip.each(...)` from the same text in a comment or in a fixture string, and cannot honor "tests nested under a skipped describe". The AST walker is about 60 lines, was verified against 17 edge cases (multi-line titles, template literals with `${}`, string concatenation with an interleaved comment, `.each` array and tagged-template forms, `.skip.each`, `describe.skip` and `describe.skip.each` nesting, `describe.skipIf`, `xit`, `test.describe`, CRLF input), and parses all 256 test files in 1.4 to 2.7 seconds. That is 28 to 54 percent of the 5 second default `testTimeout`, so a cheap `/AC-/` text prefilter (3 ms for all files) plus an explicit 30 s timeout on the scan test is required, not optional.

Fixtures should never live in the repo as test or source files. Inline strings for the pure-function cases (the `brandName.test.ts` "detector self-test" precedent) and a `mkdtempSync` temp tree for the one file-walking test mean nothing can be collected by vitest, linted, type-checked, or read by the real scan. Correction to CONTEXT: a `.ts` file below `src/__tests__/` is NOT type-checked by the app build; `tsconfig.app.json`'s exclude of `src/**/__tests__/*` also excludes subdirectories, and `tsconfig.vitest.json`'s include is direct-children-only, so a deeper `.ts` is checked by neither (verified with `tsc --listFilesOnly`). It would still be linted by eslint, which is why non-`.ts` fixtures remain the safe choice.

`PROJECT.md` is edited by the milestone-close agent by judgment; no code in `gsd-core` rewrites it (`milestone.cjs` never references it), so a new standing `##` section outside the milestone blocks survives. Put it directly after `## Core Value`.

**Primary recommendation:** Build `src/__tests__/specCoverage.ts` (pure `extractCitations`, `parseSpec`, `checkSpecCoverage`, `findTestFiles`) test-first, with `src/__tests__/specCoverage.test.ts` holding inline-string fixtures, one temp-dir integration test, and one real-repo run; prefilter on `AC-`; give the real-repo test a 30 s timeout; keep every `AC-` literal out of that test file's own `it()` titles.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spec format, template, rule text | Docs (`docs/specs/`, `CLAUDE.md`, `PROJECT.md`) | — | Pure documentation; no runtime |
| Citation extraction + spec parsing | Dev tooling (pure TS in `src/__tests__/`) | — | Runs only inside vitest under node; never imported by the app |
| Enforcement | Test runner (root `npx vitest run`) | — | No CI exists, so the root run is the only gate |
| `tdd_mode` | GSD config (`.planning/config.json`) | — | Already `true`; consumed by planner/executor |

No browser, API, or database tier is touched. Nothing here ships in the Vite bundle or the Cloud Function.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `~5.9.3` (installed 5.9.3) | `ts.createSourceFile` to read test-call titles | Already a devDependency; zero install. `[VERIFIED: package.json, node -e require('typescript').version]` |
| `vitest` | 4.0.18 (root) | Host for the check | Existing runner `[VERIFIED: node_modules/vitest/package.json]` |
| `node:fs`, `node:path`, `node:os` | Node built-ins | Read specs/tests; temp dir for fixtures | Same as `brandName.test.ts` |

### Supporting
None. No markdown parser is needed: the spec rules are line-based (see Q5), and adding `remark`/`marked` would be a dependency for ~40 lines of regex.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `typescript` AST | Regex + the `stripJsComments` helper in `brandName.test.ts` | Regex cannot model skip chains, nesting, or "title only" (a fixture string `"it('x (AC-FIX-01)')"` in the check's own test file would be a false citation). Rejected. |
| Helper module in `__tests__` | All logic in the `.test.ts` file | `brandName.test.ts` keeps helpers inline. Either works; a separate non-test `src/__tests__/specCoverage.ts` is type-checked only by `tsconfig.vitest.json` (node types), ignored by vitest collection, and excluded from the brand scan by `isTestPath`. Recommended for readability, planner may inline instead. |

**Installation:** none.

**Version verification:** `typescript` 5.9.3 present and loads under vitest's jsdom environment (an `import ts from 'typescript'` file passed `npx vue-tsc --build` and ran). No package is added, so no registry check is needed.

## Package Legitimacy Audit

No external packages are installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `typescript` (already installed devDependency, not new) | npm | n/a | n/a | n/a | n/a | Not newly installed; no action |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 docs/specs/*.md (not TEMPLATE.md/README.md) ──► parseSpec() ──► per-spec {code, criteria[], retired[], errors[]}
                                                                        │
 src/**, functions/src/**, render-service/src/**                        ▼
   *.test.ts|*.spec.* (skip node_modules, lib, dist)          checkSpecCoverage(specs, citations)
        │                                                               ▲
        ▼  text contains "AC-"? (prefilter, skips ~all files today)     │
   extractCitations(text) ── TS AST: it/test/describe titles only ──────┘
        │   (comments, strings, .skip/.todo/.fails/skipIf/runIf/x*, nested-under-skip all dropped)
        ▼
   string[] of error lines ──► expect(errors).toEqual([])   (names the ID or spec file)
```

### Recommended Project Structure
```
docs/specs/TEMPLATE.md              # the only file in docs/specs when the phase ends
src/__tests__/specCoverage.ts       # pure logic (no vitest import); NOT collected, NOT *.test.ts
src/__tests__/specCoverage.test.ts  # inline-string fixtures + temp-dir test + real-repo run
CLAUDE.md                           # new "Spec-driven development" section + baseline note edit
.planning/PROJECT.md                # new standing "## Development Philosophy" after Core Value
```

### Pattern 1: Title-only citation extraction (Q1)
**What:** Walk the AST; for each `CallExpression` whose callee resolves (through `.each(...)` calls, tagged templates, property chains) to `it`/`test`/`describe`/`suite`, read ONLY string-literal/template pieces of its first argument. Case calls return 1 if active; suite calls recurse into their callback with an inherited `skipped` flag and contribute their own title IDs only if at least one active case lives beneath them.
**When to use:** always; this is the single extraction path.
**Example:** see Code Examples (`extractCitations`).

### Pattern 2: Fixtures as strings and a temp tree (Q2)
**What:** Pure functions take strings (`parseSpec(text, name)`, `extractCitations(text)`, `checkSpecCoverage(specs, citations)`). One integration test builds a throwaway repo layout under `mkdtempSync(join(tmpdir(), 'spec-'))` and calls `findTestFiles(root)` / the orchestrating `runSpecCoverage(root)`. The real test calls the same with `process.cwd()`.
**Why:** the fixtures exercise the same functions the real run uses, and the real run structurally cannot see them.

### Anti-Patterns to Avoid
- **Putting an `AC-` token in this file's own `it()` / `describe()` titles.** The real scan reads `specCoverage.test.ts` too, so `it('flags AC-FIX-02 ...')` becomes a citation of an unknown ID and the real run fails. Cite `R457` in titles; keep fixture IDs inside string constants (the AST ignores strings that are not test-call titles).
- **`it.each` rows built from strings containing IDs** (`it.each(['AC-FIX-01'])`): not a title, correctly ignored, but do not rely on it for citations.
- **Example `it(...)` text inside comments in files under `src/**/__tests__/`:** `vitest/no-commented-out-tests` (eslint) flags it (hit in my probe). Describe the shape in prose, not code, in comments.
- **Deriving IDs from list position** (`1.` numbered lists): markdown renumbers; use `-` bullets with a literal bold ID.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding titles and skip state in test files | A regex or comment stripper | `ts.createSourceFile` + `forEachChild` | Skip chains, nesting, multi-line and template titles are syntax; comments/strings come out for free |
| Markdown parsing | A markdown AST dependency | ~40 lines of line-based rules (below) | The only constructs that matter are `##` headings, top-level list items, fences, HTML comments |
| Directory walking | A glob dependency | `readdirSync(dir, { recursive: true })` as `brandName.test.ts` does | Node ≥ 20 (running 24.22.2); normalize `\` to `/` |

**Key insight:** the check proves a citation exists in a title that is not statically skipped. It cannot prove the test ran (emulator suites skip themselves at runtime when no emulator is up: `storage.rules.test.ts` reported "43 skipped" in the baseline run) or that it asserts anything. Say so in the template and in `CLAUDE.md`; for rules criteria the proof of execution remains `npm run test:rules`.

## Runtime State Inventory

Not a rename/refactor/migration phase. Omitted.

## Findings by Question

### Q1 - Regex vs parser: use the parser, with a prefilter
Measured (vitest 4.0.18, jsdom, all 256 `*.test.ts` files, `setParentNodes=false`):

| Run | Read all | Parse all | Notes |
|-----|----------|-----------|-------|
| Isolated | 44-52 ms | 1.4-2.1 s | cold JIT; `import typescript` itself is ~0.7 s of collection time, not test time |
| Inside the full suite (6160 tests, 308 s, 8+ workers busy) | 52 ms | 2.7 s | the realistic worst case |
| Regex `/\bAC-[A-Z0-9]+-\d+\b/` over all text | n/a | 3 ms | used as the prefilter |

Default `testTimeout` is 5 s (no override in `vite.config.ts`), so unfiltered parsing would use over half the budget under load. Therefore: (1) skip any file whose text lacks `AC-`; today that is every file but the check's own, so the real run parses ~1 file; (2) pass an explicit `, 30000)` to the scan tests (repo precedent: `ServiceEditorView.*.test.ts` end tests with `}, 30000)`). Vitest accepts a trailing numeric timeout `[CITED: vitest.dev/api/test.html: test(name, body?, timeout?)]`.

Behaviors verified (all `ok`): plain; `${}` template; `'a ' + // AC-X\n 'b (AC-X-05)'` counts only the string pieces; `.each([..])(\n'title')`; `` it.each`..`('title') ``; `it.skip.each`; `it.todo`; `it.fails`; `describe.skip` and `describe.skip.each` with nested `it`; `describe.skipIf(true)` nesting; `xit`; `test.describe(...)` alias; a `describe` whose only child is `it.skip` contributes nothing; ID in a comment or in a plain string containing `it('...')` text contributes nothing; CRLF source.

Decisions the planner should lock:
- **Not counted (static):** `skip`, `todo`, `fails`, `skipIf(...)`, `runIf(...)`, `xit/xtest/xdescribe`, and everything beneath a not-counted `describe`. `skipIf`/`runIf` are conditional so they cannot prove coverage; `fails` marks a known-broken test. `[ASSUMED]` that owner agrees on `fails/skipIf/runIf` (CONTEXT locks only skip/todo); no such call exists in the repo today (grep: zero `.skip`/`.todo`/`.fails`/`skipIf`; 18 `.each`).
- **Counted:** `only`, `concurrent`, `sequential`, `for`, `each`, plain.
- **Describe-title IDs** count only if the describe holds at least one active case (prevents an empty or all-skipped describe from satisfying a criterion).
- **Undetectable by design:** `ctx.skip()` inside a body, a title held in a variable (`it(TITLE, ...)`), aliased imports (`import { it as spec }`). Document, do not chase. Vitest documents `test.skip/only/todo/fails/skipIf/runIf/each/for/concurrent` and `test.describe`/`test.suite` aliases `[CITED: vitest.dev/api/test.html]`; the page does not document `skip.each` chaining or `xit`, but the resolver accepts any chain, so it is harmless.
- **Citation token regex:** broad on purpose, `/\bAC-[A-Z0-9]+-\d+\b/g`, so a mistyped citation (`AC-RH-03`) is reported as "not defined in any spec" instead of silently ignored. Definition-side strictness lives in `parseSpec`.

### Q2 - Fixtures: nothing in the repo that any tool can see
Inspected configs:
- **vitest collection:** `vite.config.ts` has no `include`, so vitest's default (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) applies; only `*.test.ts` is collected. Excludes: `src/rules.test.ts`, `**/node_modules/**`, `functions/lib/**`, `render-service/**`.
- **tsc (`npm run type-check` = `vue-tsc --build`):** verified with `tsc -p ... --listFilesOnly`. `src/__tests__/zzfix/probe.ts` appeared in neither `tsconfig.app.json` (exclude `src/**/__tests__/*` also swallows subdirectories) nor `tsconfig.vitest.json` (include matches direct children only). A direct-child non-test `.ts` (`src/foo/__tests__/direct.ts`) is checked by `tsconfig.vitest.json` only. **This corrects the CONTEXT note that deeper `.ts` lands in the app build.**
- **eslint:** `files: ['**/*.{vue,ts,mts,tsx}']` lints any `.ts` anywhere; the vitest plugin rules apply to `src/**/__tests__/*` direct children only (observed: `vitest/expect-expect` and `vitest/no-commented-out-tests` fired on my probe). `eslint.config.ts` calls `buildFromOxlintConfigFile('.oxlintrc.json')` and **that file does not exist in the repo**; eslint prints "could not find oxlint config file" and continues. Not this phase's problem; do not "fix" it here.
- **Precedent:** `functions/src/__fixtures__/` exists, and `brandName.test.ts`'s `isTestPath` already treats `__tests__|__fixtures__|__mocks__` as non-source.

**Recommendation:** inline template-literal constants for all spec and test-source fixtures, plus a `mkdtempSync` tree for the walker test (create `src/`, `functions/src/`, `render-service/src/`, `src/rules.test.ts`, `functions/lib/x.test.js`, `functions/node_modules/p/x.test.ts`, `docs/specs/TEMPLATE.md`, a fixture spec; `rmSync` in `afterAll`). Zero files in the repo, so the "real check must not read them" requirement holds by construction and needs only one assertion: the real run on this repo (only `TEMPLATE.md` present) returns `[]`. If the planner wants visible fixture files anyway, use non-`.ts` extensions (`.md` for specs, `.txt` for test sources) in a directory the walker never enters (not under `src/`, `functions/src/`, `render-service/src/`, and not directly in `docs/specs/`, which is scanned non-recursively for `*.md`).

### Q3 - Which files the check reads
- Test files in the repo: **256**, all `*.test.ts`: `src/` 233, `functions/src/` 20, `render-service/src/` 3; zero `*.spec.*`, zero `.tsx`/`.js` tests (`git ls-files`). Nothing exists outside those three roots.
- **Roots:** `src`, `functions/src`, `render-service/src`, resolved against a `root` argument (default `process.cwd()`; `npx vitest run` from the repo root is the only way this test runs, same as `brandName.test.ts`).
- **Match:** `/\.(test|spec)\.[cm]?[jt]sx?$/` (future-proof; today only `.test.ts` hits). This includes `src/rules.test.ts` and `src/storage.rules.test.ts` (root vitest excludes the former, but the check reads text).
- **Exclude:** any path segment `node_modules`, `lib`, `dist`; `functions/lib` is outside `functions/src` anyway, so the three-root design excludes it without a rule. Keep the segment filter as a cheap safety net. Windows: `readdirSync(..., {recursive:true})` returns backslashes, normalize with `.replace(/\\/g, '/')`.
- **Not read, and why it is fine:** `.gsd-worktrees/` and `.claude/worktrees` (gitignored copies of the tree at repo root, outside the three roots); `legacy-site/`; `functions/*.mjs` seed scripts (no tests). Do not use `git ls-files`: new test files are untracked during the very RED window the check exists for.
- A test file that itself fails to parse is tolerated by `createSourceFile`; no throw path.

### Q4 - Anything else that sees `docs/specs/` or line endings
- **Firebase hosting:** targets publish `dist` and `legacy-site` only; `docs/` is never deployed. `firebase.json` `ignore` is irrelevant.
- **Vite/vitest watch:** `docs/*.md` is not in any module graph, so editing a spec does not re-trigger `specCoverage.test.ts` in `npm run test:unit` (watch). Acceptable; note it.
- **Other scans of `docs/`:** `cutoverRunbook.test.ts` reads one runbook by path; `brandName.test.ts` walks only `src` and `functions/src`; nothing globs `docs/`. A spec mentioning "WorshipPlanner" is not scanned.
- **`.gitattributes`:** none exists. `core.autocrlf=true`. `git ls-files --eol` shows index LF everywhere, working tree: CLAUDE.md and PROJECT.md CRLF, 110 of 233 `src` test files CRLF, `docs/adr/*` mostly LF. A spec written by the Write tool will be LF; one touched by an autocrlf editor will be CRLF. **Rule:** split with `/\r?\n/` before any `^...$` matching (JS `$` does not match before `\r`); the AST path is line-ending agnostic (verified with CRLF input). Do not add a `.gitattributes` in this phase.
- **Graphify** auto-update will index new `docs/specs/*.md`; harmless.

### Q5 - Spec-parsing rules (all verified in a node script, LF and CRLF)
1. **Pre-clean, in order:** blank out `<!-- ... -->` (keep newlines), split on `/\r?\n/`, then skip fenced regions (``` or `~~~`, up to 3 leading spaces; closing fence must use the same character).
2. **Declared code:** exactly one line `**Code:** XXX` that appears before the first `##` heading. Missing, malformed (not `[A-Z]{2,6}`), or after a heading is an error. (Prose cannot be mistaken for it.)
3. **Sections** are `##` headings matched case-insensitively: `Acceptance criteria`, `Retired criteria`; anything else is "other" and ignored entirely (so IDs in Purpose/Behavior/Tests/ADRs prose never define or retire anything).
4. **A criterion is defined only by a top-level list item** (no leading indent; `-`, `*`, `+`, or `1.`) inside `## Acceptance criteria` that starts with the ID, optionally bold: `- **AC-RHD-03** - text (R460)`. Indented sub-bullets and continuation lines are ignored. A top-level item in that section that does not start with `AC-` is an error ("item has no AC id"), which catches a forgotten ID.
5. **ID token** = `^(?:\*\*)?(AC-[A-Za-z0-9-]*)` then strict check `^AC-([A-Z]{2,6})-(\d{2,3})$`. The captured code must equal the declared code (otherwise "does not use the declared code").
6. **Retired list** is parsed the same way from `## Retired criteria`; an ID both active and retired is an error (number reuse within the file). Retired IDs are removed from the "must be cited" set; a test citing one fails with "is retired".
7. **No criteria / no heading** is an error naming the spec. **Duplicate** within a spec and **duplicate across specs** (same ID, or two specs declaring the same code) are errors. Because the code is part of the ID, cross-spec uniqueness reduces to code uniqueness.
8. **Stability (R456):** IDs are literal text; gaps are legal (no contiguity check); renumbering only happens if someone edits the literal.
9. **Which files:** `docs/specs/*.md` non-recursive, excluding `TEMPLATE.md` (and, recommended, `README.md` so a later index doesn't register as a criterion-less spec). A missing `docs/specs/` returns no specs (not a throw).
10. **Template guard (recommended):** one test asserts `parseSpec(readFileSync('docs/specs/TEMPLATE.md'))` yields no errors, code `XXX`, at least two criteria, and every required `##` section heading is present (R454). This is the only thing that stops the template and parser drifting apart, since the real scan ignores the template.

### Q6 - `PROJECT.md` and milestone close
- `gsd-core` has **no code that rewrites PROJECT.md sections**. `bin/lib/milestone.cjs` does not reference it. `workflows/complete-milestone.md` step `evolve_project_full_review` has the agent edit it inline by judgment: What This Is, Core Value, Business Context (only if present), Requirements (Validated/Active/Out of Scope), Context, Key Decisions, Constraints, and the "Last updated" footer. `workflows/new-milestone.md` step 4 adds/updates `## Current Milestone: v[X.Y] [Name]` and ensures `## Evolution` exists. `/gsd-health` (`verify.cjs` W001) only warns if `## What This Is`, `## Core Value`, or `## Requirements` are missing.
- **Observed convention in this file:** at close the agent renames `## Current Milestone: ...` to `## Shipped Milestone: ... - SHIPPED ...` (v2.7 to v2.16 all follow it), and rewrites `## Current State`. The existing "Development philosophy (owner directive, 2026-11-06)" paragraph currently sits inside `## Current Milestone`, so it will be archived with the milestone. That paragraph is the thing at risk, hence the standing section.
- **Safe heading:** a new top-level `## Development Philosophy` placed immediately after `## Core Value` (line ~11) and before `## Current State`. Unsafe/at risk: anything under `## Current State`, `## Current Milestone`, `## Shipped/Previous Milestone`, `## Context` (stack/LOC rewrite), `## Key Decisions` (rows appended, table reflowed), and `## Evolution` (template text).
- **Make it mechanical (recommended, cheap):** the same test file asserts `CLAUDE.md` and `.planning/PROJECT.md` each contain one canonical rule sentence verbatim (for example `No feature work starts until its spec exists`), and that `.planning/config.json` has `workflow.tdd_mode === true`. If a future close drops the section, the next `npx vitest run` fails and names the file. Keep the sentence short and free of markdown so the substring match is stable across CRLF/LF.
- The Current Milestone block should be edited to point at the standing section rather than restate it (so the close has nothing to preserve there).

## Common Pitfalls

### Pitfall 1: The check's own test file cites unknown IDs
**What goes wrong:** the real scan reads `src/__tests__/specCoverage.test.ts`; a title like `it('rejects AC-FIX-02 ...')` is parsed as a citation of an undefined ID.
**Why:** titles are exactly what the extractor counts.
**How to avoid:** titles cite `R457`; fixture IDs live only in string constants. Add one self-test: `extractCitations` over the repo's own check file returns `[]`.
**Warning signs:** real run fails with "cites AC-FIX-.., which is not defined in any spec".

### Pitfall 2: Timeout under a loaded suite
**What goes wrong:** unfiltered AST parse of 256 files is 2.7 s inside the full run versus the 5 s default.
**How to avoid:** prefilter on `AC-`; `, 30000)` on the real-repo and walker tests.

### Pitfall 3: `noUncheckedIndexedAccess` breaks verbatim JS
**What goes wrong:** the verified snippets are JS-equivalent; under `tsconfig.app.json` (inherited by `tsconfig.vitest.json`) `f[1][0]` and `m[1]` are `string | undefined`.
**How to avoid:** destructure with defaults or `?.`; gate on `npm run type-check` (it checks test files; `-p tsconfig.app.json` does not, per CLAUDE.md). A probe that imported `ts from 'typescript'` type-checked clean, so no `esModuleInterop` change is needed.

### Pitfall 4: eslint on `src/**/__tests__/*`
`vitest/expect-expect` requires an `expect` in every `it`; `vitest/no-commented-out-tests` flags code-looking test calls in comments. Keep comments prose.

### Pitfall 5: CRLF in CLAUDE.md / PROJECT.md when editing
Both are CRLF in the working tree. `[ASSUMED]` the Edit tool tolerates this; prefer single-line anchors, or verify with `git diff --stat` that the edit did not rewrite every line (would show as whole-file churn).

### Pitfall 6: The intentional failing window leaks into other gates
During Phase 147 between its spec commit and test commits, root `npx vitest run` is red by design. Phase 147's plans and the executor's per-wave verification must expect it. Phase 146 only documents it: update the CLAUDE.md baseline sentence to read that a bare run shows exactly one failing file (`src/storage.rules.test.ts`), plus `src/__tests__/specCoverage.test.ts` while a committed spec has criteria no test cites yet.

### Pitfall 7: Static proof only
Rules criteria are cited from `src/rules.test.ts`/`src/storage.rules.test.ts`, which the default run does not execute (and `storage.rules` allow cases fail locally for a documented environment reason). A passing check there means "a test exists". State it in the template's Tests section.

## Code Examples

Verified (JS equivalents passed 17 extraction cases and 4 pipeline cases; the planner's TDD pass must re-verify under `npm run type-check`).

### Pure function shapes (`src/__tests__/specCoverage.ts`)
```ts
export interface ParsedSpec { code: string | null; criteria: string[]; retired: string[]; errors: string[] }
export interface Citations { file: string; ids: string[] }

/** IDs cited in titles of ACTIVE tests in `source`. Empty array if none. Comments/strings never count. */
export function extractCitations(source: string, fileName?: string): string[]

/** Line-based spec parse; never throws; all problems land in `errors`, each naming `name`. */
export function parseSpec(markdown: string, name: string): ParsedSpec

/** Cross-spec + citation rules. Returns human-readable error lines; [] means pass. */
export function checkSpecCoverage(
  specs: { name: string; text: string }[],
  citations: Citations[],
): string[]

/** Repo-relative POSIX paths of test files under src, functions/src, render-service/src. */
export function findTestFiles(root: string): string[]

/** Orchestrator used by the real run and the temp-dir test. */
export function runSpecCoverage(root: string): string[]
```
`runSpecCoverage` = read `docs/specs/*.md` (minus `TEMPLATE.md`, `README.md`), `findTestFiles`, read each, skip files without `/AC-[A-Z0-9]+-\d/`, `extractCitations`, `checkSpecCoverage`.

### `extractCitations` core (JS-verified)
```ts
import ts from 'typescript'

const ID_ANY = /\bAC-[A-Z0-9]+-\d+\b/g
const NOT_RUN = new Set(['skip', 'todo', 'skipIf', 'runIf', 'fails'])

function callee(expr: ts.Expression): { base: string; mods: string[] } | null {
  const mods: string[] = []
  let e: ts.Expression = expr
  for (;;) {
    if (ts.isParenthesizedExpression(e)) e = e.expression
    else if (ts.isCallExpression(e)) e = e.expression        // it.each([...])(...) and skipIf(c)(...)
    else if (ts.isTaggedTemplateExpression(e)) e = e.tag       // it.each`...`(...)
    else if (ts.isPropertyAccessExpression(e)) { mods.unshift(e.name.text); e = e.expression }
    else if (ts.isIdentifier(e)) return { base: e.text, mods }
    else return null
  }
}

function titleText(arg: ts.Expression): string {          // string pieces only: comments are trivia, never visited
  let out = ''
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)
      || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out += n.text + ' '
    else ts.forEachChild(n, visit)
  }
  visit(arg)
  return out
}

export function extractCitations(source: string, fileName = 'x.test.ts'): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, false)
  const ids: string[] = []
  // Returns the number of ACTIVE cases under `node`; a suite's title ids count only if > 0.
  const walk = (node: ts.Node, skipped: boolean): number => {
    if (ts.isCallExpression(node)) {
      const c = callee(node.expression)
      const t = node.arguments[0]
      const titled = t !== undefined && (ts.isStringLiteralLike(t) || ts.isTemplateExpression(t) || ts.isBinaryExpression(t))
      if (c && titled) {
        const x = /^x(it|test|describe)$/.exec(c.base)
        const base = x ? x[1] : c.base
        const isSuite = base === 'describe' || base === 'suite' || c.mods.includes('describe') || c.mods.includes('suite')
        const isCase = !isSuite && (base === 'it' || base === 'test')
        if (isSuite || isCase) {
          const off = skipped || !!x || c.mods.some((m) => NOT_RUN.has(m))
          const found = [...titleText(t).matchAll(ID_ANY)].map((m) => m[0])
          if (isCase) { if (!off) ids.push(...found); return off ? 0 : 1 }
          let active = 0
          for (const a of node.arguments.slice(1)) active += walk(a, off)
          if (!off && active > 0) ids.push(...found)
          return active
        }
      }
    }
    let n = 0
    ts.forEachChild(node, (ch) => { n += walk(ch, skipped) })
    return n
  }
  walk(sf, false)
  return ids
}
```
(The inner `it.each([...])` call has an array as first arg so `titled` is false and it is traversed as an ordinary node; the outer call carries the title.)

### `checkSpecCoverage` rules (JS-verified)
Error strings, each naming the subject: `"<spec>: no acceptance criteria"`, `"<spec>: duplicate AC-X-NN"`, `"<spec>: malformed id ..."`, `"<spec>: AC-X-NN does not use the declared code CODE"`, `"<spec>: AC-X-NN is both active and retired"`, `"<specB>: code C is already used by <specA>"`, `"AC-X-NN is defined in both <a> and <b>"`, `"<file>: cites AC-X-NN, which is retired | not defined in any spec"`, `"AC-X-NN (<spec>) has no test citing it"`. Output for one uncited criterion in the fixture: `['AC-FIX-02 (a.md) has no test citing it']`; all cited: `[]`; empty `specs`: `[]` (the "docs/specs holds only the template" state).

### Template skeleton for `docs/specs/TEMPLATE.md` (R454, R456)
```markdown
# Spec: <Feature name>

**Code:** XXX
**Status:** Draft | Active
**Last changed:** YYYY-MM-DD

> Sample IDs below (AC-XXX-NN) are placeholders. The check ignores this file.

## Purpose
## Behavior
## Acceptance criteria
- **AC-XXX-01** - One testable statement. (R000)
- **AC-XXX-02** - Another. (R000)
<!-- IDs are literal text. Never renumber; gaps are fine. Use "-" bullets, not "1." lists. -->
## Edge cases
## Out of scope
## Retired criteria
- **AC-XXX-00** - Moved here instead of being deleted. Its number is never reused.
## Tests
How a test cites a criterion (the ID goes in the title; comments do not count):
    it('does the thing (AC-XXX-01)', () => { ... })
## ADRs
```
The sample `it(...)` line must be indented prose or fenced, never a list item, so `parseSpec` ignores it (it is in an "other" section anyway).

### CLAUDE.md / PROJECT.md rule (one canonical sentence, quoted verbatim in both)
Suggested: `No feature work starts until its spec exists in docs/specs/, and a behavior change updates the spec before the tests and the code.` followed by: order is spec, tests, code; stores/utilities/functions/security rules need a failing test first; UI layout tests may land with the code but cite spec criteria; citation form `(AC-XXX-NN)` in the test title; `/gsd-quick` and `/gsd-fast` follow it; bug fixes cite the criterion; only new features need a spec until v2.18.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Requirement R-numbers cited in titles ad hoc (164 files) | Per-feature `AC-` IDs checked mechanically | This phase | Citation becomes enforced rather than habitual |
| `workflow.tdd_mode` false (REQUIREMENTS.md "known facts") | `true` | commit 1677d309 | Already done; R458's config half needs only verification |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Owner accepts `fails`, `skipIf`, `runIf` as non-counting (CONTEXT locks only `.skip`/`.todo`) | Q1 | Low: none are used in the repo today; flip one constant |
| A2 | The Edit tool preserves CRLF when editing CLAUDE.md / PROJECT.md | Pitfall 5 | Whole-file diff churn; verify with `git diff --stat` |
| A3 | Excluding `README.md` from the spec scan is wanted | Q5 | Low; a later index would otherwise register as a criterion-less spec |
| A4 | Describe-title citations should require an active child | Q1 | Low; CONTEXT silent; stricter is safer |

## Open Questions

1. **Should a `describe`-level citation satisfy a criterion at all, or only `it`/`test`?**
   - Known: CONTEXT says citation goes "in the test title"; the task prompt listed `describe` titles as counted (existing habit: `describe('... (R448)')`).
   - Recommendation: count describe titles, but only with an active child (implemented above).
2. **Visible fixture files vs inline strings.** Recommendation above is inline + temp dir; the planner may prefer committed `.md`/`.txt` fixtures for readability. Both satisfy R457.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | vitest, `readdirSync recursive` | yes | 24.22.2 (`.node-version` says 22; both support recursive readdir) | none needed |
| vitest | check host | yes | 4.0.18 | — |
| typescript | AST parsing | yes | 5.9.3 | — |
| Firestore/Storage emulator | not needed (check reads files only) | n/a | — | — |

Missing dependencies: none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18, jsdom env (the check does not use the DOM) |
| Config file | `vite.config.ts` (`test` block; default 5 s `testTimeout`, no `include`) |
| Quick run command | `npx vitest run src/__tests__/specCoverage.test.ts` |
| Full suite command | `npx vitest run` (about 5 minutes; expected baseline: exactly `src/storage.rules.test.ts` failing, 252 files passing) |
| Type gate | `npm run type-check` (`vue-tsc --build`, about 65 s; checks test files) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R454 | Template parses clean, code `XXX`, has all required `##` sections | unit (reads template) | `npx vitest run src/__tests__/specCoverage.test.ts -t R454` | Wave 0 |
| R455 | CLAUDE.md and PROJECT.md both contain the canonical rule sentence; PROJECT.md heading is outside milestone blocks | repo-check | same file, `-t R455` | Wave 0 |
| R456 | `parseSpec`: literal IDs, strict format, code mismatch, duplicate, cross-spec duplicate, retired reuse | unit (inline strings) | same file, `-t R456` | Wave 0 |
| R457 | uncited fixture fails and names ID; fully cited passes; ignores template; finds citations in all four locations; ignores `functions/lib`, `node_modules`; skip/todo/nested-skip/comment/string not counted; real repo returns `[]` | unit + temp-dir integration + real run | same file, `-t R457` | Wave 0 |
| R458 | `.planning/config.json` `workflow.tdd_mode === true`; CLAUDE.md states the test-first split | repo-check | same file, `-t R458` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/specCoverage.test.ts`
- **Per wave merge:** that file plus `npm run type-check`
- **Phase gate:** bare `npx vitest run` shows only the `storage.rules` baseline failure, and `npm run type-check` clean, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/specCoverage.ts`: pure logic (RED tests first, then GREEN)
- [ ] `src/__tests__/specCoverage.test.ts`: all five requirement groups above, titles citing `R454`..`R458` only (no `AC-` tokens in titles)
- [ ] `docs/specs/TEMPLATE.md`
- [ ] No framework install needed

Suggested plan split (tdd_mode on): (1) TDD plan for the pure logic, RED commit then GREEN (R456, R457); (2) docs plan: TEMPLATE.md, CLAUDE.md section + baseline note, PROJECT.md section (R454, R455, R458); (3) guard tests that bind the docs to the code (template-validity, rule-parity, `tdd_mode`), which depend on both. Existing infrastructure covers everything else.

## Security Domain

`security_enforcement` is not set to false, so included, briefly: this phase adds no network, auth, storage, or user-input surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | marginal | Check reads only fixed repo roots; spec/test text is parsed, never executed. Regexes are linear (no nested quantifiers). |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via spec/test paths | Tampering | Roots are hard-coded; `resolve(root, ...)` only; no user-supplied path |
| ReDoS on large test files | DoS | Prefilter; simple anchored regexes; AST not regex for structure |
| Temp-dir leakage | Info disclosure | `mkdtempSync` under `os.tmpdir()`, `rmSync` in `afterAll` |

## Sources

### Primary (HIGH confidence, executed against this repo)
- Repo inspection: `vite.config.ts`, `tsconfig.app.json`, `tsconfig.vitest.json`, `eslint.config.ts`, `firebase.json`, `.gitignore`, `package.json`, `functions/vitest.config.ts`, `render-service/vitest.config.ts`, `vitest.rules.config.ts`, `src/__tests__/brandName.test.ts`
- Probes run and then deleted: AST extractor timing (256 files), 17 extraction cases, `tsc --listFilesOnly` for fixture placement, `eslint` on a probe, `vue-tsc --build` with `import ts from 'typescript'`, full `npx vitest run` baseline (253 files, 1 failed = storage.rules, 6160 passed, 43 skipped, 308 s)
- `git ls-files`, `git ls-files --eol` for test-file inventory and line endings
- `$HOME/.claude/gsd-core/workflows/complete-milestone.md`, `new-milestone.md`, `bin/lib/milestone.cjs`, `bin/lib/verify.cjs` for PROJECT.md handling

### Secondary (MEDIUM confidence)
- https://vitest.dev/api/test.html (modifiers, `test(name, body?, timeout?)`, `test.describe` alias; `skip.each` chaining and `xit` not documented there)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (nothing new; tool versions verified)
- Architecture: HIGH (every mechanism exercised in this repo)
- Pitfalls: HIGH (Pitfalls 1-4 and 6 observed directly; 5 is `[ASSUMED]`)

**Not used:** the `research-plan` / `research-store` cache seam and graphify queries; all questions were answered by running things against the repo, and the one external fact (vitest API surface) was a single fetch.

**Research date:** 2026-11-06
**Valid until:** 2026-12-06 (stable; re-check if vitest or `typescript` majors change)
