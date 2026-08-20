# Phase 67: Fan-out, Cron & Instance Guardrails - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — grey areas resolved with stated defaults per the v1.8 grant)

<domain>
## Phase Boundary

Close the remaining unbounded cost surfaces, all bounded/reversible config (no data deletion, no user
lockout) → **autonomous-deployable per the v1.8 grant; this is the phase that actually cuts the bill**:
- **R170** — the daily `sendScheduledReminders` cron (`functions/src/index.ts` ~1025) runs two unbounded
  cross-org `collectionGroup` scans (services ~889, messages ~1109) with no early gate. Reminders are
  **not in production use** (owner) → stop the daily read cost.
- **R171** — the Resend send loop (`sendQueuedMessageHandler` ~1782) sends one email per reachable
  recipient with no cap → add a volume cap.
- **R172** — no function has a `maxInstances`/concurrency ceiling (`firebase.json` has no global options)
  → add a project-wide `setGlobalOptions` ceiling covering at least `api` + `messageWebhook`.
- **R173** — the Cloud Run render service (`render-service/`) has no `--max-instances`/`--concurrency`
  → add explicit ceilings.

Out of scope: `messageWebhook` rate-limiting (already HMAC-gated, out per REQUIREMENTS); re-enabling
reminders behind a smarter query (future); GCP billing budget/alert (owner console action).
</domain>

<decisions>
## Implementation Decisions

### R170 — Gate the whole `sendScheduledReminders` cron OFF by default (not delete the code)
- Add a global env gate `SCHEDULED_MESSAGING_CRON_ENABLED` (default **false**, `!== "true"` idiom) so the
  scheduled function **early-returns before ANY collection-group scan** — killing the daily read cost of
  BOTH the reminder sweep and the scheduled-dispatch sweep. Reversible: flip the flag + redeploy to
  restore.
- **DISCLOSED behavior change (important):** that cron also runs the composer's "schedule-for-later"
  dispatch (`dispatchDueScheduledMessages`, status:'scheduled' → send). Gating the whole function OFF
  means **scheduled-for-later messages won't dispatch until the flag is enabled.** This is the reasonable
  default because (a) the owner explicitly wants the daily cross-org scan gone, (b) reminders are unused,
  and (c) it's fully reversible. Record prominently in SUMMARY/handover: "to use reminders OR
  schedule-for-later, set `SCHEDULED_MESSAGING_CRON_ENABLED=true` and redeploy." If the planner finds
  scheduled-send is cheaply separable and worth keeping live, it MAY instead gate only the expensive
  reminder (planned/exported services) sweep and keep the tiny status=='scheduled' dispatch — but the
  simplest, lowest-cost default is gate-the-whole-function-off. State whichever it chooses.
- Deploy: gating a cron is bounded/reversible/no-data-loss → **AUTONOMOUS** deploy of
  `functions:sendScheduledReminders`. This is real immediate bill relief.

### R171 — Resend volume cap: reject-over-generous-cap + per-org daily quota
- **Per-message recipient cap** `MESSAGE_MAX_RECIPIENTS` default **200**: if a queued message resolves to
  more recipients than the cap, **REJECT the send with a clear error** (mark the message failed with a
  reason) rather than silently truncating — a 200+ recipient worship-team message is almost certainly a
  bug/abuse, and silent truncation is worse than a visible failure. Cap is generous so legit sends never
  hit it.
- **Per-org daily send quota** `ORG_MAX_EMAILS_PER_DAY` default **1000**: a Firestore counter (Admin SDK,
  fixed daily window) checked before the send loop; over-quota sends are skipped/failed with a logged
  reason. Backstop against a loop/cron fan-out. (Admin-SDK counter → no firestore.rules change.)
- Both env-configurable. Applied in `sendQueuedMessageHandler` before/around the `for (const target of
  sendList)` loop. Deploy `functions:sendQueuedMessage` — **AUTONOMOUS**.

### R172 — Project-wide `setGlobalOptions({ maxInstances })`
- Add `setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES })` (default **20**, env-overridable) once at
  the top of `functions/src/index.ts` so every function inherits a ceiling. `api`'s own tighter
  `maxInstances` (Phase 65, default 10) **overrides** the global for that function — keep it. This
  satisfies "covers at least `api` + `messageWebhook`": `messageWebhook` inherits the global 20; `api`
  keeps 10. Verify no per-function setting is clobbered.
- Deploy: instance caps are **AUTONOMOUS**. `setGlobalOptions` affects all functions, so activating it is
  a broad `firebase deploy --only functions` (metadata-only ceiling, no logic change to other functions)
  — the orchestrator runs it as part of the consolidated deploy, carefully.

### R173 — Cloud Run render-service ceilings
- Set explicit `--max-instances` (default **3**) and `--concurrency` (default **4**) for the
  `render-service` Cloud Run deployment. Since it deploys via `gcloud run deploy` (not `firebase deploy`),
  encode the flags in the render-service **deploy config/docs** (`render-service/DEPLOY.md` and any deploy
  script / `service.yaml` the planner finds) so every future deploy carries them, and COMMIT that.
- Deploy nuance: the actual `gcloud run deploy` (Docker build + Cloud Run) is heavier and may exceed this
  environment's tooling. Classify: the **config change is committed (autonomous)**; the **`gcloud run
  deploy` is attempted in the consolidated deploy step if gcloud/Docker are available, else handed to the
  owner** with the exact command. Either way the ceiling flags are captured in-repo so they can't be lost.
  (Bounded/reversible per the grant — max-instances/concurrency only.)

### Deploy classification summary (per the v1.8 grant)
Everything in this phase is bounded/reversible (no data deletion, no lockout) → **AUTONOMOUS**. The
orchestrator runs the consolidated deploy at milestone end:
`firebase deploy --only functions:sendScheduledReminders,functions:sendQueuedMessage` for R170/R171, a
broader `firebase deploy --only functions` for R172's global options, and the render-service `gcloud run
deploy` for R173 (or hand it over if tooling is unavailable). **DO NOT write `.env`/`functions/.env`** —
the new env knobs have safe code defaults; record their names for owner tuning.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns
- Env-gate idiom `process.env.X !== "true"` (index.ts:610) — reuse for `SCHEDULED_MESSAGING_CRON_ENABLED`.
- `sendScheduledReminders` onSchedule handler (~index.ts:1025) runs `sendScheduledRemindersHandler`
  (~879, the planned/exported services scan) + `dispatchDueScheduledMessagesHandler` (~1100, the
  status=='scheduled' scan) — the early-return gate goes at the top of the scheduled entry.
- `sendQueuedMessageHandler` (~index.ts:1782) — the `for (const target of sendList)` loop (~1782) is where
  the recipient cap + org quota check wrap; `sendList` is built ~1752-1766.
- Phase 65 added `readNumericKnob()` / `readAiProxyLimits()` env-reading helpers + an Admin-SDK
  counter/ledger pattern (`aiRateLimits`) — reuse the numeric-knob reader and the fixed-window counter
  idiom for the per-org daily email quota.
- `firebase-functions/v2` `setGlobalOptions` is the standard API for the project-wide ceiling; there is no
  existing call today (grep-confirmed) so it's a clean add at module top.
- Render service: `render-service/DEPLOY.md`, `render-service/Dockerfile` (only `EXPOSE 8080`/`CMD`), and
  `render-service/src/server.ts` (no rate limiting; platform IAM auth) — the deploy flags live at deploy
  time, so DEPLOY.md + any deploy script is where `--max-instances`/`--concurrency` are captured.

### Established test patterns
- Functions cron/handler tests in `functions/src/index.test.ts` mock Firestore collectionGroup +
  Resend send. Mirror: R170 test = gated cron does ZERO collection-group reads when the flag is off;
  R171 test = over-cap message rejected + over-quota send skipped + under-limit send proceeds.
- Gates: `cd functions && npm test`, `cd functions && npm run build`. Render-service (if touched):
  `cd render-service && npm test` (its own vitest, node env — NOT run from repo root).

### Integration Points
- All function changes in `functions/src/index.ts`. Render-service changes in `render-service/` (separate
  package). `firebase.json` may gain a functions options block only if the planner prefers it over
  in-code `setGlobalOptions` (in-code is simpler and testable — prefer it).
</code_context>

<specifics>
## Specific Ideas

- R170 is the single highest-value line in the whole milestone for recurring read cost — it stops a daily
  all-org scan that grows with data, and it deploys autonomously, so the bill relief is immediate (not
  owner-gated like Phase 66's deletions).
- Keep all four knobs generous so nothing legitimate is ever blocked; the caps exist to stop loops/abuse,
  not to shape normal use.

</specifics>

<deferred>
## Deferred Ideas

- Re-enabling reminders behind an indexed/bounded per-org query (future milestone) — out per REQUIREMENTS.
- `messageWebhook` IP/rate throttling — out (already HMAC-gated; the residual per-invocation cost is
  negligible).
- GCP billing budget + alert — owner console action, not app code.

</deferred>
