---
phase: 144-worshipbuilder-rename
fixed_at: 2026-10-27T00:00:00Z
review_path: .planning/phases/144-worshipbuilder-rename/144-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 144: Code Review Fix Report

**Fixed at:** 2026-10-27
**Source review:** .planning/phases/144-worshipbuilder-rename/144-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-03: Compiled `functions/lib` still carries the old brand; Functions have no predeploy build

**Files modified:** `firebase.json`, `src/__tests__/firebaseFunctionsPredeploy.test.ts` (new)
**Commit:** f8989162
**Applied fix:** Added `"predeploy": ["npm --prefix functions run build"]` to the functions block only (hosting untouched, for Phase 145). `functions/package.json` has `"build": "tsc"`; the build succeeds locally and `grep -ri "Worship Planner" functions/lib` is now empty (lib is gitignored, not committed). The assertion went into a new test file rather than `firebaseHostingHeaders.test.ts`, because that file contains NUL bytes and the edit tool refuses it.

### WR-01: Guard is case-sensitive, so common variants of the old name pass undetected

**Files modified:** `src/__tests__/brandName.test.ts`
**Commit:** 70ccad1d
**Applied fix:** `OLD_NAME` is now `/worship[\s_-]?planner/i`. Documented non-renames are removed by exact phrase before matching, via an explicit `ALLOWED` list: the `claudeApi.ts`-scoped "The worship planner applies", plus the global exact strings `worshipplanner.app` and `worship-planner-bc515`. New self-tests prove that each variant (sentence case, upper case, hyphen, underscore, NBSP, `WorshipPlanner`) is caught. They also prove the allow-list is narrow: the claudeApi phrase in another file is still flagged, and other prose in claudeApi.ts is still flagged. Status: fixed. The detector is test logic, so a human glance at the allow-list contents is worthwhile.

### WR-02: `stripComments` line-prefix heuristic can hide real user-facing text

**Files modified:** `src/__tests__/brandName.test.ts`
**Commit:** 1e7b693f
**Applied fix:** Replaced the line-prefix regex with `stripJsComments`, a small scanner that tracks quote and template-literal state (including `${}` nesting). It removes only real `/* */` and `//` comments. For `.vue` and `.html` it strips `<!-- -->`, applies the JS scanner only inside `<script>` blocks, and strips `/* */` only inside `<style>` blocks. Template text is never comment-stripped. Self-tests pin these cases:
- A `* bullet` line inside a template literal is still scanned.
- `/* x */ 'Worship Planner'` is still scanned.
- `//` inside a URL string and inside a nested template is kept.
- A trailing `// ...` is stripped.
- A multi-line block comment with unstarred continuation lines is stripped.
- Script-block and style-block comments in a `.vue` file are stripped.

The 3 known comment hits (roster.ts, pcSongImport.ts, ServiceEditorView.vue) still pass. Known limitation, documented in the code: a regex literal containing a quote can desync the scanner for the remainder of that file. That failure mode only affects detection, and the real scan currently has no hidden offenders.

## Verification

- `npx vitest run src/__tests__/brandName.test.ts`: 23/23 pass.
- `npx vitest run src/__tests__/firebaseFunctionsPredeploy.test.ts src/__tests__/firebaseHostingHeaders.test.ts`: 4/4 pass.
- `npm run type-check` (vue-tsc --build): clean.

## Skipped Issues

None. (Info findings IN-01..IN-03 were out of scope for `critical_warning`.)

---

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
