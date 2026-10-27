---
phase: 145-domain-cutover-to-worshipbuilder-web-app
plan: 01
subsystem: infra
tags: [firebase-hosting, redirects, hosting-targets, vitest]
requires: []
provides:
  - "firebase.json two-target hosting array (app SPA + /api, legacy plain 302 redirect)"
  - ".firebaserc target mapping app -> worshipbuilder, legacy -> worship-planner-bc515"
  - "legacy-site/index.html static fallback page"
  - "firebaseHostingTargets.test.ts shape/redirect-model/reserved-path guard"
affects: [145-02, 145-03]
tech-stack:
  added: []
  patterns: ["Targeted hosting blocks found by target in tests", "Redirect regex evaluated in a model helper"]
key-files:
  created:
    - legacy-site/index.html
    - src/__tests__/firebaseHostingTargets.test.ts
  modified:
    - firebase.json
    - .firebaserc
    - src/__tests__/firebaseHostingHeaders.test.ts
key-decisions:
  - "Legacy block is redirects only: two type-302 regex rules, second excludes paths beginning /__ so /__/auth/* and /__/firebase/init.json stay served"
  - ".firebaserc hand-written in the CLI target:apply shape (no CLI call, so no auth/network dependency)"
requirements-completed: [R448, R451]
duration: 15min
completed: 2026-10-27
status: complete
---

# Phase 145 Plan 01: Two-target hosting and legacy redirect Summary

**firebase.json now has an `app` SPA target (worshipbuilder) and a `legacy` target that only 302-redirects to the same path on https://worshipbuilder.web.app, never matching `/__`, guarded by a redirect-model test.**

## Task Commit

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Two targeted hosting sites + .firebaserc + legacy-site page + tests | c23037fe |

## What was done
- `firebase.json` `hosting` became an array of two targeted blocks; the `app` block keeps the previous keys verbatim, the `legacy` block has exactly target/public/ignore/redirects. Other top-level blocks unchanged.
- `.firebaserc` maps hosting targets (including the CLI's `etags: {}`).
- `legacy-site/index.html`: static noindex page linking the new origin, no script, no old-origin host.
- New `firebaseHostingTargets.test.ts` (30 tests): shape, exact rules, open-redirect origin check, reserved `/__*` paths return no redirect, page content, `.firebaserc` mapping.
- `firebaseHostingHeaders.test.ts` now reads the `app` block via `loadHostingBlock('app')`. Its literal NUL byte was replaced by the `\u0000` escape (via a node script, since Edit/Write refuse NUL files); behavior identical.

## Verification
- `npx vitest run` on the three targeted files: 34/34 pass. `npm run type-check`: clean (after fixing one TS2532 non-null in the new test). Acceptance node checks pass. `git diff c59dab23 -- storage.rules firestore.rules` empty. Staging gate passed; no .planning/graphs, dist-legacy, functions/lib or functions/.env staged.
- No production writes: no deploy, no firebase CLI invoked at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2532 in new test**
- **Found during:** type-check
- **Issue:** `firebaserc.targets[...]` possibly undefined under noUncheckedIndexedAccess
- **Fix:** non-null assertion in the test
- **Files modified:** src/__tests__/firebaseHostingTargets.test.ts
- **Commit:** c23037fe

**2. [Plan-permitted fallback] .firebaserc hand-written** rather than via `firebase target:apply` (plan item 5 allows the exact shape; avoids any CLI auth/network dependency).

Commit trailer uses the harness-provided attribution (Claude Sonnet 5.5) rather than the "Opus 5.5" wording in the orchestrator note, since Sonnet 5.5 is the model that actually ran.

## Known Stubs
None.

## Threat Flags
None.

## Pending (backstop)
Production behavior (path+query preserved on the legacy redirect, `/__/*` served first) is verified only at the owner-run runbook Step 6 at milestone-end cutover.

## Self-Check: PASSED
firebase.json, .firebaserc, legacy-site/index.html, both test files exist; commit c23037fe present.
