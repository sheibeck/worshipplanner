---
phase: 67-fan-out-cron-instance-guardrails
plan: 02
subsystem: infra
tags: [cloud-run, gcloud, render-service, cost-guardrail, libreoffice]

# Dependency graph
requires:
  - phase: 37
    provides: render-service Cloud Run deploy doc (render-service/DEPLOY.md), pptx-render service, Dockerfile
provides:
  - "render-service/DEPLOY.md's canonical gcloud run deploy command carries an explicit --max-instances=3 ceiling (R173)"
  - "Explicit, documented --concurrency=1 decision (deliberately not raised to 4, with rationale recorded in-repo)"
affects: [67-01, deploy-orchestration, cost-guardrails]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Deploy ceilings captured as committed doc text next to the Dockerfile, not as runtime config, since the service deploys via gcloud run deploy rather than firebase deploy"]

key-files:
  created: []
  modified: [render-service/DEPLOY.md]

key-decisions:
  - "--max-instances tightened from the prior unvalidated starting cap of 5 to an explicit R173 cost ceiling of 3."
  - "--concurrency kept at 1, NOT raised to the 4 floated in 67-CONTEXT.md — LibreOffice's shared-profile-lock makes concurrent conversions on one instance unreliable; parallelism under burst load comes from scaling OUT (bounded by max-instances=3), never from raising concurrency."
  - "No gcloud/docker/firebase command was run. The gcloud run deploy command (with both ceiling flags now baked in) is STAGED in render-service/DEPLOY.md for the orchestrator's consolidated deploy, or owner handover if gcloud/Docker are unavailable."

requirements-completed: [R173]

coverage:
  - id: D1
    description: "render-service/DEPLOY.md's gcloud run deploy pptx-render command carries an explicit --max-instances=3 ceiling"
    requirement: "R173"
    verification:
      - kind: other
        ref: "grep -q -- '--max-instances=3' render-service/DEPLOY.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same command carries an explicit, appropriate --concurrency=1 value, with the deviation from 67-CONTEXT's suggested 4 recorded and justified in-repo"
    requirement: "R173"
    verification:
      - kind: other
        ref: "grep -q -- '--concurrency=1' render-service/DEPLOY.md"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-20
status: complete
---

# Phase 67 Plan 02: Render-service instance cap Summary

**Pinned Cloud Run `pptx-render`'s `--max-instances` at an explicit R173 ceiling of 3 and kept `--concurrency=1` deliberately (not the 4 floated in 67-CONTEXT), with the rationale committed in render-service/DEPLOY.md.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-20T07:27:00Z
- **Completed:** 2026-08-20T07:33:29Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments
- `render-service/DEPLOY.md`'s canonical `gcloud run deploy pptx-render` command now sets `--max-instances=3` (was `5`, an unvalidated starting cap) — the explicit R173/ROADMAP SC4 cost ceiling bounding worst-case billable LibreOffice containers under a burst of PPTX imports.
- The "Every flag explained" table row for `--max-instances` was updated to cite the R173 rationale, and a matching update was made to the "Real cost and latency" post-deploy-verification note that previously referenced the old `=5` value.
- Added a dedicated callout directly above the deploy command block recording the R173 decision to keep `--concurrency=1` rather than raise it to the `4` suggested in 67-CONTEXT.md, and updated the flag table's `--concurrency` row to flag the same deviation inline.
- No `gcloud`, `docker`, or `firebase` command was executed — the updated deploy command (both ceilings baked in) remains STAGED in DEPLOY.md for the orchestrator's consolidated deploy or owner handover.

## Task Commits

Each task was committed atomically:

1. **Task 1: R173 — capture explicit Cloud Run instance ceilings in DEPLOY.md** - `6b12c6ab` (feat)

**Plan metadata:** pending (this SUMMARY + STATE.md/ROADMAP.md commit follows)

## Files Created/Modified
- `render-service/DEPLOY.md` - Set `--max-instances=3` in the canonical deploy command; updated its flag-table rationale row and the later "Real cost and latency" reference; added an explicit `--concurrency=1` decision callout and updated the flag-table row to record the deviation from 67-CONTEXT's floated `--concurrency=4`.

## Decisions Made
- **Concurrency stays at 1, not 4.** 67-CONTEXT.md's D-R173 suggested `--concurrency=4` as a default alongside `--max-instances=3`. This plan's explicit deviation instruction overrides that: DEPLOY.md already documented `--concurrency=1` as load-bearing (LibreOffice's per-profile lock file makes concurrent `soffice --headless` conversions on one instance unreliable). Raising concurrency risks silent render corruption under burst load. Parallelism instead comes entirely from horizontal scale-out, now capped at 3 instances. This satisfies R173/SC4's requirement for an "explicit and appropriate `--concurrency` ceiling" — appropriateness here means confirming the existing value of 1, not increasing it.
- **max-instances tightened to 3, not just made explicit.** The prior value (5) was already an explicit flag in the command, but it was an unvalidated starting guess per the flag table's own prior annotation. R173's cost-ceiling intent (per 67-CONTEXT D-R173) calls for a tighter default; 3 was applied per the plan's explicit instruction ("per D-R173 default, down from the current 5").

## Deviations from Plan

None — the plan explicitly called for the concurrency=1 deviation from 67-CONTEXT.md's floated value of 4, and that deviation was implemented and documented exactly as directed. No other deviations occurred.

## Issues Encountered
None.

## User Setup Required

None — no external service configuration required. The deploy itself remains staged; see "Deploy — STAGED, not run" below for the exact command the orchestrator/owner should run when ready.

## Deploy — STAGED, not run

The executor did not run `gcloud`, `docker`, or `firebase`. The full, corrected deploy command (with both R173 ceilings now baked in) already lives in `render-service/DEPLOY.md` under `## The deploy command`:

```bash
gcloud run deploy pptx-render \
  --source=./render-service \
  --region=us-central1 \
  --no-allow-unauthenticated \
  --service-account=pptx-render-sa@PROJECT_ID.iam.gserviceaccount.com \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars=STORAGE_BUCKET=PROJECT_ID.firebasestorage.app \
  --project=PROJECT_ID
```

`PROJECT_ID` must still be substituted throughout (per the file's existing prerequisites/IAM steps), and the file's "NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE" banner remains intact and unchanged — this is owner/orchestrator-run only, same as every prior deploy in this repo's history.

## Next Phase Readiness
- R173's DEPLOY.md-side requirement is fully satisfied: both ceilings are explicit, committed, and self-documented with rationale, so any future deploy that follows this file automatically carries them.
- No code changes were made in this plan (`render-service/src/**` untouched); `cd render-service && npm test` was run as the optional no-regression check — 39/39 tests pass (3 test files), confirming nothing in the render pipeline itself was affected.
- Ready for the orchestrator's consolidated deploy step (or owner handover) to actually apply the `gcloud run deploy` command captured above, whenever that is scheduled for this phase.

---
*Phase: 67-fan-out-cron-instance-guardrails*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: render-service/DEPLOY.md
- FOUND: 6b12c6ab
