---
phase: 144-worshipbuilder-rename
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - firebase.json
  - src/__tests__/brandName.test.ts
  - src/__tests__/firebaseFunctionsPredeploy.test.ts
  - functions/src/adminEmail.ts
  - functions/src/inviteOnboarding.ts
  - functions/src/volunteerLink.ts
  - functions/src/adminEmail.test.ts
  - functions/src/inviteOnboarding.test.ts
  - functions/src/volunteerLink.test.ts
  - functions/src/index.test.ts
  - docs/adr/0246-app-brand-is-worshipbuilder-internal-identifiers-keep-their-names.md
  - index.html
  - src/App.vue
  - src/components/AppShell.vue
  - src/components/AppSidebar.vue
  - src/components/RosterPrintLayout.vue
  - src/components/ServicePrintLayout.vue
  - src/views/LoginView.vue
  - src/views/QuarterShareView.vue
  - src/views/SelectChurchView.vue
  - src/views/ShareView.vue
  - src/views/VolunteerLinkCompleteView.vue
  - src/views/VolunteerRequestView.vue
  - src/views/VolunteerSignInView.vue
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 144: Code Review Report (iteration 2)

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 24
**Status:** clean (no critical or warning findings; 2 info)

## Summary

Re-review after the WR-01/02/03 fixes (f8989162, 70ccad1d, 1e7b693f). All three fixes are correct and introduce no new bugs.

- **WR-03 (predeploy).** `firebase.json` now has `"predeploy": ["npm --prefix functions run build"]` on the functions block only. `functions/package.json` defines `"build": "tsc"`, and `main` is `lib/index.js`. The Firebase CLI runs predeploy hooks with the project root as cwd, through the platform shell. `npm --prefix <dir> run <script>` is plain npm with no shell-specific syntax, so it behaves the same on Windows and POSIX. I ran it from the repo root: exit 0, and `git status` shows no tracked changes because `lib` is gitignored. The hosting predeploy is untouched. The array form fails the deploy on a non-zero exit. The new test checks the exact command string.
- **WR-01 (case and separator variants).** `OLD_NAME = /worship[\s_-]?planner/i` catches sentence case, upper case, hyphen, underscore, whitespace and `WorshipPlanner`. The allow-list has three entries: one phrase scoped to a single file (`claudeApi.ts`: "The worship planner applies"), plus the exact strings `worshipplanner.app` and `worship-planner-bc515`. Both global strings are documented non-renames in ADR-0246. The self-tests prove the claudeApi phrase is still flagged in other files, and that other prose in `claudeApi.ts` and a bare `worshipplanner` are still flagged. This is narrow enough. The two global strings could in principle mask brand prose such as "visit worshipplanner.app", but that string is the real domain.
- **WR-02 (comment-aware scanner).** The logic holds under tracing. Escapes, newline termination of single-line quotes, template literals, `${}` nesting (the `'b'`/`'t'` frame stack), inline and multi-line block comments, and a trailing `//` all behave as the self-tests assert. I ran a copy of the scanner over every non-test `.ts` file and every `.vue` `<script>` block under `src/` and `functions/src/`, and checked the end state. All end balanced, in code mode, with no open quote. Only two test files end unbalanced (`src/storage.rules.test.ts`, `functions/src/index.test.ts`, presumably regex literals), and tests are excluded from the guard. So the documented regex-literal limitation does not affect the real scan today, and it is acceptable as documented.

Vitest: `brandName.test.ts` (23) and `firebaseFunctionsPredeploy.test.ts` (1) all pass.

## Info

### IN-01: Regex literal ending in `\//` blanks the rest of its line

**File:** `src/__tests__/brandName.test.ts:48`
**Issue:** A regex such as `/https?:\/\//` ends with `\//`. The scanner treats the closing `/` plus the next character as a `//` comment and drops the remainder of that line. A quote inside a regex is already documented as a limitation. This one is bounded to a single line, so it can only hide an old-name occurrence that sits on the same line after such a regex. It is currently harmless.
**Fix:** Optional. Extend the limitation comment to mention it, or skip a `/` immediately preceded by `\` in the `//` branch.

### IN-02: Fix report claims an NBSP self-test that does not exist

**File:** `src/__tests__/brandName.test.ts:161-173`
**Issue:** `144-REVIEW-FIX.md` says NBSP is among the variants the self-tests prove are caught. The variant list has no NBSP case. `\s` does match NBSP, so the behavior is correct, but it is unpinned.
**Fix:** Add `'Worship Planner'` to the variant list.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
