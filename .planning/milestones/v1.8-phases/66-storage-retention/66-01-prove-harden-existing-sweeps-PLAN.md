---
phase: 66-storage-retention
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - functions/src/index.ts
  - functions/src/index.test.ts
autonomous: true
requirements: [R165, R166]
user_setup:
  - service: firebase-functions-runtime-env
    why: "First LIVE deletion of real Storage objects is owner-gated (v1.8 grant). The executor ships every enable flag OFF; the owner flips it and redeploys."
    env_vars:
      - name: MEDIA_CLEANUP_ENABLED
        source: "OWNER STEP ONLY — add `MEDIA_CLEANUP_ENABLED=true` to functions/.env, then `firebase deploy --only functions:cleanupExpiredMedia`. Do NOT run in this plan."
      - name: PPTX_RENDER_CLEANUP_ENABLED
        source: "OWNER STEP ONLY — add `PPTX_RENDER_CLEANUP_ENABLED=true` to functions/.env, then `firebase deploy --only functions:cleanupOrphanRenders`. Do NOT run in this plan."

must_haves:
  truths:
    - "With MEDIA_CLEANUP_ENABLED=\"true\", a media object under orgs/{orgId}/media/ older than RETENTION_DAYS is actually deleted (file.delete() invoked), proven by test (R165)."
    - "With PPTX_RENDER_CLEANUP_ENABLED=\"true\", a stale pending/failed rendered/ object is actually deleted, proven by test (R166)."
    - "With each flag unset or any value other than the exact string true, the run deletes nothing (dry-run) — the fail-safe gate direction is preserved."
    - "Each run reports the object count AND byte total it deleted/would-delete, and a per-run delete cap bounds how many objects a single LIVE run can delete."
  artifacts:
    - functions/src/index.ts
    - functions/src/index.test.ts
  key_links:
    - "The env-gate direction `process.env.<FLAG> !== \"true\" => dryRun` stays intact (regression guard against the 2026-07-28 inverted-gate incident 9f1b881)."
    - "MEDIA_PATH_GUARD and RENDERED_OBJECT_GUARD still bound each sweep to its own prefix before any delete decision."
    - "readDeleteCap() shared helper introduced here is reused by the new sweeps in 66-02."
---

<objective>
Prove — by test, against mocked Storage/Firestore — that the two EXISTING dry-run sweeps actually delete the right objects when their enable flag equals the exact string `true`, and harden them with two observability/safety additions the v1.8 owner-gated first-deletion needs: a per-run delete cap (bounds blast radius on the first LIVE enablement) and a deleted-bytes total in each run summary (so the owner can see what a run removed).

This plan writes ZERO new crons. It modifies `cleanupExpiredMediaHandler` (R165) and `cleanupOrphanRendersHandler` (R166) in place, keeps both DRY-RUN BY DEFAULT, and hands the owner the exact enable/redeploy commands. No `firebase deploy` and no live deletion happen here.

Purpose: R165/R166 require the delete branch be proven deletion-capable and the production enable be handed over as the owner's gated first-deletion deploy. The hardening (delete cap + bytes log) is the safety net that makes that first LIVE run bounded and observable.
Output: hardened + fully-tested `cleanupExpiredMediaHandler` and `cleanupOrphanRendersHandler`; a shared `readDeleteCap()` helper reused by 66-02; owner enablement commands recorded in SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/66-storage-retention/66-CONTEXT.md

# The two sweeps to harden (templates + safety contract comments live here):
#   cleanupExpiredMediaHandler   ~functions/src/index.ts:931-987   (RETENTION_DAYS=14, MEDIA_PATH_GUARD, MEDIA_CLEANUP_ENABLED)
#   cleanupOrphanRendersHandler  ~functions/src/index.ts:1053-1141 (ORPHAN_RENDER_STALE_HOURS=24, RENDERED_OBJECT_GUARD, PPTX_RENDER_CLEANUP_ENABLED)
@functions/src/index.ts

# Existing cleanup-cron test patterns to MIRROR (do not rewrite; extend):
#   describe("cleanupExpiredMediaHandler")  ~functions/src/index.test.ts:169-296 (mockBucket, fakeFile, daysAgoIso)
#   describe("cleanupOrphanRendersHandler") ~functions/src/index.test.ts:768-1013 (mockOrphanDb, fakeOrphanDoc, mockOrphanBucket, ★ SOURCE INSPECTION gate-direction test)
@functions/src/index.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Harden and prove cleanupExpiredMediaHandler — delete cap + deleted-bytes + delete-branch proof (R165)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    Against mocked Storage (mirror mockBucket/fakeFile at index.test.ts:132-152):
    - ENABLED delete-branch (R165): MEDIA_CLEANUP_ENABLED="true" + one aged orgs/{orgId}/media/ file older than RETENTION_DAYS => file.delete() called exactly once; summary.dryRun=false, deletedCount=1.
    - Deletes EXACTLY the guarded+aged set: given an aged media file, an aged pptx-imports file, and a recent media file, only the aged media file's delete() is called.
    - deletedBytes observability: a deleted file whose metadata.size is a known byte count is reflected in summary.deletedBytes; dry-run reports the same would-delete byte total.
    - Per-run delete cap: with STORAGE_CLEANUP_MAX_DELETES_PER_RUN="1", two aged media files, flag enabled => exactly one delete() call; summary.cappedByLimit=true and deletedCount=1. The uncapped-in-dry-run count is unaffected (dry-run still reports the full would-delete count).
    - FAIL-SAFE preserved: flag unset, "", "false", "1", "True" each leave dryRun=true and call no delete() (extend, do not remove, the existing fail-safe cases).
  </behavior>
  <action>
    In `functions/src/index.ts`, add a shared helper `readDeleteCap(): number` near the cleanup constants: it reads `process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN`, parses a positive integer, and returns it, else returns a bounded default of 500. Reuse the existing `readNumericKnob` style at index.ts:235 if a parser already fits; otherwise keep this helper small and pure (exported so it is unit-testable and reusable by 66-02).

    Extend the `CleanupSummary` interface with `deletedBytes: number` and `cappedByLimit: boolean`. In `cleanupExpiredMediaHandler`, keep the gate line `const dryRun = process.env.MEDIA_CLEANUP_ENABLED !== "true";` and `MEDIA_PATH_GUARD` EXACTLY as-is (this direction is the 9f1b881 regression guard). For each guarded+aged candidate: read `Number(file.metadata?.size ?? 0)` and, when it is counted toward deletion (in dry-run) or actually deleted (live), add it to a running `deletedBytes`. In LIVE mode, before issuing `file.delete()`, stop deleting once `deletedCount` has reached `readDeleteCap()` — set `cappedByLimit = true` and break the loop (the next daily run resumes, idempotent-by-age). Dry-run must NOT be capped: it reports the full would-delete count and bytes so the owner sees the true backlog before the first LIVE run. Include `deletedBytes` and `cappedByLimit` in the `console.log` summary line.

    Do NOT change RETENTION_DAYS, the `prefix: "orgs/"` getFiles scope, the NaN-timeCreated skip, or the per-file try/catch. This handler must still import NO Firestore API.

    In `functions/src/index.test.ts`, extend the `fakeFile` factory to accept an optional byte size on `metadata.size` (default any fixed value), then add the behavior cases above to the existing `describe("cleanupExpiredMediaHandler")` block. Keep every existing test passing.
  </action>
  <verify>
    <automated>cd functions && npm test -- --run src/index.test.ts</automated>
  </verify>
  <done>The enabled delete branch is proven to delete exactly the guarded+aged media set; deletedBytes and cappedByLimit are reported; the per-run cap bounds a LIVE run; every prior fail-safe (unset/""/"false"/"1"/"True" => dry-run) still passes; `cd functions && npm run build` is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Harden and prove cleanupOrphanRendersHandler — delete cap + deleted-bytes + delete-branch proof (R166)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    Against the mocked Firestore collectionGroup + Storage (mirror mockOrphanDb/fakeOrphanDoc/mockOrphanBucket at index.test.ts:800-839):
    - ENABLED delete-branch (R166): PPTX_RENDER_CLEANUP_ENABLED="true" + a stale failed doc with two rendered/ objects => both objects and the render doc are deleted; summary.dryRun=false, deletedDocCount=1, deletedObjectCount=2.
    - deletedBytes observability: rendered objects carrying known metadata.size are summed into summary.deletedBytes.
    - Per-run delete cap: with STORAGE_CLEANUP_MAX_DELETES_PER_RUN="1", a stale doc with two rendered/ objects, flag enabled => exactly one object delete() call and summary.cappedByLimit=true; the run does not exceed the cap even within a single doc.
    - FAIL-SAFE + structural guarantees preserved: a "ready" doc is never scanned (status filter), a fresh pending render is skipped, source.pptx/images/ are never deleted (RENDERED_OBJECT_GUARD), and unset/""/"false"/"1"/"True" all remain dry-run.
  </behavior>
  <action>
    Extend the `OrphanCleanupSummary` interface with `deletedBytes: number` and `cappedByLimit: boolean`. In `cleanupOrphanRendersHandler`, keep the gate line `const dryRun = process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true";`, the `.where("status", "in", ["pending", "failed"])` filter, the parent-chain orgId recovery, the `RENDERED_OBJECT_GUARD` filter, the NaN-createdAt skip, and every per-object/per-doc try/catch EXACTLY as-is. Sum `Number(file.metadata?.size ?? 0)` into `deletedBytes` for each rendered object counted (dry-run) or deleted (live). Apply the SAME `readDeleteCap()` from Task 1 to bound the TOTAL number of object deletes across the whole run (accumulate against a single run-level counter, not per-doc): once the run's object-delete count reaches the cap, set `cappedByLimit = true` and stop issuing further object deletes (and stop deleting docs whose objects were not fully cleared, so a doc is only removed after its rendered objects are). Include the two new fields in the summary `console.log`.

    Preserve the existing `★ SOURCE INSPECTION` gate-direction test (index.test.ts:1004) unchanged. In `functions/src/index.test.ts`, extend `fakeRenderedObject` to carry an optional metadata.size, then add the behavior cases to the existing `describe("cleanupOrphanRendersHandler")` block. Keep every existing test passing.
  </action>
  <verify>
    <automated>cd functions && npm test -- --run src/index.test.ts</automated>
  </verify>
  <done>The enabled delete branch is proven to delete both the stale rendered objects and the render doc; deletedBytes and cappedByLimit are reported; the shared per-run cap bounds a LIVE run; the ready/fresh/guard/fail-safe guarantees all still pass; `cd functions && npm run build` is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| scheduled cron -> Cloud Storage | A daily onSchedule job issues object deletes; a gate/guard/cap bug is the only thing between it and mass data loss. |
| runtime env (functions/.env) -> handler behavior | The `*_CLEANUP_ENABLED` string flips a run from dry-run to real deletion; owner-controlled, never client-controlled. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-66-01-01 | Tampering | cleanupExpiredMediaHandler / cleanupOrphanRendersHandler gate | critical | mitigate | Keep the exact `process.env.<FLAG> !== "true"` fail-safe direction; regression-tested by the ★ SOURCE INSPECTION test and the unset/""/"false"/"1"/"True" dry-run cases. Default ships OFF. |
| T-66-01-02 | Denial of Service | first LIVE enablement on a large backlog | high | mitigate | `readDeleteCap()` bounds objects deleted per run (default 500); a single first LIVE run cannot fan out unbounded deletes/cost; idempotent-by-age means the backlog drains over subsequent runs. |
| T-66-01-03 | Elevation of scope | path guard bypass (deleting outside media/ or rendered/) | high | mitigate | MEDIA_PATH_GUARD and RENDERED_OBJECT_GUARD are applied BEFORE any delete decision and are left unchanged; tests prove pptx-imports/source.pptx/images survive even when aged + enabled. |
| T-66-01-04 | Repudiation | no record of what a run removed | low | mitigate | deletedCount + deletedBytes + cappedByLimit added to the summary log for post-run observability. |
| T-66-01-SC | Tampering | npm/pip/cargo installs | low | accept | No new package installs are introduced by this plan; nothing to audit. |
</threat_model>

<verification>
- `cd functions && npm test` passes (the app suite for functions), including every pre-existing cleanup test plus the new delete-branch, cap, and bytes cases.
- `cd functions && npm run build` is clean (tsc).
- The gate direction `!== "true"` is unchanged for both handlers (the ★ SOURCE INSPECTION test still passes).
- No `firebase deploy` was run; no live object was deleted; `functions/.env` was NOT written.
</verification>

<success_criteria>
- R165: a test proves `cleanupExpiredMediaHandler` deletes an aged `orgs/{orgId}/media/` object when `MEDIA_CLEANUP_ENABLED="true"`, and default runs stay dry-run.
- R166: a test proves `cleanupOrphanRendersHandler` deletes a stale pending/failed rendered object + its doc when `PPTX_RENDER_CLEANUP_ENABLED="true"`, and default runs stay dry-run.
- Both summaries report `deletedBytes` and `cappedByLimit`; a per-run delete cap bounds a LIVE run.
- No success criterion depends on real production deletion — all are proven against mocked Storage/Firestore.
</success_criteria>

<deploy>
## STAGED for orchestrator (dry-run functions) — autonomous per the v1.8 grant
The hardened `cleanupExpiredMedia` and `cleanupOrphanRenders` functions still delete NOTHING by default (flags OFF). Redeploying them in dry-run mode is bounded/reversible and may be included in the orchestrator's consolidated `firebase deploy --only functions:cleanupExpiredMedia,functions:cleanupOrphanRenders` at milestone end. THE EXECUTOR MUST NOT RUN `firebase deploy`.

## OWNER-GATED (hand over, UNDEPLOYED, do NOT run) — the first LIVE deletion
Record verbatim in SUMMARY; do not execute and do not write functions/.env:
1. Media: add `MEDIA_CLEANUP_ENABLED=true` to `functions/.env`, then `firebase deploy --only functions:cleanupExpiredMedia`.
2. Orphan renders: add `PPTX_RENDER_CLEANUP_ENABLED=true` to `functions/.env`, then `firebase deploy --only functions:cleanupOrphanRenders`.
3. (Optional) tune the blast radius of the first LIVE run with `STORAGE_CLEANUP_MAX_DELETES_PER_RUN=<n>` in `functions/.env` (default 500). Review a dry-run's logged count/bytes BEFORE enabling.
</deploy>

<output>
Create `.planning/phases/66-storage-retention/66-01-SUMMARY.md` when done — include the OWNER-GATED enablement commands above verbatim under a "Handover" heading.
</output>
