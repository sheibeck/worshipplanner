---
phase: 65-ai-proxy-cost-controls
plan: 01
subsystem: api
tags: [firebase-functions, firestore, rate-limiting, cost-controls, anthropic-proxy]

# Dependency graph
requires: []
provides:
  - "Per-uid Firestore fixed-window rate limit (20/min, 500/day defaults) on the anthropic proxy branch, fail-open on limiter Firestore errors"
  - "Server-side model allow-list (400 reject) + max_tokens ceiling clamp (2048 default) on the anthropic proxy branch"
  - "Per-request aiUsage ledger entry {uid, orgId, model, inputTokens, outputTokens, createdAt} written via Admin SDK for every 2xx anthropic response"
  - "Explicit maxInstances ceiling (10 default) on the api onRequest function"
  - "verifyAppCaller/resolveOrgId helpers exposing the decoded ID token + orgId claim to any future anthropic-branch control"
affects: [65-02-ledger-access-hardening, phase-67-instance-ceilings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anthropic-only cost controls gated strictly behind `service === \"anthropic\"`; esv/nlt/planningcenter forward req.body byte-unchanged via a single `outboundBody` variable"
    - "Exported pure/helper functions unit-tested directly (readAiProxyLimits, resolveOrgId, verifyAppCaller, enforceModelAndTokens, checkAndConsumeRateLimit, buildUsageEntry, writeUsageLedger) — the api onRequest handler itself still has no full test harness, mirroring the existing buildUpstreamUrl/redactUrl precedent"
    - "Firestore fixed-window rate limit: two top-level aiRateLimits/{uid}__min__{window} and __day__{window} counter docs read+incremented inside one transaction; a rejected request never increments"
    - "Fail-open guardrail: the rate limiter's own Firestore transaction throw is caught by the handler (not the helper) and treated as allowed+logged, never blocking AI"

key-files:
  created: []
  modified:
    - "functions/src/index.ts — readAiProxyLimits, resolveOrgId, verifyAppCaller (replaces callerIsAuthenticated), maxInstances option, enforceModelAndTokens, checkAndConsumeRateLimit, buildUsageEntry, writeUsageLedger, anthropic-branch wiring"
    - "functions/src/index.test.ts — unit tests for all seven new exported helpers against a mocked Firestore/Auth"

key-decisions:
  - "aiUsage and aiRateLimits are TOP-LEVEL Firestore collections (not nested under organizations/{orgId}), so the firestore.rules catch-all deny already blocks client reads without any rules change in this plan (T-37-15 hole avoided)"
  - "Rate limiter fails OPEN on its own Firestore error — a cost guardrail, not a security control (locked decision, 65-CONTEXT.md); the anthropic branch catches the throw, not the helper itself"
  - "max_tokens over the ceiling is CLAMPED down, not rejected; a disallowed/missing/blank model IS rejected (400) — asymmetric by design per 65-CONTEXT.md"
  - "verifyAppCaller returns the decoded ID token (not a boolean) so uid/orgId are available to the anthropic-only controls without a second verifyIdToken call; esv/nlt behavior (any valid caller) is unchanged"
  - "Committed as three separate atomic per-task commits despite all three tasks editing the same handler body, by reconstructing intermediate build+test-verified states rather than committing the final combined diff as one lump"

patterns-established:
  - "AI_* env knobs (AI_RATELIMIT_MAX_PER_MIN/DAY, AI_ALLOWED_MODELS, AI_MAX_TOKENS_CEILING, AI_PROXY_MAX_INSTANCES) read via readAiProxyLimits(env=process.env) with generous defaults, mirroring the MEDIA_CLEANUP_ENABLED env-read style already in this file"

requirements-completed: [R161, R162, R163, R164]

coverage:
  - id: D1
    description: "Per-user (uid) rate limit on /api/anthropic — over AI_RATELIMIT_MAX_PER_MIN or AI_RATELIMIT_MAX_PER_DAY returns HTTP 429 with a clear JSON error; a limiter Firestore throw fails open"
    requirement: "R161"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#checkAndConsumeRateLimit (allow+increment, block+no-increment at minute ceiling, block at day ceiling, propagates throw for fail-open)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Server-side model allow-list (400 reject on disallowed/missing/blank model) + max_tokens ceiling clamp (down, not rejected) on the anthropic branch only"
    requirement: "R162"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#enforceModelAndTokens (allow-listed pass-through, disallowed-model 400, clamp over-ceiling, absent max_tokens left absent, missing/blank model 400, non-object body 400)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One aiUsage ledger entry {uid, orgId, model, inputTokens, outputTokens, createdAt} written via Admin SDK per 2xx anthropic response"
    requirement: "R163"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#buildUsageEntry (exact shape, orgId null-fallback, token defaults) and #writeUsageLedger (adds to top-level aiUsage collection)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Explicit maxInstances ceiling (default 10, AI_PROXY_MAX_INSTANCES override) on the api onRequest function"
    requirement: "R164"
    verification:
      - kind: other
        ref: "grep -c 'maxInstances' functions/src/index.ts  (>= 1; api options object carries maxInstances: AI_PROXY_MAX_INSTANCES)"
        status: pass
    human_judgment: false
  - id: D5
    description: "esv/nlt/planningcenter proxy behavior is byte-for-byte unchanged — none of the four controls run on those upstreams"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts full suite (290 tests) — no existing esv/nlt/planningcenter test assertions changed; outboundBody defaults to req.body for every service !== \"anthropic\""
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-20
status: complete
---

# Phase 65 Plan 01: AI Proxy Cost Controls Summary

**Rate limiter, model/token enforcement, usage ledger, and maxInstances ceiling on the anthropic branch of the `api` proxy — all four cost controls wired, tested against mocked Firestore/Auth, built and committed, staged for the orchestrator's consolidated deploy.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-20T02:26:00Z (approx, per prior STATE.md timestamp)
- **Completed:** 2026-08-20T03:21:31Z
- **Tasks:** 3/3
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments

- R161: per-uid Firestore fixed-window rate limit (20/min, 500/day defaults) — over-limit callers get HTTP 429 with a `scope` field; a limiter Firestore transaction throw fails OPEN (request allowed, warning logged).
- R162: server-side model allow-list (`AI_ALLOWED_MODELS`, default `claude-haiku-4-5-20251001`) rejects a disallowed/missing/blank model with 400; `max_tokens` above `AI_MAX_TOKENS_CEILING` (default 2048) is clamped down rather than rejected; an absent `max_tokens` is left absent.
- R163: every 2xx `/api/anthropic` response writes one `aiUsage` ledger entry `{uid, orgId, model, inputTokens, outputTokens, createdAt}` via the Admin SDK, parsed from the (non-streaming) upstream response body before `res.send`, wrapped so a parse/write failure never breaks the client response.
- R164: `api` onRequest options carry an explicit `maxInstances` (default 10, `AI_PROXY_MAX_INSTANCES` override).
- All four controls are gated strictly behind `service === "anthropic"`; esv/nlt/planningcenter continue forwarding `req.body` byte-unchanged.
- `verifyAppCaller` replaces the old boolean `callerIsAuthenticated` gate with the decoded ID token itself (same accept/reject behavior for esv/nlt), and `resolveOrgId` reads the v1.5 `orgId` custom claim.

## Task Commits

Each task was committed atomically:

1. **Task 1: AI proxy config knobs, maxInstances (R164), decoded-token auth refactor** - `9b48f15b` (feat)
2. **Task 2: Server-side model allow-list + max_tokens clamp (R162)** - `e934eddb` (feat)
3. **Task 3: Per-user rate limiter (R161) + usage ledger (R163)** - `8d7a0617` (feat)

**Plan metadata:** committed together with SUMMARY.md/STATE.md/ROADMAP.md at the end of this execution (see final docs commit in git log).

_Note: all three tasks were `tdd="true"` in the plan frontmatter, but the plan's own `<action>` blocks specify writing the exported helper + its tests together per task (not a separate RED-then-GREEN commit pair) — this matches the existing repo precedent (buildUpstreamUrl/redactUrl) of testing exported pure functions directly rather than driving a formal red/green cycle on the untestable `onRequest` handler itself. Each task commit above bundles the helper implementation and its unit tests, all green at commit time._

**Reconstruction note:** all three tasks edit the same `anthropic` branch of the same `api` handler in `functions/src/index.ts`, so the changes were implemented and fully verified (build + full 290-test suite) together first, then split into three atomic commits by reconstructing each intermediate state (Task 1 alone, Task 1+2, Task 1+2+3) and re-running `npm run build` + `npm test` at each stage before committing — rather than committing the final combined diff as one lump. Test counts at each stage: 276 (Task 1) → 283 (+7, Task 2) → 290 (+7, Task 3), confirming no test loss or duplication across the split.

## Files Created/Modified

- `functions/src/index.ts` — added `readAiProxyLimits`, `resolveOrgId`, `verifyAppCaller` (replaces `callerIsAuthenticated`), `AI_PROXY_MAX_INSTANCES`/`maxInstances` option, `enforceModelAndTokens`, `checkAndConsumeRateLimit`, `buildUsageEntry`, `writeUsageLedger`; wired all four into the anthropic branch of the `api` onRequest handler.
- `functions/src/index.test.ts` — added `describe` blocks for all seven new exported helpers, each against a mocked `firebase-admin/auth`/`firebase-admin/firestore` (transaction fake pattern reused from the existing `dispatchDueScheduledMessagesHandler` tests); no live Anthropic calls anywhere in the suite.

## Decisions Made

- Kept `aiUsage`/`aiRateLimits` as **top-level** Firestore collections rather than nesting under `organizations/{orgId}`, per the plan's explicit T-37-15 warning — the `firestore.rules` catch-all deny (`match /{document=**} { allow read, write: if false; }`) already blocks client access with zero rules change in this plan.
- `expireAt` on rate-limit counter docs is a plain JS `Date` (Admin SDK auto-converts to a Firestore `Timestamp` on write) rather than importing `Timestamp` from `firebase-admin/firestore` — avoids needing to extend the test file's Firestore module mock for a field nothing in this plan reads back.
- Model rejection message is described by concept ("not permitted by server policy") rather than embedding the rejected model string verbatim, per the plan's action-block guidance.
- Split the single combined implementation into 3 atomic per-task commits via reconstruct-and-reverify rather than one lump commit, preserving the task_commit_protocol's per-task recoverability despite the tasks sharing one handler body.

## Deviations from Plan

None - plan executed exactly as written. The plan-checker nit called out in the orchestrator's gate note (Task 1's verify line using two `-t` flags, of which Vitest only honors the last) was pre-empted: the actual gate run used the combined regex `-t "readAiProxyLimits|resolveOrgId"` as instructed, which correctly matched 7 tests (4 `readAiProxyLimits` + 3 `resolveOrgId`).

## Issues Encountered

None. Build (`cd functions && npm run build`, i.e. `tsc`) was clean at every stage; the full functions suite (`cd functions && npm test`) passed 290/290 at final state, and passed at each intermediate reconstruction stage (276, then 283, then 290) confirming the per-task split didn't drop or duplicate any test.

## Owner Handover: Tunable AI_* Env Knobs

All five knobs are env-overridable with working code defaults — **zero-config deploy is safe**. No `.env`/`.env.local`/`functions/.env` file was written by this plan.

| Env var | Default | Purpose |
|---|---|---|
| `AI_RATELIMIT_MAX_PER_MIN` | `20` | Per-uid requests/minute before HTTP 429 (R161) |
| `AI_RATELIMIT_MAX_PER_DAY` | `500` | Per-uid requests/day before HTTP 429 (R161) |
| `AI_ALLOWED_MODELS` | `claude-haiku-4-5-20251001` (comma-separated list) | Models permitted on `/api/anthropic`; anything else is rejected 400 (R162) |
| `AI_MAX_TOKENS_CEILING` | `2048` | `max_tokens` above this is clamped down before forwarding (R162) |
| `AI_PROXY_MAX_INSTANCES` | `10` | `maxInstances` on the `api` onRequest function (R164) |

Firestore collection paths (both top-level, no rules change in this plan):
- `aiRateLimits/{uid}__min__{minuteWindow}` and `aiRateLimits/{uid}__day__{dayWindow}` — rate-limit counters, `{count, expireAt}`.
- `aiUsage/{autoId}` — usage ledger, `{uid, orgId, model, inputTokens, outputTokens, createdAt}`.

## Deploy — STAGED for the orchestrator, NOT run by this executor

Per the plan and the executor's critical instructions, `firebase deploy` was **never run**. Code is built, tested, and committed on `master`. The deploy command the orchestrator will run after all v1.8 phases are code-complete:

```
firebase deploy --only functions:api
```

## User Setup Required

None - no external service configuration required. Defaults apply with zero env config; the owner may later tune the five `AI_*` knobs above via the function's environment without a logic redeploy.

## Next Phase Readiness

- Plan 65-02 (ledger access hardening — an explicit `firestore.rules` deny clause over `aiUsage`/`aiRateLimits`, owner-gated) can proceed independently; this plan's controls do not depend on that rules change to operate (Admin SDK writes bypass rules regardless).
- No blockers. The `api` function is not yet deployed — the orchestrator's consolidated `firebase deploy --only functions:api` step is required before R161-R164 take effect in production.

---
*Phase: 65-ai-proxy-cost-controls*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND: .planning/phases/65-ai-proxy-cost-controls/65-01-proxy-cost-controls-SUMMARY.md
- FOUND: 9b48f15b (Task 1 commit)
- FOUND: e934eddb (Task 2 commit)
- FOUND: 8d7a0617 (Task 3 commit)
