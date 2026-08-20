---
phase: 65-ai-proxy-cost-controls
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - functions/src/index.ts
  - functions/src/index.test.ts
autonomous: true
requirements: [R161, R162, R163, R164]
must_haves:
  truths:
    - "A signed-in user exceeding AI_RATELIMIT_MAX_PER_MIN (default 20) or AI_RATELIMIT_MAX_PER_DAY (default 500) on /api/anthropic gets HTTP 429 with a clear JSON error the client can surface (R161)."
    - "A /api/anthropic request naming a model outside AI_ALLOWED_MODELS is rejected with HTTP 400; a max_tokens above AI_MAX_TOKENS_CEILING (default 2048) is clamped down before forwarding, not rejected (R162)."
    - "Every 2xx /api/anthropic request writes one aiUsage ledger entry {uid, orgId, model, inputTokens, outputTokens, createdAt} via the Admin SDK (R163)."
    - "The api function is deployed with an explicit maxInstances ceiling (default 10, overridable by AI_PROXY_MAX_INSTANCES) (R164)."
    - "esv, nlt, and planningcenter proxy behavior is byte-for-byte unchanged — none of the four controls run on those upstreams."
    - "If the rate limiter's own Firestore transaction throws, the request is allowed (fail OPEN) and the error is logged — a datastore hiccup never takes AI down."
  artifacts:
    - "functions/src/index.ts — config reader, verifyAppCaller, enforceModelAndTokens, checkAndConsumeRateLimit, buildUsageEntry/writeUsageLedger, maxInstances option, anthropic-branch wiring"
    - "functions/src/index.test.ts — unit tests for the exported pure helpers plus limiter/ledger against a mocked Firestore"
  key_links:
    - "verifyAppCaller returns the decoded ID token so uid and resolveOrgId(token.orgId) are available at the anthropic enforcement + ledger point"
    - "the four controls are gated behind service === 'anthropic' only; all other upstreams skip them"
    - "the ledger reads usage from the non-streaming Anthropic response body BEFORE res.send, wrapped so a failure never breaks the proxy response"
---

<objective>
Cap and observe token spend on the metered Claude proxy. Wrap the `anthropic` branch of the `api`
onRequest handler (`functions/src/index.ts`) with four server-side controls, all env-configurable with
generous defaults, all applied to the `anthropic` upstream ONLY:

- R161 — per-user (uid) request rate limit via Firestore fixed-window counters; over-limit → HTTP 429.
- R162 — server-side model allow-list (reject 400) + max_tokens ceiling (clamp down), so the client can
  no longer dictate the model or token budget forwarded byte-unchanged.
- R163 — a usage ledger entry per proxied Claude request, written by the function via the Admin SDK.
- R164 — an explicit `maxInstances` ceiling on the `api` function.

Purpose: no single signed-in user can drive unbounded AI cost in a loop, and per-user/per-org token
spend becomes queryable in a Firestore ledger instead of living only on the Anthropic console.

Output: modified `functions/src/index.ts` + `functions/src/index.test.ts`, functions suite green,
`tsc` clean, and an autonomous `firebase deploy --only functions:api`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/65-ai-proxy-cost-controls/65-CONTEXT.md
@functions/src/index.ts
@functions/src/index.test.ts
</context>

<constraints>
- ALL four controls run on the `anthropic` upstream ONLY. Guard every one behind `service === "anthropic"`.
  esv / nlt / planningcenter must keep forwarding `req.body` byte-unchanged (they are not metered by us).
- NO new dependencies. Use the already-imported `getFirestore`/`FieldValue` (Admin SDK, bypasses rules)
  and native `fetch`. Do NOT add the Anthropic SDK server-side.
- Env knobs mirror the existing string/number `process.env` read style (e.g. `MEDIA_CLEANUP_ENABLED`
  at index.ts:610). Defaults must apply when the var is unset so a fresh deploy works with zero config.
- The client AI calls are NON-STREAMING (confirmed: `messages.create` x2 + `messages.parse` x1 in
  `src/utils/claudeApi.ts`), so the Anthropic response body carries a top-level `usage` object with
  `input_tokens` / `output_tokens`. Read the ledger token counts from that parsed body.
- Follow the established test pattern: the `api` onRequest handler has NO existing test harness, so
  implement each control as an EXPORTED pure/helper function and unit-test THOSE (mirroring how
  `buildUpstreamUrl` / `redactUrl` / `PROXY_TARGETS` / `SECRET_INJECTED` are exported and tested).
- Do not write `.env.local` or `functions/.env`. Env-var CONFIG the owner may tune is documented as a
  handover note, not written here (v1.8 grant).
</constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AI proxy config knobs, maxInstances (R164), and decoded-token auth refactor</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    - readAiProxyLimits(env): with an empty env returns the generous defaults — maxPerMin 20, maxPerDay
      500, allowedModels ['claude-haiku-4-5-20251001'], maxTokensCeiling 2048.
    - readAiProxyLimits(env): parses AI_RATELIMIT_MAX_PER_MIN / AI_RATELIMIT_MAX_PER_DAY /
      AI_MAX_TOKENS_CEILING as numbers, and AI_ALLOWED_MODELS as a comma-separated, trimmed, empty-filtered
      list; an unset or non-numeric knob falls back to its default.
    - resolveOrgId(decoded): returns the string orgId custom claim when present and non-empty, else null
      (a uid with no org claim records uid-only, never throws).
    - verifyAppCaller(token): resolves to the decoded ID token for a valid token, and to null for a
      missing or invalid token (same accept/reject decision the old boolean gate made).
    - The api handler options object carries maxInstances resolved from AI_PROXY_MAX_INSTANCES (default 10).
  </behavior>
  <action>
    In functions/src/index.ts add an exported `readAiProxyLimits(env = process.env)` that returns
    `{ maxPerMin, maxPerDay, allowedModels, maxTokensCeiling }`. Read each numeric knob as
    `Number(env.NAME) || DEFAULT` (defaults: AI_RATELIMIT_MAX_PER_MIN 20, AI_RATELIMIT_MAX_PER_DAY 500,
    AI_MAX_TOKENS_CEILING 2048); read AI_ALLOWED_MODELS by splitting on comma, trimming, dropping empties,
    defaulting to a single-element list holding the one model the app uses today. Mirror the existing
    env-read style used near index.ts:610.

    Add a module-level `AI_PROXY_MAX_INSTANCES = Number(process.env.AI_PROXY_MAX_INSTANCES) || 10` and add
    a `maxInstances: AI_PROXY_MAX_INSTANCES` field to the `api = onRequest({ secrets: [...] }, ...)`
    options object (R164). Leave the secrets array untouched.

    Refactor the auth gate: replace the boolean `callerIsAuthenticated` with an exported
    `verifyAppCaller(idToken?): Promise<DecodedIdToken | null>` that returns the decoded token on success
    and null on missing/invalid token (import `DecodedIdToken` from firebase-admin/auth). Add an exported
    `resolveOrgId(decoded): string | null` that reads the `orgId` custom claim (the v1.5 org-membership
    claim, top-level on the decoded token per orgMembershipClaims ORG_CLAIM_KEYS), returning null when
    absent/empty. In the SECRET_INJECTED gate (index.ts:174-181) call verifyAppCaller, keep the identical
    401-on-null behavior, and hold the returned decoded token in a handler-scoped variable so the anthropic
    branch (Tasks 2-3) can read `decoded.uid` and `resolveOrgId(decoded)`. Do NOT change behavior for the
    non-anthropic secret-injected services (esv/nlt still just need a valid caller).

    In functions/src/index.test.ts add a describe block covering readAiProxyLimits (defaults + parsing) and
    resolveOrgId (claim present / absent). For verifyAppCaller, reuse the existing getAuth().verifyIdToken
    mock pattern (test setup already mocks firebase-admin/auth) to assert decoded-token-on-success and
    null-on-throw.
  </action>
  <verify>
    <automated>cd functions && npm run build && npx vitest run -t "readAiProxyLimits" -t "resolveOrgId"</automated>
  </verify>
  <done>readAiProxyLimits returns documented defaults and parses all four knobs; resolveOrgId maps the orgId claim to string|null; verifyAppCaller returns the decoded token or null; the api options object carries maxInstances (R164); tsc is clean; new unit tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Server-side model allow-list + max_tokens clamp on the anthropic branch (R162)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    - enforceModelAndTokens(body, limits): a body whose model is in allowedModels and whose max_tokens is
      at or below the ceiling returns { ok: true, body } unchanged.
    - enforceModelAndTokens: a body whose model is NOT in allowedModels returns
      { ok: false, status: 400, error } with a clear message; the body is not forwarded.
    - enforceModelAndTokens: a numeric max_tokens above maxTokensCeiling is clamped DOWN to the ceiling in
      the returned body (request still allowed); an absent max_tokens is left absent (not injected).
    - enforceModelAndTokens: a missing/blank model, or a non-object body, is rejected 400 (the proxy stops
      trusting a client-chosen model).
  </behavior>
  <action>
    Add an exported pure `enforceModelAndTokens(body: unknown, limits)` to functions/src/index.ts returning
    a discriminated result: on an allow-listed model, `{ ok: true, body }` with `max_tokens` clamped to
    `Math.min(max_tokens, ceiling)` only when max_tokens is a number above the ceiling; on a disallowed,
    missing, or blank model (or a non-object body), `{ ok: false, status: 400, error: { error, allowedModels } }`
    with a clear human-readable message (describe by concept, e.g. that the requested model is not
    permitted by server policy — do not embed the rejected value verbatim into any file-scanned literal).

    Wire it into the anthropic branch of the api handler BEFORE the body is forwarded and BEFORE the
    fetch: only when `service === "anthropic"`, call enforceModelAndTokens(req.body, readAiProxyLimits()).
    On `ok: false`, respond `res.status(result.status).json(result.error)` and return. On `ok: true`, carry
    `result.body` forward as the outbound body for anthropic. Introduce a single
    `const outboundBody = service === "anthropic" ? clampedBody : req.body` and use it in the existing
    `JSON.stringify(...)` at the fetch call, so esv/nlt/planningcenter still forward `req.body` unchanged.

    Add unit tests in functions/src/index.test.ts for enforceModelAndTokens covering: allow-listed pass-through,
    disallowed-model 400, clamp-down of an over-ceiling max_tokens, absent max_tokens left absent, and a
    missing-model/non-object body 400. Use readAiProxyLimits() defaults as the limits fixture.
  </action>
  <verify>
    <automated>cd functions && npm run build && npx vitest run -t "enforceModelAndTokens"</automated>
  </verify>
  <done>The proxy rejects a non-allow-listed model with 400 and clamps an over-ceiling max_tokens before forwarding to Anthropic; non-anthropic upstreams forward req.body byte-unchanged; tsc clean; tests pass (R162).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Per-user rate limiter (R161) + usage ledger (R163), wired into the anthropic branch</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    - checkAndConsumeRateLimit(db, uid, limits, now): under both ceilings, returns { allowed: true } and
      increments the per-minute and per-day counter docs for that uid+window.
    - checkAndConsumeRateLimit: when the minute counter has reached maxPerMin (or the day counter maxPerDay),
      returns { allowed: false, scope } and does NOT increment (a rejected request never inflates the count).
    - The anthropic branch: a caller over either ceiling receives HTTP 429 with a clear JSON error naming
      the scope; a caller under both is forwarded normally.
    - Fail-open: if checkAndConsumeRateLimit throws (Firestore error), the anthropic branch allows the
      request and logs a warning — AI never goes down because the limiter's own datastore op failed.
    - buildUsageEntry(uid, orgId, model, usage): returns { uid, orgId, model, inputTokens, outputTokens,
      createdAt } reading input_tokens/output_tokens from the Anthropic response usage; orgId is null when
      unresolved (uid-only), never throws.
    - Every 2xx anthropic response writes one aiUsage entry via the Admin SDK; a ledger-write failure is
      swallowed and the upstream body is still returned unchanged.
  </behavior>
  <action>
    Add an exported `checkAndConsumeRateLimit(db, uid, limits, now = Date.now())` that runs a Firestore
    transaction over two fixed-window counter docs in a TOP-LEVEL `aiRateLimits` collection: doc ids
    `${uid}__min__${Math.floor(now/60000)}` and `${uid}__day__${Math.floor(now/86400000)}`. In the
    transaction, read both counts; if either is already at/above its ceiling, return { allowed: false,
    scope } WITHOUT writing; otherwise set each doc `{ count: <read+1>, expireAt }` (expireAt a Firestore
    Timestamp a bit past the window so an optional owner TTL policy can reap stale counters) and return
    { allowed: true }. Use the transaction fake pattern already present in the messaging tests
    (tx.get(ref)/tx.set|update(ref, patch)).

    Add exported `buildUsageEntry(uid, orgId, model, usage)` returning
    `{ uid, orgId: orgId ?? null, model, inputTokens: usage.input_tokens ?? 0, outputTokens:
    usage.output_tokens ?? 0, createdAt: FieldValue.serverTimestamp() }`, and
    `writeUsageLedger(db, entry)` that adds it to the TOP-LEVEL `aiUsage` collection via the Admin SDK.

    Wire into the anthropic branch: (a) BEFORE the fetch and after the Task 2 enforcement, wrap the limiter
    call in try/catch — on throw, log a warning and treat as allowed (fail OPEN); on { allowed: false },
    respond `res.status(429).json({ error, scope, retryAfterSec })` and return. (b) AFTER receiving a 2xx
    upstream response and BEFORE `res.send(body)`, in a try/catch that never blocks the response, JSON.parse
    the anthropic response text, read `usage`, and `await writeUsageLedger(db, buildUsageEntry(decoded.uid,
    resolveOrgId(decoded), outboundModel, usage))`. A parse/usage/write failure is logged and swallowed so
    the original body is still returned unchanged. Keep all of this behind `service === "anthropic"`.

    IMPORTANT top-level path choice: keep `aiUsage` and `aiRateLimits` as TOP-LEVEL collections so the
    catch-all deny in firestore.rules already blocks client access; do NOT nest them under
    organizations/{orgId} (the org-scoped `/{collection}/{docId}` wildcard at firestore.rules:299 would
    otherwise expose them to org editors — the T-37-15 hole).

    Add unit tests in functions/src/index.test.ts: for checkAndConsumeRateLimit use a mocked db with a
    runTransaction fake — assert allow+increment under-limit, block+no-increment at the minute ceiling,
    block at the day ceiling, and that a throwing transaction is caught by the branch as fail-open (assert
    the helper propagates the throw so the branch can decide). For buildUsageEntry assert the exact shape,
    orgId null-fallback, and token defaults. If the FieldValue test mock lacks `increment`, extend the
    existing firebase-admin/firestore mock's FieldValue with the members these helpers use.
  </action>
  <verify>
    <automated>cd functions && npm run build && npm test</automated>
  </verify>
  <done>Under-limit anthropic requests pass and both counters increment; an over-limit caller gets 429 with the scope; a limiter Firestore throw fails open (request allowed); every 2xx anthropic response writes an aiUsage entry {uid, orgId, model, inputTokens, outputTokens, createdAt}; a ledger failure never breaks the proxy response; full functions suite green; tsc clean (R161 + R163).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser client → `api` proxy (`/api/anthropic`) | The client picks model, max_tokens, and request volume; all are untrusted once this phase lands. The proxy holds CLAUDE_API_KEY and spends real money per call. |
| `api` function → Firestore (Admin SDK) | The function writes counters + ledger with rules bypassed; these collections must stay unreadable to clients. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-65-01 | Tampering | client-chosen `model` / `max_tokens` forwarded byte-unchanged (index.ts:220-226) | high | mitigate | R162: enforceModelAndTokens rejects a non-allow-listed model (400) and clamps max_tokens to AI_MAX_TOKENS_CEILING before the fetch; the proxy stops trusting the client body. |
| T-65-02 | Denial of Service | one authenticated user looping the proxy for unbounded token spend | high | mitigate | R161 per-uid fixed-window rate limit → 429 over ceiling; R164 maxInstances caps fan-out so a spike cannot scale cost without bound. |
| T-65-03 | Repudiation | no server record of who spent tokens (usage only on Anthropic console) | medium | mitigate | R163: per-request aiUsage ledger {uid, orgId, model, inputTokens, outputTokens, createdAt} written via Admin SDK — spend is attributable and queryable in-app. |
| T-65-04 | Information Disclosure | client reading the aiUsage ledger / aiRateLimits counters | low | mitigate | Top-level collections are already denied by the firestore.rules catch-all; an explicit deny (defense-in-depth) is added UNDEPLOYED in plan 65-02 and handed to the owner. No success criterion here depends on it. |
| T-65-05 | Denial of Service | limiter's own Firestore op failing and blocking all AI | medium | accept | Deliberate fail-OPEN: a limiter transaction throw allows the request and logs — the ceiling is a cost guardrail, not a security control (locked decision). |

No new dependencies are introduced (no package-manager installs), so no supply-chain (T-65-SC) checkpoint applies.
</threat_model>

<verification>
Gates (run from repo unless noted):
- `cd functions && npm run build` — tsc clean.
- `cd functions && npm test` — full functions suite green (node env), including the new helper/limiter/ledger tests.
- `grep -c 'maxInstances' functions/src/index.ts` >= 1 — R164 present on the api options object.
- Behavioral proof is by the functions unit tests against MOCKED Firestore + a mocked upstream response;
  NO live Anthropic calls are made in tests.

## Autonomous deploy (per the v1.8 grant)
After all three tasks are green, deploy the function code (bounded, reversible config/logic — no data loss,
no lockout):

  firebase deploy --only functions:api

This ships the rate limiter, model/token enforcement, ledger writes, and the maxInstances cap. Defaults
apply with zero env config; the owner may later tune AI_RATELIMIT_MAX_PER_MIN, AI_RATELIMIT_MAX_PER_DAY,
AI_ALLOWED_MODELS, AI_MAX_TOKENS_CEILING, AI_PROXY_MAX_INSTANCES via the function's env without a logic
redeploy. Do NOT write any .env file here — record the tunable knob names in the SUMMARY handover.
</verification>

<success_criteria>
- R161: a signed-in user over AI_RATELIMIT_MAX_PER_MIN or AI_RATELIMIT_MAX_PER_DAY on /api/anthropic is rejected with HTTP 429 and a clear JSON error; a limiter Firestore failure fails open.
- R162: a /api/anthropic request naming a non-allow-listed model is rejected 400 and an over-ceiling max_tokens is clamped before reaching Anthropic; the client can no longer dictate model or token budget.
- R163: every 2xx /api/anthropic request writes one aiUsage ledger entry {uid, orgId, model, inputTokens, outputTokens, createdAt} via the Admin SDK, queryable in Firestore.
- R164: the api function runs under an explicit maxInstances ceiling (default 10, AI_PROXY_MAX_INSTANCES).
- esv/nlt/planningcenter proxy behavior unchanged; functions suite green; tsc clean; functions:api deployed.
</success_criteria>

<output>
Create `.planning/phases/65-ai-proxy-cost-controls/65-01-SUMMARY.md` when done. Record: the exact
collection paths used (aiUsage, aiRateLimits), the tunable AI_* env knob names + defaults for owner
handover, and confirmation that `firebase deploy --only functions:api` was run (or, if deploy auth was
unavailable, the exact command handed over).
</output>
