---
phase: 69-firestore-runtime-config
verified: 2026-08-20T15:05:00Z
status: human_needed
score: 8/8 must-haves verified (code-side); 2 items deploy-dependent, deferred
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "R181 — after the owner deploys the 7 managed functions (functions/DEPLOY-RUNTIME-CONFIG.md), write a value to appConfig/global (e.g. flip cleanup.mediaEnabled or lower aiProxy.rateLimitPerMin) and confirm a hot path (api proxy) and a cron path (next scheduled cleanup/reminder run) reflect it with NO redeploy in between."
    expected: "The live config change takes effect on both a hot path and the next cron run without redeploying functions."
    why_human: "Requires actual Cloud Functions deployment plus a real appConfig/global write against live infrastructure — cannot be proven by a unit test against a mocked ./appConfig module. This phase ships built + tested + UNDEPLOYED per the v1.9 grant."
  - test: "R183 — confirm the ~60s TTL cache's real cross-instance staleness window on a hot path against deployed, warm Cloud Functions v2 instances."
    expected: "A config change becomes visible on a hot path within roughly the TTL window (~60s), not instantly and not indefinitely stale."
    why_human: "The cached-vs-fresh routing and the TTL/fresh-bypass/TTL-expiry logic itself are unit-proven (appConfig.test.ts, 3 passing cases with asserted Firestore .get() call counts); only the real-world cross-instance timing requires a live deployment to observe."
---

# Phase 69: Firestore Runtime Config Verification Report

**Phase Goal:** Every v1.8 knob lives in `appConfig/global`, read by Cloud Functions at runtime with per-knob fail-open/closed defaults, so a change takes effect with no redeploy.
**Verified:** 2026-08-20T15:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1/R180 — All v1.8 levers live in `appConfig/global`'s shape: 4 cleanup flags, retention windows, delete cap, AI-proxy knobs (rate limits, allow-list, max_tokens ceiling), messaging knobs (cron flag, recipient cap, org quota) | ✓ VERIFIED | `functions/src/appConfig.ts:24-58` `AppConfig` interface covers every knob named in the SC; `DEFAULT_APP_CONFIG` (lines 64-97) mirrors each with a source-line cite to its prior `process.env`/`defineString` origin. Rules gate (super-admin-only read/write) shipped in Phase 68 (`firestore.rules:473-474`, `isSuperAdmin()`), unmodified and unaffected by this phase. |
| 2 | SC2/R181 (code-side) — Every managed handler reads its knob from `getAppConfig()`; no managed `process.env` read remains | ✓ VERIFIED | `grep -n "process\.env\." functions/src/index.ts` → exactly 2 lines (`AI_PROXY_MAX_INSTANCES` L232, `GLOBAL_MAX_INSTANCES` L241 — both R185-excluded). `grep -c "MESSAGE_FROM_ADDRESS" functions/src/index.ts` → 0. `getAppConfig` called at 7 call-sites (L552, 1041, 1206, 1449, 1678, 2002, 2657) covering all 4 cleanup handlers + api proxy + messaging cron + sendQueuedMessage. |
| 2b | SC2/R181 (live, no-redeploy) — Changing a value in a DEPLOYED `appConfig/global` changes runtime behavior with no redeploy | ⬜ DEFERRED (human_needed) | Cannot be observed without an actual Cloud Functions deploy; this phase ships built+tested+UNDEPLOYED per the v1.9 grant. See Human Verification below. |
| 3 | SC3/R182 — Deleting/emptying `appConfig/global` reproduces today's exact behavior byte-for-byte via deep-merged defaults | ✓ VERIFIED | `appConfig.test.ts` "R182 empty doc reproduces defaults" (exists:false AND exists:true+{}) and "R182 partial doc deep-merge" both pass — `cd functions && npx vitest run src/appConfig.test.ts` → 29/29 green. |
| 4 | SC4/R183 — Hot paths (`api`, `sendQueuedMessage`) read the TTL-cached form; the 4 cleanup crons + `sendScheduledReminders`/`runScheduledMessagingCron` always read `{fresh:true}` | ✓ VERIFIED | Code inspection of all 7 call-sites: L552 (`api`) and L2657 (`sendQueuedMessage`) call `getAppConfig(db)` with NO fresh flag (cached); L1041/1206/1449/1678/2002 (the 4 cleanup handlers + messaging cron) all call `getAppConfig(db, { fresh: true })`. Cache-hit/fresh-bypass/TTL-expiry mechanics are behaviorally proven in `appConfig.test.ts`'s R183 block (asserted `.get()` call counts via `vi.useFakeTimers()`). |
| 4b | SC4/R183 (live) — Real cross-instance TTL staleness window on a deployed hot path | ⬜ DEFERRED (human_needed) | Requires real warm Cloud Functions v2 instances; deploy-dependent. See Human Verification below. |
| 5 | SC5/R184 — Per-knob fail-safe: cleanup flags + AI allow-list fail CLOSED on malformed input; rate limits/retention/caps fail OPEN but capped, never one blanket policy | ✓ VERIFIED | `appConfig.ts` `coerceEnableFlag` (raw===true only), `coerceAllowedModels` (non-array/empty falls to restrictive default), `coerceConfigNumber`/`coercePositiveInt` (NaN/Infinity/negative/non-integer fall to capped default, genuine `0` honored). `appConfig.test.ts` "R184 fail closed" + "R184 fail open capped" parametrized blocks pass, including the `coerceConfigNumber` negative-value fix (`-1` → default, applied to all 9 numeric knobs, not just `deleteCapPerRun`). |
| 6 | SC6/R185 — `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES`/render-service caps remain `process.env`/deploy-time only | ✓ VERIFIED | `grep -n "process\.env\." functions/src/index.ts` → only those 2 lines remain, both untouched module-scope reads at L232/L241. `git diff 36d7b375 HEAD --stat -- render-service/` → empty (render-service caps untouched). `index.test.ts` "setGlobalOptions (R172...)" regression test still passes. |
| 7 | R190 (preserved) — `cleanupOrphanBackgroundsHandler`'s `referencesComplete`/floor-guard block is unchanged; its existing tests pass unchanged | ✓ VERIFIED | Code read of `index.ts:1447-1521`: only the `dryRun` line (L1453, `!config.cleanup.backgroundEnabled`) and the trailing `readBackgroundRetentionDays(config)`/`readDeleteCap(config)` call-site args changed; `referencedPaths`/`trackUrl`/tier-1/2/3 scans/floor-guard (L1511-1515)/`effectiveDryRun` (L1517) are byte-identical in structure and logic to the pre-swap version. `cd functions && npx vitest run src/index.test.ts -t "cleanupOrphanBackgroundsHandler"` → 15/15 pass, assertions unchanged. |
| 8 | Owner hand-over: exact deploy command + built+tested+UNDEPLOYED framing + RESEND_API_KEY-stays-secret constraint recorded | ✓ VERIFIED | `functions/DEPLOY-RUNTIME-CONFIG.md` exists; contains the exact scoped `firebase deploy --only functions:api,functions:cleanupExpiredMedia,...` command, "built, tested, and undeployed" banner, `RESEND_API_KEY` secret-safety section, R185 deploy-time-knob note, and points R181/R183 deferred items at `69-VALIDATION.md`'s Manual-Only table. |

**Score:** 8/8 code-verifiable truths verified. 2 sub-items (2b, 4b) are explicitly DEPLOY-dependent and routed to human verification per the v1.9 grant — never recorded as passed.

### Test-Count Delta Investigation (428 → 416, net −12)

**Finding: Legitimate consolidation, not a coverage loss.**

- 69-01 added `appConfig.test.ts` (29 new tests) on top of the pre-existing 399, reaching 428/428.
- 69-02's `index.test.ts` diff (`git diff 790bdd61 48c2b158 -- src/index.test.ts`) shows 36 `it(...)` blocks removed and 24 added — net −12, exactly matching 428→416.
- Categorizing the 36 removed blocks:
  - **~24 are redundant coercion/string-parsing tests** now owned by `appConfig.test.ts`: per-cleanup-handler "FAILS SAFE: unset/empty/false/1/True" string-variant tests (previously 4-5 near-duplicate cases per handler, consolidated to one "unset/default" case per handler); `readAiProxyLimits`' env-parsing tests ("parses all four knobs from env", "drops empty entries from comma-separated list", "falls back to defaults for non-numeric knobs") — this exact coercion logic is now exhaustively covered by `appConfig.test.ts`'s parametrized "R184 fail closed"/"R184 fail open capped" blocks (confirmed: 29/29 pass, including the `-1`/`NaN`/`Infinity`/`"abc"`/`null` cases for every numeric knob and the allow-list fail-closed cases).
  - **12 are behavioral/wiring tests, all preserved 1:1 (renamed only)**: "an over-cap send (MESSAGE_MAX_RECIPIENTS) is REJECTED" → "an over-cap send (config.messaging.maxRecipients) is REJECTED"; "an org at/over ORG_MAX_EMAILS_PER_DAY... failed/skipped" → "...config.messaging.orgDailyEmailQuota..."; "under both default limits..." → same, config-worded; "From = the org's name... over MESSAGE_FROM_ADDRESS" → "...over config.sender.fromAddress"; "peels a display name... (422 repro)" → same, config-worded; the `runScheduledMessagingCron` "performs ZERO collectionGroup reads" and "runs both sweeps" tests → preserved. Verified present and passing in the current `index.test.ts` via `grep` and the full 416/416 green run.
- The `★ SOURCE INSPECTION` gate-direction-pin test for `cleanupExpiredMedia` (referencing the 2026-07-28 inverted-gate incident) is untouched (not part of the diff) and still present at L1233.
- `cleanupOrphanBackgroundsHandler`'s 15-test block (R190) was not touched by the consolidation and passes unchanged (verified separately above).

**Conclusion:** No behavioral assertion (over-cap rejection, org quota, sender address, display-name wrapping, cron-gate sweep triggering, R190 fail-safes) was silently dropped. The −12 is entirely redundant coercion-detail tests whose logic moved to `appConfig.ts` and is now covered there — a deliberate, disclosed consolidation (documented in 69-02-SUMMARY.md's key-decisions), not a coverage regression.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/appConfig.ts` | AppConfig type, DEFAULT_APP_CONFIG, coerce* layer, deep-merge, TTL-cached reader | ✓ VERIFIED | Exists, substantive (303 lines, no stubs), wired — imported at `index.ts:31`, called at 7 sites. |
| `functions/src/appConfig.test.ts` | R180/R182/R183/R184 unit coverage | ✓ VERIFIED | 29/29 tests pass (`npx vitest run src/appConfig.test.ts`). |
| `functions/src/index.ts` | 17 read-sites swapped, MESSAGE_FROM_ADDRESS removed, R185/R190 preserved | ✓ VERIFIED | Confirmed via grep + code read above. |
| `functions/src/index.test.ts` | env→config-mock conversion, assertions unchanged | ✓ VERIFIED | `vi.mock("./appConfig", ...)` seam at L151; 416/416 pass. |
| `functions/DEPLOY-RUNTIME-CONFIG.md` | Owner hand-over runbook, non-executing | ✓ VERIFIED | Exists, contains exact scoped deploy command, UNDEPLOYED framing, RESEND_API_KEY constraint, pre-flight gates, deferred-verification pointers. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `index.ts` | `appConfig.ts` | `import { getAppConfig, type AppConfig } from "./appConfig"` | WIRED | L31, confirmed. |
| `sendQueuedMessageHandler` | `getAppConfig` | Called once before the recipient/claim loop | WIRED | L2657, before the transaction claim (L2668) and any per-recipient loop; comment explicitly documents "never re-resolve inside the recipient loop." |
| `index.test.ts` | `./appConfig` module | `vi.mock` seam, mirrors `./pptxParser`/`./renderInvoker` pattern | WIRED | L151, `vi.mock("./appConfig", async (importOriginal) => ...)`, re-exports real `DEFAULT_APP_CONFIG`. |
| `sendQueuedMessageHandler` | `config.sender.fromAddress` | Replaces `MESSAGE_FROM_ADDRESS.value()` | WIRED | L2848 `bareEmailAddress(config.sender.fromAddress)`; `MESSAGE_FROM_ADDRESS` declaration fully removed (0 matches). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full functions suite | `cd functions && npm test` | 416/416 pass (12 test files) | ✓ PASS |
| appConfig unit coverage | `cd functions && npx vitest run src/appConfig.test.ts` | 29/29 pass | ✓ PASS |
| R190 fail-safe preservation | `cd functions && npx vitest run src/index.test.ts -t "cleanupOrphanBackgroundsHandler"` | 15/15 pass (240 skipped — scoped by `-t`) | ✓ PASS |
| Functions build | `cd functions && npm run build` | Clean, no output/errors | ✓ PASS |
| Root type-check | `npm run type-check` (vue-tsc --build) | Clean, no output/errors | ✓ PASS |
| `process.env.` residue in index.ts | `grep -n "process\.env\." functions/src/index.ts` | Exactly 2 lines: `AI_PROXY_MAX_INSTANCES` (L232), `GLOBAL_MAX_INSTANCES` (L241) | ✓ PASS |
| `MESSAGE_FROM_ADDRESS` residue | `grep -c "MESSAGE_FROM_ADDRESS" functions/src/index.ts` | 0 | ✓ PASS |
| App-suite baseline unaffected | `npx vitest run` (root) | 2 known-failing files (`storage.rules.test.ts`, `RosterView.test.ts`), 3780 passed, matches documented CLAUDE.md baseline | ✓ PASS (baseline held, no new regression) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|--------------|--------|----------|
| R180 | 69-01 | AppConfig shape covers every managed knob | ✓ SATISFIED | `appConfig.ts` type + defaults; REQUIREMENTS.md marked Complete. |
| R181 | 69-01/02/03 | Runtime read, no redeploy for a config change | ◐ PARTIAL — code-side SATISFIED, live-behavior DEFERRED (human_needed) | All read-sites swapped and tested; live no-redeploy behavior requires deployment (not done, per v1.9 grant). |
| R182 | 69-01 | Empty/missing doc reproduces defaults byte-for-byte | ✓ SATISFIED | `appConfig.test.ts` R182 blocks pass. |
| R183 | 69-01/02 | Correct cache routing (TTL hot paths, fresh crons) | ◐ PARTIAL — code-side SATISFIED, real staleness DEFERRED (human_needed) | Routing + TTL/fresh/expiry mechanics unit-proven; real cross-instance timing requires deployment. |
| R184 | 69-01 | Per-knob fail-open/closed | ✓ SATISFIED | Parametrized tests pass for every knob. |
| R185 | 69-02 | Deploy-time knobs excluded, untouched | ✓ SATISFIED | grep + diff confirm. |

No orphaned requirements found for Phase 69 in REQUIREMENTS.md beyond R180-R185, all of which are claimed by the three plans.

### Anti-Patterns Found

None in Phase-69-touched files (`functions/src/appConfig.ts`, `functions/src/appConfig.test.ts`, `functions/src/index.ts`, `functions/src/index.test.ts`, `functions/DEPLOY-RUNTIME-CONFIG.md`). The single `TODO` grep hit in `index.ts:853` ("it is a tested behaviour, not a TODO") is pre-existing, unrelated PPTX-render-service code, not touched by this phase.

### Human Verification Required

### 1. R181 — Live no-redeploy behavior

**Test:** After the owner runs the deploy command in `functions/DEPLOY-RUNTIME-CONFIG.md` (the 7 managed functions), write a value directly to `appConfig/global` in the Firebase Console (e.g. flip `cleanup.mediaEnabled` to `true`, or lower `aiProxy.rateLimitPerMin`) and observe a hot path (`api` proxy) and a cron path (the next scheduled cleanup/reminder run) both reflect the change with no redeploy in between.
**Expected:** The change takes effect on the hot path within roughly the TTL window (~60s) and on the very next cron invocation, without any `firebase deploy`.
**Why human:** Requires actual deployed Cloud Functions and a real Firestore write against live infrastructure — cannot be simulated by a unit test against a mocked `./appConfig` module. This phase ships built + tested + UNDEPLOYED per the v1.9 standing autonomy grant.

### 2. R183 — Real cross-instance TTL staleness window

**Test:** Against deployed, warm Cloud Functions v2 instances, confirm the ~60s TTL cache's real staleness behavior on a hot path (does a config change surface within roughly one TTL window, and not sooner/indefinitely later across multiple warm instances).
**Expected:** Config-read latency after a live write is bounded by the TTL window, consistent with the documented design rationale (module-scope cache is per-instance; a TTL is the only cross-instance-correct pattern per the code's own doc-comment).
**Why human:** The cached-vs-fresh routing and the TTL/fresh-bypass/expiry mechanics are already unit-proven (`appConfig.test.ts`, 3 passing cases with asserted `.get()` call counts under `vi.useFakeTimers()`); only the real-world cross-instance timing requires a live deployment to observe.

### Gaps Summary

No gaps found. All automated/code-side criteria for SC1-SC6, R180-R185, and the R190 preservation invariant pass. The two remaining items (R181 live no-redeploy, R183 real TTL staleness) are explicitly and correctly deploy-dependent per the plan's own design and the v1.9 standing autonomy grant — they were never claimed as automatically verified by any plan, and this verification does not record them as passed. Per the task instructions, these route to human verification / `.planning/PENDING-VERIFICATION.md` at hand-off, not to a gap requiring rework.

---

_Verified: 2026-08-20T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
