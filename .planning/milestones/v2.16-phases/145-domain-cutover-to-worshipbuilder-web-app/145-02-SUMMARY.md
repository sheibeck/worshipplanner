---
phase: 145-domain-cutover-to-worshipbuilder-web-app
plan: 02
subsystem: config-links-allowlists
tags: [share-link, cors, hosting, tests, r449, r450]
requires: []
provides:
  - "SERVICE_SHARE_BASE_URL default = https://worshipbuilder.web.app (test-pinned)"
  - "one-slash link tests for every server-built link family"
  - "storage-cors.json with five origins (new origins added, old + localhost kept)"
  - "old-origin source scan guard"
affects: [145-03]
tech-stack:
  added: []
  patterns: ["vi.mock('firebase-functions/params') captures defineString(name, opts)", "readdirSync-based source scan with self-test"]
key-files:
  created:
    - functions/src/params.test.ts
    - src/__tests__/storageCors.test.ts
    - src/__tests__/legacyOriginLiterals.test.ts
  modified:
    - functions/src/params.ts
    - functions/src/adminEmail.test.ts
    - functions/src/inviteOnboarding.test.ts
    - functions/src/volunteerLink.test.ts
    - functions/src/index.test.ts
    - storage-cors.json
    - functions/DEPLOY-EMAIL-DOMAIN.md
key-decisions:
  - "Link builders left untouched; trailing-slash tests pin their existing normalization contract."
  - "storage-cors.json only edited; applying it to the bucket remains an owner runbook step (145-03)."
requirements-completed: [R449, R450]
duration: ~15 min
completed: 2026-10-27
status: complete
---

# Phase 145 Plan 02: Share-link default and CORS allowlist Summary

Server share-link default moved to `https://worshipbuilder.web.app`, with test-pinned one-slash correctness for all link families, `storage-cors.json` extended to five origins, and a comment-inclusive scan guarding against old-origin URL literals.

## Tasks

| Task | Commit | Notes |
| ---- | ------ | ----- |
| 1. params default + link tests | ed249fd0 | params.test.ts (RED confirmed against old default, then GREEN), trailing-slash cases in adminEmail, inviteOnboarding (Google text + password-reset continue URL), volunteerLink, index (share link + rehearse continue URL) |
| 2. CORS + scan + doc | 8fe07f97 | storageCors.test.ts (RED confirmed, then GREEN), legacyOriginLiterals.test.ts, storage-cors.json, DEPLOY-EMAIL-DOMAIN.md |

## Fail-first proof (legacyOriginLiterals scan)

Backed up params.ts, temporarily set the default to the old `.web.app` origin: the scan test exited non-zero with `expected [ 'functions/src/params.ts' ] to deeply equal []` (plus the params-default assertion failing). Restored from backup, backup deleted (`ls` confirms gone), both new root tests green (7/7). params.ts matches HEAD (no residual diff).

## Verification

- `cd functions && npx vitest run`: 20 files / 729 tests pass; `npx tsc --noEmit` clean.
- `npm run type-check` clean; storageCors + legacyOriginLiterals + brandName: pass.
- Builders (index.ts, adminEmail.ts, inviteOnboarding.ts, volunteerLink.ts) untouched since c59dab23; `git ls-files functions/.env` empty, `git check-ignore` exit 0.
- Staging gate passed before both commits; no .planning/graphs, dist-legacy, functions/lib or functions/.env staged.
- No production writes (no deploy, gcloud, Auth or OAuth change). `.env.local` and `functions/.env` never read.

## Deviations from Plan

**1. [Rule 1 - Bug] TS2493 in new inviteOnboarding test** - the `generatePasswordResetLink` mock is typed with a no-arg impl, so `mock.calls[0]![1]` failed `tsc --noEmit`. Fixed by casting the call tuple through `unknown`. Included in commit ed249fd0.

Otherwise: plan executed as written. The new trailing-slash tests passed before the params change as the plan predicted (builders already normalize); only params.test.ts and storageCors.test.ts were RED.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

Files exist (params.test.ts, storageCors.test.ts, legacyOriginLiterals.test.ts, storage-cors.json); commits ed249fd0 and 8fe07f97 present.
