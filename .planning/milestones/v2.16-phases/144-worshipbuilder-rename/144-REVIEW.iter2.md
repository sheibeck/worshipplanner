---
phase: 144-worshipbuilder-rename
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - docs/adr/0246-app-brand-is-worshipbuilder-internal-identifiers-keep-their-names.md
  - docs/adr/README.md
  - functions/src/adminEmail.test.ts
  - functions/src/adminEmail.ts
  - functions/src/index.test.ts
  - functions/src/inviteOnboarding.test.ts
  - functions/src/inviteOnboarding.ts
  - functions/src/volunteerLink.test.ts
  - functions/src/volunteerLink.ts
  - index.html
  - src/__tests__/brandName.test.ts
  - src/App.vue
  - src/components/__tests__/AppShell.test.ts
  - src/components/__tests__/AppSidebar.test.ts
  - src/components/__tests__/RosterPrintLayout.test.ts
  - src/components/__tests__/ServicePrintLayout.test.ts
  - src/components/AppShell.vue
  - src/components/AppSidebar.vue
  - src/components/RosterPrintLayout.vue
  - src/components/ServicePrintLayout.vue
  - src/views/__tests__/LoginView.test.ts
  - src/views/__tests__/QuarterShareView.test.ts
  - src/views/__tests__/SelectChurchView.test.ts
  - src/views/__tests__/ShareView.test.ts
  - src/views/__tests__/VolunteerLinkCompleteView.test.ts
  - src/views/__tests__/VolunteerRequestView.test.ts
  - src/views/__tests__/VolunteerSignInView.test.ts
  - src/views/LoginView.vue
  - src/views/QuarterShareView.vue
  - src/views/SelectChurchView.vue
  - src/views/ShareView.vue
  - src/views/VolunteerLinkCompleteView.vue
  - src/views/VolunteerRequestView.vue
  - src/views/VolunteerSignInView.vue
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 144: Code Review Report

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

The source diffs are clean single-token copy changes. No user-facing "Worship Planner"/"WorshipPlanner" remains in `src/`, `functions/src/` or `index.html` (verified with a case-insensitive grep across src, functions/src, index.html, public, render-service). No internal identifier was changed: `worshipplanner.app`, the `worship-planner-bc515` project id, package names and the lowercase `claudeApi.ts` phrase are all intact. The guard test passes (20/20) and Windows path handling is correct (`\` is normalised to `/` in `walk`). The remaining concerns are guard false negatives and one deploy hazard.

## Warnings

### WR-01: Guard is case-sensitive, so common variants of the old name pass undetected

**File:** `src/__tests__/brandName.test.ts:10`
**Issue:** `OLD_NAME = /Worship ?Planner/` misses `Worship planner` (sentence case), `WORSHIP PLANNER`, `Worship-Planner` and `Worship_Planner`. The comment justifies case-sensitivity by the lowercase phrase in `claudeApi.ts` and the `worshipplanner.app` address. That justification only supports excluding all-lowercase matches. `WRONG_VARIANT` covers hyphenated spellings of the NEW brand but nothing covers hyphenated or sentence-case spellings of the OLD one. A regression like "Welcome to Worship planner" ships green.
**Fix:**
```ts
// Matches any casing except the all-lowercase prose/domain forms
const OLD_NAME = /\bWorship[ _-]?Planner\b|\bWorship[ _-]planner\b|\bWORSHIP[ _-]?PLANNER\b|WorshipPlanner/
```
or use `/worship[ _-]?planner/i` and filter out the two known benign cases (`worshipplanner.app`, the `claudeApi.ts` lowercase phrase) with a small explicit allow-list.

### WR-02: `stripComments` line-prefix heuristic can hide real user-facing text (false negatives)

**File:** `src/__tests__/brandName.test.ts:16`
**Issue:** `/^\s*(?:\/\/|\/\*|\*).*$/gm` deletes the whole line for any line that starts with `*`, `/*` or `//`.
- A line that starts with `*` inside a multi-line template or string is dropped. Examples are a markdown-style bullet in an email body or the Claude prompt text, e.g. `* Sign in to Worship Planner`.
- `/* note */ const label = 'Worship Planner'` is dropped entirely.
- The opposite error is fail-safe but noisy. Trailing `code // Worship Planner` comments and non-star continuation lines of a block comment are NOT stripped, so they produce false positives and force authors to reword comments.

The self-test only exercises the happy paths (` * ...`, `// ...`, `<!-- -->`), so none of this is pinned.
**Fix:** Strip real comments with a small tokenizer, or scope the stripping:
- For `.vue`, remove `<!-- -->` and then only the `<script>` block's `/* */` and `//` comments.
- For `.ts`, remove `/\/\*[\s\S]*?\*\//g` (true block comments) and `/(^|[^:'"`])\/\/.*$/gm` (line comments not preceded by a scheme colon or quote).
- Add self-test cases for a `*`-prefixed string line, a trailing comment, and `/* x */ 'Worship Planner'`.

### WR-03: Compiled `functions/lib` still carries the old brand; Functions have no predeploy build

**File:** `functions/lib/adminEmail.js`, `functions/lib/inviteOnboarding.js`, `functions/lib/volunteerLink.js` (gitignored build output); `firebase.json:17`
**Issue:** `functions/package.json` has `"main": "lib/index.js"`, and the only `predeploy` in `firebase.json` (`npm run build`) belongs to the hosting block. A `firebase deploy --only functions` run without a prior `cd functions && npm run build` ships invite, admin and volunteer-link emails that still say "Worship Planner". This is the same failure mode as the known "no predeploy build hook" memory. The source guard cannot see it, because `lib/` is not scanned. The phase's email changes (R447) are only real once `lib/` is rebuilt.
**Fix:** Add a functions `predeploy` (`npm --prefix "$RESOURCE_DIR" run build`) in `firebase.json`. As a minimum, put "rebuild `functions/` before deploy" in the Phase 144 deploy checklist and verify with `grep -r "Worship Planner" functions/lib` after the build.

## Info

### IN-01: Guard scope is `.vue`/`.ts` plus `index.html` only

**File:** `src/__tests__/brandName.test.ts:29-33`
**Issue:** The guard does not scan `public/`, `render-service/src` (which may produce PPTX/PDF text), JSON/MD/HTML assets under `src/`, or `firebase.json`. Today nothing leaks (verified by grep), but the comment and ADR read as if the guard covers "every user-facing surface".
**Fix:** Either extend the scanned globs (`render-service/src/**/*.ts`, `public/**/*.{html,json,webmanifest}`) or state the exact scope in the test comment and ADR-0246.

### IN-02: No vacuous-pass protection and no self-test for `WRONG_VARIANT`

**File:** `src/__tests__/brandName.test.ts:40-48, 74-81`
**Issue:** If `walk` returned an empty list (wrong `cwd`, an unsupported `recursive` option on an older Node), the two offender tests would pass vacuously. Only the count rows would fail, and with `ENOENT` rather than a clear message. The self-test never exercises `WRONG_VARIANT`.
**Fix:** Add `expect(userFacingFiles.length).toBeGreaterThan(50)` and `expect(userFacingFiles).toContain('src/App.vue')`. Add `hit` cases for `Worship Builder`, `Worship-Builder` and `Worshipbuilder`.

### IN-03: Count-pinned literal rows are brittle

**File:** `src/__tests__/brandName.test.ts:50-72`
**Issue:** Exact counts (`'Sign in to WorshipBuilder'` x4, `'on WorshipBuilder'` x3 and x4) and markup-coupled literals (`>WorshipBuilder</h1>`) fail on any legitimate edit, such as a new email variant or a reformatted tag or attribute. Per-component behavioural tests added in this phase (e.g. `wrapper.get('h1').text()`) already assert the same facts more robustly.
**Fix:** Prefer `>= 1` for email literals, or drop the markup-coupled rows that the component tests duplicate.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
