---
phase: 117-security-proxy-authentication-rate-limits-quotas
verified: 2026-09-04T20:45:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 117: Security — Proxy Authentication, Rate Limits & Quotas Verification Report

**Phase Goal:** Every Cloud Functions entry point that currently has no authentication or no
rate/quota ceiling gets one — closing the open-relay and unthrottled-fan-out gaps the v2.8 security
review found, starting with the highest-priority finding (SEC-A-01).
**Verified:** 2026-09-04T20:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unauthenticated `/api/planningcenter` → 401, never relayed; valid `X-App-Auth` works as before (R339) | ✓ VERIFIED | `functions/src/index.ts:87-94,518-526` — new `AUTH_REQUIRED = new Set(["planningcenter"])`, OR'd into the auth gate at `:518` which runs before header forwarding, secret injection, and `fetch`. Read the code directly: a null `decodedCaller` returns `401 {error:"Authentication required"}` before `target`/`fetch` is touched. Independently ran `cd functions && npm test` — tests `R339: an unauthenticated /api/planningcenter request...` and `R339: an /api/planningcenter request with an INVALID X-App-Auth token...` (index.test.ts:4908,4919) assert `res.status` 401 + `fetchMock` never called. `R339: a valid X-App-Auth /api/planningcenter request...` (index.test.ts:4936) asserts `fetchOpts.headers.authorization` forwarded byte-identically, `x-app-auth` stripped, and `getFirestore` never called (no cost-control side effects on this branch). All pass. |
| 2 | Authenticated caller over the per-uid rate limit is rejected on `/api/esv` and `/api/nlt` like anthropic (R340) | ✓ VERIFIED | `functions/src/index.ts:634-671` — esv/nlt branch, AFTER the fail-closed `checkOrgBibleEnablement` gate, calls `checkAndConsumeRateLimit(getFirestore(), decodedCaller!.uid, aiLimits)` with no `collectionName` arg, defaulting to `"aiRateLimits"` — the SAME collection/counter anthropic uses (`:603-607`), so it is one shared per-uid budget, not a parallel one. Test `R340: an authenticated /api/esv caller already at the per-uid MINUTE ceiling gets 429...` (index.test.ts:4964) seeds the shared `aiRateLimits` collection and asserts `res.status` 429 with `{scope:"minute", retryAfterSec:60}` (the anthropic body shape) and `fetchMock` not called. `R340: the esv per-uid rate limiter fails OPEN...` (index.test.ts:5003) proves the Firestore-throw fail-open contract. Both pass. |
| 3 | `queueServiceMessage` rejects a caller over a per-uid/per-org enqueue ceiling (R344) | ✓ VERIFIED | `functions/src/index.ts:2400-2462` — after the membership/role/kill-switch checks and before the `messageRef.set` enqueue, consumes `checkAndConsumeOrgEmailQuota(..., "msgEnqueueOrgCounters")` (per-org) then `checkAndConsumeRateLimit(..., "msgEnqueueRateLimits")` (per-uid), both DEDICATED collections distinct from `aiRateLimits`/`orgEmailCounters`. Either `!allowed` throws `HttpsError("resource-exhausted", ...)`. Tests `R344: a caller over the per-uid enqueue-rate MINUTE ceiling...` and `R344: an org over its per-org daily enqueue quota...` (index.test.ts:2887,2904) both assert `rejects.toMatchObject({code:"resource-exhausted"})` AND `setSpy` (the enqueue write) NOT called. `R344: a within-limit caller still enqueues...` and the fail-open test (index.test.ts:2923,2933) confirm no regression. All pass. |
| 4 | `parsePptx` rejects a caller over a per-uid/per-org daily import quota (R345) | ✓ VERIFIED | `functions/src/index.ts:805-865` — after the independent org-membership check and before `bucket.file(storagePath).download()`, consumes `checkAndConsumeOrgEmailQuota(..., "pptxImportOrgCounters")` then `(..., "pptxImportUidCounters")`, both dedicated collections. Either over-ceiling throws `resource-exhausted`. Tests `R345: a caller over the per-uid daily import quota...` and `R345: an org over its per-org daily import quota...` (index.test.ts:716,735) assert `rejects.toMatchObject({code:"resource-exhausted"})` AND both `file` (bucket.download) and `parsePptxBuffer` NOT called. `R345: a within-quota caller still returns { slides }` and the fail-open test (index.test.ts:756,768) confirm no regression. All pass. |
| 5 | The functions test suite passes with NEW tests proving each gate/limit fires AND within-limit + anthropic behavior unaffected | ✓ VERIFIED | Ran `cd functions && npm test` directly (not trusting SUMMARY's reported count): **18 test files, 660 tests, all passed**, 8.60s. This is the standalone functions vitest suite per CLAUDE.md guidance, not the root vitest. `npx tsc --noEmit -p tsconfig.json` also produced zero errors. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | AUTH_REQUIRED set + broadened auth gate; esv/nlt per-uid rate limit; collection-parametrized limiter helpers; queue + pptx quota consumes | ✓ VERIFIED | All present, read directly at cited line numbers above. `checkAndConsumeRateLimit` (index.ts:375) and `checkAndConsumeOrgEmailQuota` (index.ts:423) both carry the new optional trailing `collectionName` param, default-preserving. |
| `functions/src/index.test.ts` | New planningcenter/esv/nlt/queue/pptx gate+limit tests; extended helper collection-routing tests | ✓ VERIFIED | 16 new/updated tests confirmed present by name (R339×3, R340×2 new + 1 updated, R344×4, R345×4), all independently confirmed passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `api` onRequest auth gate | `AUTH_REQUIRED` set | `SECRET_INJECTED.has(service) \|\| AUTH_REQUIRED.has(service)` (index.ts:518) | ✓ WIRED | Confirmed by direct read; `planningcenter` is in `AUTH_REQUIRED` (index.ts:94) and NOT in `SECRET_INJECTED` (index.ts:87), matching the R339 locked decision (authenticate, don't secret-inject). |
| esv/nlt branch | shared `aiRateLimits` counter | `checkAndConsumeRateLimit(getFirestore(), decodedCaller!.uid, aiLimits)` with no collectionName override (index.ts:661-665) | ✓ WIRED | Defaults to `"aiRateLimits"` — same collection anthropic uses, confirmed by reading `checkAndConsumeRateLimit`'s default param (index.ts:380). |
| `queueServiceMessageHandler` | dedicated enqueue counters | `checkAndConsumeOrgEmailQuota(..., "msgEnqueueOrgCounters")` / `checkAndConsumeRateLimit(..., "msgEnqueueRateLimits")` (index.ts:2422-2445), gate BEFORE `messageRef.set` (index.ts:2466) | ✓ WIRED | Confirmed ordering: quota checks precede the enqueue write; a reject throws before `set()` is reached (tests assert `setSpy` not called on reject). |
| `parsePptxHandler` | dedicated import counters | `checkAndConsumeOrgEmailQuota(..., "pptxImportOrgCounters")` / `(..., "pptxImportUidCounters")` (index.ts:827-848), gate BEFORE `bucket.file(...).download()` (index.ts:869) | ✓ WIRED | Confirmed ordering: quota checks precede storage download/parse; tests assert `file`/`parsePptxBuffer` not called on reject. |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full standalone functions suite passes | `cd functions && npm test` | 18 files, 660 tests, all passed (8.60s) | ✓ PASS |
| Functions package type-checks clean | `cd functions && npx tsc --noEmit -p tsconfig.json` | No output / zero errors | ✓ PASS |
| No files outside functions/ touched by the three phase commits | `git show --stat 881a4b0a 312719ba 889e59b2` | Only `functions/src/index.ts` + `functions/src/index.test.ts` in all three commits | ✓ PASS |
| No debt markers introduced | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER" functions/src/index.ts` | 1 hit, a comment explicitly stating something is NOT a TODO — no actual debt marker | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R339 | 117-01-PLAN.md | planningcenter proxy requires auth, rejects 401 | ✓ SATISFIED | index.ts:94,518-526 + 3 passing tests |
| R340 | 117-01-PLAN.md | esv/nlt share anthropic's per-uid rate limit | ✓ SATISFIED | index.ts:646-671 + 2 passing tests |
| R344 | 117-01-PLAN.md | queueServiceMessage per-uid/per-org enqueue ceiling | ✓ SATISFIED | index.ts:2400-2462 + 4 passing tests |
| R345 | 117-01-PLAN.md | parsePptx per-uid/per-org daily import quota | ✓ SATISFIED | index.ts:805-865 + 4 passing tests |

No orphaned requirements — REQUIREMENTS.md's traceability table maps exactly R339/R340/R344/R345 to Phase 117, all four claimed by 117-01-PLAN.md's frontmatter.

### Anti-Patterns Found

None. Scanned `functions/src/index.ts` for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER — only one incidental match, a comment explicitly disclaiming a TODO ("it is a tested behaviour, not a TODO"), not a real debt marker.

The prior code review (`117-REVIEW.md`, 0 Critical/0 High, 3 Warning/3 Info) flagged three non-blocking Warnings — appConfig knob overloading (WR-01), non-atomic cross-counter consume order (WR-02, since fixed per the code: org-quota is now checked before uid in both queue and pptx handlers, matching the WR-02 fix comments visible at index.ts:820-826 and :2416-2421), and no per-caller throttle on planningcenter itself post-auth-fix (WR-03, explicitly scoped out of this phase's locked decision). None of these block the phase goal; they are documented follow-up candidates, not gaps in the stated success criteria.

### Human Verification Required

None. This phase is a pure Cloud-Functions backend change (auth gate + rate/quota limiters) with a fully deterministic, code/test-verifiable success surface — no UI, no visual, no external-service dependency requiring a human to confirm.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria for Phase 117 are independently verified true against the current codebase:
1. R339 — planningcenter auth gate confirmed in code and by 3 passing tests exercising unauthenticated, invalid-token, and valid-token paths.
2. R340 — esv/nlt share the anthropic per-uid `aiRateLimits` budget, confirmed by code and 2 passing tests (429 reject + fail-open).
3. R344 — queueServiceMessage's dedicated per-uid/per-org enqueue ceilings confirmed by code and 4 passing tests.
4. R345 — parsePptx's dedicated per-uid/per-org daily import quota confirmed by code and 4 passing tests.
5. The functions suite (18 files, 660 tests) passes end-to-end when run directly by the verifier, and the package type-checks clean.

No `firestore.rules`, `storage.rules`, or frontend file was touched (confirmed via `git show --stat` on all three phase commits), matching the plan's explicit scope boundary. This plan is built and tested but UNDEPLOYED per project convention — deploy requires explicit per-deploy owner confirmation (not a gap in the phase goal itself, which is code/test-scoped).

---

*Verified: 2026-09-04T20:45:00Z*
*Verifier: Claude (gsd-verifier)*
