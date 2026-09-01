---
phase: 102-gated-scripture-fetch-dispatcher
plan: 02
subsystem: api
tags: [firebase-functions, firestore, security, defense-in-depth, esv, nlt]

# Dependency graph
requires:
  - phase: 101
    provides: "Organization.bibleApiEnabled field + authStore.isBibleApiEnabled client computed"
  - phase: 102-01
    provides: "src/utils/scriptureApi.ts client dispatcher gating esv/nlt via authStore.isBibleApiEnabled"
provides:
  - "checkOrgBibleEnablement(db, orgId) — server-side live per-org Bible-API enablement gate, mirrors checkOrgAiEnablement"
  - "esv/nlt proxy branches of the `api` onRequest handler independently reject a disabled/org-less caller before the upstream fetch (R297 server half)"
affects: [103, functions/src/index.ts, deploy-checklist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side org-enablement gate extracted as a standalone async function (db, orgId) => verdict, unit-tested independently of the onRequest handler (no HTTP test harness exists for `api`) — same seam pattern as checkOrgAiEnablement"
    - "Fail-closed (503) on Firestore read error for security-relevant gates, deliberately distinct from the rate limiter's fail-open posture"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "Reused the existing OrgAiEnablementResult union as OrgBibleEnablementResult type alias rather than declaring a parallel type, since the shape is byte-identical"
  - "Gate placed as its own `if (service === \"esv\" || service === \"nlt\")` block after the anthropic block closes and before the shared fetch, rather than folding into the anthropic block's structure — keeps the anthropic branch untouched per the plan's explicit constraint"
  - "Updated one pre-existing test (WR-01: 'esv never calls getAppConfig') whose secondary assertion ('esv never calls getFirestore') was made false by this plan's own gate; updated it to mock an enabled org and assert getFirestore IS called, while preserving its original intent (getAppConfig/rate-limit/ledger stay anthropic-only)"

requirements-completed: [R297]

coverage:
  - id: D1
    description: "checkOrgBibleEnablement live-reads organizations/{orgId}.bibleApiEnabled, denying (403) when false/absent/nonexistent-org and failing closed (503) on a Firestore read error"
    requirement: "R297"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#checkOrgBibleEnablement (org Bible-API enablement gate, R297) — 6 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "esv/nlt proxy branches reject an org-less or disabled-org caller before the upstream fetch, mirroring the anthropic branch's org-required 403"
    requirement: "R297"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts > api (WR-04: anthropic branch end-to-end wiring) > WR-01 ... a non-anthropic service (esv) never calls getAppConfig, and succeeds even if getAppConfig would reject"
        status: pass
    human_judgment: false
  - id: D3
    description: "anthropic branch, rate limiter, usage ledger, and quota logic left byte-unchanged; full functions suite green"
    verification:
      - kind: unit
        ref: "cd functions && npm test — 633/633 passing (627 baseline + 6 new checkOrgBibleEnablement cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No firebase deploy executed; deploy remains deferred to owner-gated milestone-end batch"
    verification: []
    human_judgment: true
    rationale: "Deploy is an explicit owner-gated action outside this plan's scope — nothing to automatically verify; the deferred command is documented in this SUMMARY and the plan's <verification> block for the owner to run when ready."

# Metrics
duration: 25min
completed: 2026-08-31
status: complete
---

# Phase 102 Plan 02: Server-Side Bible-API Defense-in-Depth Gate Summary

**Added `checkOrgBibleEnablement` (mirroring `checkOrgAiEnablement`) and wired it into the `api` proxy's esv/nlt branches so a disabled or org-less caller is rejected server-side before any upstream ESV/NLT fetch — independent of the Plan 102-01 client dispatcher.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-31T18:35:00Z (approx)
- **Completed:** 2026-08-31T19:00:08Z
- **Tasks:** 2
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments
- `checkOrgBibleEnablement(db, orgId)` added to `functions/src/index.ts`, mirroring `checkOrgAiEnablement` 1:1: live `organizations/{orgId}` read, default-OFF deny (403), fail-closed on read error (503), reusing the existing `OrgAiEnablementResult` shape via a new `OrgBibleEnablementResult` type alias.
- Six-case unit-test `describe` block added (ALLOW / DENY-false / DENY-absent / DENY-nonexistent-org / FAIL-CLOSED-503 / reads-exact-org), copying the `checkOrgAiEnablement` harness pattern.
- Wired the gate into the `api` onRequest handler: a new `if (service === "esv" || service === "nlt")` block, placed after the anthropic block and before the shared upstream `fetch`, resolves `callerOrgId` via the existing `resolveOrgId` and rejects with 403 ("Bible API features require an organization.") when org-less, or with the gate's verdict status/message when the org's `bibleApiEnabled !== true`.
- `planningcenter` (not a Bible service) continues to fall through ungated, exactly as before.
- The `anthropic` branch, rate limiter, usage ledger, appConfig read, and quota logic are byte-unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add checkOrgBibleEnablement + unit tests (mirror checkOrgAiEnablement)** - `506ba272` (test)
2. **Task 2: Gate the esv/nlt proxy branches with checkOrgBibleEnablement** - `b0b651e7` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `functions/src/index.ts` - Added `checkOrgBibleEnablement` + `OrgBibleEnablementResult` type alias (~line 335-403); added the esv/nlt gating block in the `api` handler (~line 730-750)
- `functions/src/index.test.ts` - Added `checkOrgBibleEnablement` import + its 6-case `describe` block; updated the pre-existing WR-01 esv test to reflect the new `getFirestore()` call

## Decisions Made
- Reused `OrgAiEnablementResult` as `OrgBibleEnablementResult` (type alias) rather than a parallel duplicate type — the plan explicitly called this out and it kept the diff minimal.
- The new esv/nlt gate block is its own top-level `if`, not nested inside the existing anthropic `if (service === "anthropic")` block, to avoid touching that block at all (plan constraint: anthropic/rate-limiter/ledger/quota byte-unchanged).
- Bible-specific reject messages ("Bible API features are disabled for your organization." / "Could not verify Bible availability. Try again shortly." / "Bible API features require an organization.") chosen to mirror the anthropic branch's phrasing pattern while being clearly Bible-scoped for the client/owner reading logs or error responses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing WR-01 test's `getFirestore` assertion was falsified by this plan's own change**
- **Found during:** Task 2 (running `cd functions && npm test` verification)
- **Issue:** `it("WR-01 ... a non-anthropic service (esv) never calls getAppConfig ...")` also asserted `expect(getFirestore).not.toHaveBeenCalled()`. That assertion was true before this plan (esv was fully Firestore-independent) but is now false by design — esv now calls `getFirestore()` for `checkOrgBibleEnablement`. Left as-is, the test failed with 503 instead of 200 because the test's default mocked Firestore (undefined) made the new gate fail-closed.
- **Fix:** Updated the test to mock an enabled org (`{ bibleApiEnabled: true }`) via the existing `mockCombinedDb` helper and `getFirestore().mockReturnValue(db)`, then changed the assertion to `expect(getFirestore).toHaveBeenCalled()`. The test's original intent — `getAppConfig`/rate-limit/ledger stay scoped to the `anthropic` branch only — is fully preserved and still asserted.
- **Files modified:** `functions/src/index.test.ts`
- **Verification:** `cd functions && npm test` — 633/633 passing
- **Committed in:** `b0b651e7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a pre-existing test made stale by this plan's own intended behavior change)
**Impact on plan:** Necessary correctness fix directly in-scope (the test exercises the exact code path this plan modified). No scope creep — no other test files or unrelated code touched.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
**Deploy is deferred — no action taken this plan.** Per the plan's `user_setup` and `<verification>` sections: when the owner approves the milestone-end batch, run `firebase deploy --only functions:api`. Because `bibleApiEnabled` defaults OFF, deploying this gate will deny esv/nlt for every org not yet explicitly enabled via `setOrgBibleEnabled` — this is intended and must be sequenced with enabling Berean (and any other org) at deploy time.

## Next Phase Readiness
- R297's server-side defense-in-depth half is complete and tested; combined with Plan 102-01's client dispatcher, both legs of the gate exist in code (not yet deployed).
- Phase 103 (BibleGateway/paste fallback UI) can proceed independently — it consumes the `'disabled'` signal from the Plan 102-01 client dispatcher, unaffected by this plan's server-only change.
- Blocker/reminder: this plan's server change must not be deployed until the owner has run `setOrgBibleEnabled` for every org that should keep working, since default is OFF.

## Verification Results
- `cd functions && npm run build` — clean (both tasks).
- `cd functions && npx vitest run src/index.test.ts -t "checkOrgBibleEnablement"` — 6/6 passing (Task 1).
- `cd functions && npm test` — 633/633 passing (Task 2, full suite including the fixed WR-01 test).
- `npm run type-check` (root, `vue-tsc --build`) — clean.
- `grep -n "checkOrgBibleEnablement" functions/src/index.ts` — shows both the definition (line 403) and the call site inside the esv/nlt branch (line 746).
- No `firebase deploy` executed.

## Self-Check: PASSED
- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND: .planning/phases/102-gated-scripture-fetch-dispatcher/102-02-SUMMARY.md
- FOUND: 506ba272 (Task 1 commit)
- FOUND: b0b651e7 (Task 2 commit)

---
*Phase: 102-gated-scripture-fetch-dispatcher*
*Completed: 2026-08-31*
