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
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 146: Code Review Report (final round)

**Reviewed:** 2026-11-06
**Depth:** standard
**Files Reviewed:** 6

## Summary

Focus was commit 905e3392 (`parseSpec` continuation handling). I ran concrete inputs against the real `parseSpec`.

Confirmed working:
- Wrapped lines pass: `  AC-FIX-01 when ...`, a column-0 `AC-FIX-01 when ...`, a bold-id wrap `**AC-FIX-01** does` (indented and column 0), and `  - AC-FIX-01 still holds`.
- Indented definitions still error: `  - **AC-FIX-02** - b`, ` - `, `   - `, `  1. `, `  - **AC-FIX-02**: b`, `  * **AC-FIX-02** - b`, `| AC-FIX-02 | b |`, `> - **AC-FIX-02** - b`.
- A bold-id definition after a blank line at column 0 still errors.

The change reopened one silent drop of a criterion (WR-01).

## Warnings

### WR-01: A criterion written without its list marker is silently dropped when it directly follows another item

**File:** `src/__tests__/specCoverage.ts:200` (`CRITERION_SHAPE`), applied at `:258`
**Issue:** `CRITERION_SHAPE` only counts an indented bullet with a bold id and separator as a definition. A bold-id-plus-separator line with no bullet is not covered, so while an item is open it is treated as a continuation. The template format is `- **AC-XXX-01** - text`, so forgetting the `- ` on a new criterion is a plausible typo. Before 905e3392 the second line below errored. Now it parses with `errors: []` and `criteria: ['AC-FIX-01']`, so AC-FIX-02 is never registered:

```
- **AC-FIX-01** - a
**AC-FIX-02** - b          (also: "  **AC-FIX-02** - b"; the same after a wrapped line)
```

The "has no test citing it" gate never fires for AC-FIX-02. The only remaining signal is a test that cites AC-FIX-02, which reports "not defined in any spec". In spec-first order the spec comes before the tests, so the missing criterion is exactly what the gate should catch. The same gap covers a colon inside the bold, `  - **AC-FIX-02:** b`, which also gives `errors: []`. Both inputs were run.

A bold id followed by a separator is a definition. A wrapped continuation such as `**AC-FIX-01** does` has no separator, so it stays a continuation.

**Fix:** Make the bullet optional and allow a colon before the closing marker:

```ts
const CRITERION_SHAPE =
  /^\s*[>|]|^\s*(?:(?:[-*+]|\d+[.)])\s+)?(?:\*\*|__)AC-[A-Za-z0-9-]*:?(?:\*\*|__)\s*[-–—:]/
```

Add cases to the "still reports" table in `specCoverage.test.ts`: `**AC-FIX-02** - b`, `  **AC-FIX-02** - b`, and `  - **AC-FIX-02:** b`. Keep `**AC-FIX-01** does` in the continuation table. A bold id followed by `- ` could in theory begin a wrapped sentence, but that is far less likely than a missing bullet.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
