---
phase: 145-domain-cutover-to-worshipbuilder-web-app
plan: 03
subsystem: docs-runbook
tags: [runbook, adr, cutover, hosting, r448, r450, r451, r453]
requires: ["145-01", "145-02"]
provides:
  - "docs/runbooks/worshipbuilder-cutover.md: ordered, owner-confirmed cutover runbook (Steps 0-8, Rollback, smoke checklist)"
  - "src/__tests__/cutoverRunbook.test.ts: heading-order, command-placement, quiet-env-check and scope guard (16 tests)"
  - "ADR-0247 plus index row"
  - "INTEGRATIONS.md targeted deploy commands"
affects: []
tech-stack:
  added: []
  patterns: ["Markdown runbook string-guarded by a vitest section/fence parser"]
key-files:
  created:
    - docs/runbooks/worshipbuilder-cutover.md
    - src/__tests__/cutoverRunbook.test.ts
    - docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md
  modified:
    - docs/adr/README.md
    - .planning/codebase/INTEGRATIONS.md
key-decisions:
  - "Deploy order: CORS, authorized domain, hosting:app, functions (new-origin link check), new-domain smoke, hosting:legacy last"
  - "Env checks are grep -q / Select-String -Quiet with a [[:space:]]*$ tail: status only, CRLF-tolerant"
  - "Rollback via console Roll back or firebase hosting:clone; the 302 makes it reach every browser at once"
requirements-completed: [R448, R450, R451, R453]
duration: ~45 min (most of it the 10-minute full root suite)
completed: 2026-10-27
status: complete
---

# Phase 145 Plan 03: Cutover runbook, ADR-0247 and deploy docs Summary

**Owner cutover runbook (eleven ordered sections, every production step marked "Owner confirms before running") guarded by a 16-test structure test, plus ADR-0247 and targeted `hosting:app` / `hosting:legacy` deploy docs. Nothing was deployed or applied.**

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Runbook + guard test (RED confirmed 14 failed/2 passed, then GREEN 16/16) | 4362951d |
| 2 | ADR-0247 + index row + INTEGRATIONS.md | 11399e0a |

## What was built
- Runbook sections in order: Step 0 pre-flight (local, quiet status-only authDomain and `functions/.env` share-URL checks, Bash and PowerShell), Step 1 Storage CORS, Step 2 authorized domain, Step 3 `hosting:app`, Step 4 functions plus new-origin link check, Step 5 new-domain smoke (Google sign-in, magic link, CORS download), Step 6 `hosting:legacy` with `/__/auth/handler`, `/__/firebase/init.json` and `%{redirect_url}` curl checks, Step 7 per-person / per-Run-computer re-setup, Step 8 console renames, Rollback, Post-cutover checklist.
- Guard test enforces heading order, first fenced occurrence of each command in its section, quiet CRLF-tolerant env checks (no `grep -qx`), targeted-only `firebase deploy` lines, no placeholders, 6+ owner-confirm marks, and the Amendment 2 scope ban (no hand-off / carry / legacy-build wording).
- ADR-0247 records decisions (a)-(i) including the owner scope cut (R452 descoped, plain 302, no legacy `/api`, no open-tab handling) and the `/__` exclusion; all five source pointers resolve to it.
- INTEGRATIONS.md names both targeted deploy commands and warns against a target-less hosting deploy.

## Phase gate results
- Bare `npx vitest run` (once, 618 s): 251/252 files pass, 6156 tests pass; only `src/storage.rules.test.ts` fails (known baseline, emulator initializeTestEnvironment). No "Worker exited" crashes, so no re-runs needed. Note: the bare root run also collects `functions/src/*.test.ts` in this repo configuration; they passed there too.
- `npm run type-check`: exit 0. `cd functions && npx vitest run`: 20 files / 729 tests pass; `npx tsc --noEmit`: exit 0. `npm run build`: exit 0 (dist is gitignored).
- `git ls-files functions/.env`: empty. ADR pointer grep prints exactly the one ADR filename. Scope diff vs `c59dab23` over main.ts/stores/router/monitorConfig/package.json/vite.config.ts/.gitignore is empty; no originHandoff, legacy or vite.config.legacy.ts. Cumulative `git log --name-only c59dab23..HEAD` gate: no `.planning/graphs/`, `dist-legacy/`, `functions/lib/` or `functions/.env`.
- No production writes: no deploy, hosting, gcloud, Auth or OAuth command was run; `.env.local` and `functions/.env` were never read.

## Deviations from Plan
None - plan executed as written.

## Known Stubs
None.

## Threat Flags
None.

## Pending (backstop, owner cutover)
Deploy order, allowlist-before-deploy order and the end-to-end runbook walk are confirmed only at the milestone-end production cutover (batched UAT 145-1 to 145-7 stays PENDING, not accepted).

## Self-Check: PASSED
Runbook, guard test, ADR-0247, README row and INTEGRATIONS.md edits exist; commits 4362951d and 11399e0a present.
