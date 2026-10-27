---
phase: 144-worshipbuilder-rename
plan: 01
subsystem: ui
tags: [copy, rebrand, vue, vitest]
requires: []
provides:
  - "WorshipBuilder brand on all 14 web-app UI literals (U1-U14)"
  - "R446 rendered-text tests on every component brand site (U3-U14)"
affects: [144-02]
tech-stack:
  added: []
  patterns: ["in-place literal edit, no shared brand constant"]
key-files:
  created:
    - src/views/__tests__/VolunteerSignInView.test.ts
    - src/components/__tests__/RosterPrintLayout.test.ts
  modified:
    - index.html
    - src/App.vue
    - src/components/AppSidebar.vue
    - src/components/AppShell.vue
    - src/views/LoginView.vue
    - src/views/SelectChurchView.vue
    - src/views/VolunteerSignInView.vue
    - src/views/VolunteerRequestView.vue
    - src/views/VolunteerLinkCompleteView.vue
    - src/views/ShareView.vue
    - src/views/QuarterShareView.vue
    - src/components/ServicePrintLayout.vue
    - src/components/RosterPrintLayout.vue
key-decisions:
  - "Edit each literal in place; no shared brand constant (index.html cannot consume one)"
  - "U1 (index.html title) and U2 (App.vue splash) are covered by the 144-02 static guard, not a mounted test (ADR-0246 exception)"
requirements-completed: []
duration: ~25min
completed: 2026-10-27
status: complete
---

# Phase 144 Plan 01: WorshipBuilder UI rename Summary

Every web-app screen now says WorshipBuilder: tab title, splash, sidebar and mobile header, login, church picker, the three volunteer pages, and the share, quarter-share, service-print and roster-print footers. Each of the 13 source files changed exactly one token (ShareView two), and rendered-text tests pin the brand on every component site.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Brand headings U1-U9 (+ 7 R446 tests, new VolunteerSignInView test) | b3e3cee3 |
| 2 | Share / print footers U10-U14 (+ 5 R446 tests, new RosterPrintLayout test) | bb74e88e |

Both tasks followed RED then GREEN: the new tests were run first and failed on the old brand (7 of 7 and 5 of 5), then passed after the edits.

## Verification

- Targeted vitest (11 files): all pass (72 + 53 tests in the two task groups).
- `npm run type-check` (vue-tsc --build): clean.
- Bare `npx vitest run`: 244 passed, 1 failed file, which is the known `src/storage.rules.test.ts` baseline.
- Copy-only gate: numstat is 1/1 for every file (ShareView 2/2), and the brand-token-only diff gate printed nothing.
- `grep -rlE 'Worship ?Planner' index.html src --include=*.vue --include=*.html` prints only `src/views/ServiceEditorView.vue` (the deliberate code-comment non-rename).
- Untouched-file gate: `claudeApi.ts`, `roster.ts`, `pcSongImport.ts`, `ServiceEditorView.vue`, `package.json`, lockfile, `firebase.json` and `.firebaserc` are unchanged.

## Deviations from Plan

None - plan executed as written. The R446 tests were added at the positions the plan named; for ShareView a self-contained describe with its own `beforeEach` was used so the footer tests do not depend on the existing describe's state.

## Requirements

R446 is intentionally left pending: it also depends on the 144-02 static guard (which covers U1/U2 and the regression scan).

## Manual / batched UAT items (deferred to milestone end)

- Visually confirm the tab title, splash, sidebar and mobile header brand, login and church-picker headings, the three volunteer pages, and the share, quarter-share and print footers read "WorshipBuilder" with no wrap or layout change.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

Both commits exist (b3e3cee3, bb74e88e); both new test files exist.
