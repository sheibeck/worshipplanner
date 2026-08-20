---
phase: 65-ai-proxy-cost-controls
verified: 2026-08-20T04:42:25Z
status: passed
score: 4/4 roadmap success criteria verified (9/9 combined truths incl. plan must-haves)
behavior_unverified: 0
overrides_applied: 0
---

# Phase 65: AI Proxy Cost Controls Verification Report

**Phase Goal:** The metered Claude `/api/anthropic` proxy caps and observes every signed-in user's token
spend, so no single user can drive unbounded AI cost in a loop and per-user/per-org spend is visible
inside the app instead of only on the external Anthropic console.

**Verified:** 2026-08-20T04:42:25Z
**Status:** passed
**Re-verification:** No — initial verification

**Deploy status note (not a defect):** Per the v1.8 autonomy grant, `functions/src/index.ts` (65-01) is
built + tested + committed but UNDEPLOYED (orchestrator runs `firebase deploy --only functions:api` as a
consolidated step), and the `firestore.rules` deny for `aiUsage`/`aiRateLimits` (65-02) is committed,
tested against a live emulator, and left UNDEPLOYED as owner-gated defense-in-depth. Neither undeployed
state blocks any of the four success criteria below — all are proven by code + test evidence, not by
production deploy state.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R161: a signed-in user over the per-uid request-window ceiling (20/min, 500/day defaults) is rejected HTTP 429 with a clear JSON error; the limiter fails OPEN on its own Firestore error | ✓ VERIFIED | `functions/src/index.ts:285-315` (`checkAndConsumeRateLimit`, transactional, no increment on reject) wired at `index.ts:446-466` (429 response with `scope`/`retryAfterSec` at line 452-456; `try/catch` around the limiter call fails open with a `console.warn` at 459-465, never blocking the request). Unit tests: `functions/src/index.test.ts:2524-2593` (allow+increment under-limit, block+no-increment at minute ceiling, block at day ceiling, throw propagates for fail-open). Functions suite: **290/290 passing** (`cd functions && npm test`). |
| 2 | R162: a request naming a non-allow-listed model is rejected 400; an over-ceiling `max_tokens` is clamped BEFORE forwarding (body no longer forwarded byte-unchanged for anthropic) | ✓ VERIFIED | `functions/src/index.ts:234-265` (`enforceModelAndTokens`: disallowed/missing/blank model → `{ok:false,status:400}`; over-ceiling numeric `max_tokens` clamped to ceiling; absent `max_tokens` left absent). Wired at `index.ts:435-441` — called BEFORE the fetch, `outboundBody` set from the enforcement result. Unit tests: `functions/src/index.test.ts:2473-2521` (pass-through, disallowed-model 400, clamp, absent-left-absent, non-object/missing-model 400). |
| 3 | R163: every proxied Claude request writes an `aiUsage` ledger entry `{uid, orgId, model, inputTokens, outputTokens, createdAt}` via the Admin SDK | ✓ VERIFIED | `functions/src/index.ts:336-360` (`buildUsageEntry`/`writeUsageLedger`, top-level `aiUsage` collection, Admin SDK `.add()`). Wired at `index.ts:488-504` — parses the non-streaming Anthropic response body BEFORE `res.send`, wrapped in try/catch so a parse/write failure never breaks the client response (matches must-have's swallow-failure requirement). Unit tests: `functions/src/index.test.ts:2594-2631` (exact shape, orgId null-fallback, token defaults, `.add()` call). |
| 4 | R164: the `api` function carries an explicit `maxInstances` ceiling | ✓ VERIFIED | `functions/src/index.ts:213` (`AI_PROXY_MAX_INSTANCES = Number(process.env.AI_PROXY_MAX_INSTANCES) \|\| 10`) and `index.ts:363` (`onRequest({ secrets: [...], maxInstances: AI_PROXY_MAX_INSTANCES }, ...)`). `grep -c 'maxInstances' functions/src/index.ts` → 2 (declaration + usage). |
| 5 | esv/nlt/planningcenter proxy behavior is byte-for-byte unchanged — none of the four controls run on those upstreams | ✓ VERIFIED | `index.ts:433` (`let outboundBody: unknown = req.body`) only reassigned inside `if (service === "anthropic")` at line 435; the auth/rate-limit/enforcement/ledger blocks are all gated behind the same `service === "anthropic"` check (lines 421, 435, 488). Regression tests: `functions/src/index.test.ts:2302-2314` (PROXY_TARGETS/SECRET_INJECTED for esv/anthropic unchanged), `2320-2366` (`buildUpstreamUrl` esv/anthropic byte-unchanged). Full 290-test functions suite green with no existing esv/nlt/planningcenter assertion changed. |
| 6 | The rate limiter's own Firestore error never takes AI down (fail OPEN) | ✓ VERIFIED | `index.ts:459-466` — the `checkAndConsumeRateLimit` call is wrapped in `try/catch`; on throw, logs a warning and falls through to the fetch (no 429, no block). `checkAndConsumeRateLimit` itself deliberately does not catch its own errors (doc comment at `index.ts:280-284`), leaving the fail-open decision to the caller. Test: `functions/src/index.test.ts:2588-2591` asserts the helper propagates the throw. |
| 7 | The client (`src/utils/claudeApi.ts`) degrades gracefully — returns null, never throws — on a proxy 429/400, logged distinctly | ✓ VERIFIED | `src/utils/claudeApi.ts:171-192` (`logAiProxyError` classifies `err.status === 429`/`400` via `console.warn`, else `console.error`); all three exported AI calls (`getSongSuggestions:337-340`, `getScriptureSuggestions:417-420`, `splitCongregationalReading:626-629`) call it from an unconditional `catch { ...; return null }`. Test run: `npx vitest run src/utils/__tests__/claudeApi.test.ts` → **82/82 passing**, including 429/400 regression coverage for all three exports and `logAiProxyError` classification. |
| 8 | `firestore.rules` carries an explicit deny for `aiUsage`/`aiRateLimits` (committed, UNDEPLOYED) | ✓ VERIFIED | `firestore.rules:442-452` — `match /aiUsage/{docId} { allow read, write: if false; }` and `match /aiRateLimits/{docId} { allow read, write: if false; }`, both placed before the catch-all at line 455 (`grep -c` → 1 each). `git log` confirms these are committed (`d6ae4ae1`) with no `firebase deploy --only firestore:rules` run. Rules suite executed live against the Firestore emulator (`npm run test:rules`): **174/174 tests passing, 0 failed** — includes the `aiUsage / aiRateLimits` deny describe block in `src/rules.test.ts:278-346` (org editor + unauthenticated caller denied read/write on both collections). |
| 9 | `api` function proxy wiring (`/api/**` → `api`) is intact and the controls sit on the live route | ✓ VERIFIED | `firebase.json:18-22` rewrites `/api/**` to the `api` function — unchanged by this phase; `functions/src/index.ts:362-520` is the same handler, now carrying all four controls. |

**Score:** 9/9 truths verified (4 ROADMAP success criteria + 5 plan-level must-haves), 0 behavior-unverified, 0 overrides.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | config reader, verifyAppCaller, enforceModelAndTokens, checkAndConsumeRateLimit, buildUsageEntry/writeUsageLedger, maxInstances, anthropic-branch wiring | ✓ VERIFIED | All present, substantive (not stubs), wired into the `anthropic` branch of the `api` handler (lines 156-520). |
| `functions/src/index.test.ts` | unit tests for exported helpers + limiter/ledger against mocked Firestore | ✓ VERIFIED | `readAiProxyLimits`, `resolveOrgId`, `verifyAppCaller`, `enforceModelAndTokens`, `checkAndConsumeRateLimit`, `buildUsageEntry`, `writeUsageLedger` all covered (lines 2381-2631). Full suite: 290/290 passing. |
| `src/utils/claudeApi.ts` | `logAiProxyError` helper classifying 429/400; catch blocks still return null | ✓ VERIFIED | Lines 171-192, wired into all 3 catch blocks. |
| `src/utils/__tests__/claudeApi.test.ts` | regression guard proving 429/400 resolve to null | ✓ VERIFIED | 82/82 passing (existing repo convention `__tests__/` dir used instead of the plan's literal sibling-file path — documented, correct, and confirmed by running the file). |
| `firestore.rules` | explicit deny for aiUsage/aiRateLimits, UNDEPLOYED | ✓ VERIFIED | Lines 442-452, before catch-all (455); committed at `d6ae4ae1`, not deployed. |
| `src/rules.test.ts` | deny assertions for the two collections | ✓ VERIFIED | Lines 278-346; live emulator run 174/174 passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `verifyAppCaller` | anthropic branch | decoded token held in `decodedCaller`, read as `decoded.uid`/`resolveOrgId(decoded)` | ✓ WIRED | `index.ts:383-392` (auth gate) → `index.ts:448, 497` (uid/orgId reads). |
| Four cost controls | `service === "anthropic"` gate | every control block guarded by the same check | ✓ WIRED | `index.ts:421, 435, 488` — all three `if (service === "anthropic")` blocks. |
| Ledger write | non-streaming Anthropic response `usage` | `JSON.parse(body).usage` before `res.send` | ✓ WIRED | `index.ts:489-498`, wrapped in try/catch so failure never blocks `res.send(body)` at line 506. |
| `enforceModelAndTokens` result | outbound fetch body | `outboundBody` variable feeding `JSON.stringify(outboundBody)` | ✓ WIRED | `index.ts:433, 441, 475`. |
| Client 429/400 | `logAiProxyError` | numeric `.status` read off caught error | ✓ WIRED | `claudeApi.ts:171-176` reads `err.status` structurally; called from all 3 catch blocks. |

### Behavioral Spot-Checks / Test Runs

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Functions build (tsc) | `cd functions && npm run build` | exit 0, clean | ✓ PASS |
| Functions full suite | `cd functions && npm test` | 290/290 passing (8 test files) | ✓ PASS |
| App type-check | `npm run type-check` (`vue-tsc --build`, includes test files) | exit 0, clean | ✓ PASS |
| Client regression file | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | 82/82 passing | ✓ PASS |
| App suite baseline (full, re-run cleanly after a first contended run produced spurious worker-pool timeouts — discarded as a tooling artifact of concurrent verification processes, not a code regression) | `npx vitest run` | 117 files: 115 passed / 2 failed (documented baseline: `src/storage.rules.test.ts` — no Storage emulator up, `RosterView.test.ts` — stale assertion, both pre-existing and unrelated to Phase 65); 3658 tests: 3644 passed / 1 failed / 13 skipped | ✓ PASS (matches documented baseline exactly, no new regressions) |
| Firestore rules suite (live emulator) | `npm run test:rules` | 2 files / 174 tests, 0 failed | ✓ PASS — includes the `aiUsage`/`aiRateLimits` deny assertions |
| R164 grep gate | `grep -c 'maxInstances' functions/src/index.ts` | 2 | ✓ PASS (>= 1) |
| 65-02 grep gates | `grep -c 'match /aiUsage/{docId}' / 'match /aiRateLimits/{docId}' firestore.rules` | 1 / 1 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R161 | 65-01 | Per-user rate limit, 429 on ceiling breach, fail-open | ✓ SATISFIED | `checkAndConsumeRateLimit` + wiring, tested |
| R162 | 65-01 | Model allow-list (400) + max_tokens clamp | ✓ SATISFIED | `enforceModelAndTokens` + wiring, tested |
| R163 | 65-01, 65-02 | Usage ledger entry per request; ledger access hardened | ✓ SATISFIED | `buildUsageEntry`/`writeUsageLedger` + wiring; firestore.rules deny (defense-in-depth) |
| R164 | 65-01 | Explicit `maxInstances` ceiling | ✓ SATISFIED | `AI_PROXY_MAX_INSTANCES` on `api` options object |

No orphaned requirements — REQUIREMENTS.md traceability table maps exactly R161-R164 to Phase 65, all four claimed by the two plans and confirmed in code.

### Anti-Patterns Found

None. Scanned `functions/src/index.ts` (new/modified sections), `functions/src/index.test.ts`, `src/utils/claudeApi.ts`, `firestore.rules`, `src/rules.test.ts` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, empty-implementation patterns, and hardcoded-empty-data patterns. No hits. The model-rejection error message is deliberately generic by design ("not permitted by server policy," not embedding the rejected value) — a documented decision, not a stub.

### Human Verification Required

None. All four ROADMAP success criteria and all plan-level must-haves are provable by code inspection plus automated test execution (unit tests against mocked Firestore/Auth for the rate limiter/ledger/enforcement logic, and a live Firestore emulator run for the rules deny). No behavior-dependent truth was left unexercised — the fail-open path, the 429/400 rejection paths, the ledger write path, and the client graceful-degrade path are all covered by passing named tests, not presence-only checks.

### Gaps Summary

None. All four ROADMAP success criteria for Phase 65 are met with concrete, tested code:

- R161 (rate limit + fail-open): `functions/src/index.ts:285-315` + `:446-466`, tested.
- R162 (model allow-list + token clamp): `functions/src/index.ts:234-265` + `:435-441`, tested.
- R163 (usage ledger): `functions/src/index.ts:336-360` + `:488-504`, tested; plus the 65-02 defense-in-depth `firestore.rules` deny, tested live against the emulator.
- R164 (maxInstances): `functions/src/index.ts:213,363`.

The esv/nlt/planningcenter upstreams are confirmed unaffected (`outboundBody` gating, existing tests unchanged). The client (`src/utils/claudeApi.ts`) degrades gracefully on the new 429/400 failure modes. Deploy of both the function code (`firebase deploy --only functions:api`) and the rules change (`firebase deploy --only firestore:rules`, owner-gated) remain outstanding, per design — this is a handover item for the orchestrator/owner, not a gap in the phase's delivered code.

---

_Verified: 2026-08-20T04:42:25Z_
_Verifier: Claude (gsd-verifier)_
