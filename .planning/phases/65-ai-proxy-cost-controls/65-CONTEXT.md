# Phase 65: AI Proxy Cost Controls - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — grey areas resolved with stated defaults per the v1.8 grant)

<domain>
## Phase Boundary

Cap and observe token spend on the metered Claude proxy `api` (`functions/src/index.ts:156`, wired via
`firebase.json:18` → `/api/**`). Four controls, all on the **`anthropic` upstream only** (esv / nlt /
planningcenter are not metered by Anthropic and must keep working unchanged): (R161) a server-side
per-user request rate limit; (R162) server-side enforcement of an allowed model + a `max_tokens`
ceiling, since today the proxy forwards `req.body` byte-unchanged (index.ts:220) and the client picks
both (`src/utils/claudeApi.ts:282/362/569`); (R163) a usage ledger written for every proxied Claude
request; (R164) an explicit `maxInstances` ceiling on the `api` function.

Out of this phase: changing which AI features exist or their UX; a full in-app usage dashboard (that is
the deferred R169 shape); rate-limiting the non-metered upstreams.

</domain>

<decisions>
## Implementation Decisions

### Rate limiting (R161)
- **Key by caller uid** (the abuse vector is one authenticated user looping). The proxy already
  verifies a Firebase ID token via the `X-App-Auth` header (`callerIsAuthenticated`, index.ts:146) — key
  the limiter on that uid. Per-org aggregation is delivered by the ledger (R163), not a second limiter.
- **Counters live in Firestore** (already the datastore; serverless-friendly atomic increments; the
  function writes via the Admin SDK, which bypasses security rules). A fixed-window counter doc per
  `(uid, window)` is sufficient — no need for a sliding-window/Redis dependency.
- **Env-configurable, generous defaults** that stop a runaway loop without hurting real use (a real user
  makes a handful of AI calls per session): `AI_RATELIMIT_MAX_PER_MIN` default **20/min/user** and
  `AI_RATELIMIT_MAX_PER_DAY` default **500/day/user**. Over-limit → HTTP **429** with a clear JSON error
  the client can surface. Values are read from env so the owner can tune without a code change.
- **Fail-closed on the limiter's own error?** No — if the counter read/write itself throws, **fail open**
  (allow the request) so a Firestore hiccup never takes AI down; log it. The ceiling is a cost guardrail,
  not a security control.

### Model + max_tokens enforcement (R162)
- **Model allow-list**, env-configurable `AI_ALLOWED_MODELS` (comma-separated), default the only model
  the app uses today: `claude-haiku-4-5-20251001`. A request naming a model **not** on the list is
  **rejected (400)** — a wrong/expensive model is almost certainly a bug or abuse, not legitimate.
- **`max_tokens` is clamped** (not rejected) down to `AI_MAX_TOKENS_CEILING`, default **2048** (client
  uses ≤1024 today). Clamping is friendlier than rejecting and still caps per-call output cost.
- Enforcement parses the JSON body for the `anthropic` path **before forwarding**; other upstreams are
  untouched. The proxy stops trusting the client-supplied `model`/`max_tokens`.

### Usage ledger (R163)
- **Written by the function via Admin SDK** (bypasses rules → **no firestore.rules change needed to
  write**). One entry per proxied Claude request: `{ uid, orgId, model, inputTokens, outputTokens,
  createdAt }`, plus `feature` if cheaply derivable. Token counts come from the Anthropic response
  `usage` (non-streaming) or the accumulated `message_delta` usage (if the call streams — the planner
  confirms which against `claudeApi.ts`).
- **orgId** is resolved from the **decoded token's custom claims** (the v1.5 custom-claims org
  membership); if unresolvable, record `uid` only rather than failing the request.
- **"Observable inside the app" is satisfied by a queryable ledger**, not a new UI this phase. A full
  in-app per-org usage view is the deferred R169 shape and would require a **client read rule** — which
  is owner-gated. Keep client read OUT of this phase so R163 stays autonomously deployable.

### Instance ceiling (R164)
- Set an explicit **`maxInstances` on the `api` function**, default **10**, env-overridable
  (`AI_PROXY_MAX_INSTANCES`). Phase 67 sets the project-wide `setGlobalOptions` ceiling; this phase caps
  the single highest-cost function directly so the guardrail lands with its own controls.

### Deploy classification (per the v1.8 grant)
- **Autonomous deploy (bounded/reversible, no data loss, no lockout):** all the **function code** —
  rate limiter, model/token enforcement, ledger writes, and the `maxInstances` cap. These are function
  config/logic changes.
- **Owner-gated (hand over, built + tested + UNDEPLOYED):** any **`firestore.rules`** change — e.g. an
  explicit **deny** clause hardening the new `aiUsage` / rate-limit collections against client access
  (defense-in-depth over the deny-by-default baseline; the v1.5 T-37-15 note warns the generic nested
  wildcard is a known hole, so an explicit deny is worth shipping — but the owner deploys rules). The
  function does not depend on that rule to operate (Admin SDK writes regardless); the rule only closes
  client access.

### Claude's Discretion
- Exact Firestore collection names/paths, fixed-window vs token-bucket doc shape, and where the shared
  limiter/ledger helper lives — planner's call against the real `functions/src/index.ts` structure.
- Whether the anthropic call path is streaming (affects how `usage` is captured) — confirm in-code.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `callerIsAuthenticated` (index.ts:146) already decodes/verifies the Firebase ID token from
  `X-App-Auth` — the uid (and custom claims → orgId) are available at the enforcement point.
- The proxy's per-upstream switch (index.ts:66-76) already distinguishes `anthropic` from esv/nlt/
  planningcenter — the natural place to gate metered-only controls.
- Admin SDK (`getFirestore()`) is already initialized in the functions codebase (used by messaging +
  cleanup crons) for ledger/counter writes.

### Established Patterns
- Functions are one file (`functions/src/index.ts`); tests in `functions/src/index.test.ts`. Config via
  `process.env` reads with string-equality gates (e.g. `MEDIA_CLEANUP_ENABLED !== "true"`, index.ts:610)
  — mirror that env-read style for the new `AI_*` knobs.
- Functions test suite: `cd functions && npm test`; functions build: `cd functions && npm run build`.

### Integration Points
- `api` onRequest handler (index.ts:156-247) — rate-limit + model/token enforcement + ledger write wrap
  the `anthropic` branch; `maxInstances` goes on the `onRequest` options object.
- Client `src/utils/claudeApi.ts` — should surface a 429 / 400 from the proxy as a graceful,
  non-blocking AI error (AI is additive per the project's Key Decisions), not a hard crash.

</code_context>

<specifics>
## Specific Ideas

- Defaults chosen to be invisible to real users and painful only to a loop: 20 req/min and 500/day per
  user, 2048-token clamp, haiku-only allow-list, 10 max instances — all env-overridable so the owner
  tunes without a redeploy of logic.
- The ledger is the observability half of the milestone goal ("visible inside the app instead of only on
  the Anthropic console") — its value is the per-uid/per-org token totals it makes queryable.

</specifics>

<deferred>
## Deferred Ideas

- Full in-app AI-usage dashboard / per-org spend UI (needs a client read rule) — aligns with the
  deferred **R169** observability shape; revisit if cost stays material after this lands.
- Hard per-org monthly token budget with cutoff — this phase caps request rate + per-call tokens and
  makes spend observable; a spend-based cutoff is a larger policy feature, not scoped here.

</deferred>
