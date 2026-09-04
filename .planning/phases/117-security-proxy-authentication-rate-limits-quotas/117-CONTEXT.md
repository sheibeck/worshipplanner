# Phase 117: Security — Proxy Authentication, Rate Limits & Quotas - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous / yolo — recommended answers auto-accepted, grounded in the v2.8
security review + the existing `anthropic`/R171 patterns in `functions/src/index.ts`)

<domain>
## Phase Boundary

Close the four Cloud-Functions-only gaps the v2.8 security review found (backlog 999.5) — every entry
point that today has no authentication or no rate/quota ceiling gets one, without changing any
within-limit behavior:

- **R339 / SEC-A-01** — `/api/planningcenter` currently bypasses the auth gate entirely (the gate at
  `functions/src/index.ts:497` only fires for `SECRET_INJECTED` = anthropic/esv/nlt). Require an
  authenticated app caller for it too.
- **R340 / SEC-C-01** — extend the existing per-uid `checkAndConsumeRateLimit` (today only on the
  `anthropic` branch) to the `esv`/`nlt` proxy branches.
- **R344 / SEC-C-05** — give `queueServiceMessage` its own per-uid/per-org enqueue-rate ceiling.
- **R345 / SEC-C-06** — give `parsePptx` a per-uid/per-org daily import quota.

Out of this phase: all `firestore.rules` and share-page work (that is Phase 118).

</domain>

<decisions>
## Implementation Decisions

### R339 — planningcenter authentication
- **Authenticate, do NOT secret-inject.** planningcenter is unlike anthropic/esv/nlt: it carries the
  client's own Planning Center OAuth token in a forwarded header, so no server secret is injected. The
  fix is to require a valid `X-App-Auth` Firebase ID token (via the existing `verifyAppCaller`) while
  leaving the upstream OAuth forwarding untouched.
- **Mechanism: a new `AUTH_REQUIRED` set (or equivalent) separate from `SECRET_INJECTED`**, so the auth
  gate fires for `planningcenter` without pulling it into the secret-injection branch. Preferred over
  widening `SECRET_INJECTED` (which would wrongly imply a server secret and risk touching header logic).
- **Preserve the client's PCO `authorization` header forwarding exactly as today** — only the app-caller
  gate is added; a within-limit authenticated request must behave byte-identically.
- Reject with **401** (matching the existing `{ error: "Authentication required" }` response) — same
  shape as the anthropic/esv/nlt path.

### R340 — esv/nlt rate limiting
- **Reuse `checkAndConsumeRateLimit` with the same `readAiProxyLimits(config)` limits** already applied
  to `anthropic` — same per-uid minute/day scopes, same 429 response shape (`scope`, `retryAfterSec`).
- **Keep the anthropic branch's fail-OPEN posture** for a Firestore-limiter hiccup (locked decision,
  65-CONTEXT.md — the limiter is a cost guardrail, not a security control). Consistency over
  re-litigating.
- The esv/nlt org-enablement gate (R297, already present) stays; the rate limit is layered on top.

### R344 — queueServiceMessage enqueue limit
- **Reuse the R171-style per-org daily quota mirror pattern** (the existing per-org Resend email quota
  helper) plus a per-uid enqueue-rate limit, independent of the downstream per-message and per-org-daily
  send caps that already exist. This is self-inflicted-abuse protection (an org can only exhaust its own
  quota).
- **Numeric ceilings at Claude's discretion, grounded in existing R161/R171 constants** — pick values
  consistent with the current cost-control defaults (`appConfig.ts`), not new tunables unless the plan
  finds a reason. Fail-OPEN on a limiter Firestore error, same as the sibling limits.

### R345 — parsePptx daily import quota
- **Per-uid/per-org daily import quota mirroring R161/R171** (the `parsePptx` handler already re-checks
  auth + org membership; add the quota consume alongside). Independent of the render service's
  `--concurrency=1 --max-instances=3` ceiling.
- Numeric ceiling at Claude's discretion, grounded in the existing daily-quota patterns.

### Claude's Discretion
- Exact numeric limits for the two new quotas (R344/R345), the precise helper factoring (extend the
  existing rate-limit/quota helpers vs. a small shared wrapper), and whether the new limits are
  `appConfig`-backed (preferred if the existing quota knobs already live there) vs. constants.
- Test structure — follow the existing `index.test.ts` describe-block conventions for
  `checkAndConsumeRateLimit` and the R171 quota.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/index.ts:136` `verifyAppCaller(idToken)` — the app-caller auth verification already used
  by the `SECRET_INJECTED` gate at `:497`.
- `functions/src/index.ts` `checkAndConsumeRateLimit(db, uid, limits, NOW)` → `{ allowed, scope }` — the
  per-uid minute/day limiter, applied today only on the `anthropic` branch (~:582).
- `readAiProxyLimits(config)` — resolves the rate-limit config (`rateLimitPerMin` 20 / `rateLimitPerDay`
  500 defaults in `appConfig.ts:62-63`).
- The **R171 per-org daily Resend email quota** helper (`index.test.ts:3946` references it) — the
  canonical mirror pattern for a per-org daily quota; reuse its shape for R344/R345.
- `PROXY_TARGETS` (`:77`), `SECRET_INJECTED` (`:87`), `FORWARDED_HEADERS` (`:126`) — the proxy dispatch
  primitives; `planningcenter` is in `PROXY_TARGETS` but not `SECRET_INJECTED`.

### Established Patterns
- Auth gate: `if (SECRET_INJECTED.has(service)) { verify X-App-Auth → 401 if invalid }` at `:497-503`.
- Cost-control limits are `appConfig`-backed with restrictive fallbacks; limiters fail-OPEN, enablement
  gates fail-CLOSED (SEC-C-03, confirmed-sound).
- Cloud Functions are covered by the standalone functions test suite: **`cd functions && npm test`** (not
  the root vitest). New tests must prove each gate/limit actually fires AND that within-limit + anthropic
  behavior is unaffected.

### Integration Points
- The `/api/:service` Express-style handler in `index.ts` (the proxy).
- `queueServiceMessage` and `parsePptx` callable/handlers in `index.ts`.
- Any new re-export requirement: unchanged here (these functions already exist and are exported) — but
  keep the "new functions must be re-exported from index.ts" rule in mind if the plan extracts helpers.

</code_context>

<specifics>
## Specific Ideas

- SEC-A-01 is the milestone's single highest-priority finding — front-load it within the phase.
- The `112-SECURITY-REVIEW.md` "Medium/Low" section (in `.planning/milestones/v2.8-phases/112-security-review/`)
  carries the exact file:line locations and remediation direction for SEC-A-01, SEC-C-01, SEC-C-05,
  SEC-C-06 — the plan should ground each fix in it.

</specifics>

<deferred>
## Deferred Ideas

- All `firestore.rules` / public-share-page hardening (R341, R342, R343, R346, R347, R348) → Phase 118.
- SEC-S-03 (share links never expire) — intentional product design, out of milestone scope entirely.

</deferred>
