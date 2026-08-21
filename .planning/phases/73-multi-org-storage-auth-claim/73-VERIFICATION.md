---
phase: 73-multi-org-storage-auth-claim
verified: 2026-08-21T19:45:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Run the owner-gated deploy sequence in functions/DEPLOY-ORG-CLAIMS.md's 'Phase 73' section (STEP 1: deploy widened syncOrgMembershipClaim; STEP 2: run backfillOrgClaims.js dry-run then --apply; STEP 3: deploy storage.rules), then confirm a real multi-org user (or a test account added to two orgs) can read/write Storage under BOTH org paths in production."
    expected: "The multi-org user succeeds on Storage reads/writes for every org they belong to (not just their pre-widening primary), and an existing single-org user's access is uninterrupted throughout the rollout (no gap between STEP 1 and STEP 3)."
    why_human: "Requires the owner's Firebase deploy credentials and real production tokens/sessions — genuinely unautomatable and, per the milestone's deploy policy, deliberately not run by this phase. Everything ships built + tested + UNDEPLOYED."
---

# Phase 73: Multi-Org Storage Auth Claim Verification Report

**Phase Goal:** A user who belongs to more than one organization keeps full Storage access to every org
they belong to, not just their primary — closing backlog 999.5 before any admin is assigned into a
second org.
**Verified:** 2026-08-21T19:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, R207–R211)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The claim carries every org a user belongs to + per-org role, not just primary, in a shape both rules files can read (R207) | ✓ VERIFIED | `functions/src/orgMembershipClaims.ts:49` adds `OrgMembershipClaims = OrgMembershipClaim & { orgs: Record<string, OrgMembershipRole> }`. `buildOrgsMapClaim` (line 70) + `computeOrgsClaimForUid` (line 126) build it from a live `collectionGroup('members')` scan. Primary `{orgId, role}` (lines 38-59) is byte-unchanged. `orgMembershipClaims.test.ts` proves `orgs` is additive alongside the unchanged primary keys (create/join cases). |
| 2 | Claim-writer recomputes the full set on any `members/*` write via `collectionGroup('members')` (never `users.orgIds`), preserves `superAdmin` through the shared merge helper, never wipes a valid second org on a primary delete (R208) | ✓ VERIFIED | `computeOrgsClaimForUid` (orgMembershipClaims.ts:126) scans `collectionGroup('members')` exclusively — test `"NEVER reads users/{uid}.orgIds"` (orgMembershipClaims.test.ts:220-227) asserts the `users` collection is never queried by the scan. `superAdmin` preservation proven both directions (create/update AND primary-delete) via `mergeAndSetCustomClaims`/`mergeSetAndClearCustomClaims` (both route through `claimsHelpers.ts`, which read-merge-writes rather than replacing). Primary-clear/orgs-recompute independence proven by the "highest-risk case" test (delete org A while org B survives — orgB remains in `orgs`, orgA/role cleared). **WR-01 fix confirmed on master** (commit `455935fa`): the delete branch now issues exactly ONE atomic `setCustomUserClaims` call via the new `mergeSetAndClearCustomClaims` helper (`claimsHelpers.ts:89-99`), closing the prior two-write TOCTOU window the code review flagged — verified by reading the diff and the updated test assertions (`toHaveBeenCalledTimes(1)`). |
| 3 | `storage.rules`' `isOrgMemberByClaim` checks the requested orgId against the full multi-org set, proven by genuine multi-org ALLOW + cross-org DENY emulator tests (R209) | ✓ VERIFIED | `storage.rules:35-47`: `isOrgMemberByClaim(orgId)` ORs a null-guarded `orgs[orgId] != null` arm with the unchanged legacy arm. Ran the emulator suite directly (`npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts -t "multi-org"`): **3/3 pass** — "allows a multi-org user to read and write under BOTH orgs in their orgs map", "denies a multi-org user under an org NOT present in their orgs map (cross-org DENY)", "allows a legacy claim (no orgs key at all)…". |
| 4 | An idempotent, dry-run-by-default, owner-run backfill recomputes the widened claim for every existing user (R210) | ✓ VERIFIED | `functions/src/backfillOrgClaims.ts`: `apply: false` default (`runBackfillCli` only sets `apply=true` on explicit `--apply`, line 286), single `collectionGroup('members').get()` grouped by uid in memory (lines 151-173, never re-scanned per uid), writes via `mergeAndSetCustomClaims` not bare `setCustomUserClaims` (superAdmin preserved — dedicated test at `backfillOrgClaims.test.ts` "superAdmin preserved"), idempotency extended to `orgs` via `orgsMapsEqual` (combined primary+orgs skip-if-matching, lines 187-235). `cd functions && npx vitest run src/backfillOrgClaims.test.ts` green as part of the 452/452 full functions run. |
| 5 | A session still carrying the old single-org claim shape keeps working — both shapes tolerated until backfill runs, no Storage-access gap (R211) | ✓ VERIFIED | `storage.rules:41-45`: the two arms are `||`-combined (never `&&`) — confirmed by direct read. Emulator test "allows a legacy claim (no orgs key at all) to still access its primary org (R211)" passes (part of the 3/3 above), and the pre-existing static-assertion guard (`storage.rules.test.ts:260-284`) now also positively asserts `request.auth.token.orgs` is read while continuing to assert no `firestore.exists(` was reintroduced. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/orgMembershipClaims.ts` | Widened trigger: `orgs` map + `resolveOrgId` + `computeOrgsClaimForUid` + `buildOrgsMapClaim` | ✓ VERIFIED | Read in full; matches SUMMARY claims; WR-01 fix present (`mergeSetAndClearCustomClaims` single-write delete path) |
| `functions/src/claimsHelpers.ts` | `mergeAndSetCustomClaims`, `clearClaimKeys`, plus new `mergeSetAndClearCustomClaims` + `isClaimsTooLargeError` | ✓ VERIFIED | Read in full; both WR-01 and WR-02 helpers present and documented |
| `storage.rules` | `isOrgMemberByClaim` widened with null-guarded `orgs`-map arm ORed with legacy arm | ✓ VERIFIED | Read in full; matches SUMMARY; module comments updated |
| `functions/src/backfillOrgClaims.ts` | Widened backfill: group-by-uid single scan, `mergeAndSetCustomClaims`, combined idempotency | ✓ VERIFIED | Read in full; WR-02 claims-too-large logging present; IN-01 dedup (`orgsMapsEqual` now imported from `orgMembershipClaims.ts`, not duplicated) confirmed |
| `src/storage.rules.test.ts` | Multi-org ALLOW, cross-org DENY, legacy ALLOW emulator tests | ✓ VERIFIED | Read in full; 3 new tests present at lines 144-192, static guard extended |
| `functions/DEPLOY-ORG-CLAIMS.md` | Phase 73 rollout section: exact STEP 1/2/3 owner-run order + commands | ✓ VERIFIED | "Phase 73 — widening to multi-org" section present (line 300+) with `firebase deploy --only functions:syncOrgMembershipClaim`, backfill dry-run/`--apply`, `firebase deploy --only storage`, in the correct dependency order with rationale |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `syncOrgMembershipClaimHandler` (trigger) | `storage.rules` `isOrgMemberByClaim` | Writes `request.auth.token.orgs`; rule reads the same key | ✓ WIRED | Key name (`orgs`) and value shape (`{orgId: role}`) match on both sides — confirmed by reading both files directly, not just the SUMMARY's claim |
| `backfillOrgClaims.ts` | `orgMembershipClaims.ts` shared helpers | Imports `buildOrgsMapClaim`, `decideMembershipClaim`, `resolveOrgId`, `orgsMapsEqual` | ✓ WIRED | Import statement confirmed (`backfillOrgClaims.ts:4-13`); no second/drifted implementation of any of the four |
| `orgMembershipClaims.ts` clear branch | `claimsHelpers.ts` `mergeSetAndClearCustomClaims` | Single atomic write closing the WR-01 TOCTOU gap | ✓ WIRED | Confirmed by reading `orgMembershipClaims.ts:351` and the helper's implementation; test asserts exactly 1 `setCustomUserClaims` call |
| `orgMembershipClaims.ts` / `backfillOrgClaims.ts` catch blocks | `claimsHelpers.ts` `isClaimsTooLargeError` | WR-02 distinguishable logging on the ~1000-byte claims cap | ✓ WIRED | Both catch blocks (`orgMembershipClaims.ts:377`, `backfillOrgClaims.ts:241`) call the shared detector before logging |

### Behavioral Spot-Checks / Gate Runs (executed directly by this verifier, not taken from SUMMARY claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Functions unit suite | `cd functions && npx vitest run` | 452/452 passed, 12 test files | ✓ PASS |
| Root type-check | `npm run type-check` (vue-tsc --build) | Clean, no output/errors | ✓ PASS |
| Storage/Firestore rules emulator suite (correct config, per CLAUDE.md, against the already-running emulator) | `npx vitest run --config vitest.rules.config.ts` | 183/183 passed (167 `src/rules.test.ts` + 16 `src/storage.rules.test.ts`) | ✓ PASS |
| Multi-org rules tests specifically | `npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts -t "multi-org"` | 3/3 passed | ✓ PASS |
| Targeted phase unit files | `cd functions && npx vitest run src/claimsHelpers.test.ts src/backfillOrgClaims.test.ts src/orgMembershipClaims.test.ts` | 65/65 passed | ✓ PASS |
| Full app suite (`npx vitest run`, bare — includes `src/storage.rules.test.ts` since only `src/rules.test.ts` + `render-service/**` are excluded) | `npx vitest run` | 3923/3939 passed; 16 failures across 2 files: `src/views/__tests__/RosterView.test.ts` (1 pre-existing stale-assertion failure, unrelated file, not touched by Phase 73) and `src/storage.rules.test.ts` (timeouts — this file needs `vitest.rules.config.ts`'s config to talk to the emulator correctly; run under the app suite's jsdom config it times out rather than fails on assertions). Per task instructions and CLAUDE.md, this is the documented tooling-artifact baseline, not a regression — the authoritative run of this exact file is the `vitest.rules.config.ts` run above, which is 16/16 clean. | ✓ PASS (baseline, no new regressions) |
| `firestore.rules` untouched by Phase 73 | `git diff --stat 581f746d^ 5decfda4 -- firestore.rules src/stores/auth.ts` | Empty diff | ✓ CONFIRMED |

### Code Review Follow-Through (73-REVIEW.md)

| Finding | Fix Commit | Verified On Master |
|---------|-----------|---------------------|
| WR-01 — non-atomic clear+merge opened a TOCTOU window on primary-org delete | `455935fa` | ✓ Confirmed — `claimsHelpers.ts` gained `mergeSetAndClearCustomClaims`; `orgMembershipClaims.ts`'s clear branch now makes exactly ONE `setCustomUserClaims` call (read the diff and current file; test assertions updated to `toHaveBeenCalledTimes(1)`) |
| WR-02 — no distinguishable signal for the ~1000-byte claims-too-large failure | `788b1806` | ✓ Confirmed — `claimsHelpers.ts` gained `isClaimsTooLargeError`; both `orgMembershipClaims.ts` and `backfillOrgClaims.ts` catch blocks now branch on it with a greppable log line; dedicated tests added in all three affected test files |
| IN-01 — `orgsMapsEqual` duplicated verbatim in two files, signatures already diverging | `5decfda4` | ✓ Confirmed — `backfillOrgClaims.ts` no longer defines its own copy; imports the exported `orgsMapsEqual` from `orgMembershipClaims.ts` |
| IN-02 — role values not validated against the known role set before entering `orgs` | Not fixed (review explicitly marked "not blocking … not a regression introduced by this phase") | Left open by design — pre-existing pattern, inherited from `buildOrgMembershipClaim`; correctly not treated as a phase gap |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R207 | 73-01 | Claim carries all orgs + roles, primary unchanged | ✓ SATISFIED | Truth #1 above |
| R208 | 73-01, 73-03 | Recompute from `collectionGroup('members')`, superAdmin preserved, delete-recompute correctness | ✓ SATISFIED | Truth #2 above (includes WR-01 fix) |
| R209 | 73-02 | `storage.rules` multi-org ALLOW + cross-org DENY, emulator-proven | ✓ SATISFIED | Truth #3 above |
| R210 | 73-03 | Idempotent, dry-run-default, `--apply`-gated backfill | ✓ SATISFIED | Truth #4 above |
| R211 | 73-02 | Backward-compatible legacy claim shape during rollout | ✓ SATISFIED | Truth #5 above |

No orphaned requirements — REQUIREMENTS.md maps exactly R207–R211 to Phase 73, and all five are claimed and verified across the three plans' `requirements-completed` fields.

### Anti-Patterns Found

None. Scanned every file this phase modified (`functions/src/orgMembershipClaims.ts`, `functions/src/backfillOrgClaims.ts`, `functions/src/claimsHelpers.ts`, `storage.rules`, `functions/DEPLOY-ORG-CLAIMS.md`) for `TBD|FIXME|XXX|HACK|PLACEHOLDER` — zero matches outside test files.

### Human Verification Required

1. **Real production deploy + real multi-org access confirmation**
   **Test:** Run the owner-gated deploy sequence in `functions/DEPLOY-ORG-CLAIMS.md`'s "Phase 73" section, in order: STEP 1 `firebase deploy --only functions:syncOrgMembershipClaim`, STEP 2 `node lib/backfillOrgClaims.js` (dry-run, review, then `--apply`), STEP 3 `firebase deploy --only storage`. Then, as (or on behalf of) a real user belonging to two organizations, attempt a Storage read/write under both org paths.
   **Expected:** The multi-org user succeeds on both orgs; no existing single-org user loses access at any point during the three-step rollout.
   **Why human:** Requires the owner's live Firebase deploy credentials and real production sessions/tokens — this is exactly the item the phase's own `73-VALIDATION.md` Manual-Only table and the milestone's deploy policy both call out as owner-gated. Per the autonomy grant, everything in this phase ships built + tested + UNDEPLOYED; this is the only genuinely unautomatable piece.

This item has been added to `.planning/PENDING-VERIFICATION.md` (Phase 73 entry) so it is not lost. **Never mark it passed** — it depends on an owner-run production deploy that has not happened.

### Gaps Summary

No gaps. All five ROADMAP success criteria / R207–R211 are verified directly against the current code and tests on master (not from SUMMARY narrative alone): every file was read in full, the claimed WR-01/WR-02/IN-01 review-fix commits were diffed and confirmed to do what they say, `firestore.rules`/`src/stores/auth.ts` were confirmed untouched by a `git diff --stat` over the phase's full commit range, and every test gate named in the phase's validation strategy was re-run independently by this verifier (functions suite 452/452, rules-emulator suite 183/183 including the 3 new multi-org tests, root type-check clean). The only remaining item is the owner-gated production deploy + live confirmation, which is correctly out of scope for automated verification and is routed to human review rather than silently passed.

---

_Verified: 2026-08-21T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
