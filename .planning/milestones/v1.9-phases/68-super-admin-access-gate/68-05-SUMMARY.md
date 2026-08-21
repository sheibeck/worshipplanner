---
phase: 68-super-admin-access-gate
plan: 05
subsystem: infra
tags: [firebase-deploy, runbook, documentation, owner-handoff]

# Dependency graph
requires:
  - phase: 68-super-admin-access-gate (plan 02)
    provides: "syncSuperAdminClaim / setSuperAdminClaim Cloud Functions + bootstrapSuperAdmin.ts script"
  - phase: 68-super-admin-access-gate (plan 03)
    provides: "isSuperAdmin() claim-only Firestore rules gate on appConfig/* and superAdmins/*"
provides:
  - "functions/DEPLOY-SUPER-ADMIN.md — the single owner-run, ordered runbook for deploying firestore.rules, the two Functions, and running the bootstrap"
affects: [phase-69-app-config-contents, owner-handoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone owner-handoff runbook next to the scripts it documents (functions/DEPLOY-*.md), mirroring DEPLOY-ORG-CLAIMS.md's precedent — never buried in a plan SUMMARY"

key-files:
  created:
    - functions/DEPLOY-SUPER-ADMIN.md
  modified: []

key-decisions:
  - "Mirrored DEPLOY-ORG-CLAIMS.md's structure exactly (banner, What is being rolled out, Pre-flight, numbered Steps with What to observe/Rollback, Known limitations, If something goes wrong) for consistency across the repo's owner-handoff runbooks."
  - "Documented the rules deploy and Functions deploy as two independent steps (Step 1, Step 2) rather than one combined command, since firestore:rules and the two Functions are independently additive/safe and the plan's ordering requirement (Functions before bootstrap) only concerns Step 2 vs Step 3, not Step 1 vs Step 2."
  - "Added a 'Deferred manual verification' section cross-referencing the exact R176/R177/R179 items called out across Plans 02-04's SUMMARY.md User Setup Required / Manual UAT Deferred sections, so the owner has one place gathering all of Phase 68's outstanding UAT."

requirements-completed: [R174, R176, R178, R179]

coverage:
  - id: D1
    description: "functions/DEPLOY-SUPER-ADMIN.md exists and records the exact firestore:rules deploy, functions:syncSuperAdminClaim,setSuperAdminClaim deploy, and bootstrapSuperAdmin.js dry-run/--apply commands in the correct order (rules/Functions before bootstrap)"
    requirement: "R176"
    verification:
      - kind: other
        ref: "test -f functions/DEPLOY-SUPER-ADMIN.md && grep -q firestore:rules && grep -q functions:syncSuperAdminClaim && grep -q bootstrapSuperAdmin.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Runbook states plainly nothing in the repo runs these commands, documents the Functions-before-bootstrap ordering + the bootstrap's direct-claim-write safeguard, and the revoked-token <=1hr residual window rather than promising instantaneous cutoff"
    requirement: "R179"
    verification:
      - kind: other
        ref: "manual read-through of functions/DEPLOY-SUPER-ADMIN.md banner, Step 2, Step 3, and Known limitations #1"
        status: pass
    human_judgment: false
  - id: D3
    description: "No firebase deploy --only hosting step and no .env.local/functions/.env write instructions appear in the runbook"
    verification:
      - kind: other
        ref: "grep -qi 'deploy --only hosting' (absent) confirmed during automated verify"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-20
status: complete
---

# Phase 68 Plan 05: Owner Hand-Over Deploy + Bootstrap Runbook Summary

**`functions/DEPLOY-SUPER-ADMIN.md` — a non-executing, ordered owner runbook covering the firestore.rules deploy, the two-Function deploy, and the dry-run/`--apply` bootstrap of the first super-admin, mirroring the `DEPLOY-ORG-CLAIMS.md` precedent.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-08-20
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Created `functions/DEPLOY-SUPER-ADMIN.md`, opening with a prominent "NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE" banner referencing the v1.9 standing autonomy grant in `STATE.md`.
- Documented the exact "What is being rolled out" surface (the `superAdmin` claim, the `isSuperAdmin()` rule, the `syncSuperAdminClaim`/`setSuperAdminClaim` Functions, the `bootstrapSuperAdmin.ts` script, and the already-shipped client gate) verified against the real artifacts Plans 02-04 produced.
- Sequenced five owner-run steps in order: Pre-flight (credentials, project selection, full green test suite) → Step 1 rules deploy → Step 2 the two-Function deploy (explicitly stated as required BEFORE the bootstrap, with the direct-write safeguard explained) → Step 3 bootstrap dry-run then `--apply` → Step 4 first-login token refresh.
- Added a "Known limitations and residual risks" section covering the revoked-token ≤1hr residual window (framed as bounded, not instantaneous), grant-propagation being token-refresh-gated, and the client route guard being convenience-only (real enforcement is rules + onCall re-check).
- Added a "Deferred manual verification" section listing the exact R176/R177/R179 items already flagged as deferred across Plans 02-04's SUMMARY.md files, so the owner has one consolidated checklist for `/gsd-verify-work 68`.
- No `firebase deploy --only hosting` step; no `.env.local`/`functions/.env` write instructions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the owner hand-over deploy + bootstrap runbook** - `2a4098ad` (docs)

**Plan metadata:** commit created below (docs: complete plan)

## Files Created/Modified
- `functions/DEPLOY-SUPER-ADMIN.md` - The owner hand-over runbook: banner, rollout surface, pre-flight, 4 ordered steps (rules deploy, Functions deploy, bootstrap dry-run/--apply, token refresh), known limitations, deferred manual verification, recovery guidance

## Decisions Made
- Followed `DEPLOY-ORG-CLAIMS.md`'s exact section shape (banner → rollout summary → pre-flight → numbered steps with "What to observe"/"Rollback" → known limitations → "If something goes wrong") for consistency with the repo's existing owner-handoff runbook precedent, rather than inventing a new structure.
- Split the rules deploy and Functions deploy into two independent steps (both individually safe/additive) rather than one combined `firebase deploy` command — the plan's ordering constraint is specifically "Functions before bootstrap," not "rules and Functions must deploy together."
- Consolidated all of Phase 68's previously-scattered deferred-UAT notes (from Plans 02, 03, 04 SUMMARY.md files) into one section here, since this is the document the owner will actually be reading at hand-over time.

## Deviations from Plan
None - plan executed exactly as written. This was a documentation-only task with no code changes, no deploy, and no gcloud/firebase command execution.

## Issues Encountered
None.

## Auth Gates
None - documentation only, no deploy or CLI execution performed.

## User Setup Required
None for this plan's own execution (writing the runbook required no external service). The runbook itself hands over, to the owner, per the v1.9 deploy-discipline grant:
- `firebase deploy --only firestore:rules --project worship-planner-bc515`
- `firebase deploy --only functions:syncSuperAdminClaim,functions:setSuperAdminClaim --project worship-planner-bc515`
- `cd functions && npm run build && node lib/bootstrapSuperAdmin.js --email <owner-email>` (dry run) then `--apply`
- A first-login token refresh (sign out/in) for the newly granted account

## Next Phase Readiness
- Phase 68 (R174-R179) is now code-complete and fully documented for hand-over: claim-merge-safety foundation (Plan 01), Functions + bootstrap (Plan 02), Firestore rules gate (Plan 03), client route guard + roster UI (Plan 04), and this owner runbook (Plan 05).
- Per the v1.9 standing autonomy grant, execution STOPS here before the milestone lifecycle (audit → complete → cleanup) — the orchestrator should hand over the `/gsd-verify-work 68` list plus this runbook's deploy commands to the owner.
- No blockers. All four of this plan's targeted requirements (R174, R176, R178, R179) are satisfied by this runbook's presence and content; the underlying functional requirements themselves were already proven by unit/integration tests in Plans 01-04.

---
*Phase: 68-super-admin-access-gate*
*Completed: 2026-08-20*

## Self-Check: PASSED

- `functions/DEPLOY-SUPER-ADMIN.md` — FOUND on disk
- commit `2a4098ad` (docs) — FOUND in `git log`
