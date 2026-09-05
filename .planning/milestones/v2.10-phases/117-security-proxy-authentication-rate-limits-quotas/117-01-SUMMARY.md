---
phase: 117-security-proxy-authentication-rate-limits-quotas
plan: 01
subsystem: api
tags: [firebase-functions, firestore, security, rate-limiting, quotas, planningcenter, esv, nlt, pptx, messaging]

# Dependency graph
requires:
  - phase: 112-security-review (v2.8)
    provides: the STRIDE findings SEC-A-01/SEC-C-01/SEC-C-05/SEC-C-06 this plan closes
provides:
  - AUTH_REQUIRED set + broadened api onRequest auth gate closing the unauthenticated /api/planningcenter open relay (R339)
  - Per-uid checkAndConsumeRateLimit layered onto the esv/nlt proxy branches, sharing the anthropic aiRateLimits budget (R340)
  - Collection-parametrized checkAndConsumeRateLimit / checkAndConsumeOrgEmailQuota helpers (optional trailing collectionName, default-preserving)
  - queueServiceMessageHandler per-uid enqueue-rate + per-org daily enqueue quota on dedicated counters (R344)
  - parsePptxHandler per-uid + per-org daily import quota on dedicated counters (R345)
affects: [118-firestore-rules-share-page-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collection-parametrized limiter helpers: checkAndConsumeRateLimit/checkAndConsumeOrgEmailQuota take an optional trailing collectionName so unrelated concerns get dedicated counters without duplicating limiter logic"
    - "Fail-OPEN cost guardrail / fail-CLOSED security gate split, applied consistently across all four new checks"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "AUTH_REQUIRED is a NEW set, distinct from SECRET_INJECTED -- planningcenter is authenticated but injects no server secret"
  - "esv/nlt draw from the SAME shared aiRateLimits per-uid counter as anthropic, not a separate budget"
  - "queueServiceMessage and parsePptx quotas reuse EXISTING appConfig knobs (aiProxy.rateLimitPerMin/Day, messaging.orgDailyEmailQuota) on dedicated counter collections -- no new appConfig field, keeping the frontend appConfigDefaults.ts duplicate out of scope"
  - "All four new limiters fail OPEN on a Firestore error (cost guardrail, not a security control); the planningcenter auth gate is a hard 401 fail-closed"

patterns-established:
  - "Generic per-key daily quota: checkAndConsumeOrgEmailQuota's second arg is now documented as any string key (org or uid), not just an orgId"

requirements-completed: [R339, R340, R344, R345]

coverage:
  - id: D1
    description: "Unauthenticated /api/planningcenter is rejected 401 and never relayed upstream; a valid X-App-Auth request forwards its PCO authorization header and reaches upstream byte-identically (R339)"
    requirement: "R339"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#R339: an unauthenticated /api/planningcenter request (no X-App-Auth) is rejected 401 and never relayed"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R339: an /api/planningcenter request with an INVALID X-App-Auth token is rejected 401 and never relayed"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R339: a valid X-App-Auth /api/planningcenter request forwards the client's PCO authorization header byte-identically, strips x-app-auth, and touches no aiRateLimits/organizations reads"
        status: pass
    human_judgment: false
  - id: D2
    description: "An authenticated caller over the per-uid rate limit is rejected 429 on /api/esv and /api/nlt with the same body shape as anthropic, within-limit usage reaches fetch, and the limiter fails OPEN on a Firestore error (R340)"
    requirement: "R340"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#R340: an authenticated /api/esv caller already at the per-uid MINUTE ceiling gets 429 with the anthropic body shape, and fetch is never called"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R340: the esv per-uid rate limiter fails OPEN (request still succeeds) when the Firestore transaction throws"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R340: a non-anthropic service (esv) now DOES call getAppConfig for its own per-uid rate limit, and still succeeds if getAppConfig rejects (fails open)"
        status: pass
    human_judgment: false
  - id: D3
    description: "queueServiceMessage rejects a caller over the per-uid enqueue rate or per-org daily enqueue quota with resource-exhausted, on dedicated counters independent of the downstream send caps, and fails OPEN on a limiter Firestore error (R344)"
    requirement: "R344"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#R344: a caller over the per-uid enqueue-rate MINUTE ceiling is rejected resource-exhausted, and the enqueue is suppressed"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R344: an org over its per-org daily enqueue quota is rejected resource-exhausted, and the enqueue is suppressed"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R344: a Firestore error inside either enqueue limiter fails OPEN -- the message still enqueues"
        status: pass
    human_judgment: false
  - id: D4
    description: "parsePptx rejects a caller over the per-uid/per-org daily import quota with resource-exhausted, independent of the render service concurrency ceiling, and fails OPEN on a limiter Firestore error (R345)"
    requirement: "R345"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#R345: a caller over the per-uid daily import quota is rejected resource-exhausted, and neither bucket.download nor parsePptxBuffer run"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R345: an org over its per-org daily import quota is rejected resource-exhausted, and neither bucket.download nor parsePptxBuffer run"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#R345: a Firestore error inside either import-quota check fails OPEN -- the parse still runs and returns"
        status: pass
    human_judgment: false
  - id: D5
    description: "Within-limit usage and the sibling anthropic proxy behavior are unchanged; cd functions && npm test passes with no regressions"
    verification:
      - kind: unit
        ref: "cd functions && npm test (18 files, 658 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-04
status: complete
---

# Phase 117 Plan 01: Security — Proxy Authentication, Rate Limits & Quotas Summary

**Closed the v2.8 security review's four Cloud-Functions-only gaps: authenticated the planningcenter open relay, shared the anthropic per-uid budget with esv/nlt, and added dedicated enqueue/import quotas to queueServiceMessage and parsePptx — all on existing appConfig knobs, no schema or frontend changes.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-04T20:05:00-04:00 (approx)
- **Completed:** 2026-09-04T20:17:00-04:00
- **Tasks:** 3 completed
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments

- **R339 (SEC-A-01, milestone's highest-priority finding):** added a new `AUTH_REQUIRED` set (distinct from `SECRET_INJECTED`) containing `planningcenter`. The `api` onRequest auth gate now fires for `AUTH_REQUIRED` in addition to `SECRET_INJECTED`, so an unauthenticated `/api/planningcenter` request is rejected 401 before any upstream relay, while a valid `X-App-Auth` request forwards the client's own PCO OAuth token byte-identically (no server secret injected, no header-forwarding change).
- **R340 (SEC-C-01):** layered the existing per-uid `checkAndConsumeRateLimit` onto the esv/nlt branches, reusing the SAME `aiRateLimits` counter that already guards anthropic (a single shared per-uid AI/Bible-proxy budget, not three separate ones). The org-Bible-enablement gate (R297) stays fail-closed and runs first; the rate limit layers on top and fails open on a Firestore hiccup.
- **R344 (SEC-C-05):** extended `checkAndConsumeRateLimit` and `checkAndConsumeOrgEmailQuota` with an optional trailing `collectionName` parameter (default-preserving for every existing caller), then gave `queueServiceMessageHandler` a per-uid enqueue-rate ceiling (`msgEnqueueRateLimits`) and a per-org daily enqueue quota (`msgEnqueueOrgCounters`), both on dedicated counters independent of the downstream `MESSAGE_MAX_RECIPIENTS`/`ORG_MAX_EMAILS_PER_DAY` send-side caps.
- **R345 (SEC-C-06):** gave `parsePptxHandler` a per-uid (`pptxImportUidCounters`) and per-org (`pptxImportOrgCounters`) daily import quota using the now-generic `checkAndConsumeOrgEmailQuota`, independent of the render service's own `--concurrency=1`/`--max-instances=3` ceiling.
- All four new checks reuse existing `appConfig` knobs (`aiProxy.rateLimitPerMin/Day`, `messaging.orgDailyEmailQuota`) rather than adding new fields, keeping the frontend `appConfigDefaults.ts` duplicate out of scope.
- Added 20 new/updated tests proving each gate/limit fires, within-limit usage and the sibling anthropic path are unaffected, and every new limiter fails open on a Firestore error. Full functions suite: 18 files, 658 tests passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Front-load SEC-A-01 — planningcenter auth gate (R339) + esv/nlt per-uid rate limit (R340)** - `881a4b0a` (feat)
2. **Task 2: queueServiceMessage per-uid + per-org enqueue ceiling (R344), on dedicated counters** - `312719ba` (feat)
3. **Task 3: parsePptx per-uid/per-org daily import quota (R345)** - `889e59b2` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final metadata commit).

## Files Created/Modified

- `functions/src/index.ts` - `AUTH_REQUIRED` set + broadened `api` auth gate (R339); esv/nlt per-uid rate limit layered after `checkOrgBibleEnablement` (R340); `checkAndConsumeRateLimit`/`checkAndConsumeOrgEmailQuota` gained an optional trailing `collectionName` param; `queueServiceMessageHandler` gained a local `db` binding + R344 enqueue-rate/quota checks before the enqueue write; `parsePptxHandler` gained a local `db` binding + R345 import-quota checks before the bucket download/parse.
- `functions/src/index.test.ts` - new/updated tests for all four requirements: `AUTH_REQUIRED` membership tests, three new `api (WR-04)` planningcenter tests, two new esv rate-limit tests, one updated esv/`getAppConfig` test (superseding the now-inaccurate "esv never calls getAppConfig" assertion), two new `checkAndConsumeRateLimit`/`checkAndConsumeOrgEmailQuota` collectionName tests each, four new `queueServiceMessageHandler` R344 tests with an extended `fakeDb` supporting the two dedicated enqueue-counter collections, and four new `parsePptxHandler` R345 tests with an extended `fakeDb` supporting the two dedicated import-counter collections.

## Decisions Made

- `AUTH_REQUIRED` kept as a wholly separate set from `SECRET_INJECTED` rather than widening `SECRET_INJECTED`, per the locked 117-CONTEXT.md decision — avoids implying planningcenter carries a server secret and keeps the secret-injection branch (`if (service === "anthropic") ... else if (service === "esv")`) untouched.
- esv/nlt's rate limit reads live config via `getAppConfig(getFirestore())` with fail-open to `DEFAULT_APP_CONFIG`, mirroring the anthropic branch exactly — this necessarily changed one pre-existing test's assertion (`getAppConfig` is now called for esv, where before it deliberately wasn't); the test was updated to prove the fail-open contract survives instead of asserting the old, now-superseded behavior.
- `checkAndConsumeOrgEmailQuota`'s JSDoc was updated to describe it as a generic per-key daily quota (org OR uid), since Task 3 uses a uid as the key — this is a documentation change only, no signature-breaking behavior change beyond the additive optional param.
- Numeric ceilings for R344/R345 reuse `aiProxy.rateLimitPerMin/Day` and `messaging.orgDailyEmailQuota` verbatim rather than introducing new appConfig fields, per the locked decision that a new knob would require the out-of-scope frontend `appConfigDefaults.ts` duplicate.

## Deviations from Plan

None - plan executed exactly as written. The one pre-existing test update (esv/`getAppConfig` assertion, described above) was an explicit, plan-anticipated consequence of the R340 implementation itself, not a bug fix or scope addition — the plan's own action text specified reading `getAppConfig` in the esv/nlt branch, which necessarily invalidated the old "esv never calls getAppConfig" test title/assertion.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. All changes are server-side Cloud Functions logic with no new secrets, environment variables, or deploy-time configuration.

## Next Phase Readiness

- All four Cloud-Functions-only gaps from the v2.8 security review (backlog 999.5) are closed: SEC-A-01, SEC-C-01, SEC-C-05, SEC-C-06.
- `firestore.rules` and public-share-page hardening (R341, R342, R343, R346, R347, R348) remain deferred to Phase 118 as planned — no work from this plan touches rules files.
- This plan is UNDEPLOYED (per project convention, deploys require explicit per-deploy owner confirmation) — ready for `firebase deploy --only functions` once the owner confirms.

---
*Phase: 117-security-proxy-authentication-rate-limits-quotas*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND: .planning/phases/117-security-proxy-authentication-rate-limits-quotas/117-01-SUMMARY.md
- FOUND: 881a4b0a (Task 1 commit)
- FOUND: 312719ba (Task 2 commit)
- FOUND: 889e59b2 (Task 3 commit)
