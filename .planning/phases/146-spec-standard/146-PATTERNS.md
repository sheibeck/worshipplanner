# Phase 146: Spec Standard - Pattern Map

**Mapped:** 2026-11-06
**Files analyzed:** 5
**Analogs found:** 5 / 5 (all role-match; no exact analog for the AST extractor)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/__tests__/specCoverage.ts` | utility (pure logic, not collected) | transform + file-I/O | helpers inside `src/__tests__/brandName.test.ts` (lines 18-96) | role-match |
| `src/__tests__/specCoverage.test.ts` | test (repo check) | file-I/O | `src/__tests__/brandName.test.ts`, `src/__tests__/cutoverRunbook.test.ts` | exact (repo-check) |
| `docs/specs/TEMPLATE.md` | doc/template | n/a | template section of `docs/adr/README.md` (lines 8-15) | role-match |
| `CLAUDE.md` (modify) | config/docs | n/a | its own `##` sections, e.g. "Type-checking" (line 37), baseline note (line 73) | exact |
| `.planning/PROJECT.md` (modify) | docs | n/a | `## Core Value` (line 8) then `## Current State` (line 12) | exact |

## Pattern Assignments

### `src/__tests__/specCoverage.test.ts` (repo-check test, file-I/O)

**Analogs:** `brandName.test.ts` for header, `root`, `walk`, inline-string detector self-tests. `cutoverRunbook.test.ts` for markdown-section parsing and `/\r?\n/` splitting.

**Header and imports** (`brandName.test.ts` 1-6):
```typescript
// R446/R447 brand guard. See ADR-0246 (docs/adr/0246-...md)
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
```
New file: same header style citing `R454`-`R458`. Add `mkdtempSync, rmSync, writeFileSync, mkdirSync`, `node:os` `tmpdir`, and `afterAll`.

**Recursive walk with Windows path normalization** (`brandName.test.ts` 79-83):
```typescript
function walk(dir: string): string[] {
  return readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).map(
    (p) => `${dir}/${p.replace(/\\/g, '/')}`,
  )
}
```
Use this for `findTestFiles(root)`. Take `root` as a parameter so the temp-dir test can reuse it.

**CRLF-safe markdown reading** (`cutoverRunbook.test.ts` 23-24, 31-37, 49-55):
```typescript
const text = existsSync(RUNBOOK) ? readFileSync(RUNBOOK, 'utf8') : ''
const lines = text.split(/\r?\n/)
// ...
if (line.startsWith('## ')) { /* section boundary */ }
if (line.trimStart().startsWith('```')) { inFence = !inFence; continue }
```
`parseSpec` follows the same shape: split on `/\r?\n/`, `## ` boundaries, fence toggling. RESEARCH Q5 adds `~~~` and HTML comment blanking.

**Inline-string detector self-tests** (`brandName.test.ts` 134-140). Fixtures are string constants passed to the pure function:
```typescript
it('detector self-test: flags template text, ignores real comments', () => {
  const ts = (s: string) => hasOldName('src/x.ts', s)
  expect(ts('  // Worship Planner is the old name')).toBe(false)
```
Copy this for `extractCitations` and `parseSpec` cases. Titles cite `R45x` only. Never put an `AC-` token in an `it()` or `describe()` title (RESEARCH Pitfall 1).

**Table-driven and failure-naming style** (`cutoverRunbook.test.ts` 89, 123):
```typescript
expect(hit, `command not found in a fence: ${cmd}`).toBeDefined()
for (const p of phrases) expect(body, `${HEADINGS[idx]} lacks "${p}"`).toContain(p)
```
For the real-repo run: `expect(runSpecCoverage(root)).toEqual([])`, which prints the offending ID or spec. Add `, 30000)` to the real-repo and temp-dir tests (the repo already uses this in `ServiceEditorView.*.test.ts`).

**Required-sections guard for the template** (`cutoverRunbook.test.ts` 9-21, 72-76): a `HEADINGS` array and `h2.filter(h => HEADINGS.includes(h))` compared with `toEqual`. Use this for the R454 template-validity test.

---

### `src/__tests__/specCoverage.ts` (pure utility)

**Analog:** the helper block of `brandName.test.ts` (`stripJsComments`, `stripComments`, `hasOldName`, `isTestPath`). The pattern is small pure functions that take strings and return values, with the `.test.ts` file doing only I/O and assertions.

**Path filter to mirror** (`brandName.test.ts` 85-87):
```typescript
function isTestPath(p: string): boolean {
  return /\.(test|spec)\.ts$/.test(p) || /(^|\/)(__tests__|__fixtures__|__mocks__)\//.test(p)
}
```
`findTestFiles` uses `/\.(test|spec)\.[cm]?[jt]sx?$/` and drops `node_modules`, `lib` and `dist` segments. `brandName` already treats this file as non-source because it sits in `__tests__/`.

**Core extractor:** no codebase analog. Use RESEARCH.md "extractCitations core" (lines 289-352) and the signatures at lines 264-286.

Notes for the planner:
- `noUncheckedIndexedAccess` is on, so destructure with defaults or use `?.` (RESEARCH Pitfall 3).
- Gate on `npm run type-check`, not `-p tsconfig.app.json`.
- Comments in this directory must be prose. `vitest/no-commented-out-tests` flags code-looking test calls in comments.

---

### `docs/specs/TEMPLATE.md` (doc template)

**Analog:** `docs/adr/README.md` 8-15: a prose description of the fixed `##` heading order, with a title H1 and optional trailing list.
```markdown
## Template (MADR-lite)
Each ADR file carries five second-level headings, in this order: **Title** (as the H1), **Status** ...
```
Follow the same convention of fixed, named `##` headings. Take the actual skeleton from RESEARCH.md lines 359-382: `**Code:** XXX` before the first `##`, then Purpose, Behavior, Acceptance criteria, Edge cases, Out of scope, Retired criteria, Tests, ADRs. The sample `it(...)` line must be indented or fenced, never a list item. Do not add an index (deferred).

---

### `CLAUDE.md` (modify)

**Analog:** its existing `##` sections. Heading-plus-short-rule style, with `>` blockquote callouts for warnings.
- Add a new `## Spec-driven development` section. Place it before `## Testing:` (line 47) or after `## Type-checking`, so it sits with the other process rules. Include the canonical sentence, the spec, tests, code order, the AC citation form, the quick/fast rule, and the bug-fix rule (RESEARCH lines 385-386).
- Edit the baseline sentence at line 73 ("Known-failing baseline: `src/storage.rules.test.ts` only ... A bare `npx vitest run` should show exactly one failing file."). Add that `src/__tests__/specCoverage.test.ts` also fails by design while a committed spec has uncited criteria (Phase 147 window). The "2-file baseline" mentions at lines 54 and 66 are historical and need no change.
- The file is CRLF in the working tree. Use single-line edit anchors and check `git diff --stat` afterward.

---

### `.planning/PROJECT.md` (modify)

**Analog:** its standing `##` blocks (`## What This Is` line 3, `## Core Value` line 8).
- Insert a new `## Development Philosophy` between `## Core Value` (ends line 10) and `## Current State` (line 12). It must hold the same canonical sentence verbatim as `CLAUDE.md`.
- Reduce the "Development philosophy" paragraph inside `## Current Milestone` (starts line 28) to a pointer, so milestone close has nothing to preserve there.
- The file is CRLF in the working tree.

## Shared Patterns

### Repo-check placement and execution
**Source:** `src/__tests__/brandName.test.ts`, `cutoverRunbook.test.ts`, `firebaseHostingTargets.test.ts`. All are plain `*.test.ts` files in `src/__tests__/`, use `process.cwd()` or `resolve(process.cwd(), ...)`, and run under bare `npx vitest run` with no separate command.
**Apply to:** `specCoverage.test.ts`.

### Canonical rule sentence parity (R455, R458)
No existing analog. The guard follows the `cutoverRunbook.test.ts` phrase check (`expect(body).toContain(phrase)`, lines 121-124). Read `CLAUDE.md`, `.planning/PROJECT.md` and `.planning/config.json` and assert each contains the sentence, and that `workflow.tdd_mode === true`. Keep the sentence free of markdown so the match is stable across CRLF and LF.

### Line endings
Split with `/\r?\n/` everywhere (`cutoverRunbook.test.ts` line 24). Both docs and about half of the test files are CRLF.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| TS-AST citation extractor (inside `specCoverage.ts`) | utility | transform | No `typescript` compiler API use exists in tests. `brandName.test.ts` uses a hand-rolled comment stripper, which RESEARCH rejects. Use the RESEARCH.md code. |
| Temp-dir fixture tree (`mkdtempSync`) | test | file-I/O | No existing test builds a temp repo layout. Use RESEARCH Q2. |

## Metadata

**Analog search scope:** `src/__tests__/` (the three named checks), `docs/adr/README.md`, `CLAUDE.md` headings, `.planning/PROJECT.md` lines 1-30
**Files scanned:** 7 (plus RESEARCH.md)
**Pattern extraction date:** 2026-11-06
