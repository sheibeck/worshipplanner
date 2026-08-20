---
phase: 67-fan-out-cron-instance-guardrails
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - render-service/DEPLOY.md
autonomous: true
requirements: [R173]
must_haves:
  truths:
    - "render-service/DEPLOY.md's canonical `gcloud run deploy pptx-render` command carries an explicit `--max-instances=3` ceiling (R173)."
    - "The same command carries an explicit, appropriate `--concurrency` value, committed in-repo so every future deploy carries the ceilings (R173)."
  artifacts:
    - render-service/DEPLOY.md
  key_links:
    - "The instance/concurrency ceilings live in the canonical deploy doc next to the Dockerfile they deploy — the single source of truth for future deploys."
    - "The executor does NOT run gcloud/docker/firebase — the deploy is STAGED for the orchestrator (if gcloud/Docker available) or owner handover."
---

<objective>
**R173** — give the Cloud Run PPTX render service (`render-service/`) an explicit instance ceiling so rendering cannot scale out without bound. The service deploys via `gcloud run deploy` (not `firebase deploy`), so the ceiling flags are captured in the render-service deploy doc and COMMITTED, ensuring every future deploy carries them.

Purpose: bound worst-case render-service cost (LibreOffice containers are memory/CPU-heavy) under a burst of PPTX imports.
Output: modified `render-service/DEPLOY.md`.

DEPLOY POLICY (v1.8 grant): the config change is committed autonomously; the actual `gcloud run deploy` (Docker build + Cloud Run) is STAGED for the orchestrator's consolidated deploy if gcloud/Docker are available, else handed to the owner with the exact command. The executor does NOT run gcloud, docker, or firebase — capture the flags in-repo only. Bounded/reversible (max-instances/concurrency only).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/67-fan-out-cron-instance-guardrails/67-CONTEXT.md
@render-service/DEPLOY.md
@render-service/Dockerfile
</context>

<tasks>

<task type="auto">
  <name>Task 1: R173 — capture explicit Cloud Run instance ceilings in DEPLOY.md</name>
  <files>render-service/DEPLOY.md</files>
  <action>
    In render-service/DEPLOY.md's canonical `gcloud run deploy pptx-render` command block (the `## The deploy command` section) and its "Every flag explained" table, set the max-instances ceiling to `--max-instances=3` (per D-R173 default, down from the current 5) and update the corresponding table row rationale to note 3 is the R173 cost ceiling.

    IMPORTANT DEVIATION — keep `--concurrency=1`; do NOT change concurrency to 4. 67-CONTEXT.md floats a `--concurrency` default of 4, but this same DEPLOY.md already documents `--concurrency=1` as load-bearing: LibreOffice's shared-profile-lock makes concurrent conversions on one instance unreliable, so parallelism must come from scaling OUT to more instances, never from raising concurrency. Making the value explicit at 1 satisfies R173 / ROADMAP SC4's requirement for an "explicit and APPROPRIATE `--concurrency` ceiling." Add a short note in DEPLOY.md recording this decision: concurrency was intentionally kept at 1 rather than the 4 suggested in 67-CONTEXT, citing the existing shared-profile-lock rationale.

    Leave the file's existing "DO NOT DEPLOY / owner-run only" banners and all other flags (region, --no-allow-unauthenticated, service account, memory, cpu, timeout, min-instances, env vars) intact. Do NOT run gcloud, docker, or firebase — the deploy is STAGED for the orchestrator's consolidated deploy (or owner handover if gcloud/Docker unavailable).
  </action>
  <verify>
    <automated>grep -q -- '--max-instances=3' render-service/DEPLOY.md && grep -q -- '--concurrency=1' render-service/DEPLOY.md</automated>
    Both greps must succeed, proving the explicit ceilings are present in the committed deploy doc. Optionally `cd render-service && npm test` as a no-regression check (39 tests pass; no code was changed).
  </verify>
  <done>DEPLOY.md's deploy command carries an explicit `--max-instances=3` and an explicit, appropriate `--concurrency=1`, with the concurrency decision noted; committed; no deploy run (STAGED for orchestrator/owner).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PPTX import burst → Cloud Run render service | uncapped out-scaling would fan out billable LibreOffice containers |
| deploy config (DEPLOY.md) → future `gcloud run deploy` | the committed flags are the only durable carrier of the ceiling |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-67-04b | Denial of Service | Cloud Run pptx-render service | medium | mitigate | R173 explicit `--max-instances=3` bounds worst-case concurrent instances; `--concurrency=1` kept (LibreOffice profile-lock) — parallelism via scale-out only, capped by max-instances |
| T-67-07 | Tampering | DEPLOY.md ceilings lost on a future deploy | low | mitigate | flags captured in the canonical committed deploy doc next to the Dockerfile so every future deploy carries them |
| T-67-SC | Tampering | npm/pip/cargo installs | low | accept | no new dependencies added this phase — package legitimacy gate not triggered |
</threat_model>

<verification>
- `grep -q -- '--max-instances=3' render-service/DEPLOY.md` and `grep -q -- '--concurrency=1' render-service/DEPLOY.md` both succeed.
- No gcloud/docker/firebase command run (STAGED); existing DO-NOT-DEPLOY banners intact.
- Optional: `cd render-service && npm test` passes (no code change → no regression).
</verification>

<success_criteria>
- R173: the render-service deploy command carries an explicit `--max-instances=3` and an explicit, appropriate `--concurrency=1`, committed in-repo.
- The concurrency deviation from 67-CONTEXT (kept at 1, not 4) is recorded in DEPLOY.md and the SUMMARY with its rationale.
- The `gcloud run deploy` itself is STAGED for the orchestrator/owner — not run by the executor.
</success_criteria>

<output>
Create `.planning/phases/67-fan-out-cron-instance-guardrails/67-02-SUMMARY.md` when done. Record the max-instances=3 ceiling, the deliberate concurrency=1 decision (and why it deviates from 67-CONTEXT's suggested 4), and that the `gcloud run deploy` is STAGED for the orchestrator/owner (exact command already in DEPLOY.md).
</output>
