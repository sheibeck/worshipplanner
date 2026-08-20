# Phase 66: Storage Retention - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — grey areas resolved with stated defaults per the v1.8 grant)

<domain>
## Phase Boundary

Give every unbounded Storage path a bounded, tested retention path. Four requirements:
- **R165** — prove `cleanupExpiredMedia` (`functions/src/index.ts` ~658, gated `MEDIA_CLEANUP_ENABLED !== "true"`, RETENTION_DAYS=14, path guard `/^orgs\/[^/]+\/media\//`) actually DELETES past-window media when enabled (not just dry-run-logs). Enabling it in prod is the owner's gated first-deletion deploy.
- **R166** — same for `cleanupOrphanRenders` (~812, gated `PPTX_RENDER_CLEANUP_ENABLED`, deletes stale pending/failed `rendered/` objects). Prod enable owner-gated.
- **R167** — NEW pruning path for background images (`orgs/{orgId}/backgrounds/{backgroundId}/…`, `useBackgroundUpload.ts:103`) — never pruned today, structurally exempt from the media sweep. Built + tested + UNDEPLOYED.
- **R168** — NEW retention for PPTX import SOURCES (source `.pptx` + extracted `images/` under `orgs/{orgId}/pptx-imports/{importId}/…`) — never pruned today (only `rendered/` orphans are). Built + tested + UNDEPLOYED.

Out of scope: an in-app storage-usage dashboard (deferred R169); changing what media/backgrounds/pptx ARE or how they're uploaded; per-org storage quotas at upload time.
</domain>

<decisions>
## Implementation Decisions

### Safety model — mirror the existing sweep conventions (all four)
- **Every deletion path is DRY-RUN BY DEFAULT**, gated by an env flag that must equal the exact string `"true"` — same pattern as `MEDIA_CLEANUP_ENABLED`/`PPTX_RENDER_CLEANUP_ENABLED` (index.ts:610). New flags: `BACKGROUND_CLEANUP_ENABLED`, `PPTX_SOURCE_CLEANUP_ENABLED`. **Do NOT flip any default to delete-by-default** — flipping the default IS the data-loss the grant reserves for the owner.
- **Every new sweep carries a path guard regex** (like `MEDIA_PATH_GUARD`) so it can only ever delete under its intended prefix — a guard bug can never reach another path.
- **Age-gate everything** so an in-flight upload is never racing a delete: an object is eligible only if older than its retention window.

### R167 — Background pruning: ORPHAN + age, never pure age
- Delete a background ONLY when it is **unreferenced** by any live entity AND older than `BACKGROUND_RETENTION_DAYS` (default 30). **Pure age-based deletion is rejected** — a 60-day-old background still set on an active song/service must never vanish mid-service.
- "Unreferenced" = not pointed to by any service slide-group / slide / song background field. The planner MUST map the real reference model (where a background id/url is stored — per-group, per-slide, per-song, per the v1.4 R033/R070 background work) and only delete a background no live document references. This is the phase's **riskiest requirement** — if reliable reference detection is infeasible against the schema, fall back to the most conservative safe subset (e.g. only backgrounds under a deleted org/service), and DISCLOSE the narrowed scope rather than risk deleting a referenced background.
- Structure it as a new `cleanupOrphanBackgrounds` onSchedule cron mirroring `cleanupOrphanRenders` (orphan + stale-window + env-gate + path-guard).

### R168 — PPTX source retention: prune CONSUMED sources, keep the rendered display artifacts
- Delete the source `.pptx` + extracted `images/` for an import ONCE it is **consumed** (its render doc is complete/ready) AND older than `PPTX_SOURCE_RETENTION_DAYS` (default 30). **Keep `rendered/`** — those PNGs are what the app displays; only the heavy source deck + intermediate images are pruned.
- Also cover orphaned/failed imports' SOURCES (the existing `cleanupOrphanRenders` prunes their `rendered/` but never the source) — either extend that cron or add a sibling. Planner's call; keep the guards separate per path.
- Re-import re-uploads the source, so pruning a consumed source after the window is non-destructive to the user's ability to re-render.

### R165 / R166 — Prove-then-hand-over (do NOT force-enable)
- These sweeps already exist, dry-run-gated. This phase's CODE work: **tests that prove the delete branch actually deletes the right objects** when the flag is `"true"` (against mocked Storage), plus any hardening (e.g. a per-run delete cap + a summary log of count/bytes for observability). Keep the default dry-run.
- Enabling in prod = the owner sets `MEDIA_CLEANUP_ENABLED=true` / `PPTX_RENDER_CLEANUP_ENABLED=true` in the functions env and redeploys — that is the gated first-deletion deploy, handed over. Record the exact steps in SUMMARY.

### Deploy classification (per the v1.8 grant)
- **Autonomous-deployable:** deploying the new/updated cron FUNCTIONS in **dry-run mode** (they delete nothing — bounded, reversible, no data loss). The orchestrator may include these in its consolidated `firebase deploy --only functions:…` at milestone end.
- **OWNER-GATED (hand over, do NOT run):** any step that ACTUALLY DELETES existing objects — i.e. setting ANY `*_CLEANUP_ENABLED=true` (media, orphan-render, background, pptx-source) and the redeploy that activates real deletion. Ship every enable-flag OFF; hand the owner the exact env-var + deploy commands. No success criterion may depend on real deletion being live in prod — each is proven by tests against mocked Storage.
- **DO NOT write `.env` / `functions/.env`** — the enable flags are handed over as owner steps, not written.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns to mirror
- `cleanupExpiredMedia` (~index.ts:607-660) and `cleanupOrphanRenders` (~index.ts:724-813) are the canonical templates: `onSchedule` daily (staggered 02:00 / 03:00 UTC), env-gate `!== "true"` → dry-run, path-guard regex, age/stale window, list-under-prefix + filter + delete. New sweeps copy this shape (new time slots to stay staggered).
- `MEDIA_PATH_GUARD` (~index.ts:594) and `RENDERED_OBJECT_GUARD` (~index.ts:715) — copy the guard idiom for `backgrounds/` and `pptx-imports/{id}/(source|images)`.
- Admin SDK `getFirestore()` + Storage `getStorage().bucket()` already used by these crons — reuse for reference lookups (backgrounds) and render-doc status reads (pptx sources).
- Upload paths for reference: backgrounds `useBackgroundUpload.ts:103`; media `useMediaUpload.ts:85`; pptx import path contract `src/types/importedDeck.ts:22`.
- Render doc collection: `pptxRenders` (scanned by `cleanupOrphanRenders`) — the source of "is this import consumed/complete?".

### Established test patterns
- `functions/src/index.test.ts` already has cleanup-cron tests (e.g. the `MEDIA_CLEANUP_ENABLED` dry-run/enabled regression tests ~lines 178-233) mocking Storage `bucket().getFiles()`/`file().delete()` and Firestore. Mirror them: prove dry-run deletes nothing, enabled deletes exactly the guarded+aged+orphaned set, and NEVER deletes a referenced/too-new object.
- Gates: `cd functions && npm test`, `cd functions && npm run build`.

### Integration Points
- New crons live in `functions/src/index.ts` alongside the existing sweeps; export as `onSchedule` functions (they get their own deploy targets).
</code_context>

<specifics>
## Specific Ideas

- The four requirements split cleanly: R165/R166 are "prove + hand over enablement" (little/no new runtime code beyond tests + optional safety cap); R167/R168 are "build a new sweep" (real new code, orphan/consumed detection is the substance). A plan split along that line (verify-existing vs build-new) is reasonable.
- Reference detection for R167 is the crux — budget the research/pattern pass on the background reference model there. When uncertain, prefer NOT deleting (leave the object) over risking deletion of a referenced background.
</specifics>

<deferred>
## Deferred Ideas

- In-app per-org storage-usage visibility (deferred **R169**).
- Upload-time per-org storage quota / hard cap — this phase bounds growth via retention, not admission control.
- Lifecycle rules configured at the GCS bucket level (console) instead of app crons — the app-cron approach keeps the orphan/reference logic in code where it can be tested; bucket lifecycle is age-only and can't do reference-aware deletion.
</deferred>
