---
phase: 146-spec-standard
reviewed: 2026-11-06T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - CLAUDE.md
  - docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md
  - docs/adr/README.md
  - docs/specs/TEMPLATE.md
  - src/__tests__/specCoverage.test.ts
  - src/__tests__/specCoverage.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 146: Code Review Report

**Reviewed:** 2026-11-06
**Depth:** standard (plus concrete probe inputs run against the real `specCoverage.ts`)
**Files Reviewed:** 6
**Status:** issues_found

## Summary

`specCoverage.test.ts` passes (109 tests) and `npm run type-check` is clean. CLAUDE.md and README.md diffs are accurate against the code (the failure list in CLAUDE.md matches what `checkSpecCoverage` emits; ADR-0248 is linked correctly; `tdd_mode` is true).

The problem is false confidence, as predicted. The fixture matrix covers the spellings its author thought of. Probing with other inputs shows two classes of false pass:

1. **The spec parser silently drops criteria** it does not recognise. A dropped criterion is never required to have a test, and no error is raised. Several ordinary markdown spellings do this.
2. **The citation extractor counts tests that will not run, or that run nothing**: `.only` siblings, `if`-wrapped tests, `;` bodies. ADR-0248 (c) promises a citation is "a test that can run", and CLAUDE.md lists what does not count.

False alarms are rare and fail loudly (see IN-01), so they are not the main concern.

All inputs below were run through the exported functions via a scratch script; outputs are quoted.

## Critical Issues

### CR-01: `parseSpec` silently drops criteria it does not recognise, so they need no test

**File:** `src/__tests__/specCoverage.ts:165-199` (list handling), `:166-174` (fences), `:164` (comment strip)
**Issue:** In the `ac` section, any line that is not an exact column-0 list item is skipped with no error: `if (!item) continue` at line 191. The "no AC id" error fires only for a *matched* list item. Probes (spec header is `**Code:** FIX`, then `## Acceptance criteria`):

- ` - **AC-FIX-02** - b` (one leading space; valid CommonMark top-level item) next to a normal item: result `criteria: ["AC-FIX-01"]`, `errors: []`. AC-FIX-02 needs no test.
- A criteria table (`| AC-FIX-02 | b |`) next to one list item: same, `errors: []`.
- `> - **AC-FIX-02** - b` (blockquote): same.
- An unclosed code fence in the middle of the section: every later criterion is swallowed, `errors: []` (`fence !== null` at EOF is never reported).

The parser only complains when *all* criteria vanish (`acItems === 0`), so a spec with one well-formed item always passes. ADR-0248 lists fence/comment handling but not this fail-open default.

**Fix:** Make unrecognised content in the AC section an error rather than a skip. Report any non-blank, non-heading line in `ac` that is not a list item or a continuation of one, and report an open fence at EOF:

```ts
// in the section==='ac' branch, before `const item = ...`
if (section === 'ac' && line.trim() !== '' && !/^[-*+]\s|^\d+[.)]\s/.test(line) && /AC-/.test(line)) {
  errors.push(`${name}: acceptance criteria line is not a top-level list item: ${line.trim().slice(0, 40)}`)
}
// after the loop
if (fence !== null) errors.push(`${name}: unclosed code fence`)
```

Add fixture rows for each probe above.

### CR-02: `it.only` is counted, and it stops every other cited test in the file from running

**File:** `src/__tests__/specCoverage.ts:100-142`; asserted as intended at `src/__tests__/specCoverage.test.ts:54`
**Issue:** `extractCitations` treats `only` as a normal counted case. Probe: `it.only('AC-FIX-09', ...)` followed by `it('other', ...)` returns `["AC-FIX-09"]`. In vitest, an `.only` in a file means the file's other tests do not run (locally `allowOnly` defaults to true). One stray `.only` left in a file therefore turns every other cited criterion in it into a title that is cited but never executed, and the check stays green. This contradicts ADR-0248 (c) "a test that can run", and the test file asserts the opposite as correct behaviour.

**Fix:** Treat `only` as an error, not a citation. Easiest is to have `extractCitations` (or `runSpecCoverage`) report a file containing any `.only` modifier on `it/test/describe` as `file: contains .only, so its other cited tests may not run`, and drop the `only` row from `counted` into a new error test. Alternatively add `only` to `NOT_RUN` and say so in CLAUDE.md.

## Warnings

### WR-01: "Empty body" is defeated by trivial bodies

**File:** `src/__tests__/specCoverage.ts:83-91`
**Issue:** `hasRunnableBody` rejects only an empty block. All of these are counted (probed):
`() => { ; }` (EmptyStatement), `() => { return }`, `() => undefined`, `it('AC', null)`, `it('AC', false)`, `it('AC', noop)`. CLAUDE.md says an empty test does not count and the roadmap says nothing may quiet the check with an empty test; `() => { ; }` and `() => undefined` are one keystroke away from `() => {}` and quiet it. (Whether the body asserts anything is rightly out of scope and documented; these are about being *empty*.)
**Fix:** Count only blocks with at least one non-`EmptyStatement` statement; treat `null`, `undefined`, `void` expressions and boolean/null literals as no body:

```ts
if (ts.isBlock(body.body)) return body.body.statements.some((s) => !ts.isEmptyStatement(s))
if (body.kind === ts.SyntaxKind.NullKeyword || body.kind === ts.SyntaxKind.FalseKeyword || body.kind === ts.SyntaxKind.TrueKeyword) return false
```
and for expression-bodied arrows reject `undefined`/`void 0`/`null`.

### WR-02: Fence closing ignores fence length, producing fake and missing criteria

**File:** `src/__tests__/specCoverage.ts:168`
**Issue:** `line.trim() === f[1]` compares the line with its own captured fence, so it is always true for a bare fence line of the same character. CommonMark requires the closing fence to be at least as long as the opener. Probe: a ```` opener closed by a bare ``` line yields `criteria: ["AC-FIX-02"]`. The fake in-fence item is added and the real `AC-FIX-01` after it is swallowed by a phantom fence. A spec documenting markdown inside a four-backtick fence (nested ``` examples are exactly why people use four) is parsed wrongly in both directions.
**Fix:** `if (f && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1]) fence = null`.

### WR-03: Tests registered conditionally or never called still count

**File:** `src/__tests__/specCoverage.ts:104-141`
**Issue:** The walk descends into every node, so `if (false) { it('AC-FIX-07', () => { run() }) }`, `if (process.env.NOPE) { it(...) }` and a test inside a function that is never invoked are all counted (probed). ADR-0248 lists `ctx.skip()`, variable titles and aliased imports as invisible but does not list this. Options objects have the same hole: `{ ['skip']: true }` and `{ ...opts }` are counted (`propName` returns `null` for computed names, spreads are ignored).
**Fix:** Stop descending through `IfStatement`, `ConditionalExpression` and function declarations/expressions that are not the body argument of a recognised `describe`/`it`; or at minimum record the limitation in ADR-0248 Consequences and CLAUDE.md. For options, treat any computed/spread member as off (fail safe).

### WR-04: Citations from `render-service/src` count, but the bare run never executes that package

**File:** `src/__tests__/specCoverage.ts:269`; `vite.config.ts:145-162`; `CLAUDE.md` (new "The check" bullet)
**Issue:** `TEST_ROOTS` includes `render-service/src`, but the root vitest config excludes `render-service/**` and CLAUDE.md says to run it with `cd render-service && npm test`. CLAUDE.md and the template warn only that *rules* criteria need `npm run test:rules`. A render-service criterion shows green under bare `npx vitest run` without any test having run. The two statements in CLAUDE.md (check runs inside a bare run / proves a title cites it) are true, but the caveat list is incomplete.
**Fix:** Add render-service to the CLAUDE.md, TEMPLATE.md "Tests" and ADR-0248 Consequences caveats ("criteria cited from `render-service/src` need `cd render-service && npm test`").

### WR-05: Title extraction reads the whole subtree, not what the runner will print

**File:** `src/__tests__/specCoverage.ts:44-59, 93-98`
**Issue:** `titleText` collects every string literal anywhere under the title expression. Probes: ``it(`x ${c ? 'AC-FIX-11' : ''}`, ...)`` and `it(f('AC-FIX-12') + 'x', ...)` both return the ID, although the actual title may not contain it (the conditional can pick the empty branch; `f` can return anything). Conversely, `it(c ? 'AC-FIX-10' : 'x', ...)` and `it(('AC-FIX-22'), ...)` and `'AC-FIX-23' as string` return nothing (parenthesised and cast titles are false alarms, though they fail safe).
**Fix:** Only collect literals that are direct string operands of `+` and the static parts of a template (do not descend into `${...}` expressions or call arguments); unwrap `ParenthesizedExpression` and `AsExpression` in `isLiteralTitle`.

## Info

### IN-01: Rare false alarms from list-shaped noise in the AC section

**File:** `src/__tests__/specCoverage.ts:146, 190-198`
**Issue:** A thematic break written `* * *` matches `LIST_ITEM` and errors as "item has no AC id: * *". Loud and recoverable, but it is a legitimate spec rejected. A `.md` extension in capitals, or a spec in `docs/specs/<subdir>/`, is silently not scanned (`:292`; the nested case is asserted as intended at `specCoverage.test.ts:543`). A directory named `*.test.ts` would be returned by `findTestFiles` (recursive readdir lists directories) and make `readFileSync` throw EISDIR.
**Fix:** Skip thematic breaks (`/^([-*_])(\s*\1){2,}\s*$/`) before `LIST_ITEM`; filter `findTestFiles` to files; make the subdirectory exclusion visible in the TEMPLATE instructions (it already says to copy to `docs/specs/<feature-slug>.md`, so this is documentation only).

### IN-02: `<!--` inside inline code can pair with a later real comment and swallow criteria

**File:** `src/__tests__/specCoverage.ts:164`
**Issue:** Comment stripping is a plain regex run before fences or inline code are considered. A spec that mentions `` `<!--` `` in prose pairs it with the next `-->` (for example the template's own comment lines) and removes everything between, including criteria. Probe: prose mention in Behavior plus a trailing comment gave `criteria: []` (loud only because *all* criteria vanished; a partial loss would be silent, see CR-01).
**Fix:** Strip comments per line outside fences and outside backtick spans, or document that `<!--` must not appear in a spec outside a comment.

### IN-03: `describe` with a non-inline callback never counts its title

**File:** `src/__tests__/specCoverage.ts:127-129`
**Issue:** `describe('AC-FIX-18', suiteFn)` returns `[]` (callback is an identifier, `walk` finds no cases). Fails safe (false alarm) and matches the ADR's "variable titles" caveat in spirit, but the ADR does not mention suite-callback references.
**Fix:** Add a line to ADR-0248 Consequences.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
