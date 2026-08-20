---
phase: 67-fan-out-cron-instance-guardrails
plan: 01
subsystem: infra
tags: [firebase-functions, cloud-scheduler, resend, firestore, cost-control, rate-limiting]

# Dependency graph
requires:
  - phase: 65-anthropic-proxy-guardrails
    provides: "readNumericKnob() env-knob helper, checkAndConsumeRateLimit fixed-window Admin-SDK counter idiom, AI_PROXY_MAX_INSTANCES per-function maxInstances precedent"
  - phase: 61-scheduled-messaging
    provides: "sendScheduledReminders onSchedule cron (reminder sweep + schedule-for-later dispatch sweep)"
  - phase: 59-resend-send-path
    provides: "sendQueuedMessageHandler send loop, SendOutcome/SendTarget types"
provides:
  - "R170: SCHEDULED_MESSAGING_CRON_ENABLED env gate (default off) — sendScheduledReminders performs zero cross-org collectionGroup reads until explicitly enabled"
  - "R171: MESSAGE_MAX_RECIPIENTS per-message recipient cap + ORG_MAX_EMAILS_PER_DAY per-org daily quota on the Resend send loop"
  - "R172: GLOBAL_MAX_INSTANCES project-wide setGlobalOptions ceiling covering every Cloud Function"
affects: [67-02-render-service-instance-cap, billing, messaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-invocation env knob reads (readNumericKnob(process.env.X, default) called INSIDE the handler body, not as a module-scope constant) for any guardrail that must be testable/tunable without a redeploy — mirrors readAiProxyLimits() in the `api` handler."
    - "Fixed-window Admin-SDK Firestore counter (single top-level collection, doc keyed `${scopeId}__day__${dayWindow}`, one runTransaction check-then-increment) — now used twice (aiRateLimits from Phase 65, orgEmailCounters here)."
    - "Whole-function env gate at the very top of an orchestrator, before any Firestore call, to guarantee zero reads when disabled — the gate is structural (a `return`), not a query filter."

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "R170: gated the WHOLE sendScheduledReminders function off by default (not just the reminder sweep) — the lowest-cost option per 67-CONTEXT.md D-R170. This also disables schedule-for-later dispatch until the flag is enabled; disclosed below."
  - "R171: reject-over-cap (never truncate) for MESSAGE_MAX_RECIPIENTS; a fixed-window per-org quota for ORG_MAX_EMAILS_PER_DAY, both checked after sendList is built and before any Resend call so an over-cap/over-quota send makes ZERO calls to Resend."
  - "R171/knobs read per-invocation (not module-scope) so an env override takes effect on the next invocation without a redeploy, and so tests can set process.env per-test."
  - "R172: setGlobalOptions called once at module top before the first function definition; api's own maxInstances (10, R164) is left untouched and continues to override the global default (20) for that one function."

requirements-completed: [R170, R171, R172]

coverage:
  - id: D1
    description: "sendScheduledReminders cron performs zero cross-org collectionGroup reads when SCHEDULED_MESSAGING_CRON_ENABLED is unset/false; both sweeps resume when set to 'true'"
    requirement: R170
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#runScheduledMessagingCron (R170: gate OFF by default) > performs ZERO collectionGroup reads when SCHEDULED_MESSAGING_CRON_ENABLED is unset"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#runScheduledMessagingCron (R170: gate OFF by default) > performs ZERO collectionGroup reads for any value that is not exactly 'true'"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#runScheduledMessagingCron (R170: gate OFF by default) > runs both sweeps (collectionGroup IS invoked) when SCHEDULED_MESSAGING_CRON_ENABLED is exactly 'true'"
        status: pass
    human_judgment: false
  - id: D2
    description: "An over-cap send (> MESSAGE_MAX_RECIPIENTS) is rejected 'failed' with zero emails sent, never truncated"
    requirement: R171
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler > R171: recipient cap + org daily quota > an over-cap send (MESSAGE_MAX_RECIPIENTS) is REJECTED 'failed' with ZERO sends -- never truncated"
        status: pass
    human_judgment: false
  - id: D3
    description: "An org at/over ORG_MAX_EMAILS_PER_DAY is failed/skipped with zero sends, both via env override and via a seeded counter at the default cap"
    requirement: R171
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler > R171: recipient cap + org daily quota > an org at/over ORG_MAX_EMAILS_PER_DAY (env override) is failed/skipped with ZERO sends"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler > R171: recipient cap + org daily quota > an org whose counter is already AT the default daily cap is failed/skipped, without incrementing it further"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#checkAndConsumeOrgEmailQuota"
        status: pass
    human_judgment: false
  - id: D4
    description: "Under both default limits, normal two-recipient sends are unaffected"
    requirement: R171
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler > R171: recipient cap + org daily quota > under both default limits, the two-recipient send is unaffected"
        status: pass
    human_judgment: false
  - id: D5
    description: "setGlobalOptions applies a default maxInstances of 20 to every function, while api keeps its own tighter maxInstances of 10 (not clobbered)"
    requirement: R172
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#setGlobalOptions (R172: project-wide maxInstances ceiling) > is called exactly once, at module load, with the default maxInstances of 20"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#setGlobalOptions (R172: project-wide maxInstances ceiling) > SOURCE: api's own maxInstances is NOT clobbered by the global default"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-20
status: complete
---

# Phase 67 Plan 1: Functions Guardrails (R170-R172) Summary

**Gated the daily cross-org reminder scan off by default, capped the Resend send loop with a reject-over-cap recipient limit + per-org daily quota, and applied a project-wide `maxInstances` ceiling — all built, tested, and committed but NOT deployed (staged for the orchestrator's consolidated milestone-end deploy).**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-20
- **Tasks:** 3/3 completed
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)
- **Tests:** 348 → 361 (+13), all green; `npm run build` (tsc) clean throughout

## Accomplishments

- **R170** — extracted the `sendScheduledReminders` onSchedule body into an exported `runScheduledMessagingCron(env)` orchestrator with a `SCHEDULED_MESSAGING_CRON_ENABLED` gate (default off, `!== "true"` idiom) at its very top, before either sweep and before any `getFirestore()`/`collectionGroup` call. Disabled (the default): zero cross-org reads. Enabled (`"true"`): both the reminder sweep and the schedule-for-later dispatch sweep run exactly as before, each in its own try/catch.
- **R171** — added `checkAndConsumeOrgEmailQuota`, a new fixed-window Admin-SDK Firestore counter (top-level `orgEmailCounters` collection, one doc per `${orgId}__day__${dayWindow}`, single transaction check-then-increment-by-count) mirroring `checkAndConsumeRateLimit`'s shape. Wired into `sendQueuedMessageHandler` AFTER `sendList` is fully built and BEFORE `new Resend(...)`: an over-`MESSAGE_MAX_RECIPIENTS` send is REJECTED `'failed'` with zero emails sent (never truncated); an org at/over `ORG_MAX_EMAILS_PER_DAY` is failed/skipped with zero sends and a logged reason. Zero-recipient sends skip the quota check entirely (nothing to consume).
- **R172** — added one `setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES })` call (default 20, env-overridable) at module top, before the first function definition. Every function now inherits the ceiling, including `messageWebhook` which previously had no cap at all. `api`'s own tighter `maxInstances` (10, from Phase 65/R164) is untouched and continues to override the global default for that one function — proven by a dedicated test.

## Task Commits

Each task was committed atomically:

1. **Task 1: R170 — gate the daily reminder/dispatch cron OFF by default** - `7b8a314c` (feat)
2. **Task 2: R171 — Resend volume caps (per-message recipient cap + per-org daily quota)** - `f592ad24` (feat)
3. **Task 3: R172 — project-wide setGlobalOptions maxInstances ceiling** - `a1a3c9a9` (feat)

Each commit was independently verified: after staging only that task's hunks (via `git apply --cached` against isolated patches), the working tree was temporarily swapped to the staged-only content and `npm run build` + `npm test` were run before committing, then the working tree was restored to the full three-task state. All three intermediate states compiled clean and passed their full test slice (359 tests after Task 2; 361 after Task 3).

## Files Created/Modified

- `functions/src/index.ts` — `runScheduledMessagingCron` (R170 gate + orchestrator), `checkAndConsumeOrgEmailQuota` (R171 quota helper), recipient-cap + quota checks inside `sendQueuedMessageHandler` (R171), `setGlobalOptions` import + call + `GLOBAL_MAX_INSTANCES` constant (R172).
- `functions/src/index.test.ts` — `runScheduledMessagingCron` describe block (3 tests), updated the pre-existing "dispatch sweep is wired..." SOURCE-inspection test to assert against the new orchestrator instead of the onSchedule wrapper directly (see Deviations), `checkAndConsumeOrgEmailQuota` describe block (4 tests), `SendDbConfig`/`makeSendDb` extended with an `orgEmailCounters` fake collection routed by a tagged ref (`{ _kind: "orgEmailCounter" }`) so the shared `runTransaction` mock can distinguish the message-claim transaction from the quota transaction, a new `R171: recipient cap + org daily quota` describe block (4 tests), and a `setGlobalOptions` describe block (2 tests) backed by a hoisted `setGlobalOptionsSpy` wired into a new `vi.mock("firebase-functions/v2/options", ...)`.

## New Env Knobs (record for owner tuning — none written to `.env`/`functions/.env`)

| Knob | Default | Effect |
|---|---|---|
| `SCHEDULED_MESSAGING_CRON_ENABLED` | unset (off) | `"true"` restores the daily reminder sweep AND the schedule-for-later dispatch sweep. Any other value keeps both off with zero cross-org reads. |
| `MESSAGE_MAX_RECIPIENTS` | `200` | A queued message resolving to more recipients than this is rejected `'failed'` with zero sends — never truncated. |
| `ORG_MAX_EMAILS_PER_DAY` | `1000` | Fixed-window (UTC calendar day) per-org Resend send quota; over-quota sends are failed/skipped with a logged reason. |
| `GLOBAL_MAX_INSTANCES` | `20` | Project-wide `maxInstances` ceiling inherited by every Cloud Function that does not set its own (e.g. `messageWebhook`). `api` keeps its own `10`. |

All four are env-overridable with safe code defaults; zero-config deploys work unchanged. Set as Cloud Functions runtime environment variables at deploy time (`firebase functions:config` is legacy — use `--set-env-vars` or the console's runtime env var UI), not `.env`/`functions/.env`.

## DISCLOSURE — R170 also gates schedule-for-later dispatch

Per `67-CONTEXT.md` D-R170, gating the whole `sendScheduledReminders` function off (rather than just the reminder sweep) is the lowest-cost default and kills BOTH cross-org scans (the reminder `collectionGroup('services')` scan and the schedule-for-later `collectionGroup('messages')` scan). This means **the composer's "schedule for later" send feature is inert by default** — a message scheduled for later will sit in `status: 'scheduled'` and never dispatch — until an operator sets `SCHEDULED_MESSAGING_CRON_ENABLED=true` and redeploys `sendScheduledReminders`. This is intentional (reminders are not in production use per the owner, and it is fully reversible via the flag with no data loss either way), but it is a real, user-visible behavior change that should be communicated before/at deploy time.

## Decisions Made

- **R170 whole-function gate** (not sweep-level): matches the plan's explicit instruction and 67-CONTEXT.md's D-R170 default. The gate lives at the very top of the new `runScheduledMessagingCron` orchestrator, structurally before any Firestore call — not as a query filter — so "zero reads when disabled" is provably true, not merely typical.
- **R171 knobs read per-invocation, not module-scope**: `MESSAGE_MAX_RECIPIENTS`/`ORG_MAX_EMAILS_PER_DAY` are read via `readNumericKnob(process.env.X, default)` INSIDE `sendQueuedMessageHandler` on every call, mirroring how `readAiProxyLimits()` is called per-request in the `api` handler (rather than as a module-scope `const` like `AI_PROXY_MAX_INSTANCES`, which is a genuine Cloud Functions deployment-time option and cannot be dynamic). This was necessary for the plan's own test requirement (`process.env.MESSAGE_MAX_RECIPIENTS="1"` taking effect per-test) and is also the more correct production behavior for a value that is not a `maxInstances`-style deploy-time option.
- **`checkAndConsumeOrgEmailQuota` keyed and shaped exactly like `checkAndConsumeRateLimit`**: same fixed-window doc-per-scope-per-day pattern, same "does not catch its own Firestore errors" contract (caller decides fail policy) — kept consistent with the Phase 65 precedent rather than inventing a new shape.
- **`orgEmailCounters` kept top-level, Admin-SDK-only**: same T-37-15 reasoning as `aiRateLimits`/`aiUsage` — the firestore.rules catch-all deny already blocks client reads, so no `firestore.rules` change was needed or made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking test conflict] Updated a pre-existing SOURCE-inspection test that the R170 refactor structurally broke**

- **Found during:** Task 1
- **Issue:** An existing test in the `dispatchDueScheduledMessagesHandler` describe block (`"SOURCE: the dispatch sweep is wired into the sendScheduledReminders wrapper..."`) asserted that the `onSchedule` wrapper's own body (sliced by `source.indexOf("export const sendScheduledReminders = onSchedule(")`) directly contained `dispatchDueScheduledMessagesHandler()` inside a `try {`. The plan's own Task 1 action explicitly requires replacing that wrapper body with a single `await runScheduledMessagingCron();` call — which necessarily moves the `try`/`dispatchDueScheduledMessagesHandler()` call out of the wrapper and into the new orchestrator, breaking this assertion by design.
- **Fix:** Updated the test to assert against `runScheduledMessagingCron`'s body (sliced between its own `indexOf` and the wrapper's `indexOf`) for the sweep/try-catch content, and added a separate, narrower assertion that the wrapper itself now just calls `runScheduledMessagingCron()`. No behavioral change to the assertions' intent (still proves: both sweeps run in their own try/catch, no new onSchedule wrapper, no secret bound to the dispatch sweep) — only the source-region it inspects.
- **Files modified:** `functions/src/index.test.ts`
- **Verification:** `npm test` — this test passes; full suite green (361/361).
- **Committed in:** `7b8a314c` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue caused by the plan's own mandated refactor)
**Impact on plan:** No scope creep; a direct, necessary consequence of the extraction the plan itself specifies. All other tests pass unchanged.

## Issues Encountered

None. The three tasks are independent, non-overlapping regions of the same two files; each was independently verified (build + full test run) before being committed as its own atomic commit — including an out-of-band verification step where the working tree was temporarily swapped to each task's staged-only content to prove the intermediate commits are themselves buildable and green, not just the final combined state.

## User Setup Required

None — no external service configuration required. No `.env`/`functions/.env` files were written; the new knobs (see table above) have safe code defaults and are purely opt-in via Cloud Functions runtime environment variables at deploy time.

## STAGED Deploy Commands (NOT run by this executor — for the orchestrator's consolidated milestone-end deploy)

Per the plan's DEPLOY POLICY, all three changes are bounded/reversible/no-data-loss (v1.8 grant) and autonomous-deployable, but this executor built + tested + committed ONLY. No `firebase deploy` was run.

```bash
# R170 + R171: targeted deploy of the two touched functions
firebase deploy --only functions:sendScheduledReminders,functions:sendQueuedMessage

# R172: setGlobalOptions affects every function's metadata (maxInstances
# ceiling only — no logic change to any function other than the two above),
# so activating it requires the BROADER form:
firebase deploy --only functions
```

Recommendation: run the broad `firebase deploy --only functions` once (it supersedes the narrower R170/R171 command) since R172's `setGlobalOptions` call needs every function redeployed to pick up the new default `maxInstances`. Before deploying, decide whether to set `SCHEDULED_MESSAGING_CRON_ENABLED=true` as a runtime env var if reminders/schedule-for-later should stay live — see the DISCLOSURE section above.

## Next Phase Readiness

Ready for `67-02-render-service-instance-cap-PLAN.md` (R173 — Cloud Run render-service `--max-instances`/`--concurrency`), which is independent of this plan's changes (different package, `render-service/`, not `functions/`). No blockers.

---
*Phase: 67-fan-out-cron-instance-guardrails*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: `functions/src/index.ts`
- FOUND: `functions/src/index.test.ts`
- FOUND: `.planning/phases/67-fan-out-cron-instance-guardrails/67-01-functions-guardrails-SUMMARY.md`
- FOUND commit: `7b8a314c`
- FOUND commit: `f592ad24`
- FOUND commit: `a1a3c9a9`
