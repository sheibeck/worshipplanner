---
phase: 67-fan-out-cron-instance-guardrails
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - functions/src/index.ts
  - functions/src/index.test.ts
autonomous: true
requirements: [R170, R171, R172]
must_haves:
  truths:
    - "With SCHEDULED_MESSAGING_CRON_ENABLED unset/'false' (default off), the daily sendScheduledReminders cron performs ZERO cross-org collectionGroup reads — both the reminder sweep and the scheduled-dispatch sweep are skipped (R170)."
    - "A queued message resolving to more than MESSAGE_MAX_RECIPIENTS (default 200) recipients is rejected as 'failed' with a clear reason and sends zero emails — never silently truncated (R171)."
    - "Once an org reaches ORG_MAX_EMAILS_PER_DAY (default 1000) sends in a fixed daily window, further sends that day are failed/skipped with a logged reason (R171)."
    - "Every Cloud Function inherits a project-wide maxInstances ceiling (default 20) via one setGlobalOptions call, while the api proxy keeps its own tighter maxInstances (10) — not clobbered (R172)."
  artifacts:
    - functions/src/index.ts
    - functions/src/index.test.ts
  key_links:
    - "R170 gate sits at the top of an exported cron orchestrator, before getFirestore().collectionGroup(...), so no scan runs when gated off."
    - "R171 recipient-cap and org-quota checks sit AFTER sendList is fully built and BEFORE `new Resend(...)` / the send loop."
    - "setGlobalOptions is called once at module top, before the first onRequest/onCall/onSchedule definition, so all functions inherit it; api's per-function maxInstances overrides it."
---

<objective>
Close three unbounded fan-out / read-cost surfaces in `functions/src/index.ts`, all bounded and reversible:

- **R170** — gate the daily `sendScheduledReminders` cron OFF by default so it performs no cross-org `collectionGroup` scan (the daily read-cost line).
- **R171** — cap the Resend send loop in `sendQueuedMessageHandler` with a per-message recipient cap (reject over-cap, never truncate) and a per-org daily email quota (fixed-window Admin-SDK counter).
- **R172** — add one project-wide `setGlobalOptions({ maxInstances })` ceiling so every function inherits a fan-out cap, while `api` keeps its own tighter cap.

Purpose: this is the phase that actually cuts the bill — R170 stops a daily all-org scan whose cost grows with data, and R171/R172 bound worst-case email + instance fan-out.
Output: modified `functions/src/index.ts` + new tests in `functions/src/index.test.ts`.

DEPLOY POLICY (v1.8 grant): all three changes are bounded/reversible → autonomous-deployable, BUT the executor does NOT deploy. Build + test + commit only. Every deploy is STAGED for the orchestrator's consolidated milestone-end deploy (`firebase deploy --only functions:sendScheduledReminders,functions:sendQueuedMessage` for R170/R171, and a broad `firebase deploy --only functions` for R172's global options). DO NOT write `.env` / `functions/.env` — the new knobs have safe code defaults; record their names for owner tuning.
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
@functions/src/index.ts
@functions/src/index.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: R170 — gate the daily reminder/dispatch cron OFF by default (no cross-org scan)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    - With SCHEDULED_MESSAGING_CRON_ENABLED unset (or "false", "True", "1", or any value that is not exactly "true"): the exported cron orchestrator returns WITHOUT calling getFirestore or any collectionGroup scan — the collectionGroup spy is never invoked.
    - With SCHEDULED_MESSAGING_CRON_ENABLED === "true": both sweeps run — sendScheduledRemindersHandler and dispatchDueScheduledMessagesHandler are each invoked (each in its own try/catch as today).
    - The existing sendScheduledRemindersHandler and dispatchDueScheduledMessagesHandler unit tests continue to pass unchanged (they drive the handler bodies directly and must still scan when invoked).
  </behavior>
  <action>
    Extract the body of the sendScheduledReminders onSchedule callback (currently the two try/catch sweeps at the onSchedule wrapper, ~index.ts:1842-1862) into a new EXPORTED async function `runScheduledMessagingCron(env: NodeJS.ProcessEnv = process.env)`. At the TOP of that function, before any getFirestore or handler call, early-return when `env.SCHEDULED_MESSAGING_CRON_ENABLED !== "true"` — logging a one-line console.log stating the cron is gated off and performs zero cross-org reads. Reuse the exact existing enable-flag idiom already used by the cleanup handlers (default OFF unless the value is exactly "true"). When enabled, keep the two existing per-sweep try/catch blocks (reminder sweep then dispatch sweep) inside the function so one failing sweep never aborts the other. Replace the onSchedule wrapper callback with a single `await runScheduledMessagingCron();`.

    Per D-R170 default: gate the WHOLE function off (both sweeps), which is the lowest-cost option and kills BOTH the reminder collectionGroup('services') scan and the scheduled-dispatch collectionGroup('messages') scan. Do NOT add the gate inside the exported handler bodies themselves — the reminder/dispatch handler unit tests invoke them directly and must still scan.

    DISCLOSURE (record prominently in the SUMMARY): gating the whole function off also disables the composer's schedule-for-later dispatch (dispatchDueScheduledMessagesHandler) until the flag is enabled. To restore reminders OR schedule-for-later, set SCHEDULED_MESSAGING_CRON_ENABLED=true and redeploy sendScheduledReminders. Fully reversible via the flag. Do NOT write functions/.env — record the knob name for the owner.
  </action>
  <verify>
    <automated>cd functions && npm test && npm run build</automated>
    Add two tests around runScheduledMessagingCron mirroring the existing collectionGroup-spy harness (index.test.ts sendScheduledRemindersHandler suite, mockServicesDb ~2443): (1) flag unset/absent → runScheduledMessagingCron({}) makes ZERO collectionGroup reads (mock getFirestore; assert the collectionGroup spy is never called); (2) flag "true" → the cron proceeds (collectionGroup is invoked / both sweeps run).
  </verify>
  <done>With SCHEDULED_MESSAGING_CRON_ENABLED unset/"false" the cron performs no cross-org collectionGroup scan; setting it to "true" restores both sweeps; functions suite + build green; no deploy (STAGED for orchestrator).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: R171 — Resend volume caps (per-message recipient cap + per-org daily quota)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    - checkAndConsumeOrgEmailQuota (new exported helper): under the daily limit → allowed and increments the day counter by the email count; at/over the limit → not allowed and does NOT increment; a throwing transaction propagates (caller decides policy).
    - sendQueuedMessageHandler: when the resolved sendList length exceeds MESSAGE_MAX_RECIPIENTS → message marked 'failed' with a clear reason, zero recipient docs written, Resend send never called (reject, never truncate).
    - sendQueuedMessageHandler: when the org is at/over ORG_MAX_EMAILS_PER_DAY for the current day window → message marked failed/skipped with a logged reason, Resend send never called.
    - Under both limits (default knobs) → existing two-recipient send behavior is unchanged.
  </behavior>
  <action>
    Add two env knobs read via the existing readNumericKnob helper: MESSAGE_MAX_RECIPIENTS (default 200) and ORG_MAX_EMAILS_PER_DAY (default 1000), env-overridable.

    Add an exported helper checkAndConsumeOrgEmailQuota(db, orgId, count, limit, now = Date.now()) that mirrors checkAndConsumeRateLimit (index.ts:336): a single db.runTransaction over ONE top-level orgEmailCounters doc keyed `${orgId}__day__${dayWindow}` where dayWindow = Math.floor(now / 86_400_000). Read the current day count; if it is already >= limit, return not-allowed WITHOUT incrementing; otherwise increment the day counter by `count` (the number of emails about to be sent) and return allowed. Set an expireAt a bit past the window end so an optional owner TTL policy can reap stale counters. Keep the collection TOP-LEVEL and Admin-SDK-written so the firestore.rules catch-all deny already blocks client reads (same T-37-15 reasoning as aiRateLimits/aiUsage) — no firestore.rules change. Do not catch its own Firestore errors; let them propagate.

    Wire both into sendQueuedMessageHandler AFTER sendList is fully built (including the optional self-copy, ~index.ts:2570-2583) and BEFORE `new Resend(...)` (~2588) and the send loop: (1) recipient cap — if sendList.length > MESSAGE_MAX_RECIPIENTS, mark the message failed via messageRef.set merge (status:'failed', deliveryCounts {sent:0,failed:0}, plus a reason) and return a SendOutcome {status:'failed', sentCount:0, failedCount:0, skippedReason:'over-recipient-cap'} — do NOT truncate. (2) org quota — call checkAndConsumeOrgEmailQuota(db, orgId, sendList.length, ORG_MAX_EMAILS_PER_DAY); when not allowed, mark the message failed (mirror the existing failed-path set at ~2508-2512), log a reason, and return {status:'failed', ..., skippedReason:'over-org-daily-quota'} without sending. Both checks mirror the existing fail-closed patterns already in the handler (unsafe-tag-id, missing-service).

    Per D-R171: reject-over-generous-cap (do not truncate) and a fixed-window Admin-SDK per-org quota. Both knobs generous so legitimate sends never hit them. Do NOT write functions/.env — record MESSAGE_MAX_RECIPIENTS and ORG_MAX_EMAILS_PER_DAY names for the owner.
  </action>
  <verify>
    <automated>cd functions && npm test && npm run build</automated>
    Tests: (a) a checkAndConsumeOrgEmailQuota describe block mirroring the checkAndConsumeRateLimit harness (index.test.ts:3434) — allows and increments by count under the limit; blocks and does NOT increment at/over the limit; propagates a throwing transaction. (b) full send-path over-cap: with the two-recipient fixture and process.env.MESSAGE_MAX_RECIPIENTS="1", assert the message is set 'failed', recipientWrites is empty, and the mocked Resend send (mockSend) is never called. (c) full send-path over-quota: seed the org day counter at/over the limit (or set ORG_MAX_EMAILS_PER_DAY="0"), assert failed/skipped and mockSend never called. (d) default under-limit two-recipient test still green. Extend makeSendDb (index.test.ts:3737) to register the orgEmailCounters collection and route its transactional counter reads/increments (distinguish the message-claim transaction from the counter transaction by the ref), seeded from a new SendDbConfig field.
  </verify>
  <done>Over-cap message rejected 'failed' with zero sends; org past daily quota skipped/failed and logged; normal sends unaffected; no firestore.rules change; functions suite + build green; STAGED for orchestrator.</done>
</task>

<task type="auto">
  <name>Task 3: R172 — project-wide setGlobalOptions maxInstances ceiling</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <action>
    Import setGlobalOptions from firebase-functions/v2/options. Add GLOBAL_MAX_INSTANCES = readNumericKnob(process.env.GLOBAL_MAX_INSTANCES, 20) near the existing AI_PROXY_MAX_INSTANCES constant (index.ts:235). Call setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES }) EXACTLY ONCE at module top, before the first function definition (the api onRequest at ~index.ts:413) so every function inherits the ceiling.

    Per D-R172: do NOT remove or alter api's own `{ maxInstances: AI_PROXY_MAX_INSTANCES }` option (index.ts:414) — its per-function value must still OVERRIDE the global (api stays 10; messageWebhook and all other functions inherit the global 20). This satisfies "covers at least api + messageWebhook". Prefer this in-code setGlobalOptions over a firebase.json options block (simpler, testable). Env-overridable; do NOT write functions/.env — record GLOBAL_MAX_INSTANCES for the owner.
  </action>
  <verify>
    <automated>cd functions && npm test && npm run build</automated>
    Tests: mock firebase-functions/v2/options and assert setGlobalOptions was called exactly once with { maxInstances: 20 } (the default). Add a source-level assertion (mirroring the existing `source.indexOf(...)` pattern at index.test.ts:2789) that api's onRequest options still include maxInstances: AI_PROXY_MAX_INSTANCES, proving it is not clobbered.
  </verify>
  <done>setGlobalOptions applies a default maxInstances of 20 to every function; api keeps its 10; functions suite + build green; STAGED for the orchestrator's broad firebase deploy --only functions.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client composer → queued message doc → sendQueuedMessage trigger | untrusted recipient-selection intent drives email fan-out volume |
| Cloud Scheduler → sendScheduledReminders | daily internal trigger driving cross-org collectionGroup reads |
| env config → function behavior | operator-set knobs (gate + caps + instance ceiling) with safe code defaults |
| Admin SDK → top-level orgEmailCounters | server-only quota counter; must not be client-readable |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-67-01 | Denial of Service | sendQueuedMessageHandler send loop | high | mitigate | R171 per-message recipient cap (MESSAGE_MAX_RECIPIENTS default 200) rejects an over-cap message 'failed' before any send — bounds single-send fan-out |
| T-67-02 | Denial of Service | send loop + enqueuing crons | medium | mitigate | R171 per-org daily quota (ORG_MAX_EMAILS_PER_DAY default 1000) via fixed-window Admin-SDK counter — backstops a loop/cron fan-out |
| T-67-03 | Denial of Service | api + messageWebhook (HTTP functions) | medium | mitigate | R172 setGlobalOptions({ maxInstances: 20 }) caps out-scaling; api keeps its own 10 |
| T-67-04 | Denial of Service | sendScheduledReminders daily read cost | medium | mitigate | R170 gate early-returns before any collectionGroup scan when disabled (default) |
| T-67-05 | Information Disclosure | new top-level orgEmailCounters collection | low | mitigate | kept top-level + Admin-SDK-written; firestore.rules catch-all deny already blocks client reads (T-37-15) — no rules change |
| T-67-06 | Tampering | R170 env-flag gate re-enable | low | accept | reversible by design (that is the point); the enable is logged and owner-controlled |
| T-67-SC | Tampering | npm/pip/cargo installs | low | accept | NO new dependencies added this phase (setGlobalOptions is already in firebase-functions) — package legitimacy gate not triggered |
</threat_model>

<verification>
- `cd functions && npm test` green (existing suite + the new R170/R171/R172 tests).
- `cd functions && npm run build` (tsc) clean — confirms the setGlobalOptions import path resolves.
- No `.env` / `functions/.env` written; no `firebase deploy` run (all STAGED).
- No firestore.rules change (orgEmailCounters is Admin-SDK top-level).
</verification>

<success_criteria>
- R170: with SCHEDULED_MESSAGING_CRON_ENABLED unset/"false", the cron performs zero cross-org collectionGroup reads; "true" restores both sweeps. Scheduled-for-later dispatch disablement is DISCLOSED in the SUMMARY.
- R171: an over-recipient-cap message is rejected 'failed' (zero sends, not truncated); an org over its daily quota is failed/skipped and logged; normal sends unchanged.
- R172: one setGlobalOptions maxInstances default of 20 applies to all functions; api keeps 10 (not clobbered).
- All deploys STAGED for the orchestrator; executor built + tested + committed only.
</success_criteria>

<output>
Create `.planning/phases/67-fan-out-cron-instance-guardrails/67-01-SUMMARY.md` when done. In it, DISCLOSE the R170 choice (whole-function gate) and that schedule-for-later dispatch is off until SCHEDULED_MESSAGING_CRON_ENABLED=true, and record the four new env knob names (SCHEDULED_MESSAGING_CRON_ENABLED, MESSAGE_MAX_RECIPIENTS, ORG_MAX_EMAILS_PER_DAY, GLOBAL_MAX_INSTANCES) with their defaults for owner tuning, plus the STAGED deploy commands.
</output>
