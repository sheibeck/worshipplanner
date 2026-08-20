---
phase: 65-ai-proxy-cost-controls
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - functions/src/index.ts
  - functions/src/index.test.ts
  - src/utils/claudeApi.ts
  - src/utils/__tests__/claudeApi.test.ts
  - firestore.rules
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
fixed_at: 2026-08-20T01:03:00Z
fix_status: fixed_and_accepted
fixed:
  - WR-01
  - WR-03
  - WR-04
  - IN-01
wont_fix:
  - WR-02
  - IN-02
---

# Phase 65: Code Review Report

**Reviewed:** 2026-08-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Fix Outcomes (2026-08-20)

All 4 warning/info findings selected for fixing are done; the 2 findings judged
correct-as-is are accepted as won't-fix (see each finding's outcome note below for
rationale). No critical findings existed to fix.

| ID | Outcome | Commit |
|----|---------|--------|
| WR-01 | Fixed | `6da2e8c9` |
| WR-02 | Won't fix (intended function-level ceiling; comment clarified) | — |
| WR-03 | Fixed | `e276f44e` |
| WR-04 | Fixed | `bda5fde3` |
| IN-01 | Fixed | `76198f8e` |
| IN-02 | Won't fix (negligible, not folded in) | — |

**Gates after fixes:**
- `cd functions && npm test` — 304/304 passing (was 290/290; +14 new tests across the 4 fixes)
- `cd functions && npm run build` — clean (`tsc`, no errors)
- `npx vitest run` (root app suite) — unchanged known-failing baseline: 2 files
  (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), no new
  failures. 3658 passed / 1 failed / 13 skipped.
- Root `npm run type-check` not run — no root/`src/` files were touched, only
  `functions/src/index.ts` and `functions/src/index.test.ts`.
- No deploy was performed (`firebase deploy`/`gcloud` not run), and no `.env`/`.env.local`/
  `functions/.env` files were written — all fixes remain undeployed per constraints.

## Summary

Reviewed the five files touched across 65-01 (server-side rate limiter, model/token
enforcement, usage ledger) and 65-02 (client graceful-degradation, firestore.rules deny
clauses). The core guarantees hold up under adversarial tracing: the rate limiter's
check-then-increment is genuinely atomic (single Firestore transaction, no
increment-before-check race), the fail-open catch is scoped exactly to the limiter call
(a limiter throw can never suppress the model/token 400 or block a legitimate request),
`outboundBody` (the clamped/validated body) — not raw `req.body` — is what's actually
forwarded upstream, every new control is gated on `service === "anthropic"` at the point
where it has a side effect, the ledger write failure path is fully wrapped and can never
break the caller's response, `resolveOrgId` fails safe to `null`, no secret or usage
payload is logged, and the `firestore.rules` deny blocks are placed top-level and before
the catch-all with no widening of any existing rule. The client's `logAiProxyError`
correctly narrows to `.status` only (never message text) and the existing
catch-everything-return-null contract is unchanged, so no new error class is silently
swallowed beyond what already was.

No blockers found. Four warnings worth fixing before this is considered fully hardened:
a `0`-as-falsy bug in the env-knob parser that silently ignores an operator's attempt to
set any of the three numeric knobs to `0`; a `maxInstances` ceiling that, despite being
framed as anthropic-only cost control (R164), actually throttles the entire multiplexed
`api` function including esv/nlt/planningcenter traffic; a silent aiUsage-ledger gap for
any request that sets `stream: true` (not stripped/rejected by `enforceModelAndTokens`);
and a lack of any integration-level test proving the anthropic branch's own wiring
(order of enforce → rate-limit → fetch → ledger, and that the clamped body is what's
actually sent) — today that guarantee is verified only by manual code reading, since
every control is tested in isolation against its extracted pure function.

## Warnings

### WR-01: `readAiProxyLimits` silently discards an operator's `0` for any of the three numeric knobs

> **Outcome: FIXED** — commit `6da2e8c9`. Added `readNumericKnob(raw, fallback)`
> (trims, then falls back only on unset/blank/non-finite; an explicit `0` is
> honored) and used it for `AI_RATELIMIT_MAX_PER_MIN`, `AI_RATELIMIT_MAX_PER_DAY`,
> `AI_MAX_TOKENS_CEILING` inside `readAiProxyLimits`, and also for
> `AI_PROXY_MAX_INSTANCES` (same class of bug, not itself a WR-01 line
> reference but the same "generous defaults" doc-comment applies). Added
> `readNumericKnob` unit tests plus a `readAiProxyLimits` case asserting all
> three knobs honor an explicit `"0"`. Functions suite: 296/296 passing after
> this commit, `npm run build` clean.

**File:** `functions/src/index.ts:192-194`
**Issue:** `Number(env.AI_RATELIMIT_MAX_PER_MIN) || 20` (and the identical pattern for
`AI_RATELIMIT_MAX_PER_DAY` / `AI_MAX_TOKENS_CEILING`) uses `||` for the fallback, which
treats a genuinely-parsed `0` as falsy and replaces it with the default. An operator who
sets `AI_RATELIMIT_MAX_PER_MIN=0` intending an emergency full stop on the anthropic proxy
gets `maxPerMin: 20` instead — the exact opposite of the intended effect, and silently
so (no log, no error). This is the one class of input the "generous defaults" doc-comment
never anticipates: the fallback is meant to catch "unset/non-numeric", not "explicitly
zero". The existing test suite (`readAiProxyLimits` describe block,
`functions/src/index.test.ts:2381-2425`) never exercises `"0"`, so this gap has no test
coverage in either direction.
**Fix:**
```ts
function readNumericKnob(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
// ...
const maxPerMin = readNumericKnob(env.AI_RATELIMIT_MAX_PER_MIN, 20);
const maxPerDay = readNumericKnob(env.AI_RATELIMIT_MAX_PER_DAY, 500);
const maxTokensCeiling = readNumericKnob(env.AI_MAX_TOKENS_CEILING, 2048);
```

### WR-02: `AI_PROXY_MAX_INSTANCES` throttles the entire shared `api` function, not just the anthropic branch

> **Outcome: WON'T FIX (accepted as correct/intended).** `maxInstances` is a
> Cloud Functions v2 / Cloud Run **function-level** setting, and it cannot be
> scoped to only `service === "anthropic"` within the single shared
> `onRequest` handler — splitting the route into its own function was
> considered and rejected as unnecessary surface-area growth for this phase.
> Capping the whole `api` function is the intended behavior for R164:
> esv/nlt/planningcenter also spend real quota/money per call, so a shared
> ceiling protecting all four upstreams is correct, not a regression. As a
> small trivial clarification bundled into the WR-01 commit (`6da2e8c9`), the
> code comment above `AI_PROXY_MAX_INSTANCES` was updated to explicitly state
> it caps the whole `api` function across all four proxy targets, so this is
> no longer undocumented. No functional code change beyond that comment and
> routing `AI_PROXY_MAX_INSTANCES` through the WR-01 `readNumericKnob` helper.

**File:** `functions/src/index.ts:210-213`, `362-363`
**Issue:** The comment at line 210-212 frames this as "an explicit maxInstances ceiling
on the highest-cost function (the anthropic branch of `api` spends real money per call)",
and the commit message calls it out as R164's anthropic-only cost guardrail. But
`maxInstances` is a Cloud Functions v2 / Cloud Run **function-level** setting passed to
the single `onRequest(...)` call that also serves `esv`, `nlt`, and `planningcenter`
(see `PROXY_TARGETS` at line 66-71 — one function, four services, routed by path). There
is no way to scope `maxInstances` to only the `service === "anthropic"` requests within
that function. In practice this means: if `esv`/`nlt`/`planningcenter` traffic and
anthropic traffic combined exceed 10 concurrent instances (the default), *legitimate
scripture-lookup or Planning Center requests* queue or fail — a regression risk the
docstring and commit message do not acknowledge, and one the review focus explicitly
asked about ("Any path where esv/nlt/planningcenter now get... rate-limited?" — this is
that path, just at the infrastructure layer rather than the application layer).
**Fix:** Either (a) split the anthropic route into its own `onRequest` function so
`maxInstances` can be scoped correctly, or (b) if keeping one function is intentional,
correct the comment to state the ceiling is shared across all four proxy targets and
size the default accordingly (10 may be too low once esv/nlt/planningcenter traffic is
accounted for).

### WR-03: `stream: true` bypasses the aiUsage ledger's token accounting without being rejected

> **Outcome: FIXED** — commit `e276f44e`. `enforceModelAndTokens` now rejects
> (400) any anthropic-branch request whose body has `record.stream === true`,
> using the same `{ error, allowedModels }` shape as the model-allow-list
> rejection. Scoped to the anthropic branch only (the only caller of
> `enforceModelAndTokens`) — esv/nlt/planningcenter are untouched. Added unit
> tests: rejects `stream: true` with 400, allows `stream: false` through
> unchanged, allows an absent `stream` field (the normal case) through
> unchanged. Functions suite: 299/299 passing after this commit, `npm run
> build` clean.

**File:** `functions/src/index.ts:434-441` (enforcement), `484-504` (ledger)
**Issue:** `enforceModelAndTokens` validates/clamps only `model` and `max_tokens`; it
does not inspect, strip, or reject a `stream` field in the request body. A caller with a
valid `X-App-Auth` token (any signed-in app user, not just the app's own bundled SDK
calls — this endpoint accepts any body shape that parses as JSON) can set
`stream: true` in the outbound body. The proxy still forwards it unchanged
(`outboundBody` only has `max_tokens` conditionally rewritten), still applies the rate
limiter and model allow-list correctly, but at line 490
(`JSON.parse(body) as { usage?: AnthropicUsage }`) it assumes the upstream response is a
single non-streaming JSON object. An SSE-streamed response's raw text is not valid JSON,
so `JSON.parse` throws, is caught by the `catch (ledgerErr)` at line 499, and the ledger
entry for that (successful, billed) request is silently never written — no
`inputTokens`/`outputTokens` recorded for a call that still cost real money. The rate
limiter (the actual cost guardrail) still counts the request, so this is not a full
cost-control bypass, but the aiUsage ledger — the mechanism this phase adds specifically
for cost *visibility* (R163) — silently undercounts for any caller who discovers this.
**Fix:** Either reject `stream: true` outright in `enforceModelAndTokens` (400, matching
the "disallowed... is REJECTED" posture already used for `model`), or explicitly document
that streaming responses are a known ledger gap and monitor for it via the existing
`console.warn` at line 500 (which does fire today, so this is at minimum an observable
gap, not a fully silent one — but nothing currently alerts on it).

### WR-04: No test exercises the `api` handler's actual anthropic wiring end-to-end

> **Outcome: FIXED** — commit `bda5fde3`. Added an integration-style test
> block (`describe("api (WR-04: anthropic branch end-to-end wiring)")`) that
> drives the actual exported `api` onRequest handler directly — `onRequest`
> from `firebase-functions/v2/https` is not mocked in this suite, and it
> returns the handler as a directly-callable `(req, res) => Promise<void>`,
> so no supertest/emulator was needed. Two cases: (1) a disallowed model
> returns 400 and `fetch` (stubbed via `vi.stubGlobal`) is never called; (2) a
> normal request with an over-ceiling `max_tokens` forwards the CLAMPED
> `outboundBody` to the mocked `fetch` (asserted `!== rawBody`, `max_tokens
> === 2048`) and writes exactly one `aiUsage` ledger entry via a combined
> fake Firestore (serving both the `aiRateLimits` transaction path and the
> `aiUsage.add` path). Functions suite: 304/304 passing after this commit,
> `npm run build` clean.

**File:** `functions/src/index.ts:362-520`; `functions/src/index.test.ts:2375-2379`
**Issue:** Every new control (`enforceModelAndTokens`, `checkAndConsumeRateLimit`,
`buildUsageEntry`, `writeUsageLedger`, `verifyAppCaller`, `resolveOrgId`) is unit-tested
in isolation against its own extracted pure function — thoroughly and well. But the
comment the tests themselves carry ("the `api` onRequest handler itself has no existing
test harness") is still true after this phase: no test proves that the handler *wires
these together correctly* — that `outboundBody` (the clamped body) rather than raw
`req.body` is what's actually passed to `fetch`, that the rate-limit check runs after
enforcement and before the fetch, that the ledger write only fires for a 2xx anthropic
response, or that a non-anthropic service genuinely never touches any of this. This
review verified all of that by reading the handler body directly, but a future edit to
`api` (e.g., someone "simplifying" the anthropic block, or reordering statements) could
silently reintroduce a leak (e.g. forwarding `req.body` instead of `outboundBody`) with
no test turning red.
**Fix:** Add at least one integration-style test against the exported `api` handler
(supertest against the Express-compatible request/response, or a hand-rolled fake
req/res) asserting: (1) a disallowed model on the anthropic route returns 400 and never
calls `fetch`; (2) an over-ceiling `max_tokens` is clamped in the body actually passed to
the mocked `fetch`; (3) esv/nlt/planningcenter requests reach `fetch` with `outboundBody
=== req.body` untouched.

## Info

### IN-01: `enforceModelAndTokens`'s `max_tokens` clamp only fires for `typeof "number"`

> **Outcome: FIXED** — commit `76198f8e`. Rather than the REVIEW's suggested
> "reject on type confusion," the owner directed a coercion-based fix
> (smaller, no new 400 surface): a numeric-string `max_tokens` is now
> coerced (`Number.isFinite` check on the trimmed string) before the clamp
> comparison, so a client can no longer dodge the ceiling purely by changing
> the JSON type of `max_tokens`. An under-ceiling numeric string and a
> non-numeric string are both left untouched (no crash, no spurious clamp).
> Added 3 unit tests: over-ceiling string clamps to 2048, under-ceiling
> string passes through unchanged, non-numeric string is ignored. Functions
> suite: 302/302 passing after this commit, `npm run build` clean.

**File:** `functions/src/index.ts:260-263`
**Issue:** `if (typeof maxTokens === "number" && maxTokens > limits.maxTokensCeiling)` —
a `max_tokens` sent as a numeric string (`"99999999"`), or omitted-then-injected via some
other field, skips the clamp entirely and is forwarded byte-unchanged in `outboundBody`.
In practice Anthropic's own API almost certainly rejects a non-integer `max_tokens` type
with its own 400, so this is not believed to be exploitable today — but the proxy's own
enforcement is not self-sufficient for this invariant; it currently leans on upstream
validation to cover the type-confusion case.
**Fix:** Reject (400) rather than pass through when `max_tokens` is present but not a
finite number, mirroring the existing "reject, don't silently trust" posture used for
`model`.

### IN-02: `readAiProxyLimits()` is computed unconditionally for every proxy request, not just anthropic

> **Outcome: WON'T FIX (accepted).** Confirmed functionally harmless — pure,
> cheap (parses 4 env vars, no I/O, no side effect) — and not folded into any
> of the WR-01/WR-03/IN-01 fixes above since none of them touched the call
> site's position relative to the `service === "anthropic"` branch. Left as
> documented, pre-existing minor scope leak per the owner's direction to
> leave it "unless folding it into the W1 fix is trivial and clean" — moving
> the call inside the branch was judged to add churn without a matching
> test-coverage benefit, so it was left alone.

**File:** `functions/src/index.ts:434`
**Issue:** `const aiLimits = readAiProxyLimits();` runs before the
`service === "anthropic"` branch, so esv/nlt/planningcenter requests also pay the cost of
parsing four env vars they never use. Functionally harmless (pure, cheap, no side
effect), but slightly muddies the "every new control lives strictly inside the anthropic
branch" invariant this phase is otherwise careful to document and uphold everywhere else.
**Fix:** Move the `readAiProxyLimits()` call inside the `if (service === "anthropic")`
block, immediately before its first use.

---

_Reviewed: 2026-08-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
