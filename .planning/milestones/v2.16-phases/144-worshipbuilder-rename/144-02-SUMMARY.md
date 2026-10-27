---
phase: 144-worshipbuilder-rename
plan: 02
subsystem: email
tags: [copy, rebrand, cloud-functions, vitest, adr, regression-guard]
requires: ["144-01"]
provides:
  - "WorshipBuilder brand in all 12 outbound email literals (E1-E12)"
  - "Static brand regression guard src/__tests__/brandName.test.ts (R446/R447)"
  - "ADR-0246 recording the brand decision"
affects: []
tech-stack:
  added: []
  patterns: ["comment-stripped case-sensitive source scan plus positive per-site count table"]
key-files:
  created:
    - src/__tests__/brandName.test.ts
    - docs/adr/0246-app-brand-is-worshipbuilder-internal-identifiers-keep-their-names.md
  modified:
    - functions/src/adminEmail.ts
    - functions/src/inviteOnboarding.ts
    - functions/src/volunteerLink.ts
    - functions/src/adminEmail.test.ts
    - functions/src/inviteOnboarding.test.ts
    - functions/src/volunteerLink.test.ts
    - functions/src/index.test.ts
    - docs/adr/README.md
key-decisions:
  - "Subjects that name no app (admin 'added', volunteer magic-link) stay unchanged and are pinned with exact-equality tests; their bodies carry the brand"
  - "Guard lives at src/__tests__/brandName.test.ts so tsconfig.vitest.json type-checks its node:fs imports"
  - "index.html (U1) and App.vue splash (U2) are covered by the guard's source assertion, not a mounted test (ADR-0246 f2)"
requirements-completed: [R446, R447]
duration: ~30min
completed: 2026-10-27
status: complete
---

# Phase 144 Plan 02: WorshipBuilder emails + brand guard Summary

Every outbound email that names the app now says WorshipBuilder (12 template literals across the three email modules), and a static guard fails if the old name reappears in user-facing source or if any U1-U14 / E1-E12 site drops the brand. ADR-0246 records the decision.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Email copy E1-E12 + tests T1-T4 (R447) | 33134ff6 |
| 2 | Brand guard test + ADR-0246 + index row (R446, R447) | 01675d84 |

## What changed

- **Emails:** brand token only in `adminEmail.ts` (7), `inviteOnboarding.ts` (4), `volunteerLink.ts` (1). Numstat is 7/7, 4/4, 1/1 and the brand-token-only diff gate printed nothing. Sender identity (`params.ts`, the `noreply@worshipplanner.app` address, From display name) is untouched.
- **Tests:** exact subject equality and full body sentences for admin invited (with and without base URL), admin added, both inviteOnboarding paths, and the volunteer magic-link body. The two no-app subjects are pinned exactly. `index.test.ts` T3 changed only the display-name token (3/3 lines); the address count is still 2.
- **Guard:** negative scan (comments stripped, case-sensitive), wrong-variant scan, 17-row positive count table, detector self-test (20 tests).
- **ADR-0246:** MADR-lite, indexed in `docs/adr/README.md`, includes the U1/U2 static-guard exception.

## Fail-first evidence

- RED (emails): after the test edits and before the literal edits, 7 assertions failed across the three suites.
- RED (guard): with `src/views/LoginView.vue` temporarily reverted to the old-name h1, the guard exited 1 with 2 failures, naming `src/views/LoginView.vue` in both the negative scan and the positive table row.
- GREEN: restored from a scratchpad backup copy (not git); `grep -c '>WorshipBuilder</h1>'` = 1, `git status --porcelain` for the file clean, backup deleted; guard 20/20 passing.

## Verification

- `cd functions && npx vitest run` (full): 19 files, 722 tests pass. `npx tsc --noEmit` clean.
- Root runner on the three email suites: 30 tests pass.
- `npm run type-check` (vue-tsc --build): clean.
- Non-renames intact: the old-name grep prints exactly the 3 comment lines (`roster.ts:196`, `pcSongImport.ts:291`, `ServiceEditorView.vue:4068`); `claudeApi.ts` role phrase count 1.
- Identifier gates: file-level diff for package.json/lockfiles/firebase.json/.firebaserc/rules/params.ts/index.ts/claudeApi.ts empty; line-level `wp-`/`worship-planner-bc515`/`worshipplanner` gate over non-test source empty.
- Bare root `npx vitest run` (566 s): 243 files pass, 1 fails (`src/storage.rules.test.ts`, the known baseline: Firestore emulator ECONNREFUSED on 8080), 6024 tests pass, 43 skipped. The run also logged 2 "Worker exited unexpectedly" pool errors (fork pressure while the machine was busy; the log shows `fork: retry: Resource temporarily unavailable`), and 245 of the expected 246 files were reported. Two files had no completion line in the log (`functions/src/pptxParser.test.ts`, `src/views/__tests__/ServiceEditorView.test.ts`); both were re-run individually and pass (369 tests). The suite is therefore green apart from the baseline, but the single bare run was not perfectly clean; treat the worker-exit errors as an environment artifact, not a regression.
- No deploy was run. `functions/lib` untouched.

## Deviations from Plan

None - plan executed as written. The guard's wrong-variant pattern is `Worship[ -]Builder|Worshipbuilder`.

## Manual / batched UAT items (deferred to milestone end)

- After the coordinated deploy (fresh `cd functions && npm run build`, every function re-exported from `functions/src/index.ts`, per-deploy owner confirmation): receive a real admin-invite, admin-added, member-invite and volunteer magic-link email and confirm the brand reads WorshipBuilder in subject (where applicable) and body.
- Returning-user continuity (backstop truth): after the rename ships, confirm a returning user's sign-in, saved Run monitor setup, selected church and list prefs carry on unchanged. Source-level gates above show no identifier was renamed. PENDING owner UAT.
- Visual confirmation of the 144-01 UI surfaces (listed in 144-01-SUMMARY).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

Commits 33134ff6 and 01675d84 exist; `src/__tests__/brandName.test.ts` and ADR-0246 exist; ADR indexed.
