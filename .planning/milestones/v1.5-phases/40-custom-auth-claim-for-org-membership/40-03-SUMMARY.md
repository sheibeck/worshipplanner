---
phase: 40-custom-auth-claim-for-org-membership
plan: 03
subsystem: auth
tags: [firebase-auth, custom-claims, pinia, race-condition, retry]

# Dependency graph
requires:
  - phase: 40-custom-auth-claim-for-org-membership (plan 01)
    provides: "storage.rules dual-read (claim OR firestore.exists) — the arm this plan's forced refresh feeds"
  - phase: 40-custom-auth-claim-for-org-membership (plan 02)
    provides: "functions/src/orgMembershipClaims.ts's syncOrgMembershipClaim trigger — the async writer whose race with the client this plan closes"
provides:
  - "src/stores/auth.ts CLAIM_REFRESH_MAX_ATTEMPTS (4) / CLAIM_REFRESH_DELAY_MS (1500) — module-scope exported constants plan 40-04's runbook quotes"
  - "refreshOrgClaim(targetOrgId, awaitClaim) — bounded, scope-gated forced getIdTokenResult(user, true) retry"
  - "ensureUserDocument returns { membershipCreated: boolean }, true on both membership-creating batches, false on the already-a-member path"
  - "loadOrgContext(uid, membershipJustCreated = false) — second param threads the just-joined signal from onAuthStateChanged"
affects: [40-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scope-gated retry: a boolean signal computed at the write site (ensureUserDocument) threaded through the call chain to bound a retry to the exact window where it is needed, avoiding a latency regression on the universal path"

key-files:
  created: []
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "refreshOrgClaim called sequentially (awaited) before the org-document read, not concurrently with it, for simplicity — the plan permitted either; sequential keeps the ordinary-path latency assertion (exactly one refresh, no delay) trivially true without needing to reason about interleaving."
  - "The whole retry loop is wrapped in a single try/catch, so a thrown getIdTokenResult call stops all remaining attempts rather than being caught-and-retried per-attempt — matches the plan's exact behavior spec (log once, resolve, org context still loads) rather than adding undocumented per-attempt error tolerance."
  - "Fixed a pre-existing test-infrastructure leak in auth.test.ts: the firebase/auth mock's onAuthStateChanged callback array is created once per test file and grows by one entry per useAuthStore() call across every test in the file; triggerAuthStateChange previously replayed ALL accumulated callbacks. This was harmless while no test asserted mock call counts, but inflated getIdTokenResult call counts to double/triple digits once this plan's exact-count assertions were added. Fixed by invoking only the most-recently-registered callback (the current test's store instance), which preserves identical behavior for all 41 pre-existing tests (verified: all still pass) while making call-count assertions meaningful."

patterns-established:
  - "Pattern: a just-created-this-request boolean flag flows from the write site (ensureUserDocument) through the auth-state-change handler into the read/verify site (loadOrgContext) to scope an expensive retry to the one window it's needed, rather than either applying it universally (latency regression) or omitting it (leaves the race open)."

requirements-completed: [R075]

coverage:
  - id: D1
    description: "Every loadOrgContext call for a user who belongs to an organization performs one forced getIdTokenResult(user, true) refresh; the ordinary (already-a-member) path performs exactly one refresh with no delay."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > performs the forced refresh exactly once on the ordinary (already-a-member) load, with no delay"
        status: pass
    human_judgment: false
  - id: D2
    description: "A user with no organization performs no forced refresh at all — the existing early-return behavior is untouched."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > performs no forced refresh when the user belongs to no organization"
        status: pass
    human_judgment: false
  - id: D3
    description: "When ensureUserDocument has just created a members document, loadOrgContext retries the forced refresh, bounded by CLAIM_REFRESH_MAX_ATTEMPTS, until claims.orgId matches — stopping immediately on the first matching attempt rather than burning the full budget."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > just-joined, claim present on the first refresh: exactly one refresh, no delay"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > just-joined, claim absent then present on the third attempt: three refreshes, two delays, then stops"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > just-joined, claim never arrives: exactly CLAIM_REFRESH_MAX_ATTEMPTS refreshes, then gives up silently"
        status: pass
    human_judgment: false
  - id: D4
    description: "A claim naming a different org than the one loaded never satisfies the wait — the retry continues rather than stopping on a stale/mismatched claim."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > just-joined, claim present but for a different org: the retry continues rather than stopping"
        status: pass
    human_judgment: false
  - id: D5
    description: "A refresh that throws, or that exhausts its attempts, never throws out of loadOrgContext — org context still loads and the app still works via the Firestore fallback arm."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#org claim refresh (R075 / P-01) > a throwing refresh is logged and swallowed: org context is still fully populated"
        status: pass
    human_judgment: false
  - id: D6
    description: "ensureUserDocument reports membershipCreated true on both membership-creating paths (invite acceptance, auto-create-new-org) and false on the already-a-member path."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#ensureUserDocument membershipCreated reporting (P-01) > reports membershipCreated true on the invite-acceptance path"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#ensureUserDocument membershipCreated reporting (P-01) > reports membershipCreated true on the auto-create-new-org path"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#ensureUserDocument membershipCreated reporting (P-01) > reports membershipCreated false on the already-a-member path"
        status: pass
    human_judgment: false
  - id: D7
    description: "orgId, orgName, orgSlug, settings and the member onSnapshot subscription behave exactly as before — no existing auth-store test regresses; waitForRole, the onSnapshot member handler, the R073 settings merge, and logout are untouched by the diff."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts — full file, 46/46 tests pass (37 pre-existing + 9 new)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Type-clean under npm run type-check (vue-tsc --build, the form that also checks test files); no app-suite regression beyond the documented RosterView.test.ts / storage.rules.test.ts baseline."
    requirement: "R075"
    verification:
      - kind: unit
        ref: "npm run type-check — exits 0"
        status: pass
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' — 2 failed files (documented baseline), 2558/2571 tests pass"
        status: pass
    human_judgment: false
  - id: D9
    description: "After deploy 1, the owner accepts the one real never-accepted invite and confirms an upload succeeds without a manual sign-out or page reload — proving the retry wins the race against a real trigger."
    verification: []
    human_judgment: true
    rationale: "Deferred per the v1.5 standing autonomy grant (see <human-check> in 40-03-PLAN.md's verification block). The unit tests prove the mechanism (bounded retry, correct scoping, correct fallback), not live Cloud Functions trigger timing. Recorded in .planning/PENDING-VERIFICATION.md; does not block this plan's completion."

# Metrics
duration: 35min
completed: 2026-08-06
status: complete
---

# Phase 40 Plan 03: Scoped Bounded Token-Refresh Retry Summary

**Forced `getIdTokenResult(user, true)` on every `loadOrgContext` load, with a P-01-scoped bounded retry (4 attempts × 1500ms) that fires only on the just-created-membership path — the ordinary already-a-member path pays exactly one refresh with zero added latency.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-06T22:34:00Z (approx, from plan read)
- **Completed:** 2026-08-06T23:08:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `CLAIM_REFRESH_MAX_ATTEMPTS = 4` and `CLAIM_REFRESH_DELAY_MS = 1500` exported as module-scope constants from `src/stores/auth.ts` (worst case ~4.5s, paid only once per just-joined load)
- `refreshOrgClaim(targetOrgId, awaitClaim)` — forces `getIdTokenResult(user, true)`, loops once (awaitClaim=false) or up to `CLAIM_REFRESH_MAX_ATTEMPTS` times (awaitClaim=true), stops the instant `claims.orgId` strictly matches, never throws out of `loadOrgContext`
- `loadOrgContext(uid, membershipJustCreated = false)` calls `refreshOrgClaim` after `orgId.value` is set and before the org-document read; the no-organization early-return branch performs no refresh at all
- `ensureUserDocument` now returns `{ membershipCreated: boolean }` — `true` on the invite-acceptance batch and the auto-create-new-org batch, `false` on the already-a-member fallthrough path; all three existing discard-the-value call sites (`loginWithGoogle`, `loginWithEmail`, `registerWithEmail`) compile unchanged
- `onAuthStateChanged` threads `membershipCreated` from `ensureUserDocument` into `loadOrgContext`'s new second parameter, with an inline comment explaining the T-40-07 race it closes
- 9 new tests in a `describe('org claim refresh (R075 / P-01)')` block plus a 3-test `describe('ensureUserDocument membershipCreated reporting (P-01)')` block, all asserting exact `getIdTokenResult` call counts (not just "a retry happened") per the plan's explicit instruction
- `getIdTokenResult` added to the `firebase/auth` mock factory (the documented known test trap) — all 8 pre-existing `loadOrgContext`-dependent tests still pass

## Task Commits

1. **Task 1: Forced claim refresh on org-context load, with a bounded retry on the just-joined path** - `1f8db01` (feat) — includes the test-infrastructure leak fix (see Deviations)

_Task 2 (type-check + app-suite regression sweep) produced no code changes — it is a pure verification task. Its results are recorded below and in this SUMMARY's frontmatter; no additional commit was needed since nothing required fixing._

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md update)

## Files Created/Modified
- `src/stores/auth.ts` - `getIdTokenResult` import; `CLAIM_REFRESH_MAX_ATTEMPTS`/`CLAIM_REFRESH_DELAY_MS` module-scope exports; `refreshOrgClaim` helper; `loadOrgContext`'s new `membershipJustCreated` param and refresh call; `ensureUserDocument`'s new `{ membershipCreated }` return shape on all three exit paths; `onAuthStateChanged`'s call-site threading with a race-window comment
- `src/stores/__tests__/auth.test.ts` - `getIdTokenResult` added to the `firebase/auth` mock; `mockOrgDocPathWithInvite` helper (drives the invite-acceptance membership-creation path); 12 new tests across two new `describe` blocks; `triggerAuthStateChange` fixed to invoke only the latest registered callback (deviation, see below)

## Decisions Made
- Called `refreshOrgClaim` sequentially (awaited) before the org-document `getDoc`, not concurrently — the plan allowed either; sequential keeps the "exactly one refresh, no delay" ordinary-path assertion trivially correct without reasoning about interleaving with the org-doc/member-snapshot reads.
- The entire retry loop lives inside one `try`/`catch` rather than per-attempt error handling — a thrown `getIdTokenResult` call stops all remaining attempts and is logged once via `console.error('[auth] refreshOrgClaim:', err)`, matching the plan's exact behavior spec (`<behavior>`: "the refresh throws: the error is logged... loadOrgContext still resolves").
- Chose the invite-acceptance batch (not the auto-create-new-org batch) as the primary test vector for the just-joined retry tests, since it more directly mirrors the real production race (T-40-07) described in 40-RESEARCH.md — the one real never-accepted invite in production takes exactly this path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a pre-existing test-infrastructure leak that inflated `getIdTokenResult` call counts**
- **Found during:** Task 1, first `npx vitest run src/stores/__tests__/auth.test.ts` run
- **Issue:** The `firebase/auth` mock factory in `auth.test.ts` creates its `mockOnAuthStateChangedCallbacks` array once per test *file* (the `vi.mock` factory runs once, not once per test). Every `useAuthStore()` call — one per test, since each test does `const store = useAuthStore()` — pushes a new `onAuthStateChanged` callback into that same shared array. The top-level `beforeEach`'s `(globalThis as Record<string, unknown>).__authCallbacks = []` only resets a *reference*, not the underlying array: the very next `onAuthStateChanged` call inside the test's `useAuthStore()` re-assigns `globalThis.__authCallbacks` back to the same, still-growing array. `triggerAuthStateChange` called `Promise.all(callbacks.map(cb => cb(user)))` — every accumulated callback from every prior test in the file, not just the current one. This was invisible while no test asserted mock call counts (each stale callback just re-set the same store-instance-scoped refs to the same values), but this plan's exact-count assertions on `getIdTokenResult` immediately surfaced it: the ordinary-path test observed 27 calls instead of 1, and later tests observed 124–128 calls, growing with test-file position. Two of the five new tests also hung to the 5000ms timeout, because stale callbacks from other tests kept scheduling real `setTimeout`-based retries that fake timers (scoped to the current test) never advanced.
- **Fix:** Changed `triggerAuthStateChange` to invoke only the most-recently-registered callback (`callbacks[callbacks.length - 1]`) instead of all accumulated callbacks — this is semantically equivalent to "fire the auth-state listener of the store instance this test just created" and is what every existing test actually needed, since no test in this file exercises multiple concurrent store instances.
- **Files modified:** `src/stores/__tests__/auth.test.ts`
- **Verification:** All 46 tests pass (37 pre-existing behavior-preserving + 9 new claim-refresh tests) after the fix; re-ran the full file twice to confirm no flakiness from the fake-timer interaction.
- **Committed in:** `1f8db01` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — Rule 3)
**Impact on plan:** Necessary to make the plan's required exact-call-count assertions meaningful and non-flaky. No behavior change to `src/stores/auth.ts`'s production code; the fix is entirely test-infrastructure. Zero impact on any pre-existing test's outcome (all 37 pre-existing assertions still pass identically).

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. Nothing was deployed (no `firebase deploy`, no `gcloud`), consistent with the hard scope fence.

## Next Phase Readiness

**Final constant values for plan 40-04's runbook:**
- `CLAIM_REFRESH_MAX_ATTEMPTS = 4`
- `CLAIM_REFRESH_DELAY_MS = 1500` (milliseconds)
- Worst-case retry window: ~4.5 seconds, paid only once per just-created-membership load.

**`ensureUserDocument` new return shape:** `Promise<{ membershipCreated: boolean }>` (previously `Promise<void>`). All existing callers (`loginWithGoogle`, `loginWithEmail`, `registerWithEmail`) discard the value and compile unchanged; `onAuthStateChanged` is the one new consumer.

**App-suite failing-file count, before and after this plan:**
- **Before (documented CLAUDE.md baseline, unchanged by this plan):** 2 failing files — `src/storage.rules.test.ts` (environment-limited, needs live Firestore + Storage emulators; 12 tests) and `src/views/__tests__/RosterView.test.ts` (1 stale assertion).
- **After this plan:** identical — 2 failing files, 13 failing tests, 2558/2571 total tests passing, 83/85 files passing. No regression introduced.
- **Type-check:** `npm run type-check` (`vue-tsc --build`) exits 0 — zero errors, including test files.

Plan 40-04 (backfill script + two-deploy runbook) can now cite these exact constants and the confirmed clean type-check/test baseline. Nothing in this plan touched `storage.rules`, `firestore.rules`, or `functions/` — the hard scope fence held.

---
*Phase: 40-custom-auth-claim-for-org-membership*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: src/stores/auth.ts
- FOUND: src/stores/__tests__/auth.test.ts
- FOUND: .planning/phases/40-custom-auth-claim-for-org-membership/40-03-SUMMARY.md
- FOUND: 1f8db01 (Task 1 commit)
- CLAIM_REFRESH_MAX_ATTEMPTS occurs 3 times in src/stores/auth.ts (export declaration, awaitClaim ternary, doc comment)
- CLAIM_REFRESH_DELAY_MS occurs 3 times in src/stores/auth.ts (export declaration, setTimeout call, doc comment)
