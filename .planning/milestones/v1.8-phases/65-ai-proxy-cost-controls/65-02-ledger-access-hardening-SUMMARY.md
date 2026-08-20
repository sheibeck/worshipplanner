---
phase: 65-ai-proxy-cost-controls
plan: 02
subsystem: api
tags: [firestore-rules, anthropic-sdk, cost-controls, client-resilience]

# Dependency graph
requires:
  - phase: 65-ai-proxy-cost-controls
    provides: "Plan 65-01's aiUsage/aiRateLimits top-level Firestore collections (Admin-SDK-written) and the proxy's new 429 (rate-limit)/400 (model/token policy) HTTP responses on /api/anthropic"
provides:
  - "Client graceful-degrade guard: getSongSuggestions/getScriptureSuggestions/splitCongregationalReading all resolve to null (never throw) on a proxy 429 or 400, via a shared logAiProxyError classifier"
  - "firestore.rules explicit top-level deny for aiUsage and aiRateLimits, tested against the emulator, committed but UNDEPLOYED"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "logAiProxyError(context, err) classifies a caught error by its numeric .status (Anthropic APIError contract) and console.warns a distinct quiet message for 429/400, console.error otherwise — never affects the caller's unconditional return null"

key-files:
  created: []
  modified:
    - "src/utils/claudeApi.ts — added logAiProxyError; the three catch blocks call it instead of console.error directly"
    - "src/utils/__tests__/claudeApi.test.ts — added 429/400 regression coverage for all three exported AI calls plus logAiProxyError classification tests (existing repo convention: tests for src/utils/claudeApi.ts live in src/utils/__tests__/claudeApi.test.ts, not a sibling src/utils/claudeApi.test.ts as the plan's file path literally said)"
    - "firestore.rules — added match /aiUsage/{docId} and match /aiRateLimits/{docId}, both allow read, write: if false, placed before the catch-all"
    - "src/rules.test.ts — added a describe block asserting an authenticated org editor and an unauthenticated caller are both denied read and write on aiUsage and aiRateLimits"

key-decisions:
  - "Added the new claudeApi tests to the EXISTING src/utils/__tests__/claudeApi.test.ts file rather than creating a new src/utils/claudeApi.test.ts (the plan's literal files_modified path) — the repo's established test-location convention (every other src/utils/*.ts pairs with src/utils/__tests__/*.test.ts) takes precedence, and a second sibling file would have fragmented one module's test suite in two places."
  - "logAiProxyError classifies by reading err.status structurally (typeof check + 'status' in err) rather than importing/instanceof-checking Anthropic's APIError class, so the mocked error objects in tests (plain { status, message } literals) exercise the same code path a real thrown APIError would."
  - "firestore.rules deny blocks were committed but firebase deploy was never run, per the plan's owner-gated constraint — verified no deploy command was executed in this session."

patterns-established: []

requirements-completed: [R161, R162, R163]

coverage:
  - id: D1
    description: "getSongSuggestions, getScriptureSuggestions, and splitCongregationalReading each resolve to null (never throw/reject) when the proxy returns a 429 (rate-limited) or 400 (policy-rejected) response"
    requirement: "R161"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#getSongSuggestions / getScriptureSuggestions / splitCongregationalReading — resolves to null (never throws) on a proxy 429/400"
        status: pass
    human_judgment: false
  - id: D2
    description: "logAiProxyError classifies a 429 and a 400 via console.warn, distinctly from a generic failure (console.error) — an operator can tell a deliberate cost-control rejection from a real outage"
    requirement: "R162"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/claudeApi.test.ts#logAiProxyError — classifies 429/400 distinctly from a generic failure"
        status: pass
    human_judgment: false
  - id: D3
    description: "firestore.rules carries explicit top-level deny blocks for aiUsage and aiRateLimits, proven against the real Firestore emulator (authenticated org editor AND unauthenticated caller both denied read+write on both collections), committed but UNDEPLOYED"
    requirement: "R163"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#aiUsage / aiRateLimits — explicit deny of client read/write (R161/R163, Admin-SDK-only) — 5/5 passing against a live Firestore emulator (npx vitest run --config vitest.rules.config.ts)"
        status: pass
    human_judgment: false
  - id: D4
    description: "App suite (npx vitest run) stays at the documented 2-file known-failing baseline (storage.rules.test.ts, RosterView.test.ts) — no new regressions introduced by this plan"
    verification:
      - kind: unit
        ref: "npx vitest run — 2 files failed / 115 passed (117), 1 test failed / 3644 passed (3658) — matches the pre-existing baseline exactly"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run type-check (vue-tsc --build, includes test files) is clean"
    verification:
      - kind: other
        ref: "npm run type-check — clean, no output"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-20
status: complete
---

# Phase 65 Plan 02: Ledger Access Hardening Summary

**Client-side 429/400 graceful-degrade guard for the AI proxy's new cost controls, plus an owner-gated (committed, UNDEPLOYED) firestore.rules deny for the aiUsage/aiRateLimits collections.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-20T03:24:37Z (immediately after 65-01's completion commit)
- **Completed:** 2026-08-20T03:41:00Z (approx)
- **Tasks:** 2/2
- **Files modified:** 4 (`src/utils/claudeApi.ts`, `src/utils/__tests__/claudeApi.test.ts`, `firestore.rules`, `src/rules.test.ts`)

## Accomplishments

- R161/R162: `src/utils/claudeApi.ts` gained `logAiProxyError(context, err)`, which reads a numeric `.status` off the caught error and `console.warn`s a distinct, quiet message for a 429 (proxy rate/cost-limited this request) and a 400 (proxy rejected by server policy), falling back to `console.error(generic)` for anything else. All three network-calling exports (`getSongSuggestions`, `getScriptureSuggestions`, `splitCongregationalReading`) now call it from their existing catch block instead of `console.error` directly — the `return null` in every catch is unchanged, so the module's documented never-throw contract is intact.
- Added 9 new regression tests to `src/utils/__tests__/claudeApi.test.ts`: 6 proving each of the three exported calls resolves to `null` (never rejects) for both a 429 and a 400, and 3 proving `logAiProxyError` itself routes a 429/400 through `console.warn` and everything else through `console.error`.
- R163: `firestore.rules` now carries explicit `match /aiUsage/{docId}` and `match /aiRateLimits/{docId}` blocks, each `allow read, write: if false;`, placed immediately before the catch-all — defense-in-depth documenting that both collections are Admin-SDK-only (written by 65-01's `api` function), and future-proofing against a refactor that nests either collection under `organizations/{orgId}` (where it would otherwise fall through the org-scoped `/{collection}/{docId}` wildcard, the T-37-15 hole).
- Added a `src/rules.test.ts` describe block with 5 assertions proving, against the real Firestore emulator, that neither an authenticated org editor nor an unauthenticated caller can read or write a doc in `aiUsage` or `aiRateLimits`.
- The `firestore.rules` change is committed but **NOT deployed** — `firebase deploy` was never run in this session, per the plan's owner-gated constraint.

## Task Commits

Each task was committed atomically:

1. **Task 1: Client regression guard — proxy 429/400 surfaces as a graceful null (R161/R162)** - `4fdc12b8` (feat)
2. **Task 2: Owner-gated firestore.rules deny for aiUsage + aiRateLimits (UNDEPLOYED)** - `d6ae4ae1` (feat)

**Plan metadata:** committed together with SUMMARY.md/STATE.md/ROADMAP.md at the end of this execution (see final docs commit in git log).

## Files Created/Modified

- `src/utils/claudeApi.ts` — added `logAiProxyError`; replaced the three `console.error('[claudeApi] <fn> failed:', err)` catch-block lines with calls to it.
- `src/utils/__tests__/claudeApi.test.ts` — added `logAiProxyError` classification tests and 429/400 regression coverage for all three exported AI calls (existing file, not a new one — see Decisions Made).
- `firestore.rules` — added the `aiUsage`/`aiRateLimits` explicit deny blocks before the catch-all.
- `src/rules.test.ts` — added the `aiUsage / aiRateLimits` deny describe block.

## Decisions Made

- **Test file location deviates from the plan's literal `files_modified` path.** The plan listed `src/utils/claudeApi.test.ts` as a new file; the repo's actual, universal convention is `src/utils/__tests__/<name>.test.ts` (110+ existing test files follow this, including a pre-existing `src/utils/__tests__/claudeApi.test.ts` with 73 tests already covering this exact module). Added the new coverage to that existing file instead of creating a second, competing test file for the same module. This is a Rule 1-class correction (following an established, unambiguous project convention over a plan typo), not a scope change — every behavior the plan asked for is tested.
- `logAiProxyError` classifies by structurally reading `err.status` (`typeof err === 'object' && 'status' in err`) rather than `instanceof Anthropic.APIError`, matching the plan's explicit instruction to read the numeric `.status` field, and letting plain mock objects (`{ status: 429, message: '...' }`) in tests exercise the identical branch a real SDK-thrown `APIError` would.
- Confirmed via `git log` that no `firebase deploy` command was run in this session — the rules change is committed, tested, and left undeployed as required.

## Deviations from Plan

None beyond the test-file-location correction documented above (which is itself a project-convention conformance, not a functional deviation) — every task's `<action>` and `<done>` criteria were met as written.

## Issues Encountered

- The first `npm run test:rules` invocation failed with "port taken" — a prior emulator instance from an earlier run in this session had not fully released port 8080 (its shutdown log showed a `NullPointerException` in the rules-tooling server, a known-benign emulator-shutdown quirk unrelated to this plan's changes). Per CLAUDE.md's documented fallback, re-ran the suite directly against the still-running emulator with `npx vitest run --config vitest.rules.config.ts` — all 5 new `aiUsage`/`aiRateLimits` assertions passed, along with the full pre-existing 161-test `src/rules.test.ts` suite (13 skipped, storage-emulator-dependent). `src/storage.rules.test.ts` failed in that same run only because the storage emulator (port 9199) was not up in that fallback invocation — consistent with the known, documented defect described in CLAUDE.md (unrelated to this plan). Killed the leftover emulator process afterward.

## Owner Handover: firestore.rules Deploy (UNDEPLOYED)

The `aiUsage`/`aiRateLimits` deny blocks are committed to `firestore.rules` but were **never deployed** in this session. Per the v1.8 grant, the owner runs:

```
firebase deploy --only firestore:rules
```

Before deploying, the owner may optionally re-run the rules suite against a fresh emulator to reconfirm:

```
npm run test:rules
```

**Nothing in the running app or the `api` Cloud Function depends on this deploy.** The 65-01 function writes `aiUsage`/`aiRateLimits` via the Admin SDK, which bypasses `firestore.rules` entirely; both collections are also already denied by the pre-existing catch-all (`match /{document=**} { allow read, write: if false; }`). This rule is defense-in-depth only.

## User Setup Required

None - no external service configuration required. No `.env`/`.env.local`/`functions/.env` file was written by this plan.

## Next Phase Readiness

- Phase 65 (AI Proxy Cost Controls) is now code-complete across both plans: 65-01 shipped the autonomous rate-limit/model-enforcement/ledger/maxInstances controls (staged for deploy via `firebase deploy --only functions:api`), and 65-02 shipped the client graceful-degrade guard (live, no deploy gate) plus the owner-gated `firestore.rules` hardening (committed, undeployed).
- Two deploy actions remain for the owner/orchestrator before R161-R164 take effect in production: `firebase deploy --only functions:api` (65-01) and, at the owner's discretion, `firebase deploy --only firestore:rules` (65-02, defense-in-depth only).
- No blockers.

---
*Phase: 65-ai-proxy-cost-controls*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: src/utils/claudeApi.ts
- FOUND: src/utils/__tests__/claudeApi.test.ts
- FOUND: firestore.rules
- FOUND: src/rules.test.ts
- FOUND: .planning/phases/65-ai-proxy-cost-controls/65-02-ledger-access-hardening-SUMMARY.md
- FOUND: 4fdc12b8 (Task 1 commit)
- FOUND: d6ae4ae1 (Task 2 commit)
