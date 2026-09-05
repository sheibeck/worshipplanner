---
phase: 117-security-proxy-authentication-rate-limits-quotas
reviewed: 2026-09-04T20:25:00Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - functions/src/index.ts
  - functions/src/index.test.ts
  - functions/src/appConfig.ts
findings:
  critical: 0
  high: 0
  warning: 3
  info: 3
  total: 6
status: findings
---

# Phase 117: Code Review Report

**Reviewed:** 2026-09-04T20:25:00Z
**Depth:** deep (cross-file, security-focused)
**Files Reviewed:** 3 (`functions/src/index.ts`, `functions/src/index.test.ts`, `functions/src/appConfig.ts`)
**Status:** findings (0 Critical, 0 High, 3 Warning, 3 Info)

## Summary

This is a security-hardening phase across three commits (`881a4b0a`, `312719ba`, `889e59b2`). I
reviewed each security-critical claim adversarially, traced the call chains, and ran the full
standalone functions suite (`cd functions && npm test` → **18 files, 658 tests, all pass**).

**The four core security controls are correctly implemented.** In priority order:

1. **R339 (the highest-value fix) genuinely closes the hole.** `AUTH_REQUIRED = {planningcenter}` is
   OR'd into the auth gate at `index.ts:518`, which runs *before* header forwarding, secret
   injection, `buildUpstreamUrl`, and `fetch`. An unauthenticated or invalid-token
   `/api/planningcenter` request gets a hard `401 {error:"Authentication required"}` and never
   reaches `fetch`. The gate **fails closed**: `verifyAppCaller` (`:143-150`) catches every
   `verifyIdToken` throw and returns `null`, and a non-string `x-app-auth` coerces to `undefined` →
   `null` → 401. There is **no bypass** — all four `PROXY_TARGETS` keys are now covered
   (`SECRET_INJECTED` ∪ `AUTH_REQUIRED`), and the `PROXY_TARGETS[service]` lookup is case-sensitive so
   `/api/PlanningCenter` 404s rather than slipping through.

2. **Byte-identical PCO forwarding is preserved.** For `planningcenter`, `authorization` is forwarded
   via `FORWARDED_HEADERS`, the secret-injection branch (`:555-562`) matches only `anthropic`/`esv`
   and never overwrites it, `buildUpstreamUrl` short-circuits for non-nlt, and `outboundBody = req.body`
   is untouched. `x-app-auth` is stripped (`:552`). The test at test-file `R339: a valid X-App-Auth …`
   asserts exactly this plus `getFirestore().not.toHaveBeenCalled()`.

3. **Fail-open vs fail-closed split is correct.** The planningcenter auth gate is fail-CLOSED; all
   four rate/quota limiters are fail-OPEN. In `queueServiceMessage`/`parsePptx` the fail-open `catch`
   correctly **re-throws `HttpsError`** (`:2xxx`, `:8xx`), so a genuine `resource-exhausted` rejection
   is never swallowed by the cost-guardrail catch — only a Firestore infrastructure error falls
   through to an allow.

4. **R340 shares the real counter.** The esv/nlt branch calls
   `checkAndConsumeRateLimit(getFirestore(), decodedCaller!.uid, aiLimits)` with **no** `collectionName`
   arg → defaults to `"aiRateLimits"`, the same collection and same uid keying as the anthropic branch.
   It is not a parallel budget; a caller cannot double their allowance across upstreams. The
   `checkOrgBibleEnablement` gate still runs first and stays fail-closed (a disabled org is 403'd
   without consuming budget).

5. **R344/R345 counters are correctly isolated.** Dedicated collections
   (`msgEnqueueRateLimits`, `msgEnqueueOrgCounters`, `pptxImportUidCounters`, `pptxImportOrgCounters`)
   never collide with `aiRateLimits`/`orgEmailCounters`. Both per-uid AND per-org dimensions are
   enforced. The rate limiter uses `>=` and the quota uses projected `dayCount + count > limit` — no
   off-by-one that lets the ceiling be exceeded. Counter keys derive only from server-verified
   identity (`request.auth.uid`, and an `orgId` re-validated by the independent membership check that
   precedes the limiter), so they can't be spoofed to poison another tenant's counter.

6. **Test integrity holds.** The renamed esv test (old: "esv never calls getAppConfig" → new: "esv now
   DOES call getAppConfig … and still succeeds if getAppConfig rejects") is a *legitimate* update: the
   old invariant became intentionally false when R340 added a config read to the esv branch. No real
   invariant was deleted — the fail-open contract is still asserted. The new tests assert the REJECT
   paths (401 / 429 / `resource-exhausted`) fire AND that `fetch`/`setSpy`/`bucket.download`/
   `parsePptxBuffer` are NOT reached, not just the happy path. The anthropic path is byte-unchanged.

No Critical or High findings. The findings below are operability/coupling and coverage-hardening
concerns, none of which block shipping the security fix.

## Warnings

### WR-01: appConfig knob overloading couples three unrelated subsystems (Medium)

**File:** `functions/src/index.ts:2414-2415, 2426`, `:825-829, 838-840`
**Issue:** R344/R345 reuse existing appConfig knobs rather than adding new fields (a deliberate,
documented scoping decision to avoid the frontend `appConfigDefaults.ts` duplicate). The side effect is
real operational coupling that is invisible to an operator:
- `aiProxy.rateLimitPerMin`/`rateLimitPerDay` now governs the AI/Bible proxy budget **and** the
  message-enqueue rate **and** (perDay) the parsePptx per-uid daily import ceiling.
- `messaging.orgDailyEmailQuota` now governs the daily email send cap **and** the message-enqueue
  daily quota **and** the parsePptx per-org daily import ceiling.

An admin who lowers `aiProxy.rateLimitPerDay` to control Claude spend will silently also cut every
user's daily PowerPoint-import allowance and message-enqueue budget. Nothing in the config UI or these
knobs' names signals that. The counters are correctly separate (no shared depletion), but the *ceilings*
are not independently tunable.
**Fix:** Accept for this phase (matches the locked decision), but track a follow-up to introduce
dedicated `messaging.enqueueRateLimitPerMin/Day` and `imports.pptxDailyPerUid/PerOrg` knobs (plus the
frontend duplicate) so the three ceilings can be tuned without cross-effects. At minimum, document the
overloading in the appConfig admin surface so an operator adjusting one value understands the blast
radius.

### WR-02: Non-atomic cross-counter consume over-charges the per-uid counter on an org-ceiling reject (Low)

**File:** `functions/src/index.ts:2409-2445` (queue), `:810-850` (pptx)
**Issue:** Both handlers consume the per-uid counter *first*, then check the per-org counter. If the
per-uid check passes (and increments) but the per-org quota is over the limit, the handler throws
`resource-exhausted` — yet the per-uid counter was already incremented for a request that produced no
enqueue/import. Once an org sits at its daily cap, every subsequent rejected attempt still burns each
member's per-minute/per-day budget. This is more-restrictive (never a security weakening) and the two
`runTransaction`s cannot be made atomic together cheaply, but it is a latent fairness/accuracy quirk.
**Fix:** Low priority. If it ever matters, check the per-org quota first (org caps are the coarser,
more-likely-binding constraint), or make the uid consume conditional on the org check passing. No change
required to ship.

### WR-03: /api/planningcenter has no per-caller throttle after the auth fix (Low)

**File:** `functions/src/index.ts:518-526, 634` (planningcenter falls through with no rate limit)
**Issue:** R339 closes the *unauthenticated* open relay, but post-fix an authenticated user has **no**
per-uid rate limit on `planningcenter` (unlike esv/nlt, which R340 just put under the shared
`aiRateLimits` budget). A signed-in caller can still drive unbounded requests through our Cloud Function
to `api.planningcenteronline.com`, consuming our function invocations/egress (compute-cost DoS) even
though they forward their own PCO OAuth token. The threat model (T-117-01) scoped planningcenter to
"authenticate, do not secret-inject," so this is within the locked decision — but it is a residual
DoS-on-our-compute surface worth naming.
**Fix:** Consider layering the same fail-open per-uid `checkAndConsumeRateLimit` onto the planningcenter
branch (on its own dedicated counter, since it is not part of the paid AI budget). Out of scope for this
phase; flag for the backlog.

## Info

### IN-01: No regression guard that every PROXY_TARGET is gated (Low)

**File:** `functions/src/index.ts:77-94`
**Issue:** Safety now depends on every `PROXY_TARGETS` key appearing in `SECRET_INJECTED` ∪
`AUTH_REQUIRED`. A future contributor adding a fifth proxy target without adding it to a gate set would
silently reopen an unauthenticated open relay — exactly the SEC-A-01 class this phase fixed. The
existing tests assert membership per-service but not the *invariant*.
**Fix:** Add a test asserting `Object.keys(PROXY_TARGETS).every(s => SECRET_INJECTED.has(s) ||
AUTH_REQUIRED.has(s))`. Cheap, and it turns the whole finding class into a red build.

### IN-02: nlt rate-limit path is exercised only transitively (Low)

**File:** `functions/src/index.test.ts` (R340 tests use `fakeEsvReq` only)
**Issue:** R340 applies to `service === "esv" || service === "nlt"` via one shared branch, but the new
429 / fail-open tests only drive `/api/esv`. The nlt path is covered only by the shared branch logic,
not an explicit assertion. Low risk given the identical code path, but an nlt-specific 429 test would
close the gap and guard against a future divergence in the branch.
**Fix:** Add one `/api/nlt` over-ceiling test mirroring the esv case.

### IN-03: The config-read + fail-open block is duplicated four times (Low)

**File:** `functions/src/index.ts:584-591, 651-658, 2401-2408, 812-819`
**Issue:** The `let config = DEFAULT_APP_CONFIG; try { config = await getAppConfig(db); } catch { warn }`
pattern is now copy-pasted in four handlers. Each copy is correct, but the duplication invites drift
(e.g., a future fix applied to three of four sites). Note also that `readAiProxyLimits(config)` sits
just *outside* each try/catch — harmless today because `getAppConfig` always resolves a fully-merged
config in production, but a shared helper would make the fail-open contract explicit and single-sourced.
**Fix:** Extract a `readConfigOrDefault(db)` helper. Non-blocking maintainability improvement.

---

_Reviewed: 2026-09-04T20:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
