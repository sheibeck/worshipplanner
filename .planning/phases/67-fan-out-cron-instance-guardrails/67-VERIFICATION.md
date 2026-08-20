---
phase: 67-fan-out-cron-instance-guardrails
verified: 2026-08-20T03:40:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 67: Fan-out, Cron & Instance Guardrails Verification Report

**Phase Goal:** Every unbounded fan-out and always-running scan is capped or eliminated — the unused daily reminder scan stops running, and email sends, HTTP functions, and the render service all carry explicit ceilings — so no spike or abuse can scale cost without bound.
**Verified:** 2026-08-20T03:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R170: `sendScheduledReminders` performs zero cross-org `collectionGroup` reads while `SCHEDULED_MESSAGING_CRON_ENABLED` is unset/not exactly `"true"`; both sweeps resume when set to `"true"`; the schedule-for-later dispatch consequence is disclosed | ✓ VERIFIED | `functions/src/index.ts:1912-1937` — `runScheduledMessagingCron(env)` early-returns (`env.SCHEDULED_MESSAGING_CRON_ENABLED !== "true"`) at the very top, before either `sendScheduledRemindersHandler()` or `dispatchDueScheduledMessagesHandler()` (which are the only callers of `getFirestore().collectionGroup(...)` in this path) — structurally guarantees zero reads when gated off. Tests: `index.test.ts` "runScheduledMessagingCron (R170: gate OFF by default)" — 3/3 pass (unset → zero collectionGroup calls; non-"true" value → zero calls; `"true"` → both sweeps run). Disclosure present in code comment (1907-1911), 67-01-SUMMARY.md "DISCLOSURE" section, and 67-CONTEXT.md D-R170 — not silently broken. |
| 2 | R171: over-`MESSAGE_MAX_RECIPIENTS` send is rejected `'failed'` (zero sends, never truncated) AND an org at/over `ORG_MAX_EMAILS_PER_DAY` is failed/skipped (zero sends) — both checked before the Resend send loop | ✓ VERIFIED | `functions/src/index.ts:2673-2714` — both `MESSAGE_MAX_RECIPIENTS` (default 200) and `ORG_MAX_EMAILS_PER_DAY` (default 1000, via `checkAndConsumeOrgEmailQuota` at line 396) checks sit strictly between `sendList` construction (line ~2664) and `new Resend(...)` (line 2719) — confirmed by direct file read. `checkAndConsumeOrgEmailQuota` (396-420) mirrors `checkAndConsumeRateLimit`'s fixed-window transaction shape on a top-level `orgEmailCounters` doc; at/over limit returns `allowed:false` without incrementing. Tests: `checkAndConsumeOrgEmailQuota` describe block (4/4 pass — under-limit allows+increments, at/over-limit blocks without incrementing, throwing transaction propagates) and `sendQueuedMessageHandler > R171` describe block (4/4 pass — over-cap rejected zero-sends, over-quota env-override zero-sends, org already-at-cap zero-sends without further increment, normal two-recipient send unaffected). |
| 3 | R172: one project-wide `setGlobalOptions({ maxInstances })` covers every function (incl. `messageWebhook`), while `api`'s own `maxInstances` still overrides it | ✓ VERIFIED | `functions/src/index.ts:246` — `setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES })` (default 20) called once at module top (before the first function definition, `api` at line 467). `api` (line 468) retains its own `maxInstances: AI_PROXY_MAX_INSTANCES` (10) — per-function option overrides the global per Cloud Functions v2 semantics. `messageWebhook` (line 2986) has no per-function `maxInstances`, so it inherits the global 20. Tests: `setGlobalOptions (R172...)` describe block — 2/2 pass (`setGlobalOptionsSpy` called exactly once with `{maxInstances:20}`; source-level assertion that `api`'s own maxInstances option is not clobbered). |
| 4 | R173: `render-service/DEPLOY.md`'s canonical `gcloud run deploy pptx-render` command carries explicit `--max-instances=3` and an explicit, appropriate `--concurrency=1` | ✓ VERIFIED | `render-service/DEPLOY.md:83,85` — `--concurrency=1` and `--max-instances=3` present in the deploy command block; flag table (lines 121,123) and a dedicated callout (93-108) document the R173 rationale and the deliberate concurrency=1-not-4 deviation from 67-CONTEXT.md's floated 4, citing the pre-existing LibreOffice shared-profile-lock rationale (concurrency=1 is load-bearing, not merely defaulted) — satisfies "appropriate," not just "explicit." |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | R170 gate, R171 caps, R172 global options | ✓ VERIFIED | All three present, substantive, wired (see truths 1-3 above) |
| `functions/src/index.test.ts` | New tests for R170/R171/R172 | ✓ VERIFIED | 13 new tests, all present and passing individually and in full suite |
| `render-service/DEPLOY.md` | R173 explicit ceilings | ✓ VERIFIED | `--max-instances=3`, `--concurrency=1` present with rationale |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `runScheduledMessagingCron` gate | `getFirestore().collectionGroup(...)` calls | structural early-return before either sweep | ✓ WIRED | Gate at function top (1915-1920), both sweeps (1921-1936) are after it and inside their own try/catch |
| R171 recipient/quota checks | `new Resend(...)` / send loop | code order | ✓ WIRED | Checks at 2681-2714, Resend instantiated at 2719 — strictly after |
| `setGlobalOptions` call | first function definition (`api`) | module load order | ✓ WIRED | `setGlobalOptions` at line 246, `api` (first `onRequest`) at line 467 |
| `render-service/DEPLOY.md` deploy command | future `gcloud run deploy` invocations | committed doc, single source of truth | ✓ WIRED | Flags present in the one canonical command block; DO-NOT-DEPLOY banner intact so no accidental execution |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full functions test suite | `cd functions && npm test -- --run` | 361/361 pass (8 files) | ✓ PASS |
| Functions TypeScript build | `cd functions && npm run build` | clean (tsc, no errors) | ✓ PASS |
| R170 named tests | `npx vitest run -t "R170"` | 3/3 pass | ✓ PASS |
| R171 named tests | `npx vitest run -t "R171"` | 4/4 pass | ✓ PASS |
| R172 named tests | `npx vitest run -t "R172"` | 2/2 pass | ✓ PASS |
| render-service no-regression | `cd render-service && npm test` | 39/39 pass (3 files) | ✓ PASS |
| R173 grep checks | `grep -q -- '--max-instances=3' DEPLOY.md && grep -q -- '--concurrency=1' DEPLOY.md` | both match | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R170 | 67-01 | Daily cross-org reminder scan eliminated by default, dispatch consequence disclosed | ✓ SATISFIED | `runScheduledMessagingCron` gate + tests |
| R171 | 67-01 | Resend volume cap (per-message + per-org daily quota) | ✓ SATISFIED | recipient cap + `checkAndConsumeOrgEmailQuota` + tests |
| R172 | 67-01 | Project-wide function instance ceiling covering `api` + `messageWebhook` | ✓ SATISFIED | `setGlobalOptions` + per-function override preserved + tests |
| R173 | 67-02 | Cloud Run render service explicit `--max-instances`/`--concurrency` | ✓ SATISFIED | DEPLOY.md flags + rationale |

No orphaned requirements — REQUIREMENTS.md maps only R170-R173 to Phase 67, all four are claimed by the two plans and satisfied.

### Anti-Patterns Found

None. Grepped the diffs for both changed files (`git diff 9b1e02aa..a1a3c9a9 -- functions/src/index.ts` and `git diff 9b1e02aa..6b12c6ab -- render-service/DEPLOY.md`) for `TODO|FIXME|XXX|TBD|placeholder|not yet implemented` — zero matches. No stub returns, no empty handlers, no hardcoded-empty data flowing to rendering.

### Deploy Status (confirmed intentional, not a defect)

All four changes are built, tested, and committed (`7b8a314c`, `f592ad24`, `a1a3c9a9`, `6b12c6ab` — all verified present in git log) but **UNDEPLOYED**, per the phase's DEPLOY POLICY: the orchestrator runs the consolidated `firebase deploy --only functions` / `gcloud run deploy` as a separate milestone-end step. Working tree is clean; no `.env`/`functions/.env` written; `render-service/DEPLOY.md`'s "NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE" banner remains intact.

### Human Verification Required

None. All four success criteria are code-level/test-level facts (structural gate placement, code-order wiring, doc content) verifiable without runtime/production access.

### Gaps Summary

No gaps. All four ROADMAP success criteria for Phase 67 are verified directly against the codebase:
- R170's gate is structurally before any Firestore call (not a query filter), proven by both direct code read and a passing zero-collectionGroup-calls test.
- R171's two checks are both wired strictly before `new Resend(...)`, proven by both direct code read and passing zero-Resend-calls tests for both the over-cap and over-quota paths.
- R172's `setGlobalOptions` call precedes the first function definition and does not clobber `api`'s own tighter cap, proven by direct code read and a source-inspection test.
- R173's DEPLOY.md carries both ceilings with documented rationale for the concurrency=1 decision.

The full functions test suite (361/361) and build (clean tsc) both pass, and the render-service suite (39/39) shows no regression from the doc-only R173 change. All work is deliberately staged (not deployed) per the phase's own DEPLOY POLICY — this is disclosed and expected, not a gap.

---

*Verified: 2026-08-20T03:40:00Z*
*Verifier: Claude (gsd-verifier)*
