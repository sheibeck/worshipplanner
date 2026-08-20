---
phase: 69-firestore-runtime-config
plan: 03
subsystem: infra
tags: [firebase-functions, deploy-runbook, documentation]

# Dependency graph
requires:
  - phase: 69-firestore-runtime-config
    provides: "functions/src/index.ts — the 7 managed functions swapped to getAppConfig() (Plan 02)"
provides:
  - "functions/DEPLOY-RUNTIME-CONFIG.md — the owner hand-over runbook for deploying the Phase 69 functions config-source swap"
affects: [70-owner-admin-console-ui, 71-cleanup-dry-run-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-executing owner-hand-over runbook mirroring functions/DEPLOY-SUPER-ADMIN.md's placement, banner, and section shape (What is being rolled out / Why safe / Pre-flight / exact command / What to observe / Rollback / Deferred manual verification)"

key-files:
  created:
    - functions/DEPLOY-RUNTIME-CONFIG.md
  modified: []

key-decisions:
  - "Documentation-only plan strictly scoped to the single file in files_modified — did not touch .planning/PENDING-VERIFICATION.md even though Phase 68's equivalent entry lives there, since this plan's frontmatter names only functions/DEPLOY-RUNTIME-CONFIG.md and the plan text explicitly points deferred items at 69-VALIDATION.md's Manual-Only table instead."

patterns-established:
  - "A phase's functions-swap runbook lives at functions/DEPLOY-<TOPIC>.md, next to the code it redeploys, never inside a plan SUMMARY — third instance of this pattern (DEPLOY-ORG-CLAIMS.md, DEPLOY-SUPER-ADMIN.md, DEPLOY-RUNTIME-CONFIG.md)."

requirements-completed: [R181]

coverage:
  - id: D1
    description: "functions/DEPLOY-RUNTIME-CONFIG.md exists, lists the 7 managed functions, carries the exact scoped firebase deploy --only functions:... command, and states the change ships built + tested + UNDEPLOYED"
    requirement: "R181"
    verification:
      - kind: other
        ref: "test -f functions/DEPLOY-RUNTIME-CONFIG.md && grep -q the-exact-scoped-command && grep -q UNDEPLOYED && grep -q RESEND_API_KEY functions/DEPLOY-RUNTIME-CONFIG.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "The note states the empty-doc deploy is behavior-neutral (R182 defaults-merge) and can/should be deployed alongside the Phase 68 functions, and records the Phase 68 rules dependency, RESEND_API_KEY-stays-secret, no-.env-writes, and R185 deploy-time-knob constraints"
    verification: []
    human_judgment: true
    rationale: "Content accuracy/tone-matching against functions/DEPLOY-SUPER-ADMIN.md is a documentation-quality judgment, not something a grep/test can assert beyond keyword presence (already covered by D1's automated check)."

# Metrics
duration: 5min
completed: 2026-08-20
status: complete
---

# Phase 69 Plan 03: Runtime-config functions deploy hand-over runbook Summary

**Wrote `functions/DEPLOY-RUNTIME-CONFIG.md` — the non-executing owner hand-over runbook with the exact scoped `firebase deploy --only functions:api,...` command for the 7 managed functions now reading `appConfig/global`.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-20T18:13:00Z (approx)
- **Completed:** 2026-08-20T18:18:07Z
- **Tasks:** 1
- **Files modified:** 1 (`functions/DEPLOY-RUNTIME-CONFIG.md`, new)

## Accomplishments

- Documented WHAT is rolled out: the config-source swap in the 7 managed functions (`api`, `cleanupExpiredMedia`, `cleanupOrphanRenders`, `cleanupOrphanBackgrounds`, `cleanupPptxSources`, `sendScheduledReminders`, `sendQueuedMessage`), each now reading `appConfig/global` via `getAppConfig()` instead of `process.env`.
- Documented WHY it is safe to deploy now: the R182 defaults-merge guarantee makes an empty/absent `appConfig/global` reproduce today's exact behavior, so the deploy is a no-op until a value is written — safe to run alongside the Phase 68 functions in the same session.
- Recorded the Phase 68 dependency: the `firestore.rules` `isSuperAdmin()` gate on `appConfig/*` should be deployed first/together, since without it no one can write to `appConfig/global` at all.
- Included the pre-flight gate list (`cd functions && npm test`, `cd functions && npm run build`, `npm run type-check`, `firebase use` confirmation) and the exact scoped deploy command, mirroring `functions/DEPLOY-SUPER-ADMIN.md`'s What to observe / Rollback structure.
- Stated the explicit v1.9-grant constraints: no `.env.local`/`functions/.env` writes, `RESEND_API_KEY` stays a functions server secret and never enters the client-readable `appConfig/global` doc, and `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES`/render-service caps (R185) remain deploy-time and untouched by this swap.
- Pointed the deferred R181 (live no-redeploy change) and R183 (real TTL staleness) manual-UAT items at `.planning/phases/69-firestore-runtime-config/69-VALIDATION.md`'s Manual-Only table, per the plan's action text, rather than duplicating them into `.planning/PENDING-VERIFICATION.md` (out of this plan's declared file scope).

## Task Commits

1. **Task 1: Write functions/DEPLOY-RUNTIME-CONFIG.md (owner deploy hand-over, non-executing)** - `5ba7d2cf` (docs)

**Plan metadata:** (this commit) `docs(69-03): complete deploy hand-over runbook plan`

## Files Created/Modified

- `functions/DEPLOY-RUNTIME-CONFIG.md` - the owner-run hand-over runbook: what's rolled out, why it's behavior-neutral, pre-flight, the exact scoped deploy command, rollback, and the secret/env-safety + deferred-manual-verification constraints.

## Decisions Made

Kept the plan strictly scoped to its single declared file (`functions/DEPLOY-RUNTIME-CONFIG.md`) rather than also touching `.planning/PENDING-VERIFICATION.md` — the plan's own action text directs deferred R181/R183 items to `69-VALIDATION.md`'s Manual-Only table, and `files_modified` in the frontmatter names only the one file. A future phase-close step (`/gsd-verify-work 69` or milestone audit) is the natural place to fold this into `PENDING-VERIFICATION.md` alongside Phase 68's precedent entry, not this plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None from this plan directly — this plan writes documentation only, no deploy/gcloud command was run. The runbook it produced (`functions/DEPLOY-RUNTIME-CONFIG.md`) hands the owner the deploy steps for a LATER, owner-run action; running it is not part of this plan's scope.

## Next Phase Readiness

- The Phase 69 functions change (Plans 01 + 02) now has its complete owner hand-over: `functions/DEPLOY-RUNTIME-CONFIG.md` gives the exact scoped deploy command, safety rationale, pre-flight gates, and rollback, alongside the Phase 68 super-admin runbook it's designed to run beside.
- Phase 70 (Owner Admin Console UI) can build its edit form against the exact `AppConfig` shape without any further deploy-runbook work — the functions side of the config engine is fully documented and hand-over-ready.
- R181's live no-redeploy behavior and R183's real TTL staleness remain deploy-dependent manual UAT items, tracked in `69-VALIDATION.md`'s Manual-Only table for `/gsd-verify-work 69`.

---
*Phase: 69-firestore-runtime-config*
*Completed: 2026-08-20*

## Self-Check: PASSED

`functions/DEPLOY-RUNTIME-CONFIG.md` exists on disk. Task commit `5ba7d2cf` verified present in git log.
